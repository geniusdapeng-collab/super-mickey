const { generateBeastEntrance } = require('./beast-entrance-agent');

class BeastEntranceAgentBridge {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * 生成标准字段
   */
  generateFields(shot = {}, context = {}) {
    const hasBeast = !!(context.beastId || shot.beastId || context.beastName || shot.beastName);
    if (!hasBeast) {
      return {
        ACTION: '',
        CAMERA: '',
        AUDIO: '',
        DIRECTOR: ''
      };
    }

    try {
      const result = generateBeastEntrance({
        beastId: context.beastId || shot.beastId,
        habitat: context.habitat || shot.scene || '',
        mood: shot.mood || shot.emotionPhase || '',
        episodeTheme: context.episodeTheme || '',
        episodeSummary: context.episodeSummary || '',
        entranceDuration: shot.duration || 5
      });

      return {
        ACTION: this._clean(result.narrative),
        CAMERA: this._clean(result.camera),
        AUDIO: this._clean(String(result.audio || '').replace('【震撼音效】', '')),
        DIRECTOR: this._clean(result.mode ? `异兽出场设计:${result.mode}` : ''),
        meta: {
          source: 'beast-entrance-agent',
          impactScore: result.impactScore,
          keyTraits: result.keyTraits || []
        }
      };
    } catch (e) {
      return {
        ACTION: '',
        CAMERA: '',
        AUDIO: '',
        DIRECTOR: ''
      };
    }
  }

  _clean(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = { BeastEntranceAgentBridge };
