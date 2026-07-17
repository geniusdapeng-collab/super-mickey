const { AmbientSoundDesigner } = require('./ambient-sound-designer');

class AmbientSoundDesignerBridge {
  constructor(options = {}) {
    this.designer = new AmbientSoundDesigner();
    this.maxChars = options.maxChars || 80;
  }

  /**
   * 输出标准字段
   */
  generateFields(shot = {}, context = {}) {
    let text = '';
    try {
      text = this.designer.design(shot, { maxChars: this.maxChars }) || '';
    } catch (e) {
      text = '';
    }

    text = String(text)
      .replace(/^【环境音效】/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      AUDIO: text,
      meta: {
        source: 'ambient-sound-designer'
      }
    };
  }
}

module.exports = { AmbientSoundDesignerBridge };
