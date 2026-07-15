'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildReleaseSnapshot
} = require('../systems/release-manifest');

function exists(baseDir, relPath) {
  return fs.existsSync(path.join(baseDir, relPath));
}

function isDir(baseDir, relPath) {
  const fullPath = path.join(baseDir, relPath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
}

function run() {
  const baseDir = process.cwd();
  const snapshot = buildReleaseSnapshot(baseDir);

  const checks = [];

  // 1. 版本一致性
  checks.push({
    name: '版本文件存在',
    passed: snapshot.currentVersion !== null,
    detail: snapshot.currentVersion || '缺少 .current-version'
  });

  checks.push({
    name: 'manifest版本与.current-version一致',
    passed: snapshot.currentVersion === snapshot.manifestVersion,
    detail: `manifest=${snapshot.manifestVersion}, current=${snapshot.currentVersion}`
  });

  // 2. 入口文件检查
  for (const [name, relPath] of Object.entries(snapshot.entrypoints || {})) {
    checks.push({
      name: `入口文件存在: ${name}`,
      passed: exists(baseDir, relPath),
      detail: relPath
    });
  }

  // 3. 配置文件检查
  for (const relPath of snapshot.coreConfigs || []) {
    checks.push({
      name: `核心配置存在`,
      passed: exists(baseDir, relPath),
      detail: relPath
    });
  }

  // 4. 核心系统检查
  for (const relPath of snapshot.coreSystems || []) {
    checks.push({
      name: `核心系统存在`,
      passed: exists(baseDir, relPath),
      detail: relPath
    });
  }

  // 5. Stage 服务检查
  for (const relPath of snapshot.stageServices || []) {
    checks.push({
      name: `Stage服务存在`,
      passed: exists(baseDir, relPath),
      detail: relPath
    });
  }

  // 6. 目录检查
  for (const relPath of snapshot.requiredDirectories || []) {
    checks.push({
      name: `目录存在`,
      passed: isDir(baseDir, relPath),
      detail: relPath
    });
  }

  const failed = checks.filter(c => !c.passed);
  const passed = checks.filter(c => c.passed);

  console.log('=== 项目健康检查 ===');
  console.log(`系统: ${snapshot.systemName}`);
  console.log(`版本: ${snapshot.currentVersion || 'UNKNOWN'}`);
  console.log(`模式: ${snapshot.currentMode}`);
  console.log('');
  console.log(`通过: ${passed.length}`);
  console.log(`失败: ${failed.length}`);
  console.log('');

  if (failed.length > 0) {
    console.log('--- 失败项 ---');
    for (const item of failed) {
      console.log(`❌ ${item.name} | ${item.detail}`);
    }
    console.log('');
  }

  console.log('--- 全量检查项 ---');
  for (const item of checks) {
    console.log(`${item.passed ? '✅' : '❌'} ${item.name} | ${item.detail}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

run();
