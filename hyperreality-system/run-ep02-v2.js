const { HyperrealitySystem } = require('./index');
const fs = require('fs');
const path = require('path');

// 重写 _waitForExternalConfirmation 方法，直接返回确认
class FastHyperrealitySystem extends require('./index').HyperrealitySystem {
  async _waitForExternalConfirmation(type, content) {
    console.log(`   ✅ 自动确认: ${type} (已人工确认)`);
    return { approved: true, reason: '', suggestions: [] };
  }
}

const system = new FastHyperrealitySystem();

async function runPreproduction() {
  console.log('🔥 [HyperrealitySystem v2.0.6] 第二集预生产启动');
  console.log('=====================================');
  console.log('主题: 为什么会发生横纹肌溶解，常见的原因分析');
  console.log('角色: 陈卓（穿警服）');
  console.log('创意指数: 0.81');
  console.log('时长: 59-65秒');
  console.log('风格: 全写实');
  console.log('');

  const intent = '穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普。第二集主题：为什么会发生横纹肌溶解，常见的原因分析。创意指数0.81，视频时长59-65秒，全写实风格，好莱坞大导演质感。陈卓一个人完成讲解，讲解过程生动形象，带有自然肢体语言或边走边介绍。';

  const metadata = {
    title: '第二集：为什么会发生横纹肌溶解',
    target_duration: 62,
    series: '横纹肌溶解科普',
    episode: 2,
    total_episodes: 3,
    no_next_episode_preview: true,
    has_opening: false,
    creative_intensity: 0.81,
    style: '全写实',
    characters: [{
      id: 'chen-zhuo',         // 使用英文ID匹配目录
      name: '陈卓',            // 中文名用于显示
      character_id: 'chen-zhuo', // 明确指定character_id
      description: '穿警服的陈卓女士，健康科普主讲人',
      role: 'police',
      portraitPaths: [
        'image://characters/chen-zhuo/portraits/chen-zhuo-front.png',
        'image://characters/chen-zhuo/portraits/chen-zhuo-threeQuarter.png',
        'image://characters/chen-zhuo/portraits/chen-zhuo-closeup.png',
        'image://characters/chen-zhuo/portraits/chen-zhuo-side.png'
      ]
    }],
    videoType: 'EDU',
    narrativeMode: 'monologue'
  };

  const options = {
    skipRequirementList: false,
    skipPromptReview: true,
    skipRender: true,
    skipPostProduction: true
  };

  try {
    const result = await system.create(intent, metadata, options);

    // 保存结果
    const outputDir = path.join(__dirname, 'output', 'preproduction-ep02');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultPath = path.join(outputDir, `hyperreality-ep02-${timestamp}.json`);
    const reportPath = path.join(outputDir, `hyperreality-ep02-${timestamp}-report.md`);
    const promptsPath = path.join(outputDir, `hyperreality-ep02-${timestamp}-prompts.md`);

    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    if (result.finalReport) {
      fs.writeFileSync(reportPath, result.finalReport);
    }

    if (result.stages?.productionEngine?.prompts) {
      const promptsMD = generatePromptsMD(result.stages.productionEngine.prompts);
      fs.writeFileSync(promptsPath, promptsMD);
    }

    console.log('');
    console.log('✅ 预生产完成！');
    console.log('');
    console.log('📁 输出文件：');
    console.log(`   - 完整结果: ${resultPath}`);
    console.log(`   - 生产报告: ${reportPath}`);
    console.log(`   - Prompts清单: ${promptsPath}`);
    console.log('');
    console.log('📊 预生产摘要：');
    console.log(`   - 场景数: ${result.stages?.scriptEngine?.report?.scenes_count || 0}`);
    console.log(`   - 角色数: ${result.stages?.scriptEngine?.report?.characters_count || 0}`);
    console.log(`   - 台词数: ${result.stages?.scriptEngine?.report?.dialogues_count || 0}`);
    console.log(`   - 镜头数: ${result.stages?.productionEngine?.shots?.length || 0}`);
    console.log(`   - 总耗时: ${result.timing?.total || 0}ms`);
    console.log(`   - 状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);

    if (result.errors.length > 0) {
      console.log('');
      console.log('⚠️ 错误：');
      result.errors.forEach(e => console.log(`   - ${e.stage}: ${e.message}`));
    }

  } catch (error) {
    console.error('❌ 预生产失败：', error.message);
    console.error(error.stack);
  }
}

function generatePromptsMD(prompts) {
  const lines = [];
  lines.push('# 第二集 Prompts 清单');
  lines.push('> 主题：为什么会发生横纹肌溶解，常见的原因分析');
  lines.push('');
  lines.push('| 镜头 | 时长 | 角色 | 内容概要 |');
  lines.push('|------|------|------|---------|');
  
  for (const p of prompts) {
    const charInfo = p.characterRef && p.characterRef !== 'NONE' ? p.characterRef : '无';
    lines.push(`| ${p.shotId} | ${p.duration}s | ${charInfo} | ${p.prompt?.substring(0, 50)}... |`);
  }
  
  lines.push('');
  lines.push('## 完整Prompts');
  lines.push('');
  
  for (const p of prompts) {
    lines.push(`### ${p.shotId}`);
    lines.push('');
    lines.push('```');
    lines.push(p.prompt || '(空)');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  return lines.join('\n');
}

runPreproduction();
