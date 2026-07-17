/**
 * 单一版本源 v1.0.8
 * 【P2-19-审计修复】统一所有模块版本号
 */
module.exports = {
  VERSION: '1.0.8',
  BUILD_DATE: '2026-06-27',
  toString() { return `v${this.VERSION} (${this.BUILD_DATE})`; }
};
