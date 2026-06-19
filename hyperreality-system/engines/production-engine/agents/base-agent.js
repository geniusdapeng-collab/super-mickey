/**
 * LLM Agent 基类（v2.0.1 并行优化版）
 * - 模型按 Agent 透传（修复原 loadLLMEngine 写死 kimi-k2p6 的 bug）
 * - 全局截止时间（deadline）感知：单次超时 = min(自身超时, 剩余预算)
 * - 预算不足时提前降级，防止单个 Agent 拖垮全局链路
 */
const path = require('path');

function loadLLMEngine(model, maxTokens) {
  try {
    const SYSTEMS_PATH = path.join(__dirname, '../../../../systems');
    const LLMClass = require(path.join(SYSTEMS_PATH, 'llm-reasoning-engine.js'))?.LLMEngine;
    if (!LLMClass) {
      console.warn('[BaseAgent] LLMEngine类加载失败');
      return null;
    }
    return new LLMClass({ model: model || 'kimi-k2p6', maxTokens: maxTokens || 16000 });
  } catch (e) {
    console.warn(`[BaseAgent] LLM引擎加载失败: ${e.message}`);
    return null;
  }
}

class BaseAgent {
  constructor(options = {}) {
    this.name = options.name || 'BaseAgent';
    this.llmTimeout = options.llmTimeout || 300000; // 单次调用上限 5 分钟（足以覆盖最慢的 VisualLanguage 258s）
    this.llmMaxRetries = options.llmMaxRetries ?? 2; // 重试收敛到 2 次（原 3 次是隐藏时间炸弹）
    this.llmModel = options.llmModel || 'kimi-k2p6'; // 现在真的会生效
    this.llmMaxTokens = options.llmMaxTokens || 16000;
    this.enabled = options.enabled !== false;

    this._llmEngine = null;
    this._llmEngineLoaded = false;
    this._globalDeadline = null; // 全局截止时间戳（由 ProductionEngine 下发）
  }

  /** 由 ProductionEngine 下发全局截止时间 */
  setDeadline(deadlineMs) { this._globalDeadline = deadlineMs || null; }

  /** 当前剩余预算（ms），至少保留 10s */
  _remainingMs() {
    if (!this._globalDeadline) return this.llmTimeout;
    return Math.max(10000, this._globalDeadline - Date.now());
  }

  _getLLMEngine() {
    if (!this._llmEngineLoaded) {
      this._llmEngine = loadLLMEngine(this.llmModel, this.llmMaxTokens);
      this._llmEngineLoaded = true;
      if (this._llmEngine) {
        console.log(`[${this.name}] LLM引擎加载成功 | model=${this.llmModel}`);
      } else {
        console.warn(`[${this.name}] LLM引擎不可用，将使用降级模式`);
      }
    }
    return this._llmEngine;
  }

  /**
   * 核心LLM调用方法（带重试+降级+截止时间感知）
   */
  async _callLLM(prompt, schema, fallbackFn) {
    if (!this.enabled) {
      console.log(`[${this.name}] Agent已禁用，使用降级`);
      return this._executeFallback(fallbackFn, 'Agent disabled');
    }

    const llm = this._getLLMEngine();
    if (!llm) {
      console.warn(`[${this.name}] LLM引擎不可用，使用降级`);
      return this._executeFallback(fallbackFn, 'LLM engine not available');
    }

    // 截止时间感知：单次超时取「自身超时」与「剩余预算」的较小值
    const perCallTimeout = Math.min(this.llmTimeout, this._remainingMs());
    if (perCallTimeout < 20000) {
      // 剩余预算已不足以完成一次完整调用，提前降级，保住全局链路
      console.warn(`[${this.name}] 剩余预算不足(${perCallTimeout}ms)，提前降级以保住全局链路`);
      return this._executeFallback(fallbackFn, 'insufficient time budget');
    }

    try {
      const fullPrompt = `${this._getSystemPrompt()}\n\n${prompt}`;
      const result = await llm.reasonStructured(fullPrompt, schema, {
        maxTokens: this.llmMaxTokens,
        timeoutMs: perCallTimeout,
        maxRetries: this.llmMaxRetries,
        deadlineMs: this._globalDeadline
      });

      if (!result.success) {
        throw new Error(`LLM引擎返回失败: ${result.error}`);
      }

      console.log(`[${this.name}] LLM调用成功 ✓`);
      return { result: result.data, degraded: false, degradeReason: null };
    } catch (err) {
      console.warn(`[${this.name}] LLM调用失败: ${err.message}`);
      return this._executeFallback(fallbackFn, `LLM failed: ${err.message}`);
    }
  }

  _executeFallback(fallbackFn, reason) {
    try {
      const fallbackResult = fallbackFn ? fallbackFn() : null;
      return { result: fallbackResult, degraded: true, degradeReason: reason, attempts: this.llmMaxRetries };
    } catch (fallbackErr) {
      console.error(`[${this.name}] 降级也失败了: ${fallbackErr.message}`);
      return { result: null, degraded: true, degradeReason: `LLM failed and fallback failed: ${fallbackErr.message}`, attempts: this.llmMaxRetries };
    }
  }

  _validateSchema(data, schema) {
    if (!schema || !schema.required) return { valid: true };
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        return { valid: false, reason: `缺少必需字段: ${field}` };
      }
    }
    return { valid: true };
  }

  _getSystemPrompt() {
    return '你是一位专业的AI视频导演。只输出严格格式的JSON，不要markdown代码块，不要解释，不要思考过程。使用最紧凑的JSON格式。';
  }

  _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async process(shots, blueprint) { throw new Error('子类必须实现 process 方法'); }
}

module.exports = { BaseAgent };
