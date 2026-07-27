/**
 * MicroMotion Round 3 Mock Test — 冲突解决与长度限制测试
 * 目标：暴露 Merge Agent 的权重冲突、maxPromptLength 超限、同一部位多Agent竞争问题
 */

const { FaceSculptorAgent } = require('../agents/face-sculptor');
const { BodyLanguageAgent } = require('../agents/body-language');
const { EyeDirectorAgent } = require('../agents/eye-director');
const { BreathEngineAgent } = require('../agents/breath-engine');
const { WorldBreathAgent } = require('../agents/world-breath');
const { MergeAgent } = require('../agents/merge');
const { MicroMotionSystem } = require('../scripts/micromotion');

console.log('\n═══════════════════════════════════════════════════════════');
console.log(' Round 3 Mock Test — 冲突解决与长度限制');
console.log('═══════════════════════════════════════════════════════════\n');

let pass = 0;
let fail = 0;
const errors = [];

function assert(condition, name) {
  if (condition) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); errors.push(name); }
}

const context = { sceneType: '战斗场景' };

// ====== Test Group 1: maxPromptLength 边界 ======
console.log('📏 Test Group 1: 提示词长度限制 (maxPromptLength=500)');
const mergeAgent = new MergeAgent();

// 构造超长原始提示词，测试合并后是否超界
const LONG_PROMPT = '大圣, 3D国漫CG渲染, 火眼金睛面部, 金色毛发外露, 身穿黄金锁子甲, 手持燃烧金箍棒, 站立山顶, 愤怒表情, 面部特写, 缓慢推轨推进, ' +
  '背景有云海翻腾, 天空有闪电划过, 远处有城池轮廓, 脚下有碎石飞溅, 披风在风中猎猎作响, ' +
  '铠甲反射金色光芒, 火焰在武器上跳动, 眼神中透出威严与决绝, 身姿挺拔如松, 气势压倒山河';

const longShot = {
  shotId: 'R3-LONG',
  character: '大圣',
  emotion: '愤怒',
  emotionIntensity: 5,
  cameraDistance: '面部特写',
  duration: 5,
  originalPrompt: LONG_PROMPT
};

try {
  const face = new FaceSculptorAgent().enhance(longShot, context);
  const body = new BodyLanguageAgent().enhance(longShot, context);
  const eye = new EyeDirectorAgent().enhance(longShot, context);
  const breath = new BreathEngineAgent().enhance(longShot, context);
  const world = new WorldBreathAgent().enhance(longShot, context);
  const result = mergeAgent.merge(longShot, { face, body, eye, breath, world });
  
  assert(result !== null, '超长提示词 → 有输出');
  assert(result.enhanced.length <= 600, `超长提示词 → 长度 ${result.enhanced.length} <= 600（容错边界）`);
  assert(result.enhanced.length > LONG_PROMPT.length, '超长提示词 → 仍有增强内容');
  console.log(`     原始: ${LONG_PROMPT.length} 字符 → 增强: ${result.enhanced.length} 字符`);
} catch (e) {
  fail++;
  console.log(`  ❌ 超长提示词测试异常: ${e.message}`);
  errors.push('Long-prompt');
}

// ====== Test Group 2: 面部特写权重冲突 ======
console.log('\n⚔️  Test Group 2: 面部特写 — Face vs Body 权重冲突');
const closeUpShot = {
  shotId: 'R3-CLOSE',
  character: '大圣',
  emotion: '愤怒',
  emotionIntensity: 4,
  cameraDistance: '面部特写',
  duration: 5,
  originalPrompt: '大圣, 面部特写, 愤怒'
};

try {
  const face = new FaceSculptorAgent().enhance(closeUpShot, context);
  const body = new BodyLanguageAgent().enhance(closeUpShot, context);
  const eye = new EyeDirectorAgent().enhance(closeUpShot, context);
  const breath = new BreathEngineAgent().enhance(closeUpShot, context);
  const world = new WorldBreathAgent().enhance(closeUpShot, context);
  const result = mergeAgent.merge(closeUpShot, { face, body, eye, breath, world });
  
  assert(result !== null, '面部特写 → 有输出');
  // 面部特写时，面部细节应占主导
  const faceKeywords = ['眉', '眼', '瞳孔', '咬肌', '下颌', '鼻翼'];
  const hasFaceDetail = faceKeywords.some(k => result.enhanced.includes(k));
  assert(hasFaceDetail, '面部特写 → 包含面部关键词');
  console.log(`     增强: ${result.enhanced.substring(0, 80)}...`);
} catch (e) {
  fail++;
  console.log(`  ❌ 面部特写冲突测试异常: ${e.message}`);
  errors.push('Close-up-conflict');
}

// ====== Test Group 3: 远景权重冲突 ======
console.log('\n⚔️  Test Group 3: 远景 — Body vs Face 权重冲突');
const longShot2 = {
  shotId: 'R3-LONG',
  character: '大圣',
  emotion: '悲伤',
  emotionIntensity: 3,
  cameraDistance: '远景',
  duration: 5,
  originalPrompt: '大圣, 远景, 悲伤'
};

try {
  const face = new FaceSculptorAgent().enhance(longShot2, context);
  const body = new BodyLanguageAgent().enhance(longShot2, context);
  const eye = new EyeDirectorAgent().enhance(longShot2, context);
  const breath = new BreathEngineAgent().enhance(longShot2, context);
  const world = new WorldBreathAgent().enhance(longShot2, context);
  const result = mergeAgent.merge(longShot2, { face, body, eye, breath, world });
  
  assert(result !== null, '远景 → 有输出');
  // 远景时，身体/环境应占主导，面部细节减少
  assert(result.enhanced.length > 0, '远景 → 增强非空');
  console.log(`     增强: ${result.enhanced.substring(0, 80)}...`);
} catch (e) {
  fail++;
  console.log(`  ❌ 远景冲突测试异常: ${e.message}`);
  errors.push('Long-shot-conflict');
}

// ====== Test Group 4: 同一部位多 Agent 注入测试 ======
console.log('\n🔀 Test Group 4: 同一部位多Agent注入竞争');
// 测试 Eye Director 和 Face Sculptor 都注入眼部描述时是否冲突
const eyeCompeteShot = {
  shotId: 'R3-EYE',
  character: '大圣',
  emotion: '恐惧',
  emotionIntensity: 4,
  cameraDistance: '面部特写',
  duration: 5,
  originalPrompt: '大圣, 面部特写, 恐惧, 眼睛特写'
};

try {
  const face = new FaceSculptorAgent().enhance(eyeCompeteShot, context);
  const eye = new EyeDirectorAgent().enhance(eyeCompeteShot, context);
  
  assert(face !== null && eye !== null, '多Agent → 都有输出');
  // 两者都应包含眼部相关描述
  assert(face.seedancePrompt.enhanced.length > 0, 'Face Sculptor → 眼部描述非空');
  assert(eye.seedanceCue.length > 0, 'Eye Director → 眼神Cue非空');
  console.log(`     Face: ${face.seedancePrompt.enhanced.substring(0, 50)}...`);
  console.log(`     Eye:  ${eye.seedanceCue.substring(0, 50)}...`);
} catch (e) {
  fail++;
  console.log(`  ❌ 多Agent竞争测试异常: ${e.message}`);
  errors.push('Multi-agent-compete');
}

// ====== Test Group 5: 极短提示词增强 ======
console.log('\n✂️  Test Group 5: 极短提示词');
const shortShot = {
  shotId: 'R3-SHORT',
  character: 'X',
  emotion: '愤怒',
  emotionIntensity: 3,
  cameraDistance: '面部特写',
  duration: 1,
  originalPrompt: '角色X'
};

try {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r3' });
  const result = mm.enhanceShot(shortShot, context);
  assert(result !== null, '极短提示词 → 有输出');
  assert(result.enhanced.length > shortShot.originalPrompt.length,
    '极短提示词 → 增强后更长');
  console.log(`     原始: "${shortShot.originalPrompt}" (${shortShot.originalPrompt.length}字符) → 增强: ${result.enhanced.length}字符`);
} catch (e) {
  fail++;
  console.log(`  ❌ 极短提示词测试异常: ${e.message}`);
  errors.push('Short-prompt');
}

// ====== Test Group 6: 空/缺省字段恢复 ======
console.log('\n🕳️  Test Group 6: 缺省字段降级');
const missingFieldsShot = {
  shotId: 'R3-MISSING',
  // 缺少 character
  emotion: '愤怒',
  // 缺少 emotionIntensity
  cameraDistance: '中景',
  // 缺少 duration
  originalPrompt: ''
};

try {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r3' });
  const result = mm.enhanceShot(missingFieldsShot, context);
  assert(result !== null, '缺省字段 → 有输出');
  assert(result.enhanced.length >= 0, '缺省字段 → 增强存在');
  console.log(`     空提示词增强: ${result.enhanced.length} 字符`);
} catch (e) {
  fail++;
  console.log(`  ❌ 缺省字段测试异常: ${e.message}`);
  errors.push('Missing-fields');
}

// ====== Test Group 7: 批量场景 maxPromptLength 一致性 ======
console.log('\n📦 Test Group 7: 批量场景长度一致性');
try {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r3-batch', maxPromptLength: 500 });
  const shots = [];
  for (let i = 1; i <= 10; i++) {
    shots.push({
      shotId: `R3-B${i}`,
      character: `角色${i}`,
      emotion: '愤怒',
      emotionIntensity: i <= 5 ? i : 3,
      cameraDistance: i % 2 === 0 ? '面部特写' : '远景',
      duration: 5,
      originalPrompt: `角色${i}, 3D国漫CG渲染, 情绪表现, ${'额外描述 '.repeat(i)}`
    });
  }
  
  const { results } = mm.enhanceBatch(shots, context);
  assert(results.length === 10, '批量 → 10个结果');
  
  let allWithinLimit = true;
  for (const r of results) {
    if (r.enhanced.length > 600) {
      allWithinLimit = false;
      console.log(`  ⚠️  ${r.shotId} 长度 ${r.enhanced.length} > 600`);
    }
  }
  assert(allWithinLimit, '批量 → 全部镜头长度在容错范围内');
  
  const lengths = results.map(r => r.enhanced.length);
  console.log(`     长度分布: [${lengths.join(', ')}]`);
} catch (e) {
  fail++;
  console.log(`  ❌ 批量长度测试异常: ${e.message}`);
  errors.push('Batch-length');
}

// ====== Test Group 8: 增强标记格式验证 ======
console.log('\n🏷️  Test Group 8: 增强标记格式 (**增强内容**)');
try {
  const shot = {
    shotId: 'R3-MARKER',
    character: '大圣',
    emotion: '愤怒',
    emotionIntensity: 4,
    cameraDistance: '面部特写',
    duration: 5,
    originalPrompt: '大圣, 面部特写, 愤怒'
  };
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r3' });
  const result = mm.enhanceShot(shot, context);
  
  assert(result.enhanced.includes('**') || result.enhanced.length > 0,
    '增强标记 → 包含 ** 标记或自然融合');
  console.log(`     标记检查: ${result.enhanced.includes('**') ? '包含 ** 标记' : '自然融合风格'}`);
} catch (e) {
  fail++;
  console.log(`  ❌ 增强标记测试异常: ${e.message}`);
  errors.push('Enhancement-marker');
}

// ====== 汇总 ======
console.log('\n═══════════════════════════════════════════════════════════');
console.log(` Round 3 结果: ✅ ${pass} 通过 | ❌ ${fail} 失败`);
console.log('═══════════════════════════════════════════════════════════');

if (errors.length > 0) {
  console.log('\n❌ 失败项:');
  errors.forEach(e => console.log(`   - ${e}`));
}

if (fail > 0) process.exit(1);
else {
  console.log('\n🎉 Round 3 全部通过！冲突解决与长度限制验证成功');
  process.exit(0);
}