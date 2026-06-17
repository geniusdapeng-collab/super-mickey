const path = require('path');

// 设置工作目录
process.chdir('/root/.openclaw/workspace');

// 加载 pipeline - 使用绝对路径
const { NirathMasterPipeline } = require('/root/.openclaw/workspace/zhuoyue-system/core/nirath-master-pipeline.js');

async function run() {
  console.log('🎬 启动健康科普预生产 v6.6.9.4-patch9');
  console.log('=====================================');
  
  const pipeline = new NirathMasterPipeline({
    mode: 'generic',
    outputDir: './output/health-edu-ep01-v669',
    isPreProduction: true // v6.6.9.4-patch9-fix: 显式声明预生产模式，避免Stage-13闸机误判
  });
  
  const input = {
    projectName: 'health-edu-ep01-rhabdo-v669',
    title: '什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查',
    videoType: 'health-education',
    creativeIndex: 1.0, // v6.6.9.4-patch9: 极高创意指数（内部最大1.0）
    targetDuration: 62,
    aspectRatio: '16:9', // v6.6.9.4-patch9: 用户要求16:9宽屏
    style: 'realistic',
    characters: [{
      id: 'chen-zhuo', // v6.6.9.4-patch9: 使用正确的角色ID
      name: '陈卓',
      role: 'presenter',
      description: '穿警服的陈女士，健康科普讲解员，亲切温和，专业可信'
    }],
    hasOpening: true,
    noPreview: true,
    topic: '横纹肌溶解的症状以及实验室检查',
    presenter: '陈卓',
    presenterStyle: 'professional-with-natural-gestures',
    visualStyle: 'full-realistic-cinematic',
    quality: 'hollywood-film-grade',
    series: {
      episode: 1,
      totalEpisodes: 3
    },
    content: {
      scope: 'symptoms-and-lab-tests-only',
      avoidPreview: true
    }
  };
  
  try {
    const result = await pipeline.execute(input, { skipRequirementConfirmation: true });
    
    // v6.5.64-P3: 兼容 result 结构
    const output = result.stages?.output || result;
    const shots = output.storyboard?.shots || output.prompts || [];
    const totalDuration = shots.reduce((s, x) => s + (x.duration || 0), 0);
    
    console.log('\n✅ 预生产完成！');
    console.log('输出目录:', output.outputDir || pipeline.outputDir);
    console.log('结果文件:', output.resultPath || '-');
    console.log('报告文件:', output.reportPath || '-');
    console.log('镜头数:', shots.length);
    console.log('总时长:', totalDuration, '秒');
    console.log('完整性验证:', result.stages?.integrityValidation?.valid ? '✅ 通过' : '❌ 未通过');
  } catch (error) {
    console.error('\n❌ 预生产失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
