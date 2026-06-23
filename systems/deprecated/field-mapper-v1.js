/**
 * 字段映射器 v1
 * 作用：
 * 把历史shot结构映射成统一shot schema
 */

class FieldMapper {
  constructor(options = {}) {
    this.options = options;
  }

  mapShot(rawShot = {}, context = {}) {
    const mapped = {
      id: this._pick(rawShot, ['id', 'shotId', 'name'], ''),
      type: this._pick(rawShot, ['type', 'shotType', 'beatName'], ''),
      scene: this._pick(rawShot, ['scene', 'sceneName', 'location'], ''),
      sceneType: this._pick(rawShot, ['sceneType'], context.sceneType || ''),
      emotionPhase: this._pick(rawShot, ['emotionPhase', 'emotion', 'mood'], ''),
      narration: this._pick(rawShot, ['narration', 'narrative', 'line'], ''),
      action: this._pick(rawShot, ['action'], ''),
      visualPrompt: this._pick(rawShot, ['visualPrompt', 'visual', 'environmentDesign', 'prompt'], ''),
      camera: this._pick(rawShot, ['camera'], ''),
      cameraMovement: this._pick(rawShot, ['cameraMovement', 'movement'], null),
      lighting: this._pick(rawShot, ['lighting', 'lightingPlan'], null),
      audio: this._pick(rawShot, ['audio', 'sound'], ''),
      renderStyle: this._pick(rawShot, ['renderStyle', 'render'], ''),
      negativePrompt: this._pick(rawShot, ['negativePrompt', 'negative'], ''),
      characters: this._normalizeCharacters(rawShot.characters || rawShot.characterList || []),
      duration: this._toNumber(rawShot.duration || rawShot.shotDuration || 0),
      beastId: this._pick(rawShot, ['beastId'], context.beastId || ''),
      beastName: this._pick(rawShot, ['beastName'], context.beastName || ''),
      tension: this._toNumber(rawShot.tension || 0),
      isOpening: !!rawShot.isOpening,
      isEnding: !!rawShot.isEnding,
      isClosing: !!rawShot.isClosing
    };

    return mapped;
  }

  mapShots(rawShots = [], context = {}) {
    return rawShots.map((shot, index) => {
      const mapped = this.mapShot(shot, context);
      mapped.index = index;
      return mapped;
    });
  }

  _pick(obj, keys, fallback) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return obj[key];
      }
    }
    return fallback;
  }

  _normalizeCharacters(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(v => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'object') {
          // 【v2.1.4-fix10-P25-fix5】对象提取名称/ID，不序列化整个对象
          return (v.name || v.character_id || v.id || v.characterRef || '').toString().trim();
        }
        return String(v).trim();
      }).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value.split(/[，,]/).map(v => v.trim()).filter(Boolean);
    }
    if (typeof value === 'object') {
      // 单个角色对象
      const name = value.name || value.character_id || value.id || '';
      return name ? [String(name).trim()] : [];
    }
    return [];
  }

  _toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}

module.exports = { FieldMapper };
