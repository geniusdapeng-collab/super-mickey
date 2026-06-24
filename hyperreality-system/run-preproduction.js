const { HyperrealitySystem } = require('./index');

async function main() {
  const system = new HyperrealitySystem({
    scriptEngine: {
      charactersDir: './characters'
    },
    productionEngine: {
      charactersDir: './characters',
      agentConfig: {
        enableLLMAgents: true,
        llmTimeout: 180000, // 【v2.1.4-fix10-P25-fix3】单次3分钟，快速失败重试
        llmMaxRetries: 2,
        llmModel: 'kimi-k2p6',
        fastModel: 'kimi-k2p6',
        totalDeadlineMs: 630000, // 【v2.1.4-fix10-P25-fix3】10.5分钟，给Phase3留足时间
        memThresholdMB: 1800, // 【v2.1.4-fix10-P25-fix3】避免GC风暴
        promptFusionConcurrency: 2, // 并发2
        checkpointDir: './checkpoints',
        enableResume: true
      }
    }
  });

  const intent = `穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。

【制作要求】
1.创意指数：0.8
2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都是沉陈卓一个人完成讲解，讲解过程要生动形象，带有自然的肢体语言或边走边介绍等，具体你可以发挥专业好莱坞大导演的风格，做成质感拉满的画质。
3.视频时长：59～65秒。
4.视频风格：人物角色和背景环境，要求全写实。
5.内容注意事项：视频只有第一集有片头镜头，开头需要主标题和副标题

【其他注意事项】
我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。
第一集【横纹肌溶解的症状以及实验室检查】
第二集【为什么会发生横纹肌溶解，常见的原因分析】
第三集【怎么处理和预防横纹肌溶解】

在每一集视频最后的时候，你不要预告下一集。`;

  const metadata = {
    title: '横纹肌溶解科普第一集',
    characters: [{
      character_id: 'chen-zhuo',
      name: '陈卓',
      species: 'human',
      gender: 'female',
      visual_anchor: {
        core_features: ['穿警服', '短发', '女性', '35-40岁']
      }
    }]
  };

  console.log('🔥 启动预生产（支持断点续跑）...');
  const result = await system.create(intent, metadata, {
    skipRender: true,
    skipPostProduction: true
  });

  console.log('\n✅ 预生产完成！');
  console.log('成功:', result.success);
  console.log('镜头数:', result.stages.productionEngine?.prompts?.length || 0);
  
  if (result.stages.productionEngine?.prompts) {
    for (const shot of result.stages.productionEngine.prompts) {
      console.log(`\n📷 ${shot.shotId || shot.shot_id}`);
      console.log(`   prompt长度: ${shot.prompt?.length || 0}`);
      console.log(`   字段数: ${Object.keys(shot.fields || {}).length}`);
    }
  }

  // 保存结果
  const fs = require('fs');
  const path = require('path');
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  fs.writeFileSync(
    path.join(outputDir, 'preproduction-result.json'),
    JSON.stringify(result, null, 2)
  );
  console.log('\n💾 结果已保存到 output/preproduction-result.json');
}

main().catch(e => {
  console.error('❌ 错误:', e);
  process.exit(1);
});
