/**
 * LLM Agent 基类
 * v2.0.0: 所有制作引擎Agent的基类，封装LLM调用、重试、降级逻辑
 */
const path = require('path');

// 加载LLM引擎（与script-generator.js同深度）
function loadLLMEngine() {
  try {
    const SYSTEMS_PATH = path.join(__dirname, '../../../../systems');
    return require(path.join(SYSTEMS_PATH, 'llm-reasoning-engine.js'))?.LLMEngine;
  } catch (e) {
    console.warn(`[BaseAgent] LLM引擎加载失败: ${e.message}`);
    return null;
  }
}

class BaseAgent {
  constructor(options = {}) {
    this.name = options.name || 'BaseAgent';
    this.llmTimeout = options.llmTimeout || 300000; // 5分钟
    this.llmMaxRetries = options.llmMaxRetries || 3;
    this.llmModel = options.llmModel || 'kimi-k2p6';
    this.enabled = options.enabled !== false;

    // 延迟加载LLM引擎（避免构造时失败阻断）
    this._llmEngine = null;
    this._llmEngineLoaded = false;
  }

  /**
   * 获取LLM引擎实例（惰性加载）
   */
  _getLLMEngine() {
    if (!this._llmEngineLoaded) {
      this._llmEngine = loadLLMEngine();
      this._llmEngineLoaded = true;
      if (this._llmEngine) {
        console.log(`[${this.name}] LLM引擎加载成功`);
      } else {
        console.warn(`[${this.name}] LLM引擎不可用，将使用降级模式`);
      }
    }
    return this._llmEngine;
  }

  /**
   * 核心LLM调用方法（带重试+降级）
   * @param {string} prompt - 提示词
   * @param {object} schema - 期望的JSON结构
   * @param {Function} fallbackFn - 降级回调
   * @returns {object} { result, degraded, degradeReason }
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

    let lastError = null;

    for (let attempt = 1; attempt <= this.llmMaxRetries; attempt++) {
      console.log(`[${this.name}] LLM调用尝试 ${attempt}/${this.llmMaxRetries}...`);

      try {
        const result = await llm.generate(prompt, {
          systemPrompt: this._getSystemPrompt(),
          maxTokens: 16000,
          timeoutMs: this.llmTimeout,
          forceJson: true,
          allowReasoningFallback: false
        });

        if (!result.success) {
          throw new Error(`LLM引擎返回失败: ${result.error}`);
        }

        // 解析JSON
        let parsed;
        try {
          const content = result.content || result.text || '';
          parsed = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (parseErr) {
          throw new Error(`JSON解析失败: ${parseErr.message}`);
        }

        // Schema校验
        const validation = this._validateSchema(parsed, schema);
        if (!validation.valid) {
          throw new Error(`Schema校验失败: ${validation.reason}`);
        }

        console.log(`[${this.name}] LLM调用成功 ✓`);
        return {
          result: parsed,
          degraded: false,
          degradeReason: null,
          attempts: attempt
        };

      } catch (err) {
        lastError = err;
        console.warn(`[${this.name}] 尝试 ${attempt} 失败: ${err.message}`);

        if (attempt < this.llmMaxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 指数退避
          console.log(`[${this.name}] 等待 ${delay}ms 后重试...`);
          await this._sleep(delay);
        }
      }
    }

    // 所有重试耗尽，降级
    console.warn(`[${this.name}] 重试${this.llmMaxRetries}次后降级: ${lastError?.message}`);
    return this._executeFallback(fallbackFn, `LLM failed after ${this.llmMaxRetries} retries: ${lastError?.message}`);
  }

  /**
   * 执行降级回调
   */
  _executeFallback(fallbackFn, reason) {
    try {
      const fallbackResult = fallbackFn ? fallbackFn() : null;
      return {
        result: fallbackResult,
        degraded: true,
        degradeReason: reason,
        attempts: this.llmMaxRetries
      };
    } catch (fallbackErr) {
      console.error(`[${this.name}] 降级也失败了: ${fallbackErr.message}`);
      return {
        result: null,
        degraded: true,
        degradeReason: `LLM failed and fallback failed: ${fallbackErr.message}`,
        attempts: this.llmMaxRetries
      };
    }
  }

  /**
   * Schema校验
   */
  _validateSchema(data, schema) {
    if (!schema || !schema.required) {
      return { valid: true };
    }

    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        return { valid: false, reason: `缺少必需字段: ${field}` };
      }
    }

    return { valid: true };
  }

  /**
   * 获取系统提示词（子类可覆盖）
   */
  _getSystemPrompt() {
    return '你是一位专业的AI视频导演。只输出严格格式的JSON，不要markdown代码块，不要解释，不要思考过程。使用最紧凑的JSON格式。';
  }

  /**
   * 休眠辅助
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 批量处理镜头（子类实现）
   */
  async process(shots, blueprint) {
    throw new Error('子类必须实现 process 方法');
  }
}

module.exports = { BaseAgent };
