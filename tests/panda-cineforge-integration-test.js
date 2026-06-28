#!/usr/bin/env node
/**
 * PandaCineForge 集成测试
 * 验证 SuperMickey 主链路加载 + PandaCineForge 适配器注入
 */

const path = require('path');

console.log('🧪 [SuperMickey v2.1.0 + PandaCineForge] 集成测试\n');

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
    const health = await system.pandaAdapter.health();
    console.log('   ✅ 健康检查:', health.status, '| 引擎:', health.engine_available, '| 技能数:', health.skill_count);
  } catch (e) {
    console.log('   ⚠️ 健康检查失败（服务未运行）:', e.message);
  }

  console.log('\n✅ 集成测试完成');
})();
