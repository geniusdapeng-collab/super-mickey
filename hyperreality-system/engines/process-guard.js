'use strict';
/**
 * 全局进程防护 v2.0 (P0-QUAL-01 修复)
 * 【v2.1.8-fix15】实例隔离：每个install实例独立配置和监听器
 * 作用：捕获 unhandledRejection / uncaughtException，防止静默数据损坏
 */

const installations = new Map(); // instanceId -> {config, listeners}

const EXIT_CODES = {
  OK: 0,
  GENERIC_ERROR: 1,
  AUTH_ERROR: 10,
  PARAM_ERROR: 11,
  NETWORK_ERROR: 12,
  RATE_LIMIT: 13,
  TIMEOUT: 14,
  OOM_FATAL: 15,
  UNCAUGHT_EXCEPTION: 20,
  UNHANDLED_REJECTION: 21,
};

function install(instanceId = 'default', options = {}) {
  if (installations.has(instanceId)) {
    console.warn(`[ProcessGuard] 实例 ${instanceId} 已安装，跳过重复安装`);
    return;
  }

  const config = {
    absorbTimeouts: options.absorbTimeouts !== false,
    absorbNetworkErrors: options.absorbNetworkErrors !== false,
    absorbUnhandled: options.absorbUnhandled ?? false,
    exitOnUnexpected: options.exitOnUnexpected !== false,
    maxListeners: options.maxListeners || 10,
    onFatal: options.onFatal || null,
    onError: options.onError || null,
  };

  const listeners = {};

  // === unhandledRejection 处理器 ===
  listeners.unhandledRejection = (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const msg = error.message;
    const timestamp = new Date().toISOString();
    const errorInfo = {
      type: 'unhandledRejection',
      message: msg,
      stack: error.stack,
      instanceId,
      timestamp,
      fatal: false
    };

    // 分类处理
    const isTimeout = msg.includes('超时') || msg.includes('timeout') || msg.includes('Timeout');
    const isNetwork = msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('network') || msg.includes('ENOTFOUND');
    const isOOM = /out of memory|heap out of memory|ENOMEM/i.test(msg);
    const isAuth = msg.includes('auth') || msg.includes('401') || msg.includes('403');

    if (isOOM) {
      errorInfo.fatal = true;
      console.error(`[ProcessGuard:${instanceId}] 🔴 OOM致命错误: ${msg}`);
      if (config.onFatal) config.onFatal(errorInfo);
      process.exit(EXIT_CODES.OOM_FATAL);
    }

    if (isAuth) {
      errorInfo.fatal = true;
      console.error(`[ProcessGuard:${instanceId}] 🔴 鉴权错误(不可恢复): ${msg}`);
      if (config.onFatal) config.onFatal(errorInfo);
      if (config.exitOnUnexpected) process.exit(EXIT_CODES.AUTH_ERROR);
      return;
    }

    if (isTimeout) {
      if (config.absorbTimeouts) {
        console.warn(`[ProcessGuard:${instanceId}] 吸收LLM超时: ${msg}`);
        if (config.onError) config.onError(errorInfo);
        return;
      }
    }

    if (isNetwork) {
      if (config.absorbNetworkErrors) {
        console.warn(`[ProcessGuard:${instanceId}] 吸收网络错误: ${msg}`);
        if (config.onError) config.onError(errorInfo);
        return;
      }
    }

    // 其他未预期错误
    if (config.exitOnUnexpected) {
      console.error(`[ProcessGuard:${instanceId}] 未预期错误，进程退出: ${msg}`);
      if (config.onFatal) config.onFatal(errorInfo);
      process.exit(EXIT_CODES.UNHANDLED_REJECTION);
    } else {
      console.error(`[ProcessGuard:${instanceId}] 未预期错误(已吸收): ${msg}`);
      if (config.onError) config.onError(errorInfo);
    }
  };

  // === uncaughtException 处理器 ===
  listeners.uncaughtException = (err) => {
    // 【P1-QUAL-04 修复】扩充致命错误模式：堆栈溢出、V8堆限制、内存耗尽
    const FATAL_PATTERNS = [
      // OOM / 内存耗尽
      /out of memory/i, /heap out of memory/i, /ENOMEM/i,
      /allocation failed/i, /memory allocation failed/i,
      /javascript heap out of memory/i, /v8::internal::v8::fatalprocessoutofmemory/i,
      // V8 堆限制
      /FATAL ERROR: Reached heap limit/i,
      /FATAL ERROR: Ineffective mark-compacts/i,
      /FATAL ERROR: Scavenger: semi-space copy/i,
      /FATAL ERROR: Allocation failed - process out of memory/i,
      // 堆栈溢出
      /RangeError: Maximum call stack size exceeded/i,
      /RangeError: Maximum call stack exceeded/i,
      /stack overflow/i, /too much recursion/i,
      // 段错误 / 信号
      /segfault/i, /SIGSEGV/i, /SIGABRT/i, /SIGILL/i, /SIGBUS/i,
      // 其他致命错误
      /abort trap/i, /illegal instruction/i, /bus error/i,
    ];
    const isFatal = FATAL_PATTERNS.some(p => p.test(err.message));

    const errorInfo = {
      type: 'uncaughtException',
      message: err.message,
      stack: err.stack,
      instanceId,
      timestamp: new Date().toISOString(),
      fatal: isFatal
    };

    if (isFatal) {
      console.error(`[ProcessGuard:${instanceId}] 致命错误: ${err.message}`);
      if (config.onFatal) config.onFatal(errorInfo);
      process.exit(EXIT_CODES.OOM_FATAL);
    } else if (config.exitOnUnexpected) {
      console.error(`[ProcessGuard:${instanceId}] 未捕获异常，进程退出: ${err.message}`);
      if (config.onFatal) config.onFatal(errorInfo);
      process.exit(EXIT_CODES.UNCAUGHT_EXCEPTION);
    } else {
      console.error(`[ProcessGuard:${instanceId}] 未捕获异常(已吸收): ${err.message}`);
      if (config.onError) config.onError(errorInfo);
    }
  };

  // 注册监听器
  process.on('unhandledRejection', listeners.unhandledRejection);
  process.on('uncaughtException', listeners.uncaughtException);

  installations.set(instanceId, { config, listeners });
  console.log(`[ProcessGuard] 实例 ${instanceId} 安装完成`);
}

/**
 * 卸载指定实例的监听器
 */
function uninstall(instanceId = 'default') {
  const inst = installations.get(instanceId);
  if (!inst) return;

  if (inst.listeners.unhandledRejection) {
    process.off('unhandledRejection', inst.listeners.unhandledRejection);
  }
  if (inst.listeners.uncaughtException) {
    process.off('uncaughtException', inst.listeners.uncaughtException);
  }
  installations.delete(instanceId);
  console.log(`[ProcessGuard] 实例 ${instanceId} 已卸载`);
}

/**
 * 获取已安装实例列表
 */
function getInstalledInstances() {
  return Array.from(installations.keys());
}

// 默认安装
install();
module.exports = { install, uninstall, getInstalledInstances, EXIT_CODES };
