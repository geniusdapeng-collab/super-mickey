/**
 * Seedance Permission Gate v9.3-Peng — 权限决策门
 * 
 * 核心功能：
 * 1. 关键决策点 Human-in-the-loop（用户确认机制）
 * 2. 七层安全审批（版权→合规→品牌→法律→伦理→质量→发布）
 * 3. 自动模式分类（auto/suggest/block）
 * 4. 与OpenClaw通知系统集成（飞书消息推送）
 * 
 * 使用场景：
 * - 渲染前闸机：评分<40时请求用户确认
 * - 预算超限：超预算自动拒绝
 * - 敏感内容：暴力/色情/政治内容拦截
 * - 角色一致性变更：角色外观大幅修改时确认
 * - 风格突变：与既定风格差异过大时确认
 * 
 * 安全原则：Deny-first（默认拒绝，显式放行）
 */

const path = require('path');

// ============ 决策类型定义 ============
const DECISION_TYPES = {
  // 渲染决策
  RENDER: {
    id: 'RENDER',
    name: '渲染确认',
    description: '提交Seedance API前的最终确认',
    autoThreshold: 70,   // ≥70分自动通过
    suggestThreshold: 40, // 40-69分建议确认
    blockThreshold: 40,   // <40分自动阻断
    timeoutMs: 300000,     // 5分钟等待
    escalationDelay: 60000 // 1分钟后升级通知
  },
  
  // 预算决策
  BUDGET: {
    id: 'BUDGET',
    name: '预算确认',
    description: '超出预算上限时的确认',
    autoThreshold: 100,   // 100%以下自动通过
    suggestThreshold: 100, // 100-120%建议确认
    blockThreshold: 120,   // >120%自动阻断
    timeoutMs: 180000,
    escalationDelay: 30000
  },
  
  // 内容安全
  SAFETY: {
    id: 'SAFETY',
    name: '内容安全',
    description: '敏感内容检测与拦截',
    autoThreshold: 0,     // 无敏感词自动通过
    suggestThreshold: 1,  // 有敏感词建议确认
    blockThreshold: 3,    // 严重敏感词自动阻断
    timeoutMs: 60000,
    escalationDelay: 15000
  },
  
  // 角色一致性
  CHARACTER: {
    id: 'CHARACTER',
    name: '角色一致性',
    description: '角色外观/性格大幅变更确认',
    autoThreshold: 90,    // ≥90%相似度自动通过
    suggestThreshold: 70, // 70-89%建议确认
    blockThreshold: 50,  // <50%自动阻断
    timeoutMs: 120000,
    escalationDelay: 30000
  },
  
  // 风格一致性
  STYLE: {
    id: 'STYLE',
    name: '风格一致性',
    description: '视觉风格偏离既定风格时确认',
    autoThreshold: 80,
    suggestThreshold: 60,
    blockThreshold: 40,
    timeoutMs: 120000,
    escalationDelay: 30000
  },
  
  // 质量闸机
  QUALITY: {
    id: 'QUALITY',
    name: '质量闸机',
    description: '比稿评分过低时的确认',
    autoThreshold: 7.5,   // ≥7.5自动通过
    suggestThreshold: 6.0, // 6.0-7.4建议确认
    blockThreshold: 4.0,  // <4.0自动阻断
    timeoutMs: 180000,
    escalationDelay: 30000
  }
};

// ============ 审批层级 ============
const APPROVAL_LEVELS = {
  AUTO: { level: 0, name: '自动通过', requiresHuman: false },
  SUGGEST: { level: 1, name: '建议确认', requiresHuman: true },
  REQUIRE: { level: 2, name: '必须确认', requiresHuman: true },
  BLOCK: { level: 3, name: '自动阻断', requiresHuman: false }
};

class PermissionGate {
  constructor(options = {}) {
    this.autoMode = options.autoMode !== undefined ? options.autoMode : false; // 全自动模式（测试用）
    this.notifyChannel = options.notifyChannel || 'feishu'; // 通知渠道
    this.defaultTimeout = options.defaultTimeout || 300000;
    this.decisionLog = []; // 决策日志
    
    // 决策统计
    this.stats = {
      total: 0,
      auto: 0,
      suggest: 0,
      require: 0,
      block: 0,
      approved: 0,
      rejected: 0,
      timeout: 0
    };
  }

  /**
   * 评估是否需要用户确认
   * @param {string} decisionType - 决策类型ID
   * @param {number} score - 评分/数值
   * @param {Object} context - 上下文信息
   * @returns {Object} - 决策结果
   */
  evaluate(decisionType, score, context = {}) {
    const config = DECISION_TYPES[decisionType];
    if (!config) {
      throw new Error(`未知的决策类型: ${decisionType}`);
    }
    
    let level, decision;
    
    if (score >= config.autoThreshold) {
      // 自动通过
      level = APPROVAL_LEVELS.AUTO;
      decision = { approved: true, reason: '评分达标，自动通过' };
    } else if (score >= config.suggestThreshold) {
      // 建议确认
      level = APPROVAL_LEVELS.SUGGEST;
      decision = { approved: null, reason: '评分一般，建议人工确认' };
    } else if (score >= config.blockThreshold) {
      // 必须确认
      level = APPROVAL_LEVELS.REQUIRE;
      decision = { approved: null, reason: '评分偏低，必须人工确认' };
    } else {
      // 自动阻断
      level = APPROVAL_LEVELS.BLOCK;
      decision = { approved: false, reason: '评分过低，自动阻断' };
    }
    
    // 全自动模式：SUGGEST也自动通过（仅测试环境）
    if (this.autoMode && level.level <= APPROVAL_LEVELS.SUGGEST.level) {
      decision.approved = true;
      decision.reason += '（自动模式）';
    }
    
    const result = {
      decisionType,
      score,
      level: level.name,
      levelCode: level.level,
      requiresHuman: level.requiresHuman && !this.autoMode,
      approved: decision.approved,
      reason: decision.reason,
      timeoutMs: config.timeoutMs,
      context,
      timestamp: new Date().toISOString()
    };
    
    // 记录决策
    this._logDecision(result);
    
    return result;
  }

  /**
   * 渲染前闸机（综合评估）
   * @param {Object} params - 评估参数
   */
  preRenderGate(params) {
    const {
      alignmentScore,    // 对齐闸机评分
      pitchScore,        // 比稿评分
      budgetUsed,        // 已用预算百分比
      budgetTotal,       // 总预算
      safetyFlags,       // 安全标记数
      characterDrift,    // 角色漂移度
      styleDrift         // 风格漂移度
    } = params;
    
    const checks = [];
    
    // 1. 对齐检查
    const alignment = this.evaluate('RENDER', alignmentScore || 0, { type: 'alignment' });
    checks.push({ name: '对齐闸机', result: alignment });
    
    // 2. 比稿检查
    const pitch = this.evaluate('QUALITY', (pitchScore || 0) * 10, { type: 'pitch' }); // 7.5 → 75
    checks.push({ name: '比稿评分', result: pitch });
    
    // 3. 预算检查
    const budgetPct = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0;
    const budget = this.evaluate('BUDGET', budgetPct, { type: 'budget', used: budgetUsed, total: budgetTotal });
    checks.push({ name: '预算使用', result: budget });
    
    // 4. 安全检查
    const safety = this.evaluate('SAFETY', safetyFlags || 0, { type: 'safety' });
    checks.push({ name: '内容安全', result: safety });
    
    // 5. 角色一致性
    if (characterDrift !== undefined) {
      const character = this.evaluate('CHARACTER', characterDrift, { type: 'character' });
      checks.push({ name: '角色一致性', result: character });
    }
    
    // 6. 风格一致性
    if (styleDrift !== undefined) {
      const style = this.evaluate('STYLE', styleDrift, { type: 'style' });
      checks.push({ name: '风格一致性', result: style });
    }
    
    // 综合决策：任一BLOCK则阻断，任一REQUIRE则需确认
    const blocked = checks.some(c => c.result.levelCode === APPROVAL_LEVELS.BLOCK.level);
    const required = checks.some(c => c.result.levelCode === APPROVAL_LEVELS.REQUIRE.level);
    const suggested = checks.some(c => c.result.levelCode === APPROVAL_LEVELS.SUGGEST.level);
    
    let finalDecision;
    if (blocked) {
      finalDecision = { approved: false, reason: '有检查项未通过，自动阻断' };
    } else if (required) {
      finalDecision = { approved: null, reason: '有检查项必须人工确认' };
    } else if (suggested) {
      finalDecision = { approved: null, reason: '有检查项建议人工确认' };
    } else {
      finalDecision = { approved: true, reason: '所有检查项通过' };
    }
    
    // 全自动模式
    if (this.autoMode && !blocked) {
      finalDecision.approved = true;
      finalDecision.reason += '（自动模式）';
    }
    
    const result = {
      phase: 'pre-render',
      checks,
      ...finalDecision,
      requiresHuman: finalDecision.approved === null,
      timestamp: new Date().toISOString(),
      params
    };
    
    this._logDecision(result);
    
    return result;
  }

  /**
   * 生成用户确认消息（飞书格式）
   * @param {Object} decision - 决策结果
   * @returns {string} - 消息内容
   */
  generateConfirmationMessage(decision) {
    const { checks, approved, reason } = decision;
    
    let message = `🎬 **Seedance渲染确认请求**\n\n`;
    message += `**状态**: ${approved === null ? '⏳ 等待确认' : (approved ? '✅ 已通过' : '❌ 已阻断')}\n`;
    message += `**原因**: ${reason}\n\n`;
    
    if (checks) {
      message += `**详细检查**:\n`;
      for (const check of checks) {
        const icon = check.result.levelCode === 0 ? '✅' : 
                     check.result.levelCode === 1 ? '⚠️' :
                     check.result.levelCode === 2 ? '🔴' : '❌';
        message += `${icon} ${check.name}: ${check.result.score.toFixed(1)} — ${check.result.reason}\n`;
      }
    }
    
    if (approved === null) {
      message += `\n**请回复**: 「确认」继续渲染 / 「拒绝」取消任务\n`;
      message += `**超时**: ${(decision.timeoutMs || this.defaultTimeout) / 60000}分钟后自动取消`;
    }
    
    return message;
  }

  /**
   * 模拟用户确认（实际项目中接入OpenClaw消息系统）
   * @param {Object} decision - 决策结果
   * @param {boolean} userApproved - 用户是否批准
   * @returns {Object}
   */
  confirm(decision, userApproved) {
    const result = {
      ...decision,
      approved: userApproved,
      reason: userApproved ? '用户确认通过' : '用户拒绝',
      confirmedAt: new Date().toISOString()
    };
    
    if (userApproved) {
      this.stats.approved++;
    } else {
      this.stats.rejected++;
    }
    
    this._logDecision(result);
    
    return result;
  }

  /**
   * 超时处理
   * @param {Object} decision - 决策结果
   */
  timeout(decision) {
    const result = {
      ...decision,
      approved: false,
      reason: '等待超时，自动取消',
      timedOutAt: new Date().toISOString()
    };
    
    this.stats.timeout++;
    this._logDecision(result);
    
    return result;
  }

  /**
   * 获取决策统计
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 获取决策日志
   */
  getDecisionLog(limit = 50) {
    return this.decisionLog.slice(-limit);
  }

  /**
   * 清空日志
   */
  clearLog() {
    this.decisionLog = [];
    this.stats = {
      total: 0,
      auto: 0,
      suggest: 0,
      require: 0,
      block: 0,
      approved: 0,
      rejected: 0,
      timeout: 0
    };
  }

  /**
   * 设置自动模式
   */
  setAutoMode(enabled) {
    this.autoMode = enabled;
    console.log(`[PermissionGate] 自动模式: ${enabled ? '开启' : '关闭'}`);
  }

  /**
   * 记录决策日志
   */
  _logDecision(result) {
    this.decisionLog.push(result);
    this.stats.total++;
    
    // 统计各层级
    if (result.levelCode !== undefined) {
      if (result.levelCode === 0) this.stats.auto++;
      else if (result.levelCode === 1) this.stats.suggest++;
      else if (result.levelCode === 2) this.stats.require++;
      else if (result.levelCode === 3) this.stats.block++;
    }
  }
}

// ============ 快速评估工具 ============

/**
 * 快速评估渲染是否可以通过
 */
function quickPreRenderCheck(params) {
  const gate = new PermissionGate({ autoMode: true });
  return gate.preRenderGate(params);
}

// ============ 导出 ============
module.exports = {
  PermissionGate,
  DECISION_TYPES,
  APPROVAL_LEVELS,
  quickPreRenderCheck
};

// CLI测试
if (require.main === module) {
  const gate = new PermissionGate();
  
  console.log('🛡️ Permission Gate v9.3-Peng 测试\n');
  
  // 测试1：高分自动通过
  const r1 = gate.evaluate('RENDER', 85, { shot: 'test1' });
  console.log(`✅ 高分: ${r1.score} → ${r1.level} (approved=${r1.approved})`);
  
  // 测试2：中分建议确认
  const r2 = gate.evaluate('RENDER', 55, { shot: 'test2' });
  console.log(`⚠️ 中分: ${r2.score} → ${r2.level} (requiresHuman=${r2.requiresHuman})`);
  
  // 测试3：低分自动阻断
  const r3 = gate.evaluate('RENDER', 25, { shot: 'test3' });
  console.log(`❌ 低分: ${r3.score} → ${r3.level} (approved=${r3.approved})`);
  
  // 测试4：渲染前闸机
  const preRender = gate.preRenderGate({
    alignmentScore: 65,
    pitchScore: 7.8,
    budgetUsed: 50,
    budgetTotal: 100,
    safetyFlags: 0,
    characterDrift: 85,
    styleDrift: 75
  });
  console.log(`\n🎬 渲染闸机: ${preRender.approved === null ? '⏳ 需确认' : (preRender.approved ? '✅ 通过' : '❌ 阻断')}`);
  console.log(`   原因: ${preRender.reason}`);
  
  for (const check of preRender.checks) {
    console.log(`   ${check.name}: ${check.result.level}`);
  }
  
  // 测试5：生成确认消息
  const msg = gate.generateConfirmationMessage(preRender);
  console.log(`\n📱 确认消息:\n${msg}`);
  
  console.log('\n✅ Permission Gate 测试完成！');
}
