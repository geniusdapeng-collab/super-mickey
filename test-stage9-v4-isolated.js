const { CameraMovementSystemV4 } = require('./systems/camera-movement-system-v4.js');

async function testStage9V4() {
  console.log('=== Stage 9 v4.0 隔离验证 ===\n');
  
  const v4 = new CameraMovementSystemV4();
  
  // 模拟Pipeline Stage 9输入（5镜头故事板）
  const shots = [
    {
      id: 'S01', sceneName: '开场介绍', sceneDescription: '医院诊室，护士介绍主题',
      duration: 5, emotionPhase: 'neutral', characters: [{name:'陈卓'}], dialogue: '大家好', type: 'monologue'
    },
    {
      id: 'S02', sceneName: '病理机制', sceneDescription: '讲解病理机制',
      duration: 13, emotionPhase: 'rising', characters: [{name:'陈卓'}], dialogue: '横纹肌溶解的本质', type: 'monologue'
    },
    {
      id: 'S03', sceneName: '症状识别', sceneDescription: '症状识别与就医',
      duration: 15, emotionPhase: 'climax', characters: [{name:'陈卓'}], dialogue: '三大危险信号', type: 'monologue'
    },
    {
      id: 'S04', sceneName: '高危人群', sceneDescription: '高危人群识别',
      duration: 15, emotionPhase: 'tension', characters: [{name:'陈卓'}], dialogue: '这些人群要小心', type: 'monologue'
    },
    {
      id: 'S05', sceneName: '专家结语', sceneDescription: '专家总结建议',
      duration: 7, emotionPhase: 'resolve', characters: [{name:'陈卓'}], dialogue: '记住三件事', type: 'emotional'
    }
  ];
  
  let previousShot = null;
  const results = [];
  
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    console.log(`\n🎬 ${shot.id} — ${shot.sceneName} (${shot.duration}s)`);
    
    const result = await v4.generateIntraShotTimelineV4(shot, previousShot, { autoFix: true });
    
    if (result.timeline) {
      console.log(`   ✅ v4: ${result.timeline.strategy} | ${result.timeline.segmentCount}段`);
      for (const seg of result.timeline.segments) {
        console.log(`      [${seg.timeRange}] ${seg.shotSizeDesc} | ${seg.movement.substring(0, 35)}...`);
      }
      if (result.continuityCheck) {
        console.log(`   🔗 连续性: ${result.continuityCheck.passed ? '✅通过' : '⚠️修复'} | ${result.continuityCheck.issues?.length || 0}个问题`);
      }
      results.push({ shotId: shot.id, v4: true, strategy: result.timeline.strategy });
      previousShot = { timeline: result.timeline };
    } else {
      console.log(`   ⚠️ 降级到v3`);
      results.push({ shotId: shot.id, v4: false });
      previousShot = null;
    }
  }
  
  console.log('\n=== 验证结果 ===');
  const v4Count = results.filter(r => r.v4).length;
  console.log(`总镜头: ${results.length} | v4成功: ${v4Count} | 降级: ${results.length - v4Count}`);
  console.log(v4Count === results.length ? '✅ 全部v4通过' : '⚠️ 部分降级');
}

testStage9V4().catch(console.error);
