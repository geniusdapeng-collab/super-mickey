'use strict';

const fs = require('fs');
const path = require('path');

function replaceSection(content, title, body) {
  const regex = new RegExp(`\\n---\\n\\n\\*\\*【${title}】\\*\\*[\\s\\S]*?$`, 'm');
  const section = `\n\n---\n\n**【${title}】**\n\n\`\`\`\n${body}\n\`\`\`\n`;
  if (regex.test(content)) return content.replace(regex, section);
  return content + section;
}

function main() {
  const promptsDir = process.argv[2] || path.join(process.cwd(), 'output/prompts');
  const resultDir = path.join(promptsDir, '_promptforge_results');

  const resultFiles = fs.readdirSync(resultDir).filter(f => f.endsWith('.json'));

  for (const rf of resultFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(resultDir, rf), 'utf8'));
    if (!data.success) continue;

    const baseName = rf.replace(/\.json$/, '.md');
    const mdPath = path.join(promptsDir, baseName);
    if (!fs.existsSync(mdPath)) continue;

    let content = fs.readFileSync(mdPath, 'utf8');
    content = replaceSection(content, '精简渲染Prompt', data.prompt);
    fs.writeFileSync(mdPath, content, 'utf8');
  }

  console.log('Applied promptforge results.');
}

main();
