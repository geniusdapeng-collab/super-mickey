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
    const msg = err.message || '';
    // 【P2-24-审计修复】区分可恢复错误和致命错误
    const recoverable = msg.includes('超时') || msg.includes('timeout') ||
                        msg.includes('JSON') || msg.includes('ECONNRESET') ||
                        msg.includes('ETIMEDOUT') || msg.includes('socket');

    if (recoverable) {
      console.warn(`[ProcessGuard] 可恢复异常(已吸收): ${msg}`);
    } else {
      console.error(`[ProcessGuard] ⚠️ 致命未捕获异常: ${msg}`);
      console.error(err.stack);
      setTimeout(() => process.exit(1), 3000);
    }
  });
}

install();
module.exports = { install };
