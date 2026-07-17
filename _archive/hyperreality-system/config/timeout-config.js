/**
 * 超时配置中心
 * 超级小香宝私有化版本 v1.0
 * 
 * 统一管理所有超时值，支持环境变量覆盖
 * 消除硬编码，提升可维护性
 */

const DEFAULT_TIMEOUTS = {
  // LLM 调用超时
  LLM_SHORT: 180000,    // 3分钟 - 简单查询
  LLM_MEDIUM: 300000,   // 5分钟 - 标准生成
  LLM_LONG: 600000,     // 10分钟 - 复杂任务
  LLM_AGENT: 300000,    // 5分钟 - Agent单次调用
  LLM_TIMEOUT_PER_SHOT: 180000, // 每镜头LLM生成时间（5分钟预算适配）
  
  // 渲染超时
  RENDER_SHORT: 120000,   // 2分钟 - 快速渲染
  RENDER_MEDIUM: 300000,  // 5分钟 - 标准渲染
  RENDER_LONG: 600000,    // 10分钟 - 高清渲染
  
  // 字段质量检查
  FIELD_CHECKER: 30000,   // 30秒 - 规则检查
  FIELD_CHECKER_LLM: 120000, // 2分钟 - LLM语义检查
  FIELD_REPAIRER: 60000,  // 1分钟 - 修复
  FIELD_REPAIRER_LLM: 180000, // 3分钟 - LLM修复
  
  // 其他
  PARALLEL_BATCH: 300000, // 5分钟 - 并行批处理
  SUBMIT_RENDER: 300000,  // 5分钟 - 渲染提交
  
  // 系统总预算（40分钟硬杀 - 5分钟安全余量 = 35分钟实际可用）
  SYSTEM_BUDGET: 2100000, // 35分钟
  
  // 【v2.1.8-审计修复】系统硬杀时间和安全余量
  SYSTEM_HARD_KILL_MINUTES: 40, // 40分钟系统硬杀
  SAFETY_MARGIN_MS: 300000, // 5分钟清理/收尾余量
};

// 【P0-D2 修复】Node.js setTimeout的32位安全上限
const SET_TIMEOUT_MAX = 2147483647; // ~24.8天

/**
 * 【P0-D2 修复】安全的timeout数值解析
 * 校验层级：
 * 1. 是否为有效数字字符串
 * 2. 是否在Number.MAX_SAFE_INTEGER范围内（防精度丢失）
 * 3. 是否在setTimeout 32位上限内（防溢出wrap-around）
 */
function _parseTimeoutValue(rawValue, defaultValue, key) {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return defaultValue;
  }
  
  const trimmed = rawValue.trim();
  
  // 1. 检查纯数字格式（拒绝十六进制、科学计数法等）
  if (!/^\d+$/.test(trimmed)) {
    console.warn(`[timeout-config] 环境变量 HYPERREALITY_TIMEOUT_${key}="${trimmed}" 包含非数字字符，使用默认值 ${defaultValue}`);
    return defaultValue;
  }
  
  // 2. 检查是否超过Number.MAX_SAFE_INTEGER（防精度丢失）
  if (trimmed.length > 15) { // 9007199254740991 有16位
    console.error(`[timeout-config] 环境变量 HYPERREALITY_TIMEOUT_${key}="${trimmed}" 超过Number.MAX_SAFE_INTEGER，使用默认值 ${defaultValue}`);
    return defaultValue;
  }
  
  const parsed = parseInt(trimmed, 10);
  
  // 3. 基础有效性检查
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(`[timeout-config] 环境变量 HYPERREALITY_TIMEOUT_${key}="${trimmed}" 解析无效，使用默认值 ${defaultValue}`);
    return defaultValue;
  }
  
  // 4. 检查是否超过setTimeout 32位上限
  if (parsed > SET_TIMEOUT_MAX) {
    console.warn(`[timeout-config] 环境变量 HYPERREALITY_TIMEOUT_${key}=${parsed}ms 超过setTimeout上限${SET_TIMEOUT_MAX}ms，截断为安全上限`);
    return SET_TIMEOUT_MAX;
  }
  
  return parsed;
}

// 【P0-D2 修复】模块级缓存，避免每次调用重新解析
let _cachedTimeouts = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 60000; // 60秒缓存

/**
 * 从环境变量读取超时配置
 * 命名规则: HYPERREALITY_TIMEOUT_<NAME>
 */
function loadTimeouts() {
  const now = Date.now();
  if (_cachedTimeouts && (now - _cacheTimestamp) < CACHE_TTL) {
    return { ..._cachedTimeouts };
  }
  
  const timeouts = { ...DEFAULT_TIMEOUTS };
  
  for (const [key, defaultValue] of Object.entries(DEFAULT_TIMEOUTS)) {
    const envKey = `HYPERREALITY_TIMEOUT_${key}`;
    const envValue = process.env[envKey];
    if (envValue) {
      const safeValue = _parseTimeoutValue(envValue, defaultValue, key);
      timeouts[key] = safeValue;
    }
  }
  
  _cachedTimeouts = { ...timeouts };
  _cacheTimestamp = now;
  return timeouts;
}

/**
 * 强制刷新缓存（环境变量变更后调用）
 */
function invalidateTimeoutCache() {
  _cachedTimeouts = null;
  _cacheTimestamp = 0;
}

/**
 * 获取超时值（毫秒）
 * 【P0-D2 修复】使用 ?? 替代 ||，增加32位安全上限检查
 */
function getTimeout(key, fallback = 300000) {
  const timeouts = loadTimeouts();
  const value = timeouts[key];
  
  if (value !== undefined && value !== null && value > 0) {
    // 最终安全检查：确保返回值在32位范围内
    return Math.min(value, SET_TIMEOUT_MAX);
  }
  
  // fallback值也需要安全检查
  return Math.min(fallback, SET_TIMEOUT_MAX);
}

/**
 * 【v2.1.8-审计修复】获取实际可用的系统预算（考虑硬杀限制）
 * 返回：考虑硬杀时间和安全余量后的实际可用毫秒数
 */
function getEffectiveSystemBudget() {
  const hardKillMs = (getTimeout('SYSTEM_HARD_KILL_MINUTES', 40) * 60 * 1000);
  const safetyMs = getTimeout('SAFETY_MARGIN_MS', 300000);
  const systemBudget = getTimeout('SYSTEM_BUDGET', 2100000);
  return Math.min(systemBudget, hardKillMs - safetyMs);
}

module.exports = {
  DEFAULT_TIMEOUTS,
  SET_TIMEOUT_MAX,
  loadTimeouts,
  getTimeout,
  invalidateTimeoutCache,
  _parseTimeoutValue,
  getEffectiveSystemBudget
};