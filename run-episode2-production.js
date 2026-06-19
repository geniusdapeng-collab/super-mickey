const { HyperrealitySystem } = require('./hyperreality-system');
const fs = require('fs');

async function continueProduction() {
  console.log('🔥 [第二集预生产] 继续制作环节...');
  
  const system = new HyperrealitySystem({
    scriptEngine: {
      llmEngine: { model: 'kimi-k2p6', temperature: 1.0 }
    }
  });

  // 加载已生成的剧本
  const blueprint = JSON.parse(fs.readFileSync('./output/episode2-preproduction/blueprint.json', 'utf8'));
  console.log('📖 剧本加载成功:', blueprint.meta.title);
  console.log('   场景:', blueprint.meta.scenes_count, '| 角色:', blueprint.character_system.characters.length);

  // 模拟剧本引擎输出
  const scriptResult = {
    blueprint: { meta: blueprint.meta },
    adapted: {
      title: blueprint.meta.title,
      narrativeMode: blueprint.meta.narrative_mode,
      targetDuration: blueprint.meta.target_duration,
      scenes: blueprint.structure.scenes.map(s => ({
        sceneId: s.scene_id,
        sceneType: s.scene_type,
        timing: s.timing,
        characters: s.characters,
        dialogue: s.dialogue,
        visualNotes: s.visual_notes,
        emotionalTarget: s.emotional_target
      })),
      characters: blueprint.character_system.characters.map(c => ({
        id: c.character_id,
        name: c.name,
        role: c.role,
        voiceProfile: c.voice_profile,
        visualAnchor: c.visual_anchor
      })),
      voiceSystem: blueprint.voice_system,
      worldSetting: blueprint.world_setting
    },
    validation: { passed: true, overall_score: 85 },
    report: {
      scenes_count: blueprint.meta.scenes_count,
      characters_count: blueprint.character_system.characters.length,
      dialogues_count: blueprint.structure.scenes.reduce((sum, s) => sum + (s.dialogue?.lines?.length || 0), 0)
    }
  };

  // 执行制作引擎
  console.log('\n🎬 [Layer 2] 制作引擎 - 生成镜头...');
  const productionResult = await system.productionEngine.produce(scriptResult.adapted);
  
  console.log('✅ 制作完成');
  console.log('   镜头:', productionResult.shots.length);
  console.log('   Prompts:', productionResult.prompts.length);
  
  // 保存结果
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  fs.writeFileSync(
    `./output/episode2-preproduction/production-${timestamp}.json`,
    JSON.stringify(productionResult, null, 2)
  );
  
  // 保存Prompts
  if (productionResult.prompts) {
    const promptsMD = productionResult.prompts.map(p => 
      `## ${p.shotId}\n\n${p.prompt}\n\n---\n`
    ).join('\n');
    fs.writeFileSync(`./output/episode2-preproduction/prompts-${timestamp}.md`, promptsMD);
    
    // 同时保存纯文本版本供审核
    const promptsTxt = productionResult.prompts.map(p => 
      `=== ${p.shotId} ===\n${p.prompt}\n\n`
    ).join('');
    fs.writeFileSync(`./output/episode2-preproduction/prompts-${timestamp}.txt`, promptsTxt);
  }
  
  console.log('\n📁 输出文件:');
  console.log('   - blueprint.json (剧本)');
  console.log('   - production-*.json (制作结果)');
  console.log('   - prompts-*.md/txt (镜头Prompts)');
  
  return productionResult;
}

continueProduction().catch(err => {
  console.error('❌ 制作失败:', err);
  process.exit(1);
});
