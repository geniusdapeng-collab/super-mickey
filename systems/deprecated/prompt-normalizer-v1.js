const { PROMPT_FIELDS, FIELD_DEFAULTS } = require('./prompt-schema-v1');

class PromptNormalizer {
  constructor(options = {}) {
    this.options = options;
    this.maxLength = options.maxLength || 1500;
  }

  normalize(raw = {}) {
    const normalized = {};

    // 1. 补齐字段
    for (const field of PROMPT_FIELDS) {
      normalized[field] = this._toText(
        raw[field] !== undefined ? raw[field] : FIELD_DEFAULTS[field]
      );
    }

    // 2. 智能补漏
    if (!normalized.ACTION && raw.narration) normalized.ACTION = this._toText(raw.narration);
    if (!normalized.SCENE && raw.visualPrompt) normalized.SCENE = this._toText(raw.visualPrompt);
    if (!normalized.CAMERA && raw.cameraMovement) normalized.CAMERA = this._toText(raw.cameraMovement);
    if (!normalized.LIGHTING && raw.lighting) normalized.LIGHTING = this._toText(raw.lighting);
    if (!normalized.AUDIO && raw.audio) normalized.AUDIO = this._toText(raw.audio);
    if (!normalized.NEGATIVE && raw.negativePrompt) normalized.NEGATIVE = this._toText(raw.negativePrompt);

    // 3. 清洗
    for (const field of PROMPT_FIELDS) {
      normalized[field] = this._clean(normalized[field]);
    }

    // 4. 拼装
    const prompt = this.compose(normalized);

    return {
      fields: normalized,
      prompt,
      length: prompt.length,
      valid: prompt.length <= this.maxLength,
      missingFields: PROMPT_FIELDS.filter(f => !normalized[f])
    };
  }

  compose(fields) {
    const parts = [];
    for (const field of PROMPT_FIELDS) {
      if (fields[field]) {
        parts.push(`${field}: ${fields[field]}`);
      }
    }
    return `{${parts.join(' | ')}}`;
  }

  _toText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(v => this._toText(v)).filter(Boolean).join('，');
    if (typeof value === 'object') {
      if (value.prompt) return this._toText(value.prompt);
      if (value.description) return this._toText(value.description);
      if (value.primary) return this._toText(value.primary);
      return Object.values(value).map(v => this._toText(v)).filter(Boolean).join('，');
    }
    return String(value);
  }

  _clean(text) {
    return (text || '')
      .replace(/\s+/g, ' ')
      .replace(/[|]{2,}/g, '|')
      .replace(/[，,]{2,}/g, '，')
      .replace(/[；;]{2,}/g, '；')
      .replace(/^\s+|\s+$/g, '');
  }
}

module.exports = { PromptNormalizer };
