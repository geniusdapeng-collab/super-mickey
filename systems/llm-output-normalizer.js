'use strict';

/**
 * 统一归一化 kimi / OpenAI 风格输出
 * 目标：
 * 1. content 优先
 * 2. content 为空时，安全回退 reasoning_content
 * 3. 尽量从 reasoning_content 中提取“最终答案”而非完整思考
 */

function safeString(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function getNested(obj, path, fallback = undefined) {
  try {
    return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function stripCodeFence(text) {
  if (!text) return '';
  return text
    .replace(/^```[a-zA-Z0-9_-]*\n?/g, '')
    .replace(/\n?```$/g, '')
    .trim();
}

function extractFinalSegment(text) {
  if (!text) return '';

  const cleaned = stripCodeFence(text);

  const markers = [
    '最终版本：',
    '最终版本:',
    '最终Prompt：',
    '最终Prompt:',
    '输出Prompt：',
    '输出Prompt:',
    '精简渲染Prompt：',
    '精简渲染Prompt:',
    'Final Prompt:',
    'Final prompt:',
    'Final Version:',
    '最终答案：',
    '最终答案:'
  ];

  for (const marker of markers) {
    const idx = cleaned.lastIndexOf(marker);
    if (idx !== -1) {
      return cleaned.slice(idx + marker.length).trim();
    }
  }

  // 如果没有 marker，尝试提取最后一段“像 prompt 的内容”
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!paragraphs.length) return cleaned;

  // 优先取最后一个较长段落
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const p = paragraphs[i];
    if (looksLikePrompt(p)) return p;
  }

  return paragraphs[paragraphs.length - 1];
}

function looksLikePrompt(text) {
  if (!text || text.length < 30) return false;

  const positiveSignals = [
    /cinematic/i,
    /shot/i,
    /camera/i,
    /lighting/i,
    /atmosphere/i,
    /volumetric/i,
    /hyperreal/i,
    /ultra-detailed/i,
    /Nirath/i,
    /render/i,
    /8k/i,
    /35mm/i,
    /电影级/,
    /超写实/,
    /镜头/,
    /光影/,
    /运镜/,
    /氛围/
  ];

  const negativeSignals = [
    /让我构思/,
    /分析如下/,
    /优化方向/,
    /建议\d+/,
    /检查是否包含/,
    /字数：/,
    /用户要求/,
    /当前描述的问题/
  ];

  const pos = positiveSignals.filter(r => r.test(text)).length;
  const neg = negativeSignals.filter(r => r.test(text)).length;

  return pos >= 2 && neg <= 1;
}

function normalizeLLMOutput(raw) {
  const content =
    safeString(raw?.content) ||
    safeString(getNested(raw, 'choices.0.message.content')) ||
    safeString(getNested(raw, 'data.choices.0.message.content'));

  const reasoning =
    safeString(raw?.reasoning_content) ||
    safeString(getNested(raw, 'choices.0.message.reasoning_content')) ||
    safeString(getNested(raw, 'data.choices.0.message.reasoning_content'));

  if (content) {
    return {
      ok: true,
      text: stripCodeFence(content),
      source: 'content',
      rawContent: content,
      rawReasoning: reasoning
    };
  }

  if (reasoning) {
    const extracted = extractFinalSegment(reasoning);
    return {
      ok: true,
      text: stripCodeFence(extracted || reasoning),
      source: 'reasoning_content',
      rawContent: content,
      rawReasoning: reasoning
    };
  }

  return {
    ok: false,
    text: '',
    source: 'empty',
    rawContent: '',
    rawReasoning: ''
  };
}

module.exports = {
  normalizeLLMOutput,
  extractFinalSegment,
  looksLikePrompt
};
