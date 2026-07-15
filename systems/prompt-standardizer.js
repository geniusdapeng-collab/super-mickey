'use strict';

function ensureBlock(label, content) {
  const text = String(content || '').trim();
  return text ? `【${label}】${text}` : '';
}

function extractByRegex(text, patterns = []) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function standardizePrompt(input) {
  const text = String(input || '').trim();

  // 已经是块格式，直接返回（但做简单修复）
  if (/【[^】]+】/.test(text)) {
    return repairBrokenBlocks(text);
  }

  const character = extractByRegex(text, [
    /(?:CHARACTER|角色|主体)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const action = extractByRegex(text, [
    /(?:ACTION|动作|主动作)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const scene = extractByRegex(text, [
    /(?:SCENE|场景|环境)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const mood = extractByRegex(text, [
    /(?:MOOD|情绪|氛围)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const camera = extractByRegex(text, [
    /(?:CAMERA|运镜|镜头时间轴)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const lighting = extractByRegex(text, [
    /(?:LIGHTING|光影|光照)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const audio = extractByRegex(text, [
    /(?:AUDIO|音频|环境音效)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const director = extractByRegex(text, [
    /(?:DIRECTOR|导演)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const negative = extractByRegex(text, [
    /(?:NEGATIVE|负面约束)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const render = extractByRegex(text, [
    /(?:RENDER|渲染|风格)\s*[:：]\s*([^|【\n]+)/i
  ]);

  const blocks = [
    ensureBlock('CHARACTER', character),
    ensureBlock('ACTION', action),
    ensureBlock('SCENE', scene),
    ensureBlock('MOOD', mood),
    ensureBlock('CAMERA', camera),
    ensureBlock('LIGHTING', lighting),
    ensureBlock('AUDIO', audio),
    ensureBlock('DIRECTOR', director),
    ensureBlock('NEGATIVE', negative),
    ensureBlock('RENDER', render)
  ].filter(Boolean);

  // 如果一项都抽不出来，就把全文塞进视觉主块，避免 Stage 12 全挂
  if (!blocks.length) {
    return ensureBlock('VISUAL', text);
  }

  return blocks.join(' | ');
}

function repairBrokenBlocks(text) {
  let out = String(text || '');

  // 修复常见未闭合块：把 "【xxx " 补成 "【xxx】"
  out = out.replace(/【([^【】\n]{1,30})(?=\s|，|,)/g, '【$1】');

  return out;
}

// ============================================================
// 新增：Shot 对象处理工具
// ============================================================

function standardizePromptObject(shot) {
  const raw = getPromptFromShot(shot);
  if (!raw) return null;
  return {
    standardizedPrompt: standardizePrompt(raw),
    renderFriendlyPrompt: raw,
    source: shot._promptSource || 'unknown'
  };
}

function getPromptFromShot(shot) {
  if (!shot || typeof shot !== 'object') return '';
  const candidates = [
    shot.render_prompt,
    shot.renderPrompt,
    shot.prompt,
    shot.visualPrompt,
    shot.standardizedPrompt
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }
  return '';
}

function applyStandardizedPromptToShot(shot, standardizedResult) {
  if (!shot || typeof shot !== 'object' || !standardizedResult) return shot;
  
  shot.standardizedPrompt = standardizedResult.standardizedPrompt || '';
  shot.renderFriendlyPrompt = standardizedResult.renderFriendlyPrompt || '';
  shot.complianceChecked = true;
  
  return shot;
}

module.exports = {
  standardizePrompt,
  standardizePromptObject,
  getPromptFromShot,
  applyStandardizedPromptToShot,
  repairBrokenBlocks
};
