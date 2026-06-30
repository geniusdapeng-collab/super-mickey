/**
 * SafePromise - 安全的 Promise 工具
 * 解决 Promise.race 悬空 rejection 崩溃问题
 */
class SafePromise {
  static async race(promises, options = {}) {
    const { timeout, label = 'race' } = options;
    const wrappedPromises = promises.map((p) => {
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return p;
    });
    if (timeout && timeout > 0) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`[${label}] 超时(${timeout}ms)`)), timeout);
      });
      return Promise.race([...wrappedPromises, timeoutPromise]);
    }
    return Promise.race(wrappedPromises);
  }

  static withTimeout(promise, timeoutMs, label = 'timeout') {
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`[${label}] 超时(${timeoutMs}ms)`)), timeoutMs);
      promise.finally(() => clearTimeout(timer)).catch(() => {});
    });
    return Promise.race([promise, timeoutPromise]);
  }

  static async allSettledWithTimeout(promises, options = {}) {
    const { timeout = 300000, label = 'allSettled' } = options;
    const wrapped = promises.map((p) =>
      SafePromise.withTimeout(
        Promise.resolve(p).catch((err) => ({ error: err.message, _failed: true })),
        timeout,
        label
      )
    );
    return Promise.all(wrapped);
  }
}

module.exports = { SafePromise };
