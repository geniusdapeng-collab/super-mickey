// 全局错误码统一
module.exports = {
  SUCCESS: 0,
  UNKNOWN_ERROR: 1,
  TIMEOUT: 2,
  OOM: 3,
  API_ERROR: 4,
  PARSE_ERROR: 5,
  QUALITY_FAIL: 6,

  // 描述
  getDescription(code) {
    const map = {
      0: '成功',
      1: '未知错误',
      2: '超时',
      3: '内存不足',
      4: 'API调用失败',
      5: '解析失败',
      6: '质量检查未通过'
    };
    return map[code] || '未知';
  }
};
