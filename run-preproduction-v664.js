const path = require('path');

// 设置工作目录
process.chdir('/root/.openclaw/workspace');

// 加载 pipeline - 使用绝对路径
const { NirathMasterPipeline } = require('/root/.openclaw/workspace/zhuoyue-system/core/nirath-master-pipeline.js');

async function run() {
  console.log('🎬 启动健康科普预生产 v6.6.9.4-patch19');
  console.log('=====================================');
  
  const pipeline = new NirathMasterPipeline({
    mode: 'generic',
    outputDir: './output/health-edu-ep01-v669',
    isPreProduction: true // v6.6.9.4-patch13-fix: 显式声明预生产模式，避免Stage-13闸机误判
  });
  
  const input = {
    projectName: 'health-edu-ep01-rhabdo-v669',
    title: '什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查',
    videoType: 'health-education',
    creativeIndex: 1.0, // v6.6.9.4-patch13: 极高创意指数（内部最大1.0）
    targetDuration: 62,
    aspectRatio: '16:9', // v6.6.9.4-patch13: 用户要求16:9宽屏
    style: 'realistic',
    characters: [{
      id: 'chen-zhuo',
      name: '陈卓',
      role: 'presenter',
      description: '穿警服的陈女士，健康科普讲解员，亲切温和，专业可信',
      // v6.6.9.4-patch13-fix: 绑定定妆照，确保片头和正片角色一致性
      portraits: [
        'image://bestiary/chen-zhuo-front.png',
        'image://bestiary/chen-zhuo-threeQuarter.png',
        'image://bestiary/chen-zhuo-closeup.png',
        'image://bestiary/chen-zhuo-side.png'
      ]
    }],
    hasOpening: true,
    noPreview: true,
    topic: '横纹肌溶解的症状以及实验室检查',
    presenter: '陈卓',
    presenterStyle: 'professional-with-natural-gestures',
    visualStyle: 'full-realistic-cinematic',
    quality: 'hollywood-film-grade',
    // v6.6.9.4-patch13: 人物灵动感软性注入
    directorNote: '陈卓表现要活泼灵动，像朋友一样亲切，拒绝呆板说教感',
    performanceStyle: 'vlog-style-interactive',
    mannerisms: [
      '说话时习惯用手比划强调重点',
      '讲到关键信息会身体前倾靠近镜头',
      '偶尔从画面侧方突然进入镜头制造惊喜',
      '允许快速走向镜头形成怼脸特写',
      '表情丰富，会挑眉、歪头、微笑',
      '不喜欢呆站在原地，会自然走动、转身'
    ],
    cameraStyle: 'dynamic-vlog',
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
    
    // 处理需求清单确认状态
    if (result.status === 'REQUIREMENT_CONFIRMATION_REQUIRED') {
      console.log('\n⏸️ 预生产暂停，等待您确认需求清单');
      console.log('请检查上方"视频需求要点清单"，确认后回复"确认"继续');
      console.log('需求清单文件:', result.requirementList?.path || '-');
      return; // 暂停，等待用户确认
    }
    
    // v6.6.9.4-patch19: 兼容 meta+shots 新格式和旧格式
    const output = result.stages?.output || result;
    const shots = output.shots || output.storyboard?.shots || output.prompts || output._legacy?.prompts || [];
    const totalDuration = shots.reduce((s, x) => s + (x.duration || 0), 0);
    
    console.log('\n✅ 预生产完成！');
    console.log('输出目录:', output.outputDir || output._legacy?.outputDir || pipeline.outputDir);
    console.log('结果文件:', output.resultPath || output._legacy?.resultPath || '-');
    console.log('报告文件:', output.reportPath || output._legacy?.reportPath || '-');
    console.log('镜头数:', shots.length);
    console.log('总时长:', totalDuration, '秒');
    console.log('完整性验证:', result.stages?.integrityValidation?.valid ? '✅ 通过' : '❌ 未通过');
    
    // 打印每个镜头的关键信息
    if (shots.length > 0) {
      console.log('\n📋 镜头详情:');
      shots.forEach((shot, i) => {
        const sid = shot.shotId || shot.id || `S${String(i+1).padStart(2, '0')}`;
        const dur = shot.duration || 0;
        const plen = shot.promptCharCount || shot.length || (shot.prompt ? shot.prompt.length : 0);
        const dlen = shot.dialogue ? shot.dialogue.length : 0;
        const hasDialogue = dlen > 0 ? '✅' : '❌';
        console.log(`  ${sid}: ${dur}s | prompt=${plen}字 | 台词=${dlen}字 ${hasDialogue}`);
      });
    }
  } catch (error) {
    console.error('\n❌ 预生产失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
