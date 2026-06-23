const { HyperrealitySystem } = require('./index');
const fs = require('fs');

async function main() {
  const system = new HyperrealitySystem({
    scriptEngine: { charactersDir: './characters' },
    productionEngine: {
      charactersDir: './characters',
      agentConfig: {
        enableLLMAgents: true,
        llmTimeout: 180000,
        llmMaxRetries: 2,
        llmModel: 'kimi-k2p6',
        fastModel: 'kimi-k2p6',
        totalDeadlineMs: 540000,
        memThresholdMB: 1800,
        promptFusionConcurrency: 2,
        checkpointDir: './checkpoints',
        enableResume: true
      }
    }
  });

  const intent = `穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。

【制作要求】
1.创意指数：1.0
2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都是沉陈卓一个人完成讲解，讲解过程要生动形象，带有自然的肢体语言或边走边介绍等，具体你可以发挥专业好莱坞大导演的风格，做成质感拉满的画质。
3.视频时长：59～65秒。
4.视频风格：人物角色和背景环境，要求全写实。`;

  const metadata = {
    title: '横纹肌溶解科普第一集',
    contentType: 'health_education',
    style: { visual: 'realistic', primary: '写实' },
    targetDuration: 65,
    series: '横纹肌溶解科普系列',
    seriesIndex: 1,
    characters: [{
      name: '陈卓',
      role: 'protagonist',
      description: '穿警服的陈卓女士，健康科普主讲人，短发，站姿挺拔',
      portraitPaths: {
        front: 'image://characters/chen-zhuo/portraits/chen-zhuo-cartoon-front.png',
        side: 'image://characters/chen-zhuo/portraits/chen-zhuo-cartoon-side.png',
        fullbody: 'image://characters/chen-zhuo/portraits/chen-zhuo-cartoon-fullbody.png'
      }
    }]
  };

  console.log('🚀 Phase 1+2: 剧本 + 运镜/灯光...');
  const result = await system.create(intent, metadata, {
    skipPromptReview: true,
    skipRender: true,
    skipPostProduction: true
  });

  if (result.success) {
    console.log('✅ Phase 1+2 完成，checkpoint 已保存');
  } else {
    console.error('❌ Phase 1+2 失败:', result.errors);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
