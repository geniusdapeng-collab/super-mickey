const { HyperrealitySystem } = require('./hyperreality-system');
const fs = require('fs');
const path = require('path');

async function runEpisode2PreProduction() {
  console.log('🔥 [第二集预生产] 横纹肌溶解原因分析');
  console.log('='.repeat(50));

  const system = new HyperrealitySystem({
    scriptEngine: {
      llmEngine: {
        model: 'kimi-k2p6',
        temperature: 1.0
      }
    }
  });

  const intent = `穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第二集【为什么会发生横纹肌溶解，常见的原因分析】。

要求：
1. 创意指数0.49
2. 专业度+通俗易懂兼顾
3. 陈卓一个人讲解，生动形象，自然肢体语言，边走边介绍
4. 59-65秒，横屏16:9
5. 全写实风格，好莱坞导演质感
6. 无片头（第一集才有片头）
7. 不预告下一集
8. 内容聚焦：过度运动、挤压伤、药物副作用、代谢疾病等常见原因`;

  const metadata = {
    title: '横纹肌溶解原因分析',
    episode: 2,
    totalEpisodes: 3,
    seriesTitle: '全民健康科普：认识横纹肌溶解',
    creativeIntensity: 0.49,
    style: 'REAL',
    target_duration: 62,
    aspectRatio: '16:9',
    platform: '视频号/B站',
    characters: [{
      id: 'chen-zhuo',
      name: '陈卓',
      description: '35岁左右女性，穿警服，短发干练，亲和专业，健康科普讲师',
      role: 'protagonist'
    }],
    contentConstraints: [
      '不包含症状描述（第一集已覆盖）',
      '不包含实验室检查（第一集已覆盖）',
      '不包含急救处理（第三集内容）',
      '不包含预防措施（第三集内容）',
      '结尾不预告下一集'
    ]
  };

  const result = await system.create(intent, metadata, {
    skipRequirementList: true,
    skipRequirementConfirmation: true,
    skipPromptReview: false,
    skipRender: true,
    skipPostProduction: true
  });

  const outputDir = './output/episode2-preproduction';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  fs.writeFileSync(
    path.join(outputDir, `preproduction-${timestamp}.json`),
    JSON.stringify(result, null, 2)
  );

  if (result.finalReport) {
    fs.writeFileSync(
      path.join(outputDir, `report-${timestamp}.md`),
      result.finalReport
    );
  }

  if (result.stages?.productionEngine?.prompts) {
    const promptsMD = result.stages.productionEngine.prompts.map(p => 
      `## ${p.shotId}\n\n${p.prompt}\n\n---\n`
    ).join('\n');
    fs.writeFileSync(
      path.join(outputDir, `prompts-${timestamp}.md`),
      promptsMD
    );
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ 第二集预生产完成！');
  console.log(`📁 输出目录: ${outputDir}`);
  console.log(`⏱️ 总耗时: ${result.timing?.total || 'N/A'}ms`);
  console.log(`🎬 镜头数: ${result.stages?.productionEngine?.shots?.length || 0}`);

  return result;
}

runEpisode2PreProduction().catch(err => {
  console.error('❌ 预生产失败:', err);
  process.exit(1);
});
