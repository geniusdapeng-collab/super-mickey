/**
 * Beast Voice Signature Engine v1.0
 * 神兽人声/音效签名引擎
 * 
 * 为片头系统生成神兽专属的声音描述，用于Seedance 2.0在生成片头视频时
 * 同步生成音频/音效效果（非TTS，不单独配音）。
 * 
 * 核心原则：
 * - 声音是Seedance 2.0生成视频时同步生成的，不依赖外部TTS
 * - 每个神兽有独特的声音指纹（timbre/音色 + effect/音效）
 * - 触发时机：主标题完全出现后
 * - 统一台词结构："欢迎来到Nirath星球，我是[神兽名]" + 个性化后缀
 */

// ==================== 神兽声音指纹库 ====================
// 基于神兽的生理特征、栖息地、性格生成声音描述

const BEAST_VOICE_PROFILES = {
  // ===== 饕餮 =====
  'taotie': {
    timbre: `低频35Hz震颤，如同深渊巨兽从地核深处发出的共鸣。声音不是声带振动，而是巨口胸腔空腔与Nirath 3.2Tesla磁场共振产生的复合低频波——每个字都带着「饥饿的物理质感」，仿佛空气本身在颤抖`,
    effect: `声波扩散引发磁丝树剧烈震颤，地面产生同心圆震波向远方扩散，孢子群被声浪推散成淡蓝色光环。声音中混有火山岩装甲摩擦的「隆隆」声和岩浆在血管中流动的「咕噜」回响——不是说话，是「地壳级别的宣告」`,
    speed: `缓慢而沉重，每字之间留有0.8秒停顿，仿佛地底巨石相互研磨。最后一个字尾音拖长3秒，低频余波让空气持续震颤`,
    emotion: `远古饥饿的威严——不是威胁，而是「我是这片土地300年」的沉重宣告。声音中带着克制的孤独，像是久未开口的守护者第一次被听见`
  },

  // ===== 烛龙 =====
  'zhulong': {
    timbre: `宏大如山脉移动，每个音节都带着地壳震颤的低频共鸣，不是人声而是「天地之音」`,
    effect: `声音中混有岩浆气泡破裂的「咕噜」声和岩石摩擦的「隆隆」声`,
    speed: `庄严缓慢，一字一顿如同钟磬敲击，尾音拖长融入环境`,
    emotion: `创世者般的悲悯与力量，如同太阳升起时的第一缕光芒`
  },

  // ===== 九尾狐 =====
  'jiu-wei-hu': {
    timbre: `空灵多层，仿佛九道声音轻微错位叠加，主体是魅惑的女性中音，周围环绕着狐狸般的轻鸣`,
    effect: `每句话结束时带有尾音的「幻音扩散」——像风铃在星空中摇曳`,
    speed: `优雅流畅，带有古老歌谣般的韵律感，不急不缓`,
    emotion: `千年的智慧与一丝狡黠，像是看穿一切的老朋友在轻声讲述秘密`
  },

  // ===== 帝江 =====
  'di-jiang': {
    timbre: `温暖如厚毛毯包裹，没有明显声带振动感，更像「光的振动」——高频率的暖意波动`,
    effect: `声音周围有细微的「孢子发光」音效——类似萤火虫振翅的极轻嗡嗡声`,
    speed: `温柔缓慢，带着摇篮曲般的节奏，每个字之间像是深呼吸`,
    emotion: `无条件接纳的温柔，像是被一团温暖的云轻轻抱住`
  },

  // ===== 白泽 =====
  'bai-ze': {
    timbre: `清澈理性，如同冰川融水般纯净的男声，没有情绪波动但充满知识重量`,
    effect: `说话时周围有「知识涟漪」——如同翻开古老羊皮卷时的细微纸张声`,
    speed: `精确而从容，每个词都经过千年验证般的笃定`,
    emotion: `通晓万物的平静，不是冷漠而是「一切都在我预期之中」的掌控感`
  },

  // ===== 旋龟 =====
  'xuan-gui': {
    timbre: `古老沧桑，带着深海水压的厚重感，每个字都像是从海底传来的低沉回响`,
    effect: `声音中混有龟甲轻微碰撞的「咔哒」声和水波荡漾的「哗啦」声`,
    speed: `极慢，仿佛千年老龟转头的速度，每个字之间是永恒的沉默`,
    emotion: `承载万年记忆的沉稳，像是大地本身在说话`
  },

  // ===== 精卫 =====
  'jing-wei': {
    timbre: `清脆倔强，少女般的清亮嗓音中带着不易察觉的沙哑——那是千万次衔石磨出的痕迹`,
    effect: `每句话末尾有极轻的「石子入水」声——像是某种执念的回响`,
    speed: `坚定快速，不容打断的节奏，像是不停飞翔的鸟儿从不停歇`,
    emotion: `永不放弃的倔强，温柔但坚韧到令人心碎`
  },

  // ===== 女娲 =====
  'nüwa': {
    timbre: `母性温暖，如同大地之母的低语，声音中带着泥土芬芳和创造生命的神圣感`,
    effect: `说话时周围有「泥土塑形」的细微声响——如同湿泥在指间被捏合的柔软声音`,
    speed: `慈爱而从容，带着母亲讲述睡前故事般的温柔节奏`,
    emotion: `创造与守护的慈悲，让人想起生命最初的安全感`
  },

  // ===== 凤凰 =====
  'fenghuang': {
    timbre: `华丽高亢，如同金属琴弦被拨动，每个字都带着火焰般的温度和光芒`,
    effect: `声音中混有「羽翼震颤」的「嗖嗖」声和「涅槃之火」的「噼啪」燃烧声`,
    speed: `骄傲而流畅，如同火焰升腾般自然奔放`,
    emotion: `浴火重生的骄傲与自由，像是千年等待后的华丽登场`
  },

  // ===== 应龙 =====
  'ying-long': {
    timbre: `雷霆万钧，每个字都带着风暴前的静电嗡鸣，不是说话而是「宣告天命」`,
    effect: `声音中混有「雷电蓄能」的「滋滋」声和「暴雨倾盆」的「轰鸣」声`,
    speed: `迅猛有力，如同龙爪撕裂云层般的决断速度`,
    emotion: `战神的威严与狂暴，像是暴风雨前的那道闪电`
  }
};

// ==================== 通用声音基线（未收录神兽的兜底） ====================
const DEFAULT_VOICE_PROFILE = {
  timbre: `远古神秘，带着Nirath星球特有的「磁丝共振」质感——声音不是单纯声带振动，而是与星球磁场共鸣产生的复合声波`,
  effect: `说话时周围有极轻微的「环境响应」——如同整个星球的植物、岩石、水流都在倾听`,
  speed: `从容不迫，带着亿万年生命的从容节奏`,
  emotion: `对来访者的善意好奇，像是老朋友在遥远星球迎接你`
};

// ==================== 引擎核心 ====================

class BeastVoiceSignatureEngine {
  /**
   * 生成神兽声音签名描述（用于Prompt注入）
   * @param {string} beastId - 神兽ID（如 'taotie', 'zhulong'）
   * @param {string} beastName - 神兽中文名（如 '饕餮', '烛龙'）
   * @param {Object} options - 可选配置
   * @param {string} options.episodeHook - 本集悬念钩子（剧情定制版优先）
   * @param {string} options.dialect - 方言/口音变体（可选）
   * @param {number} options.emphasis - 强调程度 0-1（默认0.7）
   * @returns {Object} { voicePrompt, voiceMoment, fullDescription }
   */
  generate(beastId, beastName, options = {}) {
    // v6.2-patch42-fix: 键名映射，处理带连字符的ID（如'tao-tie' → 'taotie'）
    const idMap = {
      'tao-tie': 'taotie',
      'zhu-long': 'zhulong',
      'jiu-wei-hu': 'jiu-wei-hu', // 已匹配
      'bai-ze': 'bai-ze',         // 已匹配
      'fenghuang': 'fenghuang',   // 已匹配
      'ying-long': 'ying-long',   // 已匹配
      'di-jiang': 'di-jiang',     // 已匹配
      'qiong-qi': 'qiong-qi',     // 已匹配
      'hun-dun': 'hun-dun',       // 已匹配
      'tao-wu': 'tao-wu'          // 已匹配
    };
    const mappedId = idMap[beastId] || beastId;
    
    const profile = BEAST_VOICE_PROFILES[mappedId] || DEFAULT_VOICE_PROFILE;
    const emphasis = options.emphasis || 0.7;

    // 1. 构建核心台词
    const baseLine = `欢迎来到Nirath星球，我是${beastName}`;
    
    // 【v1.1双模式】剧情定制钩子 > 固定后缀
    const hook = options.episodeHook || this.generateSuffix(beastId, beastName);
    const fullLine = `${baseLine}。${hook}`;

    // 2. 构建声音描述Prompt片段
    const voicePrompt = `
【神兽人声签名 — ${beastName}】
声音出现时机：片头第一帧即出现，作为整个片头的「声音钩子」——观众先听到神兽说话，再看到画面展开
声音定位：从画面深处传来，带有Nirath星球特有的空间混响，仿佛穿越光年抵达
声音内容（中文）：「${fullLine}」
音色特征：${profile.timbre}
音效叠加：${profile.effect}
语速节奏：${profile.speed}
情感基调：${profile.emotion}
声音可视化：说话时光波/粒子从虚空向中心汇聚，随后画面渐显，神兽从光芒中浮现
⚠️ 此声音必须在片头第一帧同步出现，作为开场钩子，不可延迟或静音
`;

    // 3. 构建「声音时刻」描述（更简洁版本，用于字数紧张时）
    const voiceMoment = `开场第一声，${beastName}的声音从虚空中传来：「${fullLine}」——声音${profile.timbre.substring(0, 30)}...，说完后光芒汇聚，神兽浮现`;

    // 4. 构建完整描述（用于单独调试/展示）
    const fullDescription = {
      beastId,
      beastName,
      baseLine,
      hook,
      hookSource: options.episodeHook ? '剧情定制' : '固定后缀',
      fullLine,
      timbre: profile.timbre,
      effect: profile.effect,
      speed: profile.speed,
      emotion: profile.emotion,
      triggerTiming: '片头第一帧即出现，作为声音钩子',
      spatialPosition: '从画面深处传来，穿越光年的空间混响',
      audioRequirement: 'Seedance 2.0同步生成，非后期配音'
    };

    return {
      voicePrompt: voicePrompt.trim(),
      voiceMoment: voiceMoment.trim(),
      fullDescription,
      estimatedPromptLength: voicePrompt.length
    };
  }

  /**
   * 生成个性化后缀（根据神兽特点定制）
   * @param {string} beastId - 神兽ID
   * @param {string} beastName - 神兽中文名
   * @returns {string} 个性化后缀台词
   */
  generateSuffix(beastId, beastName) {
    const suffixes = {
      'taotie': `这里的一切，都值得被记住——尤其是饥饿的味道。`,
      'zhulong': `光明与黑暗的交替，由我的眼睛守护。准备好见证永恒了吗？`,
      'jiu-wei-hu': `迷局已经布下，你……是棋子，还是棋手？`,
      'di-jiang': `不用担心，我会抱住你。在这片灵原上，没有什么能伤害你。`,
      'bai-ze': `我知道你的问题，也知道所有答案。但最有趣的答案，需要你自己发现。`,
      'xuan-gui': `时间在这里没有意义。我已经等了五万年，不差这几分钟。慢慢走。`,
      'jing-wei': `这片海曾经很大，但我会填平它。你要一起来吗？`,
      'nüwa': `每一个生命都是我捏出来的宝贝，包括你。欢迎来到我的花园。`,
      'fenghuang': `灰烬不是终点，是起点。看好了——我要烧给你看什么叫重生。`,
      'ying-long': `风暴是我的呼吸，雷电是我的心跳。站稳了，别被吹走。`
    };

    return suffixes[beastId] || `准备好开始这段旅程了吗？`;
  }

  /**
   * 获取所有已收录神兽列表
   */
  getSupportedBeasts() {
    return Object.keys(BEAST_VOICE_PROFILES);
  }

  /**
   * 检查是否支持某神兽
   */
  isSupported(beastId) {
    return !!BEAST_VOICE_PROFILES[beastId];
  }

  /**
   * 为未收录神兽快速注册声音指纹（运行时扩展）
   */
  registerBeastVoice(beastId, profile) {
    BEAST_VOICE_PROFILES[beastId] = {
      ...DEFAULT_VOICE_PROFILE,
      ...profile
    };
  }
}

module.exports = { BeastVoiceSignatureEngine, BEAST_VOICE_PROFILES };
