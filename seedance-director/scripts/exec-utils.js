/**
 * Seedance Director v5.1-Peng — 统一异步执行器
 * 
 * 设计原则：
 * 1. 默认异步（非阻塞）
 * 2. 默认超时（防止无限阻塞）
 * 3. 自动重试（最多3次）
 * 4. 错误记录但不抛异常（避免拖垮流水线）
 * 5. 向后兼容（保持execSync语义但非阻塞）
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fss = require('fs');

// ============ 配置 ============
const DEFAULT_TIMEOUT = 120000;    // 120秒
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;        // 2秒

// ============ 轻量级熔断器（P1-6）============
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 60000; // 1分钟后尝试半开
const circuitMap = new Map(); // cmdPattern → { failures, lastFailure, state }

function _circuitPattern(cmd) {
  // 用命令第一个词做模式（ffmpeg/curl/node/等）
  return cmd.trim().split(/\s+/)[0] || cmd;
}

function checkCircuit(cmd) {
  const pattern = _circuitPattern(cmd);
  const state = circuitMap.get(pattern) || { failures: 0, lastFailure: 0, state: 'CLOSED' };
  if (state.state === 'OPEN') {
    if (Date.now() - state.lastFailure > CIRCUIT_OPEN_MS) {
      state.state = 'HALF_OPEN';
      circuitMap.set(pattern, state);
    } else {
      const err = new Error(`CircuitBreaker OPEN: ${pattern} 连续失败${CIRCUIT_FAILURE_THRESHOLD}次，已熔断`);
      err.circuitBreaker = true;
      throw err;
    }
  }
}

function recordCircuitFailure(cmd) {
  const pattern = _circuitPattern(cmd);
  const state = circuitMap.get(pattern) || { failures: 0, lastFailure: 0, state: 'CLOSED' };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) state.state = 'OPEN';
  circuitMap.set(pattern, state);
}

function recordCircuitSuccess(cmd) {
  const pattern = _circuitPattern(cmd);
  const state = circuitMap.get(pattern);
  if (state) {
    state.failures = 0;
    state.state = 'CLOSED';
    circuitMap.set(pattern, state);
  }
}

// ============ 工具函数 ============
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 异步执行Shell命令（核心函数）
 * @param {string} cmd - 命令
 * @param {Object} options - 选项
 * @returns {Promise<string>} - stdout输出
 */
async function execAsync(cmd, options = {}) {
  checkCircuit(cmd); // P1-6: 熔断检查
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const retries = options.retries !== undefined ? options.retries : MAX_RETRIES;
  const stdio = options.stdio || 'pipe';
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await _execPromise(cmd, { ...options, timeout, stdio });
      recordCircuitSuccess(cmd); // P1-6: 成功重置熔断
      return result;
    } catch (e) {
      const isLastAttempt = attempt === retries;
      const logPrefix = `[execAsync] 第${attempt}/${retries}次失败`;
      
      if (e.killed && e.signal === 'SIGTERM') {
        console.error(`${logPrefix}: 超时 (${timeout}ms) - ${cmd}`);
      } else {
        console.error(`${logPrefix}: ${e.message} - ${cmd}`);
      }
      
      if (isLastAttempt) {
        recordCircuitFailure(cmd); // P1-6: 记录最终失败
        throw e;
      }
      
      await sleep(RETRY_DELAY * attempt);
    }
  }
}

/**
 * 异步执行Shell命令（不抛异常，返回结果对象）
 * @param {string} cmd - 命令
 * @param {Object} options - 选项
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, error?: Error}>}
 */
async function execSafe(cmd, options = {}) {
  try {
    const stdout = await execAsync(cmd, options);
    return { success: true, stdout, stderr: '' };
  } catch (e) {
    return { 
      success: false, 
      stdout: e.stdout || '', 
      stderr: e.stderr || '', 
      error: e 
    };
  }
}

/**
 * 使用spawn异步执行（推荐用于CLI调用，更安全）
 * @param {string} command - 命令
 * @param {string[]} args - 参数数组
 * @param {Object} options - 选项
 * @returns {Promise<string>}
 */
async function spawnAsync(command, args, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const cwd = options.cwd || process.cwd();
  
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: options.stdio || 'pipe',
      env: { ...process.env, ...options.env },
    });
    
    let stdout = '';
    let stderr = '';
    let timeoutId;
    
    if (proc.stdout) {
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
    }
    
    // 超时处理
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);  // 5秒后强制kill
      }, timeout);
    }
    
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
    
    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const err = new Error(`Command failed with code ${code}: ${command} ${args.join(' ')}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        reject(err);
      }
    });
  });
}

/**
 * 内部：Promise封装的exec
 */
function _execPromise(cmd, options) {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeout,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024,  // 10MB
      encoding: options.encoding || 'utf8',
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
    
    // stdio继承模式
    if (options.stdio === 'inherit') {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }
  });
}

// Shell注入防护：标准单引号转义
function shellQuote(str) {
  if (str === null || str === undefined) return "''";
  const s = String(str);
  if (/^[A-Za-z0-9_\-\/.,=:@%]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\"'\"'") + "'";
}

// ============ 安全JSON解析（P0-3.3）============
/**
 * 带错误边界的JSON解析
 * 解析失败时返回fallback，不抛异常导致进程崩溃
 */
function safeJSONParse(str, fallback = null, context = '') {
  try {
    return JSON.parse(str);
  } catch (err) {
    console.error(`[safeJSONParse] 解析失败${context ? ` (${context})` : ''}: ${err.message}`);
    // 尝试修复常见错误后重试
    try {
      const fixed = str
        .replace(/,\s*}/g, '}')     // 移除对象末尾多余逗号
        .replace(/,\s*\]/g, ']')    // 移除数组末尾多余逗号
        .replace(/\n/g, '\\n')      // 转义未转义的换行
        .replace(/'/g, '"');        // 单引号→双引号
      return JSON.parse(fixed);
    } catch {
      return fallback;
    }
  }
}

/**
 * 安全读取JSON文件
 * 文件不存在或损坏时返回fallback
 */
function safeReadJSON(filePath, fallback = null, context = '') {
  try {
    const content = fss.readFileSync(filePath, 'utf8');
    return safeJSONParse(content, fallback, `${context}:${filePath}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`[safeReadJSON] 文件不存在，使用默认值: ${filePath}`);
      return fallback;
    }
    console.error(`[safeReadJSON] 读取失败: ${filePath} — ${err.message}`);
    return fallback;
  }
}

// ============ 向后兼容的execSync包装 ============
/**
 * 同步执行（仅用于需要同步的场景，如初始化检查）
 * 带有try-catch和超时
 */
function execSyncSafe(cmd, options = {}) {
  const { execSync } = require('child_process');
  try {
    return execSync(cmd, { 
      encoding: 'utf8', 
      timeout: options.timeout || 30000,
      ...options 
    });
  } catch (e) {
    console.error(`[execSyncSafe] 失败: ${e.message} - ${cmd}`);
    throw e;
  }
}

// ============ 临时目录自动清理（P0-3）============
const tmpRegistry = new Set();
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7天

function registerTempDir(dir) {
  if (dir) tmpRegistry.add(path.resolve(dir));
}

function cleanupTempDir(dir) {
  try {
    if (fss.existsSync(dir)) {
      fss.rmSync(dir, { recursive: true, force: true });
      console.log(`[TempCleanup] 已清理: ${dir}`);
    }
  } catch (e) {
    console.error(`[TempCleanup] 清理失败: ${dir} — ${e.message}`);
  }
  tmpRegistry.delete(dir);
}

function cleanupAllTempDirs() {
  for (const dir of tmpRegistry) cleanupTempDir(dir);
}

/** 扫描并清理过期的 productions/ 子目录 */
function cleanupExpiredProductions(productionsRoot) {
  if (!fss.existsSync(productionsRoot)) return;
  const now = Date.now();
  for (const entry of fss.readdirSync(productionsRoot)) {
    const full = path.join(productionsRoot, entry);
    try {
      const stat = fss.statSync(full);
      if (stat.isDirectory() && (now - stat.mtimeMs) > TTL_MS) {
        fss.rmSync(full, { recursive: true, force: true });
        console.log(`[TempCleanup] TTL过期清理: ${full}`);
      }
    } catch (e) { /* 忽略权限错误 */ }
  }
}

// 进程退出信号处理
process.on('SIGTERM', () => { cleanupAllTempDirs(); process.exit(0); });
process.on('SIGINT', () => { cleanupAllTempDirs(); process.exit(0); });

// ============ 自适应降级策略（P1-7）============
/**
 * 通用降级执行器：依次尝试多个供应商/方法，直到成功
 * @param {Array<{name:string, fn:Function}>} strategies - 降级策略数组
 * @param {Object} options - 选项
 * @returns {Promise<any>} - 第一个成功的结果
 */
async function withFallback(strategies, options = {}) {
  let lastError = null;
  for (let i = 0; i < strategies.length; i++) {
    const s = strategies[i];
    try {
      const result = await s.fn();
      if (i > 0) console.log(`[Fallback] 降级成功：${s.name}`);
      return result;
    } catch (e) {
      console.warn(`[Fallback] ${s.name} 失败：${e.message}`);
      lastError = e;
      if (options.delay && i < strategies.length - 1) await sleep(options.delay);
    }
  }
  throw new Error(`全部降级策略失败（${strategies.length}个）：${lastError?.message}`);
}

// ============ 统一重试策略（P1-4.1）============
class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.retryableErrors = options.retryableErrors || [
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED',
      'QuotaExceeded', 'TooManyRequests', 'ServiceUnavailable', 429, 503
    ];
  }

  async execute(operation, context = {}) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        const errorCode = err.code || err.status || err.message;

        if (!this.isRetryable(errorCode, err)) {
          throw err; // 不可重试的错误直接抛出
        }

        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.warn(`[RetryPolicy] 重试 ${context.name || 'operation'} (${attempt + 1}/${this.maxRetries})，${delay}ms后重试 — ${err.message}`);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }

  isRetryable(errorCode, err) {
    if (this.retryableErrors.includes(errorCode)) return true;
    if (err.status >= 500 && err.status < 600) return true;
    if (err.status === 429) return true;
    return false;
  }

  calculateDelay(attempt) {
    const exponential = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.3 * exponential;
    return Math.min(exponential + jitter, this.maxDelay);
  }
}

// 预配置的重试策略实例
const seedanceRetry = new RetryPolicy({
  maxRetries: 5,
  baseDelay: 2000,
  retryableErrors: ['QuotaExceeded', 'TooManyRequests', 429, 503, 'ECONNRESET', 'ETIMEDOUT']
});

const renderRetry = new RetryPolicy({
  maxRetries: 3,
  baseDelay: 5000,
  retryableErrors: ['QuotaExceeded', 'TooManyRequests', 429, 503, 'ECONNRESET']
});

// ============ 导出 ============
module.exports = {
  execAsync,
  execSafe,
  spawnAsync,
  execSyncSafe,
  shellQuote,
  safeJSONParse,
  safeReadJSON,
  RetryPolicy,      // P1-4.1: 统一重试策略
  seedanceRetry,    // P1-4.1: Seedance API预配置重试
  renderRetry,      // P1-4.1: 渲染预配置重试
  registerTempDir,
  cleanupTempDir,
  cleanupAllTempDirs,
  cleanupExpiredProductions,
  withFallback,
  sleep,
  DEFAULT_TIMEOUT,
  MAX_RETRIES,
};