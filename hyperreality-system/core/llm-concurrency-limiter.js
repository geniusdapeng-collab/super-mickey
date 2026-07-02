/**
 * 全局LLM并发限制器 (P1-D9修复)
 * 使用Semaphore模式限制全局并发LLM调用数，防止请求风暴
 */

class LLMConcurrencyLimiter {
  constructor(maxConcurrency = 5) {
    this.maxConcurrency = maxConcurrency;
    this.current = 0;
    this.queue = [];
  }

  async acquire(timeoutMs = 30000) {
    if (this.current < this.maxConcurrency) {
      this.current++;
      return () => this.release(); // 返回释放函数
    }

    // 需要排队等待
    return new Promise((resolve, reject) => {
      const timer = timeoutMs > 0 ? setTimeout(() => {
        const idx = this.queue.indexOf(item);
        if (idx > -1) this.queue.splice(idx, 1);
        reject(new Error(`获取LLM并发许可超时(${timeoutMs}ms)`));
      }, timeoutMs) : null;

      const item = {
        resolve: (releaseFn) => {
          if (timer) clearTimeout(timer);
          resolve(releaseFn);
        }
      };

      this.queue.push(item);
    });
  }

  release() {
    this.current = Math.max(0, this.current - 1);

    // 唤醒等待者
    if (this.queue.length > 0 && this.current < this.maxConcurrency) {
      this.current++;
      const next = this.queue.shift();
      next.resolve(() => this.release());
    }
  }

  /**
   * 包装函数调用，自动获取/释放许可
   */
  async withLimit(fn, timeoutMs = 30000) {
    const release = await this.acquire(timeoutMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  getStats() {
    return {
      current,
      maxConcurrency: this.maxConcurrency,
      queueLength: this.queue.length
    };
  }
}

// 全局单例
const globalLLMLimiter = new LLMConcurrencyLimiter(
  parseInt(process.env.HYPERREALITY_LLM_MAX_CONCURRENCY, 10) || 5
);

module.exports = { LLMConcurrencyLimiter, globalLLMLimiter };
