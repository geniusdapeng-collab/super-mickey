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
        llmTimeout: 180000,
        llmMaxRetries: 2,
        llmModel: 'kimi-k2p6',
        fastModel: 'kimi-k2p6',
        totalDeadlineMs: 900000, // 【v2.1.4-fix11】15分钟总预算
        memThresholdMB: 1800,
        promptFusionConcurrency: 1, // 【v2.1.4-fix11】串行处理
        checkpointDir: './checkpoints',
        enableResume: true
      }
    }
  });

  const intent = `穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。

【制作要求】
1.创意指数：0.56
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

  // 【v2.1.4-fix11-E】自动续跑：最多重试3次
  const MAX_RETRIES = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`\n🔥 启动预生产（尝试 ${attempt}/${MAX_RETRIES}）...`);
    
    const result = await system.create(intent, metadata, {
      skipRender: true,
      skipPostProduction: true
    });

    // 检查是否需要续跑（预算不足）
    const hasBudgetError = result.errors?.some(e => 
      e.message?.includes('预算不足') || e.message?.includes('insufficient')
    );
    
    if (result.success && !hasBudgetError) {
      console.log('\n✅ 预生产完成！');
      console.log('成功:', result.success);
      console.log('镜头数:', result.stages.productionEngine?.prompts?.length || 0);
      
      saveResult(result);
      return;
    }
    
    if (hasBudgetError && attempt < MAX_RETRIES) {
      console.log(`\n⏳ 预算不足，等待10秒后自动续跑（${attempt}/${MAX_RETRIES}）...`);
      await new Promise(r => setTimeout(r, 10000));
      lastError = '预算不足，自动续跑';
      continue;
    }
    
    console.log('\n❌ 预生产失败:', result.errors?.map(e => e.message).join('; '));
    lastError = result.errors?.[0]?.message || 'Unknown error';
    break;
  }
  
  console.log(`\n💥 最终失败（${MAX_RETRIES}次尝试）: ${lastError}`);
  process.exit(1);
}

function saveResult(result) {
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
