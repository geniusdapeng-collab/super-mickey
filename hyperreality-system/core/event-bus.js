// event-bus.js
// 轻量事件总线 v1.0.0
// 内存版发布-订阅，后期可替换为Redis Stream
// 日期: 2026-06-26

class EventBus {
  constructor() {
    this.subscribers = new Map();
    this.eventHistory = []; // 事件溯源日志
    this.maxHistory = 10000; // 最多保留10000条
  }
  
  /**
   * 订阅事件
   * @param {string} eventType - 事件类型
   * @param {Function} handler - 处理函数
   * @param {object} options - 选项
   *   - once: 是否只触发一次
   *   - priority: 优先级（数字越小越优先）
   */
  subscribe(eventType, handler, options = {}) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    
    const subscribers = this.subscribers.get(eventType);
    subscribers.push({
      handler,
      once: options.once || false,
      priority: options.priority || 10
    });
    
    // 按优先级排序
    subscribers.sort((a, b) => a.priority - b.priority);
    
    return () => this.unsubscribe(eventType, handler); // 返回取消订阅函数
  }
  
  /**
   * 取消订阅
   */
  unsubscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) return;
    
    const subscribers = this.subscribers.get(eventType);
    const idx = subscribers.findIndex(s => s.handler === handler);
    if (idx !== -1) {
      subscribers.splice(idx, 1);
    }
  }
  
  /**
   * 发布事件
   * @param {string} eventType - 事件类型
   * @param {object} payload - 事件数据
   */
  emit(eventType, payload = {}) {
    const event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      id: `${eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    // 持久化到事件日志
    this._appendHistory(event);
    
    // 广播给订阅者
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
          console.error(`[EventBus] 事件处理失败: ${eventType} - ${err.message}`);
        }
      }
      
      // 移除一次性订阅
      for (const subscriber of toRemove) {
        const idx = subscribers.indexOf(subscriber);
        if (idx !== -1) subscribers.splice(idx, 1);
      }
    }
    
    // 同时触发通配符订阅
    if (this.subscribers.has('*')) {
      for (const subscriber of this.subscribers.get('*')) {
        try {
          subscriber.handler(eventType, payload, event);
        } catch (err) {
          console.error(`[EventBus] 通配符处理失败: ${eventType} - ${err.message}`);
        }
      }
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
   * @param {string} eventType - 事件类型
   * @param {number} timeout - 超时毫秒
   * @param {Function} filter - 过滤函数
   */
  waitFor(eventType, timeout = 30000, filter = null) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.unsubscribe(eventType, handler);
        reject(new Error(`等待事件 ${eventType} 超时: ${timeout}ms`));
      }, timeout);
      
      const handler = (payload, event) => {
        if (filter && !filter(payload)) return;
        
        clearTimeout(timer);
        this.unsubscribe(eventType, handler);
        resolve(payload);
      };
      
      this.subscribe(eventType, handler);
    });
  }
  
  /**
   * 追加事件到历史日志
   */
  _appendHistory(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift(); // 移除最旧的
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
