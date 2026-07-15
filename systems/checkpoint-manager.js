/**
 * Checkpoint Manager (断线重跑机制) v1.0
 * 
 * 职责：
 * 1. 为每个Stage保存执行结果（checkpoint）
 * 2. 支持断点续跑（resume模式）
 * 3. Circuit Breaker 熔断降级
 * 4. 失败记录与独立重跑
 * 
 * 使用方式：
 * const checkpoint = new CheckpointManager({ projectName: 'taotie-ep01' });
 * const result = await checkpoint.runStage('STAGE-5', async () => { ... }, inputHash);
 * 
 * @version v1.0
 * @author 小G
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CheckpointManager {
  constructor(options = {}) {
    this.projectName = options.projectName || 'default';
    this.checkpointDir = options.checkpointDir || path.join(__dirname, '..', 'checkpoints');
    this.projectCheckpointDir = path.join(this.checkpointDir, this.projectName);
    this.failureLogPath = path.join(this.projectCheckpointDir, '_failure-log.json');
    
    // Circuit Breaker 配置
    this.circuitBreakerConfig = {
      maxFailures: 3,        // 连续失败3次触发熔断
      resetTimeout: 300000,   // 5分钟后重置熔断
      ...options.circuitBreaker
    };
    
    // 内存中的熔断状态
    this._circuitState = {}; // { stageName: { failures: 0, lastFailure: 0, open: false } }
    
    // 确保目录存在
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.projectCheckpointDir)) {
      fs.mkdirSync(this.projectCheckpointDir, { recursive: true });
    }
  }

  _getCheckpointPath(stageName) {
    return path.join(this.projectCheckpointDir, `${stageName}.json`);
  }

  _getCircuitPath(stageName) {
    return path.join(this.projectCheckpointDir, `_circuit-${stageName}.json`);
  }

  /**
   * 计算输入数据的哈希（用于判断输入是否变化）
   */
  computeHash(input) {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  /**
   * 检查checkpoint是否存在且有效
   */
  hasCheckpoint(stageName, inputHash) {
    const cpPath = this._getCheckpointPath(stageName);
    if (!fs.existsSync(cpPath)) return false;
    
    try {
      const cp = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
      // inputHash匹配且状态为success
      return cp.inputHash === inputHash && cp.status === 'success';
    } catch (e) {
      return false;
    }
  }

  /**
   * 读取checkpoint
   */
  loadCheckpoint(stageName) {
    const cpPath = this._getCheckpointPath(stageName);
    if (!fs.existsSync(cpPath)) return null;
    
    try {
      const cp = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
      return cp.output;
    } catch (e) {
      return null;
    }
  }

  /**
   * 保存checkpoint
   */
  saveCheckpoint(stageName, inputHash, output, status = 'success') {
    const cpPath = this._getCheckpointPath(stageName);
    const checkpoint = {
      stageName,
      inputHash,
      output,
      status,
      timestamp: Date.now(),
      isoTime: new Date().toISOString()
    };
    
    try {
      fs.writeFileSync(cpPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
      console.log(`[Checkpoint] 💾 ${stageName} 已保存 | 状态: ${status}`);
    } catch (e) {
      console.error(`[Checkpoint] ❌ 保存失败: ${e.message}`);
    }
  }

  /**
   * Circuit Breaker: 检查是否熔断
   */
  isCircuitOpen(stageName) {
    // 读取持久化状态
    const circuitPath = this._getCircuitPath(stageName);
    if (fs.existsSync(circuitPath)) {
      try {
        const state = JSON.parse(fs.readFileSync(circuitPath, 'utf-8'));
        const now = Date.now();
        if (state.open && (now - state.lastFailure) > this.circuitBreakerConfig.resetTimeout) {
          // 熔断超时，重置
          state.open = false;
          state.failures = 0;
          fs.writeFileSync(circuitPath, JSON.stringify(state, null, 2), 'utf-8');
          console.log(`[CircuitBreaker] 🔓 ${stageName} 熔断重置`);
          return false;
        }
        return state.open;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  /**
   * Circuit Breaker: 记录失败
   */
  recordFailure(stageName, error) {
    const circuitPath = this._getCircuitPath(stageName);
    let state = { failures: 0, lastFailure: 0, open: false };
    
    if (fs.existsSync(circuitPath)) {
      try {
        state = JSON.parse(fs.readFileSync(circuitPath, 'utf-8'));
      } catch (e) {}
    }
    
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= this.circuitBreakerConfig.maxFailures) {
      state.open = true;
      console.warn(`[CircuitBreaker] 🔥 ${stageName} 已熔断！连续失败${state.failures}次`);
    }
    
    fs.writeFileSync(circuitPath, JSON.stringify(state, null, 2), 'utf-8');
    
    // 记录到failure log
    this._logFailure(stageName, error);
  }

  /**
   * Circuit Breaker: 记录成功
   */
  recordSuccess(stageName) {
    const circuitPath = this._getCircuitPath(stageName);
    if (fs.existsSync(circuitPath)) {
      try {
        const state = JSON.parse(fs.readFileSync(circuitPath, 'utf-8'));
        if (state.failures > 0) {
          state.failures = 0;
          state.open = false;
          fs.writeFileSync(circuitPath, JSON.stringify(state, null, 2), 'utf-8');
          console.log(`[CircuitBreaker] ✅ ${stageName} 成功，重置失败计数`);
        }
      } catch (e) {}
    }
  }

  _logFailure(stageName, error) {
    let failures = [];
    if (fs.existsSync(this.failureLogPath)) {
      try {
        failures = JSON.parse(fs.readFileSync(this.failureLogPath, 'utf-8'));
      } catch (e) {}
    }
    
    failures.push({
      stageName,
      error: error.message || String(error),
      stack: error.stack,
      timestamp: Date.now(),
      isoTime: new Date().toISOString()
    });
    
    // 只保留最近50条
    if (failures.length > 50) failures = failures.slice(-50);
    
    fs.writeFileSync(this.failureLogPath, JSON.stringify(failures, null, 2), 'utf-8');
  }

  /**
   * 主入口：运行Stage（带checkpoint和熔断）
   */
  async runStage(stageName, stageFn, input, options = {}) {
    const inputHash = this.computeHash(input);
    const { skipCheckpoint = false, fallbackFn = null, onCircuitOpen = null } = options;
    
    console.log(`\n[Checkpoint] 🔄 ${stageName} 开始...`);
    
    // 1. 检查Circuit Breaker
    if (this.isCircuitOpen(stageName)) {
      console.warn(`[Checkpoint] 🔥 ${stageName} 处于熔断状态，跳过LLM调用`);
      if (onCircuitOpen) {
        return onCircuitOpen();
      }
      if (fallbackFn) {
        console.log(`[Checkpoint] ⚡ ${stageName} 使用fallback执行`);
        return fallbackFn();
      }
      throw new Error(`Circuit Breaker: ${stageName} 已熔断，且无fallback`);
    }
    
    // 2. 检查checkpoint（如果启用）
    if (!skipCheckpoint && this.hasCheckpoint(stageName, inputHash)) {
      const cached = this.loadCheckpoint(stageName);
      console.log(`[Checkpoint] 📦 ${stageName} 从checkpoint恢复 | 输入Hash: ${inputHash}`);
      return cached;
    }
    
    // 3. 执行Stage
    const startTime = Date.now();
    try {
      const result = await stageFn();
      const elapsed = Date.now() - startTime;
      
      // 保存checkpoint
      this.saveCheckpoint(stageName, inputHash, result, 'success');
      // 重置熔断
      this.recordSuccess(stageName);
      
      console.log(`[Checkpoint] ✅ ${stageName} 完成 | 耗时: ${elapsed}ms`);
      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      
      // 记录失败
      this.recordFailure(stageName, error);
      // 保存失败checkpoint
      this.saveCheckpoint(stageName, inputHash, { error: error.message }, 'failed');
      
      console.error(`[Checkpoint] ❌ ${stageName} 失败 | 耗时: ${elapsed}ms | 错误: ${error.message}`);
      
      // 如果有fallback，尝试fallback
      if (fallbackFn) {
        console.log(`[Checkpoint] ⚡ ${stageName} fallback执行...`);
        try {
          const fallbackResult = await fallbackFn();
          this.saveCheckpoint(stageName, inputHash, fallbackResult, 'fallback');
          console.log(`[Checkpoint] ✅ ${stageName} fallback成功`);
          return fallbackResult;
        } catch (fallbackError) {
          console.error(`[Checkpoint] ❌ ${stageName} fallback也失败: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  /**
   * 获取失败日志
   */
  getFailureLog() {
    if (!fs.existsSync(this.failureLogPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.failureLogPath, 'utf-8'));
    } catch (e) {
      return [];
    }
  }

  /**
   * 清理所有checkpoint
   */
  clearAll() {
    if (fs.existsSync(this.projectCheckpointDir)) {
      const files = fs.readdirSync(this.projectCheckpointDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.projectCheckpointDir, file));
      }
      console.log(`[Checkpoint] 🗑️ 已清理 ${files.length} 个checkpoint`);
    }
  }

  /**
   * 获取checkpoint统计
   */
  getStats() {
    if (!fs.existsSync(this.projectCheckpointDir)) return { total: 0, success: 0, failed: 0, fallback: 0 };
    
    const files = fs.readdirSync(this.projectCheckpointDir).filter(f => !f.startsWith('_'));
    let success = 0, failed = 0, fallback = 0;
    
    for (const file of files) {
      try {
        const cp = JSON.parse(fs.readFileSync(path.join(this.projectCheckpointDir, file), 'utf-8'));
        if (cp.status === 'success') success++;
        else if (cp.status === 'failed') failed++;
        else if (cp.status === 'fallback') fallback++;
      } catch (e) {}
    }
    
    return { total: files.length, success, failed, fallback };
  }
}

module.exports = { CheckpointManager };

// v6.2-patch80: Checkpoint + Circuit Breaker 断线重跑机制
