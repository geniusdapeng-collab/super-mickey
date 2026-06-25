const path = require('path');
const fs = require('fs');
const { HyperrealitySystem } = require('./hyperreality-system/index');

const system = new HyperrealitySystem({
  productionEngine: {
    agentConfig: {
      enableLLMAgents: true,
      llmTimeout: 180000,
      llmMaxRetries: 2,
      llmModel: 'kimi-k2p6',
      fastModel: 'kimi-k2p6',
      totalDeadlineMs: 1200000, // 20分钟总预算
      memThresholdMB: 1800,
      promptFusionConcurrency: 1, // 串行处理
      checkpointDir: './checkpoints',
      enableResume: true
    },
    charactersDir: path.join(__dirname, 'characters')
  }
});

const intent = `穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。

制作要求：
1. 创意指数：0.82
2. 内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都是陈卓一个人完成讲解，讲解过程要生动形象，带有自然的肢体语言或边走边介绍等，具体你可以发挥专业好莱坞大导演的风格，做成质感拉满的画质。
3. 视频时长：59～65秒。
4. 视频风格：人物角色和背景环境，要求全写实。
5. 内容注意事项：视频只有第一集有片头镜头，开头需要主标题和副标题

其他注意事项：
我们会做三集，此次是第一集，所以围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。
第一集【横纹肌溶解的症状以及实验室检查】
第二集【为什么会发生横纹肌溶解，常见的原因分析】
第三集【怎么处理和预防横纹肌溶解】
在每一集视频最后的时候，不要预告下一集。`;

const metadata = {
  title: '陈卓健康科普系列 - 第一集：横纹肌溶解的症状及实验室检查',
  // 显式传递创意指数，覆盖系统推断
  creativeIntensity: 0.82,
  // 显式传递目标时长和范围
  target_duration: 62,
  durationRange: [59, 65],
  // 风格确认
  style: 'REAL',
  
  // 【v2.1.4-fix9-P1】导演上下文信息
  content_theme: '横纹肌溶解健康科普',
  content_summary: '讲解横纹肌溶解的典型症状（肌肉疼痛、无力、酱油色尿）以及实验室检查关键指标（肌酸激酶CK、肌红蛋白）',
  visual_style: '全写实医疗科普风格',
  scene_requirement: '三甲医院相关场景：诊室、检验科走廊、宣教室。必须与医疗检查直接相关，禁止户外跑道、公园、街道等无关场景',
  character_description: '陈卓：穿警服的女士，全民健康科普讲解员，专业亲和，站姿挺拔',
  forbidden_scenes: ['户外跑道', '公园', '街道', '健身房', '林荫道'],
  key_messages: [
    '横纹肌溶解的典型症状：肌肉疼痛、无力、酱油色尿液',
    '确诊关键指标：肌酸激酶CK值超过正常值5倍',
    '肌红蛋白检测是重要辅助指标',
    '尿液变色是身体发出的红灯警示'
  ],
  
  // 角色详细信息（含定妆照路径）
  characters: [
    {
      name: '陈卓',
      role: 'protagonist',
      description: '穿警服的陈女士，全民健康科普讲解员，专业亲和，站姿挺拔',
      portraitPaths: {
        front: 'characters/chen-zhuo/portraits/chen-zhuo-front.png',
        side: 'characters/chen-zhuo/portraits/chen-zhuo-side.png',
        threeQuarter: 'characters/chen-zhuo/portraits/chen-zhuo-threeQuarter.png',
        closeup: 'characters/chen-zhuo/portraits/chen-zhuo-closeup.png',
        fullBody: 'characters/chen-zhuo/portraits/chen-zhuo-fullBody.png'
      }
    }
  ],
  // 系列信息
  series: {
    name: '陈卓健康科普系列',
    totalEpisodes: 3,
    currentEpisode: 1
  },
  seriesContentPlan: [
    { episode: 1, title: '横纹肌溶解的症状以及实验室检查' },
    { episode: 2, title: '为什么会发生横纹肌溶解，常见的原因分析' },
    { episode: 3, title: '怎么处理和预防横纹肌溶解' }
  ]
};

(async () => {
  try {
    console.log('🔥 启动预生产流程...');
    console.log('📋 Metadata 检查:', {
      creativeIntensity: metadata.creativeIntensity,
      target_duration: metadata.target_duration,
      durationRange: metadata.durationRange,
      style: metadata.style,
      characters: metadata.characters.length,
      content_theme: metadata.content_theme,
      scene_requirement: metadata.scene_requirement?.substring(0, 50) + '...'
    });
    
    const result = await system.create(intent, metadata, {
      productionEngine: {
        agentConfig: { enableLLMAgents: true }
      }
    });
    
    console.log('\n🏁 预生产完成！');
    console.log('Success:', result.success);
    
    // 输出结果到文件
    fs.writeFileSync('./output/preproduction-result.json', JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
