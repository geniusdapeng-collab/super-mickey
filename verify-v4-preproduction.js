const { NirathMasterPipeline } = require('./zhuoyue-system/core/nirath-master-pipeline.js');
const path = require('path');
const fs = require('fs');

const OUTPUT = path.join(__dirname, 'output', 'health-edu-ep01-v665-v4');
if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true });

async function run() {
  console.log('=== v6.6.5-v4 预生产验证 ===\n');
  
  const input = {
    title: '什么是横纹肌溶解',
    projectName: 'health-edu-ep01',
    scenes: [
      { id: 'S01', title: '开场介绍', description: '医院诊室，护士陈卓介绍主题', type: 'monologue', characters: ['chen-nurse'], estimatedDuration: 5 },
      { id: 'S02', title: '病理机制讲解', description: '讲解横纹肌溶解的病理机制', type: 'monologue', characters: ['chen-nurse'], estimatedDuration: 13 },
      { id: 'S03', title: '症状识别与就医信号', description: '讲解症状识别', type: 'monologue', characters: ['chen-nurse'], estimatedDuration: 15 },
      { id: 'S04', title: '高危人群识别', description: '列举高危人群', type: 'monologue', characters: ['chen-nurse'], estimatedDuration: 15 },
      { id: 'S05', title: '专家结语', description: '专家总结建议', type: 'emotional', characters: ['chen-nurse'], estimatedDuration: 7 }
    ],
    characters: {
      'chen-nurse': {
        name: '陈卓',
        role: '健康教育主讲人',
        profession: '护士',
        description: '35岁，女，亲和力强的健康科普护士',
        appearance: {
          hairColor: '深棕色',
          clothing: '护士服'
        }
      }
    },
    world: {
      name: '现代医院',
      setting: '医院诊室'
    },
    targetDuration: 55,
    style: 'health-education',
    hasOpening: true,
    hasNextEpisodePreview: false
  };

  const pipeline = new NirathMasterPipeline({
    mode: 'generic',
    useLLM: true,
    outputDir: OUTPUT
  });

  try {
    const result = await pipeline.execute(input);
    
    // 保存结果
    fs.writeFileSync(path.join(OUTPUT, 'preproduction-result.json'), JSON.stringify(result, null, 2));
    
    // 提取Stage 9信息
    const cameraStage = result.stages?.camera || [];
    console.log('\n=== Stage 9 运镜验证 ===');
    console.log(`总镜头数: ${cameraStage.length}`);
    
    const v4Count = cameraStage.filter(m => m.movement?.v4Enabled).length;
    const v3Count = cameraStage.filter(m => m.movement?.timeline?.segments?.length > 2 && !m.movement?.v4Enabled).length;
    console.log(`v4个性化: ${v4Count}`);
    console.log(`v3多段式: ${v3Count}`);
    
    for (const cam of cameraStage) {
      if (cam.movement?.v4Enabled) {
        console.log(`\n🎬 ${cam.shotId} | v4: ${cam.movement.timeline.strategy}`);
        for (const seg of cam.movement.timeline.segments) {
          console.log(`   [${seg.timeRange}] ${seg.shotSizeDesc} | ${seg.movement.substring(0, 30)}...`);
        }
      }
    }
    
    console.log('\n✅ 预生产完成，结果保存:', OUTPUT);
    
  } catch (e) {
    console.error('❌ 预生产失败:', e.message);
    console.error(e.stack);
  }
}

run();
