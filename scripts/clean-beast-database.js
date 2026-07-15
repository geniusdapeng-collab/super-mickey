const fs = require('fs');
const path = require('path');

const BEAST_DIR = '/root/.openclaw/workspace/systems/beast-database/beasts';

// 智能替换映射（上下文感知）
const REPLACEMENTS = [
  // 栖息地名称（保留键名，改描述）
  { pattern: /阳山荒原/g, replacement: '阳山生态区' },
  { pattern: /单张荒原/g, replacement: '单张生态区' },
  { pattern: /双月荒原/g, replacement: '双月生态区' },
  { pattern: /三危荒原/g, replacement: '三危生态区' },
  { pattern: /太山荒原/g, replacement: '太山生态区' },
  { pattern: /谯明荒原/g, replacement: '谯明生态区' },
  { pattern: /赤晶荒漠/g, replacement: '赤晶生态区' },
  
  // 严重负面地貌 → 生态恢复语境
  { pattern: /寸草不生的不毛之地/g, replacement: '地质活跃的生态过渡带' },
  { pattern: /寸草不生的荒漠/g, replacement: '植被重建中的生态修复带' },
  { pattern: /寸草不生/g, replacement: '植被稀疏的岩石基底' },
  { pattern: /不毛之地/g, replacement: '生态过渡带' },
  { pattern: /荒芜平原/g, replacement: '生态恢复平原' },
  { pattern: /荒芜岩石区/g, replacement: '岩石生态基底' },
  { pattern: /荒芜区域/g, replacement: '生态恢复区' },
  { pattern: /荒芜地带/g, replacement: '能量缓冲带' },
  { pattern: /荒芜无人区/g, replacement: '生态监测无人区' },
  { pattern: /荒芜山岭/g, replacement: '地质活跃山岭' },
  { pattern: /荒芜山谷/g, replacement: '生态修复山谷' },
  { pattern: /荒芜山崖/g, replacement: '生态监测山崖' },
  { pattern: /荒芜之境/g, replacement: '生态过渡之境' },
  { pattern: /荒芜裂谷/g, replacement: '地质活跃裂谷' },
  { pattern: /荒芜/g, replacement: '生态恢复区' },
  
  // 其他负面地貌
  { pattern: /戈壁滩/g, replacement: '地质过渡带' },
  { pattern: /戈壁/g, replacement: '地质活跃区' },
  { pattern: /荒漠/g, replacement: '生态修复带' },
  { pattern: /死寂环境/g, replacement: '静谧生态区' },
  { pattern: /死寂/g, replacement: '静谧' },
  { pattern: /光秃秃/g, replacement: '岩石基底' },
  { pattern: /光秃/g, replacement: '岩石基底' },
];

const files = fs.readdirSync(BEAST_DIR).filter(f => f.endsWith('.json'));
let totalFiles = 0;
let totalReplacements = 0;
const changedFiles = [];

for (const file of files) {
  const filePath = path.join(BEAST_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let fileReplacements = 0;
  
  for (const { pattern, replacement } of REPLACEMENTS) {
    const matches = content.match(pattern);
    if (matches) {
      const count = matches.length;
      content = content.replace(pattern, replacement);
      fileReplacements += count;
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    totalReplacements += fileReplacements;
    changedFiles.push(`${file}: ${fileReplacements}处`);
  }
}

console.log(`✅ Beast-Database 生态清理完成`);
console.log(`   修改文件: ${totalFiles}/${files.length}`);
console.log(`   替换次数: ${totalReplacements}`);
console.log(`   修改详情:`);
changedFiles.forEach(f => console.log(`     - ${f}`));
