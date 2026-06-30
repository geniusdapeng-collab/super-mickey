const { PROMPT_FIELDS } = require('./prompt-schema-v1');

class PromptTrimmer {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 1500;

    // 越靠前越先裁
    this.trimOrder = options.trimOrder || [
      'DIRECTOR',
      'RENDER',
      'AUDIO',
      'NEGATIVE',
      'LIGHTING',
      'CAMERA',
      'MOOD',
      'SCENE',
      'ACTION',
      'CHARACTER'
    ];

    // 最低保留长度
    this.minFieldLength = {
      DIRECTOR: 0,
      RENDER: 8,
      AUDIO: 8,
      NEGATIVE: 20,
      LIGHTING: 20,
      CAMERA: 25,
      MOOD: 10,
      SCENE: 40,
      ACTION: 40,
      CHARACTER: 10
    };
  }

  trim(fields = {}, composeFn) {
    const working = { ...fields };
    let prompt = composeFn(working);

    if (prompt.length <= this.maxLength) {
      return {
        fields: working,
        prompt,
        trimmed: false,
        trimmedFields: []
      };
    }

    const trimmedFields = [];

    for (const field of this.trimOrder) {
      if (!working[field]) continue;

      let current = String(working[field]);
      const minLen = this.minFieldLength[field] ?? 0;

      while (current.length > minLen) {
        current = this._shrink(current);
        working[field] = current;
        prompt = composeFn(working);

        if (!trimmedFields.includes(field)) {
          trimmedFields.push(field);
        }

        if (prompt.length <= this.maxLength) {
          return {
            fields: working,
            prompt,
            trimmed: true,
            trimmedFields
          };
        }

        if (current.length <= minLen) break;
      }
    }

    // 最后兜底：直接砍空可裁字段
    for (const field of this.trimOrder) {
      if (['CHARACTER', 'ACTION', 'SCENE'].includes(field)) continue;
      if (working[field]) {
        working[field] = '';
        if (!trimmedFields.includes(field)) trimmedFields.push(field);
        prompt = composeFn(working);
        if (prompt.length <= this.maxLength) {
          return {
            fields: working,
            prompt,
            trimmed: true,
            trimmedFields
          };
        }
      }
    }

    // 再兜底：极限裁剪 SCENE / ACTION
    for (const field of ['SCENE', 'ACTION']) {
      let current = String(working[field] || '');
      while (current.length > this.minFieldLength[field]) {
        current = this._shrink(current);
        working[field] = current;
        if (!trimmedFields.includes(field)) trimmedFields.push(field);
        prompt = composeFn(working);
        if (prompt.length <= this.maxLength) {
          return {
            fields: working,
            prompt,
            trimmed: true,
            trimmedFields
          };
        }
      }
    }

    return {
      fields: working,
      prompt: composeFn(working).slice(0, this.maxLength),
      trimmed: true,
      trimmedFields,
      forceTrimmed: true
    };
  }

  _shrink(text) {
    if (!text) return '';
    if (text.length <= 12) return text.slice(0, Math.max(0, text.length - 2));

    // 优先按中文分号/逗号/句号裁
    const separators = ['；', '，', '。', ';', ',', '.'];
    for (const sep of separators) {
      const idx = text.lastIndexOf(sep);
      if (idx > text.length * 0.6) {
        return text.slice(0, idx).trim();
      }
    }

    // 否则按比例切
    return text.slice(0, Math.floor(text.length * 0.82)).trim();
  }
}

module.exports = { PromptTrimmer };
