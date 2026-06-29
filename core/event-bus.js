/**
 * Nirath Event Bus v2.0 — 完整事件总线
 *
 * 在 v1.0 (event-bus-pilot.js) 基础上扩展：
 * - Mutations追踪：记录字段变更历史
 * - 事件回放：支持按时间/Stage过滤回放
 * - 更完善的错误边界
 * - 全Stage生命周期事件支持（17个Stage）
 * - 向后兼容 v1.0 API
 *
 * 设计原则：
 * 1. 基于 Node.js 原生 EventEmitter，零外部依赖
 * 2. 支持双模式：直接调用（现有）+ 事件驱动（新增）
 * 3. 事件 Schema：{ type, payload, mutations, metadata }
 * 4. 订阅者可选择同步/异步处理
 *
 * @version v2.0
 * @author Core Team
 * @priority P0 - 架构基础
 */

'use strict';

const EventEmitter = require('events');

// ============================================================
// 一、事件定义（全Stage生命周期）
// ============================================================

const EVENT_DEFINITIONS = {
  // Pipeline 生命周期
  'pipeline.started': {
    description: 'Pipeline开始执行',
    requiredFields: ['traceId', 'stageCount']
  },
  'pipeline.milestone': {
    description: 'Pipeline达到里程碑',
    requiredFields: ['phase', 'stage', 'progressPercent']
  },
  'pipeline.completed': {
    description: 'Pipeline成功完成',
    requiredFields: ['traceId', 'completedCount']
  },
  'pipeline.failed': {
    description: 'Pipeline失败',
    requiredFields: ['traceId', 'failedAt', 'error']
  },

  // Stage 生命周期
  'stage.started': {
    description: 'Stage开始执行',
    requiredFields: ['stageId', 'traceId']
  },
  'stage.completed': {
    description: 'Stage成功完成',
    requiredFields: ['stageId', 'traceId', 'status']
  },
  'stage.failed': {
    description: 'Stage失败',
    requiredFields: ['stageId', 'traceId', 'error']
  },
  'stage.skipped': {
    description: 'Stage被跳过（非阻塞）',
    requiredFields: ['stageId', 'traceId', 'reason']
  },
  'stage.compensated': {
    description: 'Stage补偿事务已执行',
    requiredFields: ['stageId', 'traceId']
  },

  // LLM 调用事件
  'llm.call.success': {
    description: 'LLM调用成功',
    requiredFields: ['provider', 'durationMs']
  },
  'llm.call.failed': {
    description: 'LLM调用失败',
    requiredFields: ['provider', 'error']
  },

  // 数据变更事件
  'data.mutated': {
    description: '数据字段被修改',
    requiredFields: ['stageId', 'field', 'previousHash', 'newHash']
  },
  'data.validated': {
    description: '数据验证完成',
    requiredFields: ['stageId', 'valid', 'errors']
  },

  // 试点保留事件（v1.0兼容）
  'storyboard.protagonist.enhanced': {
    description: 'Stage 7.2 主角主动性注入完成',
    requiredFields: ['storyboard', 'report']
  },
  'storyboard.narration.trimmed': {
    description: 'Stage 7.3 口播精简完成',
    requiredFields: ['storyboard', 'report']
  }
};

// ============================================================
// 二、Mutations 追踪器
// ============================================================

class MutationTracker {
  constructor() {
    this.mutations = new Map(); // traceId -> Array<mutation>
  }

  /**
   * 记录字段变更
   */
  record(traceId, { stageId, shotId, field, previousValue, newValue }) {
    const mutation = {
      timestamp: Date.now(),
      stageId,
      shotId,
      field,
      previousHash: this.hashValue(previousValue),
      newHash: this.hashValue(newValue),
      sizeDelta: this.calculateSizeDelta(previousValue, newValue)
    };

    if (!this.mutations.has(traceId)) {
      this.mutations.set(traceId, []);
    }
    this.mutations.get(traceId).push(mutation);

    return mutation;
  }

  /**
   * 获取变更历史
   */
  getHistory(traceId, filters = {}) {
    const all = this.mutations.get(traceId) || [];

    if (filters.stageId) {
      return all.filter(m => m.stageId === filters.stageId);
    }
    if (filters.shotId) {
      return all.filter(m => m.shotId === filters.shotId);
    }
    if (filters.field) {
      return all.filter(m => m.field === filters.field);
    }

    return all;
  }

  /**
   * 检测异常变更
   */
  detectAnomalies(traceId, expectedStagesPerField = {}) {
    const anomalies = [];
    const history = this.mutations.get(traceId) || [];

    for (const mutation of history) {
      const expectedStages = expectedStagesPerField[mutation.field] || [];
      if (expectedStages.length > 0 && !expectedStages.includes(mutation.stageId)) {
        anomalies.push({
          ...mutation,
          expectedStages,
          severity: 'warning'
        });
      }
    }

    return anomalies;
  }

  hashValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
      return value.length > 50 ? `str_${value.length}_${value.substring(0, 20)}...` : `str_${value}`;
    }
    return `obj_${JSON.stringify(value).length}`;
  }

  calculateSizeDelta(prev, next) {
    const prevSize = prev ? JSON.stringify(prev).length : 0;
    const nextSize = next ? JSON.stringify(next).length : 0;
    return nextSize - prevSize;
  }

  clear(traceId) {
    this.mutations.delete(traceId);
  }
}

// ============================================================
// 三、事件总线 v2.0
// ============================================================

class NirathEventBusV2 extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || 'nirath-bus-v2';
    this.enabled = options.enabled !== false;
    this.debug = options.debug || false;
    this.maxListeners = options.maxListeners || 100;
    this.setMaxListeners(this.maxListeners);

    // 事件日志（循环缓冲区）
    this.eventLog = [];
    this.maxLogSize = options.maxLogSize || 10000;

    // Mutations追踪
    this.mutationTracker = new MutationTracker();

    // 订阅者统计
    this.subscriberStats = {};

    // 内部错误日志
    this.errorLog = [];
    this.maxErrorLogSize = 1000;

    if (!this.enabled) {
      console.log(`[EventBusV2:${this.name}] 已禁用`);
    } else {
      console.log(`[EventBusV2:${this.name}] 初始化完成 | mutations追踪:启用 | 最大日志:${this.maxLogSize}`);
    }
  }

  /**
   * 发布事件（v2.0增强版）
   */
  publish(eventType, payload, metadata = {}) {
    if (!this.enabled) return;

    const eventDef = EVENT_DEFINITIONS[eventType];
    if (!eventDef) {
      console.warn(`[EventBusV2] 未知事件类型: ${eventType}`);
    }

    // 基础验证
    if (eventDef && eventDef.requiredFields) {
      for (const field of eventDef.requiredFields) {
        if (payload[field] === undefined || payload[field] === null) {
          console.warn(`[EventBusV2] 事件 ${eventType} 缺少必填字段: ${field}`);
        }
      }
    }

    // 构建完整事件
    const event = {
      type: eventType,
      payload: metadata.clonePayload ? this.deepClone(payload) : payload,
      mutations: metadata.mutations || [],  // v2.0: 携带变更记录
      metadata: {
        timestamp: Date.now(),
        busName: this.name,
        traceId: metadata.traceId || payload.traceId || `evt_${Date.now()}`,
        ...metadata
      }
    };

    // 记录到日志
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    if (this.debug) {
      console.log(`[EventBusV2] 📤 发布 ${eventType}`,
        Object.keys(payload).map(k => `${k}=${typeof payload[k]}`).join(', '));
    }

    // 发射事件（异步处理）
    this.emit(eventType, event);
  }

  /**
   * 订阅事件（v2.0增强版）
   */
  subscribe(eventType, handler, options = {}) {
    if (!this.enabled) return () => {};

    const subscriberId = `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (!this.subscriberStats[eventType]) {
      this.subscriberStats[eventType] = { subscribers: 0, invocations: 0, errors: 0 };
    }
    this.subscriberStats[eventType].subscribers++;

    const wrapper = async (event) => {
      try {
        this.subscriberStats[eventType].invocations++;

        if (this.debug) {
          console.log(`[EventBusV2] 📥 订阅者 ${subscriberId} 处理 ${eventType}`);
        }

        // 包装handler，传入完整事件（含mutations）
        if (options.async !== false) {
          await handler(event.payload, event.metadata, event.mutations);
        } else {
          handler(event.payload, event.metadata, event.mutations);
        }
      } catch (e) {
        this.subscriberStats[eventType].errors++;
        this.errorLog.push({
          timestamp: Date.now(),
          eventType,
          subscriberId,
          error: e.message
        });
        if (this.errorLog.length > this.maxErrorLogSize) {
          this.errorLog.shift();
        }

        console.error(`[EventBusV2] 订阅者 ${subscriberId} 处理 ${eventType} 异常:`, e.message);
        if (options.throwErrors) throw e;
      }
    };

    if (options.once) {
      this.once(eventType, wrapper);
    } else {
      this.on(eventType, wrapper);
    }

    return () => {
      this.off(eventType, wrapper);
      this.subscriberStats[eventType].subscribers--;
    };
  }

  /**
   * 等待事件（Promise包装）
   */
  waitFor(eventType, timeoutMs = 5000) {
    if (!this.enabled) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventType, handler);
        reject(new Error(`等待事件 ${eventType} 超时 ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (event) => {
        clearTimeout(timer);
        resolve(event);
      };

      this.once(eventType, handler);
    });
  }

  // ============================================================
  // 事件回放（v2.0新功能）
  // ============================================================

  /**
   * 按条件过滤事件日志
   */
  getEventLog(filters = {}) {
    let filtered = [...this.eventLog];

    if (filters.eventType) {
      filtered = filtered.filter(e => e.type === filters.eventType);
    }
    if (filters.traceId) {
      filtered = filtered.filter(e => e.metadata.traceId === filters.traceId);
    }
    if (filters.stageId) {
      filtered = filtered.filter(e => e.metadata.stageId === filters.stageId);
    }
    if (filters.since) {
      filtered = filtered.filter(e => e.metadata.timestamp >= filters.since);
    }
    if (filters.until) {
      filtered = filtered.filter(e => e.metadata.timestamp <= filters.until);
    }

    return filtered;
  }

  /**
   * 回放特定Trace的所有事件
   */
  replayTrace(traceId, options = {}) {
    const events = this.getEventLog({ traceId });
    console.log(`[EventBusV2] 🔁 回放 trace=${traceId} | ${events.length}个事件`);

    for (const event of events) {
      if (options.skipTypes && options.skipTypes.includes(event.type)) continue;
      this.emit(event.type, event);
    }

    return events.length;
  }

  /**
   * 回放特定Stage的输入事件
   */
  replayForStage(stageId, eventTypes = []) {
    const relevant = this.eventLog.filter(e =>
      eventTypes.includes(e.type) &&
      e.metadata.sourceStage !== stageId
    );

    console.log(`[EventBusV2] 🔁 回放 Stage=${stageId} | ${relevant.length}个相关事件`);

    for (const event of relevant) {
      this.emit(event.type, event);
    }

    return relevant.length;
  }

  // ============================================================
  // Mutations 追踪（v2.0新功能）
  // ============================================================

  /**
   * 记录数据变更
   */
  recordMutation(traceId, mutation) {
    return this.mutationTracker.record(traceId, mutation);
  }

  /**
   * 获取变更历史
   */
  getMutations(traceId, filters) {
    return this.mutationTracker.getHistory(traceId, filters);
  }

  /**
   * 检测异常变更
   */
  detectMutationAnomalies(traceId, expectedStagesPerField) {
    return this.mutationTracker.detectAnomalies(traceId, expectedStagesPerField);
  }

  // ============================================================
  // 统计与报告
  // ============================================================

  getSubscriberStats() {
    return { ...this.subscriberStats };
  }

  getErrorLog(limit = 50) {
    return this.errorLog.slice(-limit);
  }

  getReport() {
    return {
      name: this.name,
      enabled: this.enabled,
      totalEvents: this.eventLog.length,
      totalErrors: this.errorLog.length,
      subscriberStats: this.getSubscriberStats(),
      mutationCount: Array.from(this.mutationTracker.mutations.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  // ============================================================
  // 工具方法
  // ============================================================

  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    const cloned = {};
    for (const key of Object.keys(obj)) {
      cloned[key] = this.deepClone(obj[key]);
    }
    return cloned;
  }

  clear() {
    this.eventLog = [];
    this.errorLog = [];
    this.mutationTracker = new MutationTracker();
    console.log(`[EventBusV2:${this.name}] 已清空所有日志`);
  }
}

// ============================================================
// 四、v1.0 兼容包装器
// ============================================================

class NirathEventBusV1Compat extends NirathEventBusV2 {
  constructor(options = {}) {
    super({ ...options, name: options.name || 'nirath-compat' });
  }

  // v1.0 API 兼容：publish(payload, metadata) -> 内部调用 v2.0 publish
  publishCompat(eventType, payload, metadata = {}) {
    return this.publish(eventType, payload, metadata);
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  NirathEventBusV2,
  NirathEventBusV1Compat,
  MutationTracker,
  EVENT_DEFINITIONS,

  // 默认导出 v2.0（新代码使用）
  NirathEventBus: NirathEventBusV2,

  // 单例获取
  getEventBus: (options) => new NirathEventBusV2(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Event Bus V2.0 集成测试 ===\n');

    const bus = new NirathEventBusV2({ name: 'test-bus', debug: true });

    // 测试1：基本发布/订阅
    console.log('--- 测试1：基本发布/订阅 ---');
    let received = null;
    const unsub = bus.subscribe('test.event', (payload, metadata) => {
      received = payload;
      console.log('收到:', payload.message);
    });

    bus.publish('test.event', { message: 'Hello V2.0' }, { stageId: 'TEST' });
    await new Promise(r => setTimeout(r, 100));
    console.log('接收成功:', received?.message === 'Hello V2.0');
    unsub();

    // 测试2：Mutations追踪
    console.log('\n--- 测试2：Mutations追踪 ---');
    bus.recordMutation('trace-123', {
      stageId: 'STAGE-5',
      shotId: 'S01',
      field: 'visualPrompt',
      previousValue: 'old prompt',
      newValue: 'new prompt with more details'
    });
    const mutations = bus.getMutations('trace-123');
    console.log('Mutations记录:', mutations.length);
    console.log('字段:', mutations[0].field);
    console.log('SizeDelta:', mutations[0].sizeDelta);

    // 测试3：事件回放
    console.log('\n--- 测试3：事件回放 ---');
    bus.publish('stage.completed', { stageId: 'STAGE-1' }, { traceId: 'replay-test' });
    bus.publish('stage.completed', { stageId: 'STAGE-2' }, { traceId: 'replay-test' });
    bus.publish('stage.failed', { stageId: 'STAGE-3' }, { traceId: 'other-trace' });

    const replayCount = bus.replayTrace('replay-test');
    console.log('回放事件数:', replayCount);

    // 测试4：统计报告
    console.log('\n--- 测试4：统计报告 ---');
    const report = bus.getReport();
    console.log('总事件:', report.totalEvents);
    console.log('总错误:', report.totalErrors);
    console.log('Mutations:', report.mutationCount);

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
