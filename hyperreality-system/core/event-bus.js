// event-bus.js
// 轻量事件总线 v1.1.0 (P1-ARCH-03修复)
// 内存版发布-订阅，后期可替换为Redis Stream
// 日期: 2026-06-26

// 【P1-ARCH-03 修复】EventBus错误传播 + 内存泄漏防护
class EventBus {
  constructor() {
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistory = 1000;
    this._cleanupBatch = 100;
    this._errorHandlers = new Map(); // eventType -> handler 错误处理器
  }
  
  /**
   * 注册错误处理器（P1-ARCH-03修复：允许调用方感知handler错误）
   */
  onError(eventType, errorHandler) {
    this._errorHandlers.set(eventType, errorHandler);
  }
  
  /**
   * 移除错误处理器
   */
  offError(eventType) {
    this._errorHandlers.delete(eventType);
  }
  
  subscribe(eventType, handler, options = {}) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    
    const subscribers = this.subscribers.get(eventType);
    const subscription = {
      handler,
      once: options.once || false,
      priority: options.priority || 10,
      _id: Math.random().toString(36).substr(2, 9)
    };
    subscribers.push(subscription);
    subscribers.sort((a, b) => a.priority - b.priority);
    
    // 【P1-ARCH-03 修复】返回unsubscribe时清理handler引用
    return () => this.unsubscribe(eventType, handler);
  }
  
  unsubscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) return;
    
    const subscribers = this.subscribers.get(eventType);
    const idx = subscribers.findIndex(s => s.handler === handler);
    if (idx !== -1) {
      subscribers.splice(idx, 1);
    }
    
    // 【P1-ARCH-03 修复】如果该事件类型无订阅者，清理Map条目
    if (subscribers.length === 0) {
      this.subscribers.delete(eventType);
    }
  }
  
  emit(eventType, payload = {}) {
    const event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      id: `${eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    this._appendHistory(event);
    
    const handlerErrors = []; // 【P1-ARCH-03 修复】收集handler错误
    
    if (this.subscribers.has(eventType)) {
      const subscribers = this.subscribers.get(eventType);
      const toRemove = [];
      
      for (const subscriber of subscribers) {
        try {
          subscriber.handler(payload, event);
          
          if (subscriber.once) {
            toRemove.push(subscriber);
          }
        } catch (err) {
          // 【P1-ARCH-03 修复】收集错误，不吞没
          handlerErrors.push({ 
            subscriber: subscriber.handler.name || 'anonymous', 
            error: err.message 
          });
          console.error(`[EventBus] 事件处理失败: ${eventType} - ${err.message}`);
          
          // 如果有注册的错误处理器，调用它
          const errorHandler = this._errorHandlers.get(eventType);
          if (errorHandler) {
            try { errorHandler(err, event, subscriber); } catch (_) {}
          }
        }
      }
      
      for (const subscriber of toRemove) {
        const idx = subscribers.indexOf(subscriber);
        if (idx !== -1) subscribers.splice(idx, 1);
      }
    }
    
    // 通配符订阅
    if (this.subscribers.has('*')) {
      for (const subscriber of this.subscribers.get('*')) {
        try {
          subscriber.handler(eventType, payload, event);
        } catch (err) {
          handlerErrors.push({ subscriber: subscriber.handler.name || 'anonymous', error: err.message });
          console.error(`[EventBus] 通配符处理失败: ${eventType} - ${err.message}`);
        }
      }
    }
    
    // 【P1-ARCH-03 修复】如果有handler错误且未注册错误处理器，抛出聚合错误
    if (handlerErrors.length > 0 && !this._errorHandlers.has(eventType)) {
      const aggregateError = new Error(
        `EventBus: ${eventType} 有${handlerErrors.length}个handler失败: ` +
        handlerErrors.map(e => `${e.subscriber}(${e.error})`).join(', ')
      );
      aggregateError.eventType = eventType;
      aggregateError.handlerErrors = handlerErrors;
      aggregateError.event = event;
      throw aggregateError;
    }
    
    return event;
  }
  
  /**
   * 一次性订阅
   */
  once(eventType, handler) {
    return this.subscribe(eventType, handler, { once: true });
  }
  
  /**
   * 等待某个事件（Promise封装）
   * 【P1-ARCH-03 修复】防止timer泄漏和重复resolve/reject
   */
  waitFor(eventType, timeout = 30000, filter = null) {
    return new Promise((resolve, reject) => {
      let timer = null;
      let settled = false; // 防重复resolve/reject
      
      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (!settled) {
          this.unsubscribe(eventType, handler);
        }
      };
      
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`等待事件 ${eventType} 超时: ${timeout}ms`));
      }, timeout);
      
      const handler = (payload, event) => {
        if (settled) return; // 已settled则忽略
        if (filter && !filter(payload)) return;
        
        settled = true;
        cleanup();
        resolve(payload);
      };
      
      this.subscribe(eventType, handler);
    });
  }
  
  /**
   * 追加事件到历史日志
   * 【P0-2 修复】批量清理，避免频繁shift
   */
  _appendHistory(event) {
    this.eventHistory.push(event);
    // 批量清理：超过阈值时一次性移除旧数据
    if (this.eventHistory.length > this.maxHistory + this._cleanupBatch) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }
  }
  
  /**
   * 获取事件历史
   * @param {string} eventType - 事件类型过滤
   * @param {number} limit - 最大条数
   */
  getHistory(eventType = null, limit = 100) {
    let events = this.eventHistory;
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }
    return events.slice(-limit);
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const stats = {};
    for (const [eventType, subscribers] of this.subscribers) {
      stats[eventType] = subscribers.length;
    }
    return {
      subscriberTypes: Object.keys(stats).length,
      subscriberCounts: stats,
      totalEvents: this.eventHistory.length
    };
  }
  
  /**
   * 清空历史
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

module.exports = { EventBus };
