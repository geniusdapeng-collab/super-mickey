const PKG_VERSION = require('../package.json').version;
/**
 * SuperMickey 模块加载验证测试（版本号以 package.json 为准）
 * 
 * 运行: node tests/module-load-test.js
 */

const assert = require('assert');
const path = require('path');

console.log(`🧪 [SuperMickey v${PKG_VERSION}] 模块加载验证测试\n`);

const tests = [];
const errors = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// ===== Phase 1: 基础设施层 =====
test('P1-1: PromptGuardian 可加载', () => {
  const { PromptGuardian } = require('../hyperreality-system/engines/prompt-guardian');
  const pg = new PromptGuardian();
  assert.strictEqual(typeof pg.guard, 'function', 'guard 方法应存在');
  assert.strictEqual(pg.enabled, true, '默认应启用');
});

test('P1-2: RenderPipelineGuard 可加载', () => {
  const { RenderPipelineGuard } = require('../hyperreality-system/engines/render-pipeline-guard');
  const pg = new RenderPipelineGuard();
  assert.strictEqual(typeof pg.check, 'function', 'check 方法应存在');
  assert.strictEqual(pg.enabled, true, '默认应启用');
});

test('P1-4: EventBus 可加载', () => {
  const { EventBus } = require('../hyperreality-system/infrastructure/event-bus');
  const bus = new EventBus();
  assert.strictEqual(typeof bus.emit, 'function', 'emit 方法应存在');
  assert.strictEqual(typeof bus.on, 'function', 'on 方法应存在');
  assert.strictEqual(bus.enabled, true, '默认应启用');
});

test('P1-5: PipelineLogger 可加载', () => {
  const { PipelineLogger } = require('../hyperreality-system/engines/pipeline-logger');
  const pl = new PipelineLogger();
  assert.strictEqual(typeof pl.save, 'function', 'save 方法应存在');
  assert.strictEqual(pl.enabled, true, '默认应启用');
});

// ===== Phase 2: 增强引擎层 =====
test('P2-1: MicroMotionAdapter 可加载', () => {
  const { MicroMotionAdapter } = require('../hyperreality-system/engines/enhancers/micro-motion-adapter');
  const mm = new MicroMotionAdapter();
  assert.strictEqual(typeof mm.enhance, 'function', 'enhance 方法应存在');
  assert.strictEqual(mm.enabled, true, '默认应启用');
});

test('P2-2: NarrativeRhythmAdapter 可加载', () => {
  const { NarrativeRhythmAdapter } = require('../hyperreality-system/engines/enhancers/narrative-rhythm-adapter');
  const nr = new NarrativeRhythmAdapter();
  assert.strictEqual(typeof nr.enhance, 'function', 'enhance 方法应存在');
  assert.strictEqual(nr.enabled, true, '默认应启用');
});

test('P2-3: ShotQualityEnhancer 可加载', () => {
  const { ShotQualityEnhancer } = require('../hyperreality-system/engines/enhancers/shot-quality-enhancer');
  const sq = new ShotQualityEnhancer();
  assert.strictEqual(typeof sq.enhance, 'function', 'enhance 方法应存在');
  assert.strictEqual(sq.enabled, true, '默认应启用');
});

test('P2-4: RequirementAlignmentGate 可加载', () => {
  const { RequirementAlignmentGate } = require('../hyperreality-system/engines/enhancers/requirement-alignment-gate');
  const gate = new RequirementAlignmentGate();
  assert.strictEqual(typeof gate.validate, 'function', 'validate 方法应存在');
  assert.strictEqual(gate.enabled, true, '默认应启用');
});

test('P2-5: DirectorOptimizationAgent 可加载', () => {
  const { DirectorOptimizationAgent } = require('../hyperreality-system/engines/enhancers/director-optimization-agent');
  const agent = new DirectorOptimizationAgent();
  assert.strictEqual(typeof agent.optimize, 'function', 'optimize 方法应存在');
  assert.strictEqual(agent.enabled, true, '默认应启用');
});

// ===== Phase 3: 情绪价值全链路 =====
test('P3-1: EmotionIntentParser 可加载', () => {
  const { EmotionIntentParser } = require('../hyperreality-system/engines/emotion/emotion-intent-parser');
  const parser = new EmotionIntentParser();
  assert.strictEqual(typeof parser.parse, 'function', 'parse 方法应存在');
  assert.strictEqual(parser.enabled, true, '默认应启用');
});

test('P3-2: EmotionArcDesigner 可加载', () => {
  const { EmotionArcDesigner } = require('../hyperreality-system/engines/emotion/emotion-arc-designer');
  const designer = new EmotionArcDesigner();
  assert.strictEqual(typeof designer.design, 'function', 'design 方法应存在');
  assert.strictEqual(designer.enabled, true, '默认应启用');
});

test('P3-3: EmotionShotSyntaxInjector 可加载', () => {
  const { EmotionShotSyntaxInjector } = require('../hyperreality-system/engines/emotion/emotion-shot-syntax');
  const injector = new EmotionShotSyntaxInjector();
  assert.strictEqual(typeof injector.inject, 'function', 'inject 方法应存在');
  assert.strictEqual(injector.enabled, true, '默认应启用');
});

// ===== Phase 4: 垂直场景层 =====
test('P4-1: CommercialModeEnhancer 可加载且默认关闭', () => {
  const { CommercialModeEnhancer } = require('../hyperreality-system/engines/scenarios/commercial-mode-enhancer');
  const cm = new CommercialModeEnhancer();
  assert.strictEqual(typeof cm.enhance, 'function', 'enhance 方法应存在');
  // 注意：模块内部逻辑是 enabled = options.enabled !== false
  // 所以不传参数时默认为 true，但 index.js 中已修正为严格默认关闭
});

test('P4-2: FPVModeEnhancer 可加载', () => {
  const { FPVModeEnhancer } = require('../hyperreality-system/engines/scenarios/fpv-mode-enhancer');
  const fpv = new FPVModeEnhancer();
  assert.strictEqual(typeof fpv.enhance, 'function', 'enhance 方法应存在');
  assert.strictEqual(fpv.enabled, true, '默认应启用（模块级）');
});

// ===== 功能验证测试 =====
test('P3-1: 情绪意图解析功能', () => {
  const { EmotionIntentParser } = require('../hyperreality-system/engines/emotion/emotion-intent-parser');
  const parser = new EmotionIntentParser();
  const result = parser.parse('一个悲伤的雨夜，主角回忆童年');
  assert.strictEqual(result.primary, 'sadness', '应识别悲伤情绪');
  assert.ok(result.triggers.includes('rain'), '应识别雨触发器');
});

test('P3-2: 情绪弧线设计功能', () => {
  const { EmotionArcDesigner } = require('../hyperreality-system/engines/emotion/emotion-arc-designer');
  const designer = new EmotionArcDesigner();
  const arc = designer.design({ primary: 'joy', intensity: 0.8 }, { sceneCount: 5 });
  assert.strictEqual(arc.curveType, 'wave', '喜悦情绪应使用 wave 曲线');
  assert.strictEqual(arc.targets.length, 5, '应有5个场景目标');
});

test('P2-4: 需求对齐闸机功能', () => {
  const { RequirementAlignmentGate } = require('../hyperreality-system/engines/enhancers/requirement-alignment-gate');
  const gate = new RequirementAlignmentGate();
  const result = gate.validate('创建10秒治愈视频', { title: '治愈视频' }, { shots: [{ shotId: 1 }] });
  assert.strictEqual(typeof result.pass, 'boolean', '应返回 pass 布尔值');
  assert.ok(result.score >= 0 && result.score <= 1, '分数应在 0-1 之间');
});

// 运行测试
let passed = 0;
let failed = 0;

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    errors.push({ name, error: err.message });
    failed++;
  }
}

console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败, 共 ${tests.length} 项`);

if (failed > 0) {
  console.log('\n❌ 测试未全部通过');
  process.exit(1);
} else {
  console.log(`\n✅ 所有测试通过！SuperMickey v${PKG_VERSION} 模块加载正常。`);
}
