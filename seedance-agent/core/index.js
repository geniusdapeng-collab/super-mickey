/**
 * Seedance Agent Core — 统一导出入口 (v9.2-Peng)
 * 
 * 核心模块：
 * - AgentLoop: 动态决策循环引擎
 * - PermissionGate: 七层权限门控
 * - ContextManager: 五级素材分辨率管理
 * - StateMachine: 追加式状态机（resume/fork/rewind）
 * - ToolPool: 三层工具注册池
 */

export { directorLoop, resume, legacyPipeline } from './agent-loop.js';
export { PermissionGate, createPermissionGate, PERMISSION_MODES } from './permission-gate.js';
export { ContextManager, createContextManager, RESOLUTION_LEVELS } from './context-manager.js';
export { StateMachine, createStateMachine } from './state-machine.js';
export { ToolPool, createToolPool, BUILTIN_TOOLS } from './tool-pool.js';
export { 
  decideNextAction, 
  setDecisionMode, 
  getDecisionConfig, 
  clearDecisionCache,
  // 导演思维层（v7.0-Peng-Director）
  generateDirectorStatement,
  generateTensionCurve,
  evaluateQualityTier,
  decideABStrategy,
  generateDailiesReport,
  // 风格配方层（v7.0-Peng-Style）
  parseStyleRecipe,
  generateStyleDNA,
  detectStyleConflicts,
  calculateStyleSRS,
  detectStyleDrift,
  recordStyleFootprint,
  generateStyleChromosome
} from './model-decision-engine.js';
export { 
  sendNotification, 
  notifyPermissionRequest, 
  notifyBudgetWarning, 
  notifyRisk, 
  notifyProgress, 
  notifyError,
  // 风格相关通知（v7.0-Peng-Style）
  notifyStyleDrift,
  notifyStyleConflict,
  notifyStyleSRS,
  setNotifierTarget,
  setNotifierEnabled
} from './feishu-notifier.js';

// 便捷函数：快速创建完整 Agent 环境
export async function createAgent(projectId, userRequest, config = {}) {
  const contextManager = createContextManager(projectId, config.context);
  const permissionGate = createPermissionGate(config.security);
  const stateMachine = createStateMachine(projectId, config.state);
  const toolPool = createToolPool(config.tools);
  
  return {
    projectId,
    contextManager,
    permissionGate,
    stateMachine,
    toolPool,
    start: () => directorLoop({ projectId, userRequest, ...config })
  };
}
