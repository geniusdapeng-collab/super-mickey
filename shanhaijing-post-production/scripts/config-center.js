/**
 * Config Center — 配置集中管理
 * v5.5-Peng: 与 director config-center.js 对齐
 */

const path = require('path');

const CONFIG = {
  version: '5.5-Peng',
  postProduction: {
    enabled: true,
    ffmpegOptions: '-c copy'
  }
};

function getConfig() {
  return CONFIG;
}

function getConfigPath() {
  return path.join(__dirname, '../config');
}

module.exports = { CONFIG, getConfig, getConfigPath };