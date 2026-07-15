/**
 * Seedance v9.4-Peng 性能基准测试
 *
 * 测试8个核心模块的性能指标：
 * - 初始化时间
 * - 单次操作耗时
 * - 内存占用
 * - 100次循环稳定性
 */

const { performance } = require('perf_hooks');
const { ContextManager } = require('./context-manager');
const { PermissionGate } = require('./permission-gate');
const { AgentLoop } = require('./agent-loop');
const { ToolPool } = require('./tool-pool');
const { StateMachine, STATES } = require('./state-machine');
const { MemorySystem } = require('./memory-system');
const { AgentSwarm } = require('./agent-swarm');
const { InteractiveMode } = require('./interactive-mode');

function benchmark(name, fn, iterations = 100) {
  // 预热
  for (let i = 0; i < 10; i++) fn();

  // 基准测试
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const total = performance.now() - start;

  return {
    name,
    iterations,
    totalMs: total.toFixed(2),
    avgMs: (total / iterations).toFixed(3),
    opsPerSecond: Math.round(iterations / (total / 1000))
  };
}

async function runBenchmark() {
  console.log('═══════════════════════════════════════════');
  console.log('  ⚡ Seedance v9.4-Peng 性能基准测试');
  console.log('  环境: Node.js ' + process.version);
  console.log('═══════════════════════════════════════════\n');

  const results = [];

  // 1. Context Manager
  results.push(benchmark('ContextManager.init', () => {
    new ContextManager();
  }, 100));

  results.push(benchmark('ContextManager.addItem', () => {
    const cm = new ContextManager();
    cm.addContextItem('shot', '测试镜头内容', 1, 'test');
  }, 100));

  // 2. Permission Gate
  results.push(benchmark('PermissionGate.evaluate', () => {
    const pg = new PermissionGate();
    pg.evaluate('RENDER', 85, { shot: 'test' });
  }, 100));

  // 3. State Machine
  results.push(benchmark('StateMachine.transition', () => {
    const sm = new StateMachine({ taskName: 'test' });
    sm.transition(STATES.PLANNING);
    sm.transition(STATES.RENDERING);
    sm.transition(STATES.POST_PRODUCTION);
    sm.transition(STATES.SOUND);
    sm.transition(STATES.DELIVERING);
    sm.transition(STATES.DONE);
  }, 100));

  // 4. Tool Pool
  results.push(benchmark('ToolPool.init', () => {
    const pool = new ToolPool();
    pool.init();
  }, 100));

  results.push(benchmark('ToolPool.resolveDeps', () => {
    const pool = new ToolPool();
    pool.resolveDependencies(['delivery', 'post-production', 'seedance-render']);
  }, 100));

  // 5. Memory System
  results.push(benchmark('MemorySystem.capture', () => {
    const mem = new MemorySystem();
    mem.captureRender({ model: 'test' }, { title: 'test' });
  }, 100));

  results.push(benchmark('MemorySystem.retrieve', () => {
    const mem = new MemorySystem();
    mem.captureRender({ model: 'test' }, { title: 'test' });
    mem.retrieve({ title: 'test' });
  }, 100));

  // 6. Agent Swarm
  results.push(benchmark('AgentSwarm.splitBatches', () => {
    const shots = Array(25).fill(null).map((_, i) => ({
      id: `shot_${i}`,
      priority: i < 5 ? 3 : (i < 10 ? 2 : 1)
    }));
    AgentSwarm.splitBatches(shots);
  }, 100));

  // 7. Interactive Mode
  results.push(benchmark('InteractiveMode.process', async () => {
    const im = new InteractiveMode();
    await im.process('做一个短片');
  }, 10)); // 异步操作减少迭代次数

  // 打印结果
  console.log('📊 性能基准结果:\n');
  console.log('模块'.padEnd(25) + '迭代'.padEnd(8) + '总耗时'.padEnd(10) + '单次平均'.padEnd(12) + 'OPS');
  console.log('-'.repeat(65));

  let totalOps = 0;
  for (const r of results) {
    console.log(
      r.name.padEnd(25) +
      String(r.iterations).padEnd(8) +
      r.totalMs + 'ms'.padEnd(10) +
      r.avgMs + 'ms'.padEnd(12) +
      r.opsPerSecond
    );
    totalOps += r.opsPerSecond;
  }

  console.log('-'.repeat(65));
  console.log('平均OPS: ' + Math.round(totalOps / results.length));

  // 内存报告
  const memUsage = process.memoryUsage();
  console.log('\n💾 内存使用:');
  console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`);

  return results;
}

runBenchmark().then(() => {
  console.log('\n✅ 性能基准测试完成！');
}).catch(err => {
  console.error('测试错误:', err);
});
