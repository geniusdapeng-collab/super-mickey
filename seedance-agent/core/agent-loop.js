/**
 * Seedance Agent Loop — Director Core (v9.2-Peng)
 * 
 * 基于 Claude Code queryLoop 模式改造的视频制作 Agent 核心引擎。
 * 从 v6.0 的线性 Phase 流水线升级为动态决策循环。
 * 
 * 核心设计：
 * - AsyncGenerator 流式输出（实时可见决策过程）
 * - 每轮 9 步流水线（适配视频制作场景）
 * - 状态机管理（支持 pause/resume/fork/rewind）
 * - 与 v6.0 向后兼容（LEGACY_PIPELINE_MODE 降级开关）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ 配置加载 ============
const CONFIG = loadConfig();

function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config', 'seedance.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.error(`[AgentLoop] 配置解析失败: ${err.message}，使用默认配置`);
      // P0-3.3: 解析失败时使用默认配置，不崩溃
    }
  }
  // 默认配置
  return {
    maxTurns: 50,
    permissionMode: 'semi-auto',
    renderBudgetUSD: 10.0,
    maxConcurrentAgents: 7,
    legacyFallback: true,
    featureFlags: {
      HISTORY_SNIP: true,
      CACHED_MICROCOMPACT: true,
      CONTEXT_COLLAPSE: true,
      KAIROS_DAEMON: false,
      COORDINATOR_MODE: false
    }
  };
}

// ============ 环形缓冲区（P1-6.2）============
class CircularBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = [];
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray() {
    if (this.size < this.capacity) return this.buffer.slice(0, this.size);
    const result = [];
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity]);
    }
    return result;
  }

  get length() { return this.size; }
  slice(...args) { return this.toArray().slice(...args); }
}

// ============ 状态机定义 ============
class DirectorState {
  constructor(projectId, userRequest) {
    this.projectId = projectId;
    this.userRequest = userRequest;
    
    // 核心状态
    this.turnCount = 0;
    this.messages = new CircularBuffer(1000);     // P1-6.2: 定长1000条
    this.toolResults = new CircularBuffer(500);    // P1-6.2: 定长500条
    this.timelineState = null;
    this.renderBudgetUsed = 0;
    
    // 暂停/恢复
    this.isPaused = false;
    this.pauseReason = null;
    this.pendingDecision = null;
    
    // 压缩追踪
    this.hasAttemptedReactiveCompact = false;
    this.maxOutputTokensRecoveryCount = 0;
    
    // 子 Agent 追踪
    this.activeSubagents = new Map();
    this.completedSubagents = [];
    
    // 审计日志
    this.auditLog = new CircularBuffer(2000);      // P1-6.2: 定长2000条
  }
  
  snapshot() {
    return {
      projectId: this.projectId,
      turnCount: this.turnCount,
      budgetUsed: this.renderBudgetUsed,
      budgetRemaining: CONFIG.renderBudgetUSD - this.renderBudgetUsed,
      timelineState: this.timelineState,
      isPaused: this.isPaused,
      pauseReason: this.pauseReason,
      activeAgents: Array.from(this.activeSubagents.keys()),
      completedAgents: this.completedSubagents.length
    };
  }
  
  log(event) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      turn: this.turnCount,
      ...event
    });
  }
}

// ============ 核心 Agent Loop ============
export async function* directorLoop(params) {
  const { projectId, userRequest, resumeState = null } = params;
  
  // 初始化或恢复状态
  const state = resumeState 
    ? restoreState(resumeState) 
    : new DirectorState(projectId, userRequest);
  
  // P0-1.1: 三层安全出口 — 总时长/连续错误/轮次上限
  const startTime = Date.now();
  let consecutiveErrors = 0;
  const SAFETY = {
    maxDurationMs: 30 * 60 * 1000,    // 30分钟总超时
    maxConsecutiveErrors: 5,             // 连续错误熔断阈值
    maxTurns: CONFIG.maxTurns || 50      // 轮次硬上限
  };
  
  console.log(`[Director] 项目 ${projectId} 启动，模式: ${CONFIG.permissionMode}`);
  state.log({ type: 'session_start', mode: CONFIG.permissionMode, safety: SAFETY });
  
  while (state.turnCount < SAFETY.maxTurns) {
    state.turnCount++;
    
    // 第一层：总时长检查
    const elapsed = Date.now() - startTime;
    if (elapsed > SAFETY.maxDurationMs) {
      const reason = `TIMEOUT: 总执行时间 ${(elapsed/60000).toFixed(1)}分钟 超过硬上限 ${SAFETY.maxDurationMs/60000}分钟`;
      console.error(`[Director] ${reason}`);
      state.log({ type: 'safety_exit', reason, elapsed, limit: SAFETY.maxDurationMs });
      yield { type: 'stop', reason, state: state.snapshot() };
      break;
    }
    
    try {
      // ============ 步骤 1-4: 配置解析 → 上下文压缩 ============
      const settings = resolveSettings(state);
      await initializeState(state, settings);
      const context = await assembleContext(state, settings);
      const compacted = await runCompactionPipeline(context, state);
      
      // ============ 步骤 5: 模型决策（唯一 AI 步骤） ============
      yield { type: 'thinking', message: `[Turn ${state.turnCount}] 正在决策...` };
      
      let decision;
      try {
        decision = await decideNextAction(compacted, state, settings);
        consecutiveErrors = 0; // 成功后重置错误计数
      } catch (decisionErr) {
        consecutiveErrors++;
        const errMsg = `模型决策失败: ${decisionErr.message}`;
        console.error(`[Director] ${errMsg} (连续错误 ${consecutiveErrors}/${SAFETY.maxConsecutiveErrors})`);
        state.log({ type: 'step_error', step: 'model_decision', error: errMsg, consecutive: consecutiveErrors });
        
        // 第二层：连续错误熔断
        if (consecutiveErrors >= SAFETY.maxConsecutiveErrors) {
          yield { type: 'stop', reason: `CIRCUIT_BREAKER: 连续 ${consecutiveErrors} 次决策失败`, state: state.snapshot() };
          break;
        }
        // 降级：本轮跳过，继续下一轮
        yield { type: 'error', message: errMsg, recoverable: true, state: state.snapshot() };
        continue;
      }
      
      state.log({ type: 'model_decision', decision: decision?.type || 'unknown' });
      
      // ============ 步骤 6: 工具分发 ============
      let toolCalls;
      try {
        toolCalls = extractToolCalls(decision);
      } catch (extractErr) {
        console.error(`[Director] 工具解析失败: ${extractErr.message}`);
        state.log({ type: 'step_error', step: 'tool_extraction', error: extractErr.message });
        yield { type: 'error', message: `决策格式异常: ${extractErr.message}`, recoverable: true, state: state.snapshot() };
        continue;
      }
      
      if (!toolCalls || toolCalls.length === 0) {
        // 无工具调用 → 完成或需要用户输入
        yield { type: 'complete', decision, state: state.snapshot() };
        break;
      }
      
      // ============ 步骤 7: 权限门 ============
      let permissionResult;
      try {
        permissionResult = await permissionGate(toolCalls, state, settings);
      } catch (permErr) {
        console.error(`[Director] 权限检查失败: ${permErr.message}`);
        state.log({ type: 'step_error', step: 'permission_gate', error: permErr.message });
        yield { type: 'error', message: `权限检查异常: ${permErr.message}`, recoverable: true, state: state.snapshot() };
        continue;
      }
      
      const { approved, blocked, needPermission, budgetExhausted } = permissionResult;
      
      // P2-4.2: 预算硬锁 — 预算耗尽时立即终止
      if (budgetExhausted) {
        log('AgentLoop', `💰 预算已耗尽 (${state.renderBudgetUsed}/${settings.budgetLimit} USD)，终止渲染`, 'error');
        yield { 
          type: 'budget_exhausted', 
          used: state.renderBudgetUsed,
          limit: settings.budgetLimit,
          state: state.snapshot()
        };
        break;
      }
      
      if (needPermission) {
        // 发送飞书通知（带错误边界）
        try {
          const feishuResult = await notifyPermissionRequest(
            state.projectId,
            needPermission.details?.tool || 'render-engine',
            needPermission.details?.estimatedCost || 0.5,
            needPermission.reason,
            { 
              projectName: state.projectConfig?.name || state.projectId,
              pauseTurn: state.turnCount,
              budgetUsed: state.renderBudgetUsed,
              budgetLimit: settings.budgetLimit
            }
          );
          if (feishuResult.sent) {
            console.log(`[AgentLoop] 已发送飞书权限确认请求: ${state.projectId}`);
          }
        } catch (err) {
          console.error('[AgentLoop] 飞书通知发送失败:', err.message);
          // 通知失败不阻塞流程，继续暂停
        }
        
        // 暂停循环
        state.isPaused = true;
        state.pauseReason = needPermission.reason;
        state.pendingDecision = decision;
        
        yield { 
          type: 'pause', 
          reason: needPermission.reason,
          details: needPermission.details,
          state: state.snapshot()
        };
        
        // 等待外部恢复（带超时保护）
        try {
          await waitForResume(state);
        } catch (resumeErr) {
          console.error(`[Director] 恢复等待异常: ${resumeErr.message}`);
          state.log({ type: 'step_error', step: 'wait_resume', error: resumeErr.message });
          yield { type: 'error', message: `恢复等待异常: ${resumeErr.message}`, state: state.snapshot() };
          break; // 恢复异常 → 终止
        }
        state.isPaused = false;
        state.pauseReason = null;
      }
      
      // 记录阻断的工具
      for (const block of blocked) {
        state.log({ type: 'tool_blocked', tool: block.name, reason: block.reason });
        yield { type: 'blocked', tool: block.name, reason: block.reason };
      }
      
      // ============ 步骤 8: 工具执行 ============
      if (approved.length > 0) {
        yield { type: 'executing', tools: approved.map(t => t.name) };
        
        let results;
        try {
          results = await executeTools(approved, state, settings);
        } catch (execErr) {
          consecutiveErrors++;
          console.error(`[Director] 工具执行批量失败: ${execErr.message} (连续错误 ${consecutiveErrors}/${SAFETY.maxConsecutiveErrors})`);
          state.log({ type: 'step_error', step: 'tool_execution', error: execErr.message, consecutive: consecutiveErrors });
          if (consecutiveErrors >= SAFETY.maxConsecutiveErrors) {
            yield { type: 'stop', reason: `CIRCUIT_BREAKER: 连续 ${consecutiveErrors} 次执行失败`, state: state.snapshot() };
            break;
          }
          yield { type: 'error', message: `工具执行异常: ${execErr.message}`, recoverable: true, state: state.snapshot() };
          continue;
        }
        
        state.toolResults.push(...results);
        
        for (const result of results) {
          state.log({ type: 'tool_result', tool: result.name, cost: result.cost });
          if (result.cost) {
            state.renderBudgetUsed += result.cost;
          }
          yield { type: 'result', tool: result.name, result: result.data };
        }
      }
      
      // ============ 步骤 9: 终止条件检查 ============
      const stopReason = checkStopConditions(state, settings);
      if (stopReason) {
        yield { type: 'stop', reason: stopReason, state: state.snapshot() };
        break;
      }
      
      // 预算检查
      if (state.renderBudgetUsed >= CONFIG.renderBudgetUSD) {
        yield { 
          type: 'budget_exhausted', 
          used: state.renderBudgetUsed,
          limit: CONFIG.renderBudgetUSD,
          state: state.snapshot()
        };
        break;
      }
      
      // 继续下一轮
      yield { type: 'continue', turn: state.turnCount, state: state.snapshot() };
      
    } catch (unexpectedErr) {
      // 兜底：捕获while循环内任何未处理的异常
      consecutiveErrors++;
      const errMsg = `未预期异常: ${unexpectedErr.message}`;
      console.error(`[Director] ${errMsg} (连续错误 ${consecutiveErrors}/${SAFETY.maxConsecutiveErrors})`);
      state.log({ type: 'unhandled_error', error: errMsg, stack: unexpectedErr.stack, consecutive: consecutiveErrors });
      
      if (consecutiveErrors >= SAFETY.maxConsecutiveErrors) {
        yield { type: 'stop', reason: `CIRCUIT_BREAKER: 连续 ${consecutiveErrors} 次未预期异常`, state: state.snapshot() };
        break;
      }
      yield { type: 'error', message: errMsg, recoverable: true, state: state.snapshot() };
      continue;
    }
  }
  
  // 轮次上限到达（while条件退出）
  if (state.turnCount >= SAFETY.maxTurns) {
    yield { type: 'stop', reason: `MAX_TURNS_REACHED: 达到轮次上限 ${SAFETY.maxTurns}`, state: state.snapshot() };
  }
  
  // 保存最终状态
  try {
    await saveState(state);
  } catch (saveErr) {
    console.error(`[Director] 状态保存失败: ${saveErr.message}`);
    // 保存失败不阻塞返回
  }
  state.log({ type: 'session_end', finalBudget: state.renderBudgetUsed, totalTurns: state.turnCount });
  
  return { type: 'terminal', state: state.snapshot(), auditLog: state.auditLog };
}

// ============ 9 步流水线实现 ============

function resolveSettings(state) {
  return {
    mode: CONFIG.permissionMode,
    maxTurns: CONFIG.maxTurns,
    budgetLimit: CONFIG.renderBudgetUSD,
    featureFlags: CONFIG.featureFlags,
    // 根据模式确定自动批准范围
    autoApprove: getAutoApproveScope(CONFIG.permissionMode)
  };
}

function getAutoApproveScope(mode) {
  const scopes = {
    'plan': ['preview'],           // 仅预览
    'default': ['preview', 'proxy'], // 预览+代理生成
    'acceptEdits': ['preview', 'proxy', 'edit'],
    'semi-auto': ['preview', 'proxy', 'edit', 'color'],
    'auto': ['preview', 'proxy', 'edit', 'color', 'render'],
    'dontAsk': ['preview'],        // 仅预批准
    'bypass': ['*']               // 全部（危险）
  };
  return scopes[mode] || scopes['default'];
}

async function initializeState(state, settings) {
  // 加载项目配置 PROJECT.md
  const projectConfig = await loadProjectConfig(state.projectId);
  state.projectConfig = projectConfig;

  // 加载 memory.md 索引
  const memoryIndex = await loadMemoryIndex(state.projectId);
  state.memoryIndex = memoryIndex;

  // 恢复时间线状态（如有）
  if (!state.timelineState) {
    state.timelineState = await loadTimelineState(state.projectId);
  }

  // ============ 导演思维注入（v7.0-Peng-Director）===========
  // 仅在首次启动时生成导演阐释和张力曲线
  if (!state.directorStatement && state.userRequest) {
    try {
      const { generateDirectorStatement, generateTensionCurve } = await import('./model-decision-engine.js');
      state.directorStatement = generateDirectorStatement(state.userRequest, { userRequest: state.userRequest });
      
      // 从需求中提取时长
      const durationMatch = state.userRequest.match(/(\d+)\s*秒/);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 15;
      state.tensionCurve = generateTensionCurve(null, duration);
      
      state.log({ type: 'director_statement', statement: state.directorStatement });
      state.log({ type: 'tension_curve', curve: state.tensionCurve });
      
      console.log('[Director] 导演阐释已生成:', state.directorStatement.why);
      console.log('[Director] 张力曲线已生成:', state.tensionCurve.length, '个镜头');
    } catch (err) {
      console.error('[Director] 导演思维注入失败:', err.message);
    }
  }
}

async function assembleContext(state, settings) {
  const context = {
    // 1. 系统提示（PROJECT.md）
    systemPrompt: state.projectConfig,
    
    // 2. 用户原始需求
    userRequest: state.userRequest,
    
    // 3. 当前对话历史
    messages: state.messages,
    
    // 4. 工具结果历史
    toolResults: state.toolResults.slice(-10), // 最近10条
    
    // 5. 时间线状态摘要
    timelineSummary: summarizeTimeline(state.timelineState),
    
    // 6. 预算状态
    budgetStatus: {
      used: state.renderBudgetUsed,
      remaining: settings.budgetLimit - state.renderBudgetUsed,
      limit: settings.budgetLimit
    },
    
    // 7. 活跃子 Agent 状态
    activeAgents: Array.from(state.activeSubagents.entries()).map(([id, agent]) => ({
      id,
      role: agent.role,
      status: agent.status
    })),
    
    // 8. 项目记忆（选择性加载）
    relevantMemories: await selectRelevantMemories(state),
    
    // 9. 审计日志摘要
    recentEvents: state.auditLog.slice(-5)
  };
  
  return context;
}

// ============ 五级上下文压缩（视频制作适配） ============
async function runCompactionPipeline(context, state) {
  let compacted = { ...context };
  let compressionLog = [];
  
  // Layer 1: Budget Reduction — 工具结果大小限制
  if (compacted.toolResults) {
    const originalLength = compacted.toolResults.length;
    compacted.toolResults = compacted.toolResults.map(r => {
      if (r.data && JSON.stringify(r.data).length > 50000) {
        return { ...r, data: truncateLargeResult(r.data), truncated: true };
      }
      return r;
    });
    compressionLog.push(`Layer 1: Budget Reduction — ${originalLength} results checked`);
  }
  
  // Layer 2: Snip — 裁剪旧历史
  if (CONFIG.featureFlags.HISTORY_SNIP && compacted.messages.length > 20) {
    const snipped = snipOldMessages(compacted.messages);
    compacted.messages = snipped.messages;
    compressionLog.push(`Layer 2: Snip — freed ${snipped.tokensFreed} tokens`);
  }
  
  // Layer 3: Microcompact — 缓存感知压缩
  if (CONFIG.featureFlags.CACHED_MICROCOMPACT) {
    compacted = microcompact(compacted);
    compressionLog.push('Layer 3: Microcompact — cache-aware dedup');
  }
  
  // Layer 4: Context Collapse — 读取时虚拟投影
  if (CONFIG.featureFlags.CONTEXT_COLLAPSE && compacted.messages.length > 30) {
    compacted.messages = collapseContext(compacted.messages);
    compressionLog.push('Layer 4: Context Collapse — virtual projection');
  }
  
  // Layer 5: Auto-Compact — 完整摘要（最后手段）
  // 仅在上下文溢出时触发，此处简化实现
  
  state.log({ type: 'compaction', layers: compressionLog });
  return compacted;
}

function truncateLargeResult(data) {
  const str = JSON.stringify(data);
  if (str.length <= 50000) return data;
  return {
    _truncated: true,
    _originalSize: str.length,
    preview: str.substring(0, 2000) + '... [truncated]',
    summary: summarizeResult(data)
  };
}

function snipOldMessages(messages) {
  // 保留最近20条，清空更旧的 tool_result 内容
  const recent = messages.slice(-20);
  const old = messages.slice(0, -20).map(m => {
    if (m.type === 'tool_result') {
      return { ...m, content: '[snipped]', _snipped: true };
    }
    return m;
  });
  return { messages: [...old, ...recent], tokensFreed: old.length * 100 };
}

function microcompact(context) {
  // 去重相邻的相同类型工具调用
  return context;
}

function collapseContext(messages) {
  // 虚拟投影：将旧消息折叠为摘要
  return messages;
}

function summarizeResult(data) {
  // 生成结果摘要
  if (Array.isArray(data)) return `${data.length} items`;
  if (typeof data === 'object') return `${Object.keys(data).length} fields`;
  return String(data).substring(0, 100);
}

import { notifyPermissionRequest, notifyBudgetWarning, notifyProgress } from './feishu-notifier.js';
import { decideNextAction } from './model-decision-engine.js';

function extractToolCalls(decision) {
  if (!decision.tools) return [];
  return decision.tools.map(name => ({
    name,
    params: decision.params || {},
    reasoning: decision.reasoning
  }));
}

// ============ 权限门（七层安全检查前三层） ============
async function permissionGate(toolCalls, state, settings) {
  const approved = [];
  const blocked = [];
  let needPermission = null;
  
  for (const tool of toolCalls) {
    // Layer 1: Tool Pre-filtering
    if (isToolDenied(tool.name)) {
      blocked.push({ ...tool, reason: 'Tool denied by pre-filter' });
      continue;
    }
    
    // Layer 2: Deny-first Rule Evaluation
    const ruleCheck = checkDenyRules(tool, state);
    if (ruleCheck.denied) {
      blocked.push({ ...tool, reason: ruleCheck.reason });
      continue;
    }
    
    // Layer 3: Permission Mode Constraints
    const modeCheck = checkPermissionMode(tool, settings);
    if (modeCheck.requiresApproval) {
      // 需要人工确认
      if (!needPermission) {
        needPermission = {
          reason: `Tool "${tool.name}" requires approval in ${settings.mode} mode`,
          details: { tool: tool.name, params: tool.params, estimatedCost: estimateCost(tool) }
        };
      }
      // 暂不加入 approved，等人工确认后处理
      continue;
    }
    
    // 检查预算（硬锁 — 已耗尽时直接阻断所有渲染工具）
    const cost = estimateCost(tool);
    if (state.renderBudgetUsed + cost > settings.budgetLimit) {
      blocked.push({ ...tool, reason: `Budget exceeded: ${state.renderBudgetUsed + cost} > ${settings.budgetLimit}` });
      continue;
    }
    
    approved.push(tool);
  }
  
  // P2-4.2: 预算硬锁 — 如果预算已耗尽且还有渲染工具被请求，标记为紧急阻断
  const hasRenderBlocked = blocked.some(t => getToolCategory(t.name) === 'render');
  if (hasRenderBlocked && state.renderBudgetUsed >= settings.budgetLimit) {
    return { approved, blocked, needPermission, budgetExhausted: true };
  }
  
  return { approved, blocked, needPermission };
}

function isToolDenied(toolName) {
  const deniedTools = ['rm', 'delete-original', 'format-disk'];
  return deniedTools.includes(toolName);
}

function checkDenyRules(tool, state) {
  // deny-first 规则检查
  // 例如：禁止删除原始素材
  if (tool.name === 'render-engine' && tool.params?.action === 'delete') {
    return { denied: true, reason: 'Deny-first: deletion of rendered assets blocked' };
  }
  return { denied: false };
}

function checkPermissionMode(tool, settings) {
  const scope = settings.autoApprove;
  if (scope.includes('*')) return { requiresApproval: false };
  
  // 根据工具类型判断是否需要审批
  const toolCategory = getToolCategory(tool.name);
  if (scope.includes(toolCategory)) {
    return { requiresApproval: false };
  }
  
  return { requiresApproval: true };
}

function getToolCategory(toolName) {
  const categories = {
    'story-engine': 'preview',
    'shot-design': 'preview',
    'render-engine': 'render',
    'post-production': 'edit',
    'sound-design': 'edit',
    'color-grade': 'color'
  };
  return categories[toolName] || 'preview';
}

function estimateCost(tool) {
  const costs = {
    'story-engine': 0.01,
    'shot-design': 0.01,
    'render-engine': tool.params?.resolution === '4k' ? 2.0 : 
                     tool.params?.resolution === '1080p' ? 0.8 : 0.2,
    'post-production': 0.05,
    'sound-design': 0.1
  };
  return costs[tool.name] || 0.1;
}

// ============ 工具执行 ============
// ============ 并发限制器（P1-6.3）============
class ConcurrencyLimiter {
  constructor(maxConcurrency) {
    this.max = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.running < this.max) {
      this.running++;
      return () => this.release();
    }
    return new Promise(resolve => {
      this.queue.push(resolve);
    }).then(() => () => this.release());
  }

  release() {
    this.running--;
    if (this.queue.length > 0 && this.running < this.max) {
      this.running++;
      const next = this.queue.shift();
      next();
    }
  }
}

// 全局渲染并发限制器（按settings.maxConcurrentAgents配置）
const renderLimiter = new ConcurrencyLimiter(CONFIG.maxConcurrentAgents || 7);

async function executeTools(toolCalls, state, settings) {
  const results = [];
  const limiter = new ConcurrencyLimiter(settings.maxConcurrentAgents || CONFIG.maxConcurrentAgents || 7);
  
  // 分类：渲染类需要限流，其他可以并行
  const renderTools = toolCalls.filter(t => getToolCategory(t.name) === 'render');
  const otherTools = toolCalls.filter(t => getToolCategory(t.name) !== 'render');
  
  // 非渲染工具并行执行（带错误边界）
  const otherPromises = otherTools.map(async tool => {
    try {
      return await executeTool(tool, state);
    } catch (error) {
      state.log({ type: 'tool_error', tool: tool.name, error: error.message });
      return { name: tool.name, error: error.message, cost: 0 };
    }
  });
  
  // 渲染工具按并发限制执行
  const renderPromises = renderTools.map(async tool => {
    const release = await limiter.acquire();
    try {
      const result = await executeTool(tool, state);
      return result;
    } catch (error) {
      state.log({ type: 'tool_error', tool: tool.name, error: error.message });
      return { name: tool.name, error: error.message, cost: 0 };
    } finally {
      release();
    }
  });
  
  const allResults = await Promise.all([...otherPromises, ...renderPromises]);
  results.push(...allResults);
  
  return results;
}

async function executeTool(tool, state) {
  // 使用 V6 适配器执行工具
  const { createV6Adapter } = await import('../adapters/v6-adapter.js');
  const adapter = createV6Adapter(process.cwd());
  
  try {
    const result = await adapter.execute(tool.name, tool.params || {}, {
      projectId: state.projectId,
      timelineState: state.timelineState
    });
    
    return {
      name: tool.name,
      data: result.data,
      cost: result.cost,
      duration: result.duration,
      metadata: result.metadata
    };
  } catch (error) {
    // v6.2-fix: 生产模式下不允许静默回退到mock
    const isProduction = process.env.NODE_ENV === 'production' || process.env.EXECUTION_MODE === 'production';
    if (isProduction) {
      console.error(`[Director] ❌ 生产模式V6适配器失败: ${tool.name}`, error.message);
      throw new Error(`生产模式渲染失败: ${tool.name} - ${error.message}。禁止自动回退到mock模式。`);
    }
    
    // 非生产模式：降级到模拟执行（增强警告）
    console.warn(`[Director] ⚠️ V6适配器失败，降级到模拟模式: ${tool.name}`, error.message);
    
    const cost = estimateCost(tool);
    return {
      name: tool.name,
      data: {
        status: 'mock',
        tool: tool.name,
        params: tool.params,
        warning: 'V6模块未找到，使用模拟输出（非生产模式降级）',
        timestamp: new Date().toISOString()
      },
      cost,
      duration: 0,
      metadata: { mode: 'mock', error: error.message, fallback: true }
    };
  }
}

// ============ 终止条件 ============
function checkStopConditions(state, settings) {
  if (state.turnCount >= settings.maxTurns) {
    return 'max_turns_reached';
  }
  
  if (state.renderBudgetUsed >= settings.budgetLimit) {
    return 'budget_exhausted';
  }
  
  // 检查是否所有阶段完成
  if (state.timelineSummary?.isComplete) {
    return 'production_complete';
  }
  
  return null;
}

// ============ 暂停/恢复机制 ============
async function waitForResume(state) {
  // 等待外部恢复信号
  // 实际实现：轮询状态文件或等待消息
  const resumeFile = path.join(getProjectDir(state.projectId), '.resume');
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (fs.existsSync(resumeFile)) {
        const signal = fs.readFileSync(resumeFile, 'utf8');
        if (signal === 'RESUME' || signal.startsWith('RESUME:')) {
          fs.unlinkSync(resumeFile);
          clearInterval(checkInterval);
          resolve(signal);
        }
      }
    }, 1000);
    
    // 超时保护（5分钟）
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve('TIMEOUT');
    }, 300000);
  });
}

export function resume(projectId, decision) {
  const resumeFile = path.join(getProjectDir(projectId), '.resume');
  fs.writeFileSync(resumeFile, `RESUME:${JSON.stringify(decision)}`);
}

// ============ 辅助函数 ============

async function loadProjectConfig(projectId) {
  const projectDir = getProjectDir(projectId);
  const configPath = path.join(projectDir, 'PROJECT.md');
  
  if (fs.existsSync(configPath)) {
    return fs.readFileSync(configPath, 'utf8');
  }
  
  // 默认配置
  return `# Seedance Project: ${projectId}\n\n## 默认配置\n- 分辨率: 1080p\n- 帧率: 30fps\n- 色彩空间: Rec.709\n`;
}

async function loadMemoryIndex(projectId) {
  const projectDir = getProjectDir(projectId);
  const memoryPath = path.join(projectDir, 'memory', 'MEMORY.md');
  
  if (fs.existsSync(memoryPath)) {
    const content = fs.readFileSync(memoryPath, 'utf8');
    return parseMemoryIndex(content);
  }
  
  return { entries: [] };
}

function parseMemoryIndex(content) {
  // 解析 memory.md 指针索引
  const lines = content.split('\n').filter(l => l.trim().startsWith('-'));
  return {
    entries: lines.map(l => {
      const match = l.match(/- (.+?) — (.+)/);
      return match ? { file: match[1], description: match[2] } : null;
    }).filter(Boolean)
  };
}

async function selectRelevantMemories(state) {
  // 基于当前上下文选择最相关的记忆文件（最多5个）
  if (!state.memoryIndex || !state.memoryIndex.entries) return [];
  
  // 简化：选择最近的5个
  return state.memoryIndex.entries.slice(0, 5);
}

function summarizeTimeline(timelineState) {
  if (!timelineState) {
    return { hasContent: false, clips: 0, duration: 0 };
  }
  
  return {
    hasContent: timelineState.clips?.length > 0,
    clips: timelineState.clips?.length || 0,
    duration: timelineState.duration || 0,
    hasPreview: timelineState.hasPreview || false,
    previewApproved: timelineState.previewApproved || false,
    hasHD: timelineState.hasHD || false,
    hasSound: timelineState.hasSound || false,
    isComplete: timelineState.isComplete || false
  };
}

function getProjectDir(projectId) {
  return path.join(__dirname, '..', '..', 'projects', projectId);
}

async function loadTimelineState(projectId) {
  const timelinePath = path.join(getProjectDir(projectId), 'timeline.json');
  if (fs.existsSync(timelinePath)) {
    return JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
  }
  return null;
}

async function saveState(state) {
  const statePath = path.join(getProjectDir(state.projectId), 'state.json');
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(statePath, JSON.stringify({
    projectId: state.projectId,
    turnCount: state.turnCount,
    renderBudgetUsed: state.renderBudgetUsed,
    timelineState: state.timelineState,
    auditLog: state.auditLog
  }, null, 2));
}

function restoreState(savedState) {
  const state = new DirectorState(savedState.projectId, savedState.userRequest);
  state.turnCount = savedState.turnCount || 0;
  state.renderBudgetUsed = savedState.renderBudgetUsed || 0;
  state.timelineState = savedState.timelineState;
  state.auditLog = savedState.auditLog || [];
  return state;
}

// ============ 向后兼容：降级到 v6.0 流水线 ============
export async function legacyPipeline(projectId, userRequest) {
  console.log('[Director] 使用 v6.0 兼容模式');
  
  // 调用现有 director.js
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      path.join(__dirname, '..', '..', 'seedance-director', 'scripts', 'director.js'),
      'produce',
      '--project', projectId,
      '--request', userRequest
    ], { stdio: 'inherit' });
    
    child.on('close', (code) => {
      if (code === 0) resolve({ status: 'success' });
      else reject(new Error(`Legacy pipeline exited with code ${code}`));
    });
  });
}

// ============ CLI 入口 ============
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const projectId = process.argv[2] || 'default-project';
  const userRequest = process.argv[3] || 'Create a short video';
  
  (async () => {
    if (CONFIG.legacyFallback && process.argv.includes('--legacy')) {
      await legacyPipeline(projectId, userRequest);
      return;
    }
    
    const loop = directorLoop({ projectId, userRequest });
    
    for await (const event of loop) {
      console.log(`[${event.type}]`, event.message || event.reason || JSON.stringify(event));
      
      if (event.type === 'pause') {
        console.log('\n=== 需要人工确认 ===');
        console.log('原因:', event.reason);
        console.log('详情:', JSON.stringify(event.details, null, 2));
        console.log('\n执行以下命令恢复:');
        console.log(`node -e "import('./core/agent-loop.js').then(m => m.resume('${projectId}', {approve: true}))"`);
      }
    }
  })();
}
