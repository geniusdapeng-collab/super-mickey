const { ProductionEngine } = require('./engines/production-engine/production-engine');
const fs = require('fs');
const path = require('path');

async function main() {
  // 加载 checkpoint
  const checkpointPath = './checkpoints/checkpoint-phase2.json';
  if (!fs.existsSync(checkpointPath)) {
    console.error('Checkpoint not found:', checkpointPath);
    process.exit(1);
  }

  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  console.log(`📂 加载 checkpoint: phase2, ${checkpoint.shots.length} 镜头`);

  // 构建适配后的 blueprint（简化版）
  const adaptedBlueprint = {
    config: { aspectRatio: '16:9', title: '横纹肌溶解科普第一集' },
    character_system: {
      characters: [{
        character_id: 'chen-zhuo',
        name: '陈卓',
        visual_anchor: { core_features: ['穿警服', '短发', '女性'] }
      }]
    },
    scenes: checkpoint.shots.map(s => ({
      shotId: s.shotId,
      sceneType: s.sceneType,
      duration: s.duration,
      scene: s.scene,
      mood: s.mood,
      character: s.character,
      action: s.action,
      dialogue: s.dialogue,
      emotionalTarget: s.emotionalTarget
    }))
  };

  // 初始化 ProductionEngine
  const engine = new ProductionEngine({
    charactersDir: './characters',
    agentConfig: {
      enableLLMAgents: true,
      llmTimeout: 600000,
      llmMaxRetries: 2,
      llmModel: 'kimi-k2p6',
      fastModel: 'kimi-k2p6',
      totalDeadlineMs: 1800000,
      promptFusionConcurrency: 2,
      checkpointDir: './checkpoints',
      enableResume: true
    }
  });

  console.log('🎬 从 Phase 3 开始...');
  const result = await engine.produce(adaptedBlueprint);

  console.log('\n✅ Phase 3 完成！');
  console.log(`镜头: ${result.shots.length}`);
  
  // 检查 prompt 长度和字段
  for (const shot of result.shots) {
    const prompt = shot.prompt || '';
    const fields = shot.fields || {};
    console.log(`\n📷 ${shot.shotId || shot.shot_id}`);
    console.log(`   prompt长度: ${prompt.length} (目标: 2500+)`);
    console.log(`   字段数: ${Object.keys(fields).length}`);
    if (fields) {
      const keyFields = ['constraint', 'baseline', 'scene', 'lighting', 'composition', 'color_palette', 'depth_of_field', 'camera_movement', 'character', 'action', 'dialogue', 'timeline', 'mood', 'negative', 'bright_constraint', 'director_instruction', 'consistency'];
      const missing = keyFields.filter(f => !fields[f] || fields[f] === '');
      if (missing.length > 0) {
        console.log(`   ❌ 缺失字段: ${missing.join(', ')}`);
      } else {
        console.log(`   ✅ 所有关键字段完整！`);
      }
    }
  }

  // 保存结果
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'phase3-result.json'),
    JSON.stringify(result, null, 2)
  );
  console.log('\n💾 结果已保存到 output/phase3-result.json');
}

main().catch(e => {
  console.error('❌ 错误:', e);
  process.exit(1);
});
