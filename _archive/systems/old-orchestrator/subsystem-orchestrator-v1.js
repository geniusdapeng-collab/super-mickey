/**
 * 子系统编排器 v1.0
 * 目标：
 * 1. 让已有子系统真正稳定参与最终生成
 * 2. 按 shot 类型智能启用模块
 * 3. 统一返回标准字段对象，不直接拼大字符串
 */

const { AdventureCinematographySystem } = require('./adventure-cinematography-system');
const { AmbientSoundDesigner } = require('./ambient-sound-designer');
const { generateBeastEntrance } = require('./beast-entrance-agent');
const { BeastOpeningLineAgent } = require('./beast-opening-line-agent');
const { BeastVoiceSignatureEngine } = require('./beast-voice-signature-engine');
const { GlobalNegativePromptInjector } = require('./global-negative-prompts');

class SubsystemOrchestrator {
  constructor(options = {}) {
    this.options = options;
    this.adventure = new AdventureCinematographySystem(options.adventure || {});
    this.soundDesigner = new AmbientSoundDesigner();
    this.openingLineAgent = new BeastOpeningLineAgent(options.openingLine || {});
    this.voiceEngine = new BeastVoiceSignatureEngine();
    this.negativeInjector = new GlobalNegativePromptInjector();
  }

  /**
   * 主入口：根据shot启用子系统
   * @param {Object} shot
   * @param {Object} context
   * @returns {Object} structuredFields
   */
  async run(shot, context = {}) {
    const result = {
      CHARACTER: '',
      ACTION: '',
      SCENE: '',
      MOOD: '',
      CAMERA: '',
      LIGHTING: '',
      NEGATIVE: '',
      AUDIO: '',
      RENDER: '',
      DIRECTOR: '',
      meta: {
        activatedSubsystems: []
      }
    };

    const shotType = shot.type || shot.shotType || '';
    const isOpening = shotType.includes('opening') || shot.id === 'S01' || shot.id === 'S00';
    const isClimax = shotType.includes('climax') || shot.tension > 80;
    const hasBeast = !!context.beastId || !!context.beastName;

    // 1. 冒险运镜
    const adventureCamera = this.adventure.generateAdventureCamera(
      shot,
      context.index || 0,
      context.totalShots || 1,
      {
        protagonistName: context.protagonistName || '小G',
        beastName: context.beastName || '异兽',
        habitat: context.habitat || shot.scene || '',
        ability: context.ability || ''
      }
    );
    if (adventureCamera) {
      result.CAMERA = adventureCamera.primary || '';
      result.meta.activatedSubsystems.push('AdventureCinematographySystem');
    }

    // 2. 环境音
    const soundText = this.soundDesigner.design(shot, { maxChars: 80 });
    if (soundText) {
      result.AUDIO = soundText;
      result.meta.activatedSubsystems.push('AmbientSoundDesigner');
    }

    // 3. 异兽出场
    if (hasBeast && (isOpening || shotType.includes('reveal') || shotType.includes('entrance'))) {
      try {
        const entrance = generateBeastEntrance({
          beastId: context.beastId,
          habitat: context.habitat,
          mood: shot.mood || '',
          episodeTheme: context.episodeTheme || '',
          episodeSummary: context.episodeSummary || '',
          entranceDuration: shot.duration || 5
        });

        if (entrance?.narrative) {
          result.ACTION = entrance.narrative;
        }
        if (entrance?.camera) {
          result.CAMERA = result.CAMERA
            ? `${result.CAMERA}；${entrance.camera}`
            : entrance.camera;
        }
        if (entrance?.audio) {
          result.AUDIO = result.AUDIO
            ? `${result.AUDIO}；${entrance.audio.replace('【震撼音效】', '')}`
            : entrance.audio.replace('【震撼音效】', '');
        }

        result.meta.activatedSubsystems.push('BeastEntranceAgent');
      } catch (e) {
        // 静默失败，避免主流程挂掉
      }
    }

    // 4. 神兽开场白
    if (hasBeast && isOpening) {
      try {
        const openingLine = await this.openingLineAgent.generate(
          {
            name: context.beastName || context.beastId || '神兽',
            coreTrait: context.beastTrait || '',
            habitat: context.habitat || '',
            age: context.beastAge || ''
          },
          {
            theme: context.episodeTheme || '',
            reversal: context.reversal || ''
          }
        );
        if (openingLine?.line) {
          result.DIRECTOR = `开场神兽台词：「${openingLine.line}」`;
          result.meta.activatedSubsystems.push('BeastOpeningLineAgent');
        }
      } catch (e) {}
    }

    // 5. 神兽声音签名
    if (hasBeast && isOpening) {
      try {
        const voice = this.voiceEngine.generate(
          context.beastId,
          context.beastName || '神兽',
          { episodeHook: context.episodeHook || '' }
        );
        if (voice?.voiceMoment) {
          result.AUDIO = result.AUDIO
            ? `${result.AUDIO}；${voice.voiceMoment}`
            : voice.voiceMoment;
          result.meta.activatedSubsystems.push('BeastVoiceSignatureEngine');
        }
      } catch (e) {}
    }

    // 6. 情绪基调
    result.MOOD = shot.emotionPhase || shot.mood || (isClimax ? '震撼、紧张、情绪峰值' : '神秘、沉浸');

    // 7. 场景
    result.SCENE = shot.scene || shot.sceneName || shot.visualPrompt || shot.environmentDesign || '';

    // 8. 角色
    result.CHARACTER = (context.characters && context.characters.length)
      ? context.characters.join('，')
      : (shot.characters || []).join('，');

    // 9. 渲染
    result.RENDER = shot.renderStyle || '电影级、超写实、细节丰富';

    // 10. 负面提示
    result.NEGATIVE = this.negativeInjector.generateCompact({
      sceneType: context.sceneType || 'nature_epic',
      hasCharacter: true,
      isRealistic: true,
      maxLength: 180
    });

    return result;
  }
}

module.exports = { SubsystemOrchestrator };
