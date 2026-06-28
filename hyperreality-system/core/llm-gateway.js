// llm-gateway.js
// LLM统一网关 v1.0.0
// 熔断、限流、缓存、多模型负载均衡
// 日期: 2026-06-26

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 简单内存缓存（生产环境可替换为Redis）
class SimpleCache {
  constructor() {
    this.store = new Map();
    this.maxSize = 1000; // 最多缓存1000条
  }
  
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  
  set(key, value, ttlMs = 3600000) {
    if (this.store.size >= this.maxSize) {
      // LRU淘汰：删除最旧的
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
    return {
      size: this.store.size,
      maxSize: this.maxSize
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
   */
  _cacheKey(prompt, options) {
    const hash = crypto.createHash('md5');
    hash.update(prompt);
    hash.update(JSON.stringify(options.agentType || 'unknown'));
    hash.update(JSON.stringify(options.schema || {}));
    return `llm:${hash.digest('hex')}`;
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
   */
  async _executeWithTimeout(prompt, model, timeout, options) {
    if (!this.llmEngine) {
      throw new Error('LLM引擎未注入');
    }
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject({ type: 'TIMEOUT', message: `LLM调用超时: ${timeout}ms` });
      }, timeout);
      
      this.llmEngine.reasonStructured(prompt, options.schema || null, {
        model: model,
        ...options
      }).then(result => {
        clearTimeout(timer);
        resolve(result);
      }).catch(err => {
        clearTimeout(timer);
        reject({ type: 'LLM_ERROR', message: err.message, original: err });
      });
    });
  }
  
  /**
   * 错误处理与降级链
   */
  async _handleError(err, prompt, options, latency, retryCount = 0) {
    this._recordFailure();
    
    if (err.type === 'TIMEOUT') {
      this.stats.timeouts++;
      console.warn(`[LLMGateway] 超时(${latency}ms)，触发降级链`);
      
      // 降级链1：轻量模型
      if (!options.preferFast && this.models.fallback) {
        console.log('[LLMGateway] 降级到轻量模型:', this.models.fallback);
        try {
          const result = await this._executeWithTimeout(
            prompt, 
            this.models.fallback, 
            Math.floor((options.timeout || this.defaultTimeout) * 0.7),
            options
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
   */
  _isCircuitOpen() {
    const cb = this.circuitBreaker;
    
    if (cb.state === 'OPEN') {
      if (Date.now() - cb.lastFailureTime > cb.recoveryTimeout) {
        cb.state = 'HALF_OPEN';
        console.log('[LLMGateway] 熔断器进入半开状态，尝试恢复');
        return false;
      }
      return true;
    }
    return false;
  }
  
  _recordSuccess() {
    const cb = this.circuitBreaker;
    cb.consecutiveFailures = 0;
    if (cb.state === 'HALF_OPEN') {
      cb.state = 'CLOSED';
      console.log('[LLMGateway] 熔断器关闭，服务恢复');
    }
  }
  
  _recordFailure() {
    const cb = this.circuitBreaker;
    cb.consecutiveFailures++;
    cb.lastFailureTime = Date.now();
    
    if (cb.consecutiveFailures >= cb.failureThreshold) {
      cb.state = 'OPEN';
      console.error(`[LLMGateway] 熔断器开启！连续失败${cb.consecutiveFailures}次`);
    }
  }
  
  _recordLatency(latency) {
    this.stats.latencyHistory.push(latency);
    if (this.stats.latencyHistory.length > 100) {
      this.stats.latencyHistory.shift();
    }
    const sum = this.stats.latencyHistory.reduce((a, b) => a + b, 0);
    this.stats.avgLatency = Math.floor(sum / this.stats.latencyHistory.length);
  }
  
  _exponentialBackoff(attempt) {
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // 最大30秒
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
