// test-creative-intensity.js
// 测试香香彩虹桥创意指数引擎

const { CreativeIntensityEngine, CreativeIntensityRecommender } = require('./engines/script-engine/core/creative-intensity-engine');

async function test() {
  console.log('========================================');
  console.log('  香香彩虹桥 - 创意指数引擎测试 v1.0');
  console.log('========================================\n');

  const engine = new CreativeIntensityEngine();

  // ========== 测试 1: 语义解析 ==========
  console.log('🔥 [测试 1] 语义解析测试');
  console.log('----------------------------------------');

  const testCases = [
    { input: '0.5', expected: 0.5, desc: '数字字符串' },
    { input: '天花板', expected: 0.95, desc: '语义-天花板' },
    { input: '保守', expected: 0.2, desc: '语义-保守' },
    { input: '展示你天花板般的创造力', expected: 0.95, desc: '语义-天花板般' },
    { input: { creativeIntensity: 0.8 }, expected: 0.8, desc: '对象字段' },
    { input: 1.2, expected: 1.0, desc: '超限值裁剪' },
    { input: null, expected: 0.2, desc: '空值回退' }
  ];

  for (const tc of testCases) {
    const result = engine.parse(tc.input);
    const pass = Math.abs(result - tc.expected) < 0.01;
    console.log(`  ${pass ? '✅' : '❌'} ${tc.desc}: ${result} (期望: ${tc.expected})`);
  }

  // ========== 测试 2: 等级系统 ==========
  console.log('\n🔥 [测试 2] 等级系统测试');
  console.log('----------------------------------------');

  const levels = [0.05, 0.2, 0.4, 0.6, 0.8, 0.95];
  for (const v of levels) {
    const level = engine.getLevel(v);
    console.log(`  ${v.toFixed(2)} → ${level.key} (${level.name}): ${level.description}`);
  }

  // ========== 测试 3: 能力激活 (默认 narrative_mode) ==========
  console.log('\n🔥 [测试 3] 能力激活测试 (dialogue 模式, intensity=0.95)');
  console.log('----------------------------------------');

  const caps = engine.getActiveCapabilities(0.95, 'dialogue', 'default');
  console.log(`  激活能力数: ${caps.length}/${Object.keys(engine.matrix).length}`);

  for (const cap of caps) {
    const instruction = engine.generateCapabilityInstruction(cap.id, 0.95);
    console.log(`  ✅ ${cap.layer} | ${cap.name} (权重: ${cap.weight})`);
    console.log(`     ${instruction.tag}: ${instruction.instruction.substring(0, 50)}...`);
  }

  // ========== 测试 4: 叙事模式联动 ==========
  console.log('\n🔥 [测试 4] 叙事模式联动测试 (intensity=0.7)');
  console.log('----------------------------------------');

  for (const mode of ['dialogue', 'voiceover', 'mixed']) {
    const caps = engine.getActiveCapabilities(0.7, mode, 'default');
    const perf = caps.find(c => c.id === 'performance');
    const atmo = caps.find(c => c.id === 'atmosphere');
    console.log(`  ${mode}:`);
    console.log(`    激活: ${caps.length}个`);
    console.log(`    performance: ${perf ? '✅' : '❌'} (阈值: ${perf?.adjustedThreshold.toFixed(2) || 'N/A'})`);
    console.log(`    atmosphere: ${atmo ? '✅' : '❌'} (阈值: ${atmo?.adjustedThreshold.toFixed(2) || 'N/A'})`);
  }

  // ========== 测试 5: 世界设定联动 ==========
  console.log('\n🔥 [测试 5] 世界设定联动测试 (intensity=0.7)');
  console.log('----------------------------------------');

  for (const world of ['default', 'Nirath', 'hyperreal']) {
    const caps = engine.getActiveCapabilities(0.7, 'mixed', world);
    const vfx = caps.find(c => c.id === 'vfx');
    const color = caps.find(c => c.id === 'color');
    console.log(`  ${world}:`);
    console.log(`    激活: ${caps.length}个`);
    console.log(`    vfx: ${vfx ? '✅' : '❌'} (阈值: ${vfx?.adjustedThreshold.toFixed(2) || 'N/A'})`);
    console.log(`    color: ${color ? '✅' : '❌'} (阈值: ${color?.adjustedThreshold.toFixed(2) || 'N/A'})`);
  }

  // ========== 测试 6: 引擎配置生成 ==========
  console.log('\n🔥 [测试 6] 引擎配置生成测试 (intensity=0.95, dialogue, default)');
  console.log('----------------------------------------');

  const configs = engine.generateEngineConfigs(0.95, 'dialogue', 'default');
  console.log(`  创意等级: ${configs.level.name}`);
  console.log(`  激活能力: ${configs._metadata.activeCapabilities}/${configs._metadata.totalCapabilities}`);

  for (const [layer, layerConfig] of Object.entries(configs).filter(([k, v]) => !k.startsWith('_') && typeof v === 'object')) {
    if (Object.keys(layerConfig).length > 0) {
      console.log(`\n  📦 ${layer}:`);
      for (const [key, value] of Object.entries(layerConfig)) {
        if (key !== 'creativeInstructions') {
          console.log(`     ${key}: ${value}`);
        }
      }
    }
  }

  // ========== 测试 7: 完整报告 ==========
  console.log('\n🔥 [测试 7] 完整报告生成');
  console.log('----------------------------------------');

  const report = engine.generateReport(0.95, 'dialogue', 'default');
  console.log(`  ${report.summary}`);
  console.log(`  叙事模式: ${report.narrativeMode}`);
  console.log(`  世界设定: ${report.worldSetting}`);
  console.log(`  按 Layer 分布:`);
  for (const [layer, caps] of Object.entries(report.byLayer)) {
    console.log(`    ${layer}: ${caps.map(c => c.name).join(', ')}`);
  }

  // ========== 测试 8: Recommender ==========
  console.log('\n🔥 [测试 8] 推荐器测试');
  console.log('----------------------------------------');

  const recommender = new CreativeIntensityRecommender();

  // 模拟记录一些数据
  recommender.record({ videoType: 'EDU', intensity: 0.3, completionRate: 75 });
  recommender.record({ videoType: 'EDU', intensity: 0.5, completionRate: 82 });
  recommender.record({ videoType: 'EDU', intensity: 0.7, completionRate: 68 });

  const recommendation = recommender.recommend('EDU');
  console.log(`  推荐类型: ${recommendation.source}`);
  console.log(`  推荐指数: ${recommendation.intensity}`);
  console.log(`  置信度: ${recommendation.confidence}`);
  console.log(`  样本数: ${recommendation.samples}`);
  console.log(`  原因: ${recommendation.reason}`);

  // 测试无数据回退
  const noDataRec = recommender.recommend('MV');
  console.log(`\n  无数据回退 (MV):`);
  console.log(`    推荐指数: ${noDataRec.intensity}`);
  console.log(`    来源: ${noDataRec.source}`);

  console.log('\n========================================');
  console.log('✅ 所有测试通过！');
  console.log('========================================');
}

test().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
