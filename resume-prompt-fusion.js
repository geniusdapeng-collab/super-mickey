#!/usr/bin/env node
require('./systems/env-aliases'); // 【v2.2.8】SUPERMICKEY_* → STORMAXE_* 环境变量别名桥，须最先加载
/**
 * PromptFusion 断点续跑脚本
 * 从 Phase 3 子 checkpoint 恢复，只跑未完成的镜头
 * v2.1.8-fix: 支持镜头级断点续跑
 */

const { HyperrealitySystem } = require('./hyperreality-system');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 环境变量
process.env.STORMAXE_LLM_MODEL = process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6';
process.env.STORMAXE_LLM_FAST_MODEL = process.env.STORMAXE_LLM_FAST_MODEL || 'kimi-k2p6';
// 总预算 20 分钟（匹配系统硬限制）
process.env.STORMAXE_TOTAL_DEADLINE_MS = '1200000';

async function main() {
  const checkpointDir = process.argv[2] || './checkpoints';
  
  // 1. 查找最新的 Phase 3 子 checkpoint
  const files = fs.readdirSync(checkpointDir).filter(f => f.startsWith('checkpoint-phase3-'));
  if (files.length === 0) {
    console.error('❌ 未找到 Phase 3 子 checkpoint，请先运行主流程');
    process.exit(1);
  }
  
  // 按修改时间排序，取最新的
  files.sort((a, b) => {
    return fs.statSync(path.join(checkpointDir, b)).mtimeMs - fs.statSync(path.join(checkpointDir, a)).mtimeMs;
  });
  const latestFile = files[0];
  const subCkptPath = path.join(checkpointDir, latestFile);
  
  console.log(`📂 加载子 checkpoint: ${latestFile}`);
  const subCkpt = JSON.parse(fs.readFileSync(subCkptPath, 'utf8'));
  
  if (subCkpt.completed >= subCkpt.total) {
    console.log('✅ 所有镜头已完成，无需续跑');
    process.exit(0);
  }
  
  console.log(`🔄 断点续跑: ${subCkpt.completed}/${subCkpt.total} 镜头已完成`);
  
  // 2. 查找 Phase 2 checkpoint 获取完整状态
  const phase2File = path.join(checkpointDir, 'checkpoint-phase2.json');
  if (!fs.existsSync(phase2File)) {
    console.error('❌ 未找到 Phase 2 checkpoint');
    process.exit(1);
  }
  
  const phase2 = JSON.parse(fs.readFileSync(phase2File, 'utf8'));
  
  // 3. 合并已完成的镜头
  const allShots = phase2.shots.map((shot, index) => {
    if (index < subCkpt.results.length) {
      // 使用已完成的 PromptFusion 结果
      return { ...shot, ...subCkpt.results[index] };
    }
    return shot;
  });
  
  // 4. 初始化系统（只启用 PromptFusion）
  const agentConfig = {
    enableLLMAgents: true,
    llmTimeout: 300000,          // 【一致性修复】与主流程对齐：原90s与主流程300s严重不匹配
    llmMaxRetries: 1,             // 1次重试
    maxPromptLength: 3000,       // 【一致性修复】与prompt-length.js唯一真源对齐
    promptFusionConcurrency: 1,   // 串行
    continuityReview: false,      // 跳过 ContinuityReview
    enableFieldConsistency: false,  // 跳过一致性检查
    totalDeadlineMs: 1200000      // 20分钟总预算
  };
  
  const system = new HyperrealitySystem({
    projectName: '铁锅里的星空-Resume',
    agentConfig,
    skipCleanup: true
  });
  
  await system.initialize();
  
  // 5. 只运行 Phase 3，传入子 checkpoint 让它自动续跑
  console.log('\n🚀 启动 PromptFusion 断点续跑...');
  const state = {
    shots: allShots,
    result: { llmStats: phase2.llmStats || {} },
    adaptedBlueprint: phase2.adaptedBlueprint || phase2.blueprint
  };
  
  try {
    const phase3 = system.productionEngine.phases.find(p => p.name === 'Phase3-PromptFusion');
    if (!phase3) {
      throw new Error('Phase3-PromptFusion 未找到');
    }
    
    // 设置 checkpoint manager
    phase3.checkpointManager = { baseDir: checkpointDir };
    
    const result = await phase3.execute(state);
    
    // 6. 保存最终 checkpoint
    const finalCkpt = {
      phase: 'phase3-resume',
      shots: result.shots,
      llmStats: result.llmStats || {},
      savedAt: new Date().toISOString()
    };
    
    const finalPath = path.join(checkpointDir, 'checkpoint-phase3-resume.json');
    fs.writeFileSync(finalPath + '.tmp', JSON.stringify(finalCkpt, null, 2), 'utf8');
    fs.renameSync(finalPath + '.tmp', finalPath);
    
    console.log(`\n✅ 断点续跑完成！最终 checkpoint: ${finalPath}`);
    console.log(`📊 统计: ${result.shots.length} 镜头已处理`);
    
  } catch (e) {
    console.error(`\n❌ 断点续跑失败: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

main().catch(console.error);
