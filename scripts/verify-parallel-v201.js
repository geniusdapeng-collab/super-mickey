/**
 * 快速验证脚本：v2.0.1-parallel 并行化方案
 * 不调用真实LLM，仅验证并行编排逻辑
 */
const path = require('path');

// 切换到 workspace 目录
process.chdir(path.join(__dirname, '..'));

// 模拟运行预生产（跳过剧本引擎，直接加载已有blueprint）
async function quickVerify() {
  console.log('=== v2.0.1-parallel 快速验证 ===\n');

  // 1. 验证文件可加载
  try {
    const { BaseAgent } = require('../hyperreality-system/engines/production-engine/agents/base-agent.js');
    console.log('✅ base-agent.js 加载成功');

    const { LLMEngine } = require('../systems/llm-reasoning-engine.js');
    console.log('✅ llm-reasoning-engine.js 加载成功');

    const ProductionEngine = require('../hyperreality-system/engines/production-engine/production-engine.js');
    console.log('✅ production-engine.js 加载成功');
  } catch (e) {
    console.error('❌ 文件加载失败:', e.message);
    process.exit(1);
  }

  // 2. 验证并行辅助方法存在
  const { ProductionEngine } = require('../hyperreality-system/engines/production-engine/production-engine.js');
  const engine = new ProductionEngine({ maxPromptLength: 1500 });

  const requiredMethods = [
    '_shouldGenerateOpening',
    '_setAgentDeadline',
    '_cloneShots',
    '_mergeShotsByShotId',
    '_runParallel',
    '_emptyAgentResult'
  ];

  for (const method of requiredMethods) {
    if (typeof engine[method] === 'function') {
      console.log(`✅ ${method}() 存在`);
    } else {
      console.error(`❌ ${method}() 不存在`);
      process.exit(1);
    }
  }

  // 3. 验证 _cloneShots
  const testShots = [
    { shotId: 'S01', scene: 'test', mood: 'calm' },
    { shotId: 'S02', scene: 'test2', mood: 'tense' }
  ];
  const cloned = engine._cloneShots(testShots);
  cloned[0].scene = 'modified';
  if (testShots[0].scene === 'test' && cloned[0].scene === 'modified') {
    console.log('✅ _cloneShots 浅拷贝正确');
  } else {
    console.error('❌ _cloneShots 浅拷贝失败');
    process.exit(1);
  }

  // 4. 验证 _mergeShotsByShotId
  const baseShots = [
    { shotId: 'S01', scene: 'original', mood: 'calm' },
    { shotId: 'S02', scene: 'original2', mood: 'tense' }
  ];
  const updatedShots = [
    { shotId: 'S01', scene: 'enhanced', cameraString: 'wide' },
    { shotId: 'S02', lightingString: 'warm' }
  ];
  const merged = engine._mergeShotsByShotId(baseShots, updatedShots, ['scene', 'cameraString', 'lightingString']);
  if (merged[0].scene === 'enhanced' && merged[0].cameraString === 'wide' && merged[1].lightingString === 'warm') {
    console.log('✅ _mergeShotsByShotId 合并正确');
  } else {
    console.error('❌ _mergeShotsByShotId 合并失败');
    process.exit(1);
  }

  // 5. 验证 _runParallel（使用模拟Promise）
  const parallelResult = await engine._runParallel({
    'task-a': Promise.resolve({ shots: [{ shotId: 'S01', field: 'a' }] }),
    'task-b': Promise.resolve({ shots: [{ shotId: 'S02', field: 'b' }] })
  }, 'TEST-PHASE');

  if (parallelResult.length === 2 && parallelResult[0].shots[0].field === 'a') {
    console.log('✅ _runParallel 并行执行正确');
  } else {
    console.error('❌ _runParallel 并行执行失败');
    process.exit(1);
  }

  // 6. 验证 _shouldGenerateOpening
  const bpWithOpening = { config: { _metadata: { isSeries: true, episodeNumber: 1 } } };
  const bpNoOpening = { config: { _metadata: { isSeries: true, episodeNumber: 2 } } };
  if (engine._shouldGenerateOpening(bpWithOpening) === true && engine._shouldGenerateOpening(bpNoOpening) === false) {
    console.log('✅ _shouldGenerateOpening 逻辑正确');
  } else {
    console.error('❌ _shouldGenerateOpening 逻辑失败');
    process.exit(1);
  }

  // 7. 验证全局截止时间配置
  if (engine.agentConfig.totalDeadlineMs === 660000) {
    console.log('✅ 全局截止时间配置正确 (660000ms)');
  } else {
    console.error(`❌ 全局截止时间配置错误: ${engine.agentConfig.totalDeadlineMs}`);
    process.exit(1);
  }

  console.log('\n=== 全部验证通过 ✅ ===');
  console.log('并行化方案已就绪，可以运行完整预生产测试');
}

quickVerify().catch(e => {
  console.error('验证失败:', e);
  process.exit(1);
});
