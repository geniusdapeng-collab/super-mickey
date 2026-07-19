#!/usr/bin/env node
/**
 * confirm-pending-check.js - 待确认一次性检查器（v2.1.17-fix 新增）
 *
 * 【定位】确认推送闭环的"最后一公里"，专为 cron 定时调用设计：
 *   - 一次性执行（不是守护进程），无僵尸进程、无 stdout 管道问题
 *   - 有新的待确认 → 把完整内容打印到 stdout 并以退出码 42 标记"有新推送"
 *   - 已推送过同一内容 → 静默（推送去重标记 .push-marker.json）
 *   - 确认已被处理 → 清除标记，为下一环节的就绪让路
 *   - 流程疑似死亡 → 输出醒目警告（避免用户在死流程上空等）
 *
 * 【为什么是它】推送的终点必须是 AI 助手主循环的 message 工具——
 * 后台守护进程的 stdout/日志永远到不了用户（07-19 三次修复失败的根因）。
 * 正确用法：cron 每 1-2 分钟唤醒 AI 助手 → 运行本脚本 → 有输出即转发用户。
 *
 * cron 示例（每 2 分钟一次）：
 *   cd /root/.openclaw/workspace/github-repos/super-mickey && node scripts/confirm-pending-check.js
 *
 * 退出码：
 *   42 = 有新的待确认内容（stdout 即为待转发内容）
 *   0  = 无新内容 / 状态正常
 *   1  = 执行异常
 */

const fs = require('fs');
const path = require('path');
const runCoordinator = require('./run-coordinator');

const CONF_DIR = runCoordinator.CONFIRMATIONS_DIR;
const PENDING_PATH = path.join(CONF_DIR, 'PENDING.json');
const MARKER_PATH = path.join(CONF_DIR, '.push-marker.json');

const EXIT_NEW_CONTENT = 42;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function writeMarker(data) {
  try {
    const tmp = `${MARKER_PATH}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, MARKER_PATH);
  } catch (_) { /* 标记写失败不影响主流程 */ }
}

function main() {
  const state = readJson(PENDING_PATH);

  // ── 无待确认 ──────────────────────────────────────────────────────────
  if (!state || state.pending !== true) {
    // 刚被确认过（pending=false）：清掉推送标记，让下一环节能重新推送
    const marker = readJson(MARKER_PATH);
    if (state && state.pending === false && marker && marker.lastPushedKey) {
      writeMarker({ lastPushedKey: null, cleared_at: new Date().toISOString() });
      // 可选的轻提示（不打 42，不触发转发；cron 日志可见）
      console.log(`[confirm-check] 【${marker.lastType || state.type || '?'}】已确认，等待下一环节`);
    }
    process.exit(0);
  }

  // ── 有待确认：构造去重键 ─────────────────────────────────────────────
  const pushKey = `${state.type}:${state.generated_at || ''}`;
  const marker = readJson(MARKER_PATH);
  if (marker && marker.lastPushedKey === pushKey) {
    // 已推送过同一内容，静默
    process.exit(0);
  }

  // ── 流程存活检查（避免用户在死流程上空等）───────────────────────────
  const lock = runCoordinator.getLockHolder();
  const lockAlive = lock && runCoordinator.isProcessAlive(lock.pid);
  const run = runCoordinator.getCurrentRun();
  const runAlive = run && run.status === 'running' && runCoordinator.isProcessAlive(run.pid);
  const processAlive = lockAlive || runAlive;

  // ── 输出完整待确认内容（AI 助手转发给用户的正文）─────────────────────
  const lines = [];
  lines.push(`🔔 【待确认】${state.type} 环节需要您审阅（运行: ${state.run_id || 'unknown'}）`);
  if (!processAlive) {
    lines.push('');
    lines.push(`⚠️ 警告：预生产流程疑似已终止（锁/运行状态均无存活进程）。`);
    lines.push(`   即使确认也无法继续，请先重启流程；本提示仅供知悉。`);
  }
  lines.push('');
  lines.push('─'.repeat(50));

  const mdPath = state.md_path;
  if (mdPath && fs.existsSync(mdPath)) {
    try {
      const raw = fs.readFileSync(mdPath, 'utf8');
      // 去掉 HTML 注释头（run_id 元信息块），给正文全文——不概述、不挑字段
      const body = raw.replace(/^<!--[\s\S]*?-->\n?/, '').trim();
      lines.push(body);
    } catch (e) {
      lines.push(`(读取确认文件失败: ${e.message}，请人工查看: ${mdPath})`);
    }
  } else {
    lines.push(`(确认文件路径: ${mdPath || '未知'})`);
  }

  lines.push('─'.repeat(50));
  lines.push(`👉 审阅后回复"确认"或"OK"；需修改请回复"拒绝:原因"`);
  lines.push(`   （AI 助手将代为执行: node scripts/human-confirm.js ${state.type} approve "理由"）`);

  console.log(lines.join('\n'));

  // 写推送去重标记
  writeMarker({
    lastPushedKey: pushKey,
    lastType: state.type,
    pushed_at: new Date().toISOString(),
    processAliveAtPush: processAlive
  });

  process.exit(EXIT_NEW_CONTENT);
}

try {
  main();
} catch (e) {
  console.error(`[confirm-check] 执行异常: ${e.message}`);
  process.exit(1);
}
