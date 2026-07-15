/**
 * Permission Gate — 权限门控系统 (v9.2-Peng)
 * 
 * 七层安全权限的前三层实现：
 * 1. Tool Pre-filtering（工具预过滤）
 * 2. Deny-first Rule Evaluation（拒绝优先规则）
 * 3. Permission Mode Constraints（权限模式约束）
 * 
 * 关键功能：
 * - 飞书通知集成（关键节点 pause 等人确认）
 * - 审批模式光谱（plan → default → acceptEdits → semi-auto → auto → dontAsk → bypass）
 * - 成本预估与预算检查
 * - 审计日志记录
 */

import fs from 'fs';
import path from 'path';

import { notifyPermissionRequest } from './feishu-notifier.js';

// ============ 权限模式定义 ============
const PERMISSION_MODES = {
  'plan': {
    name: '计划模式',
    description: '仅分析和建议，不执行任何操作',
    autoApprove: ['preview'],
    requiresApproval: ['render', 'edit', 'color', 'export', 'delete']
  },
  'default': {
    name: '默认模式',
    description: '每次渲染/导出需确认',
    autoApprove: ['preview', 'proxy'],
    requiresApproval: ['render', 'edit', 'color', 'export', 'delete']
  },
  'acceptEdits': {
    name: '接受编辑',
    description: '时间线编辑自动批准，导出需确认',
    autoApprove: ['preview', 'proxy', 'edit'],
    requiresApproval: ['render', 'color', 'export', 'delete']
  },
  'semi-auto': {
    name: '半自动',
    description: '预览+剪辑+调色自动，最终导出需确认',
    autoApprove: ['preview', 'proxy', 'edit', 'color'],
    requiresApproval: ['render', 'export', 'delete']
  },
  'auto': {
    name: '自动模式',
    description: '全流水线自动，异常时人工介入',
    autoApprove: ['preview', 'proxy', 'edit', 'color', 'render'],
    requiresApproval: ['export', 'delete']
  },
  'dontAsk': {
    name: '不询问',
    description: '仅预批准操作，其余静默拒绝',
    autoApprove: ['preview'],
    requiresApproval: ['proxy', 'edit', 'color', 'render', 'export', 'delete']
  },
  'bypass': {
    name: '绕过权限',
    description: '禁用所有安全检查（仅隔离环境）',
    autoApprove: ['*'],
    requiresApproval: []
  }
};

// ============ 工具分类映射 ============
const TOOL_CATEGORIES = {
  // 预览类（只读，低风险）
  'story-engine': 'preview',
  'shot-design': 'preview',
  'storyboard-gen': 'preview',
  'pitch-evaluation': 'preview',
  'requirement-alignment': 'preview',
  
  // 代理生成类（低修改风险）
  'character-manager': 'proxy',
  'micromotion': 'proxy',
  'choreography': 'proxy',
  
  // 编辑类（中等风险）
  'render-engine': 'render',
  'post-production': 'edit',
  'sound-design': 'edit',
  'color-grade': 'color',
  
  // 导出类（高风险，不可逆）
  'delivery-engine': 'export',
  
  // 删除类（最高风险）
  'cleanup': 'delete',
  'delete-original': 'delete'
};

// ============ Deny-first 规则 ============
const DENY_RULES = [
  {
    id: 'no-delete-original',
    name: '禁止删除原始素材',
    pattern: { tool: 'cleanup', action: 'delete-original' },
    reason: '原始素材为不可再生资产，禁止删除',
    severity: 'critical'
  },
  {
    id: 'no-overwrite-export',
    name: '禁止覆盖已交付文件',
    pattern: { tool: 'delivery-engine', action: 'overwrite' },
    reason: '已交付文件具有法律效力，禁止覆盖',
    severity: 'critical'
  },
  {
    id: 'no-render-without-plan',
    name: '禁止无方案渲染',
    pattern: { tool: 'render-engine', action: 'render' },
    condition: (state) => !state.timelineState?.hasPlan,
    reason: '未通过方案评审，禁止进入渲染阶段',
    severity: 'high'
  },
  {
    id: 'budget-threshold',
    name: '预算阈值保护',
    pattern: { category: 'render' },
    condition: (state, config) => state.renderBudgetUsed >= config.budgetLimit * 0.9,
    reason: '预算使用超过90%，需人工确认后继续',
    severity: 'high'
  }
];

// ============ Permission Gate 主类 ============
export class PermissionGate {
  constructor(config = {}) {
    this.mode = config.permissionMode || 'semi-auto';
    this.budgetLimit = config.renderBudgetUSD || 10.0;
    this.modeConfig = PERMISSION_MODES[this.mode];
    this.auditLog = [];
    this.pendingApprovals = new Map();
  }
  
  /**
   * 评估工具调用请求
   * @param {Array} toolCalls - 工具调用列表
   * @param {Object} state - 当前状态
   * @returns {Object} { approved, blocked, pending, notifications }
   */
  async evaluate(toolCalls, state) {
    const approved = [];
    const blocked = [];
    const pending = [];
    const notifications = [];
    
    for (const tool of toolCalls) {
      const category = this.getToolCategory(tool.name);
      
      // Layer 1: Tool Pre-filtering
      if (this.isToolDenied(tool.name)) {
        blocked.push(this.createBlock(tool, 'Tool Pre-filtering: 工具在拒绝列表中'));
        continue;
      }
      
      // Layer 2: Deny-first Rule Evaluation
      const denyCheck = this.checkDenyRules(tool, state);
      if (denyCheck.denied) {
        blocked.push(this.createBlock(tool, denyCheck.reason));
        continue;
      }
      
      // Layer 3: Permission Mode Constraints
      const modeCheck = this.checkModePermission(category, tool, state);
      
      if (modeCheck.blocked) {
        blocked.push(this.createBlock(tool, modeCheck.reason));
      } else if (modeCheck.requiresApproval) {
        pending.push({
          tool,
          category,
          reason: modeCheck.reason,
          estimatedCost: this.estimateCost(tool),
          riskLevel: this.assessRisk(tool, category)
        });
        notifications.push(this.createNotification(tool, state));
      } else {
        approved.push(tool);
      }
    }
    
    // 记录审计日志
    this.logEvaluation(toolCalls, approved, blocked, pending);
    
    // 🔔 飞书通知：如果有待确认的操作，通知队长
    if (pending.length > 0 && state.projectId) {
      for (const item of pending) {
        try {
          notifyPermissionRequest(
            state.projectId,
            item.tool.name,
            item.estimatedCost,
            item.reason,
            { category: item.category, riskLevel: item.riskLevel }
          ).then(result => {
            if (result.sent) {
              console.log(`[PermissionGate] 已发送飞书通知: ${item.tool.name}`);
            }
          }).catch(err => {
            console.error('[PermissionGate] 飞书通知发送失败:', err.message);
          });
        } catch (err) {
          console.error('[PermissionGate] 飞书通知异常:', err.message);
        }
      }
    }
    
    return { approved, blocked, pending, notifications };
  }
  
  // ============ Layer 1: Tool Pre-filtering ============
  isToolDenied(toolName) {
    const deniedTools = [
      'rm', 'delete-original', 'format-disk',
      'exec-shell', 'network-request',
      'system-modify', 'config-override'
    ];
    return deniedTools.includes(toolName);
  }
  
  // ============ Layer 2: Deny-first Rules ============
  checkDenyRules(tool, state) {
    for (const rule of DENY_RULES) {
      // 检查工具匹配
      if (rule.pattern.tool && rule.pattern.tool !== tool.name) continue;
      if (rule.pattern.action && rule.pattern.action !== tool.params?.action) continue;
      if (rule.pattern.category && rule.pattern.category !== this.getToolCategory(tool.name)) continue;
      
      // 检查自定义条件
      if (rule.condition && !rule.condition(state, { budgetLimit: this.budgetLimit })) continue;
      
      return {
        denied: true,
        ruleId: rule.id,
        ruleName: rule.name,
        reason: `Deny-first: ${rule.reason}`,
        severity: rule.severity
      };
    }
    
    return { denied: false };
  }
  
  // ============ Layer 3: Permission Mode ============
  checkModePermission(category, tool, state) {
    const modeConfig = PERMISSION_MODES[this.mode];
    
    // bypass 模式：全部通过
    if (modeConfig.autoApprove.includes('*')) {
      return { blocked: false, requiresApproval: false };
    }
    
    // 检查是否在自动批准列表
    if (modeConfig.autoApprove.includes(category)) {
      // 额外检查：预算阈值
      const cost = this.estimateCost(tool);
      if (state.renderBudgetUsed + cost > this.budgetLimit) {
        return {
          blocked: false,
          requiresApproval: true,
          reason: `预算即将耗尽: ${(state.renderBudgetUsed + cost).toFixed(2)}/${this.budgetLimit} USD`
        };
      }
      return { blocked: false, requiresApproval: false };
    }
    
    // 检查是否需要审批
    if (modeConfig.requiresApproval.includes(category)) {
      return {
        blocked: false,
        requiresApproval: true,
        reason: `模式 "${modeConfig.name}" 要求 "${category}" 类操作需人工确认`
      };
    }
    
    // 默认：静默拒绝
    return {
      blocked: true,
      reason: `模式 "${modeConfig.name}" 未授权 "${category}" 类操作`
    };
  }
  
  // ============ 风险评估 ============
  assessRisk(tool, category) {
    const riskMatrix = {
      'preview': 'low',
      'proxy': 'low',
      'edit': 'medium',
      'color': 'medium',
      'render': 'high',
      'export': 'high',
      'delete': 'critical'
    };
    
    let risk = riskMatrix[category] || 'medium';
    
    // 额外风险因子
    if (tool.params?.resolution === '4k') risk = 'high';
    if (tool.params?.action === 'overwrite') risk = 'critical';
    if (tool.params?.budget && tool.params.budget > 5.0) risk = 'high';
    
    return risk;
  }
  
  // ============ 成本估算 ============
  estimateCost(tool) {
    const baseCosts = {
      'story-engine': 0.01,
      'shot-design': 0.01,
      'pitch-evaluation': 0.005,
      'character-manager': 0.02,
      'render-engine': 0.5,  // 基础渲染成本
      'post-production': 0.05,
      'sound-design': 0.1,
      'delivery-engine': 0.01
    };
    
    let cost = baseCosts[tool.name] || 0.1;
    
    // 分辨率系数
    if (tool.params?.resolution) {
      const resMultiplier = {
        '480p': 0.05,
        '720p': 0.2,
        '1080p': 0.8,
        '2k': 2.0,
        '4k': 5.0
      };
      cost *= resMultiplier[tool.params.resolution] || 1.0;
    }
    
    // 时长系数
    if (tool.params?.duration) {
      cost *= (tool.params.duration / 15); // 按15秒基准计费
    }
    
    return parseFloat(cost.toFixed(3));
  }
  
  // ============ 飞书通知生成 ============
  createNotification(tool, state) {
    const category = this.getToolCategory(tool.name);
    const cost = this.estimateCost(tool);
    const risk = this.assessRisk(tool, category);
    
    const riskEmoji = {
      'low': '🟢',
      'medium': '🟡',
      'high': '🔴',
      'critical': '⛔'
    };
    
    return {
      type: 'permission_request',
      title: `需要确认: ${tool.name}`,
      message: `${riskEmoji[risk]} 风险级别: ${risk}\n` +
               `📦 工具: ${tool.name}\n` +
               `🏷️ 类别: ${category}\n` +
               `💰 预估成本: ${cost.toFixed(3)} USD\n` +
               `📊 当前预算: ${state.renderBudgetUsed.toFixed(2)}/${this.budgetLimit} USD\n` +
               `📝 参数: ${JSON.stringify(tool.params || {})}\n\n` +
               `请回复确认或拒绝。`,
      tool,
      estimatedCost: cost,
      riskLevel: risk,
      projectId: state.projectId
    };
  }
  
  // ============ 审批响应处理 ============
  async handleApproval(toolId, decision, state) {
    const { approve, comments = '' } = decision;
    
    this.log({
      type: 'approval_decision',
      toolId,
      approved: approve,
      comments,
      timestamp: new Date().toISOString()
    });
    
    if (approve) {
      return { approved: true, message: '已批准' };
    } else {
      return { approved: false, message: comments || '已拒绝' };
    }
  }
  
  /**
   * 三级质量决策（绿灯/黄灯/红灯）
   * 集成到权限门控中，对质量评估结果进行分级处理
   */
  evaluateQualityTier(scores) {
    // 动态导入避免循环依赖
    let evaluateQualityTier;
    try {
      const mde = require('./model-decision-engine.js');
      evaluateQualityTier = mde.evaluateQualityTier;
    } catch (e) {
      // ESM 环境下的降级
      evaluateQualityTier = (s) => {
        const total = s.total || 0;
        if (total >= 8.5) return { tier: 'green', reason: '方案优秀' };
        if (total >= 7.0) return { tier: 'yellow', reason: `总分 ${total}，需优化` };
        return { tier: 'red', reason: `总分 ${total}，需重写` };
      };
    }
    
    const result = evaluateQualityTier(scores);
    
    // 根据质量分级调整权限策略
    if (result.tier === 'red') {
      // 红灯：阻断渲染，要求重写
      this.logEvaluation([], [], [{ 
        tool: { name: 'quality-gate' }, 
        reason: `红灯: ${result.reason}` 
      }], []);
    } else if (result.tier === 'yellow') {
      // 黄灯：标记待确认，发送飞书通知
      this.logEvaluation([], [], [], [{
        tool: { name: 'quality-gate' },
        category: 'review',
        reason: `黄灯: ${result.reason}。${result.guidance || '建议优化后再渲染'}`,
        estimatedCost: 0,
        riskLevel: 'medium'
      }]);
    }
    
    return result;
  }
  
  /**
   * 风格漂移检测（v7.0-Peng-Style）
   * 在质量评估阶段检查风格一致性
   */
  checkStyleDrift(state) {
    if (!state?.styleDNA || !state?.prevShotDNA) return null;
    
    let detectStyleDrift;
    try {
      const mde = require('./model-decision-engine.js');
      detectStyleDrift = mde.detectStyleDrift;
    } catch (e) {
      detectStyleDrift = (prev, curr, scene) => {
        return { detected: false };
      };
    }
    
    const drift = detectStyleDrift(state.prevShotDNA, state.styleDNA, state.sceneContinuity || 'continuous');
    
    if (drift?.detected) {
      this.logEvaluation([], [], [], [{
        tool: { name: 'style-drift-guard' },
        category: 'review',
        reason: `风格漂移检测到 ${drift.violations.length} 处偏差: ${drift.violations.map(v => `${v.param}(±${v.diff})`).join(', ')}`,
        estimatedCost: 0,
        riskLevel: 'medium'
      }]);
    }
    
    return drift;
  }
  
  // ============ 工具分类 ============
  getToolCategory(toolName) {
    return TOOL_CATEGORIES[toolName] || 'preview';
  }
  
  // ============ 审计日志 ============
  logEvaluation(toolCalls, approved, blocked, pending) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      requested: toolCalls.length,
      approved: approved.length,
      blocked: blocked.length,
      pending: pending.length,
      blockedDetails: blocked.map(b => ({ tool: b.tool.name, reason: b.reason })),
      pendingDetails: pending.map(p => ({ tool: p.tool.name, reason: p.reason }))
    });
  }
  
  log(event) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      ...event
    });
  }
  
  // ============ 导出审计日志 ============
  exportAuditLog() {
    return {
      mode: this.mode,
      totalEvents: this.auditLog.length,
      events: this.auditLog
    };
  }
  
  // ============ 工具方法 ============
  createBlock(tool, reason) {
    return {
      tool,
      reason,
      timestamp: new Date().toISOString()
    };
  }
  
  getModeInfo() {
    return this.modeConfig;
  }
  
  setMode(mode) {
    if (!PERMISSION_MODES[mode]) {
      throw new Error(`未知权限模式: ${mode}`);
    }
    this.mode = mode;
    this.modeConfig = PERMISSION_MODES[mode];
    this.log({ type: 'mode_change', newMode: mode });
  }
}

// ============ 便捷函数 ============
export function createPermissionGate(config) {
  return new PermissionGate(config);
}

export { PERMISSION_MODES, TOOL_CATEGORIES, DENY_RULES };

// ============ 测试入口 ============
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const gate = new PermissionGate({ permissionMode: 'semi-auto', renderBudgetUSD: 10.0 });
  
  const testTools = [
    { name: 'story-engine', params: { action: 'generate' } },
    { name: 'render-engine', params: { resolution: '1080p', duration: 120 } },
    { name: 'delivery-engine', params: { action: 'export' } },
    { name: 'delete-original', params: {} }
  ];
  
  const mockState = {
    projectId: 'test-project',
    renderBudgetUsed: 2.0,
    timelineState: { hasPlan: true }
  };
  
  gate.evaluate(testTools, mockState).then(result => {
    console.log('=== Permission Gate 测试结果 ===');
    console.log('已批准:', result.approved.map(t => t.name));
    console.log('已阻断:', result.blocked.map(b => `${b.tool.name} — ${b.reason}`));
    console.log('待确认:', result.pending.map(p => `${p.tool.name} — ${p.reason}`));
  });
}
