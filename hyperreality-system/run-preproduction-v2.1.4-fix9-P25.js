const { HyperrealitySystem } = require('./index');
const fs = require('fs');
const path = require('path');

const agentConfig = {
  enableLLMAgents: true,
  llmTimeout: 300000,
  llmMaxRetries: 2,
  llmModel: 'kimi-k2p6',
  fastModel: 'kimi-k2p6',
  totalDeadlineMs: 1500000,
  memThresholdMB: 1200,
  promptFusionConcurrency: 3
};

const system = new HyperrealitySystem({
  productionEngine: {
    agentConfig,
    charactersDir: path.join(__dirname, '../characters')
  }
});

async function runPreproduction() {
  console.log('🔥 [HyperrealitySystem v2.1.4-fix9-P25] 预生产启动');
  console.log('=====================================');
  console.log('主题: 横纹肌溶解的症状以及实验室检查');
  console.log('角色: 陈卓（穿警服）');
  console.log('创意指数: 0.69');
  console.log('时长: 59-65秒');
  console.log('风格: 全写实');
  console.log('');

  const intent = '穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普。第一集主题：横纹肌溶解的症状以及实验室检查。创意指数0.69，视频时长59-65秒，全写实风格，好莱坞大导演质感。陈卓一个人完成讲解，讲解过程生动形象，带有自然肢体语言或边走边介绍。第一集有片头主标题和副标题。';

  const metadata = {
    title: '第一集：横纹肌溶解的症状以及实验室检查',
    target_duration: 62,
    series: {
      name: '横纹肌溶解科普',
      currentEpisode: 1,
      totalEpisodes: 3,
      episodeTitles: [
        '横纹肌溶解的症状以及实验室检查',
        '为什么会发生横纹肌溶解，常见的原因分析',
        '怎么处理和预防横纹肌溶解'
      ]
    },
    noNextEpisodePreview: true,
    has_opening: true,
    creative_intensity: 0.69,
    style: '全写实',
    characters: [{
      id: 'chen-zhuo',
      name: '陈卓',
      character_id: 'chen-zhuo',
      description: '穿警服的陈卓女士，健康科普主讲人',
      role: 'police',
      portraitPaths: [
        'image://characters/chen-zhuo/portraits/chen-zhuo-front.png'
      ]
    }],
    seriesContentPlan: {
      seriesTitle: '横纹肌溶解科普',
      totalEpisodes: 3,
      episodes: [
        {
          episodeIndex: 1,
          title: '横纹肌溶解的症状以及实验室检查',
          contentScope: '横纹肌溶解的定义、典型症状（肌肉疼痛、肌肉无力、深色尿）、实验室检查指标（肌酸激酶CK、肌红蛋白、肾功能）',
          excludedContent: '发病原因、预防措施、治疗方案'
        },
        {
          episodeIndex: 2,
          title: '为什么会发生横纹肌溶解，常见的原因分析',
          contentScope: '运动过度、外伤、药物、感染等常见原因',
          excludedContent: ''
        },
        {
          episodeIndex: 3,
          title: '怎么处理和预防横纹肌溶解',
          contentScope: '急救处理、医疗干预、日常预防措施',
          excludedContent: ''
        }
      ]
    }
  };

  try {
    const result = await system.create(intent, metadata, {
      skipRender: true,
      skipPostProduction: true
    });

    console.log('\n=====================================');
    if (result.success) {
      console.log('✅ 预生产完成！');
    } else {
      console.log('❌ 预生产失败或中止');
    }
    console.log('');
    console.log('📊 各阶段耗时:');
    for (const [stage, data] of Object.entries(result.stages || {})) {
      if (data.timing) {
        console.log(`  ${stage}: ${data.timing}ms`);
      }
    }
    console.log('');
    console.log('📁 输出文件:');
    console.log(`  确认文件: ./output/confirmations/`);
    console.log(`  提示词报告: ./output/confirmations/confirmation-prompt.md`);

    // 保存结果
    const resultPath = path.join(__dirname, 'output', 'preproduction-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`  结果: ${resultPath}`);

  } catch (err) {
    console.error('💥 预生产异常:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runPreproduction().then(() => {
  console.log('\n🎉 预生产流程结束');
  process.exit(0);
}).catch(err => {
  console.error('💥 未捕获异常:', err);
  process.exit(1);
});
