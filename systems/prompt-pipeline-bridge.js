'use strict';

/**
 * Prompt Pipeline Bridge - 完整替换版
 * 职责：
 * 1. 从 shot 中统一读取 prompt
 * 2. 注入 PromptForge 结果（json / markdown）
 * 3. 统一标准化 prompt
 * 4. 统一写回 shot
 * 5. 为 Stage 12 / 报告 / 渲染提供一致字段
 */

const fs = require('fs');
const path = require('path');

const {
  standardizePromptObject,
  getPromptFromShot,
  applyStandardizedPromptToShot
} = require('./prompt-standardizer');

const {
  checkStandardCompliance
} = require('./prompt-standard-v3');

// ============================================================
// 一、基础工具
// ============================================================

function safeText(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function tryReadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function tryReadText(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

// ============================================================
// 二、PromptForge 结果读取
// ============================================================

function extractPromptForgeSectionFromMarkdown(mdText) {
  const text = safeText(mdText);
  if (!text) return '';

  const patterns = [
    /\*\*【精简渲染Prompt】\*\*[\s\S]*?```([\s\S]*?)```/i,
    /\*\*【渲染Prompt】\*\*[\s\S]*?```([\s\S]*?)```/i,
    /【精简渲染Prompt】[\s\S]*?```([\s\S]*?)```/i
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }

  return '';
}

function injectPromptForgeResultIntoShot(shot, resultDir) {
  if (!shot || !shot.shotId || !resultDir) return shot;

  const candidates = [
    `${shot.shotId}.json`,
    `${shot.shotId}-prompt.json`,
    `${String(shot.shotId).replace(/\.md$/i, '')}.json`
  ];

  for (const file of candidates) {
    const fullPath = path.join(resultDir, file);
    const data = tryReadJSON(fullPath);
    if (data && data.success && safeText(data.prompt)) {
      shot.promptforgePrompt = data.prompt;
      shot.promptforgeSource = data.source || 'promptforge_json';
      shot.promptforgeLength = data.length || data.prompt.length;

      shot.renderPrompt = data.prompt;
      shot.render_prompt = data.prompt;
      shot.finalPrompt = data.prompt;

      return shot;
    }
  }

  return shot;
}

function injectPromptForgeMarkdownResultIntoShot(shot, promptsDir) {
  if (!shot || !shot.shotId || !promptsDir) return shot;

  const candidates = [
    `${shot.shotId}-prompt.md`,
    `${shot.shotId}.md`
  ];

  for (const file of candidates) {
    const fullPath = path.join(promptsDir, file);
    const md = tryReadText(fullPath);
    if (!md) continue;

    const extracted = extractPromptForgeSectionFromMarkdown(md);
    if (safeText(extracted)) {
      shot.promptforgePrompt = extracted;
      shot.promptforgeSource = 'promptforge_markdown';
      shot.promptforgeLength = extracted.length;

      shot.renderPrompt = extracted;
      shot.render_prompt = extracted;
      shot.finalPrompt = extracted;

      return shot;
    }
  }

  return shot;
}

// ============================================================
// 三、统一 Prompt 构建
// ============================================================

function getPrimaryPromptText(shot) {
  return getPromptFromShot(shot);
}

function buildPromptObject(shot, options = {}) {
  const originalPrompt = getPrimaryPromptText(shot);

  const promptObj = standardizePromptObject(originalPrompt, {
    maxLength: options.maxLength || 1500
  });

  return {
    rawPrompt: promptObj.rawPrompt,
    standardizedPrompt: promptObj.standardizedPrompt,
    renderFriendlyPrompt: promptObj.renderFriendlyPrompt,
    finalPrompt: promptObj.finalPrompt
  };
}

function applyPromptObjectToShot(shot, options = {}) {
  if (!shot || typeof shot !== 'object') return shot;

  return applyStandardizedPromptToShot(shot, {
    maxLength: options.maxLength || 1500
  });
}

// ============================================================
// 四、主链路批量标准化
// ============================================================

function normalizeShotsPrompts(shots = [], options = {}) {
  const {
    promptforgeResultDir = '',
    promptforgeMarkdownDir = '',
    maxLength = 1500
  } = options;

  return shots.map((shot) => {
    let s = { ...shot };

    if (promptforgeResultDir) {
      s = injectPromptForgeResultIntoShot(s, promptforgeResultDir);
    }

    if (!safeText(s.promptforgePrompt) && promptforgeMarkdownDir) {
      s = injectPromptForgeMarkdownResultIntoShot(s, promptforgeMarkdownDir);
    }

    s = applyPromptObjectToShot(s, { maxLength });

    return s;
  });
}

// ============================================================
// 五、PromptForge 结果合并
// ============================================================

function mergePromptForgeResultsIntoShots(shots = [], options = {}) {
  const {
    promptforgeResultDir = '',
    promptforgeMarkdownDir = '',
    maxLength = 1500
  } = options;

  return shots.map((shot) => {
    let s = { ...shot };

    if (promptforgeResultDir) {
      s = injectPromptForgeResultIntoShot(s, promptforgeResultDir);
    }

    if (!safeText(s.promptforgePrompt) && promptforgeMarkdownDir) {
      s = injectPromptForgeMarkdownResultIntoShot(s, promptforgeMarkdownDir);
    }

    s = applyPromptObjectToShot(s, { maxLength });

    return s;
  });
}

// ============================================================
// 六、Stage 12 合规数据准备
// ============================================================

function attachComplianceToShot(shot) {
  if (!shot || typeof shot !== 'object') return shot;

  const finalPrompt = shot.finalPrompt || shot.standardizedPrompt || getPrimaryPromptText(shot);
  const compliance = checkStandardCompliance(finalPrompt, shot.shotId || shot.id || 'unknown');

  shot.standardCompliance = compliance;
  shot.complianceScore = compliance.score;
  shot.compliancePassed = compliance.passed;
  shot.complianceMissing = compliance.missing;

  return shot;
}

function attachComplianceToShots(shots = []) {
  return shots.map((shot) => attachComplianceToShot({ ...shot }));
}

// ============================================================
// 七、主链路统一入口
// ============================================================

function processShotsForCompliance(shots = [], options = {}) {
  let processed = normalizeShotsPrompts(shots, options);
  processed = attachComplianceToShots(processed);
  return processed;
}

function processShotsForOutput(shots = [], options = {}) {
  return normalizeShotsPrompts(shots, options);
}

// ============================================================
// 八、摘要辅助
// ============================================================

function summarizeCompliance(shots = []) {
  const items = shots
    .filter(Boolean)
    .map((shot) => shot.standardCompliance)
    .filter(Boolean);

  const total = items.length;
  const passed = items.filter(i => i.passed).length;
  const failed = total - passed;
  const averageScore = total
    ? Math.round(items.reduce((sum, i) => sum + (i.score || 0), 0) / total)
    : 0;

  return {
    total,
    passed,
    failed,
    averageScore,
    items
  };
}

// ============================================================
// 九、导出
// ============================================================

module.exports = {
  getPrimaryPromptText,

  injectPromptForgeResultIntoShot,
  injectPromptForgeMarkdownResultIntoShot,
  extractPromptForgeSectionFromMarkdown,

  buildPromptObject,
  applyPromptObjectToShot,
  normalizeShotsPrompts,
  mergePromptForgeResultsIntoShots,

  attachComplianceToShot,
  attachComplianceToShots,
  processShotsForCompliance,
  processShotsForOutput,
  summarizeCompliance
};