// test-requirement-list.js
// 测试超现实系统需求清单模块

const { RequirementListBuilder } = require('./engines/script-engine/core/requirement-list-builder');

async function test() {
  console.log('========================================');
  console.log('  超现实系统 - 需求清单模块测试 v1.0');
  console.log('========================================\n');

  const builder = new RequirementListBuilder({
    useLLM: false  // 先测试规则库模式，不依赖 LLM
  });

  const userInput = `穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。

制作要求：
1.创意指数：展示你天花板般的创造力
2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都是陈卓一个人完成讲解，讲解过程要生动形象，带有自然的肢体语言或边走边介绍等。
3.视频时长：59～65秒。
4.视频风格：人物角色和背景环境，要求全写实。
5.内容注意事项：视频只有第一集有片头镜头，开头需要主标题和副标题

其他注意事项：
我们会做三集，此次是第一集，所以围绕第一集来设计，同时避免把其他两集的内容做了。
第一集【横纹肌溶解的症状以及实验室检查】
第二集【为什么会发生横纹肌溶解，常见的原因分析】
第三集【怎么处理和预防横纹肌溶解】
在每一集视频最后的时候，不要预告下一集。`;

  const metadata = {
    title: '横纹肌溶解的症状以及实验室检查',
    seriesTitle: '全民健康科普',
    episode: 1,
    totalEpisodes: 3
  };

  console.log('🔥 [测试] 生成需求清单...');
  console.log('----------------------------------------\n');

  const startTime = Date.now();
  const requirementList = await builder.build(userInput, metadata);
  const elapsed = Date.now() - startTime;

  console.log('\n----------------------------------------');
  console.log('📊 需求清单结果');
  console.log('----------------------------------------');

  console.log(`\n✅ 生成耗时: ${elapsed}ms`);
  console.log(`📌 类型: ${requirementList.videoTypeName} (${requirementList.videoType})`);
  console.log(`📝 标题: ${requirementList.title}`);
  console.log(`📐 画幅: ${requirementList.aspectRatio}`);
  console.log(`⏱️ 时长: ${requirementList.targetDuration}s (范围: ${requirementList.durationRange[0]}～${requirementList.durationRange[1]}s)`);
  console.log(`🎨 风格: ${requirementList.style.primary} + ${requirementList.style.secondary.join(', ') || '无'}`);
  console.log(`💡 创意指数: ${requirementList.creativeIntensity}`);
  console.log(`🎭 叙事模式: ${requirementList.narrativeMode}`);
  console.log(`👥 角色: ${requirementList.characters.map(c => c.name).join(', ')}`);
  console.log(`🎯 置信度: ${(requirementList._analysis.confidence * 100).toFixed(0)}%`);

  console.log('\n📋 Markdown 输出预览（前20行）:');
  console.log('----------------------------------------');
  const markdown = builder.generateMarkdown(requirementList);
  console.log(markdown.split('\n').slice(0, 20).join('\n'));
  console.log('...');

  console.log('\n----------------------------------------');
  console.log('🔗 ScriptEngine Metadata 输出:');
  console.log('----------------------------------------');
  const seMeta = builder.toScriptEngineMetadata(requirementList);
  console.log(JSON.stringify(seMeta, null, 2));

  console.log('\n----------------------------------------');
  console.log('✅ 测试完成！');
}

test().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
