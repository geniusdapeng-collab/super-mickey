/**
 * MicroMotion Round 4 Mock Test — 极端边界测试
 * 目标：暴露空输入、特殊字符、超长原始提示词、无角色名等边缘崩溃点
 */

const { FaceSculptorAgent } = require('../agents/face-sculptor');
const { BodyLanguageAgent } = require('../agents/body-language');
const { EyeDirectorAgent } = require('../agents/eye-director');
const { BreathEngineAgent } = require('../agents/breath-engine');
const { WorldBreathAgent } = require('../agents/world-breath');
const { MergeAgent } = require('../agents/merge');
const { MicroMotionSystem } = require('../scripts/micromotion');

console.log('\n═══════════════════════════════════════════════════════════');
console.log(' Round 4 Mock Test — 极端边界测试');
console.log('═══════════════════════════════════════════════════════════\n');

let pass = 0;
let fail = 0;
const errors = [];

function assert(condition, name) {
  if (condition) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); errors.push(name); }
}

function assertNoThrow(fn, name) {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e) { fail++; console.log(`  ❌ ${name} → 异常: ${e.message}`); errors.push(name); }
}

const context = { sceneType: '战斗场景' };

// ====== Test Group 1: 全空输入 ======
console.log('🕳️  Test Group 1: 全空/undefined输入');
const emptyShot = {
  shotId: 'R4-EMPTY',
  character: '',
  emotion: '',
  emotionIntensity: undefined,
  cameraDistance: '',
  duration: undefined,
  originalPrompt: ''
};

assertNoThrow(() => {
  const face = new FaceSculptorAgent().enhance(emptyShot, {});
  assert(face !== null && face.seedancePrompt !== undefined, '全空 → Face有输出');
}, 'Face: 全空输入');

assertNoThrow(() => {
  const body = new BodyLanguageAgent().enhance(emptyShot, {});
  assert(body !== null, '全空 → Body有输出');
}, 'Body: 全空输入');

assertNoThrow(() => {
  const eye = new EyeDirectorAgent().enhance(emptyShot, {});
  assert(eye !== null, '全空 → Eye有输出');
}, 'Eye: 全空输入');

assertNoThrow(() => {
  const breath = new BreathEngineAgent().enhance(emptyShot, {});
  assert(breath !== null, '全空 → Breath有输出');
}, 'Breath: 全空输入');

assertNoThrow(() => {
  const world = new WorldBreathAgent().enhance(emptyShot, {});
  assert(world !== null, '全空 → World有输出');
}, 'World: 全空输入');

// ====== Test Group 2: 特殊字符与注入测试 ======
console.log('\n💉 Test Group 2: 特殊字符与代码注入');
const evilShot = {
  shotId: 'R4-EVIL',
  character: '"; DROP TABLE users; --',
  emotion: '<script>alert(1)</script>',
  emotionIntensity: 3,
  cameraDistance: '面部特写',
  duration: 5,
  originalPrompt: '角色, 面部特写, **假增强**, `code`, ${hack}, \n换行, \t制表'
};

assertNoThrow(() => {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r4' });
  const result = mm.enhanceShot(evilShot, context);
  assert(result !== null, '特殊字符 → 有输出');
  assert(!result.enhanced.includes('DROP TABLE'), '特殊字符 → 无SQL注入');
  assert(!result.enhanced.includes('<script>'), '特殊字符 → 无XSS标签');
  console.log(`     增强后: ${result.enhanced.substring(0, 60)}...`);
}, '特殊字符处理');

// ====== Test Group 3: 超长原始提示词（>1000字符） ======
console.log('\n📏 Test Group 3: 超长原始提示词（>1000字符）');
const ultraLongPrompt = '大圣, 3D国漫CG渲染, ' + 
  '火眼金睛面部, 金色毛发外露, 身穿黄金锁子甲, 手持燃烧金箍棒, 站立山顶, '.repeat(20) +
  '愤怒表情, 面部特写, 缓慢推轨推进';

const ultraShot = {
  shotId: 'R4-ULTRA',
  character: '大圣',
  emotion: '愤怒',
  emotionIntensity: 5,
  cameraDistance: '面部特写',
  duration: 5,
  originalPrompt: ultraLongPrompt
};

assertNoThrow(() => {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r4' });
  const result = mm.enhanceShot(ultraShot, context);
  assert(result !== null, '超长原始 → 有输出');
  assert(result.enhanced.length <= 600, `超长原始 → 长度 ${result.enhanced.length} <= 600`);
  console.log(`     原始: ${ultraLongPrompt.length} 字符 → 增强: ${result.enhanced.length} 字符`);
}, '超长原始提示词');

// ====== Test Group 4: 无角色名（仅 emotion） ======
console.log('\n👤 Test Group 4: 无角色名');
const noCharShot = {
  shotId: 'R4-NOCHAR',
  emotion: '悲伤',
  emotionIntensity: 4,
  cameraDistance: '面部特写',
  duration: 3,
  originalPrompt: ''
};

assertNoThrow(() => {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r4' });
  const result = mm.enhanceShot(noCharShot, context);
  assert(result !== null, '无角色名 → 有输出');
  assert(result.enhanced.length > 0, '无角色名 → 增强非空');
}, '无角色名');

// ====== Test Group 5: 无 emotion ======
console.log('\n😶 Test Group 5: 无情绪');
const noEmoShot = {
  shotId: 'R4-NOEMO',
  character: '无名角色',
  emotionIntensity: 3,
  cameraDistance: '中景',
  duration: 5,
  originalPrompt: '无名角色, 中景, 站立'
};

assertNoThrow(() => {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-r4' });
  const result = mm.enhanceShot(noEmoShot, context);
  assert(result !== null, '无情绪 → 有输出');
  assert(result.enhanced.length > 0, '无情绪 → 增强非空');
}, '无情绪');

// ====== Test Group 6: 负数/非法 duration ======
console.log('\n⏱️  Test Group 6: 非法 duration');
const badDurationShot = {
  shotId: 'R4-BAD-DUR',
  character: 'X',
  emotion: '愤怒',
  emotionIntensity: 3,
  cameraDistance: '面部特写',
  duration: -1,
  originalPrompt: '测试'
};

assertNoThrow(() => {
  const face = new FaceSculptorAgent().enhance(badDurationShot, {});
  assert(face !== null, '负数duration → Face有输出');
  assert(face.microActions.length >= 0, '负数duration → 时间轴存在');
}, '负数duration');

// ====== Test Group 7: 中文混英文混数字 emotion ======
console.log('\n🔤 Test Group 7: 混合语言情绪');
const mixedEmotions = [
  'Angry愤怒', 'sad悲伤', 'JOY喜悦', '恐惧Fear', 'Anger123', '!!!愤怒!!!', '  愤怒  '
];

for (const emo of mixedEmotions) {
  assertNoThrow(() => {
    const shot = { shotId: `R4-${emo}`, character: 'T', emotion: emo, emotionIntensity: 3, cameraDistance: '面部特写', duration: 1, originalPrompt: 'test' };
    const face = new FaceSculptorAgent().enhance(shot, {});
    assert(face !== null, `混合情绪 "${emo}" → 有输出`);
  }, `混合情绪: ${emo}`);
}

// ====== Test Group 8: 空数组/空对象 context ======
console.log('\n📦 Test Group 8: 异常 context');
const badContexts = [
  {}, null, undefined, { sceneType: undefined }, { characterState: null }, [] 
];

const testShot = {
  shotId: 'R4-CTX', character: 'T', emotion: '愤怒', emotionIntensity: 3,
  cameraDistance: '面部特写', duration: 1, originalPrompt: 'test'
};

for (const ctx of badContexts) {
  assertNoThrow(() => {
    const face = new FaceSculptorAgent().enhance(testShot, ctx || {});
    assert(face !== null, `异常context ${JSON.stringify(ctx)} → Face有输出`);
  }, `异常context: ${JSON.stringify(ctx)}`);
}

// ====== 汇总 ======
console.log('\n═══════════════════════════════════════════════════════════');
console.log(` Round 4 结果: ✅ ${pass} 通过 | ❌ ${fail} 失败`);
console.log('═══════════════════════════════════════════════════════════');

if (errors.length > 0) {
  console.log('\n❌ 失败项:');
  errors.forEach(e => console.log(`   - ${e}`));
}

if (fail > 0) process.exit(1);
else {
  console.log('\n🎉 Round 4 全部通过！极端边界情况验证成功');
  process.exit(0);
}