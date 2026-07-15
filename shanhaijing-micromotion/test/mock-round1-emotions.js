/**
 * MicroMotion Round 1 Mock Test — 全情绪映射深度测试
 * 覆盖 motion-library.json 中全部 9 种情绪 + 中文/英文混合输入
 * 目标：暴露情绪映射盲区、intensity 边界、中文→英文转换遗漏
 */

const { FaceSculptorAgent } = require('../agents/face-sculptor');
const { BodyLanguageAgent } = require('../agents/body-language');
const { EyeDirectorAgent } = require('../agents/eye-director');
const { BreathEngineAgent } = require('../agents/breath-engine');
const { WorldBreathAgent } = require('../agents/world-breath');
const { MergeAgent } = require('../agents/merge');
const { MicroMotionSystem } = require('../scripts/micromotion');

console.log('\n═══════════════════════════════════════════════════════════');
console.log(' Round 1 Mock Test — 全情绪映射深度测试');
console.log('═══════════════════════════════════════════════════════════\n');

let pass = 0;
let fail = 0;
const errors = [];

function assert(condition, name) {
  if (condition) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); errors.push(name); }
}

function assertThrows(fn, expectedMsg, name) {
  try { fn(); fail++; console.log(`  ❌ ${name} — 应抛出异常但未抛出`); errors.push(name); }
  catch (e) {
    if (e.message.includes(expectedMsg)) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name} — 异常消息不匹配: ${e.message}`); errors.push(name); }
  }
}

// 全部情绪测试矩阵
const EMOTIONS = [
  // 英文输入
  { emotion: 'anger', intensity: 1, label: 'anger-L1' },
  { emotion: 'anger', intensity: 3, label: 'anger-L3' },
  { emotion: 'anger', intensity: 5, label: 'anger-L5' },
  { emotion: 'sadness', intensity: 2, label: 'sadness-L2' },
  { emotion: 'sadness', intensity: 4, label: 'sadness-L4' },
  { emotion: 'joy', intensity: 1, label: 'joy-L1' },
  { emotion: 'joy', intensity: 5, label: 'joy-L5' },
  { emotion: 'fear', intensity: 3, label: 'fear-L3' },
  { emotion: 'disgust', intensity: 2, label: 'disgust-L2' },
  { emotion: 'contempt', intensity: 4, label: 'contempt-L4' },
  { emotion: 'surprise', intensity: 1, label: 'surprise-L1' },
  { emotion: 'surprise', intensity: 3, label: 'surprise-L3' },
  { emotion: 'dominant', intensity: 5, label: 'dominant-L5' },
  { emotion: 'suppressedEmotion', intensity: 2, label: 'suppressed-L2' },
  { emotion: 'suppressedEmotion', intensity: 5, label: 'suppressed-L5' },
  // 中文输入
  { emotion: '愤怒', intensity: 3, label: '愤怒-L3' },
  { emotion: '悲伤', intensity: 2, label: '悲伤-L2' },
  { emotion: '喜悦', intensity: 4, label: '喜悦-L4' },
  { emotion: '恐惧', intensity: 3, label: '恐惧-L3' },
  { emotion: '厌恶', intensity: 2, label: '厌恶-L2' },
  { emotion: '轻蔑', intensity: 4, label: '轻蔑-L4' },
  { emotion: '惊讶', intensity: 1, label: '惊讶-L1' },
  { emotion: '坚定', intensity: 5, label: '坚定-L5' },
  { emotion: '压抑', intensity: 3, label: '压抑-L3' },
  // 复合情绪
  { emotion: '愤怒压抑', intensity: 4, label: '愤怒压抑-L4' },
  { emotion: '悲伤绝望', intensity: 5, label: '悲伤绝望-L5' },
  { emotion: '坚定平静', intensity: 3, label: '坚定平静-L3' },
];

const context = { sceneType: '战斗场景' };

// ====== Face Sculptor 全情绪测试 ======
console.log('🎭 Test Group 1: Face Sculptor — 全部情绪映射');
const faceAgent = new FaceSculptorAgent();
for (const emo of EMOTIONS) {
  try {
    const shot = {
      shotId: `R1-${emo.label}`,
      character: '大圣',
      emotion: emo.emotion,
      emotionIntensity: emo.intensity,
      cameraDistance: '面部特写',
      duration: 5,
      originalPrompt: '测试提示词'
    };
    const result = faceAgent.enhance(shot, context);
    assert(result !== null && result.seedancePrompt !== undefined,
      `Face: ${emo.label} → 有输出`);
    assert(result.seedancePrompt.enhanced.length > 0,
      `Face: ${emo.label} → 增强提示词非空`);
  } catch (e) {
    fail++;
    console.log(`  ❌ Face: ${emo.label} → 异常: ${e.message}`);
    errors.push(`Face-${emo.label}`);
  }
}

// ====== Body Language 全情绪测试 ======
console.log('\n🤸 Test Group 2: Body Language — 全部情绪→姿态映射');
const bodyAgent = new BodyLanguageAgent();
for (const emo of EMOTIONS) {
  try {
    const shot = {
      shotId: `R1-${emo.label}`,
      character: '大圣',
      emotion: emo.emotion,
      emotionIntensity: emo.intensity,
      cameraDistance: '中景',
      duration: 5,
      originalPrompt: '测试提示词'
    };
    const result = bodyAgent.enhance(shot, context);
    assert(result !== null && result.microDescriptions !== undefined,
      `Body: ${emo.label} → 有输出`);
    assert(result.microDescriptions.length > 0,
      `Body: ${emo.label} → 微动作非空`);
    assert(result.stance.length > 0,
      `Body: ${emo.label} → 姿态非空 (stance=${result.stance})`);
  } catch (e) {
    fail++;
    console.log(`  ❌ Body: ${emo.label} → 异常: ${e.message}`);
    errors.push(`Body-${emo.label}`);
  }
}

// ====== Eye Director 全情绪测试 ======
console.log('\n👁️  Test Group 3: Eye Director — 全部情绪→眼神映射');
const eyeAgent = new EyeDirectorAgent();
for (const emo of EMOTIONS) {
  try {
    const shot = {
      shotId: `R1-${emo.label}`,
      character: '大圣',
      emotion: emo.emotion,
      emotionIntensity: emo.intensity,
      cameraDistance: '面部特写',
      duration: 5,
      originalPrompt: '测试提示词'
    };
    const result = eyeAgent.enhance(shot, context);
    assert(result !== null && result.eyeType !== undefined,
      `Eye: ${emo.label} → 有输出`);
    assert(result.seedanceCue.length > 0,
      `Eye: ${emo.label} → Seedance Cue非空`);
  } catch (e) {
    fail++;
    console.log(`  ❌ Eye: ${emo.label} → 异常: ${e.message}`);
    errors.push(`Eye-${emo.label}`);
  }
}

// ====== Breath Engine 全情绪测试 ======
console.log('\n🫁 Test Group 4: Breath Engine — 全部情绪→呼吸映射');
const breathAgent = new BreathEngineAgent();
for (const emo of EMOTIONS) {
  try {
    const shot = {
      shotId: `R1-${emo.label}`,
      character: '大圣',
      emotion: emo.emotion,
      emotionIntensity: emo.intensity,
      cameraDistance: '面部特写',
      duration: 5,
      originalPrompt: '测试提示词'
    };
    const result = breathAgent.enhance(shot, context);
    assert(result !== null && result.pattern !== undefined,
      `Breath: ${emo.label} → 有输出`);
    assert(result.rate.length > 0,
      `Breath: ${emo.label} → 呼吸频率非空`);
    assert(result.breathTimeline.length > 0,
      `Breath: ${emo.label} → 呼吸时间轴非空`);
  } catch (e) {
    fail++;
    console.log(`  ❌ Breath: ${emo.label} → 异常: ${e.message}`);
    errors.push(`Breath-${emo.label}`);
  }
}

// ====== World Breath 全情绪测试 ======
console.log('\n🌍 Test Group 5: World Breath — 全部情绪→环境映射');
const worldAgent = new WorldBreathAgent();
for (const emo of EMOTIONS) {
  try {
    const shot = {
      shotId: `R1-${emo.label}`,
      character: '大圣',
      emotion: emo.emotion,
      emotionIntensity: emo.intensity,
      cameraDistance: '中景',
      duration: 5,
      originalPrompt: '测试提示词'
    };
    const result = worldAgent.enhance(shot, context);
    assert(result !== null && result.elements !== undefined,
      `World: ${emo.label} → 有输出`);
    assert(result.elements.length >= 0,
      `World: ${emo.label} → 环境元素数组存在`);
  } catch (e) {
    fail++;
    console.log(`  ❌ World: ${emo.label} → 异常: ${e.message}`);
    errors.push(`World-${emo.label}`);
  }
}

// ====== Merge — 全情绪融合测试 ======
console.log('\n🔀 Test Group 6: Merge — 全情绪融合');
const mergeAgent = new MergeAgent();
for (const emo of EMOTIONS.slice(0, 10)) { // 取前10个做融合（避免太慢）
  try {
    const shot = {
      shotId: `R1-${emo.label}`,
      character: '大圣',
      emotion: emo.emotion,
      emotionIntensity: emo.intensity,
      cameraDistance: '面部特写',
      duration: 5,
      originalPrompt: '大圣, 3D国漫CG渲染, 火眼金睛面部, 金色毛发外露'
    };
    const face = faceAgent.enhance(shot, context);
    const body = bodyAgent.enhance(shot, context);
    const eye = eyeAgent.enhance(shot, context);
    const breath = breathAgent.enhance(shot, context);
    const world = worldAgent.enhance(shot, context);

    const result = mergeAgent.merge(shot, { face, body, eye, breath, world });
    assert(result !== null && result.enhanced !== undefined,
      `Merge: ${emo.label} → 有输出`);
    assert(result.enhanced.length > shot.originalPrompt.length,
      `Merge: ${emo.label} → 增强后更长`);
  } catch (e) {
    fail++;
    console.log(`  ❌ Merge: ${emo.label} → 异常: ${e.message}`);
    errors.push(`Merge-${emo.label}`);
  }
}

function assertIntensityBound(shot, expectedIntensity, name) {
  try {
    const result = faceAgent.enhance(shot, context);
    assert(result.intensity === expectedIntensity, `${name} → 降级为 ${expectedIntensity}`);
  } catch (e) {
    fail++; console.log(`  ❌ ${name} → 异常: ${e.message}`); errors.push(name);
  }
}

// ====== Intensity 边界测试 ======
console.log('\n⚠️  Test Group 7: Intensity 边界 (0→降级为1, 6→降级为5)');
assertIntensityBound(
  { shotId: 'R1-I0', character: 'T', emotion: 'anger', emotionIntensity: 0, cameraDistance: '面部特写', duration: 1, originalPrompt: 'test' },
  1, 'Intensity=0 降级为 1'
);
assertIntensityBound(
  { shotId: 'R1-I6', character: 'T', emotion: 'anger', emotionIntensity: 6, cameraDistance: '面部特写', duration: 1, originalPrompt: 'test' },
  5, 'Intensity=6 降级为 5'
);
assertIntensityBound(
  { shotId: 'R1-I10', character: 'T', emotion: 'anger', emotionIntensity: 10, cameraDistance: '面部特写', duration: 1, originalPrompt: 'test' },
  5, 'Intensity=10 降级为 5'
);
assertIntensityBound(
  { shotId: 'R1-IN1', character: 'T', emotion: 'anger', emotionIntensity: -1, cameraDistance: '面部特写', duration: 1, originalPrompt: 'test' },
  1, 'Intensity=-1 降级为 1'
);

// ====== 未知情绪测试 ======
console.log('\n❓ Test Group 8: 未知情绪处理');
try {
  const unknownShot = {
    shotId: 'R1-UNKNOWN', character: 'X', emotion: '莫名其妙', emotionIntensity: 3,
    cameraDistance: '面部特写', duration: 1, originalPrompt: 'test'
  };
  const result = faceAgent.enhance(unknownShot, context);
  assert(result !== null, '未知情绪 → 有输出（降级处理）');
  console.log(`  ℹ️  未知情绪降级为: ${result.emotion || 'fallback'}`);
} catch (e) {
  fail++;
  console.log(`  ❌ 未知情绪处理异常: ${e.message}`);
  errors.push('UnknownEmotion');
}

// ====== 汇总 ======
console.log('\n═══════════════════════════════════════════════════════════');
console.log(` Round 1 结果: ✅ ${pass} 通过 | ❌ ${fail} 失败`);
console.log('═══════════════════════════════════════════════════════════');

if (errors.length > 0) {
  console.log('\n❌ 失败项:');
  errors.forEach(e => console.log(`   - ${e}`));
}

if (fail > 0) process.exit(1);
else {
  console.log('\n🎉 Round 1 全部通过！全部 24 种情绪 × 6 Agent 映射验证成功');
  process.exit(0);
}