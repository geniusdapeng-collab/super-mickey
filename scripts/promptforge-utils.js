// scripts/promptforge-utils.js - 提取、清洗、压缩工具

function stripCodeFences(text = '') {
  return String(text)
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

function normalizeText(text = '') {
  return stripCodeFences(text)
    .replace(/\r/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function splitParagraphs(text = '') {
  return normalizeText(text)
    .split(/\n{2,}|\n(?=[^\s])/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function trimPromptTail(text = '') {
  let s = normalizeText(text);

  const stopPatterns = [
    /\n(?:字数|长度|检查|分析|说明|是否包含|要求校验)[:：].*$/is,
    /(?:字数|长度|检查|分析|说明|是否包含|要求校验)[:：].*$/is,
    /\n(?:建议\d*|分析\d*|校验\d*)[:：]?.*$/is
  ];

  for (const p of stopPatterns) {
    s = s.replace(p, '').trim();
  }

  return s;
}

function looksLikePrompt(line = '') {
  const s = String(line).trim();
  if (!s) return false;

  const positiveSignals = [
    /^(cinematic shot|epic shot|wide shot|close-up shot|medium shot|tracking shot|establishing shot)\b/i,
    /\b(xiaoG|taotie|Nirath|alien world|twin suns|bioluminescent|volumetric fog|anamorphic|film grain|8k)\b/i,
    /\b(camera|dolly|tracking|orbit|push-in|pull-back|lens|depth of field|atmosphere|mood)\b/i
  ];

  const negativeSignals = [
    /^(用户要求|当前描述的问题|优化方向|让我构思|建议\d*|分析|检查|字数|是否包含|最终说明|environment|output\s*prompt|input\s*:)/i,
    /^(The user wants|I need to|I will|Let me|First,|Step \d|Analysis:|Reasoning:|Now I|Okay,|Here is|Here are|I am)/i,
    /^(角色|场景|分析|思考|说明|输入|输出|规则|要求|约束|优化|最终版本|版本|检查|字数|长度|是否|包含|不要|正确|示例|错误|问题|修改|建议|注意|提示|警告|注意|备注|注释|评论|评价|评分|分数|分数|分数|分数)/,
    /不要这样输出/,
    /正确示例/,
    /^说明[:：]/,
    /^思考/,
    /^reasoning/i
  ];

  if (negativeSignals.some(r => r.test(s))) return false;

  let score = 0;
  for (const r of positiveSignals) {
    if (r.test(s)) score += 1;
  }

  return score >= 1 && s.length >= 80;
}

function scorePromptCandidate(text = '') {
  const s = String(text).trim();
  if (!s) return -999;

  let score = 0;
  if (/^(cinematic shot|epic shot|wide shot|close-up shot|medium shot|tracking shot|establishing shot)\b/i.test(s)) score += 5;
  if (/\bxiaoG\b/i.test(s)) score += 3;
  if (/\bNirath\b/i.test(s)) score += 3;
  if (/\btwin suns?\b/i.test(s)) score += 2;
  if (/\b(camera|dolly|tracking|orbit|push-in|pull-back|lens)\b/i.test(s)) score += 2;
  if (/\b(atmosphere|mood|fog|bioluminescent|low gravity|film grain|anamorphic|8k)\b/i.test(s)) score += 2;
  if (s.length >= 120) score += 2;
  if (s.length >= 220) score += 1;

  if (/^environment[:：]/i.test(s)) score -= 10;
  if (/\[.*?\]/.test(s)) score -= 5;  // 模板占位符如 [xiaoG...] [lighting]
  if (/\blighting\b|\bcamera movement\b|\batmosphere\b|\bquality tags\b/i.test(s)) score -= 3;  // 未填充的模板标记
  if (/The user wants|I need to|I will|Let me|Here is|Here are|I am thinking/i.test(s)) score -= 10;  // 推理文本
  if (/用户要求|让我构思|建议\d|检查|字数|分析|最终版本如下|不要这样输出/i.test(s)) score -= 8;

  return score;
}

function extractAfterLabel(text = '') {
  const labels = [
    /最终版本[:：]\s*/i,
    /final version[:：]\s*/i,
    /最终prompt[:：]\s*/i,
    /prompt[:：]\s*/i,
    /输出prompt[:：]\s*/i,
    /精简prompt[:：]\s*/i
  ];

  for (const label of labels) {
    const m = text.match(label);
    if (m) {
      const start = m.index + m[0].length;
      const rest = text.slice(start).trim();
      const paras = splitParagraphs(rest);

      if (paras.length > 0) {
        const firstGood = paras.find(looksLikePrompt);
        if (firstGood) return trimPromptTail(firstGood);
        return trimPromptTail(paras[0]);
      }
    }
  }

  return '';
}

function extractBestPrompt(raw = '') {
  const text = normalizeText(raw);
  if (!text) return '';

  const afterLabel = extractAfterLabel(text);
  if (afterLabel) return trimPromptTail(afterLabel);

  const paras = splitParagraphs(text);
  if (paras.length) {
    const ranked = paras
      .map(p => ({ p: trimPromptTail(p), score: scorePromptCandidate(p) }))
      .sort((a, b) => b.score - a.score);

    if (ranked[0] && ranked[0].score >= 2) {
      return ranked[0].p;
    }
  }

  const m = text.match(/(Cinematic shot,.*?)(?:\n|(?:字数|检查|分析|说明)[:：]|$)/is);
  if (m) return trimPromptTail(m[1]);

  return trimPromptTail(text);
}

function sanitizePrompt(prompt = '') {
  let s = normalizeText(prompt);

  s = s
    .replace(/^["']+|["']+$/g, '')
    .replace(/^最终版本[:：]\s*/i, '')
    .replace(/^prompt[:：]\s*/i, '')
    .replace(/^输出prompt[:：]\s*/i, '')
    .replace(/[ ]+,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/ {2,}/g, ' ')
    .trim();

  s = s
    .replace(/(?:this prompt .*?)$/i, '')
    .replace(/(?:character count .*?)$/i, '')
    .trim();

  return s;
}

function compressPrompt(prompt = '', maxLen = 990) {
  let s = sanitizePrompt(prompt);

  if (s.length <= maxLen) return s;

  const replacements = [
    [/\bextremely\b/gi, ''],
    [/\bincredibly\b/gi, ''],
    [/\bhighly detailed\b/gi, 'detailed'],
    [/\bstunning\b/gi, ''],
    [/\bvisually striking\b/gi, 'striking'],
    [/\bdramatic\b/gi, ''],
    [/\bmasterpiece\b/gi, ''],
    [/\bbest quality\b/gi, ''],
    [/\bultra-detailed\b/gi, 'detailed'],
    [/\bvery\b/gi, ''],
    [/\s{2,}/g, ' ']
  ];

  for (const [pattern, repl] of replacements) {
    s = s.replace(pattern, repl).replace(/\s{2,}/g, ' ').trim();
    if (s.length <= maxLen) return s;
  }

  let parts = s.split(',').map(p => p.trim()).filter(Boolean);
  while (parts.length > 1) {
    const candidate = parts.join(', ');
    if (candidate.length <= maxLen) return candidate;
    parts.pop();
  }

  s = parts.join(', ');
  if (s.length <= maxLen) return s;

  s = s.slice(0, maxLen);
  const lastSpace = s.lastIndexOf(' ');
  const lastComma = s.lastIndexOf(',');
  const cut = Math.max(lastSpace, lastComma);
  if (cut > 0 && cut > maxLen * 0.8) {
    s = s.slice(0, cut);
  }

  return s.trim().replace(/[,\s.]+$/, '');
}

function buildFallbackPrompt({ scene, type, visualDesc }) {
  // 清理场景名中的中文，避免混入英文Prompt
  const sceneText = String(scene || 'alien terrain')
    .replace(/[\u4e00-\u9fa5]/g, '')  // 移除中文
    .replace(/[^a-zA-Z0-9\s_-]/g, '')  // 只保留英文/数字/空格/下划线/连字符
    .trim() || 'alien terrain';

  const typeText = /特写|close/i.test(type || '') ? 'Close-up shot' : 'Cinematic shot';

  let atmosphere = 'epic mysterious atmosphere';
  if (/战斗|battle|combat/i.test(type || '')) atmosphere = 'tense high-stakes atmosphere';
  if (/探索|explore|discovery|叙事|narrative/i.test(type || '')) atmosphere = 'awe-filled discovery atmosphere';

  // visualDesc清理：移除中文，只保留英文描述（如果大部分是中文就不使用）
  let visualHint = '';
  const rawVisual = String(visualDesc || '');
  const chineseRatio = (rawVisual.match(/[\u4e00-\u9fa5]/g) || []).length / rawVisual.length;
  if (chineseRatio < 0.3) {
    visualHint = rawVisual
      .replace(/[\u4e00-\u9fa5]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  return compressPrompt(
    `${typeText}, xiaoG in ${sceneText} on Nirath alien world, twin suns casting amber and silver dual shadows, floating bioluminescent flora, low gravity drifting spores, cinematic camera movement, shallow depth of field, volumetric fog, fluorescent ecosystem in violet and teal, ${atmosphere}, 8k, film grain, anamorphic lens flare${visualHint ? `, inspired by ${visualHint}` : ''}.`,
    990
  );
}

function removeExistingRenderSection(content = '') {
  let s = String(content);
  
  // Pattern 1: New format with --- separator
  s = s.replace(/\n*\n---\n\n\*\*【精简渲染Prompt】\*\*\s*(?:\([^)]*\))?\n\n```[\s\S]*?```\n*(?:\*\*生成时间\*\*:.*?\n)?\n*/g, '\n');
  
  // Pattern 2: Old format without --- separator (just the title and code block)
  s = s.replace(/\n*\n\*\*【精简渲染Prompt】[^*]*\*\*\n\n```[\s\S]*?```\n*(?:\*\*生成时间\*\*:.*?\n)?\n*/g, '\n');
  
  // Pattern 3: Just in case there are stray code blocks with Prompt text
  s = s.replace(/\n*\n```\n[^`]*?精简渲染Prompt[^`]*?```\n*/g, '\n');
  
  return s.trimEnd();
}

module.exports = {
  extractBestPrompt,
  sanitizePrompt,
  compressPrompt,
  buildFallbackPrompt,
  removeExistingRenderSection
};