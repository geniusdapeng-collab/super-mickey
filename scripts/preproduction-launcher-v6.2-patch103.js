const fs = require('fs');
const path = require('path');

// 启动脚本：饕餮 EP01 预生产（v6.2-patch103）
// 用法：node /root/.openclaw/workspace/scripts/preproduction-launcher-v6.2-patch103.js

const WORKSPACE = '/root/.openclaw/workspace';
const OUTPUT = path.join(WORKSPACE, 'output');

async function main() {
  const startTime = Date.now();
  console.log(`🎬 启动饕餮EP01预生产 v6.2-patch103 | ${new Date().toISOString()}`);
  console.log(`   版本: v6.2-patch103（9项修复）`);
  console.log(`   目标: 验证修复效果，生成干净交付文档`);

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT)) {
    fs.mkdirSync(OUTPUT, { recursive: true });
  }

  // 动态加载 NirathMasterPipeline
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
    logToFile: true
  });

  try {
    const result = await pipeline.execute(input);
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ 预生产完成！总耗时: ${duration.toFixed(1)}秒`);
    const shots = result.stages?.style || result.stages?.render || result.shots || [];
    console.log(`   镜头数: ${shots.length}`);
    console.log(`   总时长: ${result.totalDuration || 0}秒`);

    // 生成交付文档
    const report = generateReport(result, duration);
    const reportPath = path.join(OUTPUT, 'taotie-ep01-preproduction-v6.2-patch103-delivery.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 交付文档: ${reportPath}`);

  } catch (e) {
    console.error(`\n❌ 预生产失败: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

function generateReport(result, duration) {
  const shots = result.stages?.style || result.stages?.render || result.shots || [];
  let md = `# 饕餮 EP01 预生产交付文档 v6.2-patch103\n\n`;
  md += `**生成时间**: ${new Date().toISOString()}\n`;
  md += `**版本**: v6.2-patch103（9项修复）\n`;
  md += `**总耗时**: ${duration.toFixed(1)}秒\n`;
  md += `**镜头数**: ${shots.length}\n`;
  md += `**总时长**: ${result.totalDuration || 0}秒\n\n`;

  md += `## 修复验证清单\n`;
  md += `- [ ] "笔记本记录"残留已清除\n`;
  md += `- [ ] 万能模板（发光毯+六足生物）已差异化\n`;
  md += `- [ ] Prompt拼接污染已消除\n`;
  md += `- [ ] 每镜台词独立原创\n`;
  md += `- [ ] 格式符号成对闭合\n`;
  md += `- [ ] 时间轴无占位符\n`;
  md += `- [ ] 情绪标签与场景一致\n`;
  md += `- [ ] 口播动作统一中文\n`;
  md += `- [ ] 场景-台词对齐\n\n`;

  md += `## 镜头汇总\n\n`;
  md += `| 镜号 | 场景 | 时长 | 角色 | 评分 |\n`;
  md += `|------|------|------|------|------|\n`;
  shots.forEach(s => {
    // v6.2-patch121-fix: 正确读取时长和角色
    const duration = s.duration || s.shotDuration || s.targetDuration || 0;
    const durationDisplay = duration > 100 ? `${duration}字符(异常)` : `${duration}s`;
    const characters = (s.characters || s.characterRoles || [])
      .map(c => typeof c === 'string' ? c : (c.name || c.id || ''))
      .filter(Boolean)
      .join(',');
    const sceneName = s.scene || s.sceneName || s.location || 'N/A';
    md += `| ${s.shotId || s.id} | ${sceneName} | ${durationDisplay} | ${characters} | ${s.qualityScore?.totalScore || s.score || '-'} |\n`;
  });

  md += `\n## 完整Prompt\n\n`;
  shots.forEach(s => {
    md += `### ${s.shotId || s.id} - ${s.scene || 'N/A'}\n\n`;
    md += `\`\`\`\n${s.prompt || 'N/A'}\n\`\`\`\n\n`;
  });

  return md;
}

main().catch(console.error);
