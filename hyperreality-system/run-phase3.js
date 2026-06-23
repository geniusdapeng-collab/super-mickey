const fs = require('fs');
const path = require('path');
const { ProductionEngine } = require('./engines/production-engine/production-engine');

async function main() {
  const cp2 = JSON.parse(fs.readFileSync('./checkpoints/checkpoint-phase2.json', 'utf8'));
  const checkpointDir = './checkpoints/phase3-per-shot';
  if (!fs.existsSync(checkpointDir)) fs.mkdirSync(checkpointDir, { recursive: true });

  // 已完成的镜头从 per-shot checkpoint 恢复
  const completed = {};
  for (const f of fs.readdirSync(checkpointDir)) {
    if (f.startsWith('shot-') && f.endsWith('.json')) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(checkpointDir, f), 'utf8'));
        if (d.status === 'success' && d.output) completed[d.output.shotId] = d.output;
      } catch (_) {}
    }
  }
  console.log(`📦 恢复 ${Object.keys(completed).length}/${cp2.shots.length} 个已完成镜头`);

  // 只对未完成镜头做 fusion
  const engine = new ProductionEngine({
    charactersDir: './characters',
    agentConfig: {
      enableLLMAgents: true,
      llmTimeout: 180000,
      llmMaxRetries: 2,
      llmModel: 'kimi-k2p6',
      fastModel: 'kimi-k2p6',
      totalDeadlineMs: 540000,
      memThresholdMB: 1800,
      promptFusionConcurrency: 2,
      checkpointDir: './checkpoints',
      enableResume: true
    }
  });

  const results = [];
  for (const shot of cp2.shots) {
    if (completed[shot.shotId]) {
      results.push(completed[shot.shotId]);
      console.log(`✅ ${shot.shotId} (从checkpoint恢复)`);
      continue;
    }

    const start = Date.now();
    try {
      // 【v2.1.4-fix10-P25-fix3】调用暴露的单镜头融合方法
      const fused = await engine.fuseSingleShotPublic(shot, '16:9', cp2.characters || []);
      const out = { ...shot, ...fused, status: 'success' };
      fs.writeFileSync(
        path.join(checkpointDir, `shot-${shot.shotId}.json`),
        JSON.stringify({ shotId: shot.shotId, output: out, status: 'success' }, null, 2)
      );
      results.push(out);
      console.log(`✅ ${shot.shotId} (${Date.now() - start}ms) prompt=${fused.promptCharCount}`);
    } catch (e) {
      console.error(`❌ ${shot.shotId}: ${e.message}`);
      results.push({ ...shot, status: 'failed', error: e.message });
    }
  }

  fs.writeFileSync('./output/phase3-result.json', JSON.stringify({ shots: results }, null, 2));
  console.log(`\n💾 完成 ${results.filter(r => r.status === 'success').length}/${results.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
