// llm-gateway.js
// LLM统一网关 v1.0.0
// 熔断、限流、缓存、多模型负载均衡
// 日期: 2026-06-26

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 简单内存缓存（生产环境可替换为Redis）
class SimpleCache {
  constructor(options = {}) {
    this.store = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 3600000;
    this._hits = 0;
    this._misses = 0;
  }
  
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      this._misses++;
      return null;
    }
    // 【P0-Bug-3 修复】LRU: 命中后删除并重新插入，使其成为"最新使用"
    this.store.delete(key);
    this.store.set(key, entry);
    entry.hits = (entry.hits || 0) + 1; // 【P0-Bug-3 修复】递增hits计数器
    this._hits++;
    return entry.value;
  }
  
  set(key, value, ttlMs = this.defaultTTL) {
    // 【P0-Bug-3 修复】如果key已存在，先删除（确保更新位置和TTL）
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // 【P0-Bug-3 修复】真正的LRU: 淘汰最久未访问的（Map的第一个key）
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlMs,
      hits: 0
    });
  }
  
  stats() {
    const total = this._hits + this._misses;
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? (this._hits / total * 100).toFixed(2) + '%' : 'N/A'
    };
  }
}

class LLMGateway {
  constructor(options = {}) {
    this.cache = new SimpleCache();
    this.stats = {
      totalCalls: 0,
      cacheHits: 0,
      timeouts: 0,
      errors: 0,
      fallbackUsed: 0,
      avgLatency: 0,
      latencyHistory: []
    };
    
    // 熔断器配置
    this.circuitBreaker = {
      failureThreshold: 3,      // 连续失败3次触发熔断
      recoveryTimeout: 60000,   // 熔断后60秒尝试恢复
      state: 'CLOSED',          // CLOSED | OPEN | HALF_OPEN
      consecutiveFailures: 0,
      lastFailureTime: null
    };
    
    // 模型配置
    this.models = {
      primary: options.primaryModel || 'kimi-k2p6',
      fallback: options.fallbackModel || 'kimi-k2p5',
      fast: options.fastModel || 'kimi-k2p5'
    };
    
    // 默认超时
    this.defaultTimeout = options.timeout || 120000; // 2分钟
    
    // LLM引擎引用（由外部注入）
    this.llmEngine = null;
    
    console.log('[LLMGateway] 初始化完成', {
      primary: this.models.primary,
      fallback: this.models.fallback,
      cache: 'memory'
    });
  }
  
  /**
   * 注入LLM引擎实例
   */
  setEngine(engine) {
    this.llmEngine = engine;
    console.log('[LLMGateway] LLM引擎已注入');
  }
  
  /**
   * 生成缓存键
   * 【P1-Bug-6 修复】使用稳定键序列化（排序键）+ SHA-256替代MD5 + 包含所有影响结果的参数
   */
  _cacheKey(prompt, options) {
    // 稳定序列化：按键排序，消除键顺序影响
    const stableStringify = (obj) => {
      if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
      if (Array.isArray(obj)) {
        return '[' + obj.map(stableStringify).join(',') + ']';
      }
      const sorted = {};
      for (const key of Object.keys(obj).sort()) {
        sorted[key] = obj[key];
      }
      return JSON.stringify(sorted);
    };

    // 包含所有影响结果的参数
    const keyData = [
      String(prompt),
      options.agentType || 'unknown',
      stableStringify(options.schema || {}),
      options.model || 'default',
      String(options.temperature || ''),
      String(options.maxTokens || ''),
      stableStringify(options.context || {}),
    ].join('\0');

    // 使用SHA-256替代MD5（更安全），截取前32字符
    return `llm:${crypto.createHash('sha256').update(keyData).digest('hex').slice(0, 32)}`;
  }
  
  /**
   * 主调用入口
   * @param {string} prompt - 提示词
   * @param {object} options - 选项
   *   - agentType: Agent类型
   *   - timeout: 超时毫秒
   *   - schema: JSON schema
   *   - useCache: 是否使用缓存（默认true）
   *   - preferFast: 是否优先使用快速模型
   * @returns {Promise<object>}
   */
  async call(prompt, options = {}, _retryCount = 0) {
    this.stats.totalCalls++;
    
    // 1. 检查熔断器
    if (this._isCircuitOpen()) {
      console.warn('[LLMGateway] 熔断器开启，直接降级');
      return this._ruleTemplateFallback(options.agentType, prompt, options.context);
    }
    
    // 2. 缓存检查
    if (options.useCache !== false) {
      const cacheKey = this._cacheKey(prompt, options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        console.log(`[LLMGateway] 缓存命中 (${this.stats.cacheHits}/${this.stats.totalCalls})`);
        return cached;
      }
    }
    
    // 3. 选择模型
    const model = options.preferFast ? this.models.fast : this.models.primary;
    const timeout = options.timeout || this.defaultTimeout;
    
    // 4. 执行 LLM 调用
    const startTime = Date.now();
    try {
      const result = await this._executeWithTimeout(prompt, model, timeout, options);
      
      // 记录成功
      const latency = Date.now() - startTime;
      this._recordLatency(latency);
      this._recordSuccess();
      
      // 缓存结果
      if (options.useCache !== false) {
        const cacheKey = this._cacheKey(prompt, options);
        this.cache.set(cacheKey, result, 3600000); // 1小时
      }
      
      return result;
      
    } catch (err) {
      const latency = Date.now() - startTime;
      this._recordLatency(latency);
      
      // 5. 错误处理与降级链
      return this._handleError(err, prompt, options, latency, _retryCount);
    }
  }
  
  /**
   * 执行LLM调用（带超时）
   * 【P0-D1 修复】使用settled标志+finally确保timer清理，防止悬空Promise泄漏
   * 【P0-D2 修复】timeout截断到32位安全值
   */
  async _executeWithTimeout(prompt, model, timeout, options) {
    if (!this.llmEngine) {
      throw new Error('LLM引擎未注入');
    }
    
    // 【P0-D2 修复】截断到32位安全值
    const safeTimeout = Math.min(timeout, 2147483647);
    
    return new Promise((resolve, reject) => {
      let timer = null;
      let settled = false;
      
      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };
      
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        // 【P0-D1 修复】使用Error实例而非普通对象
        const err = new Error(`LLM调用超时: ${safeTimeout}ms`);
        err.type = 'TIMEOUT';
        err.timeout = safeTimeout;
        reject(err);
      }, safeTimeout);
      
      try {
        this.llmEngine.reasonStructured(prompt, options.schema || null, {
          model: model,
          ...options
        }).then(result => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve(result);
          }
        }).catch(err => {
          if (!settled) {
            settled = true;
            cleanup();
            const wrapped = new Error(err.message || 'LLM调用失败');
            wrapped.type = 'LLM_ERROR';
            wrapped.original = err;
            reject(wrapped);
          }
        });
      } catch (syncErr) {
        // 【P0-D1 修复】捕获同步异常
        if (!settled) {
          settled = true;
          cleanup();
          const wrapped = new Error(syncErr.message || 'LLM同步调用异常');
          wrapped.type = 'LLM_ERROR';
          wrapped.original = syncErr;
          reject(wrapped);
        }
      }
    });
  }
  
  /**
   * 错误处理与降级链
   * 【P1-D3 修复】添加降级链深度追踪和timeout下限保护，防止timeout收缩至0
   */
  async _handleError(err, prompt, options, latency, retryCount = 0) {
    this._recordFailure();
    
    // 【P1-D3 修复】降级链深度追踪
    const degradeDepth = options._degradeDepth || 0;
    const MAX_DEGRADE_DEPTH = 2; // 最多2层降级（主模型→fallback→规则模板）
    
    if (degradeDepth >= MAX_DEGRADE_DEPTH) {
      console.error(`[LLMGateway] 降级链已达最大深度${MAX_DEGRADE_DEPTH}，直接返回规则模板`);
      this.stats.fallbackUsed++;
      return this._ruleTemplateFallback(options.agentType, prompt, options.context);
    }
    
    // 保存原始timeout用于预算控制
    const originalTimeout = options._originalTimeout || (options.timeout || this.defaultTimeout);
    
    if (err.type === 'TIMEOUT') {
      this.stats.timeouts++;
      console.warn(`[LLMGateway] 超时(${latency}ms)，触发降级链 | depth=${degradeDepth}`);
      
      // 降级链1：轻量模型
      if (!options.preferFast && this.models.fallback && degradeDepth < 1) {
        console.log('[LLMGateway] 降级到轻量模型:', this.models.fallback);
        try {
          // 【P1-D3 修复】收缩后的timeout不低于MIN_FALLBACK_TIMEOUT
          const MIN_FALLBACK_TIMEOUT = 10000; // 10秒最低保障
          const shrunkTimeout = Math.max(
            MIN_FALLBACK_TIMEOUT,
            Math.floor(originalTimeout * 0.7)
          );
          
          // 【P1-D3 修复】总降级预算不超过原始timeout的80%
          const totalBudgetUsed = options._budgetUsed || 0;
          const remainingBudget = originalTimeout * 0.8 - totalBudgetUsed;
          const finalTimeout = Math.min(shrunkTimeout, remainingBudget);
          
          if (finalTimeout < MIN_FALLBACK_TIMEOUT) {
            console.warn(`[LLMGateway] fallback预算不足(${finalTimeout}ms)，跳过fallback直接规则兜底`);
            throw new Error('INSUFFICIENT_FALLBACK_BUDGET');
          }
          
          const result = await this._executeWithTimeout(
            prompt, 
            this.models.fallback, 
            finalTimeout,
            {
              ...options,
              _degradeDepth: degradeDepth + 1,
              _originalTimeout: originalTimeout,
              _budgetUsed: totalBudgetUsed + latency
            }
          );
          this.stats.fallbackUsed++;
          return result;
        } catch (fallbackErr) {
          console.warn('[LLMGateway] 轻量模型也失败:', fallbackErr.message);
        }
      }
      
      // 降级链2：规则模板
      console.log('[LLMGateway] 最终降级: 规则模板');
      this.stats.fallbackUsed++;
      return this._ruleTemplateFallback(options.agentType, prompt, options.context);
      
    } else if (err.type === 'RATE_LIMIT') {
      // 【P0-3-审计修复】限制最多 3 次退避重试，避免无限递归
      const MAX_RATE_LIMIT_RETRIES = 3;
      if (retryCount >= MAX_RATE_LIMIT_RETRIES) {
        console.warn(`[LLMGateway] 限流重试已达上限(${MAX_RATE_LIMIT_RETRIES}次)，降级到规则模板`);
        this.stats.fallbackUsed++;
        return this._ruleTemplateFallback(options.agentType, prompt, options.context);
      }
      console.warn(`[LLMGateway] 触发限流，指数退避重试 ${retryCount + 1}/${MAX_RATE_LIMIT_RETRIES}`);
      await this._exponentialBackoff(retryCount + 1);
      return this.call(prompt, options, retryCount + 1);
      
    } else {
      this.stats.errors++;
      console.error('[LLMGateway] LLM错误:', err.message);
      
      // 非超时错误也尝试规则兜底
      return this._ruleTemplateFallback(options.agentType, prompt, options.context);
    }
  }
  
  /**
   * 规则模板兜底（无需LLM）
   */
  _ruleTemplateFallback(agentType, prompt, context = {}) {
    console.log(`[LLMGateway] 规则模板兜底: ${agentType}`);

    // 【P0-6-审计修复】从 context 动态提取世界设定，不硬编码医院场景
    const worldDesc = context?.worldSetting?.description || context?.worldSetting?.name || '真实物理环境';
    const atmosphere = context?.worldSetting?.atmosphere || '';
    const charName = context?.character?.name || context?.character || '主角';
    const sceneType = context?.sceneType || 'establishing';

    const typeDesc = {
      opening: '史诗开场空间，宏大视角',
      establishing: '核心叙事空间，环境展示',
      conflict: '紧张对峙地带，戏剧张力',
      action: '激烈动作场地，高速动态',
      emotional_climax: '情感高潮场景，张力爆发',
      resolution: '平静收尾空间，余韵悠长',
    }[sceneType] || '叙事场景';

    const sceneBase = `${worldDesc}，${typeDesc}${atmosphere ? '，' + atmosphere : ''}`;

    const templates = {
      'scene-design': {
        scene: sceneBase,
        lighting: '主光：自然光源 5600K 柔光漫射；补光：反光板填充阴影；背景光：轮廓光分离层次；整体明亮清晰',
        props: '场景中必要的写实道具，材质真实，无文字标识',
        mood: 'calm, professional, natural',
        action: `${charName}自然站立或行走，手部自然动作，眼神交流，真实肢体语言`,
      },
      'visual-language': {
        composition: '景别：中景；主体：黄金分割点；纵深层次感；适度留白',
        colorPalette: '主色调：自然偏暖；辅助色：环境本色；肤色自然；饱和度中等；对比度中高',
        depthOfField: '焦点：主体面部；景深中等f/4；背景适度虚化；前景-中景-背景三层分离',
      },
      'prompt-fusion': {
        merged: `基于「${sceneBase}」生成的导演分镜提示词`,
        quality: 'standard',
      },
      'audio-design': {
        audio: '环境音效：自然环境底噪；音乐风格：氛围配乐；音量层级：环境音60%音乐40%',
      },
      'opening-design': {
        mainTitleContent: context?.title || '主题标题',
        subtitleContent: '',
        titleAnimationDesign: '简洁文字动画，淡入淡出',
        titleFontDesign: '无衬线字体，白色，清晰度优先',
        openingAudioDesign: '庄重氛围音乐，渐入',
      },
    };

    return templates[agentType] || { error: '无可用模板', fallback: true, scene: sceneBase };
  }
  
  /**
   * 熔断器检查
   * 【P1-D4 修复】使用首次失败时间进行恢复倒计时，防止lastFailureTime持续更新导致无法恢复
   */
  _isCircuitOpen() {
    const cb = this.circuitBreaker;
    
    if (cb.state === 'OPEN') {
      // 【P1-D4 修复】使用firstFailureTime进行恢复倒计时（不是lastFailureTime）
      const timeSinceFirstFailure = Date.now() - (cb.firstFailureTime || cb.lastFailureTime || 0);
      
      if (timeSinceFirstFailure > cb.recoveryTimeout) {
        cb.state = 'HALF_OPEN';
        cb.consecutiveSuccesses = 0;
        console.log('[LLMGateway] 熔断器进入半开状态，尝试恢复');
        return false;
      }
      return true;
    }
    return false;
  }
  
  /**
   * 【P1-D4 修复】记录成功 - HALF_OPEN状态需要连续N次成功才关闭
   */
  _recordSuccess() {
    const cb = this.circuitBreaker;
    cb.consecutiveFailures = 0;
    
    if (cb.state === 'HALF_OPEN') {
      cb.consecutiveSuccesses = (cb.consecutiveSuccesses || 0) + 1;
      // 需要连续3次成功才关闭（渐进恢复）
      const halfOpenMaxCalls = cb.halfOpenMaxCalls || 3;
      if (cb.consecutiveSuccesses >= halfOpenMaxCalls) {
        cb.state = 'CLOSED';
        cb.consecutiveSuccesses = 0;
        cb.firstFailureTime = null;
        console.log(`[LLMGateway] 熔断器关闭，连续${halfOpenMaxCalls}次探测成功`);
      }
    }
  }
  
  /**
   * 【P1-D4 修复】记录失败 - 只在首次失败时记录firstFailureTime
   */
  _recordFailure() {
    const cb = this.circuitBreaker;
    cb.consecutiveFailures++;
    cb.lastFailureTime = Date.now();
    
    // 【P1-D4 修复】只在首次失败时记录firstFailureTime
    if (!cb.firstFailureTime) {
      cb.firstFailureTime = cb.lastFailureTime;
    }
    
    if (cb.state === 'HALF_OPEN') {
      // 半开状态下1次失败就回到OPEN（保守策略）
      cb.state = 'OPEN';
      cb.consecutiveSuccesses = 0;
      console.warn('[LLMGateway] 半开探测失败，熔断器重新开启');
    } else if (cb.consecutiveFailures >= cb.failureThreshold) {
      cb.state = 'OPEN';
      cb.firstFailureTime = Date.now();
      console.error(`[LLMGateway] 熔断器开启！连续失败${cb.consecutiveFailures}次`);
    }
  }
  
  /**
   * 【P1-D5 修复】使用O(1)环形缓冲区替代shift()，避免高频O(n)阻塞
   */
  _recordLatency(latency) {
    if (!this._latencyRing) {
      this._latencyRing = {
        buffer: new Array(100),
        head: 0,
        count: 0,
        sum: 0
      };
    }
    
    const ring = this._latencyRing;
    if (ring.count === 100) {
      // 覆盖最旧的元素
      ring.sum -= ring.buffer[ring.head];
      ring.sum += latency;
      ring.buffer[ring.head] = latency;
      ring.head = (ring.head + 1) % 100;
    } else {
      ring.sum += latency;
      ring.buffer[ring.head] = latency;
      ring.head = (ring.head + 1) % 100;
      ring.count++;
    }
    
    this.stats.avgLatency = ring.count > 0 ? Math.floor(ring.sum / ring.count) : 0;
  }
  
  /**
   * 【P2-D7 修复】统一指数退避策略：使用位运算替代Math.pow，避免精度漂移
   * 公式：delay = baseMs * 2^(attempt-1)，上限maxMs
   */
  _exponentialBackoff(attempt) {
    if (!Number.isInteger(attempt) || attempt < 1) {
      console.warn(`[LLMGateway] attempt=${attempt}无效，使用默认退避`);
      attempt = 1;
    }
    if (attempt > 30) {
      console.warn(`[LLMGateway] attempt=${attempt}过大，退避可能不精确`);
      return new Promise(resolve => setTimeout(resolve, 30000));
    }
    const baseMs = 1000;
    const maxMs = 30000;
    // 使用位运算：1 << (attempt-1) 等效于 2^(attempt-1)，精度更好
    const delay = Math.min(baseMs * (1 << (attempt - 1)), maxMs);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.stats.totalCalls;
    return {
      totalCalls: total,
      cacheHits: this.stats.cacheHits,
      cacheHitRate: total > 0 ? (this.stats.cacheHits / total * 100).toFixed(1) + '%' : '0%',
      timeouts: this.stats.timeouts,
      errors: this.stats.errors,
      fallbackUsed: this.stats.fallbackUsed,
      avgLatency: this.stats.avgLatency,
      circuitBreaker: this.circuitBreaker.state,
      cache: this.cache.stats()
    };
  }
  
  /**
   * 预热缓存（加载常用模板）
   */
  async warmup() {
    console.log('[LLMGateway] 缓存预热...');
    // 可预加载常用场景的LLM结果
  }
}

module.exports = { LLMGateway };
