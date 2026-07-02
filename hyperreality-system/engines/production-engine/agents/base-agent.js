/**
 * LLM Agent 基类（v2.1.0 智能重试版）
 * - 模型按 Agent 透传（修复原 loadLLMEngine 写死 kimi-k2p6 的 bug）
 * - 全局截止时间（deadline）感知：单次超时 = min(自身超时, 剩余预算)
 * - 【v2.1.0】集成错误分类器，智能重试策略
 * - 【v2.1.0】镜头级独立预算，互不侵占
 */
const path = require('path');
const { ErrorClassifier } = require('./error-classifier');

// 从环境变量读取模型配置，消除硬编码
const DEFAULT_MODEL = process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6';
const DEFAULT_FAST_MODEL = process.env.STORMAXE_LLM_FAST_MODEL || DEFAULT_MODEL;

function loadLLMEngine(model, maxTokens) {
  try {
    const SYSTEMS_PATH = path.join(__dirname, '../../../../systems');
    const LLMClass = require(path.join(SYSTEMS_PATH, 'llm-reasoning-engine.js'))?.LLMEngine;
    if (!LLMClass) {
      console.warn('[BaseAgent] LLMEngine类加载失败');
      return null;
    }
    return new LLMClass({ model: model || DEFAULT_MODEL, maxTokens: maxTokens || 16000 });
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
    this.llmModel = options.llmModel || DEFAULT_MODEL; // 修复：用环境变量
    this.llmMaxTokens = options.llmMaxTokens || this._calculateDynamicMaxTokens(options); // 【P1-DATA-03 修复】动态计算token预算，不再固定32000
    this.enabled = options.enabled !== false;

    this._llmEngine = null;
    this._llmEngineLoaded = false;
    this._globalDeadline = null; // 全局截止时间戳（由 ProductionEngine 下发）
  }

  /**
   * 【P1-DATA-03 修复】动态计算maxTokens：根据镜头数量和字段数计算
   */
  _calculateDynamicMaxTokens(options = {}) {
    const shotCount = options.shotCount || 1;
    const fieldCount = options.fieldCount || 25;
    const avgFieldLength = options.avgFieldLength || 200;
    // 基础token + 每个镜头的token需求
    const baseTokens = 4096;
    const perShotTokens = fieldCount * avgFieldLength * 1.5; // 1.5倍系数覆盖中文
    const totalTokens = Math.min(64000, baseTokens + shotCount * perShotTokens);
    // 对齐到最近的1024
    return Math.ceil(totalTokens / 1024) * 1024;
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
   * 【审计修复·核心】通用超时包装器
   *
   * 重要说明：Promise.race 只能对"异步挂起"生效，无法中断同步 CPU 计算。
   * 真正的同步阻塞由 _extractJsonObject 的预算保护（修复1）根治。
   * 本方法负责：异步场景下的超时降级 + 防止悬空 rejection 崩溃进程。
   */
  _callWithTimeout(promise, timeoutMs, label = 'LLM调用') {
    const ms = (typeof timeoutMs === 'number' && timeoutMs > 0 && timeoutMs < 24 * 3600 * 1000)
      ? timeoutMs : 300000;
    let timer;
    // 【P2-D8 修复】使用Symbol替代布尔值settled，防止纳秒级竞态窗口
    const RESOLVED = Symbol('resolved');
    const REJECTED = Symbol('rejected');
    let state = null; // null | RESOLVED | REJECTED
    const callStart = Date.now();
    const p = Promise.resolve(promise);
    // 立即挂 catch：标记 rejection 已被处理，防止超时后悬空 rejection 崩溃进程
    p.catch(() => {});
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        // 【P2-D8 修复】使用严格相等检查替代布尔值
        if (state !== null) return;
        state = REJECTED;
        console.warn(`[${label}] ⏱️ 外层超时触发(${ms}ms)，强制降级`);
        reject(new Error(`${label}超时(${ms}ms)`));
      }, ms);
    });
    return Promise.race([p, timeoutPromise])
      .then(v => {
        // 【P2-D8 修复】Symbol状态检查
        if (state === REJECTED) return v;
        if (state !== null) return v;
        state = RESOLVED;
        clearTimeout(timer);
        console.log(`[${label}] ✅ 正常完成，耗时≈${Date.now() - callStart}ms`);
        return v;
      }, e => {
        // 【P2-D8 修复】Symbol状态检查
        if (state === RESOLVED) throw e;
        if (state !== null) throw e;
        state = REJECTED;
        clearTimeout(timer);
        console.warn(`[${label}] ❌ 异常/超时退出: ${e.message} | 耗时≈${Date.now() - callStart}ms`);
        throw e;
      })
      .finally(() => {
        // 【P2-PERF-01 修复】确保timer始终被清理，防止内存泄漏
        if (timer) { clearTimeout(timer); timer = null; }
      });
  }

  /**
   * 核心LLM调用方法（v2.1.0 智能重试版）
   * - 集成错误分类器，根据错误类型选择不同重试策略
   * - 支持镜头级独立预算（options.shotBudget）
   * - 渐进式超时：网络错误 ×1.5，指数退避：限流错误
   * 【审计修复】支持第4参数 options: { maxRetries, maxTokens, shotBudget, timeoutStrategy }
   */
  async _callLLM(prompt, schema, fallbackFn, options = {}) {
    if (!this.enabled) {
      console.log(`[${this.name}] Agent已禁用，使用降级`);
      return this._executeFallback(fallbackFn, 'Agent disabled');
    }

    const llm = this._getLLMEngine();
    if (!llm) {
      console.warn(`[${this.name}] LLM引擎不可用，使用降级`);
      return this._executeFallback(fallbackFn, 'LLM engine not available');
    }

    // 【v2.1.0】镜头级独立预算：每个镜头有自己的预算，不互相侵占
    const shotBudget = options.shotBudget || null;
    const effectiveBudget = shotBudget ? Math.min(shotBudget, this._remainingMs()) : this._remainingMs();
    
    const callMaxTokens = options.maxTokens || this.llmMaxTokens;
    const callMaxRetries = options.maxRetries ?? this.llmMaxRetries;
    
    // 【P0-ARCH-01 修复】三层timeout优先级清晰化：
    // 1. 用户显式指定的timeoutMs是"必要最低保障"，优先满足
    // 2. effectiveBudget是"硬性上限"，不能突破
    // 3. 两者冲突时，按比例缩放，确保内层至少50%时间
    const requestedTimeout = options.timeoutMs || this.llmTimeout;
    const hardCeiling = effectiveBudget; // 绝对不能超过此值

    let perCallTimeout;
    if (requestedTimeout <= hardCeiling) {
      perCallTimeout = requestedTimeout; // 正常情况：内层可以完整执行
    } else {
      // budget不足：按比例缩放，但保证至少50%的内层时间
      perCallTimeout = Math.max(requestedTimeout * 0.5, hardCeiling);
      console.warn(`[${this.name}] ⚠️ timeout缩放: 请求${requestedTimeout}ms > budget上限${hardCeiling}ms, 按比例缩放为${perCallTimeout}ms (保证内层50%)`);
    }

    // 【P0-ARCH-01 修复】fastMode覆盖必须经过同样的优先级校验
    if (options.fastMode && perCallTimeout > options.fastTimeoutMs) {
      perCallTimeout = Math.max(options.fastTimeoutMs, hardCeiling * 0.3);
    }
    
    console.log(`[${this.name}] _callLLM 进入 | perCallTimeout=${perCallTimeout}ms maxTokens=${callMaxTokens} retries=${callMaxRetries} budget=${effectiveBudget}ms ceiling=${hardCeiling}ms${shotBudget ? ' (镜头独立预算)' : ''}`);

    // 【P0-ARCH-01 修复】budget严重不足时（<5秒），直接降级，不尝试LLM
    if (perCallTimeout < 5000) {
      console.warn(`[${this.name}] ⛔ budget严重不足(${perCallTimeout}ms)，直接降级`);
      return this._executeFallback(fallbackFn, `Budget insufficient: ${perCallTimeout}ms`);
    }

    let currentPrompt = prompt;
    let lastError = null;
    let classification = null;
    
    // 【P1-QUAL-02 修复】根据错误类型动态确定最大重试次数
    const getMaxRetriesForType = (type) => {
      const retriesByType = {
        'AUTH': 0,       // 鉴权错误：不重试
        'PARAM': 0,      // 参数错误：不重试
        'RATE_LIMIT': 5, // 限流：最多5次
        'SERVER': 4,     // 服务端错误：最多4次
        'TIMEOUT': 3,    // 超时：最多3次
        'PARSE': 2,      // 解析错误：最多2次
        'NETWORK': 3,    // 网络错误：最多3次
        'UNKNOWN': 2     // 未知错误：最多2次
      };
      return retriesByType[type] ?? callMaxRetries;
    };

    let effectiveMaxRetries = callMaxRetries; // 初始值
    let attempt = 0;

    while (attempt < effectiveMaxRetries) {
      attempt++;
      const attemptStart = Date.now();
      const currentTimeout = classification 
        ? ErrorClassifier.calculateTimeout(perCallTimeout, attempt, classification)
        : perCallTimeout;
      
      try {
        console.log(`[${this.name}] 尝试 ${attempt}/${callMaxRetries} | timeout=${currentTimeout}ms${classification ? ` strategy=${classification.strategy}` : ''}`);
        
        const fullPrompt = `${this._getSystemPrompt()}\n\n${currentPrompt}`;
        const result = await this._callWithTimeout(
          llm.reasonStructured(fullPrompt, schema, {
            maxTokens: callMaxTokens,
            timeoutMs: currentTimeout,
            maxRetries: 1, // 内层只重试1次，外层控制总重试
            deadlineMs: this._globalDeadline,
            thinking: { type: 'disabled' } // 【v2.1.8-fix13】禁用reasoning，释放token配额
          }),
          currentTimeout,
          `[${this.name}] attempt ${attempt}/${callMaxRetries}`
        );

        if (!result || !result.success) {
          throw new Error(`LLM引擎返回失败: ${result?.error || '无返回'}`);
        }

        // Schema 校验
        const validation = this._validateSchema(result.data, schema);
        if (!validation.valid) {
          throw new Error(`Schema校验失败: ${validation.reason}`);
        }
        
        console.log(`[${this.name}] LLM调用成功 ✓ | 耗时=${Date.now() - attemptStart}ms`);
        return { result: result.data, degraded: false, degradeReason: null, attempts: attempt };
        
      } catch (err) {
        lastError = err;
        classification = ErrorClassifier.classify(err);
        
        // 【P1-QUAL-02 修复】根据错误类型动态调整最大重试次数
        const typeSpecificMax = getMaxRetriesForType(classification.type);
        if (typeSpecificMax !== effectiveMaxRetries) {
          console.log(`[${this.name}] 错误类型${classification.type} → 重试上限调整为${typeSpecificMax}次`);
          effectiveMaxRetries = typeSpecificMax;
        }
        
        console.warn(`[${this.name}] 尝试 ${attempt}/${effectiveMaxRetries} 失败: ${err.message} | type=${classification.type} | retryable=${classification.retryable}`);
        
        // 不可重试错误 → 立即熔断
        if (!classification.retryable || effectiveMaxRetries === 0) {
          console.error(`[${this.name}] 🔴 不可重试错误(${classification.type})，停止重试: ${classification.message}`);
          break;
        }
        
        // 计算下次重试的等待时间
        if (attempt < effectiveMaxRetries) {
          const delay = ErrorClassifier.calculateDelay(attempt, classification);
          if (delay > 0) {
            console.log(`[${this.name}] 等待 ${delay}ms 后重试...`);
            await new Promise(r => setTimeout(r, delay));
          }
          
          // 如果是解析错误，尝试缩短 prompt
          if (ErrorClassifier.shouldShrinkPrompt(classification)) {
            currentPrompt = ErrorClassifier.shrinkPrompt(currentPrompt, classification.shrinkRatio);
            console.log(`[${this.name}] Prompt 缩短至 ${currentPrompt.length} 字符`);
          }
        }
      }
    }
    
    console.error(`[${this.name}] 所有 ${attempt} 次尝试均失败，最后错误: ${lastError?.message}`);
    return this._executeFallback(fallbackFn, `LLM failed after ${attempt} attempts: ${lastError?.message}`);
  }

  async _executeFallback(fallbackFn, reason) {
    try {
      const fallbackResult = fallbackFn ? await Promise.resolve(fallbackFn()) : null;
      // 【v2.1.4-fix13-P0-QUAL-03】如果降级结果也为 null，明确标记
      if (fallbackResult === null || fallbackResult === undefined) {
        console.warn(`[${this.name}] 降级结果为null/undefined: ${reason}`);
        return { result: null, degraded: true, degradeReason: reason, attempts: this.llmMaxRetries };
      }
      return { result: fallbackResult, degraded: true, degradeReason: reason, attempts: this.llmMaxRetries };
    } catch (fallbackErr) {
      console.error(`[${this.name}] 降级也失败了: ${fallbackErr.message}`);
      return { result: null, degraded: true, degradeReason: `LLM failed and fallback failed: ${fallbackErr.message}`, attempts: this.llmMaxRetries };
    }
  }

  /**
   * 【v2.1.4-fix13】Schema 校验 — 增加空字符串/空数组检查
   */
  _validateSchema(data, schema) {
    if (!schema || !schema.required) return { valid: true };
    if (!data || typeof data !== 'object') {
      return { valid: false, reason: '返回数据为空或非对象' };
    }
    for (const field of schema.required) {
      const value = data[field];
      if (value === undefined || value === null) {
        return { valid: false, reason: `缺少必需字段: ${field}` };
      }
      if (typeof value === 'string' && !value.trim()) {
        return { valid: false, reason: `必需字段为空字符串: ${field}` };
      }
      // 【P1-6 修复】类型校验：数组字段
      if (schema.requiredArrays?.includes(field) && !Array.isArray(value)) {
        return { valid: false, reason: `${field} 应为数组` };
      }
      if (schema.rejectEmptyArray && Array.isArray(value) && value.length === 0) {
        return { valid: false, reason: `必需字段为空数组: ${field}` };
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