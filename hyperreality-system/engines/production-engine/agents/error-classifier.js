/**
 * error-classifier.js - LLM 错误智能分类器
 * 根据错误类型选择最优重试策略
 */

class ErrorClassifier {
  // 【P2-QUAL-02 修复】为错误分类添加上下文信息
  static classify(error, context = {}) {
    if (!error) return { type: 'UNKNOWN', retryable: true, strategy: 'default', context };
    
    const message = (error.message || error.toString()).toLowerCase();
    const baseResult = { context };
    
    // 1. 鉴权/配置错误 → 不可重试，直接熔断
    if (message.includes('auth') || 
        message.includes('unauthorized') ||
        message.includes('invalid key') ||
        message.includes('api key') ||
        message.includes('forbidden') ||
        message.includes('401') ||
        message.includes('403')) {
      return { 
        ...baseResult,
        type: 'AUTH', 
        retryable: false, 
        strategy: 'circuit-break',
        message: '鉴权失败，请检查 API Key 配置'
      };
    }
    
    // 2. 参数错误 → 不可重试，需人工修复
    if (message.includes('bad request') ||
        message.includes('invalid') ||
        message.includes('parameter') ||
        message.includes('400') ||
        message.includes('schema')) {
      return { 
        ...baseResult,
        type: 'PARAM', 
        retryable: false, 
        strategy: 'stop',
        message: '参数/schema 错误，需检查配置'
      };
    }
    
    // 3. 限流错误 → 指数退避
    if (message.includes('rate limit') ||
        message.includes('too many request') ||
        message.includes('429') ||
        message.includes('throttle') ||
        message.includes('quota')) {
      return { 
        ...baseResult,
        type: 'RATE_LIMIT', 
        retryable: true, 
        strategy: 'exponential-backoff',
        backoffMs: 2000, // 起始退避时间
        message: 'API 限流，指数退避重试'
      };
    }
    
    // 【P1-QUAL-01 修复】JSON解析超时优先判定为PARSE而非TIMEOUT
    // 必须先于通用TIMEOUT检查，避免"JSON parsing timeout"被误判
    if (message.includes('json') && (message.includes('timeout') || message.includes('timed out'))) {
      return {
        ...baseResult,
        type: 'PARSE',
        retryable: true,
        strategy: 'shrink-prompt',
        shrinkRatio: 0.7,
        message: 'JSON解析超时，缩短prompt重试'
      };
    }
    
    // 4. 网络超时 → 渐进式超时
    if (message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('etimedout') ||
        message.includes('abort') ||
        message.includes('socket hang up')) {
      return { 
        ...baseResult,
        type: 'TIMEOUT', 
        retryable: true, 
        strategy: 'progressive-timeout',
        timeoutMultiplier: 1.5, // 超时时间 ×1.5
        message: '网络超时，渐进式延长超时时间'
      };
    }
    
    // 5. JSON 解析错误 → 缩短 prompt 重试
    if (message.includes('json') ||
        message.includes('parse') ||
        message.includes('syntax') ||
        message.includes('unexpected token')) {
      return { 
        type: 'PARSE', 
        retryable: true, 
        strategy: 'shrink-prompt',
        shrinkRatio: 0.7, // 缩短到 70%
        message: 'JSON 解析失败，缩短 prompt 重试'
      };
    }
    
    // 6. 网络连接错误 → 立即重试
    if (message.includes('network') ||
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        message.includes('dns') ||
        message.includes('connect')) {
      return { 
        type: 'NETWORK', 
        retryable: true, 
        strategy: 'immediate',
        message: '网络错误，立即重试'
      };
    }
    
    // 7. 服务端错误 (5xx) → 渐进式重试
    // 【P2-QUAL-03 修复】完整HTTP状态码映射：500/502/503/504/507/508/520/521/522/523/524/525/526/527/530/598/599
    if (message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504') ||
        message.includes('507') ||
        message.includes('508') ||
        message.includes('520') ||
        message.includes('521') ||
        message.includes('522') ||
        message.includes('523') ||
        message.includes('524') ||
        message.includes('525') ||
        message.includes('526') ||
        message.includes('527') ||
        message.includes('530') ||
        message.includes('598') ||
        message.includes('599') ||
        message.includes('internal error') ||
        message.includes('server error') ||
        message.includes('bad gateway') ||
        message.includes('service unavailable') ||
        message.includes('gateway timeout')) {
      return { 
        type: 'SERVER', 
        retryable: true, 
        strategy: 'progressive-backoff',
        backoffMs: 3000, // 起始退避
        message: '服务端错误，渐进式重试'
      };
    }
    
    // 默认：未知错误，保守重试
    return { 
      type: 'UNKNOWN', 
      retryable: true, 
      strategy: 'default',
      message: '未知错误，默认重试策略'
    };
  }
  
  /**
   * 计算下次重试的超时时间
   */
  static calculateTimeout(baseTimeout, attempt, classification) {
    switch (classification.strategy) {
      case 'progressive-timeout':
        // 渐进式：60→120→180→240→300s
        return Math.min(300000, baseTimeout * Math.pow(classification.timeoutMultiplier || 1.5, attempt - 1));
      case 'exponential-backoff':
        // 指数退避：2^attempt × 起始退避
        return Math.min(300000, baseTimeout + (classification.backoffMs || 2000) * Math.pow(2, attempt - 1));
      case 'immediate':
        return baseTimeout;
      case 'shrink-prompt':
        return baseTimeout;
      default:
        return Math.min(300000, baseTimeout * 1.2);
    }
  }
  
  /**
   * 计算下次重试的等待时间（重试前停顿）
   */
  static calculateDelay(attempt, classification) {
    switch (classification.strategy) {
      case 'exponential-backoff':
        return Math.min(30000, (classification.backoffMs || 2000) * Math.pow(2, attempt - 1));
      case 'progressive-backoff':
        return Math.min(30000, (classification.backoffMs || 3000) * attempt);
      case 'immediate':
        return 0;
      case 'shrink-prompt':
        return 500; // 短暂停顿
      default:
        return Math.min(10000, 1000 * attempt);
    }
  }
  
  /**
   * 是否需要缩短 prompt
   */
  static shouldShrinkPrompt(classification) {
    return classification.strategy === 'shrink-prompt';
  }
  
  /**
   * 缩短 prompt
   */
  static shrinkPrompt(prompt, ratio) {
    const targetLen = Math.floor(prompt.length * (ratio || 0.7));
    // 保留 system prompt 部分，缩短示例部分
    const systemEnd = prompt.indexOf('【目标JSON结构示例】');
    if (systemEnd > 0) {
      // 保留 system prompt，缩短示例
      return prompt.substring(0, systemEnd) + '\n[输出结构见schema]\n}';
    }
    // 简单粗暴：截断
    return prompt.substring(0, targetLen);
  }
}

module.exports = { ErrorClassifier };
