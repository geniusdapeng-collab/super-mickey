'use strict';
/**
 * 全局进程防护 v1.0
 * 作用：捕获 unhandledRejection / uncaughtException，防止 LLM 超时悬空 promise 直接杀死进程
 * 用法：在 index.js / run.js / run-preproduction.js 等入口第一行 require('./engines/process-guard')
 */
let installed = false;
function install() {
  if (installed) return;
  installed = true;

  process.on('unhandledRejection', (reason, promise) => {
    // 只记录，不退出进程。LLM 超时产生的悬空 rejection 会被这里吸收
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (msg.includes('超时') || msg.includes('timeout') || msg.includes('Timeout')) {
      console.warn(`[ProcessGuard] 吸收LLM超时悬空rejection: ${msg}`);
    } else {
      console.error(`[ProcessGuard] 未处理Rejection(已吸收，进程继续): ${msg}`);
    }
  });

  process.on('uncaughtException', (err) => {
    // 【P1-5 修复】区分致命错误和可恢复错误
    const FATAL_PATTERNS = [
      /out of memory/i,
      /heap out of memory/i,
      /ENOMEM/i,
      /allocation failed/i,
      /segfault/i,
      /SIGSEGV/i,
      /SIGABRT/i
    ];
    const isFatal = FATAL_PATTERNS.some(p => p.test(err.message));
    
    if (isFatal) {
      console.error(`[ProcessGuard] 💀 致命错误(进程退出): ${err.message}`);
      console.error(err.stack);
      process.exit(1); // 致命错误必须退出，防止僵尸进程
    } else {
      console.error(`[ProcessGuard] 未捕获异常(已吸收，进程继续): ${err.message}`);
      // 非致命错误继续运行
    }
  });
}

install();
module.exports = { install };