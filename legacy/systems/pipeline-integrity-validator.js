/**
 * 【v2.2.5-审计修复】弃用副本，改为再导出 shim
 * ------------------------------------------------------------
 * 本文件曾是 hyperreality-system/engines/production-engine/utils/pipeline-integrity-validator.js
 * 的复制粘贴副本（仅 temperature 一个常量不同），双副本漂移是典型维护地雷：
 * 正本修复阈值 bug 时副本不会同步。现收敛为唯一实现 + 本 shim，
 * 保留本路径仅为兼容历史引用；新代码请直接引用正本路径。
 */
module.exports = require('../hyperreality-system/engines/production-engine/utils/pipeline-integrity-validator.js');
