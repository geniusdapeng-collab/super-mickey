const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const OUTPUT_FILE = path.join(WORKSPACE, 'output', 'zhuoyue-systems-v6.5-zhuoyue-only.md');

// 卓越主系统目录（只包含卓越核心，排除超短裙和超现实）
const PACK_DIRS = [
  { dir: 'systems', label: '卓越主系统' },
  { dir: 'engines', label: '引擎层' },
  { dir: 'core', label: '核心层' },
  { dir: 'scripts', label: '脚本' },
  { dir: 'app', label: '应用层' },
  { dir: 'utils', label: '工具' },
  { dir: 'docs', label: '文档' },
  { dir: 'config', label: '配置' },
  { dir: 'templates', label: '模板' },
  { dir: 'data', label: '数据' },
  { dir: 'characters', label: '角色档案' },
  { dir: 'agents', label: '代理系统' },
  { dir: 'shared-kernel', label: '共享内核' },
  { dir: 'domain', label: '领域层' },
  { dir: 'analysis', label: '分析' },
  { dir: 'stories', label: '故事项目' },
  { dir: 'projects', label: '生产项目' },
  { dir: 'productions', label: '生产产物' },
];

// 要打包的文件扩展名
const CODE_EXTS = ['.js', '.json', '.md', '.ts', '.py', '.html', '.css', '.yaml', '.yml', '.sh', '.txt'];

// 排除的路径模式
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.trash',
  'output',
  'videos',
  'memorized_diary',
  'memory',
  'memory_consolidation',
  'backup',
  'audit-logs',
  'debug_llm',
  'versions',
  'skills',
  'architecture-v2',
  'app/commands',
];

const EXCLUDE_FILE_PATTERNS = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.mp3', '.wav', '.ogg', '.aac', '.flac',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib',
  '.log', '.tmp', '.temp', '.cache',
  '.DS_Store', 'Thumbs.db',
  'package-lock.json', 'yarn.lock', '.pnpm-lock.yaml',
];

function shouldExcludeFile(filename) {
  for (const pattern of EXCLUDE_FILE_PATTERNS) {
    if (filename.toLowerCase().endsWith(pattern)) return true;
  }
  return false;
}

function shouldExcludeDir(dirPath) {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (dirPath.includes('/' + pattern + '/') || dirPath.endsWith('/' + pattern)) return true;
  }
  return false;
}

function collectFiles(dir, base = '') {
  let files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = base ? path.join(base, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        if (shouldExcludeDir(fullPath)) continue;
        files.push(...collectFiles(fullPath, relativePath));
      } else if (CODE_EXTS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
        if (!shouldExcludeFile(entry.name)) {
          files.push({ fullPath, relativePath });
        }
      }
    }
  } catch (e) {
    // 忽略无法读取的目录
  }
  return files;
}

let totalFiles = 0;
let totalSize = 0;
let md = '';

for (const { dir, label } of PACK_DIRS) {
  const fullDir = path.join(WORKSPACE, dir);
  if (!fs.existsSync(fullDir)) {
    md += `## [${label}] ${dir} — 目录不存在，跳过\n\n---\n\n`;
    continue;
  }
  
  const files = collectFiles(fullDir);
  if (files.length === 0) {
    md += `## [${label}] ${dir} — 无代码文件\n\n---\n\n`;
    continue;
  }
  
  md += `## [${label}] ${dir} — ${files.length} 个文件\n\n`;
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.fullPath, 'utf8');
      const ext = path.extname(file.relativePath).toLowerCase();
      let lang = 'javascript';
      if (ext === '.json') lang = 'json';
      else if (ext === '.md') lang = 'markdown';
      else if (ext === '.ts') lang = 'typescript';
      else if (ext === '.py') lang = 'python';
      else if (ext === '.html') lang = 'html';
      else if (ext === '.css') lang = 'css';
      else if (ext === '.yaml' || ext === '.yml') lang = 'yaml';
      else if (ext === '.sh') lang = 'bash';
      else if (ext === '.txt') lang = 'text';
      
      md += '### ' + file.relativePath + '\n\n';
      md += '```' + lang + '\n';
      md += content;
      md += '\n```\n\n';
      
      totalFiles++;
      totalSize += content.length;
    } catch (e) {
      md += '### ' + file.relativePath + '\n\n[读取失败: ' + e.message + ']\n\n';
    }
  }
  
  md += '---\n\n';
}

md = '# 卓越系统 v6.5 全量代码（仅卓越核心，不含超短裙/超现实）\n\n' +
     '> 打包时间: ' + new Date().toISOString() + '\n' +
     '> 文件总数: ' + totalFiles + '\n' +
     '> 总字符数: ' + (totalSize / 1024 / 1024).toFixed(2) + ' MB\n' +
     '> 打包范围: 卓越主系统 + 引擎层 + 核心层 + 脚本 + 应用层 + 工具 + 文档 + 配置 + 模板 + 数据 + 角色档案 + 代理系统 + 共享内核 + 领域层 + 分析 + 故事项目 + 生产项目 + 生产产物\n' +
     '> 排除系统: 超短裙系统(short-video-system), 香香彩虹桥(hyperreal/hyperreality-system), Seedance子系统, 山海经子系统\n' +
     '> 包含文件类型: .js, .json, .md, .ts, .py, .html, .css, .yaml, .yml, .sh, .txt\n' +
     '> 排除: .git, node_modules, 媒体文件(PNG/JPG/MP4), 二进制文件\n\n' +
     '---\n\n' + md;

fs.writeFileSync(OUTPUT_FILE, md);

console.log('✅ 打包完成！');
console.log('文件总数:', totalFiles);
console.log('总字符数:', totalSize, '(' + (totalSize / 1024 / 1024).toFixed(2) + ' MB)');
console.log('输出路径:', OUTPUT_FILE);
console.log('实际文件大小:', (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2) + ' MB');
