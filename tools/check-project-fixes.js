#!/usr/bin/env node

/**
 * 项目修复自检脚本（可直接运行）
 * 用法：
 * node tools/check-project-fixes.js
 * node tools/check-project-fixes.js /root/.openclaw/workspace
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : process.cwd();

const FILES = {
  entry: path.join(ROOT, 'run-health-edu-ep01.js'),
  llm: path.join(ROOT, 'systems', 'llm-reasoning-engine.js'),
  characterPromptBuilder: path.join(ROOT, 'systems', 'character-prompt-builder.js'),
  characterManager: path.join(ROOT, 'systems', 'character-manager-v2.js'),
  promptBridge: path.join(ROOT, 'systems', 'prompt-pipeline-bridge.js'),
  pipeline: path.join(ROOT, 'zhuoyue-system', 'core', 'nirath-master-pipeline.js'),
  promptLength: path.join(ROOT, 'config', 'prompt-length.js'),
  chenCard: path.join(ROOT, 'characters', 'chen-nurse', 'character-card.json')
};

function exists(file) {
  return fs.existsSync(file);
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function has(text, pattern) {
  if (!text) return false;
  if (pattern instanceof RegExp) return pattern.test(text);
  return text.includes(pattern);
}

function countMatches(text, regex) {
  if (!text) return 0;
  const m = text.match(regex);
  return m ? m.length : 0;
}

function make(status, title, detail = '') {
  return { status, title, detail };
}

function pass(title, detail = '') {
  return make('PASS', title, detail);
}

function warn(title, detail = '') {
  return make('WARN', title, detail);
}

function fail(title, detail = '') {
  return make('FAIL', title, detail);
}

function section(title) {
  return { type: 'section', title };
}

function printResults(results) {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  console.log('\n================ 项目修复自检报告 ================\n');
  console.log(`项目根目录: ${ROOT}\n`);

  for (const item of results) {
    if (item.type === 'section') {
      console.log(`\n## ${item.title}`);
      continue;
    }

    const icon =
      item.status === 'PASS' ? '✅' :
      item.status === 'WARN' ? '⚠️' : '❌';

    console.log(`${icon} [${item.status}] ${item.title}`);
    if (item.detail) {
      console.log(`   ${item.detail}`);
    }

    if (item.status === 'PASS') passCount++;
    else if (item.status === 'WARN') warnCount++;
    else failCount++;
  }

  console.log('\n===================================================');
  console.log(`PASS: ${passCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log('===================================================\n');

  if (failCount > 0) {
    process.exitCode = 2;
  } else if (warnCount > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

const results = [];

// ========== 0. 文件存在性 ==========
results.push(section('0. 文件存在性检查'));

for (const [key, file] of Object.entries(FILES)) {
  if (exists(file)) {
    results.push(pass(`${key} 文件存在`, file));
  } else {
    results.push(fail(`${key} 文件缺失`, file));
  }
}

const entryText = read(FILES.entry);
const llmText = read(FILES.llm);
const characterPromptBuilderText = read(FILES.characterPromptBuilder);
const characterManagerText = read(FILES.characterManager);
const promptBridgeText = read(FILES.promptBridge);
const pipelineText = read(FILES.pipeline);
const promptLengthText = read(FILES.promptLength);
const chenCardJson = readJson(FILES.chenCard);

// ========== 1. 问题1：需求确认 ==========
results.push(section('1. 问题1：需求确认流程'));

if (!entryText) {
  results.push(fail('无法检查入口脚本需求确认', 'run-health-edu-ep01.js 不存在或为空'));
} else {
  const hasStatusCheck =
    has(entryText, 'REQUIREMENT_CONFIRMATION_REQUIRED') &&
    has(entryText, 'requirement-confirmation.json');

  const hasEarlyReturn =
    has(entryText, /if\s*\(\s*result\?\.(status)\s*===\s*['"]REQUIREMENT_CONFIRMATION_REQUIRED['"]\s*\)/) &&
    has(entryText, /\breturn\s*;/);

  if (hasStatusCheck && hasEarlyReturn) {
    results.push(pass(
      '入口脚本已处理需求确认闸机',
      '检测到 REQUIREMENT_CONFIRMATION_REQUIRED 判断、保存 requirement-confirmation.json、并提前 return'
    ));
  } else {
    results.push(fail(
      '入口脚本未完整处理需求确认闸机',
      '需要检查 result.status === REQUIREMENT_CONFIRMATION_REQUIRED 后立即 return'
    ));
  }
}

// ========== 2. 问题2：LLM JSON ==========
results.push(section('2. 问题2：LLM JSON 输出稳定性'));

if (!llmText) {
  results.push(fail('无法检查 llm-reasoning-engine.js', '文件不存在或为空'));
} else {
  const hasForceJson =
    has(llmText, 'forceJson') &&
    has(llmText, "response_format = { type: 'json_object' }");

  const reasonStructuredUsesJsonObject =
    has(llmText, "responseFormat: { type: 'json_object' }") ||
    has(llmText, "response_format: { type: 'json_object' }");

  const forbidsReasoningFallbackInJsonMode =
    has(llmText, 'JSON模式下禁止使用reasoning_content兜底') ||
    has(llmText, 'JSON模式下只接受 content') ||
    has(llmText, 'content-only-json-mode');

  const riskyReasoningFallback =
    has(llmText, '_extractFromReasoning(') &&
    has(llmText, 'reasoningContent') &&
    !forbidsReasoningFallbackInJsonMode;

  if (hasForceJson && reasonStructuredUsesJsonObject && forbidsReasoningFallbackInJsonMode) {
    results.push(pass(
      'LLM JSON 模式修复已落地',
      '检测到 forceJson / json_object / JSON模式下禁止 reasoning_content 兜底'
    ));
  } else {
    results.push(fail(
      'LLM JSON 模式修复不完整',
      '需要确保 reasonStructured 强制 json_object，且 JSON 模式下不使用 reasoning_content 顶替 content'
    ));
  }

  if (riskyReasoningFallback) {
    results.push(warn(
      '仍检测到潜在 reasoning_content 兜底风险',
      '建议确认 _extractFromReasoning 不再参与结构化 JSON 链路'
    ));
  } else {
    results.push(pass(
      '未发现明显的 JSON 链路 reasoning 兜底风险',
      '结构化输出路径较安全'
    ));
  }
}

// ========== 3. 问题4/7：角色服装 & 角色档案 ==========
results.push(section('3. 问题4/7：角色服装与角色档案'));

if (!characterPromptBuilderText) {
  results.push(fail('无法检查 character-prompt-builder.js', '文件不存在或为空'));
} else {
  const outfitPriorityOk =
    has(characterPromptBuilderText, 'vi?.appearance?.clothing?.promptFragment') &&
    has(characterPromptBuilderText, 'vi?.outfit') &&
    has(characterPromptBuilderText, 'character?.visual?.outfit');

  if (outfitPriorityOk) {
    results.push(pass(
      '角色服装优先级修复已落地',
      '检测到 clothing.build 会优先读取 appearance.clothing / visualIdentity.outfit / visual.outfit'
    ));
  } else {
    results.push(fail(
      '角色服装优先级修复缺失',
      'clothing.build 仍可能直接 fallback 到 role 推断'
    ));
  }
}

if (!characterManagerText) {
  results.push(fail('无法检查 character-manager-v2.js', '文件不存在或为空'));
} else {
  const hasNormalize =
    has(characterManagerText, '_normalizeCharacterData(') &&
    (has(characterManagerText, 'visualIdentity.outfit') || has(characterManagerText, 'outfit: visualIdentity.outfit'));

  const hasMergeRuntime = has(characterManagerText, 'mergeRuntimeCharacterData(');
  const createCharacterUsesNormalize =
    has(characterManagerText, 'const normalizedData = this._normalizeCharacterData(');

  const humanDefaultAnchor =
    has(characterManagerText, "'human'") &&
    has(characterManagerText, "human: '人类'");

  if (hasNormalize && hasMergeRuntime && createCharacterUsesNormalize) {
    results.push(pass(
      '角色档案同步修复已落地',
      '检测到 _normalizeCharacterData / mergeRuntimeCharacterData / createCharacter 使用标准化数据'
    ));
  } else {
    results.push(fail(
      '角色档案同步修复不完整',
      '需要补齐 _normalizeCharacterData、mergeRuntimeCharacterData，并在 createCharacter 中使用'
    ));
  }

  if (humanDefaultAnchor) {
    results.push(pass(
      'minimalAnchor 默认物种已去 Nirath',
      '检测到默认 species/race 为 human/人类'
    ));
  } else {
    results.push(fail(
      'minimalAnchor 默认物种可能仍有 Nirath 风险',
      '请检查 _buildMinimalAnchor 默认值是否仍为 Nirath异兽'
    ));
  }
}

// ========== 4. 角色卡检查 ==========
results.push(section('4. ChenZhuo角色卡检查'));

if (!chenCardJson) {
  results.push(fail(
    'ChenZhuo角色卡无法解析',
    '请检查 characters/chen-nurse/character-card.json 是否存在且为合法 JSON（不能带注释）'
  ));
} else {
  const role = chenCardJson?.baseIdentity?.role || '';
  const outfit =
    chenCardJson?.visualIdentity?.appearance?.clothing?.promptFragment ||
    chenCardJson?.visualIdentity?.outfit ||
    '';

  const minimalAnchor = chenCardJson?.v2Metadata?.minimalAnchor || '';

  if (outfit) {
    results.push(pass(
      'ChenZhuo角色卡已包含 outfit',
      `outfit=${outfit}`
    ));
  } else {
    results.push(fail(
      'ChenZhuo角色卡仍缺少 outfit',
      '请确保 visualIdentity.outfit 或 appearance.clothing.promptFragment 已写入'
    ));
  }

  if (role && role !== 'nurse') {
    results.push(pass(
      'ChenZhuo角色卡角色字段已修正',
      `role=${role}`
    ));
  } else if (role === 'nurse') {
    results.push(warn(
      'ChenZhuo角色卡 role 仍为 nurse',
      '如果入口角色定义是 presenter，建议同步修正角色卡或依赖 stageCharacters 运行时覆盖'
    ));
  } else {
    results.push(warn(
      'ChenZhuo角色卡 role 缺失',
      '建议显式写入 presenter'
    ));
  }

  if (/Nirath|异兽|双恒星/.test(minimalAnchor)) {
    results.push(fail(
      'ChenZhuo角色卡 minimalAnchor 仍含 Nirath 残留',
      `minimalAnchor=${minimalAnchor}`
    ));
  } else {
    results.push(pass(
      'ChenZhuo角色卡 minimalAnchor 已去 Nirath',
      `minimalAnchor=${minimalAnchor}`
    ));
  }
}

// ========== 5. 问题5/6：Nirath 残留 & 长度统一 ==========
results.push(section('5. 问题5/6：Nirath 残留与 Prompt 长度统一'));

if (!promptLengthText) {
  results.push(fail('无法检查 prompt-length.js', '文件不存在或为空'));
} else {
  const hasHardMax988 =
    has(promptLengthText, 'HARD_MAX: 988') &&
    has(promptLengthText, 'TARGET_MAX: 988');

  if (hasHardMax988) {
    results.push(pass(
      'Prompt 长度唯一真源存在',
      'config/prompt-length.js 中检测到 TARGET_MAX=988, HARD_MAX=988'
    ));
  } else {
    results.push(warn(
      'Prompt 长度配置可能不是预期值',
      '请确认 config/prompt-length.js 的 TARGET_MAX/HARD_MAX'
    ));
  }
}

if (!promptBridgeText) {
  results.push(fail('无法检查 prompt-pipeline-bridge.js', '文件不存在或为空'));
} else {
  const usesPromptLengthConfig =
    has(promptBridgeText, "require('../config/prompt-length')") &&
    has(promptBridgeText, 'PROMPT_LENGTH.HARD_MAX');

  const hardcoded1500InBridge = countMatches(promptBridgeText, /\b1500\b/g);

  if (usesPromptLengthConfig) {
    results.push(pass(
      'Prompt Bridge 已接入统一长度配置',
      '检测到 PROMPT_LENGTH.HARD_MAX'
    ));
  } else {
    results.push(fail(
      'Prompt Bridge 仍未接入统一长度配置',
      '请将 maxLength 默认值改为 PROMPT_LENGTH.HARD_MAX'
    ));
  }

  if (hardcoded1500InBridge > 0) {
    results.push(warn(
      'Prompt Bridge 中仍存在 1500 硬编码',
      `命中 ${hardcoded1500InBridge} 处`
    ));
  } else {
    results.push(pass(
      'Prompt Bridge 中未发现 1500 硬编码',
      '长度配置较干净'
    ));
  }
}

// ========== 6. pipeline 大文件检查 ==========
results.push(section('6. nirath-master-pipeline.js 综合检查'));

if (!pipelineText) {
  results.push(fail('无法检查 nirath-master-pipeline.js', '文件不存在或为空'));
} else {
  const usesPromptLength =
    has(pipelineText, "const PROMPT_LENGTH = require('../../config/prompt-length');") ||
    has(pipelineText, "require('../../config/prompt-length')");

  if (usesPromptLength) {
    results.push(pass(
      'pipeline 已引入统一长度配置',
      '检测到 PROMPT_LENGTH 引用'
    ));
  } else {
    results.push(fail(
      'pipeline 未引入统一长度配置',
      '请在 nirath-master-pipeline.js 顶部引入 PROMPT_LENGTH'
    ));
  }

  // 检查 1500 / 1470 硬编码
  const hardcoded1500 = countMatches(pipelineText, /\b1500\b/g);
  const hardcoded1470 = countMatches(pipelineText, /\b1470\b/g);

  if (hardcoded1500 === 0 && hardcoded1470 === 0) {
    results.push(pass(
      'pipeline 中未发现 1500/1470 硬编码',
      '长度配置统一情况良好'
    ));
  } else {
    results.push(warn(
      'pipeline 中仍有 1500/1470 硬编码',
      `1500 命中 ${hardcoded1500} 处，1470 命中 ${hardcoded1470} 处`
    ));
  }

  // 检查 finalFillPrompt
  const finalFillPromptClean =
    has(pipelineText, 'finalFillPrompt(prompt, shotId)') &&
    has(pipelineText, 'PROMPT_LENGTH.TARGET_MAX') &&
    has(pipelineText, 'PROMPT_LENGTH.HARD_MAX') &&
    !pipelineText.split('\n').some(line => line.includes('神话异星生态') && !/\.replace\(\s*\/[^/]+/.test(line));

  if (finalFillPromptClean) {
    results.push(pass(
      'finalFillPrompt 已去 Nirath 且接入长度配置',
      '检测到 TARGET_MAX/HARD_MAX 且无异星 filler'
    ));
  } else {
    results.push(fail(
      'finalFillPrompt 修复不完整',
      '请检查是否仍含神话异星生态或仍使用 1470/1500'
    ));
  }

  // 检查 _releaseMemory
  const hasReleaseMemoryMethod = has(pipelineText, '_releaseMemory(result)');
  const releaseMemoryCalled =
    has(pipelineText, 'this._releaseMemory?.(result);') ||
    has(pipelineText, 'this._releaseMemory(result);');

  if (hasReleaseMemoryMethod && releaseMemoryCalled) {
    results.push(pass(
      '主进程内存释放修复已落地',
      '检测到 _releaseMemory 方法及调用'
    ));
  } else {
    results.push(warn(
      '主进程内存释放修复不完整',
      '请确认 _releaseMemory 方法存在且 Stage 11 后有调用'
    ));
  }

  // PromptForge 子进程内存
  const uses1536orEnv =
    has(pipelineText, 'PROMPTFORGE_MAX_OLD_SPACE_MB') &&
    (
      has(pipelineText, '1536') ||
      has(pipelineText, '2048')
    ) &&
    has(pipelineText, '--max-old-space-size=${workerMemoryMb}');

  const still8192 = has(pipelineText, '--max-old-space-size=8192');

  if (uses1536orEnv && !still8192) {
    results.push(pass(
      'PromptForge 子进程内存已降到安全范围',
      '检测到 workerMemoryMb 环境配置及较小默认值'
    ));
  } else if (still8192) {
    results.push(fail(
      'PromptForge 子进程仍使用 8192MB',
      '机器总内存不足时极易触发 OOM'
    ));
  } else {
    results.push(warn(
      'PromptForge 子进程内存配置未明确',
      '建议使用 PROMPTFORGE_MAX_OLD_SPACE_MB，默认 1536/2048'
    ));
  }

  // Worker 退出码判断
  const hasWorkerResult =
    has(pipelineText, 'workerResult') &&
    has(pipelineText, 'code === 137') &&
    has(pipelineText, "signal === 'SIGKILL'");

  if (hasWorkerResult) {
    results.push(pass(
      'PromptForge 子进程异常退出处理已增强',
      '检测到 SIGKILL / 137 专门判断'
    ));
  } else {
    results.push(warn(
      'PromptForge 子进程异常退出处理可能不完整',
      '建议增加 SIGKILL / 137 的专门错误提示'
    ));
  }

  // finally 清理临时文件
  const cleansTempFiles =
    has(pipelineText, 'unlinkSync(inputFile)') &&
    has(pipelineText, 'unlinkSync(outputFile)');

  if (cleansTempFiles) {
    results.push(pass(
      'PromptForge 临时文件清理已加入',
      '检测到 inputFile/outputFile 清理逻辑'
    ));
  } else {
    results.push(warn(
      'PromptForge 临时文件清理未检测到',
      '建议在 finally 中删除 /tmp 中间文件'
    ));
  }

  // stageCharacters
  const hasStageCharactersFix =
    has(pipelineText, 'async stageCharacters(input, prd)') &&
    has(pipelineText, 'mergeRuntimeCharacterData') &&
    has(pipelineText, '_sanitizeCharacterForGenericMode');

  if (hasStageCharactersFix) {
    results.push(pass(
      'stageCharacters 修复版已存在',
      '检测到运行时角色合并与 generic 清洗'
    ));
  } else {
    results.push(warn(
      'stageCharacters 修复版未完全检测到',
      '请确认 stageCharacters 中有 mergeRuntimeCharacterData + generic sanitize'
    ));
  }

  // stageRender
  const hasStageRenderFix =
    has(pipelineText, 'async stageRender(stages)') &&
    has(pipelineText, '_buildRenderMetaForShot') &&
    has(pipelineText, '_mergeCharacterAnchorIntoPrompt');

  if (hasStageRenderFix) {
    results.push(pass(
      'stageRender 角色锚点注入修复已存在',
      '检测到 RenderMeta 构建和角色锚点注入'
    ));
  } else {
    results.push(warn(
      'stageRender 修复版未完全检测到',
      '请确认最终 render prompt 会使用 stages.characters 生成的角色锚点'
    ));
  }

  // PromptForge 合并回灌
  const hasForgeReinject =
    has(pipelineText, '_cleanForgePrompt') &&
    has(pipelineText, '_buildRenderMetaForShot(existingShot, result.stages)') &&
    has(pipelineText, '_mergeCharacterAnchorIntoPrompt');

  if (hasForgeReinject) {
    results.push(pass(
      'PromptForge 合并后的角色锚点回灌修复已存在',
      '检测到 cleanedPrompt 合并后再次注入角色锚点'
    ));
  } else {
    results.push(warn(
      'PromptForge 合并后的角色锚点回灌未检测到',
      '优化后 prompt 可能再次丢失警服描述'
    ));
  }

  // Prompt Quality Gate
  const hasPromptQualityGate =
    has(pipelineText, 'stagePromptQualityGate(') &&
    has(pipelineText, '_repairShotPromptByQualityGate') &&
    has(pipelineText, '_collectForbiddenKeywordsForMode') &&
    (
      has(pipelineText, '_checkShotOutfitPresence') ||
      has(pipelineText, 'outfitCheck') ||
      has(pipelineText, 'outfit') && has(pipelineText, '_repairShotPromptByQualityGate')
    );

  if (hasPromptQualityGate) {
    results.push(pass(
      'Prompt Quality Gate 修复版已存在',
      '检测到 outfit 检查、forbidden 检查、长度修复'
    ));
  } else {
    results.push(warn(
      'Prompt Quality Gate 修复版未完全检测到',
      '建议补齐 outfit 命中 / generic 去 Nirath / 长度校验'
    ));
  }

  // Stage 11.5 调用是否回写 render
  const qualityGateWritesBack =
    has(pipelineText, 'this.stagePromptQualityGate(result.stages.render, result.stages)') &&
    has(pipelineText, 'result.stages.render = result.stages.promptQualityGate.shots');

  if (qualityGateWritesBack) {
    results.push(pass(
      'Stage 11.5 调用方式已修正并回写 render',
      '后续 Stage 12+ 将使用修复后的 shots'
    ));
  } else {
    results.push(warn(
      'Stage 11.5 调用方式可能仍是旧版',
      '建议传入 result.stages 而不是仅 storyboard，并将修复后 shots 回写到 render'
    ));
  }
}

// ========== 7. Nirath 文案残留 ==========
results.push(section('7. Nirath 残留文案扫描'));

const combined = [
  { name: 'entry', text: entryText },
  { name: 'llm', text: llmText },
  { name: 'characterPromptBuilder', text: characterPromptBuilderText },
  { name: 'characterManager', text: characterManagerText },
  { name: 'promptBridge', text: promptBridgeText },
  { name: 'pipeline', text: pipelineText }
];

const nirathPatterns = [
  'Nirath增强',
  'Nirath场景映射',
  'Nirath异兽',
  'Nirath原生特征',
  '双恒星光照反射',
  '神话异星生态',
  '晶化地形',
  '能量脉络'
];

for (const p of nirathPatterns) {
  const hits = combined
    .filter(item => {
      if (!item.text) return false;
      return item.text.split('\n').some(line => {
        if (!line.includes(p)) return false;
        if (/\.replace\(\s*\/[^/]+/.test(line)) return false;
        return true;
      });
    })
    .map(item => item.name);

  if (hits.length > 0) {
    results.push(warn(
      `检测到 Nirath 残留词：${p}`,
      `命中文件：${hits.join(', ')}`
    ));
  } else {
    results.push(pass(
      `未检测到 Nirath 残留词：${p}`
    ));
  }
}

// ========== 8. 总体结论 ==========
results.push(section('8. 总体建议'));

const hardFailItems = results.filter(r => r.status === 'FAIL');
const warnItems = results.filter(r => r.status === 'WARN');

if (hardFailItems.length === 0 && warnItems.length === 0) {
  results.push(pass(
    '项目关键修复项看起来已基本落地',
    '可以开始进行一次完整预生产试跑，并重点验证 Stage-4 / Stage-11 / Stage-11.5 输出'
  ));
} else if (hardFailItems.length === 0) {
  results.push(warn(
    '项目已具备试跑条件，但仍有若干风险项',
    '建议优先处理 WARN 中与 pipeline / PromptForge / 角色锚点相关的项目'
  ));
} else {
  results.push(fail(
    '项目仍存在关键未修复项',
    '建议先修复 FAIL 项，再进行完整试跑'
  ));
}

printResults(results);
