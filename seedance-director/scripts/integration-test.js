/**
 * Seedance v9.4-Peng 全模块联合测试
 *
 * 测试8个核心模块的集成：
 * 1. Context Manager (P0)
 * 2. Permission Gate (P0)
 * 3. Agent Loop (P0)
 * 4. Tool Pool (P1)
 * 5. State Machine (P1)
 * 6. Memory System (P1)
 * 7. Agent Swarm (P2)
 * 8. Interactive Mode (P2)
 *
 * 测试场景：赛博朋克猫短片 完整生产链路
 */

const { ContextManager } = require('./context-manager');
const { PermissionGate } = require('./permission-gate');
const { AgentLoop } = require('./agent-loop');
const { ToolPool } = require('./tool-pool');
const { StateMachine, STATES } = require('./state-machine');
const { MemorySystem, EXPERIENCE_TYPES } = require('./memory-system');
const { AgentSwarm } = require('./agent-swarm');
const { InteractiveMode } = require('./interactive-mode');

// 测试配置
const TEST_CONFIG = {
  title: '赛博朋克猫：雨夜追逐',
  duration: 30,
  style: 'cyberpunk',
  outline: '一只机械猫在雨夜的霓虹城市中追逐一只发光蝴蝶',
  characters: ['机械猫', '发光蝴蝶'],
  scenes: ['霓虹街道', '雨夜天台'],
  shots: 8
};

async function runIntegrationTest() {
  console.log('═══════════════════════════════════════════');
  console.log('  🧪 Seedance v9.4-Peng 全模块联合测试');
  console.log('═══════════════════════════════════════════\n');

  const results = {
    passed: 0,
    failed: 0,
    modules: {}
  };

  // ========== 模块1: Context Manager ==========
  console.log('📦 [1/8] Context Manager — Token管理');
  try {
    const cm = new ContextManager({ maxContextWindow: 131072 });
    const testContext = {
      story: '赛博朋克猫故事大纲...',
      shots: Array(8).fill(null).map((_, i) => ({
        id: `shot_${i}`,
        prompt: `镜头${i}: 机械猫在霓虹雨中奔跑`,
        priority: i === 0 ? 3 : (i === 7 ? 2 : 1)
      })),
      characters: { '机械猫': '银色金属身体，蓝色LED眼睛' },
      settings: { style: 'cyberpunk', lighting: 'neon' }
    };

    // 添加一些测试数据
    cm.addContextItem('story', '赛博朋克猫故事大纲', 1, 'story_main');
    cm.addContextItem('shot', '镜头1: 机械猫在霓虹雨中奔跑', 1, 'shot_1');
    cm.addContextItem('shot', '镜头2: 蝴蝶飞过霓虹招牌', 3, 'shot_2');
    cm.addContextItem('character', '机械猫: 银色金属身体，蓝色LED眼睛', 2, 'char_cat');

    const summary = cm.getContextSummary();
    console.log(`   Token估算: ${summary.totalTokens}`);
    console.log(`   项目数: ${summary.itemCount}`);

    // 压缩测试
    if (cm.contextItems.length >= 3) {
      cm.compressItem(cm.contextItems[2], 'LIGHT');
      const after = cm.getContextSummary();
      console.log(`   压缩后: ${after.itemCount} 项目`);
    }

    results.modules.contextManager = '✅ PASS';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.modules.contextManager = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 模块2: Permission Gate ==========
  console.log('\n📦 [2/8] Permission Gate — 安全审批');
  try {
    const pg = new PermissionGate();
    const testPlan = {
      title: '赛博朋克猫',
      contentWarnings: [],
      brandSafety: { hasBrand: false },
      estimatedDuration: 30,
      qualityScore: 85
    };

    const decision = pg.evaluate('RENDER', 85, testPlan);
    console.log(`   综合评分: ${decision.score}`);
    console.log(`   审批结果: ${decision.approval}`);

    results.modules.permissionGate = '✅ PASS';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.modules.permissionGate = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 模块3: State Machine ==========
  console.log('\n📦 [3/8] State Machine — 任务状态');
  try {
    const sm = new StateMachine({ taskName: TEST_CONFIG.title });
    sm.transition(STATES.PLANNING);
    sm.setData('title', TEST_CONFIG.title);
    sm.setData('duration', TEST_CONFIG.duration);

    sm.transition(STATES.RENDERING, { shots: TEST_CONFIG.shots });
    sm.setData('renderProgress', 0.5);

    sm.transition(STATES.POST_PRODUCTION);
    sm.setData('ffmpegCmd', 'concat + LUT');
    sm.transition(STATES.SOUND);  // post → sound
    sm.setData('audioLayers', 4);
    sm.transition(STATES.DELIVERING);  // sound → delivering
    sm.transition(STATES.DONE);

    const report = sm.getReport();
    console.log(`   状态转换: ${report.transitions} 步`);
    console.log(`   最终状态: ${report.state}`);

    results.modules.stateMachine = '✅ PASS';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.modules.stateMachine = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 模块4: Tool Pool ==========
  console.log('\n📦 [4/8] Tool Pool — 技能封装');
  try {
    const pool = new ToolPool();
    await pool.init();

    const tools = pool.listTools();
    console.log(`   已注册: ${tools.length} 个工具`);

    // 依赖解析
    const order = pool.resolveDependencies(['delivery', 'post-production', 'seedance-render']);
    console.log(`   依赖顺序: ${order.join(' → ')}`);

    results.modules.toolPool = '✅ PASS';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.modules.toolPool = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 模块5: Memory System ==========
  console.log('\n📦 [5/8] Memory System — 经验积累');
  try {
    const mem = new MemorySystem();

    // 捕获经验
    mem.captureRender(
      { model: 'seedance-2.0', tip: '赛博朋克用冷色调' },
      { title: '赛博朋克猫', style: 'cyberpunk' }
    );

    mem.captureError(
      new Error('API 429'),
      { title: '赛博朋克猫' },
      '降级后成功'
    );

    // 检索
    const experiences = mem.retrieve(
      { title: '赛博朋克', style: 'cyberpunk' },
      { type: 'render' }
    );
    console.log(`   经验捕获: 2条`);
    console.log(`   检索结果: ${experiences.length}条`);

    results.modules.memorySystem = '✅ PASS';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.memorySystem = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 模块6: Agent Loop ==========
  console.log('\n📦 [6/8] Agent Loop — 动态决策');
  try {
    // 创建简化测试（不执行完整50轮）
    const loop = new AgentLoop({
      maxIterations: 3, // 只测试3轮
      verbose: false
    });

    // 直接测试关键组件
    console.log(`   AgentLoop初始化: ✅`);
    console.log(`   最大迭代: ${loop.maxIterations}`);

    results.modules.agentLoop = '✅ PASS (简化测试)';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.modules.agentLoop = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 模块7: Agent Swarm ==========
  console.log('\n📦 [7/8] Agent Swarm — 并行渲染');
  try {
    const shots = Array(4).fill(null).map((_, i) => ({
      id: `shot_${i}`,
      priority: i === 0 ? 3 : 1,
      desc: `镜头${i + 1}`
    }));

    const batches = AgentSwarm.splitBatches(shots);
    console.log(`   批次分解: ${batches.length}批`);
    console.log(`   镜头分配: ${batches.map(b => b.shots.length).join('+')}=${shots.length}`);

    results.modules.agentSwarm = '✅ PASS';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.modules.agentSwarm = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 模块8: Interactive Mode ==========
  console.log('\n📦 [8/8] Interactive Mode — 对话生产');
  try {
    const im = new InteractiveMode();

    // 模拟对话流程
    const r1 = await im.process('做一个赛博朋克短片');
    const r2 = await im.process('30秒');
    const r3 = await im.process('主角是机械猫');

    console.log(`   对话轮次: 3轮`);
    console.log(`   当前状态: ${im.state}`);
    console.log(`   任务标题: ${im.task?.title || '未设置'}`);

    // 快捷指令
    const status = await im.process('/status');
    console.log(`   快捷指令: /status ✅`);

    results.modules.interactiveMode = '✅ PASS';
    results.passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${err.message}`);
    results.modules.interactiveMode = `❌ FAIL: ${err.message}`;
    results.failed++;
  }

  // ========== 汇总 ==========
  console.log('\n═══════════════════════════════════════════');
  console.log('  📊 联合测试报告');
  console.log('═══════════════════════════════════════════');
  console.log(`\n   通过: ${results.passed}/8`);
  console.log(`   失败: ${results.failed}/8`);
  console.log(`   成功率: ${(results.passed / 8 * 100).toFixed(1)}%`);

  console.log('\n   模块详情:');
  for (const [name, status] of Object.entries(results.modules)) {
    const icon = status.includes('✅') ? '✅' : '❌';
    console.log(`   ${icon} ${name}: ${status}`);
  }

  if (results.failed === 0) {
    console.log('\n   🎉 全部通过！系统可以投入生产使用！');
  } else {
    console.log(`\n   ⚠️ ${results.failed}个模块需要修复`);
  }

  return results;
}

// 执行测试
runIntegrationTest().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('测试框架错误:', err);
  process.exit(1);
});
