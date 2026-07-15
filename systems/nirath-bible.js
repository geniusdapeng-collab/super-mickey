/**
 * NIRATH BIBLE — Nirath Planet Visual Bible
 * ASTRALIS v3.0 Core Constants Library
 * 
 * Contains all Nirath planetary parameters, lighting model, magnetic effects,
 * ecosystem data, and spectral fingerprint colors.
 * 
 * @module nirath-bible
 * @version 3.0
 */

// ─────────────────────────────────────────
// 1.1 星球参数（渲染底层常量）
// ─────────────────────────────────────────

const NIRATH_PLANET_CORE = {
  // 天文参数
  starSystem: {
    primary: { 
      color: '#FFBF00', 
      temp: 5800, 
      mass: 1.1, 
      name: 'Aurelius' 
    },   // 主星：金色
    secondary: { 
      color: '#E6E6FA', 
      temp: 6500, 
      mass: 0.9, 
      name: 'Silvana' 
    }, // 伴星：银白
    binaryOrbitPeriod: '72小时',  // 双星互绕周期决定光影律动
    eclipseFrequency: 0.15       // 星蚀发生概率，产生戏剧性光影
  },
  
  // 磁场参数 — 这是 Nirath 视觉独特性的核心
  magnetosphere: {
    fieldStrength: '3.2特斯拉',      // 地球6倍，产生可见磁光
    visibleColor: '#6B5BFF',          // 淡蓝紫可见磁场
    resonanceFrequency: '30Hz',       // 磁场共鸣频率（片头关键元素）
    auroraType: '双螺旋极光环',        // 非地球单环，是DNA双螺旋结构
    distortionEffect: '引力透镜级'     // 强磁场弯曲光线的程度
  },
  
  // 生态参数
  ecosystem: {
    floraBioluminescence: 0.73,      // 73%植物具有生物荧光
    crystalGrowthRate: '肉眼可见',    // 发光矿物实时生长
    sporeDensity: '1200个/cm³',      // 空气中发光孢子浓度
    gravity: '0.82G',                // 低重力影响粒子飘动速度
    atmosphericRefractivity: 1.00045 // 大气折射率（彩虹效应更强）
  },
  
  // Nirath 色彩指纹 — 所有片头必须严格遵循
  spectralFingerprint: {
    primary: '#2E1A47',      // 深渊紫 — 虚空与深度的颜色
    secondary: '#FF9F1C',    // 琥珀金 — 双恒星的光芒
    tertiary: '#00C9A7',     // 量子青 — 磁场与生命的颜色
    quaternary: '#C77DFF',   // 矿物紫 — 矿物与记忆的颜色
    accent: '#E0AAFF',       // 星尘粉 — 孢子与梦境的颜色
    void: '#0A0014',         // 绝对黑 — Nirath夜空不是黑，是深紫近黑
    light: '#FFF3E0'         // 圣光白 — 双恒星重叠时的极限色
  }
};

// ─────────────────────────────────────────
// 1.2 光影体系 — ASTRALIS 光照模型
// ─────────────────────────────────────────

const ASTRALIS_LIGHTING_MODEL = {
  // 光源1：Aurelius（金色主星）
  aurelius: {
    colorTemp: 5800,
    dominantHue: '#FFBF00',
    shadowColor: '#2E1A47',      // 金色光的投影是深渊紫
    volumetricScattering: '强',  // 大气中可见光柱
    causticsIntensity: 1.8,      // 焦散强度（水面/发光矿物）
    specularSignature: '暖金高光+紫红边缘'  // 镜面反射特征色
  },
  
  // 光源2：Silvana（银白伴星）
  silvana: {
    colorTemp: 6500,
    dominantHue: '#E0E0FF',
    shadowColor: '#1A0F2E',      // 银白光的投影更冷
    volumetricScattering: '极强', // 冷色调光柱
    causticsIntensity: 2.2,      // 更强调焦散（高频光）
    specularSignature: '银白高光+青蓝边缘'
  },
  
  // 关键：双光源干涉模式
  interferencePatterns: {
    constructive: '#FFFFFF',     // 两光重叠 = 圣白热（极少出现，戏剧性时刻）
    destructive: '#4A1942',      // 半影区 = 暗紫红色
    beatFrequency: '每36小时一次主从切换', // 哪颗星占主导的变化
    eclipseChromatic: '#00C9A7'  // 星蚀时的环边缘色 — 量子青
  }
};

// ─────────────────────────────────────────
// 1.2.2 磁场可见光效应
// ─────────────────────────────────────────

const MAGNETIC_VISIBLE_EFFECTS = {
  // 磁场线可视化
  fieldLines: {
    visibility: '弱发光丝状结构',
    color: '#6B5BFF',
    intensity: '0.3坎德拉/m²',
    pattern: '从磁极发出的双螺旋曲线'
  },
  
  // 磁暴事件（片头高潮时刻可用）
  storm: {
    prelude: '磁场线开始剧烈抖动，频率从30Hz升至120Hz',
    peak: '可见电弧在磁场线之间跳跃，颜色从蓝紫转为白热',
    aftermath: '磁场线如琴弦般缓慢恢复，残留离子发光痕迹',
    duration: '3-5秒',
    impactOnTitle: '字母在磁暴中被拉扯变形，如被无形之手揉捏'
  },
  
  // 磁场折射（标题动效的核心物理机制）
  refraction: {
    description: '强磁场区域的光线偏折效应',
    bendingAngle: '最大15度偏折',
    visualResult: '透过磁场区域看标题，字母如水中倒影般扭曲晃动',
    uniqueness: '这是Nirath独有的视觉签名，地球物理无法实现'
  }
};

// ─────────────────────────────────────────
// 1.3 构图法则 — ASTRALIS 构图学
// ─────────────────────────────────────────

const ASTRALIS_COMPOSITION_GRAMMAR = {
  // 法则1：磁极对称
  magneticSymmetry: {
    description: '以磁场轴线为构图中心，非画面几何中心',
    implementation: '标题不放在画面中央，而是放在磁场双螺旋的焦点',
    effect: '画面有看不见的力量线在组织视觉元素'
  },
  
  // 法则2：双源照明构图
  dualSourceFraming: {
    description: '每个画面必须能追溯两个光源的方向',
    requirement: '任何物体必须有两个不同颜色的投影',
    niranthSignature: '金色投影（Aurelius）+ 银白边缘光（Silvana）= Nirath立体感'
  },
  
  // 法则3：孢子深度层
  sporeDepthLayers: {
    description: '前景/中景/背景都有不同密度的发光孢子',
    layer1: '前景孢子 — 虚焦光斑，大颗粒，缓慢沉降（0.82G）',
    layer2: '中景孢子 — 半清晰，受磁场影响做螺旋运动',
    layer3: '背景孢子 — 如星空般密集，形成发光大气层'
  },
  
  // 法则4：悬浮几何
  levitationGeometry: {
    description: 'Nirath的低重力允许不可思议的构图',
    elements: [
      '悬浮岛屿的底部也必须被照亮（无"地面"概念）',
      '水滴向上漂浮（磁悬浮）',
      '发光矿物从地面和天花板同时生长',
      '标题字母可以不需要"底座"，自由悬浮'
    ]
  },
  
  // 法则5：时间晶体节奏
  temporalCrystalRhythm: {
    description: '非线性时间感知',
    techniques: [
      '瞬间拉伸 — 关键帧0.5秒内时间变慢10倍',
      '量子跳跃 — 画面无缝切换两个时间点',
      '回环结构 — 片头最后一帧与第一帧物理上连通'
    ]
  }
};

// ─────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────

function getSpectralColors(count = 3) {
  const colors = [
    { name: '深渊紫', hex: NIRATH_PLANET_CORE.spectralFingerprint.primary },
    { name: '琥珀金', hex: NIRATH_PLANET_CORE.spectralFingerprint.secondary },
    { name: '量子青', hex: NIRATH_PLANET_CORE.spectralFingerprint.tertiary },
    { name: '矿物紫', hex: NIRATH_PLANET_CORE.spectralFingerprint.quaternary },
    { name: '星尘粉', hex: NIRATH_PLANET_CORE.spectralFingerprint.accent }
  ];
  return colors.slice(0, count);
}

function getStarDescription() {
  const { primary, secondary } = NIRATH_PLANET_CORE.starSystem;
  return `双恒星系统：${primary.name}（金色主星，${primary.temp}K）与${secondary.name}（银白伴星，${secondary.temp}K），${NIRATH_PLANET_CORE.starSystem.binaryOrbitPeriod}互绕周期。`;
}

function getMagnetosphereDescription() {
  const m = NIRATH_PLANET_CORE.magnetosphere;
  return `磁层强度${m.fieldStrength}，可见${m.visibleColor}色磁场线，${m.resonanceFrequency}共鸣频率。${m.auroraType}在磁极点持续舞动。`;
}

function getEcosystemDescription() {
  const e = NIRATH_PLANET_CORE.ecosystem;
  return `大气含${e.sporeDensity}以太孢子，低重力${e.gravity}下缓慢飘浮沉降。空气折射率${e.atmosphericRefractivity}产生强化彩虹效应。73%植物具有生物荧光。`;
}

// ─────────────────────────────────────────
// 1.6 ASTRALIS 亮度强制约束（v3.0-patch1）
// ─────────────────────────────────────────

const ASTRALIS_BRIGHTNESS_MANDATE = {
  // 核心原则：Nirath片头必须明亮奇幻，绝对禁止暗黑压抑
  mandate: '所有Nirath星球视觉必须呈现明亮奇幻基调，双恒星光照为主要光源',
  
  // 禁止的色调
  forbiddenTones: [
    '暗黑', '压抑', '哥特', '阴郁', '阴沉', '灰暗', '黑灰主调',
    'dark_gothic', 'noir', 'grimdark', 'muted_dark'
  ],
  
  // 强制明亮的具体参数
  requiredBrightness: {
    environment: '双恒星光照下明亮环境，环境光充足',
    title: '标题在明亮背景下清晰可见，镜面反射增强亮度',
    shadows: '阴影区域仍有淡蓝紫磁场光晕填充，禁止纯黑死黑',
    contrast: '高对比但明亮，禁止低饱和灰暗'
  },
  
  // Aurelius金色主星作为基调光源
  primaryLightMood: 'Aurelius金色主星(5800K)提供温暖明亮的金色基调，占据画面60%以上光照权重',
  
  // Silvana银白伴星作为辅助
  secondaryLightMood: 'Silvana银白伴星(6500K)提供清冷的银白高光，增强立体感和通透感',
  
  // 磁场可见光的亮度贡献
  magneticLightContribution: '淡紫蓝色磁场可见光作为环境填充光，确保暗部不沉死'
};

function getBrightnessMandate() {
  return `【NIRATH明亮强制约束】${ASTRALIS_BRIGHTNESS_MANDATE.mandate}。` +
    `${ASTRALIS_BRIGHTNESS_MANDATE.primaryLightMood}。` +
    `${ASTRALIS_BRIGHTNESS_MANDATE.secondaryLightMood}。` +
    `禁止：${ASTRALIS_BRIGHTNESS_MANDATE.forbiddenTones.join('、')}。` +
    `必须：${ASTRALIS_BRIGHTNESS_MANDATE.requiredBrightness.environment}，` +
    `${ASTRALIS_BRIGHTNESS_MANDATE.requiredBrightness.shadows}。`;
}

// ─────────────────────────────────────────
// 1.7 NIRATH 全局风格禁用词（v3.0-patch2）
// ─────────────────────────────────────────

const NIRATH_STYLE_BANS = {
  // 队长审美偏好：有机/生物/自然质感，禁止冰冷工业金属感
  materialBans: [
    '金属光泽', 'metallic sheen', 'chrome', '不锈钢', '铝合金',
    '金属质感', '金属反光', '金属表面', '金属色'
  ],
  
  // 其他已存在的全局禁用
  visualBans: [
    '暗黑', '压抑', '哥特', '阴郁', '灰暗',
    '卡通', '动漫', '二次元', '蓝天绿草',
    '模板化', '史诗级', '震撼'
  ],
  
  // 推荐替代词（当检测到禁用词时，自动替换为这些）
  replacements: {
    '金属光泽': '生物荧光质感',
    'metallic sheen': 'bioluminescent texture',
    '金属质感': '有机晶体质感',
    '金属反光': '生物膜折射'
  }
};

function getStyleBans() {
  return {
    bans: [...NIRATH_STYLE_BANS.materialBans, ...NIRATH_STYLE_BANS.visualBans],
    replacements: NIRATH_STYLE_BANS.replacements
  };
}

function sanitizePrompt(prompt) {
  let sanitized = prompt;
  const { replacements } = NIRATH_STYLE_BANS;
  
  Object.entries(replacements).forEach(([banned, replacement]) => {
    if (sanitized.includes(banned)) {
      sanitized = sanitized.split(banned).join(replacement);
    }
  });
  
  return sanitized;
}

module.exports = {
  NIRATH_PLANET_CORE,
  ASTRALIS_LIGHTING_MODEL,
  MAGNETIC_VISIBLE_EFFECTS,
  ASTRALIS_COMPOSITION_GRAMMAR,
  ASTRALIS_BRIGHTNESS_MANDATE,
  NIRATH_STYLE_BANS,
  getSpectralColors,
  getStarDescription,
  getMagnetosphereDescription,
  getEcosystemDescription,
  getBrightnessMandate,
  getStyleBans,
  sanitizePrompt
};
