const path = require('path');
const PKG_VERSION = require('../package.json').version;

console.log(`🧪 [SuperMickey v${PKG_VERSION} + PandaCineForge] 集成测试\n`);

// 【v2.2.8-审计修复】实例收集表：旧实现测试完成后不关闭实例，
// HealthMonitor 30s 心跳定时器永久挂住事件循环，npm test / CI 永不退出。
const createdSystems = [];

// 1. 测试适配器加载
console.log('1. 测试适配器加载...');
try {
  const { PandaCineForgeAdapter } = require('../hyperreality-system/engines/panda-cineforge-adapter');
  const adapter = new PandaCineForgeAdapter({ enabled: false });
  console.log('   ✅ 适配器加载成功 | 默认禁用:', !adapter.enabled);
} catch (e) {
  console.error('   ❌ 适配器加载失败:', e.message);
  process.exit(1);
}

// 2. 测试主链路加载（禁用 PandaCineForge）
console.log('2. 测试主链路加载（禁用模式）...');
try {
  const HyperRealitySystem = require('../hyperreality-system/index.js').HyperrealitySystem;
  const system = new HyperRealitySystem({
    pandaCineForge: { enabled: false }
  });
  createdSystems.push(system);
  console.log('   ✅ 主链路加载成功 | PandaCineForge 禁用:', !system.pandaAdapter.enabled);
  console.log('   ✅ 引擎数量:', Object.keys(system).filter(k => k.includes('Engine') || k.includes('Adapter')).length);
} catch (e) {
  console.error('   ❌ 主链路加载失败:', e.message);
  process.exit(1);
}

// 3. 测试主链路加载（启用 PandaCineForge，但不自动启动）
console.log('3. 测试主链路加载（启用模式，不自动启动）...');
try {
  const HyperRealitySystem = require('../hyperreality-system/index.js').HyperrealitySystem;
  const system = new HyperRealitySystem({
    pandaCineForge: { enabled: true, autoStart: false }
  });
  createdSystems.push(system);
  console.log('   ✅ 主链路加载成功 | PandaCineForge 启用:', system.pandaAdapter.enabled);
  console.log('   ✅ 适配器可用:', system.pandaAdapter.available);
} catch (e) {
  console.error('   ❌ 主链路加载失败:', e.message);
  process.exit(1);
}

// 4. 测试健康检查（如果服务在运行）
console.log('4. 测试健康检查...');
(async () => {
  try {
    const HyperRealitySystem = require('../hyperreality-system/index.js').HyperrealitySystem;
    const system = new HyperRealitySystem({
      pandaCineForge: { enabled: true, autoStart: false }
    });
    createdSystems.push(system);
    const health = await system.pandaAdapter.health();
    console.log('   ✅ 健康检查:', health.status, '| 引擎:', health.engine_available, '| 技能数:', health.skill_count);
  } catch (e) {
    console.log('   ⚠️ 健康检查失败（服务未运行）:', e.message);
  }

  console.log('\n✅ 集成测试完成');

  // 【v2.2.8-审计修复】收尾：停止全部实例的 HealthMonitor 定时器并显式退出。
  // gracefulShutdown 失败不阻断退出（清理动作，不影响测试结论）。
  try {
    const { gracefulShutdown } = require('../hyperreality-system/utils/graceful-shutdown');
    for (const inst of createdSystems) {
      inst._shuttingDown = true;
      await gracefulShutdown({
        healthMonitor: inst.productionEngine?.healthMonitor || null,
        agents: [inst.productionEngine, inst.scriptEngine, inst.renderingEngine].filter(Boolean),
        timeoutMs: 5000
      }).catch(() => {});
    }
  } catch (_) { /* 清理异常不影响测试结果 */ }
  process.exit(0);
})();
