'use strict';

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('release-manifest');

function loadSystemManifest(baseDir = process.cwd()) {
  const manifestPath = path.join(baseDir, 'config', 'system-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`system-manifest.json 不存在: ${manifestPath}`);
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  return {
    manifestPath,
    manifest
  };
}

function getCurrentVersion(baseDir = process.cwd()) {
  const versionFile = path.join(baseDir, '.current-version');
  if (!fs.existsSync(versionFile)) {
    return null;
  }
  return fs.readFileSync(versionFile, 'utf8').trim();
}

function buildReleaseSnapshot(baseDir = process.cwd()) {
  const { manifestPath, manifest } = loadSystemManifest(baseDir);
  const currentVersion = getCurrentVersion(baseDir);

  return {
    generatedAt: new Date().toISOString(),
    manifestPath,
    systemName: manifest.systemName,
    manifestVersion: manifest.version,
    currentVersion,
    currentMode: manifest.currentMode,
    entrypoints: manifest.entrypoints,
    coreConfigs: manifest.coreConfigs,
    coreSystems: manifest.coreSystems,
    stageServices: manifest.stageServices,
    requiredDirectories: manifest.requiredDirectories,
    keyCapabilities: manifest.keyCapabilities
  };
}

function printReleaseSnapshot(snapshot) {
  logger.info('系统发布快照', {
    systemName: snapshot.systemName,
    manifestVersion: snapshot.manifestVersion,
    currentVersion: snapshot.currentVersion,
    currentMode: snapshot.currentMode
  });
}

module.exports = {
  loadSystemManifest,
  getCurrentVersion,
  buildReleaseSnapshot,
  printReleaseSnapshot
};
