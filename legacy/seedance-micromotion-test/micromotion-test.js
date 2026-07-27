/**
 * MicroMotion 独立测试脚本 v9.2.0-Peng
 * 验证所有6个Agent + 融合 + 批量处理
 */

const { FaceSculptorAgent } = require('../agents/face-sculptor');
const { BodyLanguageAgent } = require('../agents/body-language');
const { EyeDirectorAgent } = require('../agents/eye-director');
const { BreathEngineAgent } = require('../agents/breath-engine');
const { WorldBreathAgent } = require('../agents/world-breath');
const { MergeAgent } = require('../agents/merge');
const { MicroMotionSystem } = require('../scripts/micromotion');

// 测试数据
const TEST_SHOT = {
  shotId: 'S25-01',
  character: '大圣',
  emotion: '愤怒',
  emotionIntensity: 4,
  cameraDistance: '面部特写',
  duration: 5,
  originalPrompt: '大圣, 3D国漫CG渲染, 火眼金睛面部, 金色毛发外露, 身穿黄金锁子甲, 手持燃烧金箍棒, 站立山顶, 愤怒, 面部特写, 缓慢推轨推进'
};

const TEST_CONTEXT = {
  sceneType: '战斗场景',
  characterState: {
    currentEmotion: '愤怒压抑',
    emotionIntensity: 4
  }
};

let passCount = 0;
let failCount = 0;

function assert(condition, name) {
  if (condition) {
    passCount++;
    console.log(`  ✅ ${name}`);
  } else {
    failCount++;
    console.log(`  ❌ ${name}`);
  }
}

console.log('\n═══════════════════════════════════════════');
console.log(' MicroMotion 独立测试 — v9.2.0-Peng');
console.log('═══════════════════════════════════════════\n');

// ====== Test 1: Face Sculptor ======
console.log('🎭 Test 1: Face Sculptor Agent');
try {
  const faceAgent = new FaceSculptorAgent();
  const result = faceAgent.enhance(TEST_SHOT, TEST_CONTEXT);
  
  assert(result.shotId === 'S25-01', 'shotId正确');
  assert(result.agent === 'FaceSculptor', 'agent标识正确');
  assert(result.emotion === 'anger', '情绪解析正确(anger)');
  assert(result.intensity === 4, '强度解析正确(4)');
  assert(result.microActions.length > 0, '微动作时间轴非空');
  assert(result.seedancePrompt.enhanced.length > 0, '增强提示词非空');
  assert(result.seedanceCompatible === true, 'Seedance兼容');
  console.log(`     面部增强: ${result.seedancePrompt.enhanced.substring(0, 60)}...`);
} catch (e) {
  failCount++;
  console.log(`  ❌ Face Sculptor 异常: ${e.message}`);
}

// ====== Test 2: Body Language ======
console.log('\n🤸 Test 2: Body Language Agent');
try {
  const bodyAgent = new BodyLanguageAgent();
  const result = bodyAgent.enhance(TEST_SHOT, TEST_CONTEXT);
  
  assert(result.shotId === 'S25-01', 'shotId正确');
  assert(result.agent === 'BodyLanguage', 'agent标识正确');
  assert(result.stance === 'dominant', '姿态推断正确(dominant from anger)');
  assert(result.microDescriptions.length > 0, '身体微动作非空');
  assert(result.seedanceCompatible === true, 'Seedance兼容');
  console.log(`     身体增强: ${result.microDescriptions[0]}`);
} catch (e) {
  failCount++;
  console.log(`  ❌ Body Language 异常: ${e.message}`);
}

// ====== Test 3: Eye Director ======
console.log('\n👁️  Test 3: Eye Director Agent');
try {
  const eyeAgent = new EyeDirectorAgent();
  const result = eyeAgent.enhance(TEST_SHOT, TEST_CONTEXT);
  
  assert(result.shotId === 'S25-01', 'shotId正确');
  assert(result.agent === 'EyeDirector', 'agent标识正确');
  assert(result.eyeType === 'theLock', '眼神类型推断正确(theLock from anger)');
  assert(result.direction === 'straight', '视线方向正确(straight)');
  assert(result.seedanceCue.length > 0, 'Seedance Cue非空');
  assert(result.seedanceCompatible === true, 'Seedance兼容');
  console.log(`     眼神增强: ${result.seedanceCue}`);
} catch (e) {
  failCount++;
  console.log(`  ❌ Eye Director 异常: ${e.message}`);
}

// ====== Test 4: Breath Engine ======
console.log('\n🫁 Test 4: Breath Engine Agent');
try {
  const breathAgent = new BreathEngineAgent();
  const result = breathAgent.enhance(TEST_SHOT, TEST_CONTEXT);
  
  assert(result.shotId === 'S25-01', 'shotId正确');
  assert(result.agent === 'BreathEngine', 'agent标识正确');
  assert(result.pattern === 'angry', '呼吸模式推断正确(angry)');
  assert(result.rate === '20-24次/分钟', '呼吸频率正确');
  assert(result.breathTimeline.length > 0, '呼吸时间轴非空');
  assert(result.seedanceCompatible === true, 'Seedance兼容');
  console.log(`     呼吸增强: ${result.visualCue.substring(0, 60)}...`);
} catch (e) {
  failCount++;
  console.log(`  ❌ Breath Engine 异常: ${e.message}`);
}

// ====== Test 5: World Breath ======
console.log('\n🌍 Test 5: World Breath Agent');
try {
  const worldAgent = new WorldBreathAgent();
  const result = worldAgent.enhance(TEST_SHOT, TEST_CONTEXT);
  
  assert(result.shotId === 'S25-01', 'shotId正确');
  assert(result.agent === 'WorldBreath', 'agent标识正确');
  assert(result.elements.length > 0, '环境元素非空');
  assert(result.seedancePrompt.enhanced.length > 0, '环境提示词非空');
  assert(result.seedanceCompatible === true, 'Seedance兼容');
  console.log(`     环境增强: ${result.seedancePrompt.enhanced.substring(0, 60)}...`);
} catch (e) {
  failCount++;
  console.log(`  ❌ World Breath 异常: ${e.message}`);
}

// ====== Test 6: Merge ======
console.log('\n🔀 Test 6: Merge Agent');
try {
  const mergeAgent = new MergeAgent();
  
  // 构造五路增强
  const face = new FaceSculptorAgent().enhance(TEST_SHOT, TEST_CONTEXT);
  const body = new BodyLanguageAgent().enhance(TEST_SHOT, TEST_CONTEXT);
  const eye = new EyeDirectorAgent().enhance(TEST_SHOT, TEST_CONTEXT);
  const breath = new BreathEngineAgent().enhance(TEST_SHOT, TEST_CONTEXT);
  const world = new WorldBreathAgent().enhance(TEST_SHOT, TEST_CONTEXT);
  
  const result = mergeAgent.merge(TEST_SHOT, { face, body, eye, breath, world });
  
  assert(result.shotId === 'S25-01', 'shotId正确');
  assert(result.agent === 'Merge', 'agent标识正确');
  assert(result.enhanced.length > result.original.length, '增强后提示词更长');
  assert(result.mood.length > 0, '情绪非空');
  assert(result.seedanceCompatible === true, 'Seedance兼容');
  console.log(`     融合增强: ${result.enhanced.substring(0, 80)}...`);
} catch (e) {
  failCount++;
  console.log(`  ❌ Merge 异常: ${e.message}`);
}

// ====== Test 7: MicroMotionSystem 单镜头 ======
console.log('\n🎬 Test 7: MicroMotionSystem — 单镜头增强');
try {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-test' });
  const result = mm.enhanceShot(TEST_SHOT, TEST_CONTEXT);
  
  assert(result.shotId === 'S25-01', 'shotId正确');
  assert(result.enhanced.length > 0, '增强提示词非空');
  assert(result.agents.face !== undefined, 'Face结果存在');
  assert(result.agents.body !== undefined, 'Body结果存在');
  assert(result.agents.eye !== undefined, 'Eye结果存在');
  assert(result.agents.breath !== undefined, 'Breath结果存在');
  assert(result.agents.world !== undefined, 'World结果存在');
  assert(result.merge !== undefined, 'Merge结果存在');
  console.log(`     完整增强: ${result.enhanced.substring(0, 80)}...`);
} catch (e) {
  failCount++;
  console.log(`  ❌ System 单镜头异常: ${e.message}`);
}

// ====== Test 8: MicroMotionSystem 批量 ======
console.log('\n📦 Test 8: MicroMotionSystem — 批量增强');
try {
  const shots = [
    TEST_SHOT,
    {
      shotId: 'S25-02',
      character: '大圣',
      emotion: '悲伤',
      emotionIntensity: 3,
      cameraDistance: '中景',
      duration: 5,
      originalPrompt: '大圣, 3D国漫CG渲染, 悲伤表情, 中景, 缓慢拉远'
    },
    {
      shotId: 'S25-03',
      character: '奥特曼',
      emotion: '坚定',
      emotionIntensity: 4,
      cameraDistance: '面部特写',
      duration: 5,
      originalPrompt: '奥特曼, 3D日漫CG渲染, 银色身躯, 能量指示灯闪烁, 坚定表情, 面部特写'
    }
  ];
  
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-test' });
  const { results, stateBus } = mm.enhanceBatch(shots, TEST_CONTEXT);
  
  assert(results.length === 3, '返回3个结果');
  assert(Object.keys(stateBus.mergedPrompts).length === 3, '状态总线3个镜头');
  assert(stateBus.version === '1.0-Peng', '版本号正确');
  assert(stateBus.faceEnhancements['S25-02'].emotion === 'sadness', '悲伤镜头解析正确');
  console.log(`     批量完成: ${results.length} 个镜头已增强`);
} catch (e) {
  failCount++;
  console.log(`  ❌ System 批量异常: ${e.message}`);
}

// ====== Test 9: 文件IO ======
console.log('\n💾 Test 9: 文件IO — enhanceFromFile');
try {
  const fs = require('fs').promises;
const fss = require('fs');
  const testInputPath = '/tmp/micromotion-test-input.json';
  
  fss.writeFileSync(testInputPath, JSON.stringify({
    project: 'TestProject',
    context: { sceneType: '战斗场景' },
    shots: [TEST_SHOT]
  }, null, 2));
  
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-test' });
  const output = mm.enhanceFromFile(testInputPath, '/tmp/micromotion-test');
  
  assert(fss.existsSync(output.enhancedPath), '增强提示词文件已生成');
  assert(fss.existsSync(output.reportPath), '增强报告已生成');
  
  const enhanced = JSON.parse(fss.readFileSync(output.enhancedPath, 'utf8'));
  assert(enhanced.totalShots === 1, '总镜头数正确');
  assert(enhanced.shots[0].enhanced.length > 0, '增强内容非空');
  
  console.log(`     文件输出: ${output.enhancedPath}`);
} catch (e) {
  failCount++;
  console.log(`  ❌ 文件IO异常: ${e.message}`);
}

// ====== Test 10: Diff对比 ======
console.log('\n📊 Test 10: Diff — 增强前后对比');
try {
  const mm = new MicroMotionSystem({ outputDir: '/tmp/micromotion-test' });
  const diff = mm.diff('S25-01', '/tmp/micromotion-test/motion-state.json');
  
  assert(diff !== null, 'diff结果非空');
  assert(diff.shotId === 'S25-01', 'shotId正确');
  assert(diff.original.length > 0, '原始提示词非空');
  assert(diff.enhanced.length > 0, '增强提示词非空');
  assert(diff.additions > 0, '新增字符数>0');
  console.log(`     新增字符: ${diff.additions} 个`);
} catch (e) {
  failCount++;
  console.log(`  ❌ Diff异常: ${e.message}`);
}

// ====== 汇总 ======
console.log('\n═══════════════════════════════════════════');
console.log(` 测试结果: ✅ ${passCount} 通过 | ❌ ${failCount} 失败`);
console.log('═══════════════════════════════════════════\n');

if (failCount > 0) {
  process.exit(1);
}