/**
 * Sound-Visual Binding System v1.0 — 声画绑定系统
 * 系统核心基础设施：基于场景描述自动推荐音频，并生成音频规格
 *
 * 职责：
 * - 音频推荐：基于场景描述自动推荐音频素材（音乐、音效、环境音）
 * - 音频规格生成：生成音频规格参数（音量、淡入淡出、循环）
 * - 场景-音频映射：场景类型与音频的映射关系
 * - 音效绑定：镜头与音效的绑定关系
 * - 与Prompt Assembly集成：音频描述注入到Prompt
 * - 与Event Bus集成：发布音频事件
 *
 * 核心能力：
 * 1. AudioAsset: 音频资产定义
 * 2. AudioBinding: 声画绑定关系
 * 3. AudioSpec: 音频规格参数
 * 4. SoundVisualBindingSystem: 主系统
 * 5. AudioRecommendation: 音频推荐引擎
 *
 * 音频类型：
 * - background_music: 背景音乐
 * - ambient_sound: 环境音（风声、雨声、鸟鸣）
 * - sound_effect: 音效（战斗、魔法、脚步）
 * - voice_over: 旁白/配音
 * - foley: 拟音（衣物摩擦、脚步声）
 *
 * 场景-音频映射：
 * - 山顶: 风声、鹰鸣、空灵感音乐
 * - 山谷: 溪流、鸟鸣、回声
 * - 海边: 海浪、海鸥、潮汐声
 * - 森林: 树叶沙沙、虫鸣、神秘音乐
 * - 战场: 金属碰撞、呐喊、战鼓
 * - 仙境: 仙乐、铃铛、祥云音效
 * - 幽都: 阴森音乐、鬼哭、锁链声
 * - 沙漠: 风沙、寂静、驼铃
 *
 * @version v1.0
 * @author Core Team
 * @priority P2 - 山海经专项
 */

'use strict';

const { NirathEventBus } = require('../core/event-bus');

// ============================================================
// 一、音频资产定义
// ============================================================

const AUDIO_TYPES = {
  background_music: { name: '背景音乐', layer: 1, priority: 'low' },
  ambient_sound: { name: '环境音', layer: 2, priority: 'medium' },
  sound_effect: { name: '音效', layer: 3, priority: 'high' },
  voice_over: { name: '旁白', layer: 4, priority: 'highest' },
  foley: { name: '拟音', layer: 5, priority: 'medium' }
};

// 场景-音频映射
const SCENE_AUDIO_MAP = {
  '山顶': {
    ambient: ['风声', '鹰鸣', '远处回声'],
    music: ['空灵', '史诗', '宏大'],
    effects: ['脚步碎石', '衣袂飘动']
  },
  '山谷': {
    ambient: ['溪流', '鸟鸣', '回声'],
    music: ['自然', '宁静', '神秘'],
    effects: ['脚步草地', '树枝断裂']
  },
  '海边': {
    ambient: ['海浪', '海鸥', '潮汐'],
    music: ['悠扬', '忧郁', '宽广'],
    effects: ['脚步沙滩', '水花溅起']
  },
  '森林': {
    ambient: ['树叶沙沙', '虫鸣', '远处兽吼'],
    music: ['神秘', '紧张', '异域'],
    effects: ['脚步落叶', '树枝摩擦']
  },
  '战场': {
    ambient: ['远处呐喊', '金属碰撞', '战鼓'],
    music: ['激昂', '紧张', '悲壮'],
    effects: ['剑击', '爆炸', '马蹄']
  },
  '仙境': {
    ambient: ['仙乐', '铃铛', '祥云'],
    music: ['仙气', '飘渺', '神圣'],
    effects: ['仙气流动', '祥云飘动']
  },
  '幽都': {
    ambient: ['阴森音乐', '鬼哭', '锁链'],
    music: ['恐怖', '压抑', '诡异'],
    effects: ['鬼魂飘动', '锁链拖动']
  },
  '沙漠': {
    ambient: ['风沙', '寂静', '驼铃'],
    music: ['荒凉', '孤独', '异域'],
    effects: ['脚步沙地', '风声呼啸']
  },
  '沼泽': {
    ambient: ['水泡', '昆虫', '迷雾'],
    music: ['阴郁', '危险', '神秘'],
    effects: ['脚步泥泞', '水花']
  },
  '城市': {
    ambient: ['人声', '车马', '叫卖'],
    music: ['热闹', '繁华', '市井'],
    effects: ['脚步石板', '门开关']
  }
};

// 神兽-音频映射
const BEAST_AUDIO_MAP = {
  '饕餮': { effects: ['咀嚼', '低吼', '地面震动'], music: ['恐怖', '压迫'] },
  '麒麟': { effects: ['祥瑞之光', '仙气环绕'], music: ['神圣', '祥和'] },
  '凤凰': { effects: ['凤鸣', '火焰', '翅膀扇动'], music: ['神圣', '热烈'] },
  '青龙': { effects: ['龙吟', '水波', '云雾'], music: ['威严', '古老'] },
  '白虎': { effects: ['虎啸', '风声', '金属'], music: ['肃杀', '勇猛'] },
  '玄武': { effects: ['龟息', '水波', '沉稳'], music: ['厚重', '古老'] },
  '朱雀': { effects: ['鸟鸣', '火焰', '热浪'], music: ['热烈', '神圣'] },
  '刑天': { effects: ['战斗呐喊', '武器碰撞', '脚步'], music: ['激昂', '悲壮'] },
  '帝江': { effects: ['混沌', '空间扭曲', '无形'], music: ['神秘', '原始'] },
  '应龙': { effects: ['龙吟', '雷鸣', '风暴'], music: ['威严', '磅礴'] },
  '烛龙': { effects: ['呼吸', '火焰', '睁眼'], music: ['古老', '神秘'] },
  '夔牛': { effects: ['牛吼', '雷鸣', '震地'], music: ['原始', '力量'] },
  '白泽': { effects: ['祥瑞', '智慧', '低语'], music: ['神圣', '智慧'] },
  '九尾狐': { effects: ['狐鸣', '幻术', '魅惑'], music: ['魅惑', '神秘'] },
  '毕方': { effects: ['鸟鸣', '火焰', '单足'], music: ['热烈', '神秘'] }
};

// ============================================================
// 二、音频规格
// ============================================================

class AudioSpec {
  constructor({ type, volume, fadeIn, fadeOut, loop, duration, delay, pan, reverb }) {
    this.type = type;
    this.volume = volume ?? 0.8;           // 0-1
    this.fadeIn = fadeIn ?? 0;            // 淡入时间（秒）
    this.fadeOut = fadeOut ?? 0;          // 淡出时间（秒）
    this.loop = loop ?? false;            // 是否循环
    this.duration = duration ?? null;    // 持续时间（秒）
    this.delay = delay ?? 0;              // 延迟播放（秒）
    this.pan = pan ?? 0;                  // 声像 -1(左) 到 1(右)
    this.reverb = reverb ?? 0;            // 混响 0-1
  }

  toJSON() {
    return {
      type: this.type,
      volume: this.volume,
      fadeIn: this.fadeIn,
      fadeOut: this.fadeOut,
      loop: this.loop,
      duration: this.duration,
      delay: this.delay,
      pan: this.pan,
      reverb: this.reverb
    };
  }
}

// ============================================================
// 三、声画绑定
// ============================================================

class AudioBinding {
  constructor({ shotId, audioId, audioType, spec, startTime, endTime }) {
    this.id = `binding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.shotId = shotId;
    this.audioId = audioId;
    this.audioType = audioType;
    this.spec = spec || new AudioSpec({ type: audioType });
    this.startTime = startTime || 0;
    this.endTime = endTime || null;
  }

  toJSON() {
    return {
      id: this.id,
      shotId: this.shotId,
      audioId: this.audioId,
      audioType: this.audioType,
      spec: this.spec.toJSON(),
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
}

// ============================================================
// 四、声画绑定系统
// ============================================================

class SoundVisualBindingSystem {
  constructor() {
    this.bindings = new Map();  // shotId -> Array<AudioBinding>
    this.audioLibrary = new Map(); // audioId -> AudioAsset
    this.eventBus = new NirathEventBus({ name: 'sound-visual', enabled: true });
  }

  /**
   * 基于场景推荐音频
   */
  recommendAudio(shot) {
    const scene = shot.scene || shot.sceneName || '';
    const beastName = this.extractBeastName(shot);
    const recommendations = [];

    // 场景推荐
    for (const [sceneKey, audioSet] of Object.entries(SCENE_AUDIO_MAP)) {
      if (scene.includes(sceneKey)) {
        recommendations.push(...this.createRecommendations(sceneKey, audioSet, 'scene'));
      }
    }

    // 神兽推荐
    if (beastName && BEAST_AUDIO_MAP[beastName]) {
      recommendations.push(...this.createRecommendations(beastName, BEAST_AUDIO_MAP[beastName], 'beast'));
    }

    // 去重
    const unique = new Map();
    for (const rec of recommendations) {
      unique.set(rec.name, rec);
    }

    return Array.from(unique.values());
  }

  extractBeastName(shot) {
    const prompt = shot.visualPrompt || '';
    const beasts = Object.keys(BEAST_AUDIO_MAP);
    return beasts.find(b => prompt.includes(b));
  }

  createRecommendations(source, audioSet, type) {
    const recommendations = [];
    
    if (audioSet.ambient) {
      for (const name of audioSet.ambient) {
        recommendations.push({
          name: `${name}（环境音）`,
          type: 'ambient_sound',
          source,
          sourceType: type,
          spec: new AudioSpec({ type: 'ambient_sound', volume: 0.4, loop: true, fadeIn: 1, fadeOut: 1 })
        });
      }
    }
    
    if (audioSet.music) {
      for (const name of audioSet.music) {
        recommendations.push({
          name: `${name}（背景音乐）`,
          type: 'background_music',
          source,
          sourceType: type,
          spec: new AudioSpec({ type: 'background_music', volume: 0.6, loop: true, fadeIn: 2, fadeOut: 2 })
        });
      }
    }
    
    if (audioSet.effects) {
      for (const name of audioSet.effects) {
        recommendations.push({
          name: `${name}（音效）`,
          type: 'sound_effect',
          source,
          sourceType: type,
          spec: new AudioSpec({ type: 'sound_effect', volume: 0.8, loop: false, fadeIn: 0.1, fadeOut: 0.5 })
        });
      }
    }

    return recommendations;
  }

  /**
   * 绑定音频到镜头
   */
  bindAudio(shotId, audioId, audioType, options = {}) {
    const spec = options.spec || new AudioSpec({ type: audioType });
    const binding = new AudioBinding({
      shotId,
      audioId,
      audioType,
      spec,
      startTime: options.startTime || 0,
      endTime: options.endTime || null
    });

    if (!this.bindings.has(shotId)) {
      this.bindings.set(shotId, []);
    }
    this.bindings.get(shotId).push(binding);

    this.eventBus.publish('audio.bound', {
      shotId,
      audioId,
      audioType
    }, { traceId: `svb_${Date.now()}` });

    return binding;
  }

  /**
   * 获取镜头的音频绑定
   */
  getBindings(shotId) {
    return this.bindings.get(shotId) || [];
  }

  /**
   * 生成音频规格（基于镜头和音频）
   */
  generateAudioSpec(shot, audioType, recommendations) {
    const spec = new AudioSpec({ type: audioType });

    // 根据镜头时长调整
    const duration = shot.duration || 5;
    spec.duration = duration;

    // 根据镜头类型调整音量
    if (shot.type === 'close-up') {
      spec.volume = 0.6;  // 特写镜头降低音量，突出对话
      spec.reverb = 0.2;
    } else if (shot.type === 'establishing') {
      spec.volume = 0.8;  // 建景镜头增加音量，营造氛围
      spec.reverb = 0.5;
    }

    // 根据情绪调整
    if (shot.emotionPhase === 'climax') {
      spec.volume = 0.9;  // 高潮增加音量
      spec.fadeIn = 0.5;
    } else if (shot.emotionPhase === 'exposition') {
      spec.volume = 0.5;  // 铺垫降低音量
      spec.fadeIn = 2;
    }

    return spec;
  }

  /**
   * 生成完整音频绑定方案
   */
  generateAudioPlan(shot) {
    const recommendations = this.recommendAudio(shot);
    const bindings = [];

    for (const rec of recommendations) {
      const spec = this.generateAudioSpec(shot, rec.type, rec);
      const binding = this.bindAudio(
        shot.id || shot.shotId,
        rec.name,
        rec.type,
        { spec }
      );
      bindings.push(binding);
    }

    return {
      shotId: shot.id || shot.shotId,
      bindings: bindings.map(b => b.toJSON()),
      recommendations: recommendations.map(r => ({
        name: r.name,
        type: r.type,
        source: r.source
      }))
    };
  }

  /**
   * 生成音频描述（注入Prompt）
   */
  generateAudioPrompt(shot) {
    const recommendations = this.recommendAudio(shot);
    const audioDesc = recommendations.map(r => r.name).join('，');
    
    if (audioDesc) {
      return `【音频环境】${audioDesc}`;
    }
    return '';
  }

  /**
   * 获取统计
   */
  getStats() {
    const totalBindings = Array.from(this.bindings.values()).reduce((sum, arr) => sum + arr.length, 0);
    const byType = {};
    
    for (const bindings of this.bindings.values()) {
      for (const binding of bindings) {
        byType[binding.audioType] = (byType[binding.audioType] || 0) + 1;
      }
    }

    return {
      totalBindings,
      totalShots: this.bindings.size,
      byType
    };
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  SoundVisualBindingSystem,
  AudioBinding,
  AudioSpec,
  SCENE_AUDIO_MAP,
  BEAST_AUDIO_MAP,
  AUDIO_TYPES,

  // 快速创建
  createSoundVisualBinding: () => new SoundVisualBindingSystem()
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Sound-Visual Binding System 集成测试 ===\n');

    const svb = new SoundVisualBindingSystem();

    // 测试1：场景推荐
    console.log('--- 测试1：场景推荐 ---');
    const shot1 = {
      id: 'S01',
      scene: '山顶',
      visualPrompt: '少年穿着白衣站在山顶，饕餮在远处咆哮',
      duration: 5,
      type: 'climax',
      emotionPhase: 'climax'
    };
    const recs = svb.recommendAudio(shot1);
    console.log('推荐音频数:', recs.length);
    console.log('推荐:', recs.map(r => r.name).slice(0, 5).join(', '));

    // 测试2：音频绑定
    console.log('\n--- 测试2：音频绑定 ---');
    const binding = svb.bindAudio('S01', 'wind_ambient', 'ambient_sound', {
      spec: new AudioSpec({ type: 'ambient_sound', volume: 0.5, loop: true })
    });
    console.log('绑定ID:', binding.id);
    console.log('绑定类型:', binding.audioType);

    // 测试3：生成音频方案
    console.log('\n--- 测试3：生成音频方案 ---');
    const plan = svb.generateAudioPlan(shot1);
    console.log('方案绑定数:', plan.bindings.length);
    console.log('绑定类型:', plan.bindings.map(b => b.audioType).join(', '));

    // 测试4：音频Prompt
    console.log('\n--- 测试4：音频Prompt ---');
    const audioPrompt = svb.generateAudioPrompt(shot1);
    console.log('音频Prompt:', audioPrompt);

    // 测试5：统计
    console.log('\n--- 测试5：统计 ---');
    console.log(svb.getStats());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
