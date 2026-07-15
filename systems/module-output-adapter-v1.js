/**
 * 模块输出适配器 v1
 * 作用：
 * 把历史模块各种输出格式，统一适配为10字段结构
 */

const STANDARD_FIELDS = [
  'CHARACTER',
  'ACTION',
  'SCENE',
  'MOOD',
  'CAMERA',
  'LIGHTING',
  'NEGATIVE',
  'AUDIO',
  'RENDER',
  'DIRECTOR'
];

class ModuleOutputAdapter {
  constructor(options = {}) {
    this.options = options;
  }

  adapt(output, sourceType = 'unknown') {
    const result = this._emptyFields();

    if (output === null || output === undefined) {
      return result;
    }

    // 1. string 输出
    if (typeof output === 'string') {
      result.ACTION = output;
      return result;
    }

    // 2. 已经是标准字段
    if (this._looksLikeStandardFields(output)) {
      for (const key of STANDARD_FIELDS) {
        result[key] = this._toText(output[key]);
      }
      return result;
    }

    // 3. 常见旧结构兼容
    switch (sourceType) {
      case 'beastEntrance':
        result.ACTION = this._toText(output.narrative || output.action || '');
        result.CAMERA = this._toText(output.camera || output.cameraWork || '');
        result.AUDIO = this._toText(output.audio || '');
        result.DIRECTOR = this._toText(output.mode || '');
        return result;

      case 'cameraSystem':
        result.CAMERA = this._toText(
          output.promptFragment ||
          output.description ||
          output.camera ||
          output.movement ||
          ''
        );
        result.LIGHTING = this._toText(output.lighting || '');
        result.AUDIO = this._toText(output.audio || '');
        return result;

      case 'ambientSound':
        result.AUDIO = this._toText(output.description || output.audio || output);
        return result;

      case 'creativeLLM':
        return this.adapt(output, 'standard');

      default:
        return this._adaptHeuristically(output);
    }
  }

  merge(...fieldObjects) {
    const merged = this._emptyFields();

    for (const obj of fieldObjects) {
      if (!obj) continue;
      for (const key of STANDARD_FIELDS) {
        const value = this._toText(obj[key]);
        if (value && !merged[key]) {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  _adaptHeuristically(output) {
    const result = this._emptyFields();

    result.CHARACTER = this._toText(output.character || output.characters);
    result.ACTION = this._toText(
      output.action ||
      output.narrative ||
      output.narration ||
      output.prompt
    );
    result.SCENE = this._toText(
      output.scene ||
      output.sceneName ||
      output.visualPrompt ||
      output.environmentDesign
    );
    result.MOOD = this._toText(output.mood || output.emotion || output.emotionPhase);
    result.CAMERA = this._toText(
      output.camera ||
      output.cameraMovement ||
      output.promptFragment ||
      output.description
    );
    result.LIGHTING = this._toText(output.lighting);
    result.NEGATIVE = this._toText(output.negative || output.negativePrompt);
    result.AUDIO = this._toText(output.audio || output.sound || output.voiceMoment);
    result.RENDER = this._toText(output.render || output.renderStyle);
    result.DIRECTOR = this._toText(output.director || output.style || output.mode);

    return result;
  }

  _looksLikeStandardFields(obj) {
    return STANDARD_FIELDS.some(k => Object.prototype.hasOwnProperty.call(obj, k));
  }

  _emptyFields() {
    return {
      CHARACTER: '',
      ACTION: '',
      SCENE: '',
      MOOD: '',
      CAMERA: '',
      LIGHTING: '',
      NEGATIVE: '',
      AUDIO: '',
      RENDER: '',
      DIRECTOR: ''
    };
  }

  _toText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map(v => this._toText(v)).filter(Boolean).join('，');
    if (typeof value === 'object') {
      if (value.description) return this._toText(value.description);
      if (value.prompt) return this._toText(value.prompt);
      if (value.primary) return this._toText(value.primary);
      return Object.values(value).map(v => this._toText(v)).filter(Boolean).join('，');
    }
    return String(value).trim();
  }
}

module.exports = { ModuleOutputAdapter };
