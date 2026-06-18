const path = require('path');

const { NirathMasterPipeline } = require('./zhuoyue-system/core/nirath-master-pipeline.js');

async function runTest() {
  console.log('🚀 S02 单镜头测试开始...\n');

  const pipeline = new NirathMasterPipeline({
    projectName: 'health-edu-ep01-v6617',
    mode: 'generic',
    isPreProduction: true,
    useLLM: true,
    skipMockData: true,
  });

  const input = {
    projectName: 'health-edu-ep01-v6617',
    protagonist: 'chen-zhuo',
    protagonistName: '陈卓',
    mode: 'generic',
    isPreProduction: true,
    useLLM: true,
    videoType: 'educational',
    duration: 60,
    targetDuration: 60,
    style: {
      primary: 'documentary',
      secondary: 'educational'
    },
    shots: [
      {
        id: 'S02',
        scene: '病因机制解析',
        duration: 15,
        type: 'explanation',
        dialogue: '刚才我们说了症状，那到底是什么让肌肉"溶解"呢？最常见的原因就三个。第一是运动过度，尤其是平时不锻炼，突然来一组高强度训练。第二是创伤，比如挤压伤或肌肉缺血。第三是药物或毒素，比如他汀类降脂药。',
        characters: ['chen-zhuo']
      }
    ],
    characters: {
      'chen-zhuo': {
        id: 'chen-zhuo',
        name: '陈卓',
        role: '健康知识讲解员',
        outfit: '穿警服的陈卓女士',
        age: 28,
        gender: 'female',
        portraits: {
          front: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-front.png',
          threeQuarter: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-threeQuarter.png',
          closeup: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-closeup.png',
          side: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-side.png'
        }
      }
    }
  };

  try {
    const startTime = Date.now();
    const result = await pipeline.execute(input);
    const totalTime = Date.now() - startTime;

    const shot = result.stages?.render?.[0] || result.shots?.[0];
    const prompt = shot?.prompt || '';
    const dialogue = shot?.dialogue || '';

    console.log('\n📊 ===== 测试结果 =====');
    console.log(`Stage通过率: ${result.stages?.passed}/${result.stages?.total}`);
    console.log(`总耗时: ${totalTime} ms`);
    console.log(`\n🎬 S02 镜头详情:`);
    console.log(`  Prompt长度: ${prompt.length}`);
    console.log(`  Prompt利用率: ${Math.round(prompt.length / 1500 * 100)}%`);
    console.log(`  台词字数: ${dialogue.length}`);
    console.log(`  是否含【定妆照】: ${prompt.includes('【定妆照】')}`);
    console.log(`  是否含时间轴: ${/\d+s[:：]/.test(prompt)}`);
    console.log(`\n📄 S02 Prompt前500字:`);
    console.log(prompt.slice(0, 500));

    const fs = require('fs');
    const outputDir = path.join(__dirname, 'zhuoyue-system', 'output', 'test-s02-v6617');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
    console.log(`\n✅ 结果已保存到: ${path.join('zhuoyue-system', 'output', 'test-s02-v6617', 'result.json')}`);

  } catch (err) {
    console.error('❌ 测试失败:', err);
    process.exit(1);
  }
}

runTest();
