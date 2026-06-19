const fs = require('fs');
const path = require('path');

const rootDir = './zhuoyue-system';
const outputFile = './zhuoyue-system-complete.md';

// 要排除的目录
const excludeDirs = ['node_modules', '.git', 'backup', 'productions', 'debug_llm'];

let allFiles = [];

function collect(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relPath = path.relative(rootDir, fullPath);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (excludeDirs.includes(item)) continue;
      collect(fullPath);
    } else if (item.endsWith('.js') || item.endsWith('.json') || item.endsWith('.md')) {
      allFiles.push({ fullPath, relPath, size: stat.size });
    }
  }
}

collect(rootDir);
allFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));

let content = `# 卓越系统 (zhuoyue-system) 完整代码导出\n\n`;
content += `> 导出时间: ${new Date().toISOString()}\n`;
content += `> 总文件数: ${allFiles.length}\n`;
content += `> 总大小: ${allFiles.reduce((s, f) => s + f.size, 0)} bytes\n`;
content += `> 版本: v6.6.9.4-patch20\n\n`;
content += `---\n\n`;
content += `# 目录\n\n`;

for (const f of allFiles) {
  content += `- [${f.relPath}](#${f.relPath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()})\n`;
}

content += `\n---\n\n`;

for (const f of allFiles) {
  const fileContent = fs.readFileSync(f.fullPath, 'utf8');
  const ext = path.extname(f.relPath).slice(1);
  
  content += `## ${f.relPath}\n\n`;
  content += `> 文件大小: ${f.size} bytes\n\n`;
  content += '```' + ext + '\n';
  content += fileContent;
  // Ensure newline at end
  if (!fileContent.endsWith('\n')) content += '\n';
  content += '```\n\n';
  content += '---\n\n';
}

fs.writeFileSync(outputFile, content, 'utf8');

const totalSize = fs.statSync(outputFile).size;
console.log(`✅ 完成: ${outputFile}`);
console.log(`   文件数: ${allFiles.length}`);
console.log(`   总大小: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
