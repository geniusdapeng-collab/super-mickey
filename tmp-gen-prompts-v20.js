const fs = require('fs');
const path = require('path');

const outputDir = '/root/.openclaw/workspace/output/health-edu-ep01-v669';
const files = ['S01.json', 'S02.json', 'S03.json', 'S04.json', 'S05.json'];

let md = '# 完整提示词 - 横纹肌溶解科普视频第一集\n\n';
md += '> 版本: v6.6.9.4-patch20\n';
md += '> 生成时间: 2026-06-18 17:00 CST\n';
md += '> 说明: 本次预生产 Stage 11 渲染输出（PromptForge Stage 13 卡死未优化）\n\n';
md += '---\n';

for (const file of files) {
  const fullPath = path.join(outputDir, file);
  if (!fs.existsSync(fullPath)) continue;
  
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const shot = data.rawShot || data;
  
  md += '\n## ' + (shot.id || file.replace('.json', '')) + ' | ' + (shot.scene || '未命名') + ' | ' + (shot.duration || 'N/A') + '秒\n\n';
  md += '**台词**: ' + (shot.dialogue || '无') + '\n\n';
  md += '**Prompt长度**: ' + (shot.prompt?.length || 0) + '字符\n\n';
  md += '```\n';
  md += (shot.prompt || '无prompt') + '\n';
  md += '```\n\n';
  md += '---\n';
}

fs.writeFileSync(path.join(outputDir, '完整提示词-v20.md'), md, 'utf8');
console.log('Done: ' + md.length + ' chars');
