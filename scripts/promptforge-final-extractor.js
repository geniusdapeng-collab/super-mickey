'use strict';

const { normalizeLLMOutput } = require('../systems/llm-output-normalizer');

function cleanPromptText(text) {
  return String(text || '')
    .replace(/^最终版本[:：]\s*/i, '')
    .replace(/^最终prompt[:：]\s*/i, '')
    .replace(/^prompt[:：]\s*/i, '')
    .replace(/字数[:：].*$/gmi, '')
    .replace(/检查是否包含.*$/gmi, '')
    .trim();
}

function scoreCandidate(text) {
  if (!text) return -999;

  let score = 0;
  const len = text.length;

  if (len >= 120) score += 20;
  if (len >= 250) score += 20;
  if (len <= 1200) score += 10;
  if (/cinematic|camera|lighting|atmosphere|shot|hyperreal/i.test(text)) score += 20;
  if (/Nirath|AgentX|白泽|饕餮|forest|mountain|ocean|plain/i.test(text)) score += 15;
  if (/让我构思|分析|建议\d|用户要求|检查是否包含/i.test(text)) score -= 50;

  return score;
}

function splitCandidates(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);
}

function extractBestPrompt(rawResponse) {
  const normalized = normalizeLLMOutput(rawResponse);
  if (!normalized.ok) {
    return {
      ok: false,
      prompt: '',
      reason: 'empty_output'
    };
  }

  const text = cleanPromptText(normalized.text);
  const candidates = splitCandidates(text);

  if (!candidates.length) {
    return {
      ok: true,
      prompt: text,
      source: normalized.source,
      score: scoreCandidate(text)
    };
  }

  const best = candidates
    .map(c => ({ text: cleanPromptText(c), score: scoreCandidate(cleanPromptText(c)) }))
    .sort((a, b) => b.score - a.score)[0];

  return {
    ok: true,
    prompt: best.text,
    source: normalized.source,
    score: best.score,
    rawContent: normalized.rawContent,
    rawReasoning: normalized.rawReasoning
  };
}

module.exports = {
  extractBestPrompt,
  cleanPromptText,
  scoreCandidate
};
