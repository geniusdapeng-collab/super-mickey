const { HyperrealitySystem } = require('./hyperreality-system');

const system = new HyperrealitySystem();

async function runPreproduction() {
  const intent = `穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第二集。

【制作要求】
1.创意指数：0.49
2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都是陈卓一个人完成讲解，讲解过程要生动形象，带有自然的肢体语言或边走边介绍等，具体你可以发挥专业好莱坞大导演的风格，做成质感拉满的画质。
3.视频时长：59～65秒。
4.视频风格：人物角色和背景环境，要求全写实。
5.内容注意事项：视频只有第一集有片头镜头，在开头需要主标题和副标题

【其他注意事项】
我们会做三集，此次是第二集，所以，你的围绕第二集来设计，同时避免把其他两集的内容做了，避免重复和后面没得做了。
第一集【横纹肌溶解的症状以及实验室检查】
第二集【为什么会发生横纹肌溶解，常见的原因分析】
第三集【怎么处理和预防横纹肌溶解】

在每一集视频最后的时候，你不要预告下一集。`;

  const metadata = {
    title: '第二集：为什么会发生横纹肌溶解，常见的原因分析',
    target_duration: 62,
    series: '横纹肌溶解科普系列',
    episode: 2,
    totalEpisodes: 3,
    characters: ['陈卓'],
    style: {
      primary: 'realistic',
      description: '人物角色和背景环境全写实'
    }
  };

  console.log('🔥 [预生产] 第二集科普视频启动');
  console.log('====================================');

  const result = await system.create(intent, metadata, {
    skipRequirementConfirmation: true,   // 用户已确认
    skipPromptReview: true,               // 预生产模式：跳过确认，输出报告
    skipRender: true,                     // 预生产：跳过渲染
    skipPostProduction: true              // 预生产：跳过后期
  });

  // 输出结果到文件
  const fs = require('fs');
  const outputPath = './output/health-edu-ep02-v125/preproduction-result.json';
  fs.mkdirSync('./output/health-edu-ep02-v125', { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log('\n=== 预生产完成 ===');
  console.log('成功:', result.success);
  console.log('总耗时:', result.timing?.total, 'ms');
  console.log('输出:', outputPath);

  return result;
}

runPreproduction().catch(e => {
  console.error('预生产失败:', e);
  process.exit(1);
});
