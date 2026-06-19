const { HyperrealitySystem } = require('./index');

const system = new HyperrealitySystem();

async function run() {
  const result = await system.create(
    '穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第二集。创意指数0.49，视频时长59-65秒，全写实风格。第二集主题：为什么会发生横纹肌溶解，常见的原因分析。',
    { title: '第二集：为什么会发生横纹肌溶解', target_duration: 62, series: '横纹肌溶解科普', episode: 2, characters: [{ name: '陈卓', description: '穿警服的陈卓女士，健康科普主讲人' }] },
    { skipRequirementConfirmation: true, skipPromptReview: true, skipRender: true, skipPostProduction: true }
  );
  console.log('结果:', JSON.stringify(result, null, 2));
}

run();
