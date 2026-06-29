/**
 * Preproduction Launcher v6.2-patch104 — C方案：分阶段拆分LLM调用
 * 
 * 核心改进：
 * 1. 将Stage 5的5次串行LLM调用拆分为5个独立后台任务
 * 2. 每次任务2-3分钟，不超系统后台进程超时限制
 * 3. 中间结果保存到临时文件，支持断点续跑
 * 4. 所有批次完成后，自动继续Stage 6-17
 * 
 * 文件格式：output/preproduction-stage5-batch-{n}.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const WORKSPACE = '/root/.openclaw/workspace';
const OUTPUT = path.join(WORKSPACE, 'output');
const TEMP_DIR = path.join(OUTPUT, 'preproduction-temp');

// 确保目录存在
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * 检查是否有未完成的批次
 */
function checkUnfinishedBatches() {
  const batches = [];
  for (let i = 1; i <= 5; i++) {
    const file = path.join(TEMP_DIR, `stage5-batch-${i}.json`);
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data.status === 'completed') {
          batches.push({ index: i, data, status: 'completed' });
        } else {
          batches.push({ index: i, status: 'incomplete' });
        }
      } catch (e) {
        batches.push({ index: i, status: 'corrupted' });
      }
    } else {
      batches.push({ index: i, status: 'missing' });
    }
  }
  return batches;
}

/**
 * 清理所有临时批次文件
 */
function cleanupTempFiles() {
  for (let i = 1; i <= 5; i++) {
    const file = path.join(TEMP_DIR, `stage5-batch-${i}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
  console.log('🧹 临时批次文件已清理');
}

/**
 * 保存批次结果
 */
function saveBatchResult(batchIndex, result) {
  const file = path.join(TEMP_DIR, `stage5-batch-${batchIndex}.json`);
  fs.writeFileSync(file, JSON.stringify({
    status: 'completed',
    batchIndex,
    timestamp: Date.now(),
    result
  }, null, 2));
}

/**
 * 启动单个LLM批次（后台任务）
 */
async function launchBatch(input, batchIndex, totalBatches) {
  return new Promise((resolve, reject) => {
    const script = `
const { NirathMasterPipeline } = require('${path.join(WORKSPACE, 'systems/nirath-master-pipeline.js').replace(/\\/g, '\\\\')}');
const fs = require('fs');
const path = require('path');

async function runBatch() {
  const pipeline = new NirathMasterPipeline({
    workspace: '${WORKSPACE.replace(/\\/g, '\\\\')}',
    outputDir: '${OUTPUT.replace(/\\/g, '\\\\')}',
    tempDir: '${TEMP_DIR.replace(/\\/g, '\\\\')}',
    mode: 'nirath'
  });
  
  // 只运行Stage 5的指定批次
  const result = await pipeline.runStage5Batch(${JSON.stringify(input)}, ${batchIndex}, ${totalBatches});
  
  // 保存结果
  const tempFile = path.join('${TEMP_DIR.replace(/\\/g, '\\\\')}', 'stage5-batch-${batchIndex}.json');
  fs.writeFileSync(tempFile, JSON.stringify({
    status: 'completed',
    batchIndex: ${batchIndex},
    timestamp: Date.now(),
    result
  }, null, 2));
  
  console.log('✅ 批次 ${batchIndex}/${totalBatches} 完成');
}

runBatch().catch(console.error);
`;
    
    const tempScript = path.join(TEMP_DIR, `batch-${batchIndex}-runner.js`);
    fs.writeFileSync(tempScript, script);
    
    const child = exec(`node ${tempScript}`, {
      timeout: 300000, // 5分钟超时
      cwd: WORKSPACE
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ 批次 ${batchIndex} 失败:`, error.message);
        reject(error);
      } else {
        console.log(`✅ 批次 ${batchIndex} 完成`);
        resolve({ stdout, stderr });
      }
    });
    
    console.log(`🚀 启动批次 ${batchIndex}/${totalBatches} (PID: ${child.pid})`);
  });
}

/**
 * 主函数：分阶段拆分运行
 */
async function main() {
  const startTime = Date.now();
  console.log(`🎬 启动饕餮EP01预生产 v6.2-patch104（C方案：分阶段拆分）`);
  console.log(`   ${new Date().toISOString()}`);
  
  // 检查已有进度
  const batches = checkUnfinishedBatches();
  const completed = batches.filter(b => b.status === 'completed').length;
  
  if (completed === 5) {
    console.log('✅ 所有批次已完成，合并结果并继续Stage 6-17');
    await mergeAndContinue();
    return;
  }
  
  console.log(`   已有进度: ${completed}/5 批次完成`);
  
  // 准备输入
  const input = {
    projectName: 'taotie-ep01',
    featuredBeastId: 'taotie',
    protagonistId: 'xiaoG',
    targetDuration: 15,
    style: 'Nirath cinematic, 超写实科幻生态风格',
    world: {
      setting: 'Nirath',
      style: 'Nirath cinematic, 超写实科幻生态风格',
      name: 'Nirath'
    },
    scenes: [
      { id: 'S01', name: '荒原噬音', type: 'establishing', duration: 15 },
      { id: 'S02', name: '深渊发现', type: 'discovery', duration: 12 },
      { id: 'S03', name: '晶脉对峙', type: 'confrontation', duration: 11 },
      { id: 'S04', name: '母核反噬', type: 'climax', duration: 15 },
      { id: 'S05', name: '终章归墟之噬', type: 'resolution', duration: 8 }
    ],
    characters: {
      xiaoG: { id: 'xiaoG', name: 'AgentX', role: 'protagonist' },
      taotie: { id: 'taotie', name: '饕餮', role: 'beast' }
    }
  };
  
  // 运行缺失的批次（串行，每个独立后台任务）
  for (const batch of batches) {
    if (batch.status !== 'completed') {
      console.log(`\n🎬 运行批次 ${batch.index}/5`);
      try {
        await launchBatch(input, batch.index, 5);
      } catch (e) {
        console.error(`❌ 批次 ${batch.index} 失败，尝试重试...`);
        // 清理损坏的文件
        const file = path.join(TEMP_DIR, `stage5-batch-${batch.index}.json`);
        if (fs.existsSync(file)) fs.unlinkSync(file);
        
        // 重试一次
        try {
          await launchBatch(input, batch.index, 5);
        } catch (e2) {
          console.error(`❌ 批次 ${batch.index} 重试失败，停止运行`);
          process.exit(1);
        }
      }
    }
  }
  
  // 合并结果并继续
  await mergeAndContinue();
}

/**
 * 合并所有批次结果并继续Stage 6-17
 */
async function mergeAndContinue() {
  console.log('\n📦 合并所有批次结果...');
  
  const allResults = [];
  for (let i = 1; i <= 5; i++) {
    const file = path.join(TEMP_DIR, `stage5-batch-${i}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    allResults.push(data.result);
  }
  
  console.log(`✅ 合并完成: ${allResults.length} 批次`);
  
  // 加载NirathMasterPipeline继续运行Stage 6-17
  const { NirathMasterPipeline } = require(path.join(WORKSPACE, 'systems/nirath-master-pipeline.js'));
  
  const input = {
    projectName: 'taotie-ep01',
    featuredBeastId: 'taotie',
    protagonistId: 'xiaoG',
    targetDuration: 15,
    style: 'Nirath cinematic, 超写实科幻生态风格',
    world: {
      setting: 'Nirath',
      style: 'Nirath cinematic, 超写实科幻生态风格',
      name: 'Nirath'
    },
    scenes: [
      { id: 'S01', name: '荒原噬音', type: 'establishing', duration: 15 },
      { id: 'S02', name: '深渊发现', type: 'discovery', duration: 12 },
      { id: 'S03', name: '晶脉对峙', type: 'confrontation', duration: 11 },
      { id: 'S04', name: '母核反噬', type: 'climax', duration: 15 },
      { id: 'S05', name: '终章归墟之噬', type: 'resolution', duration: 8 }
    ],
    characters: {
      xiaoG: { id: 'xiaoG', name: 'AgentX', role: 'protagonist' },
      taotie: { id: 'taotie', name: '饕餮', role: 'beast' }
    }
  };
  
  const pipeline = new NirathMasterPipeline({
    workspace: WORKSPACE,
    outputDir: OUTPUT,
    mode: 'nirath'
  });
  
  // 运行Stage 6-17（跳过Stage 5，使用合并结果）
  console.log('🎬 继续运行Stage 6-17...');
  const finalResult = await pipeline.runFromStage6(input, allResults);
  
  console.log('\n✅ 预生产完成！');
  console.log(`   总耗时: ${(Date.now() - startTime) / 1000}秒`);
  
  // 清理临时文件
  cleanupTempFiles();
}

// 如果直接运行
if (require.main === module) {
  main().catch(e => {
    console.error('❌ 运行失败:', e);
    process.exit(1);
  });
}

module.exports = { main, checkUnfinishedBatches, cleanupTempFiles };
