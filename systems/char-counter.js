class CharCounter {
  constructor() {
    this.TARGET_MAX = 1500;
    this.HARD_LIMIT = 1500;
    this.SAFETY_MARGIN = 20;
  }

  count(str) {
    if (!str || typeof str !== 'string') return 0;
    return [...str].length;
  }

  truncate(str, max = this.TARGET_MAX) {
    if (!str || typeof str !== 'string') return '';
    const chars = [...str];
    if (chars.length <= max) return str;
    return chars.slice(0, max).join('').trim();
  }

  utilization(str, max = this.TARGET_MAX) {
    const len = this.count(str);
    return max > 0 ? (len / max) : 0;
  }

  countWeighted(str) {
    // 仅供兼容旧日志展示，不参与业务逻辑
    if (!str || typeof str !== 'string') return 0;
    let total = 0;
    for (const char of str) {
      if (this._isChineseChar(char)) {
        total += 1.5;
      } else {
        total += 1;
      }
    }
    return total;
  }

  _isChineseChar(char) {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df)
    );
  }
}

const charCounter = new CharCounter();

module.exports = {
  CharCounter,
  charCounter
};
