/**
 * 通用生产脚本 — Production Runner v5.0
 * 
 * 功能：接受任意故事ID，自动加载配置并执行生产流程
 * 用法：node production-runner.js <story-id> [--test]
 * 示例：node production-runner.js houyi-v1.0
 *        node production-runner.js jingwei-v20.0
 *        node production-runner.js your-new-story
 * 
 * 系统设计原则：
 * - 本文件是通用引擎，不含任何具体故事内容
 * - 具体故事内容在 stories/<story-id>/story-config.json
 * - 故事节拍在 stories/<story-id>/story-beats.json
 */

const {
  SceneDesignOrchestrator,
  MAX_PROMPT_LENGTH
} = require('./orient-primordial-core-v23');

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';

// ========== 参数解析 ==========
const STORY_ID = process.argv[2];
const IS_TEST = process.argv.includes('--test');

if (!STORY_ID) {
  console.error('❌ 用法: node production-runner.js <story-id> [--test]');
  console.error('   示例: node production-runner.js houyi-v1.0');
  process.exit(1);
}

// ========== 主流程 ==========
async function main() {
  const storyDir = path.join(WORKSPACE, 'stories', STORY_ID);
  const configPath = path.join(storyDir, 'story-config.json');
  const beatsPath = path.join(storyDir, 'story-beats.json');
  const continuityPath = path.join(storyDir, 'continuity-config.json');
  const outputDir = path.join(WORKSPACE, 'production', STORY_ID);

  // 检查故事是否存在
  if (!fss.existsSync(configPath)) {
    console.error(`❌ 故事配置不存在: ${configPath}`);
    console.error('   请创建故事配置: stories/<story-id>/story-config.json');
    process.exit(1);
  }

  console.log(`\n🎬 生产启动: ${STORY_ID}`);
  console.log('='.repeat(80));

  // 1. 加载故事配置
  const storyConfig = JSON.parse(fss.readFileSync(configPath, 'utf8'));
  console.log(`📖 故事: ${storyConfig.title || '未命名'}`);
  console.log(`📊 集数: ${storyConfig.episodes?.length || 0} | 总镜头: ${countTotalShots(storyConfig)}`);

  // 2. 加载故事节拍（可选）
  let storyBeats = {};
  if (fss.existsSync(beatsPath)) {
    storyBeats = JSON.parse(fss.readFileSync(beatsPath, 'utf8'));
    console.log(`🎵 故事节拍已加载`);
  }

  // 3. 加载连续性配置（可选）
  let continuityConfig = {};
  if (fss.existsSync(continuityPath)) {
    continuityConfig = JSON.parse(fss.readFileSync(continuityPath, 'utf8'));
    console.log(`🔗 连续性配置已加载`);
  }

  // 4. 创建编排器
  const orchestrator = new SceneDesignOrchestrator({
    visualStyle: storyConfig.visualStyle,
    sceneLibraryPath: path.join(WORKSPACE, 'shanhaijing-render-engine/NIRATH_SCENE_LIBRARY.json'),
    characterCards: loadCharacterCards(storyConfig.characters || [])
  });

  // 5. 收集所有镜头
  const allShots = [];
  for (const ep of (storyConfig.episodes || [])) {
    for (const shot of (ep.shots || [])) {
      allShots.push({ 
        ...shot, 
        episodeId: ep.id,
        storyTitle: storyConfig.title
      });
    }
  }

  console.log(`\n📋 开始批量场景设计 (${allShots.length} 镜)...\n`);

  // 6. 批量场景设计
  const results = await orchestrator.batchDesign(allShots, {
    storyBeats,
    continuityConfig,
    testMode: IS_TEST
  });

  // 7. 输出结果
  let passCount = 0;
  for (const r of results) {
    const status = r.quality?.pass ? '✅' : '❌';
    if (r.quality?.pass) passCount++;
    
    console.log(`${status} [${r.shotId}] ${r.worldBuilding?.nirathName || '未知场景'}`);
    console.log(`   Prompt: ${r.prompt?.length || 0}/${MAX_PROMPT_LENGTH}`);
    if (r.narrativeAnalysis) {
      console.log(`   叙事: ${r.narrativeAnalysis.act} → ${r.narrativeAnalysis.beat}`);
    }
    if (r.artDirection) {
      console.log(`   光影: ${r.artDirection.lighting?.keyLight || '默认'}`);
    }
  }

  // 8. 质量报告
  const report = orchestrator.getQualityReport();
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 质量报告: ${report.passed}/${report.total} 通过 | 通过率: ${report.passRate}%`);
  console.log(`📊 平均分: ${report.averageScore}`);

  // 9. 保存生产文件
  if (!IS_TEST) {
    saveProductionFiles(results, storyConfig, outputDir);
    console.log(`\n📁 输出目录: ${outputDir}`);
  } else {
    console.log(`\n🧪 测试模式: 不保存文件`);
  }

  console.log('\n✅ 生产完成！');
  
  // 返回结果供调用方使用
  return { results, report, storyConfig };
}

// ========== 辅助函数 ==========

function countTotalShots(storyConfig) {
  let count = 0;
  for (const ep of (storyConfig.episodes || [])) {
    count += (ep.shots || []).length;
  }
  return count;
}

function loadCharacterCards(characterList) {
  const cards = {};
  for (const char of characterList) {
    const cardPath = path.join(WORKSPACE, 'characters', char.id, 'character-card.json');
    if (fss.existsSync(cardPath)) {
      cards[char.id] = JSON.parse(fss.readFileSync(cardPath, 'utf8'));
    }
  }
  return cards;
}

function saveProductionFiles(results, storyConfig, outputDir) {
  if (!fss.existsSync(outputDir)) {
    fss.mkdirSync(outputDir, { recursive: true });
  }

  // 保存Prompt清单
  const prompts = results.map(r => ({
    shotId: r.shotId,
    prompt: r.prompt,
    length: r.prompt?.length,
    scene: r.worldBuilding?.nirathName,
    quality: r.quality
  }));
  
  fss.writeFileSync(
    path.join(outputDir, 'prompts.json'),
    JSON.stringify(prompts, null, 2)
  );

  // 保存生产日志
  const log = {
    storyId: STORY_ID,
    storyTitle: storyConfig.title,
    timestamp: new Date().toISOString(),
    totalShots: results.length,
    passed: results.filter(r => r.quality?.pass).length,
    results
  };
  
  fss.writeFileSync(
    path.join(outputDir, 'production-log.json'),
    JSON.stringify(log, null, 2)
  );

  // 生成Markdown报告
  const md = generateReportMarkdown(results, storyConfig);
  fss.writeFileSync(path.join(outputDir, 'production-report.md'), md);
}

function generateReportMarkdown(results, storyConfig) {
  const passed = results.filter(r => r.quality?.pass).length;
  const avgScore = results.reduce((s, r) => s + (r.quality?.score || 0), 0) / results.length;
  
  return `# ${storyConfig.title || '未命名故事'} — 生产报告

- **故事ID**: ${STORY_ID}
- **总镜头**: ${results.length}
- **通过**: ${passed}/${results.length} (${(passed/results.length*100).toFixed(1)}%)
- **平均分**: ${avgScore.toFixed(1)}/100
- **时间**: ${new Date().toISOString()}

## 镜头清单

| 镜头 | 场景 | 长度 | 状态 | 评分 |
|------|------|------|------|------|
${results.map(r => `| ${r.shotId} | ${r.worldBuilding?.nirathName || '-'} | ${r.prompt?.length || 0} | ${r.quality?.pass ? '✅' : '❌'} | ${r.quality?.score || 0} |`).join('\n')}

## 详细信息

${results.map(r => `### ${r.shotId}
**场景**: ${r.worldBuilding?.nirathName || '未知'}
**Prompt**: \`\`\`${r.prompt || 'N/A'}\`\`\`
**质量**: ${JSON.stringify(r.quality, null, 2)}
`).join('\n---\n')}
`;
}

// ========== 启动 ==========
main().catch(err => {
  console.error('❌ 生产失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});

// 导出供测试使用
module.exports = { main, countTotalShots, loadCharacterCards };
