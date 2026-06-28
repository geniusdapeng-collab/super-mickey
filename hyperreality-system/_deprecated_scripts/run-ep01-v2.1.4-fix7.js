const { HyperrealitySystem } = require('./index');
const fs = require('fs');
const path = require('path');

class FastHyperrealitySystem extends HyperrealitySystem {
  async _waitForExternalConfirmation(type, content) {
    console.log(`   ✅ 自动确认: ${type} (已人工确认)`);
    return { approved: true, reason: '', suggestions: [] };
  }
}

// 模式开关
const LLM_MODE = 'full';

const agentConfig = {
  enableLLMAgents: true,
  llmTimeout: 300000,
  llmMaxRetries: 2,
  llmModel: 'kimi-k2p6',
  fastModel: 'kimi-k2p6',
  totalDeadlineMs: 540000,
  memThresholdMB: 1200,
  promptFusionConcurrency: 3,
  enableResume: true
};

const system = new FastHyperrealitySystem({
  productionEngine: {
    agentConfig,
    charactersDir: path.join(__dirname, '../characters')
  }
});

async function runPreproduction() {
  console.log('🔥 [HyperrealitySystem v2.1.4-fix7] 第一集预生产启动');
  console.log('=====================================');
  console.log('主题: 横纹肌溶解的症状以及实验室检查');
  console.log('角色: 陈卓（穿警服）');
  console.log('创意指数: 0.72');
  console.log('时长: 59-65秒');
  console.log('风格: 全写实');
  console.log('修复: PromptFusionAgent台词提取v2.1.4-fix7');
  console.log('');

  const intent = '穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普。第一集主题：横纹肌溶解的症状以及实验室检查。创意指数0.72，视频时长59-65秒，全写实风格，好莱坞大导演质感。陈卓一个人完成讲解，讲解过程生动形象，带有自然肢体语言或边走边介绍。第一集有片头主标题和副标题。';

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
    creative_intensity: 0.72,
    style: '全写实',
    characters: [{
      id: 'chen-zhuo',
      name: '陈卓',
      character_id: 'chen-zhuo',
      description: '穿警服的陈卓女士，健康科普主讲人',
      role: 'police',
      portraitPaths: [
        'image://characters/chen-zhuo/portraits/chen-zhuo-front.png',
        'image://characters/chen-zhuo/portraits/chen-zhuo-threeQuarter.png',
        'image://characters/chen-zhuo/portraits/chen-zhuo-closeup.png',
        'image://characters/chen-zhuo/portraits/chen-zhuo-side.png'
      ]
    }],
    seriesContentPlan: {
      seriesTitle: '横纹肌溶解科普',
      totalEpisodes: 3,
      episodes: [
        {
          index: 1,
          title: '横纹肌溶解的症状以及实验室检查',
          coreTopics: ['症状表现', '实验室检查指标', '早期识别'],
          mustCover: ['症状表现', '实验室检查'],
          canMention: ['发病原因一句话'],
          mustNotCover: ['详细病因分析', '治疗方案', '预防策略']
        },
        {
          index: 2,
          title: '为什么会发生横纹肌溶解，常见的原因分析',
          coreTopics: ['常见病因', '发病机制', '高危人群'],
          mustCover: ['常见病因', '发病机制'],
          canMention: ['症状回顾一句话'],
          mustNotCover: ['详细症状描述', '检查指标解读', '治疗方案', '预防策略']
        },
        {
          index: 3,
          title: '怎么处理和预防横纹肌溶解',
          coreTopics: ['治疗方法', '预防措施', '康复建议'],
          mustCover: ['治疗方法', '预防措施'],
          canMention: ['症状回顾一句话', '病因回顾一句话'],
          mustNotCover: ['详细症状描述', '详细病因分析']
        }
      ]
    },
    videoType: 'EDU',
    narrativeMode: 'monologue'
  };

  const options = {
    skipRequirementList: true, // 队长已确认，跳过需求清单
    skipPromptReview: true,
    skipRender: true,
    skipPostProduction: true,
    productionEngine: { agentConfig }
  };

  try {
    const result = await system.create(intent, metadata, options);

    // 保存结果
    const outputDir = path.join(__dirname, 'output', 'preproduction-ep01-v2.1.4-fix7');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultPath = path.join(outputDir, `super-xiangbao-ep01-${LLM_MODE}-${timestamp}.json`);
    const reportPath = path.join(outputDir, `super-xiangbao-ep01-${LLM_MODE}-${timestamp}-report.md`);
    const promptsPath = path.join(outputDir, `super-xiangbao-ep01-${LLM_MODE}-${timestamp}-prompts.md`);

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

    const boundaryReport = result.stages?.productionEngine?.boundaryReport;
    if (boundaryReport) {
      console.log('');
      console.log('🛡️ 跨集边界校验报告：');
      console.log(`   - 结果: ${boundaryReport.passed ? '✅ 通过' : '⚠️ 发现问题'}`);
      console.log(`   - 问题数: ${boundaryReport.stats?.total || 0}`);
      if (boundaryReport.violations?.length > 0) {
        boundaryReport.violations.forEach(v => {
          console.log(`   - [${v.severity}] ${v.type}: ${v.description}`);
        });
      }
    }

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
  lines.push('# 第一集 Prompts 清单');
  lines.push('> 主题：横纹肌溶解的症状以及实验室检查');
  lines.push('> 版本：v2.1.4-fix7');
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

runPreproduction().catch(err => {
  console.error('❌ 致命错误:', err);
  process.exit(1);
});
