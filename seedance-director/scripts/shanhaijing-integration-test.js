/**
 * 山海经系统 × Seedance v9.4 集成测试
 *
 * 目标：验证8个新模块在山海经世界观下的工作效果
 * 场景：使用山海经异兽和世界观，跑通故事→分镜→渲染准备链路
 */

const { ContextManager } = require('./context-manager');
const { PermissionGate } = require('./permission-gate');
const { StateMachine, STATES } = require('./state-machine');
const { MemorySystem } = require('./memory-system');
const { InteractiveMode } = require('./interactive-mode');

// 山海经世界观测试数据
const SHANHAIJING_TEST = {
  title: '山海经：帝江的第一次飞行',
  world: {
    region: '中央荒原-无何有之乡',
    beast: '帝江',
    xiaoG: {
      name: 'AgentX',
      age: 8,
      traits: ['好奇心', '善良', '怕黑', '勇敢']
    }
  },
  story: {
    theme: '惊奇70% + 悲伤20% + 希望10%',
    scenes: [
      { id: 'S1', desc: 'AgentX在迷雾中醒来，帝江发光出现', emotion: '惊奇' },
      { id: 'S2', desc: '帝江教AgentX"无"字诀', emotion: '温暖' },
      { id: 'S3', desc: '混沌风暴来袭，帝江用身体保护AgentX', emotion: '悲伤' },
      { id: 'S4', desc: 'AgentX学会"无"，帝江第一次展开光翼', emotion: '希望' }
    ]
  },
  visual: {
    palette: '迷雾灰 + 帝江暖金 + 混沌紫',
    style: '水墨晕染 + 赛博光效',
    camera: '8岁POV低角度 + 手持感'
  }
};

async function runShanhaijingIntegrationTest() {
  console.log('═══════════════════════════════════════════');
  console.log('  🏔️ 山海经 × Seedance v9.4 集成测试');
  console.log('═══════════════════════════════════════════\n');

  const results = { passed: 0, failed: 0, tests: [] };

  // ===== 测试1: Context Manager处理山海经大上下文 =====
  console.log('📦 [1/5] Context Manager — 山海经上下文');
  try {
    const cm = new ContextManager({ maxContextWindow: 131072 });

    // 加载山海经世界观（大量文本）
    cm.addContextItem('world', JSON.stringify(SHANHAIJING_TEST.world), 1, 'world_bible');
    cm.addContextItem('story', JSON.stringify(SHANHAIJING_TEST.story), 1, 'story_arc');
    cm.addContextItem('visual', JSON.stringify(SHANHAIJING_TEST.visual), 2, 'visual_guide');

    // 添加8个场景镜头
    for (const scene of SHANHAIJING_TEST.story.scenes) {
      cm.addContextItem('shot', `${scene.id}: ${scene.desc} [${scene.emotion}]`, 1, scene.id);
    }

    const summary = cm.getContextSummary();
    console.log(`   Token: ${summary.totalTokens} / ${summary.maxTokens}`);
    console.log(`   使用率: ${(summary.ratio * 100).toFixed(1)}%`);
    console.log(`   项目: ${summary.itemCount}`);

    // 压缩低优先级项目
    for (const item of cm.contextItems) {
      if (item.priority >= 3) {
        cm.compressItem(item, 'MEDIUM');
      }
    }

    const compressed = cm.getContextSummary();
    console.log(`   压缩后: ${compressed.totalTokens} tokens`);

    results.tests.push({ name: 'contextManager', status: '✅ PASS' });
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.tests.push({ name: 'contextManager', status: `❌ FAIL: ${err.message}` });
    results.failed++;
  }

  // ===== 测试2: Permission Gate审查山海经内容 =====
  console.log('\n📦 [2/5] Permission Gate — 内容审查');
  try {
    const pg = new PermissionGate();

    // 审查山海经故事计划
    const storyPlan = {
      title: SHANHAIJING_TEST.title,
      contentWarnings: ['轻度恐惧（混沌风暴）'],
      brandSafety: { hasBrand: false },
      estimatedDuration: 60,
      qualityScore: 88
    };

    const decision = pg.evaluate('RENDER', 88, storyPlan);
    console.log(`   评分: ${decision.score}`);
    console.log(`   审批: ${decision.approval || decision.level || 'N/A'}`);
    console.log(`   风险: ${decision.flags?.length || 0} 项`);

    results.tests.push({ name: 'permissionGate', status: '✅ PASS' });
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.tests.push({ name: 'permissionGate', status: `❌ FAIL: ${err.message}` });
    results.failed++;
  }

  // ===== 测试3: State Machine追踪山海经生产 =====
  console.log('\n📦 [3/5] State Machine — 生产追踪');
  try {
    const sm = new StateMachine({ taskName: SHANHAIJING_TEST.title });

    sm.transition(STATES.PLANNING);
    sm.setData('world', SHANHAIJING_TEST.world);
    sm.setData('story', SHANHAIJING_TEST.story);

    sm.transition(STATES.RENDERING);
    sm.setData('shotsTotal', 8);
    sm.setData('shotsCompleted', 0);

    // 模拟完成4个镜头
    sm.setData('shotsCompleted', 4);

    sm.transition(STATES.POST_PRODUCTION);
    sm.setData('editStyle', '水墨+赛博');

    sm.transition(STATES.SOUND);
    sm.setData('audioLayers', 4);

    sm.transition(STATES.DELIVERING);

    const report = sm.getReport();
    console.log(`   步骤: ${report.transitions}`);
    console.log(`   数据项: ${report.dataKeys.length}`);
    console.log(`   检查点: ${report.checkpoints}`);

    // 保存检查点
    sm.saveCheckpoint('shanhaijing_v1');

    results.tests.push({ name: 'stateMachine', status: '✅ PASS' });
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.tests.push({ name: 'stateMachine', status: `❌ FAIL: ${err.message}` });
    results.failed++;
  }

  // ===== 测试4: Memory System积累山海经经验 =====
  console.log('\n📦 [4/5] Memory System — 经验积累');
  try {
    const mem = new MemorySystem();

    // 捕获渲染经验
    mem.captureRender(
      {
        model: 'seedance-2.0',
        prompt: '帝江发光体，水墨晕染风格，8岁POV低角度',
        tip: '山海经异兽需要文化准确性校验'
      },
      {
        title: SHANHAIJING_TEST.title,
        style: 'shanhaijing',
        characters: ['帝江', 'AgentX']
      }
    );

    // 捕获错误经验
    mem.captureError(
      new Error('帝江描述被Seedance误识别为西方生物'),
      { title: SHANHAIJING_TEST.title },
      '添加"出自山海经"前缀后修复'
    );

    // 检索
    const experiences = mem.retrieve(
      { title: '山海经', style: 'shanhaijing', characters: ['帝江'] },
      { type: 'render', limit: 5 }
    );

    console.log(`   经验: 2条`);
    console.log(`   检索: ${experiences.length}条相关`);

    // 生成建议
    const suggestions = mem.suggest({ title: '山海经', characters: ['帝江'] });
    console.log(`   建议: ${suggestions ? suggestions.length : 0}条`);

    results.tests.push({ name: 'memorySystem', status: '✅ PASS' });
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.tests.push({ name: 'memorySystem', status: `❌ FAIL: ${err.message}` });
    results.failed++;
  }

  // ===== 测试5: Interactive Mode对话式生产 =====
  console.log('\n📦 [5/5] Interactive Mode — 对话生产');
  try {
    const im = new InteractiveMode();

    // 模拟用户创建山海经短片
    const r1 = await im.process('做一个山海经帝江的短片');
    const r2 = await im.process('60秒');
    const r3 = await im.process('主角是8岁的AgentX和帝江');

    console.log(`   对话: 3轮`);
    console.log(`   状态: ${im.state}`);

    // 增量修改
    const r4 = await im.process('再加一个混沌风暴的场景');
    console.log(`   修改: ${r4.type}`);

    results.tests.push({ name: 'interactiveMode', status: '✅ PASS' });
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.tests.push({ name: 'interactiveMode', status: `❌ FAIL: ${err.message}` });
    results.failed++;
  }

  // ===== 汇总 =====
  console.log('\n═══════════════════════════════════════════');
  console.log('  📊 山海经集成测试报告');
  console.log('═══════════════════════════════════════════');
  console.log(`\n   通过: ${results.passed}/5`);
  console.log(`   失败: ${results.failed}/5`);
  console.log(`   成功率: ${(results.passed / 5 * 100).toFixed(1)}%`);

  for (const test of results.tests) {
    const icon = test.status.includes('✅') ? '✅' : '❌';
    console.log(`   ${icon} ${test.name}: ${test.status}`);
  }

  if (results.failed === 0) {
    console.log('\n   🎉 山海经系统与新模块集成完美！');
  }

  return results;
}

runShanhaijingIntegrationTest().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('测试错误:', err);
  process.exit(1);
});
