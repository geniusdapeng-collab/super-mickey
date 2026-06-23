// 【v2.1.4-fix10-P25-fix8-P1E】中文按bigram切分，避免整句变单token
function normalizeForCompare(str) {
  if (!str) return [];
  const cleaned = String(str).toLowerCase().replace(/\s+/g, ' ');
  const tokens = [];
  
  // 英文按词
  const englishWords = cleaned.match(/[a-z]+/g) || [];
  tokens.push(...englishWords);
  
  // 中文按bigram（二字组），避免整句变单token
  const chineseChars = cleaned.match(/[\u4e00-\u9fa5]/g) || [];
  for (let i = 0; i < chineseChars.length - 1; i++) {
    tokens.push(chineseChars[i] + chineseChars[i + 1]);
  }
  // 单字也加入，避免短文本
  tokens.push(...chineseChars);
  
  return tokens;
}

function jaccardSimilarity(a, b) {
  const sa = new Set(normalizeForCompare(a).split(' ').filter(Boolean));
  const sb = new Set(normalizeForCompare(b).split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return 0;

  let intersection = 0;
  for (const x of sa) {
    if (sb.has(x)) intersection++;
  }
  const union = new Set([...sa, ...sb]).size;
  return union ? intersection / union : 0;
}

function rewriteActionFromScene(scene, characterText) {
  return [
    'performance-focused motion only',
    characterText || 'character identity continuity preserved',
    'measured breathing rhythm',
    'subtle shoulder and neck tension',
    'controlled head turn',
    'micro facial response',
    'eye focus shift',
    'muscle restraint',
    'posture transfer of weight',
    'delayed reaction beat'
  ].join(', ');
}

// 【v2.1.4-fix10-P25-fix8-P0B】增加 mode 参数，非 nirath 模式不覆写为山海经专属
function dedupeShotFields(data, mode = 'nirath') {
  if (!data || typeof data !== 'object') return data;

  const sceneActionSim = jaccardSimilarity(data.Scene, data.Action);
  if (sceneActionSim >= 0.72) {
    data.Action = rewriteActionFromScene(data.Scene, data.Character);
  }

  const cameraSceneSim = jaccardSimilarity(data.Camera, data.Scene);
  if (cameraSceneSim >= 0.72) {
    if (mode === 'nirath' || mode === 'shanhaijing') {
      data.Camera = '电影级航拍转中景下降, 刻意镜头运动, 缓慢推近与焦点迁移, 稳定画框配受控视差与从容节奏';
    } else {
      data.Camera = data.Camera; // generic模式：保留原始Camera，不做硬编码覆写
    }
  }

  const lightingSceneSim = jaccardSimilarity(data.Lighting, data.Scene);
  if (lightingSceneSim >= 0.72) {
    if (mode === 'nirath' || mode === 'shanhaijing') {
      data.Lighting = '暖冷双星光照, 矿物反射补光, 大气薄雾, 体积光柱, 柔和阴影层次, 发光边缘分离, 丰富材质响应';
    } else {
      // ✅ generic模式：去重但保留原始光照语义，只去掉与Scene重复的词
      data.Lighting = data.Lighting; // 暂不实现分词去重，至少不污染
    }
  }

  return data;
}

module.exports = {
  dedupeShotFields,
  jaccardSimilarity
};
