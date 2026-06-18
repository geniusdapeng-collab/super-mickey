const { NirathMasterPipeline } = require('./zhuoyue-system/core/nirath-master-pipeline.js');

const input = {
  title: "健康科普系列：横纹肌溶解",
  topic: "横纹肌溶解的症状以及实验室检查",
  projectName: "health-edu-ep01-rhabdo-v669",
  videoType: "educational",
  style: {
    primary: "documentary",
    secondary: "medical",
    colorPalette: "natural_earth",
    mood: "authoritative_warm"
  },
  characters: [{
    id: "chen-zhuo",
    name: "陈卓",
    type: "protagonist",
    outfit: "nurse_uniform",
    profession: "health educator"
  }],
  targetDuration: 62,
  platform: "general",
  aspectRatio: "16:9",
  creativeIntensity: 1.0,
  episodeInfo: {
    seriesName: "健康科普系列",
    episodeNumber: 1,
    totalEpisodes: 3
  },
  content: {
    mainTopic: "横纹肌溶解的症状以及实验室检查",
    subTopics: ["典型症状", "实验室检查指标", "高危人群"],
    keyPoints: ["肌肉酸痛", "尿液颜色变化", "CK值升高", "及时就医"]
  },
  requirements: {
    includeRealCase: true,
    professionalTone: true,
    audienceFriendly: true,
    includeCallToAction: true
  }
};

async function main() {
  const pipeline = new NirathMasterPipeline({
    mode: 'generic',
    isPreProduction: true
  });

  console.log('[TEST] v6.6.9.4-patch14 预生产验证启动...');
  const start = Date.now();

  try {
    const result = await pipeline.execute(input);
    const elapsed = Math.round((Date.now() - start) / 1000);

    console.log('\n========== 验证结果 ==========');
    console.log('总耗时:', elapsed, '秒');
    console.log('质量分:', result.qualityScore, '| 等级:', result.qualityGrade, '| 状态:', result.status);

    const shots = result.stages?.render || [];
    console.log('镜头数:', shots.length);

    for (const shot of shots) {
      const prompt = shot.prompt || '';
      const has = {
        visual: /【视觉】/.test(prompt),
        action: /【动态】/.test(prompt),
        space: /【空间】/.test(prompt),
        emotion: /【情绪】/.test(prompt),
        depth: /【纵深】/.test(prompt),
        angle: /【方位】/.test(prompt),
        style: /【风格】/.test(prompt),
        camera: /【镜头时间轴】/.test(prompt),
        lighting: /【照明】/.test(prompt),
        negative: /【负面约束】/.test(prompt),
        audio: /【环境音效】/.test(prompt),
        render: /【渲染】/.test(prompt),
        director: /【导演】/.test(prompt),
        dialogue: /【台词】/.test(prompt),
        charCard: /【人物介绍卡片】/.test(prompt),
        atmosphere: /【氛围】/.test(prompt),
        producer: /【出品人】/.test(prompt),
        titleFx: /【标题动效】/.test(prompt),
        oldFormat: /\{CHARACTER:|\{SCENE:|\{MOOD:/.test(prompt)
      };

      const isOpening = shot.id === 'S00' || shot.type === 'opening';
      const required = isOpening
        ? ['visual','action','space','emotion','depth','angle','style','atmosphere','camera','lighting','negative','audio','render','director','producer','titleFx','dialogue','charCard']
        : ['visual','action','space','emotion','depth','angle','style','camera','lighting','negative','audio','render','director','dialogue','charCard'];

      const missing = required.filter(f => !has[f]);
      const count = required.filter(f => has[f]).length;

      console.log('\n' + shot.id + (isOpening ? ' (片头)' : ' (内容)') + ' | ' + prompt.length + '字符');
      console.log('  字段: ' + count + '/' + required.length + ' | 缺失: ' + (missing.length ? missing.join(',') : '无'));
      if (has.oldFormat) console.log('  ⚠️ 包含旧英文格式!');
      console.log('  预览: ' + prompt.substring(0, 150) + '...');
    }

    const fs = require('fs');
    fs.writeFileSync('/tmp/patch14-verify.json', JSON.stringify({
      elapsed, qualityScore: result.qualityScore, qualityGrade: result.qualityGrade, status: result.status,
      shots: shots.map(s => ({ id: s.id, prompt: s.prompt, length: s.prompt?.length }))
    }, null, 2));
    console.log('\n✅ 结果已保存到 /tmp/patch14-verify.json');

  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
