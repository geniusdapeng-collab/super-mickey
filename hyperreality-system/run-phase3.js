const fs = require('fs');
const path = require('path');

async function main() {
  const checkpointFile = './checkpoints/checkpoint-phase2.json';
  if (!fs.existsSync(checkpointFile)) {
    console.error('❌ checkpoint-phase2.json 不存在');
    process.exit(1);
  }
  
  const ckpt = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  console.log('📂 加载 checkpoint-phase2:', ckpt.shots?.length || 0, '镜头');
  
  // 加载 blueprint
  const blueprintFile = './output/preproduction-result.json';
  let blueprint = null;
  if (fs.existsSync(blueprintFile)) {
    const result = JSON.parse(fs.readFileSync(blueprintFile, 'utf8'));
    blueprint = result.stages?.adapter;
  }
  
  if (!blueprint) {
    console.error('❌ 无法加载 blueprint');
    process.exit(1);
  }
  
  // 加载 ProductionEngine
  const { ProductionEngine } = require('./engines/production-engine');
  const engine = new ProductionEngine({
    charactersDir: './characters',
    agentConfig: {
      enableLLMAgents: true,
      llmTimeout: 180000,
      llmMaxRetries: 2,
      llmModel: 'kimi-k2p6',
      fastModel: 'kimi-k2p6',
      totalDeadlineMs: 630000,
      memThresholdMB: 1800,
      promptFusionConcurrency: 2,
    }
  });
  
  // 初始化 engine
  await engine.initialize();
  
  // 只运行 Phase 3: PromptFusion
  console.log('🔥 开始 Phase 3: PromptFusion...');
  const startTime = Date.now();
  
  const pfResult = await engine.agents.promptFusion.process(
    JSON.parse(JSON.stringify(ckpt.shots)), // 深拷贝
    blueprint
  );
  
  console.log('✅ PromptFusion 完成! 耗时:', Date.now() - startTime, 'ms');
  console.log('镜头数:', pfResult.shots?.length || 0);
  
  for (const shot of pfResult.shots || []) {
    console.log('\n📷', shot.shotId || shot.shot_id);
    console.log('  Prompt长度:', shot.prompt?.length || 0);
    console.log('  字段数:', Object.keys(shot.fields || {}).length);
    if (shot.fields) {
      console.log('  字段列表:', Object.keys(shot.fields).join(', '));
    }
  }
  
  // 保存结果
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  // 合并到完整结果
  const fullResult = JSON.parse(fs.readFileSync(blueprintFile, 'utf8'));
  fullResult.stages.productionEngine = fullResult.stages.productionEngine || {};
  fullResult.stages.productionEngine.prompts = pfResult.shots;
  
  fs.writeFileSync(
    path.join(outputDir, 'preproduction-result-phase3.json'),
    JSON.stringify({ shots: pfResult.shots }, null, 2)
  );
  
  console.log('\n💾 结果已保存到 output/preproduction-result-phase3.json');
}

main().catch(e => {
  console.error('❌ 错误:', e);
  process.exit(1);
});
