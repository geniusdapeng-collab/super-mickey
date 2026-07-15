/**
 * LLM Batch Manager v1.0 — LLM批处理管理器
 * 系统核心基础设施：管理并发请求，防止"一次请求80个镜头→超时"
 *
 * 职责：
 * - Token Bucket并发控制：限制同时请求数（默认3个，适配火山引擎限制）
 * - 内存保护：防止内存泄漏（超出上限时拒绝请求）
 * - 优先级队列：紧急请求优先处理（如P0修复）
 * - 与LLM Gateway集成：统一入口
 * - 与Saga编排器集成：Stage请求自动进入队列
 *
 * 核心能力：
 * 1. Token Bucket算法：平滑限流，避免突发请求
 * 2. 内存监控：每个请求预估内存占用，总量控制
 * 3. 优先级调度：5级优先级（P0紧急→P4低优）
 * 4. 自适应并发：根据成功率动态调整并发数
 * 5. 失败隔离：单个请求失败不影响其他请求
 *
 * @version v1.0
 * @author Core Team
 * @priority P1 - 稳定性工程
 */

'use strict';

const { EventEmitter } = require('events');
const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、Token Bucket 限流器
// ============================================================

class TokenBucket {
  constructor(capacity, refillRate, options = {}) {
    this.capacity = capacity;         // 桶容量 = 最大并发数
    this.tokens = capacity;             // 当前可用令牌数
    this.refillRate = refillRate;       // 每秒补充令牌数
    this.lastRefill = Date.now();
    this.lock = Promise.resolve();      // 锁，确保原子操作
    this.stats = {
      totalRequests: 0,
      accepted: 0,
      rejected: 0,
      waitTimeMs: 0
    };
  }

  /**
   * 获取令牌（异步，如果没有令牌则等待）
   */
  async acquire(count = 1, timeoutMs = 30000) {
    const startMs = Date.now();
    this.stats.totalRequests++;

    while (true) {
      // 补充令牌
      this.refill();

      if (this.tokens >= count) {
        this.tokens -= count;
        this.stats.accepted++;
        this.stats.waitTimeMs += Date.now() - startMs;
        return { granted: true, waitMs: Date.now() - startMs };
      }

      if (Date.now() - startMs > timeoutMs) {
        this.stats.rejected++;
        return { granted: false, waitMs: Date.now() - startMs, reason: 'timeout' };
      }

      // 等待令牌补充
      const waitMs = Math.ceil((count - this.tokens) / this.refillRate * 1000);
      await this.sleep(Math.min(waitMs, 100));
    }
  }

  /**
   * 尝试获取（不等待，立即返回）
   */
  tryAcquire(count = 1) {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      this.stats.accepted++;
      return { granted: true };
    }
    this.stats.rejected++;
    return { granted: false, available: this.tokens };
  }

  /**
   * 释放令牌
   */
  release(count = 1) {
    this.tokens = Math.min(this.capacity, this.tokens + count);
  }

  /**
   * 补充令牌
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  getStats() {
    return {
      ...this.stats,
      currentTokens: this.tokens,
      capacity: this.capacity,
      rejectionRate: this.stats.totalRequests > 0 ? (this.stats.rejected / this.stats.totalRequests).toFixed(2) : 0
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 二、优先级队列
// ============================================================

class PriorityQueue {
  constructor() {
    this.queues = {
      P0: [],  // 紧急（如P0修复、熔断恢复）
      P1: [],  // 高优（如主链路Stage）
      P2: [],  // 中优（如导演优化）
      P3: [],  // 低优（如质量分析）
      P4: []   // 最低（如日志分析）
    };
    this.totalSize = 0;
  }

  enqueue(item, priority = 'P2') {
    const queue = this.queues[priority] || this.queues.P2;
    queue.push({ item, enqueueTime: Date.now() });
    this.totalSize++;
  }

  dequeue() {
    for (const level of ['P0', 'P1', 'P2', 'P3', 'P4']) {
      const queue = this.queues[level];
      if (queue.length > 0) {
        this.totalSize--;
        return queue.shift();
      }
    }
    return null;
  }

  peek() {
    for (const level of ['P0', 'P1', 'P2', 'P3', 'P4']) {
      if (this.queues[level].length > 0) {
        return this.queues[level][0];
      }
    }
    return null;
  }

  getStats() {
    return {
      total: this.totalSize,
      byPriority: Object.fromEntries(
        Object.entries(this.queues).map(([k, v]) => [k, v.length])
      )
    };
  }
}

// ============================================================
// 三、内存监控器
// ============================================================

class MemoryMonitor {
  constructor(options = {}) {
    this.maxMemoryMB = options.maxMemoryMB || 1024;  // 1GB上限
    this.warningThreshold = options.warningThreshold || 0.8;  // 80%警告
    this.gcInterval = options.gcInterval || 60000;  // 1分钟检查一次
    this.stats = {
      peakMemoryMB: 0,
      currentMemoryMB: 0,
      gcCount: 0
    };
  }

  /**
   * 获取当前内存使用
   */
  getCurrentMemory() {
    if (global.gc) {
      global.gc();  // 强制GC（需要--expose-gc标志）
    }
    const used = process.memoryUsage();
    const mb = Math.round(used.heapUsed / 1024 / 1024);
    this.stats.currentMemoryMB = mb;
    this.stats.peakMemoryMB = Math.max(this.stats.peakMemoryMB, mb);
    return mb;
  }

  /**
   * 检查是否可以接受新请求
   */
  canAccept(requestSizeMB = 0) {
    const current = this.getCurrentMemory();
    const projected = current + requestSizeMB;
    return projected < this.maxMemoryMB;
  }

  /**
   * 获取内存状态
   */
  getStatus() {
    const current = this.getCurrentMemory();
    return {
      currentMB: current,
      maxMB: this.maxMemoryMB,
      usagePercent: (current / this.maxMemoryMB).toFixed(2),
      status: current > this.maxMemoryMB * this.warningThreshold ? 'warning' : 'normal',
      ...this.stats
    };
  }
}

// ============================================================
// 四、LLM 批处理管理器
// ============================================================

class LLMBatchManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || 3;  // 火山引擎限制
    this.maxRetries = options.maxRetries || 3;
    this.maxMemoryMB = options.maxMemoryMB || 1024;
    this.adaptiveConcurrency = options.adaptiveConcurrency !== false;

    // 子系统
    this.tokenBucket = new TokenBucket(this.maxConcurrency, this.maxConcurrency);  // 每秒补充3个
    this.priorityQueue = new PriorityQueue();
    this.memoryMonitor = new MemoryMonitor({ maxMemoryMB: this.maxMemoryMB });
    this.eventBus = new NirathEventBus({ name: 'batch-manager', enabled: true });

    // 运行状态
    this.running = new Map();  // 正在执行的请求
    this.completed = 0;
    this.failed = 0;
    this.successRate = 1.0;
    this.adaptiveMaxConcurrency = this.maxConcurrency;
    this._processing = false;  // 锁，防止并发进入

    // 自适应调整
    if (this.adaptiveConcurrency) {
      this.adaptiveInterval = setInterval(() => this.adjustConcurrency(), 30000);  // 30秒调整一次
    }
  }

  /**
   * 提交请求到队列
   */
  async submit(request, options = {}) {
    const {
      priority = 'P2',
      timeoutMs = 600000,
      memoryEstimateMB = 50,
      retries = this.maxRetries
    } = options;

    // 内存检查
    if (!this.memoryMonitor.canAccept(memoryEstimateMB)) {
      console.error(`[BatchManager] ❌ 内存不足，拒绝请求 | 当前:${this.memoryMonitor.getCurrentMemory()}MB + ${memoryEstimateMB}MB > ${this.maxMemoryMB}MB`);
      throw new Error('内存不足，请稍后重试');
    }

    // 包装请求
    const wrappedRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      request,
      priority,
      timeoutMs,
      retries,
      retryCount: 0,
      status: 'queued',
      startTime: null,
      endTime: null
    };

    // 加入优先级队列
    this.priorityQueue.enqueue(wrappedRequest, priority);
    this.emit('request.queued', wrappedRequest);

    // 尝试立即处理
    this.processQueue();

    // 返回Promise
    return new Promise((resolve, reject) => {
      wrappedRequest.resolve = resolve;
      wrappedRequest.reject = reject;
    });
  }

  /**
   * 处理队列
   */
  async processQueue() {
    if (this._processing) return; // 已在处理中
    this._processing = true;

    try {
      while (this.running.size < this.adaptiveMaxConcurrency) {
        const item = this.priorityQueue.dequeue();
        if (!item) break;

        const { item: request } = item;

        // 获取Token
        const token = await this.tokenBucket.acquire(1, 30000);
        if (!token.granted) {
          console.warn(`[BatchManager] ⚠️ 请求${request.id}等待Token超时，重新入队`);
          this.priorityQueue.enqueue(request, request.priority);
          break;
        }

        this.running.set(request.id, request);
        request.status = 'running';
        request.startTime = Date.now();

        this.emit('request.started', request);

        // 执行请求
        this.executeRequest(request).finally(() => {
          this.running.delete(request.id);
          this.tokenBucket.release(1);
          this.processQueue();  // 处理下一个
        });
      }
    } finally {
      this._processing = false;
    }
  }

  /**
   * 执行单个请求（带重试）
   */
  async executeRequest(request) {
    const { request: fn, timeoutMs, retries } = request;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        // 超时控制
        let timeoutId;
        const result = await Promise.race([
          fn(request),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
          })
        ]);
        clearTimeout(timeoutId); // 清理timer

        request.endTime = Date.now();
        request.status = 'completed';
        this.completed++;
        this.emit('request.completed', request);
        this.eventBus.publish('llm.call.success', {
          requestId: request.id,
          durationMs: request.endTime - request.startTime,
          attempts: attempt
        }, { traceId: request.id });

        request.resolve(result);
        return result;

      } catch (error) {
        request.retryCount = attempt;
        console.error(`[BatchManager] ❌ 请求${request.id} 尝试${attempt}失败: ${error.message}`);

        if (attempt > retries) {
          request.status = 'failed';
          request.endTime = Date.now();
          this.failed++;
          this.emit('request.failed', request, error);
          this.eventBus.publish('llm.call.failed', {
            requestId: request.id,
            error: error.message,
            attempts: attempt
          }, { traceId: request.id });

          request.reject(error);
          return;
        }

        // 指数退避重试
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[BatchManager] ⏳ ${backoffMs}ms后重试...`);
        await this.sleep(backoffMs);
      }
    }
  }

  /**
   * 自适应调整并发数
   */
  adjustConcurrency() {
    const total = this.completed + this.failed;
    if (total === 0) return;

    const newRate = this.completed / total;
    this.successRate = newRate;

    if (newRate < 0.5) {
      // 成功率低，降低并发
      this.adaptiveMaxConcurrency = Math.max(1, this.adaptiveMaxConcurrency - 1);
      console.log(`[BatchManager] 📉 成功率${(newRate * 100).toFixed(0)}%，降低并发到${this.adaptiveMaxConcurrency}`);
    } else if (newRate > 0.95 && this.adaptiveMaxConcurrency < this.maxConcurrency) {
      // 成功率高，恢复并发
      this.adaptiveMaxConcurrency++;
      console.log(`[BatchManager] 📈 成功率${(newRate * 100).toFixed(0)}%，恢复并发到${this.adaptiveMaxConcurrency}`);
    }

    // 重置统计
    this.completed = 0;
    this.failed = 0;
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      running: this.running.size,
      queued: this.priorityQueue.totalSize,
      completed: this.completed,
      failed: this.failed,
      successRate: this.successRate,
      adaptiveConcurrency: this.adaptiveMaxConcurrency,
      maxConcurrency: this.maxConcurrency,
      tokenBucket: this.tokenBucket.getStats(),
      queueStats: this.priorityQueue.getStats(),
      memory: this.memoryMonitor.getStatus()
    };
  }

  /**
   * 关闭
   */
  shutdown() {
    if (this.adaptiveInterval) {
      clearInterval(this.adaptiveInterval);
    }
    console.log(`[BatchManager] 🛑 已关闭 | 运行中:${this.running.size} | 队列中:${this.priorityQueue.totalSize}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  LLMBatchManager,
  TokenBucket,
  PriorityQueue,
  MemoryMonitor,

  // 快速创建
  createBatchManager: (options) => new LLMBatchManager(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== LLM Batch Manager 集成测试 ===\n');

    const manager = new LLMBatchManager({ maxConcurrency: 2, adaptiveConcurrency: false });

    // 测试1：基础提交
    console.log('--- 测试1：基础提交 ---');
    const result1 = await manager.submit(
      async () => {
        await new Promise(r => setTimeout(r, 100));
        return '请求1完成';
      },
      { priority: 'P1' }
    );
    console.log('结果1:', result1);

    // 测试2：并发限制
    console.log('\n--- 测试2：并发限制 ---');
    const startMs = Date.now();
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        manager.submit(
          async () => {
            await new Promise(r => setTimeout(r, 200));
            return `请求${i + 2}完成`;
          },
          { priority: 'P2' }
        )
      );
    }
    const results = await Promise.all(promises);
    const duration = Date.now() - startMs;
    console.log('5个请求完成，总耗时:', duration, 'ms（限制并发=2，预期约600ms）');
    console.log('结果:', results);

    // 测试3：优先级队列
    console.log('\n--- 测试3：优先级队列 ---');
    const p0Result = await manager.submit(
      async () => 'P0紧急完成',
      { priority: 'P0' }
    );
    console.log('P0结果:', p0Result);

    // 测试4：统计
    console.log('\n--- 测试4：统计 ---');
    console.log(manager.getStats());

    manager.shutdown();
    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
