'use strict';

const fs = require('fs');
const path = require('path');
const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { extractBestPrompt } = require('./promptforge-final-extractor');

function buildFallbackPrompt(inputText, shotId) {
  const base = String(inputText || '').replace(/\s+/g, ' ').trim().slice(0, 380);
  return `Cinematic shot, ${base}, hyperrealistic, ultra-detailed, strong atmosphere, controlled lighting, natural motion, filmic composition, no text, no watermark`;
}

function buildOptimizationPrompt(sourceText, shotId) {
  return `
你是专业电影导演 Prompt 精炼器。
任务：把输入内容压缩成一段可直接用于 AI 视频生成的英文 cinematic prompt。

硬性要求：
1. 只输出最终 prompt，本身不要解释
2. 不要输出"让我构思/分析/建议/最终版本"等文字
3. 保留主体、动作、场景、光影、运镜、情绪
4. 输出 180-700 字符
5. 英文为主，可保留必要专有名词如 Nirath、小G、白泽
6. 禁止 markdown、禁止 JSON、禁止编号

输入：
${sourceText}

现在直接输出最终 prompt：
`.trim();
}

async function main() {
  const filePath = process.argv[2];
  const outPath = process.argv[3];

  if (!filePath) {
    console.error(JSON.stringify({ success: false, error: 'missing_file_path' }));
    process.exit(1);
  }

  const inputText = fs.readFileSync(filePath, 'utf8');
  const shotId = path.basename(filePath).replace(/\.\w+$/, '');

  const engine = new LLMEngine({ model: 'kimi-k2p6' });

  try {
    const prompt = buildOptimizationPrompt(inputText.slice(0, 1200), shotId);

    const raw = await engine.reasonRaw(prompt, {
      maxTokens: 900,
      temperature: 1,
      timeoutMs: 180000
    });

    const extracted = extractBestPrompt(raw);

    let finalPrompt = extracted.ok ? extracted.prompt : '';
    if (!finalPrompt || finalPrompt.length < 80) {
      finalPrompt = buildFallbackPrompt(inputText, shotId);
    }

    const result = {
      success: true,
      shotId,
      prompt: finalPrompt,
      length: finalPrompt.length,
      source: extracted.source || 'fallback'
    };

    if (outPath) {
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    } else {
      console.log(JSON.stringify(result));
    }
  } catch (err) {
    const fallback = {
      success: true,
      shotId,
      prompt: buildFallbackPrompt(inputText, shotId),
      length: buildFallbackPrompt(inputText, shotId).length,
      source: 'fallback_on_error',
      warning: err.message
    };

    if (outPath) {
      fs.writeFileSync(outPath, JSON.stringify(fallback, null, 2), 'utf8');
    } else {
      console.log(JSON.stringify(fallback));
    }
  }
}

main();
