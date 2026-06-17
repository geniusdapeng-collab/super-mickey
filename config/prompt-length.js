// 统一 Prompt 长度配置（唯一真源）
// 超短裙系统：总长度稳定落在 1400-1500 字符区间

module.exports = {
  TARGET_MIN: 1400,
  TARGET_MAX: 1500,
  HARD_MAX: 1500,

  // 保留兼容字段，但不再依赖固定模板长度
  SYSTEM_TEMPLATE_LEN: 0,

  getCreativeTarget(systemTemplateLen = 0) {
    return {
      min: Math.max(0, this.TARGET_MIN - systemTemplateLen),
      max: Math.max(0, this.TARGET_MAX - systemTemplateLen)
    };
  },

  validate(length) {
    return length >= this.TARGET_MIN && length <= this.TARGET_MAX;
  },

  getStatus(length) {
    if (length > this.HARD_MAX) return 'overflow';
    if (length < this.TARGET_MIN) return 'underflow';
    if (length <= this.TARGET_MAX) return 'ideal';
    return 'unknown';
  }
};
