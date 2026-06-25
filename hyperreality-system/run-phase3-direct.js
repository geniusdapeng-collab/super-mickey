const fs = require('fs');
const path = require('path');

async function main() {
  // 1. 加载 checkpoint-phase2
  const checkpointFile = './checkpoints/checkpoint-phase2.json';
  if (!fs.existsSync(checkpointFile)) {
    console.error('❌ checkpoint-phase2.json 不存在');
    process.exit(1);
  }
  
  const ckpt = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  console.log('📂 加载 checkpoint-phase2:', ckpt.shots?.length || 0, '镜头');
  
  // 2. 加载blueprint（用于角色信息）
  const blueprintFile = './output/preproduction-result.json';
  let blueprint = null;
  if (fs.existsSync(blueprintFile)) {
    const result = JSON.parse(fs.readFileSync(blueprintFile, 'utf8'));
    blueprint = result.stages?.adapter;
  }
  
  if (!blueprint) {
    console.log('⚠️ 未找到blueprint，使用checkpoint数据构建');
    blueprint = {
      characters: ckpt.shots?.[0]?.characters || [],
      config: { maxPromptLength: 3000 }
    };
  }
  
  // 3. 加载 PromptFusionAgent
  const PromptFusionAgentPath = './engines/production-engine/agents/prompt-fusion-agent.js';
  if (!fs.existsSync(PromptFusionAgentPath)) {
    console.error('❌ PromptFusionAgent 不存在:', PromptFusionAgentPath);
    process.exit(1);
  }
  
  const { PromptFusionAgent } = require(PromptFusionAgentPath);
  
  const agent = new PromptFusionAgent({
    maxPromptLength: 3000,
    llmTimeout: 180000,
    llmMaxRetries: 2,
    llmModel: 'kimi-k2p6',
    enableFieldCompleteness: true
  });
  
  // LLM引擎懒加载，无需initialize
  console.log('✅ PromptFusionAgent 初始化完成');
  
  // 4. 逐个镜头处理 Phase 3
  console.log('🔥 开始 Phase 3: PromptFusion...');
  const startTime = Date.now();
  const shots = JSON.parse(JSON.stringify(ckpt.shots)); // 深拷贝
  
  const results = [];
  const checkpointDir = './checkpoints';
  if (!fs.existsSync(checkpointDir)) fs.mkdirSync(checkpointDir, { recursive: true });
  
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const sid = shot.shotId || shot.shot_id;
    
    // 检查是否有该镜头的checkpoint
    const shotCheckpointFile = path.join(checkpointDir, `checkpoint-shot-${sid}.json`);
    if (fs.existsSync(shotCheckpointFile)) {
      console.log(`\n📂 发现 checkpoint-shot-${sid}，直接加载`);
      const saved = JSON.parse(fs.readFileSync(shotCheckpointFile, 'utf8'));
      results.push(saved);
      console.log('  ✅ Prompt长度:', saved.prompt?.length || 0);
      console.log('  ✅ 字段数:', Object.keys(saved.fields || {}).length);
      continue;
    }
    
    console.log(`\n🎬 处理镜头 ${i+1}/${shots.length}: ${sid}`);
    
    try {
      const result = await agent._fuseSingleShot(shot, 1.0, blueprint.characters || []);
      results.push(result);
      console.log('  ✅ Prompt长度:', result.prompt?.length || 0);
      console.log('  ✅ 字段数:', Object.keys(result.fields || {}).length);
      if (result.fields) {
        console.log('  字段:', Object.keys(result.fields).join(', '));
      }
      
      // 保存单镜头checkpoint
      fs.writeFileSync(shotCheckpointFile, JSON.stringify(result, null, 2));
      console.log(`  💾 checkpoint-shot-${sid} 已保存`);
    } catch (e) {
      console.error('  ❌ 失败:', e.message);
      results.push(shot); // 保留原始数据
    }
  }
  
  console.log('\n✅ Phase 3 完成! 总耗时:', Date.now() - startTime, 'ms');
  console.log('总镜头:', results.length);
  
  // 5. 保存结果
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  fs.writeFileSync(
    path.join(outputDir, 'preproduction-result-phase3.json'),
    JSON.stringify({ shots: results }, null, 2)
  );
  
  console.log('\n💾 结果已保存到 output/preproduction-result-phase3.json');
  
  // 6. 打印prompt摘要
  console.log('\n📋 Prompt摘要:');
  for (const r of results) {
    const sid = r.shotId || r.shot_id;
    const plen = r.prompt?.length || 0;
    const fcount = Object.keys(r.fields || {}).length;
    console.log(`  ${sid}: prompt=${plen} chars, fields=${fcount}`);
  }
}

main().catch(e => {
  console.error('❌ 错误:', e);
  process.exit(1);
});
