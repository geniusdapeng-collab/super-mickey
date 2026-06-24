const fs = require('fs');
const { FIELD_NAME_CN } = require('./engines/field-standardizer');

const data = JSON.parse(fs.readFileSync('output/preproduction-result.json', 'utf8'));

let md = '# 完整提示词 - 横纹肌溶解科普第一集\n\n';
md += '> 生成时间: 2026-06-24\n';
md += '> 镜头数: 6\n';
md += '> 字段标准: 25字段/镜头（SC00含5个片头专属字段，共30字段）\n\n';
md += '---\n\n';

for (const shot of data.shots) {
  md += '## ' + shot.shotId + '（' + shot.sceneType + '）\n\n';
  md += '**时长**: ' + shot.duration + '秒\n';
  md += '**Prompt长度**: ' + (shot.prompt?.length || 0) + '字符\n';
  md += '**字段数**: ' + Object.keys(shot.fields || {}).length + '\n\n';
  
  md += '### Prompt原文\n\n';
  md += '```\n' + (shot.prompt || 'N/A') + '\n```\n\n';
  
  md += '### 字段详情\n\n';
  const fields = shot.fields || {};
  for (const [key, value] of Object.entries(fields)) {
    const cnName = FIELD_NAME_CN[key] || key;
    const valStr = String(value || '').substring(0, 300);
    md += '- **' + cnName + '**: ' + valStr + (String(value || '').length > 300 ? '...' : '') + '\n';
  }
  md += '\n---\n\n';
}

fs.writeFileSync('output/full-prompts-cn.md', md);
console.log('报告已生成: output/full-prompts-cn.md');
console.log('文件大小:', fs.statSync('output/full-prompts-cn.md').size, 'bytes');
