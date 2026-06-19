const fs = require('fs');
const path = require('path');

const rootDir = './zhuoyue-system';
const outputDir = './zhuoyue-system-export';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// 按模块分组
const modules = {
  'core': [],
  'systems': [],
  'config': [],
  'engines': [],
  'domain': [],
  'data': [],
  'app': [],
  'scripts': [],
  'tests': [],
  'others': []
};

const allFiles = [];
function collect(dir, base) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relPath = path.relative(rootDir, fullPath);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (['backup','productions','debug_llm','node_modules','.git'].includes(item)) continue;
      collect(fullPath, base);
    } else if (item.endsWith('.js') || item.endsWith('.json')) {
      allFiles.push(relPath);
    }
  }
}

collect(rootDir, rootDir);

// 分组
for (const f of allFiles) {
  if (f.startsWith('core/')) modules.core.push(f);
  else if (f.startsWith('systems/')) modules.systems.push(f);
  else if (f.startsWith('config/')) modules.config.push(f);
  else if (f.startsWith('engines/')) modules.engines.push(f);
  else if (f.startsWith('domain/')) modules.domain.push(f);
  else if (f.startsWith('data/')) modules.data.push(f);
  else if (f.startsWith('app/')) modules.app.push(f);
  else if (f.startsWith('scripts/')) modules.scripts.push(f);
  else if (f.startsWith('tests/')) modules.tests.push(f);
  else modules.others.push(f);
}

let totalSize = 0;
let fileCount = 0;

// 为每个模块生成一个 MD 文件
for (const [moduleName, files] of Object.entries(modules)) {
  if (files.length === 0) continue;
  
  let content = `# 卓越系统 (zhuoyue-system) - ${moduleName.toUpperCase()} 模块\n\n`;
  content += `> 导出时间: ${new Date().toISOString()}\n\n`;
  content += `---\n\n`;
  
  for (const relPath of files.sort()) {
    const fullPath = path.join(rootDir, relPath);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const size = fs.statSync(fullPath).size;
    
    content += `## ${relPath}\n\n`;
    content += `> 文件大小: ${size} bytes\n\n`;
    content += '```javascript\n';
    content += fileContent;
    content += '\n```\n\n';
    content += '---\n\n';
    
    totalSize += size;
    fileCount++;
  }
  
  const outPath = path.join(outputDir, `zhuoyue-system-${moduleName}.md`);
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`✅ ${moduleName}: ${files.length} 文件, ${content.length} bytes -> ${outPath}`);
}

console.log(`\n📊 总计: ${fileCount} 文件, ${totalSize} bytes`);
console.log(`📁 输出目录: ${outputDir}`);
