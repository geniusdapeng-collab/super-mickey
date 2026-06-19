const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/root/.openclaw/workspace/output/health-edu-ep01-v669/preproduction-result.json', 'utf8'));
const shots = data.shots || [];

let md = '# 完整提示词 - 横纹肌溶解科普视频第一集\n\n';
md += '> 版本: v6.6.9.4-patch20\n';
md += '> 总时长: ' + (data.meta?.totalDuration || 'N/A') + '秒\n';
md += '> 镜头数: ' + shots.length + '\n';
md += '> 生成时间: ' + (data.meta?.generatedAt || 'N/A') + '\n\n';
md += '---\n';

for (const shot of shots) {
  md += '\n## ' + shot.shotId + ' | ' + (shot.scene || '未命名') + ' | ' + shot.duration + '秒\n\n';
  md += '**台词**: ' + (shot.dialogue || '无') + '\n\n';
  md += '**Prompt长度**: ' + (shot.promptCharCount || shot.prompt?.length || 0) + '字符\n\n';
  md += '```\n';
  md += (shot.prompt || '无prompt') + '\n';
  md += '```\n\n';
  md += '---\n';
}

fs.writeFileSync('/root/.openclaw/workspace/output/health-edu-ep01-v669/完整提示词.md', md, 'utf8');
console.log('Done: ' + md.length + ' chars');
