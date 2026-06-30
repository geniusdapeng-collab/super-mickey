const { AdventureCinematographySystem } = require('./adventure-cinematography-system');
const { AmbientSoundDesignerBridge } = require('./ambient-sound-designer.bridge');
const { BeastEntranceAgentBridge } = require('./beast-entrance-agent.bridge');
const { CameraMovementSystemV3Bridge } = require('./camera-movement-system-v3.bridge');
const { BeastOpeningLineAgent } = require('./beast-opening-line-agent');
const { BeastVoiceSignatureEngine } = require('./beast-voice-signature-engine');

class SubsystemOrchestratorV2 {
  constructor(options = {}) {
    this.options = options;
    this.adventure = new AdventureCinematographySystem(options.adventure || {});
    this.soundBridge = new AmbientSoundDesignerBridge(options.sound || {});
    this.beastBridge = new BeastEntranceAgentBridge(options.beast || {});
    this.cameraBridge = new CameraMovementSystemV3Bridge(options.camera || {});
    this.openingLineAgent = new BeastOpeningLineAgent(options.openingLine || {});
    this.voiceEngine = new BeastVoiceSignatureEngine();
  }

  async run(shot, context = {}) {
    const shotType = (shot.type || shot.shotType || '').toLowerCase();
    const isOpening = shotType.includes('opening') || shot.id === 'S00' || shot.id === 'S01' || shot.isOpening;
    const isClimax = shotType.includes('climax') || (shot.tension || 0) > 80;
    const isClosing = shotType.includes('closing') || shot.isClosing || shot.isEnding;
    const hasBeast = !!(context.beastId || shot.beastId || context.beastName || shot.beastName);

    const baseFields = {
      CHARACTER: this._buildCharacterField(shot, context),
      ACTION: '',
      SCENE: this._buildSceneField(shot, context),
      MOOD: this._buildMoodField(shot, context, { isOpening, isClimax, isClosing }),
      CAMERA: '',
      LIGHTING: '',
      NEGATIVE: '',
      AUDIO: '',
      RENDER: shot.renderStyle || '电影级、超写实、细节丰富',
      DIRECTOR: ''
    };

    const activatedSubsystems = [];

    // 1. 冒险运镜补充（只作为辅助）
    let adventureFields = {};
    try {
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
        adventureFields = {
          CAMERA: adventureCamera.primary || '',
          MOOD: adventureCamera.emotion || ''
        };
        activatedSubsystems.push('AdventureCinematographySystem');
      }
    } catch (e) {}

    // 2. 运镜/光影 bridge
    let cameraFields = {};
    try {
      cameraFields = this.cameraBridge.generateFields(shot, context);
      activatedSubsystems.push('CameraMovementSystemV3Bridge');
    } catch (e) {}

    // 3. 环境音 bridge
    let soundFields = {};
    try {
      soundFields = this.soundBridge.generateFields(shot, context);
      activatedSubsystems.push('AmbientSoundDesignerBridge');
    } catch (e) {}

    // 4. 异兽出场 bridge
    let beastFields = {};
    if (hasBeast && (isOpening || shotType.includes('reveal') || shotType.includes('entrance') || isClimax)) {
      try {
        beastFields = this.beastBridge.generateFields(shot, context);
        activatedSubsystems.push('BeastEntranceAgentBridge');
      } catch (e) {}
    }

    // 5. 神兽开场白（仅 opening）
    let openingFields = {};
    if (hasBeast && isOpening) {
      try {
        const openingLine = await this.openingLineAgent.generate(
          {
            name: context.beastName || shot.beastName || '神兽',
            coreTrait: context.beastTrait || '',
            habitat: context.habitat || shot.scene || '',
            age: context.beastAge || ''
          },
          {
            theme: context.episodeTheme || '',
            reversal: context.reversal || ''
          }
        );

        if (openingLine?.line) {
          openingFields.DIRECTOR = `开场神兽台词：「${openingLine.line}」`;
          activatedSubsystems.push('BeastOpeningLineAgent');
        }
      } catch (e) {}
    }

    // 6. 神兽声音签名（仅 opening）
    let voiceFields = {};
    if (hasBeast && isOpening) {
      try {
        const voice = this.voiceEngine.generate(
          context.beastId || shot.beastId,
          context.beastName || shot.beastName || '神兽',
          { episodeHook: context.episodeHook || '' }
        );

        if (voice?.voiceMoment) {
          voiceFields.AUDIO = voice.voiceMoment;
          activatedSubsystems.push('BeastVoiceSignatureEngine');
        }
      } catch (e) {}
    }

    const merged = this._mergeFieldObjects(
      baseFields,
      adventureFields,
      cameraFields,
      soundFields,
      beastFields,
      openingFields,
      voiceFields
    );

    return {
      ...merged,
      meta: {
        activatedSubsystems
      }
    };
  }

  _buildCharacterField(shot, context) {
    const chars = context.characters || shot.characters || [];
    if (Array.isArray(chars)) {
      return chars.join('，');
    }
    return String(chars || '');
  }

  _buildSceneField(shot, context) {
    return shot.scene || shot.sceneName || shot.visualPrompt || context.habitat || '';
  }

  _buildMoodField(shot, context, flags = {}) {
    if (shot.emotionPhase || shot.mood) return shot.emotionPhase || shot.mood;
    if (flags.isOpening) return '神秘、吸引、建立悬念';
    if (flags.isClimax) return '震撼、紧张、情绪峰值';
    if (flags.isClosing) return '温暖、释然、余韵';
    return '沉浸、电影感';
  }

  _mergeFieldObjects(...objs) {
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
      DIRECTOR: ''
    };

    for (const obj of objs) {
      if (!obj) continue;

      for (const key of Object.keys(result)) {
        const value = this._clean(obj[key]);
        if (!value) continue;

        if (!result[key]) {
          result[key] = value;
        } else if (['CAMERA', 'LIGHTING', 'AUDIO', 'DIRECTOR', 'MOOD'].includes(key)) {
          if (!result[key].includes(value)) {
            result[key] += `；${value}`;
          }
        } else if (key === 'ACTION') {
          if (!result[key].includes(value)) {
            result[key] += `；${value}`;
          }
        }
      }
    }

    return result;
  }

  _clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = { SubsystemOrchestratorV2 };
