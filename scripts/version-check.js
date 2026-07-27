#!/usr/bin/env node
/**
 * version-check.js — 版本号一致性校验
 * v2.2.1: 防止 .current-version / package.json / 代码注释 三者不一致
 *
 * 使用方式：
 *   node scripts/version-check.js              # 手动检查
 *   node scripts/version-check.js --fix        # 自动修复（对齐到 .current-version）
 *   node scripts/version-check.js --pre-commit # CI/pre-commit 模式（不一致时退出码 1）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 版本源定义
const SOURCES = [
  {
    name: '.current-version',
    file: '.current-version',
    extract: (content) => content.trim(),
  },
  {
    name: 'package.json',
    file: 'package.json',
    extract: (content) => {
      const json = JSON.parse(content);
      return json.version ? `v${json.version}` : null;
    },
  },
  {
    name: 'index.js 头部注释',
    file: 'hyperreality-system/index.js',
    extract: (content) => {
      const m = content.match(/版本[:：]v?([\d.]+[-\w]*)/i);
      return m ? `v${m[1]}` : null;
    },
  },
];

function readSource(source) {
  const fp = path.join(ROOT, source.file);
  if (!fs.existsSync(fp)) {
    return { name: source.name, file: source.file, version: null, error: '文件不存在' };
  }
  try {
    const content = fs.readFileSync(fp, 'utf-8');
    const version = source.extract(content);
    return { name: source.name, file: source.file, version, error: version ? null : '提取失败' };
  } catch (e) {
    return { name: source.name, file: source.file, version: null, error: e.message };
  }
}

function main() {
  const args = process.argv.slice(2);
  const isFix = args.includes('--fix');
  const isPreCommit = args.includes('--pre-commit');

  console.log('🔍 [VersionCheck] 版本号一致性校验...\n');

  const results = SOURCES.map(readSource);
  const validVersions = results.filter(r => r.version && !r.error);
  const uniqueVersions = [...new Set(validVersions.map(r => r.version))];

  // 打印结果
  for (const r of results) {
    const status = r.error ? '❌' : '✅';
    const verStr = r.version || `(错误: ${r.error})`;
    console.log(`  ${status} ${r.name.padEnd(18)} → ${verStr}`);
  }
  console.log('');

  // 无有效版本
  if (validVersions.length === 0) {
    console.error('⛔ [VersionCheck] 未找到任何有效版本号');
    process.exit(1);
  }

  // 版本不一致
  if (uniqueVersions.length > 1) {
    console.error(`⛔ [VersionCheck] 版本号不一致！发现 ${uniqueVersions.length} 个不同版本:`);
    for (const v of uniqueVersions) {
      const files = validVersions.filter(r => r.version === v).map(r => r.name).join(', ');
      console.error(`    ${v} → ${files}`);
    }

    if (isFix) {
      const canonical = validVersions.find(r => r.name === '.current-version')?.version || uniqueVersions[0];
      console.log(`\n🔧 [VersionCheck] 自动修复模式 — 对齐到: ${canonical}\n`);

      // 修复 package.json
      const pkgPath = path.join(ROOT, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const newVersion = canonical.replace(/^v/, '');
      if (pkg.version !== newVersion) {
        pkg.version = newVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`  ✅ package.json → ${newVersion}`);
      }

      // 修复 index.js 注释
      const idxPath = path.join(ROOT, 'hyperreality-system/index.js');
      let idxContent = fs.readFileSync(idxPath, 'utf-8');
      const idxMatch = idxContent.match(/版本[:：]v?([\d.]+[-\w]*)/i);
      if (idxMatch) {
        const oldVer = idxMatch[0];
        const newVer = oldVer.replace(/v?[\d.]+[-\w]*/i, canonical);
        if (oldVer !== newVer) {
          idxContent = idxContent.replace(oldVer, newVer);
          fs.writeFileSync(idxPath, idxContent);
          console.log(`  ✅ index.js 注释 → ${canonical}`);
        }
      }

      console.log('\n✅ [VersionCheck] 修复完成，请重新提交。');
      process.exit(0);
    }

    if (isPreCommit) {
      console.error('\n💡 提示: 运行 `node scripts/version-check.js --fix` 自动修复');
      process.exit(1);
    }

    process.exit(1);
  }

  // 全部一致
  const canonical = uniqueVersions[0];
  console.log(`✅ [VersionCheck] 所有版本源一致: ${canonical}`);

  // 【v2.2.5-审计新增】文档版本字面量扫描：
  // 历史事故——README "agent-discovery.yaml" 段长期残留 version: 2.2.2 无人发现。
  // 文档中登记版本字面量必然漂移，此处机器阻断（标注"废弃/失效/历史"的行豁免）。
  const DOC_SCAN_FILES = ['README.md', 'SYSTEM.md', 'SPEC-AUTHORITY.md', 'CONTRIBUTING.md', 'BUSINESS-VALUE.md'];
  const staleHits = [];
  for (const doc of DOC_SCAN_FILES) {
    const fp = path.join(ROOT, doc);
    if (!fs.existsSync(fp)) continue;
    const lines = fs.readFileSync(fp, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/version[:：]\s*v?(\d+\.\d+\.\d+)/i);
      if (m && `v${m[1]}` !== canonical && !/废弃|失效|历史|曾|旧版/.test(line)) {
        staleHits.push(`${doc}:${i + 1} 字面量 v${m[1]} ≠ 当前 ${canonical}`);
      }
    });
  }
  if (staleHits.length > 0) {
    console.error(`\n⛔ [VersionCheck] 文档版本字面量漂移（改为"以 package.json 为准"表述，或加失效标注）:`);
    staleHits.forEach(h => console.error(`    ${h}`));
    process.exit(1);
  }

  // 提醒更新版本号文件（如果没有 .current-version）
  const currentVersionFile = path.join(ROOT, '.current-version');
  if (!fs.existsSync(currentVersionFile)) {
    fs.writeFileSync(currentVersionFile, canonical + '\n');
    console.log(`📝 [VersionCheck] 已创建 .current-version: ${canonical}`);
  }

  process.exit(0);
}

main();
