/**
 * 通用片头系统 v3.0-patch3-v2.2-fix - Nirath单镜头叙事片头引擎
 *
 * v6.0-patch39升级(系统级,所有集数受益):
 * 1. 神兽出场Agent:独立设计每只异兽的震撼出场,通用化(非硬编码)
 * 2. 小G活泼动作系统:从"嘴动"升级为"全身自然动作",8岁男孩真实感
 * 3. 标题字体Agent化:去硬编码20-25%,Title Agent动态计算字体规格
 * 4. Title想象力保留:空间充裕时自动展开完整创意描述
 *
 * v6.0-patch38升级(系统级修复,所有集数受益):
 * 1. 全局负面提示词注入:新增GlobalNegativePromptInjector,禁止红眼/蓝眼/荧光眼/水晶/重复角色
 * 2. Title Presentation Agent输出修复:使用完整description(含情绪节奏+镜头语言+物理法则交互+惊喜元素),替代之前被截断的shortDescription
 * 3. 出品人字体放大:8-10% → 20-25%高度,视觉权重=标题80%
 * 4. 异兽出场震撼感增强:添加地裂/磁场爆发/孢子风暴等震撼元素
 * 5. 角色数量约束:明确约束"仅一个小G和一个饕餮",防止AI生成重复角色
 * 6. 口播动作注入:强制小G嘴部微张说话,自然动作,不是旁白
 *
 * v2.2-fix 升级(v6.0-patch37发布):
 * 1. 神兽人声签名注入:开场第一帧同步出现神兽声音作为钩子
 * 2. 字数感知保留:Prompt超限裁剪时保留神兽人声签名(最高优先级)
 * 3. 双模式台词:剧情定制钩子 > 固定后缀,自动从episodeSummary提取
 *
 * v3.0-patch3 升级(系统级,所有集数受益):
 * 1. 角色视觉约束强化:自动读取character-card.json的appearance严格约束
 * 2. 标题融合引擎:标题与异兽能力深度融合,变幻莫测有悬念
 * 3. 运镜紧凑化:关键词法替代完整句子,保留更多运镜段数
 * 4. 音效视觉暗示:画面震颤/共鸣波纹暗示震撼音效
 * 5. 全局禁用词清理(patch2已存在)
 *
 * 系统级设计哲学:
 * 1. 单镜头完整叙事(8-9秒,可配置3-15秒)
 * 2. 三幕结构:钩子(0-25%) → 展开(25-75%) → 定格(75-100%)
 * 3. 角色强制绑定:protagonist + featuredBeast 必须出场
 * 4. 运镜丰富化:集成Astralis Camera Engine,每镜3-5段运镜组合
 * 5. 剧情关联:输入episodeSummary自动生成故事呼应
 * 6. Nirath环境自动注入:从nirath-bible自动获取
 * 7. 风格锁死:明亮奇幻,禁止暗黑/地球模板
 * 8. 角色视觉约束:自动注入appearance严格一致性约束
 * 9. 标题融合:与异兽能力/环境深度互动
 *
 * @module opening-system-v3
 * @version 3.0-patch3-v2.2-fix (v6.0-patch37)
 */

const fs = require('fs');
const path = require('path');

// ===== 系统集成 =====
const {
  NIRATH_PLANET_CORE,
  ASTRALIS_LIGHTING_MODEL,
  getStarDescription,
  getMagnetosphereDescription,
  getEcosystemDescription,
  getBrightnessMandate,
  sanitizePrompt
} = require('./nirath-bible');

const CameraEngine = require('./astralis-camera-engine');
const { generateTitlePresentation } = require('./title-presentation-agent');

// ===== v2.2新增:神兽人声签名引擎 =====
const { BeastVoiceSignatureEngine } = require('./beast-voice-signature-engine');
// 【v6.2-patch54】神兽开场白Agent — 一句话震撼人心
const { BeastOpeningLineAgent } = require('./beast-opening-line-agent');

// ===== v6.0-patch38新增:全局负面提示词注入器 =====
const { globalNegativePromptInjector } = require('./global-negative-prompts');

// ===== v6.0-patch39新增:神兽出场Agent + 小G活泼动作系统 =====
const { beastEntranceAgent } = require('./beast-entrance-agent');
const { xiaoGLivelyActionSystem } = require('./xiaog-lively-action-system');

// ===== 精简Nirath环境锚定词(用于Prompt空间受限场景) =====
// v6.2-patch42-fix: 新增地质质感锚定词，解决"山像塑料"问题
const NIRATH_ANCHOR_TERMS = {
  stars: '双恒星系统Aurelius金色5800K主星与Silvana银白6500K伴星72小时互绕',
  magneto: '3.2Tesla磁场30Hz共鸣淡蓝紫可见磁场线双螺旋极光环',
  ecosystem: '0.82G低重力1200/cm3以太孢子缓慢飘浮大气折射率1.00045',
  lighting: 'Aurelius金色主星60%光照权重Silvana银白伴星清冷高光阴影淡蓝紫磁场光晕填充',
  // v6.2-patch42-fix: 地质质感锚定词（系统级，所有Nirath场景受益）
  // v6.2-patch45-fix: 增加生机勃勃生态描述，禁止光秃秃/荒芜/火星地貌
  geology: '超写实地质纹理，风化侵蚀痕迹，岩石表面微起伏自然不规则，层理构造清晰，矿物结晶点缀，摄影级岩石细节',
  // v6.2-patch45-fix: Nirath是生机勃勃的星球，必须有丰富奇特生物和有机植物生态
  biology: 'Nirath生机勃勃生态，岩石间长满发光蕨类与磁丝藤蔓，奇异生物群落活跃，孢子群漂浮如萤火，有机生命覆盖地表，禁止光秃秃/荒芜/戈壁/火星表面/寸草不生'
};

// v6.0-patch38-fix: 添加超精简版(Prompt空间紧张时使用)
// v6.2-patch42-fix: 精简版也保留地质质感核心词
const NIRATH_ANCHOR_TERMS_MINIMAL = {
  stars: '双恒星Aurelius5800K金色+Silvana6500K银白',
  magneto: '3.2Tesla磁场淡蓝紫可见',
  ecosystem: '0.82G低重力以太孢子飘浮',
  lighting: 'Aurelius5800K暖金60%+Silvana6500K清冷高光',
  // v6.2-patch42-fix: 精简版保留最关键的地质质感词
  // v6.2-patch45-fix: 精简版保留生机生态核心词
  geology: '超写实岩石纹理，风化痕迹，摄影级地质细节',
  biology: '发光生物群落，有机生命覆盖，禁止荒芜光秃'
};

function getNirathAnchor(minimal = false) {
  const terms = minimal ? NIRATH_ANCHOR_TERMS_MINIMAL : NIRATH_ANCHOR_TERMS;
  // v6.2-patch42-fix: 注入地质质感锚定词，解决"山像塑料"问题
  // v6.2-patch45-fix: 注入生机勃勃生态锚定词，禁止光秃秃/荒芜/火星地貌
  return `${terms.stars}。${terms.magneto}。${terms.ecosystem}。${terms.geology}。${terms.biology || 'Nirath生机勃勃生态，有机生命覆盖地表'}。`;
}

function getNirathLighting(minimal = false) {
  const terms = minimal ? NIRATH_ANCHOR_TERMS_MINIMAL : NIRATH_ANCHOR_TERMS;
  return terms.lighting;
}

// ===== 系统常量(v3.0-patch4新增)=====
// 山海经系列语言配置:标题和出品人使用英文
const SYSTEM_LANGUAGE_CONFIG = {
  titleLanguage: 'en',           // 主标题语言
  producerLanguage: 'en',        // 出品人语言
  subtitleLanguage: 'zh',        // 字幕语言
  titleFontStyle: 'elegant serif with subtle geometric flourishes, letters have soft 3D depth with golden rim light', // 标题字体风格
  producerFontStyle: 'thin elegant serif, Aurelius golden 5800K with Silvana silver-white 6500K edge highlights' // 出品人字体风格
};

// 标题翻译引擎(山海经系列英文标题映射)
const TITLE_TRANSLATIONS = {
  '九尾狐·迷局': 'The Enigma of the Nine-Tailed Fox',
  '烛龙·永夜': 'Candle Dragon: The Eternal Night',
  '白泽·天启': 'Bai Ze: The Celestial Revelation',
  '凤凰·涅槃': 'Phoenix: The Nirvana Rebirth',
  '应龙·苍穹': 'Ying Long: The Vault of Heaven',
  '帝江·混沌': 'Di Jiang: The Primordial Chaos',
  '饕餮·hunger and armor': 'SHAN HAI JING: Taotie · Hunger and Armor',
  '饕餮·欲望': 'Tao Tie: The Abyss of Desire',
  '饕餮·永恒饥饿': 'SHAN HAI JING: Taotie · The Eternal Hunger',
  '穷奇·风暴': 'Qiong Qi: The Tempest Fury',
  '混沌·无序': 'Hun Dun: The Orderless Void',
  '梼杌·顽石': 'Tao Wu: The Unyielding Stone'
};

// 出品人英文文案
const PRODUCER_ENGLISH = 'A Nirath Original Story by Genius';

// ===== 标题翻译函数 =====
function translateTitleToEnglish(chineseTitle) {
  // 先去除可能的"山海经:"前缀(支持中英文冒号及空格)
  let cleanTitle = chineseTitle.replace(/^山海经[::：]\s*/, '');
  
  // 去除EPxx后缀
  cleanTitle = cleanTitle.replace(/\s*EP\d+\s*$/i, '');

  // 先查映射表(用清洗后的标题)
  if (TITLE_TRANSLATIONS[cleanTitle]) {
    return TITLE_TRANSLATIONS[cleanTitle];
  }

  // 再尝试完整标题匹配
  if (TITLE_TRANSLATIONS[chineseTitle]) {
    return TITLE_TRANSLATIONS[chineseTitle];
  }
  
  // 尝试部分匹配（取主标题部分）
  const mainTitlePart = cleanTitle.split(/[·\s]/)[0];
  if (TITLE_TRANSLATIONS[mainTitlePart]) {
    return TITLE_TRANSLATIONS[mainTitlePart];
  }

  // v6.2-patch102-fix: 增加模糊匹配（去除空格后）
  const compactTitle = cleanTitle.replace(/\s+/g, '');
  for (const [key, value] of Object.entries(TITLE_TRANSLATIONS)) {
    const compactKey = key.replace(/\s+/g, '');
    if (compactKey === compactTitle) {
      return value;
    }
  }

  // 如果所有映射都失败，返回原始英文前缀+标题
  if (cleanTitle.includes('·')) {
    const parts = cleanTitle.split('·');
    return 'SHAN HAI JING: ' + parts.map(p => p.trim()).join(' · ');
  }

  // 如果没有映射,返回清洗后的标题并警告(提醒:需要补充映射)
  console.warn(`⚠️ 标题未找到英文映射: "${chineseTitle}"(清洗后: "${cleanTitle}"),请补充 TITLE_TRANSLATIONS`);
  return cleanTitle;
}

// ===== 皮克斯风格标题设计 =====
// 为标题添加生命力,像皮克斯台灯一样有互动性
function generatePixarStyleTitleTreatment(englishTitle) {
  return {
    // 字体设计:优雅衬线 + 几何装饰 + 3D深度
    fontStyle: 'elegant serif with geometric flourishes, letters have soft 3D depth with golden rim light',

    // 标题出现时的动态效果
    animation: 'letters assemble from floating magnetic particles, each letter has faint internal glow matching Aurelius 5800K warmth',

    // Nirath"吉祥物"概念(以太孢子台灯)
    mascot: {
      concept: 'ether_spore_lamp',  // 以太孢子"台灯"
      description: 'a curious glowing ether spore bounces playfully around the title letters, briefly illuminates each letter with Aurelius golden 5800K light as it passes by',
      personality: 'curious, playful, alive - like Luxo Jr. but made of floating magnetic particles',
      interaction: 'the spore nudges the dot of "i" playfully, then bounces away leaving a trail of golden light'
    },

    // 字母级别的细节
    letterDetails: 'each letter has subtle surface texture of frozen magnetic fluid, edges catch Silvana 6500K silver-white light, creating soft prismatic refractions',

    // 整体氛围
    atmosphere: 'title floats in space with slight parallax depth, letters have independent micro-movements suggesting liveliness'
  };
}

// ===== 出品人英文生成 =====
// v3.0-patch5:用【】括号圈出出品人,让AI识别为重点渲染内容
// v6.0-patch38:字体高度从8-10%增大到20-25%,视觉权重显著提升
// ===== 出品人英文生成 =====
// v6.0-patch39: 去硬编码,从Title Agent获取字体规格
function generateProducerEnglish(fontSpec) {
  if (fontSpec && fontSpec.fullSpec) {
    return `A Nirath Original by Genius,${fontSpec.fullSpec}`;
  }
  // v6.2-patch54: 出品人字体跟随标题放大，保持标题的70%视觉权重
  return 'A Nirath Original by Genius,金色5800K暖光,银白边缘,40-45%高度,粗体,视觉权重=标题70%';
}

// ===== 角色档案读取器(通用) =====
function loadCharacterCard(characterId) {
  const paths = [
    path.join(__dirname, '..', 'characters', characterId, 'character-card.json'),
    path.join(__dirname, '..', 'characters', 'beasts', characterId, 'character-card.json'),
    path.join(__dirname, '..', 'systems', 'beast-database', 'beasts', `${characterId}.json`)
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  }
  return null;
}

function loadPortraitPath(characterId, angle = 'front') {
  const dirs = [
    path.join(__dirname, '..', 'characters', characterId, 'portraits'),
    path.join(__dirname, '..', 'characters', 'beasts', characterId, 'portraits')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    const match = files.find(f => f.includes(angle) && (f.endsWith('.png') || f.endsWith('.jpeg') || f.endsWith('.jpg')));
    if (match) return path.join(dir, match);
  }
  return null;
}

// ===== 角色视觉约束引擎(v3.0-patch3新增)=====
// 自动读取character-card.json的appearance严格约束,注入Prompt
// v3.0-patch4升级:强化眼睛约束,解决红色眼圈反复出现的问题
function loadCharacterVisualConstraints(characterId) {
  const card = loadCharacterCard(characterId);
  if (!card) return null;

  const appearance = card.visualIdentity?.appearance;
  if (!appearance) return null;

  const constraints = [];

  // 眼睛严格约束(v3.0-patch5最终版)
  // 策略:纯正面描述,用详细描写占据Prompt空间,不给红色留下语义空间
  // 绝对禁止出现"严禁/禁止/绝不/不得"等负面词汇(会导致反向触发)
  if (appearance.eyes?.consistency === 'strict') {
    const eyePrompt = appearance.eyes.promptFragment || '内双黑色瞳孔清澈有神';
    // 纯正面描述,无负面词汇
    const eyeDetail = `眼睛:${eyePrompt},东亚人自然眼型,眼尾微微下垂,眼神坚定温暖,深棕黑色系瞳孔,自然深褐色反光`;
    constraints.push(eyeDetail);
  }

  // 头发严格约束
  if (appearance.hair?.consistency === 'strict') {
    constraints.push(`头发${appearance.hair.promptFragment || ''}`);
  }

  // 皮肤严格约束
  if (appearance.skin?.consistency === 'strict') {
    constraints.push(`皮肤${appearance.skin.promptFragment || ''}`);
  }

  // 服装严格约束
  if (appearance.clothing?.consistency === 'strict') {
    constraints.push(`穿着${appearance.clothing.promptFragment || ''}`);
  }

  return {
    name: card.name || characterId,
    constraints,
    fullAppearance: appearance
  };
}

function generateCharacterVisualPrompt(characterId, pose = '站立') {
  const visual = loadCharacterVisualConstraints(characterId);
  if (!visual) return `${characterId}(角色档案缺失,使用默认描述)`;

  // v6.0-patch38-fix: 移除眼睛约束(已由全局负面约束覆盖),节省Prompt空间
  return `${visual.name},${pose}`;
}

// ===== 角色描述生成器 =====
function generateCharacterDescription(characterId, role = 'protagonist') {
  const card = loadCharacterCard(characterId);
  if (!card) {
    console.warn(`⚠️ 角色档案未找到: ${characterId}`);
    return null;
  }

  let desc = '';

  if (card.visualIdentity) {
    const v = card.visualIdentity;
    if (v.appearance) {
      const parts = [];
      if (v.appearance.hair) parts.push(v.appearance.hair.promptFragment);
      if (v.appearance.eyes) parts.push(v.appearance.eyes.promptFragment);
      if (v.appearance.skin) parts.push(v.appearance.skin.promptFragment);
      if (v.appearance.clothing) parts.push(v.appearance.clothing.promptFragment);
      if (v.appearance.body) parts.push(v.appearance.body.promptFragment);
      desc = parts.filter(Boolean).join(',');
    } else if (v.coreDescription) {
      desc = v.coreDescription.substring(0, 200);
    }
  } else if (card.visualIdentity?.coreDescription) {
    desc = card.visualIdentity.coreDescription.substring(0, 200);
  }

  let narrativeRole = '';
  if (role === 'protagonist') {
    narrativeRole = '主角,故事的观察者与改变者';
  } else if (role === 'featuredBeast') {
    narrativeRole = '本集异兽主角,与小G产生关键互动';
  }

  return {
    id: characterId,
    name: card.name?.chinese || card.name || characterId,
    description: desc,
    narrativeRole,
    portraitPath: loadPortraitPath(characterId),
    card,
    visualPrompt: desc.substring(0, 150)
  };
}

// ===== 三幕叙事引擎 =====
function generateThreeActOpening(config) {
  const {
    episodeTitle,
    episodeTheme,
    episodeSummary,
    protagonistId = 'xiaoG',
    featuredBeastId,
    duration = 9,
    mood = 'mysterious'
  } = config;

  // 角色数据组装(包含所有角度的portraits)
  const protagonist = generateCharacterDescription(protagonistId, 'protagonist');
  const beast = generateCharacterDescription(featuredBeastId, 'featuredBeast');

  // v2.2-fix: 从config.portraits读取所有角度的定妆照数据
  const portraits = {};
  if (config.portraits) {
    if (config.portraits[protagonistId]) {
      portraits.protagonist = config.portraits[protagonistId];
    }
    if (config.portraits[featuredBeastId]) {
      portraits.beast = config.portraits[featuredBeastId];
    }
  }

  // 如果config.portraits未提供,回退到loadPortraitPath单角度
  if (!portraits.protagonist && protagonist?.portraitPath) {
    portraits.protagonist = { front: protagonist.portraitPath };
  }
  if (!portraits.beast && beast?.portraitPath) {
    portraits.beast = { front: beast.portraitPath };
  }

  const act1End = duration * 0.25;
  const act2End = duration * 0.75;
  const act3End = duration;

  const act1 = generateAct1_Hook({
    duration: act1End,
    protagonist,
    episodeTheme,
    mood
  });

  const act2 = generateAct2_Development({
    startTime: act1End,
    duration: act2End - act1End,
    protagonist,
    beast,
    episodeSummary,
    mood
  });

  const act3 = generateAct3_Climax({
    startTime: act2End,
    duration: act3End - act2End,
    episodeTitle,
    protagonist,
    beast,
    episodeSummary,
    mood
  });

  const fullPrompt = combineActs(act1, act2, act3, config);

  return {
    duration,
    acts: { act1, act2, act3 },
    prompt: fullPrompt.prompt,
    promptLength: fullPrompt.length,
    characters: { protagonist, beast },
    portraits,  // v2.2-fix: 返回所有角度的portraits数据
    portraitPaths: [
      protagonist?.portraitPath,
      beast?.portraitPath
    ].filter(Boolean),
    cameraPlan: fullPrompt.cameraPlan,
    complianceCheck: fullPrompt.complianceCheck,
    truncationApplied: fullPrompt.truncationApplied
  };
}

// ===== 第一幕生成:钩子 =====
function generateAct1_Hook({ duration, protagonist, episodeTheme, mood }) {
  const nirathEnv = getNirathAnchor(true); // v6.0-patch38-fix: 使用精简版Nirath环境描述
  const nirathLight = getNirathLighting(true); // v6.0-patch38-fix: 使用精简版光照描述

  const entranceStyles = {
    // v6.0-patch39: 注入待机感公式--人物 + 正在做的小事 + 下意识反应 + 情绪落点
    mysterious: generateCharacterVisualPrompt(protagonist?.id || 'xiaoG', 
      '从磁丝树后探出半张脸,手指勾着树干纹理。孢子碎光落鼻尖,下意识皱鼻眨眼,瞳孔倒映双恒星金色5800K光芒。停在半藏半露姿态,呼吸比平时快了半拍'),
    epic: generateCharacterVisualPrompt(protagonist?.id || 'xiaoG',
      '蹲在悬崖边岩石上,一只手无意识拨弄脚边碎石。碎石从指间滑落,手指本能地一缩停在半空。缓缓抬头望向远方栖息地,下巴微微抬起'),
    tender: generateCharacterVisualPrompt(protagonist?.id || 'xiaoG',
      '蹲在量子苔藓丛中,手指轻触发光苔藓,嘴角不自觉上扬,眼神飘向远处又收回。侧脸被Silvana银白光芒勾勒'),
    tense: generateCharacterVisualPrompt(protagonist?.id || 'xiaoG',
      '快步穿越孢子雾,手按腰间指南针,脚步突然停住--指南针指针剧烈抖动。低头看了一眼,手指摩挲指南针边缘,眼神从锐利变成困惑')
  };

  const entrance = entranceStyles[mood] || entranceStyles.mysterious;

  const cameraPlan = [
    { time: `0-${(duration * 0.4).toFixed(1)}s`, movement: 'extreme_wide建立Nirath全景' },
    { time: `${(duration * 0.4).toFixed(1)}-${duration.toFixed(1)}s`, movement: 'dolly_in推向主角, reveal' }
  ];

  return {
    phase: '钩子',
    timeRange: `0-${duration.toFixed(1)}s`,
    // v6.0-patch38-fix: 只保留最核心的Nirath环境描述
    content: `【0-${duration.toFixed(1)}s 钩子】双恒星Aurelius5800K金色+Silvana6500K银白,3.2Tesla磁场淡蓝紫可见。磁丝矗立。${entrance}。`,
    cameraPlan,
    mood
  };
}

// ===== 异兽栖息地查询器(v3.0-patch6新增)=====
// 根据异兽ID动态查询栖息地,替代硬编码青丘群岛
function getBeastHabitat(beastId) {
  // 尝试从异兽数据库读取
  const dbPaths = [
    path.join(__dirname, '..', 'systems', 'beast-database', 'beasts', `${beastId}.json`),
    path.join(__dirname, '..', 'characters', 'beasts', beastId, 'character-card.json'),
    path.join(__dirname, '..', 'characters', beastId, 'character-card.json')
  ];

  for (const p of dbPaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        // 优先返回nirathHabitat,其次habitat,最后default
        const habitat = data.nirathHabitat || data.habitat || data.visualIdentity?.nirathHabitat;
        if (habitat) return habitat;
      } catch (e) {
        // 继续尝试下一个路径
      }
    }
  }

  // 回退到硬编码映射表(常用异兽)
  const HABITAT_MAP = {
    'jiu-wei-hu': '青丘群岛磁场核心',
    'tao-tie': '钩吾山荒原',
    'zhu-long': '钟山永夜裂谷',
    'bai-ze': '昆仑知识高原',
    'ying-long': '苍穹云海',
    'fenghuang': '涅槃熔炉',
    'di-jiang': '混沌初原',
    'qiong-qi': '风暴眼',
    'hun-dun': '无序边境',
    'tao-wu': '顽石荒原'
  };

  return HABITAT_MAP[beastId] || null;
}

// ===== 第二幕生成:展开 =====
// v3.0-patch6修复:移除硬编码九尾狐特征,改为动态适配任意异兽
// v6.0-patch38升级:增强异兽出场震撼感(地裂/磁场爆发/孢子风暴)
function generateAct2_Development({ startTime, duration, protagonist, beast, episodeSummary, mood }) {
  // 动态获取场景元素:根据异兽ID推断栖息地,而非硬编码青丘群岛
  let sceneElement = beast?.id
    ? getBeastHabitat(beast.id) || 'Nirath磁场核心'
    : 'Nirath磁场核心';
  let interactionType = '初遇';

  if (episodeSummary) {
    if (episodeSummary.includes('幻术')) {
      sceneElement = '幻术迷雾' + sceneElement;
      interactionType = '幻术试炼';
    } else if (episodeSummary.includes('契约')) {
      sceneElement = sceneElement + '祭坛';
      interactionType = '契约签订';
    } else if (episodeSummary.includes('战斗') || episodeSummary.includes('冲突')) {
      sceneElement = '磁暴' + sceneElement;
      interactionType = '力量对抗';
    }
  }

  // 动态生成异兽描述:从角色档案提取,而非硬编码九尾狐特征
  const beastDesc = beast?.description?.substring(0, 40) || '';
  const beastName = beast?.name || '异兽';
  const protagonistName = protagonist?.name || '小G';

  // v6.0-patch39: 使用神兽出场Agent(通用化,非硬编码)
  const entrancePlan = beastEntranceAgent.generatePromptString({
    beastId: beast?.id,
    habitat: sceneElement,
    mood,
    episodeTheme: episodeSummary,
    episodeSummary,
    entranceDuration: duration
  });
  const beastEntrance = entrancePlan.narrative;

  // v6.0-patch39: 使用小G活泼动作系统(全身动作,非仅嘴动)
  const xiaoGAction = xiaoGLivelyActionSystem.generate({
    phase: 'development',
    mood,
    interactionLevel: interactionType === '初遇' ? 'probe' : 'approach',
    hasDialogue: false,
    isMoving: true
  });
  const protagonistAction = xiaoGAction.shortDescription || xiaoGAction.mainAction || '屏息观察';

  const endTime = (startTime + duration).toFixed(1);

// v6.0-patch39: 多人场景互动设计原则(来源:AI人物显假实战指南)
  // 原则1:视线链(Gaze Chain)--确保存在清晰的视线连接
  // 原则2:动作-反应配对(Action-Response)--A行动,B有下意识反应
  // 原则3:空间关系叙事(Spatial Storytelling)--距离和朝向本身讲故事

  const content = `【${startTime.toFixed(1)}-${endTime}s 展开】${beastEntrance}。${protagonistName}${protagonistAction}`;

  // v6.0-patch39: 使用神兽出场Agent的运镜建议
  const cameraPlan = entrancePlan.camera
    ? entrancePlan.camera.split('→').map((mv, i) => ({
        time: `${(startTime + duration * i / 4).toFixed(1)}-${(startTime + duration * (i + 1) / 4).toFixed(1)}s`,
        movement: mv
      }))
    : [
        { time: `${startTime.toFixed(1)}-${(startTime + duration * 0.3).toFixed(1)}s`, movement: 'extreme_wide地面震颤全景,extreme_wide地裂瞬间' },
        { time: `${(startTime + duration * 0.3).toFixed(1)}-${(startTime + duration * 0.5).toFixed(1)}s`, movement: 'magnetic_burst磁场光丝喷涌特写' },
        { time: `${(startTime + duration * 0.5).toFixed(1)}-${(startTime + duration * 0.7).toFixed(1)}s`, movement: 'orbit环绕异兽,展示全貌与体型对比' },
        { time: `${(startTime + duration * 0.7).toFixed(1)}-${endTime}s`, movement: 'dual_star_sweep双恒星扫光,孢子风暴旋转收尾' }
      ];

  return {
    phase: '展开',
    timeRange: `${startTime.toFixed(1)}-${endTime}s`,
    content: `【${startTime.toFixed(1)}-${endTime}s 展开】${beastEntrance}。`,
    cameraPlan,
    interactionType
  };
}

// ===== 标题设计Agent集成(v3.0-patch4新增,v6.0-patch38修复:使用完整输出)=====
// 调用独立的Title Presentation Agent,将标题展现从"文字出现"升级为"叙事事件"
// v6.0-patch38修复:之前只用了shortDescription(一句话),现在使用完整presentation.description
function generateTitleFusion(episodeTitle, beast, episodeSummary, mood = 'mysterious', maxLength = 25) {
  if (!episodeTitle) return '由磁流体凝聚成形';

  try {
    // 调用标题设计Agent
    const titlePlan = generateTitlePresentation({
      episodeTitle,
      featuredBeastId: beast?.id,
      episodeSummary,
      mood,
      titlePhaseDuration: 1.2
    });

    // v6.0-patch39: 空间感知--充裕时用完整创意,紧张时用极简版
    const hasSpace = maxLength > 60;

    if (hasSpace && titlePlan?.description) {
      // 空间充裕:返回完整创意描述(保留想象力)
      let fullPrompt = titlePlan.description;
      if (fullPrompt.length > maxLength) {
        fullPrompt = fullPrompt.substring(0, maxLength);
      }
      return fullPrompt;
    }

    // 空间紧张:极简版(不超过25字符)
    const coreConcept = titlePlan?.shortDescription || titlePlan?.description || '由磁流体凝聚成形';
    let titlePrompt = coreConcept;
    if (titlePrompt.includes('主标题"') || titlePrompt.includes('主标题\'')) {
      titlePrompt = titlePrompt.replace(/主标题["'][^"']+["']/, '');
    }
    titlePrompt = titlePrompt.substring(0, maxLength).trim();

    return titlePrompt;
  } catch (e) {
    console.warn('标题设计Agent调用失败,回退到默认:', e.message);
    return '由磁流体凝聚成形';
  }
}

// ===== 获取标题展现完整方案(用于审阅文档)=====
function getTitlePresentationPlan(episodeTitle, beast, episodeSummary, mood = 'mysterious') {
  try {
    return generateTitlePresentation({
      episodeTitle,
      featuredBeastId: beast?.id,
      episodeSummary,
      mood,
      titlePhaseDuration: 1.2
    });
  } catch (e) {
    return null;
  }
}

// ===== 第三幕生成:定格 =====
// v3.0-patch6修复:移除硬编码九尾狐特征(九尾/尾尖荧光),改为动态适配任意异兽
function generateAct3_Climax({ startTime, duration, episodeTitle, protagonist, beast, episodeSummary, mood }) {
  const endTime = (startTime + duration).toFixed(1);

  // 标题处理:转为英文 + 皮克斯风格设计
  const titleEnglish = translateTitleToEnglish(episodeTitle);
  
  // v6.2-patchXX: 拆分主标题和副标题（如果包含 · 分隔符）
  let mainTitleEnglish = titleEnglish;
  let subTitleEnglish = '';
  // 同时支持中文点和英文点两种分隔符
  if (titleEnglish.includes(' · ') || titleEnglish.includes('·')) {
    const parts = titleEnglish.split(/ · |·/);
    mainTitleEnglish = parts[0].trim();
    subTitleEnglish = parts[1]?.trim() || '';
  }
  
  // v6.2-patch78-fix: 清理"山海经："前缀和"EPxx"后缀，确保英文标题纯净
  const cleanMainTitle = mainTitleEnglish
    .replace(/^山海经[::：]\s*/i, '')
    .replace(/\s*EP\d+\s*$/i, '')
    .trim();
  const cleanSubTitle = subTitleEnglish
    .replace(/\s*EP\d+\s*$/i, '')
    .trim();
  
  // 如果清理后主标题仍包含中文（回退翻译未命中），使用原始英文前缀+中文标题
  // 但优先使用映射表中的纯英文翻译
  const finalMainTitle = /^[\x00-\x7F]+$/.test(cleanMainTitle) 
    ? cleanMainTitle 
    : (TITLE_TRANSLATIONS[episodeTitle.replace(/^山海经[::：]\s*/, '').replace(/\s*EP\d+\s*$/i, '')] || cleanMainTitle);
  const finalSubTitle = /^[\x00-\x7F]+$/.test(cleanSubTitle) 
    ? cleanSubTitle 
    : (TITLE_TRANSLATIONS[cleanSubTitle] || '');
  
  const titleFormation = generateTitleFusion(episodeTitle, beast, episodeSummary, mood);

  // 皮克斯风格标题处理
  const pixarStyle = generatePixarStyleTitleTreatment(finalMainTitle + (finalSubTitle ? ' · ' + finalSubTitle : ''));

  // v6.0-patch39: 从Title Agent获取完整方案(含字体规格)
  const titlePlan = getTitlePresentationPlan(episodeTitle, beast, episodeSummary, mood);

  // 英文出品人(动态字体规格)
  const producerEnglish = generateProducerEnglish(titlePlan?.fontSpec);
  // v6.2-patch108-fix: 提取出品人纯文本，注入画面Prompt（不再仅存于postProduction）
  const producerText = producerEnglish?.split(',')[0] || 'A Nirath Original by Genius';

  // v6.0-patch39: 注入待机感--定格不是"摆姿势",而是"正在经历的瞬间"
  // 公式:人物 + 正在做的小事 + 下意识反应 + 情绪落点
  const beastName = beast?.name || '异兽';
  const protagonistName = protagonist?.name || '小G';
  const beastPose = beast?.visualPrompt || `${beastName}姿态威严`;
  const finalPose = `${protagonistName}与${beastName}同框,${protagonistName}侧脸仰望,${beastPose}`;

  // 待机感增强:定格时刻的小G"正在做的小事"(精简版,不占Prompt空间时省略)
  const idleAction = `${protagonistName}手抓背包带,手指绞了三圈又松开。一只孢子落在他肩头,他眼角余光捕捉到,头微微侧了一下。`;

  const cameraPlan = [
    { time: `${startTime.toFixed(1)}-${(startTime + duration * 0.4).toFixed(1)}s`, movement: 'dolly_out缓慢拉出,展示同框全景' },
    { time: `${(startTime + duration * 0.4).toFixed(1)}-${(startTime + duration * 0.7).toFixed(1)}s`, movement: 'title_zoom标题特写,文字变幻细节' },
    { time: `${(startTime + duration * 0.7).toFixed(1)}-${endTime}s`, movement: 'dual_star_sweep双恒星扫光,标题最终定格' }
  ];

  // 标题描述:主标题+副标题英文(v6.2-patch78-fix: 使用清理后的纯英文标题)
  // 标题描述:只保留画面描述，不含字体/品牌等后期包装指令
  // 🔥 v6.2-patch101-fix: 分离生成Prompt与后期包装文档
  // 根因：标题字体、品牌设计等不可执行指令混入画面生成Prompt
  // 修复：拆分为两个字段：content（画面）+ postProduction（后期包装）
  const titleVisualOnly = `主标题【${finalMainTitle}】${finalSubTitle ? ' 副标题【' + finalSubTitle + '】' : ' 副标题【A Nirath Original by Genius】'} 出品人【${producerText}】`;
  
  // 后期包装指令（字幕/字体/品牌设计）——不进入生成Prompt
  const postProduction = {
    mainTitle: finalMainTitle,
    subTitle: finalSubTitle,
    fontStyle: pixarStyle.fontStyle || 'elegant serif with subtle geometric flourishes',
    fontSize: '45-55%高度',
    fontWeight: 'bold粗体',
    color: '金色5800K暖光+银白6500K边缘',
    visualWeight: '90%',
    brand: 'A Nirath Original by Genius',
    titleFormation: titleFormation
  };

  return {
    phase: '定格',
    timeRange: `${startTime.toFixed(1)}-${endTime}s`,
    // 只包含画面生成内容，不含后期包装指令
    content: `【${startTime.toFixed(1)}-${endTime}s 定格】${finalPose}。${idleAction}。${titleVisualOnly}。`,
    cameraPlan,
    titleEnglish: finalMainTitle + (finalSubTitle ? ' · ' + finalSubTitle : ''),
    pixarStyle,
    postProduction // 后期包装指令独立存储
  };
}

// ===== Prompt组合器(字数感知渐进裁剪) =====
// v2.2-fix: 新增神兽人声签名注入(开场第一声)
// v6.0-patch38: 新增全局负面提示词注入 + 角色数量约束 + 口播动作注入
function combineActs(act1, act2, act3, config) {
  // v2.2: 神兽人声签名 - 开场钩子(优先注入)
  // 【v6.2-patch54】升级：使用BeastOpeningLineAgent生成震撼开场白
  let beastVoiceSignature = '';
  if (config.featuredBeastId) {
    const beastName = config.beastName || (config.featuredBeastId === 'tao-tie' ? '饕餮' :
                                            config.featuredBeastId === 'jiu-wei-hu' ? '九尾狐' :
                                            config.featuredBeastId === 'zhu-long' ? '烛龙' :
                                            config.featuredBeastId === 'bai-ze' ? '白泽' :
                                            config.featuredBeastId === 'fenghuang' ? '凤凰' :
                                            config.featuredBeastId === 'ying-long' ? '应龙' :
                                            config.featuredBeastId === 'di-jiang' ? '帝江' :
                                            config.featuredBeastId === 'qiong-qi' ? '穷奇' :
                                            config.featuredBeastId === 'hun-dun' ? '混沌' :
                                            config.featuredBeastId === 'tao-wu' ? '梼杌' :
                                            config.featuredBeastId);
    
    // 【v6.2-patch54】使用开场白Agent生成震撼第一句
    const openingAgent = new BeastOpeningLineAgent();
    const beastProfile = loadCharacterCard(config.featuredBeastId) || {
      name: beastName,
      coreTrait: config.episodeSummary ? extractHookFromSummary(config.episodeSummary) : '远古神兽',
      habitat: 'Nirath'
    };
    const episodeContext = {
      theme: config.episodeSummary ? extractHookFromSummary(config.episodeSummary) : '山海经传说',
      reversal: config.episodeSummary || ''
    };
    
    // 同步生成（Agent是同步的）
    const openingResult = openingAgent.generate(beastProfile, episodeContext);
    const coreLine = openingResult.line || `${beastName}低语："你准备好了吗？"`;
    
    // v6.2-patch42-voice: 声音物理属性描述（保留）
    const voiceEngine = new BeastVoiceSignatureEngine();
    const voiceResult = voiceEngine.generate(
      config.featuredBeastId,
      beastName,
      { emphasis: 0.9 }
    );
    const profile = voiceResult.fullDescription || {};
    const timbreDesc = profile.timbre ? profile.timbre.substring(0, 80) : '低沉浑厚，远古回响';
    const effectDesc = profile.effect ? profile.effect.substring(0, 70) : '低频嗡鸣，环境共振';
    
    // 增强版神兽人声签名：震撼开场白 + 声音物理属性 + 出场音效
    beastVoiceSignature = `【神兽人声签名】${coreLine}。声音${timbreDesc}，${effectDesc}。声波引发3.2Tesla磁场共振，磁丝树震颤，地面微震，孢子被声波推散成光环。光芒随声浪从虚空汇聚，神兽浮现。\n`;
  }

  // 技术规格(精简头部,控制字数)
  // v6.2-patch42-fix: techSpec增加地质质感描述，解决"山像塑料"问题
  // v6.2-patch45-fix: techSpec增加生机勃勃生态描述，禁止光秃秃/荒芜/火星地貌
  const techSpec = '【ASTRALIS】超写实渲染,电影级光影,16:9电影画幅。Nirath:0.82G重力,3.2Tesla磁场,双恒星5800K+6500K,磁光效应可见。地质:超写实岩石纹理,风化侵蚀痕迹,层理构造,矿物结晶点缀,禁止塑料/CG质感。生态:Nirath生机勃勃,岩石间长满发光蕨类与磁丝藤蔓,奇异生物群落活跃,孢子群漂浮,有机生命覆盖地表,禁止光秃秃/荒芜/戈壁/火星表面/寸草不生。';

  // 亮度强制约束(精简版)
  const brightness = '【NIRATH明亮约束】Aurelius5800K暖金+Silvana6500K清冷，双恒星明亮光照。禁止暗黑/夜晚/灰暗。必须明亮奇幻、多色彩层次。';

  // 风格锁死(精简版)
  const styleLock = '【ASTRALIS风格锁死】Nirath原生视觉语言,禁止:地球标准光照/卡通动漫/二次元/蓝天绿草/无来源发光/无介质光线/模板化空泛描述/暗黑压抑。必须:双恒星真实明亮感+磁场可见光独特性+低重力飘浮感+生物荧光温度+量子相干性神秘感。这是Nirath不是地球。';

  // v6.0-patch39: 使用小G活泼动作系统(全身动作,非仅嘴动)
  const xiaoGActionPlan = xiaoGLivelyActionSystem.generate({
    phase: 'development',
    mood: config.mood || 'mysterious',
    interactionLevel: 'probe',
    hasDialogue: true,
    isMoving: true
  });
  const mouthAction = `【口播动作】${(xiaoGActionPlan.shortDescription || xiaoGActionPlan.mainAction || '嘴部微张说话').substring(0, 40)}`;

  // v6.0-patch38: 角色数量约束(防止AI生成多个相同角色)
  const characterCountConstraint = '【角色约束】画面中仅出现一个小G和一个饕餮,禁止出现重复角色,禁止画面中出现多个小G或多个饕餮。每个角色只能出现一次。';

  // v6.0-patch38: 全局负面提示词注入(P0级别核心约束 + 水晶禁用)
  const negativePromptResult = globalNegativePromptInjector.generate({
    priority: 'P0',
    maxLength: 80
  });
  // 手动追加角色数量约束 + 水晶禁用(必须在负面提示词中)
  const globalNegativePrompts = negativePromptResult + ';禁止水晶;禁止重复角色【全局负面约束结束】';

  // 组合三幕内容
  const MAX_LENGTH = 1500;
  const TARGET_LENGTH = 960; // 留20字符缓冲

  const narrative = `${act1.content}\n${act2.content}\n${act3.content}`;

  // v6.5.8-fix: 片头定妆照绑定（遵循定妆照规范 v1.0）
  const protagonistId = config.protagonistId || 'xiaoG';
  const beastId = config.featuredBeastId;
  // v6.5.10-fix: 修正 beastId 映射（taotie → tao-tie 目录）
  const beastDirId = beastId === 'taotie' ? 'tao-tie' : beastId;
  const charIds = [protagonistId, beastDirId].filter(Boolean);
  const imageRefLines = [];
  let imageIdx = 1;
  const charCoreDesc = {
    'xiaoG': ['银灰装甲', '东亚面孔短发', '年轻男性'],
    'tao-tie': ['碳化硅质甲壳', '腋下双眼', '巨口能量涡流'],
    'taotie': ['碳化硅质甲壳', '腋下双眼', '巨口能量涡流']
  };
  const referenceImages = [];
  const content = [];
  // 片头是wide/全景，选front角度
  for (const charId of charIds) {
    const portraitPath = loadPortraitPath(charId, 'front');
    if (portraitPath) {
      referenceImages.push({
        type: 'image_url',
        image_url: { url: portraitPath },
        role: 'reference_image',
        character: charId === 'tao-tie' ? 'taotie' : charId,
        angle: 'front'
      });
      content.push({
        type: 'image_url',
        image_url: { url: portraitPath },
        role: 'reference_image',
        character: charId === 'tao-tie' ? 'taotie' : charId,
        angle: 'front'
      });
      const charName = charId === 'xiaoG' ? '小G' : (charId === 'tao-tie' || charId === 'taotie' ? '饕餮' : charId);
      const coreDesc = charCoreDesc[charId] || ['核心特征'];
      const coreDescText = coreDesc.slice(0, 3).join('，');
      // v6.5.10-fix: 严格遵循 Seedance 官方格式 @ImageN（纯数字，无方括号字母）
      imageRefLines.push(`@Image${imageIdx} ${charName}正面，${coreDescText}，超写实`);
      imageIdx++;
    }
  }
  // 角色一致性约束
  const consistencyConstraints = '【角色一致性约束】solo single character only，严格保持角色形象一致性。杜绝多个相同人物/角色分身重影，杜绝角色形象突变/换脸。';
  
  // 🔥 v6.2-patch101-fix: 提取后期包装指令（不进入生成Prompt）
  // 根因：片头Prompt混入了字幕/字体/品牌设计等不可执行指令
  // 修复：将后期包装指令分离到独立字段，生成Prompt只保留画面内容
  const postProduction = act3.postProduction || {};

  // 运镜计划(v3.0-patch3:紧凑化关键词法,保留5-7段)
  const allCameraMoves = [
    ...act1.cameraPlan,
    ...act2.cameraPlan,
    ...act3.cameraPlan
  ];

  // 紧凑化运镜描述:用"动作+效果"两词法
  const compactCameraMoves = allCameraMoves.map(c => {
    const parts = c.movement.split(/[,,]/);
    return parts[0]; // 只保留前半部分(动作描述)
  });

  // 合并为时间轴格式(节省字数)
  const cameraTimeline = allCameraMoves.map(c => `${c.time.split('-')[0]}-${c.movement.split(/[,,]/)[0]}`).join('→');
  const cameraPlan = `【运镜】${compactCameraMoves.join('→')}。时间轴:${cameraTimeline}`;

  // 角色合规检查
  const complianceCheck = {
    protagonistPresent: !!config.protagonistId,
    beastPresent: !!config.featuredBeastId,
    protagonistPortrait: loadPortraitPath(config.protagonistId) !== null,
    beastPortrait: loadPortraitPath(config.featuredBeastId) !== null,
    durationValid: config.duration >= 3 && config.duration <= 30,
    allChecksPass: false
  };
  complianceCheck.allChecksPass =
    complianceCheck.protagonistPresent &&
    complianceCheck.beastPresent &&
    complianceCheck.protagonistPortrait &&
    complianceCheck.beastPortrait &&
    complianceCheck.durationValid;

  // v6.0-patch39-fix: 重新排列优先级--关键约束不可截断
  // 顺序:神兽人声签名 > ASTRALIS > 叙事 > 运镜 > 明亮约束 > 风格锁 > 角色约束 > 口播动作 > 全局负面
  // 如果空间不足,优先截断叙事内容(非关键约束)
  let fullPrompt = `${beastVoiceSignature}${techSpec}\n\n${narrative}\n\n${cameraPlan}\n\n${brightness}\n\n${styleLock}\n\n${characterCountConstraint}\n\n${mouthAction}\n\n${globalNegativePrompts}`;

  // v6.2-patch42-fix: 增加地质质感校验维度，解决"山像塑料"问题
  // 系统级规则：所有Nirath场景的地貌必须包含真实地质纹理描述
  const geologyKeywords = ['地质纹理', '风化侵蚀', '岩石纹理', '层理构造', '矿物结晶', '摄影级岩石', '自然不规则', '微起伏'];
  const hasGeologyTexture = geologyKeywords.some(kw => fullPrompt.includes(kw));
  
  // 负面质感词检查（塑料/CG感）
  const plasticKeywords = ['塑料质感', 'CG感', '游戏贴图', '过于平滑', '卡通风格'];
  const hasPlasticFeel = plasticKeywords.some(kw => fullPrompt.includes(kw));
  
  // 地质质感评分
  const geologyScore = hasGeologyTexture ? (hasPlasticFeel ? 5 : 10) : 0;
  
  complianceCheck.geologyQuality = {
    hasTexture: hasGeologyTexture,
    hasPlasticFeel: hasPlasticFeel,
    score: geologyScore,
    maxScore: 10,
    warning: !hasGeologyTexture ? '⚠️ 缺少地质质感描述，可能导致地貌像塑料/CG。建议添加：风化侵蚀痕迹、岩石纹理、层理构造等' : null
  };

  // v6.0-patch40: 智能截断系统--当总长度超过980时,按优先级逐级压缩
  if (fullPrompt.length > MAX_LENGTH) {
    console.warn(`[opening-system-v3] Prompt长度${fullPrompt.length}超出限制,启动智能压缩...`);
    
    let truncationApplied = false;
    
    // Stage 1: 压缩亮度约束(保留核心)
    if (fullPrompt.length > MAX_LENGTH) {
      const minimalBrightness = '【明亮约束】Aurelius5800K暖金+Silvana6500K清冷,禁止暗黑/夜晚/乌漆嘛黑。必须明亮多色彩强质感。';
      fullPrompt = fullPrompt.replace(brightness, minimalBrightness);
      truncationApplied = true;
    }
    
    // Stage 2: 压缩风格锁(保留核心)
    if (fullPrompt.length > MAX_LENGTH) {
      const minimalStyleLock = '【风格锁】禁止卡通/动漫/暗黑。必须双恒星明亮光照+磁场可见+低重力飘浮。这是Nirath。';
      fullPrompt = fullPrompt.replace(styleLock, minimalStyleLock);
      truncationApplied = true;
    }
    
    // Stage 3: 压缩运镜(只保留关键词)
    if (fullPrompt.length > MAX_LENGTH) {
      const minimalCamera = `【运镜】${compactCameraMoves.slice(0, 3).join('→')}`;
      fullPrompt = fullPrompt.replace(cameraPlan, minimalCamera);
      truncationApplied = true;
    }
    
    // Stage 4: 压缩角色约束
    if (fullPrompt.length > MAX_LENGTH) {
      const minimalCharacterCount = '【角色约束】仅一个小G和一个饕餮,禁止重复角色。';
      fullPrompt = fullPrompt.replace(characterCountConstraint, minimalCharacterCount);
      truncationApplied = true;
    }
    
    // Stage 5: 压缩口播动作
    if (fullPrompt.length > MAX_LENGTH) {
      const minimalMouthAction = '【口播动作】嘴部微张说话,下巴微动';
      fullPrompt = fullPrompt.replace(mouthAction, minimalMouthAction);
      truncationApplied = true;
    }
    
    // Stage 6: 压缩全局负面提示词
    if (fullPrompt.length > MAX_LENGTH) {
      const minimalNegative = '【全局负面约束】禁止眼睛出现红色/蓝色/黄色/绿色/紫色/荧光色;禁止水晶;禁止重复角色【全局负面约束结束】';
      fullPrompt = fullPrompt.replace(globalNegativePrompts, minimalNegative);
      truncationApplied = true;
    }
    
    // Stage 7: 压缩ASTRALIS技术规格
    if (fullPrompt.length > MAX_LENGTH) {
      const minimalTechSpec = '【ASTRALIS】超写实渲染,电影级光影,16:9。Nirath:0.82G重力,3.2Tesla磁场,双恒星5800K+6500K。';
      fullPrompt = fullPrompt.replace(techSpec, minimalTechSpec);
      truncationApplied = true;
    }
    
    // Stage 8: 压缩叙事本体(Act2展开阶段)--保留核心,去除细节修饰
    if (fullPrompt.length > MAX_LENGTH) {
      // 提取Act2内容(展开阶段)
      const act2Content = act2.content;
      // 压缩策略:保留前50%内容(前兆+爆发的核心),去除后半部分细节
      const compressedAct2 = act2Content.substring(0, Math.floor(act2Content.length * 0.6));
      fullPrompt = fullPrompt.replace(act2Content, compressedAct2);
      truncationApplied = true;
    }
    
    // Stage 9: 最终兜底--如果还是超长,直接截断
    if (fullPrompt.length > MAX_LENGTH) {
      console.warn(`[opening-system-v3] 警告:经过8级压缩后Prompt仍超长(${fullPrompt.length}),执行强制截断`);
      fullPrompt = fullPrompt.substring(0, MAX_LENGTH - 3) + '...';
    }
    
    console.log(`[opening-system-v3] 智能压缩完成: ${fullPrompt.length}字符`);
  }

  fullPrompt = sanitizePrompt(fullPrompt);

  let truncationApplied = fullPrompt.length > MAX_LENGTH;

  // v6.5.10-fix: 在截断逻辑后注入定妆照引用（确保不被截断）
  const imageRefText = imageRefLines.length > 0 ? imageRefLines.join('，') + '。' : '';
  if (imageRefText) {
    const tailBlock = imageRefText + consistencyConstraints;
    if (fullPrompt.length + tailBlock.length + 2 <= MAX_LENGTH) {
      fullPrompt += ` ${tailBlock}`;
    } else if (fullPrompt.length + imageRefText.length + 2 <= MAX_LENGTH) {
      fullPrompt += ` ${imageRefText}`;
    } else {
      // 空间不足：从末尾腾出空间，优先保留定妆照引用
      const needSpace = imageRefText.length + 2;
      if (fullPrompt.length > MAX_LENGTH - needSpace) {
        fullPrompt = fullPrompt.substring(0, MAX_LENGTH - needSpace);
      }
      fullPrompt += ` ${imageRefText}`;
    }
  }
  
  // 重新计算截断状态
  truncationApplied = fullPrompt.length > MAX_LENGTH;
  
  // v6.5.10-fix: content 数组已在上面构建，直接使用

  return {
    prompt: fullPrompt,
    length: fullPrompt.length,
    cameraPlan: allCameraMoves,
    complianceCheck,
    truncationApplied,
    // 🔥 v6.2-patch101-fix: 后期包装指令独立返回（不进入生成Prompt）
    postProduction: postProduction || {},
    // v6.5.8-fix: 定妆照信息供 pipeline 使用
    referenceImages,
    content,
    // v6.5.58-fix: 添加标准title对象和isOpening标记
    title: postProduction && postProduction.mainTitle ? {
      main: postProduction.mainTitle || '',
      sub: postProduction.subTitle || 'A Nirath Original by Genius',
      creator: postProduction.brand ? postProduction.brand.replace('A Nirath Original by ', '') : 'Genius',
      episodeName: postProduction.titleFormation || '',
      displayTiming: '6.8-9.0s',
      position: '画面中央偏下',
      style: postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
    } : undefined,
    isOpening: true,
    duration: 9
  };
}

function extractCameraKeywords(cameraPlans) {
  const keywordMap = {
    'extreme_wide': 'extreme_wide',
    'dolly_in': 'dolly_in',
    'dolly_out': 'dolly_out',
    'orbit': 'orbit',
    'magnetic_line_follow': 'magnetic_line_follow',
    'gravity_drift': 'gravity_drift',
    'dual_star_sweep': 'dual_star_sweep',
    'slow push': 'dolly_in'
  };

  const keywords = [];
  cameraPlans.forEach(plan => {
    Object.entries(keywordMap).forEach(([key, value]) => {
      if (plan.movement.includes(key) && !keywords.includes(value)) {
        keywords.push(value);
      }
    });
  });
  return keywords;
}

// ===== 主入口 =====
function generateOpeningV3(config) {
  return generateThreeActOpening(config);
}

// ===== 预生产检查 =====
function preProductionCheck(config) {
  const issues = [];

  const protagonist = loadCharacterCard(config.protagonistId);
  if (!protagonist) issues.push({ level: 'error', message: `主角档案未找到: ${config.protagonistId}` });

  const beast = loadCharacterCard(config.featuredBeastId);
  if (!beast) issues.push({ level: 'error', message: `异兽档案未找到: ${config.featuredBeastId}` });

  const proPortrait = loadPortraitPath(config.protagonistId);
  if (!proPortrait) issues.push({ level: 'error', message: `主角定妆照未找到: ${config.protagonistId}` });

  const beastPortrait = loadPortraitPath(config.featuredBeastId);
  if (!beastPortrait) issues.push({ level: 'error', message: `异兽定妆照未找到: ${config.featuredBeastId}` });

  if (!NIRATH_PLANET_CORE) issues.push({ level: 'error', message: 'Nirath圣经未加载' });

  if (config.duration < 3 || config.duration > 30) {
    issues.push({ level: 'warning', message: `时长${config.duration}秒超出推荐范围(3-30)` });
  }

  return {
    canProceed: issues.filter(i => i.level === 'error').length === 0,
    issues,
    portraits: {
      protagonist: proPortrait,
      beast: beastPortrait
    }
  };
}

// ===== v2.2新增:从episodeSummary提取剧情钩子 =====
function extractHookFromSummary(summary) {
  if (!summary) return null;

  // 尝试提取关键剧情转折点(前200字内)
  const shortSummary = summary.substring(0, 300);

  // 查找关键句(包含"但""却""原来""真相"等转折词的句子)
  const turnPatterns = [/[^。]*但[^。]*。/, /[^。]*却[^。]*。/, /[^。]*原来[^。]*。/, /[^。]*真相[^。]*。/, /[^。]*发现[^。]*。/];

  for (const pattern of turnPatterns) {
    const match = shortSummary.match(pattern);
    if (match) {
      return match[0].replace(/。$/, '');
    }
  }

  // 如果找不到转折,返回前50字作为钩子
  return shortSummary.substring(0, 50) + '...';
}

module.exports = {
  generateOpeningV3,
  preProductionCheck,
  loadCharacterCard,
  loadPortraitPath,
  generateCharacterDescription
};

// ===== 测试 =====
if (require.main === module) {
  console.log('🎬 通用片头系统 v3.0 - Nirath单镜头叙事片头引擎\n');

  const configs = [
    {
      episodeTitle: '九尾狐·迷局',
      episodeTheme: 'mysterious',
      episodeSummary: '小G初到青丘群岛,被九尾狐幻术迷惑,九尾狐测试小G分辨力,两者建立信任签订真相契约。',
      protagonistId: 'xiaoG',
      featuredBeastId: 'jiu-wei-hu',
      duration: 9,
      mood: 'mysterious'
    }
  ];

  configs.forEach(config => {
    console.log(`\n🎬 测试: ${config.episodeTitle} (${config.duration}秒)`);

    console.log('\n=== 预生产检查 ===');
    const check = preProductionCheck(config);
    console.log(`✅ 可继续: ${check.canProceed}`);
    check.issues.forEach(i => console.log(`${i.level === 'error' ? '❌' : '⚠️'} ${i.message}`));
    console.log(`定妆照: 主角=${check.portraits.protagonist ? '✅' : '❌'}, 异兽=${check.portraits.beast ? '✅' : '❌'}`);

    if (check.canProceed) {
      console.log('\n=== 生成片头 ===');
      const opening = generateOpeningV3(config);
      console.log(`时长: ${opening.duration}秒`);
      console.log(`Prompt长度: ${opening.promptLength}/1500 ${opening.promptLength > 1500 ? '🔴 超限!' : '✅ 合规'}`);
      console.log(`是否裁剪: ${opening.truncationApplied ? '是' : '否'}`);
      console.log(`合规检查: ${opening.complianceCheck.allChecksPass ? '✅ 全部通过' : '❌ 未通过'}`);
      console.log('\n三幕结构:');
      Object.values(opening.acts).forEach(act => {
        console.log(`  ${act.phase} (${act.timeRange}): ${act.content.substring(0, 60)}...`);
      });
      console.log('\n运镜计划:');
      const allMoves = [
        ...opening.acts.act1.cameraPlan,
        ...opening.acts.act2.cameraPlan,
        ...opening.acts.act3.cameraPlan
      ];
      allMoves.forEach(m => console.log(`  ${m.time}: ${m.movement}`));
      console.log('\n角色:');
      console.log(`  主角: ${opening.characters.protagonist?.name}`);
      console.log(`  异兽: ${opening.characters.beast?.name}`);
      console.log(`\n📄 完整Prompt (${opening.promptLength}字):`);
      console.log(opening.prompt);
    }
  });

  console.log('\n✅ 通用片头系统 v3.0 测试完成');
  console.log('\n⚠️ 注意:如果Prompt长度>1500,系统会自动渐进裁剪(技术规格→运镜→风格锁),但叙事和角色内容永远优先保留!');
  console.log('   裁剪顺序:1)技术规格精简 2)运镜精简 3)风格锁精简(叙事和角色永不裁剪)');
  console.log('   如果裁剪后仍>1500,说明输入剧情太长,需要精简episodeSummary!');
}
