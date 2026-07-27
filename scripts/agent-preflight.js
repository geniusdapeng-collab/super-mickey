#!/usr/bin/env node
'use strict';

/**
 * agent-preflight.js — AI Agent 执行前预检（Step 0 单命令入口）
 *
 * 设计目标：把"执行前必须人工核对的一堆规范"收敛为一条命令。
 * 所有输出均从引擎代码/配置实时提取，不在本脚本硬编码任何规范数值，
 * 避免双写漂移（本脚本只做"读取与呈现"，不做"第二份规范"）。
 *
 * 用法：
 *   node scripts/agent-preflight.js          # 人类可读的执行规范卡
 *   node scripts/agent-preflight.js --json   # 机器可读 JSON（供 Agent 程序化消费）
 *
 * 退出码：0 = 全部通过；1 = 存在阻断项（工作区不完整 / 版本三源不一致 / 权威文件缺失）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');

const blockers = [];
const warnings = [];
const report = { checks: {}, spec: {} };

/* ---------- 1. 工作区完整性（克隆文件检出丢失防护） ---------- */
try {
  const status = execSync('git status --short', { cwd: ROOT, encoding: 'utf-8' });
  const lost = status.split('\n').filter(l => l.startsWith(' D ') || l.startsWith('D  '));
  if (lost.length > 0) {
    blockers.push(`工作区不完整：${lost.length} 个文件检出丢失（${lost.slice(0, 5).map(l => l.slice(3)).join(', ')}${lost.length > 5 ? ' 等' : ''}）。先执行 git checkout -- . 恢复后再继续`);
    report.checks.worktree = { ok: false, lostFiles: lost.map(l => l.slice(3)) };
  } else {
    report.checks.worktree = { ok: true };
  }
} catch (e) {
  warnings.push(`无法执行 git status（${e.message}），跳过工作区检查`);
  report.checks.worktree = { ok: null, note: 'git unavailable' };
}

/* ---------- 2. 版本号（唯一权威：package.json） ---------- */
let version = null;
try {
  version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version;
  report.spec.version = version;
} catch (e) {
  blockers.push('package.json 读取失败，无法确认系统版本');
}

/* ---------- 3. 版本三源一致性（复用 version-check.js，不重复实现） ---------- */
try {
  const out = execSync('node scripts/version-check.js', { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  report.checks.versionConsistency = { ok: true, detail: out.trim().split('\n').pop() };
} catch (e) {
  blockers.push('版本三源不一致（.current-version / package.json / index.js 头部注释），请先运行 node scripts/version-check.js --fix');
  report.checks.versionConsistency = { ok: false, detail: String(e.stdout || e.message).slice(0, 500) };
}

/* ---------- 4. 渲染 Prompt 字段规范（从 prompt-fusion-agent.js 源码实时解析） ---------- */
const FUSION_FILE = path.join(ROOT, 'hyperreality-system/engines/production-engine/agents/prompt-fusion-agent.js');
try {
  const src = fs.readFileSync(FUSION_FILE, 'utf-8');
  // 内容镜头字段：在 _assembleStandardPrompt 函数体内逐行扫描【标签】，按出现顺序去重。
  // 兼容三种注入形态：parts.push(`【X】…)、parts.push('【X】…)、变量拼接 `【X】${…}`（如台词）。
  const fnStart = src.indexOf('_assembleStandardPrompt(shot, fields, ratio) {');
  const fnEnd = src.indexOf('_assembleFullPrompt', fnStart);
  const body = src.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);
  const contentFields = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('//') || line.startsWith('*') || line.includes('console.warn')) continue;
    const labelRe = /【([一-龥/]{1,8})】/g;
    let lm;
    while ((lm = labelRe.exec(line)) !== null) {
      const label = lm[1];
      if (label === '强制中文输出') continue; // 语言修正前缀，非内容字段
      if (!contentFields.includes(label)) contentFields.push(label);
    }
  }
  // 片头专属字段：openingFields 数组的 label 值，按数组顺序
  const openingFields = [];
  const ofRe = /\{\s*key:\s*'[^']+',\s*label:\s*'([^']+)'\s*\}/g;
  let m;
  while ((m = ofRe.exec(src)) !== null) {
    if (!openingFields.includes(m[1])) openingFields.push(m[1]);
  }
  if (contentFields.length < 25) {
    warnings.push(`字段解析结果异常：内容镜头仅解析到 ${contentFields.length} 个字段标签，请以 prompt-fusion-agent.js 原文为准`);
  }
  report.spec.contentFields = contentFields;
  report.spec.openingExclusiveFields = openingFields;
  report.spec.fieldCounts = { content: contentFields.length, opening: contentFields.length + openingFields.length };
} catch (e) {
  blockers.push(`规范权威文件缺失：${FUSION_FILE}`);
}

/* ---------- 5. 长度标准（从 config/prompt-length.js 实时读取） ---------- */
try {
  const PromptLengthConfig = require(path.join(ROOT, 'hyperreality-system/config/prompt-length.js'));
  report.spec.promptLength = {
    targetMin: PromptLengthConfig.TARGET_MIN,
    targetMax: PromptLengthConfig.TARGET_MAX,
    hardMax: PromptLengthConfig.HARD_MAX,
  };
} catch (e) {
  blockers.push('长度配置读取失败：hyperreality-system/config/prompt-length.js');
}

/* ---------- 6. 固定执行纪律（非数值规范，属行为约束） ---------- */
report.spec.discipline = {
  auditReportAuthority: 'hyperreality-system/index.js 提示词审核报告生成器（镜头总览五列核验 + 序号化完整提示词 + 审核须知7条）',
  openingShotRequired: '每部作品必须含片头镜头（shotId=S00/SC00 或 sceneType=opening），片头=内容字段+片头专属字段',
  originalStoryPassthrough: '用户输入原文必须原样进入业务需求洞察与 PRD（_originalStoryText 链路），禁止改写省略',
  languageConstraint: '字段正文全部中文；英文仅允许【负面约束】固定短语与【基础】质量锚点词',
  emotionField: '【情绪】字段必须有具体面部/眼神描述，禁止只写关键词',
  shotDuration: '单镜 3-12 秒，系统上限 15 秒；台词按 4-4.5 字/秒核验时长匹配',
  templatesWarning: 'templates/ 目录仅为中间态参考或弃用指引，禁止作为最终渲染 Prompt 格式与长度依据（镜头卡25字段≠渲染Prompt25字段）',
  specAuthorityMap: 'SPEC-AUTHORITY.md 为规范裁决唯一权威地图，引擎代码 > 文档',
};

/* ---------- 输出 ---------- */
const ok = blockers.length === 0;
report.ok = ok;
report.blockers = blockers;
report.warnings = warnings;

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const f = report.spec.contentFields || [];
  const of = report.spec.openingExclusiveFields || [];
  const L = report.spec.promptLength || {};
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        SuperMickey Agent 执行前预检 · 规范卡             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  系统版本: v${version || '?'}（package.json 唯一权威）`);
  console.log(`  工作区完整: ${report.checks.worktree?.ok ? '✅' : '❌'}   版本三源一致: ${report.checks.versionConsistency?.ok ? '✅' : '❌'}`);
  console.log('');
  console.log(`  【内容镜头字段】共 ${f.length} 个标签（序号 01-${String(f.length).padStart(2, '0')}，【】标签格式；审核标准 25，≥25 即 ✅）：`);
  f.forEach((label, i) => console.log(`    ${String(i + 1).padStart(2, '0')}.【${label}】`));
  console.log(`  【片头专属字段】共 ${of.length} 个（片头镜头 = 上述 ${f.length} + 以下 ${of.length} = ${report.spec.fieldCounts?.opening} 个标签；审核标准 30，≥30 即 ✅）：`);
  of.forEach((label, i) => console.log(`    ${String(f.length + i + 1).padStart(2, '0')}.【${label}】`));
  console.log('');
  console.log(`  【长度标准】目标 ${L.targetMin}-${L.targetMax} 字符，硬上限 ${L.hardMax}（低于 ${L.targetMin} 必须补足细节密度）`);
  console.log('');
  console.log('  【执行纪律】');
  for (const [k, v] of Object.entries(report.spec.discipline)) console.log(`    · ${v}`);
  console.log('');
  if (warnings.length) { console.log('  ⚠️ 警告:'); warnings.forEach(w => console.log(`    - ${w}`)); console.log(''); }
  if (!ok) {
    console.log('  ⛔ 阻断项（必须先解决再执行）:');
    blockers.forEach(b => console.log(`    - ${b}`));
    console.log('');
  } else {
    console.log('  ✅ 预检通过，可按上述规范执行。');
    console.log('');
  }
}

process.exit(ok ? 0 : 1);
