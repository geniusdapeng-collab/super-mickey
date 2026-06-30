'use strict';
/**
 * 全局进程防护 v1.1
 * 【v2.1.6-fix-bug50】分类处理错误，可配置吸收/退出策略
 * 作用：捕获 unhandledRejection / uncaughtException，防止静默数据损坏
 */
let installed = false;
const installedFor = new Set(); // 【v2.1.6-fix-bug58】按实例追踪，避免多实例共享状态
function install(instanceId = 'default', options = {}) {
  if (installedFor.has(instanceId)) return;
  installedFor.add(instanceId);
  if (installed) return; // 全局事件只注册一次
  installed = true;

  // 🆕 可配置：哪些错误类型被吸收，哪些导致退出
  const absorbTimeouts = options.absorbTimeouts !== false;
  const absorbNetworkErrors = options.absorbNetworkErrors !== false;
  const exitOnUnexpected = options.exitOnUnexpected !== false;

  process.on('unhandledRejection', (reason, promise) => {
    const msg = reason instanceof Error ? reason.message : String(reason);

    // 分类处理
    if (msg.includes('超时') || msg.includes('timeout') || msg.includes('Timeout')) {
      if (absorbTimeouts) {
        console.warn(`[ProcessGuard] 吸收LLM超时: ${msg}`);
        return;
      }
    }

    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('network')) {
      if (absorbNetworkErrors) {
        console.warn(`[ProcessGuard] 吸收网络错误: ${msg}`);
        return;
      }
    }

    // 其他错误：根据配置决定
    if (exitOnUnexpected) {
      console.error(`[ProcessGuard] 未预期错误，进程退出: ${msg}`);
      process.exit(1);
    } else {
      console.error(`[ProcessGuard] 未预期错误(已吸收): ${msg}`);
    }
  });

  process.on('uncaughtException', (err) => {
    const FATAL_PATTERNS = [
      /out of memory/i, /heap out of memory/i, /ENOMEM/i,
      /allocation failed/i, /segfault/i, /SIGSEGV/i, /SIGABRT/i
    ];
    const isFatal = FATAL_PATTERNS.some(p => p.test(err.message));

    if (isFatal) {
      console.error(`[ProcessGuard] 致命错误: ${err.message}`);
      process.exit(1);
    } else if (exitOnUnexpected) {
      console.error(`[ProcessGuard] 未捕获异常，进程退出: ${err.message}`);
      process.exit(1);
    } else {
      console.error(`[ProcessGuard] 未捕获异常(已吸收): ${err.message}`);
    }
  });
}

install();
module.exports = { install };