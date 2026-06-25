#!/usr/bin/env node
/**
 * 预生产启动脚本 - v2.1.4-fix13
 * 完整主链路入口
 */

const { HyperrealitySystem } = require('./index');
const fs = require('fs');
const path = require('path');

// 环境变量配置
process.env.STORMAXE_LLM_MODEL = process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6';
process.env.STORMAXE_LLM_FAST_MODEL = process.env.STORMAXE_LLM_FAST_MODEL || 'kimi-k2p6';
process.env.STORMAXE_TOTAL_DEADLINE_MS = process.env.STORMAXE_TOTAL_DEADLINE_MS || '1200000';

const agentConfig = {
  enableLLMAgents: true,
  llmTimeout: 300000,
  llmMaxRetries: 2,
  llmModel: process.env.STORMAXE_LLM_MODEL,
  fastModel: process.env.STORMAXE_LLM_FAST_MODEL,
  totalDeadlineMs: parseInt(process.env.STORMAXE_TOTAL_DEADLINE_MS),
  memThresholdMB: 1800,
  promptFusionConcurrency: 2
};

const system = new HyperrealitySystem({
  productionEngine: {
    agentConfig,
    charactersDir: path.join(__dirname, 'characters')
  }
});

async function runPreproduction() {
  console.log('🔥 [HyperrealitySystem v2.1.4-fix13] 完整预生产启动');
  console.log('=====================================');
  console.log('主题: 横纹肌溶解的症状以及实验室检查');
  console.log('角色: 陈卓（穿警服）');
  console.log('创意指数: 0.56');
  console.log('时长: 59-65秒');
  console.log('风格: REAL（全写实）');
  console.log('系列: 第1集/共3集');
  console.log('');

  const intent = '穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普。第一集主题：横纹肌溶解的症状以及实验室检查。创意指数0.56，视频时长59-65秒，REAL风格，好莱坞大导演质感。陈卓一个人完成讲解，讲解过程生动形象，带有自然肢体语言或边走边介绍。第一集有片头主标题和副标题。';

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
    creative_intensity: 0.56,
    style: 'REAL',
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
    content_boundary: {
      mustCover: ['横纹肌溶解的症状', '实验室检查指标'],
      mustNotCover: ['病因分析', '处理方法', '预防措施']
    }
  };

  const startTime = Date.now();
  
  try {
    const result = await system.create(intent, metadata);
    
    const duration = Date.now() - startTime;
    console.log('');
    console.log('=====================================');
    console.log('✅ 预生产完成！');
    console.log(`总耗时: ${(duration/1000).toFixed(1)}秒`);
    console.log(`镜头数: ${result.shots?.length || 0}`);
    console.log(`是否有片头: ${result.opening ? '是' : '否'}`);
    console.log(`降级状态: ${result.degraded ? '部分降级' : '完整生成'}`);
    
    // 保存结果
    const outputPath = path.join(__dirname, 'output', 'preproduction-result-v2.1.4-fix13.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`结果已保存: ${outputPath}`);
    
    // 输出镜头概览
    if (result.shots) {
      console.log('');
      console.log('📋 镜头概览:');
      result.shots.forEach((shot, i) => {
        console.log(`  ${shot.shotId || `SC${String(i).padStart(2,'0')}`}: ${shot.scene || '无场景'} | ${shot.director_instruction || '无指令'}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ 预生产失败:', error.message);
    console.error(error.stack);
    throw error;
  }
}

runPreproduction();
