/**
 * ASTRALIS SIGNATURE ENGINE — Producer Credit Display Module
 * ASTRALIS v3.0
 * 
 * 6 ways to display producer information in Nirath-native visual language.
 * Producer info is not "subtitle" but "planet's memory of the creator".
 * 
 * @module astralis-signature-engine
 * @version 3.0
 */

// ─────────────────────────────────────────
// 4.1 六种 Nirath 原生呈现方式
// ─────────────────────────────────────────

const ASTRALIS_SIGNATURE_MODES = {
  // ─────────────────────────────────────────
  // 方式1：MAGNETIC_FOSSIL 磁化石（v3.0-patch1重构）
  // ─────────────────────────────────────────
  magneticFossil: {
    name: 'MAGNETIC FOSSIL 磁化石',
    description: '出品人信息以磁化石形式固化于Nirath地质层 — 清晰可读而非隐喻',
    effect: `标题完成后，画面底部（占画面高度8-10%区域）的磁流体在磁场作用下冷凝固化，形成清晰可读的"{{PRODUCER}}"字样。字体纤细优雅，与主标题共享磁流体镜面材质但尺寸明显较小。磁化石表面有凝固时的流动纹理和微小气泡痕迹，如地质标本般真实。双恒星照射下呈现暖铜色底色配紫红干涉边缘，在明亮背景中清晰可辨。`,
    physics: '磁流体在特定温度/磁场条件下发生磁致相变，形状被永久冻结',
    visualDetail: '磁化石位于画面底部，不遮挡主标题，字体大小约为标题的1/4到1/3，确保远距离可读。表面纹理在近距离观看时可见，远距离阅读时不影响清晰度。',
    temporalQuality: '磁化石永久固化于Nirath地质层，是星球对创作者的铭记',
    readability: {
      position: '画面底部8-10%高度区域，水平居中',
      size: '字体高度约为画面高度的2-3%，确保可读',
      contrast: '与明亮背景形成 sufficient contrast，禁止融入背景不可辨',
      font: '纤细优雅无衬线体，笔画清晰不粘连'
    }
  },

  // ─────────────────────────────────────────
  // 方式2：QUANTUM_ECHO 量子回声
  // ─────────────────────────────────────────
  quantumEcho: {
    name: 'QUANTUM ECHO 量子回声',
    description: '出品人信息在量子苔藓网络中以回声形式传播',
    effect: `标题呈现后，量子苔藓网络的电脉冲继续传播，但内容从"{{TITLE}}"变为"{{PRODUCER}}" — 如回声。脉冲在全网传播一次后反射，再次经过画面时信息又一次变化，可能是日期、地点或一句箴言。`,
    physics: '量子纠缠网络的信号传播有时间延迟，反射产生回声',
    visualDetail: '每次回声都比前一次暗，但颜色略有不同 — 信息在传播中"衰减"但也"演化"',
    temporalQuality: '回声可以持续很多次，直到完全淹没在背景噪音中 — 如记忆 fade out'
  },

  // ─────────────────────────────────────────
  // 方式3：SPORE_DREAM 孢子梦境
  // ─────────────────────────────────────────
  sporeDream: {
    name: 'SPORE DREAM 孢子梦境',
    description: '出品人信息以太尔孢子的集体梦境形式呈现',
    effect: `高密度孢子群在标题下方形成一片"雾毯"，雾中隐约可见"{{PRODUCER}}" — 不是清晰的字，是如梦初醒时看到的模糊文字。孢子群的呼吸性闪烁使文字时隐时现。`,
    physics: '孢子群的集体发光周期与视觉暂留效应结合',
    visualDetail: '文字的清晰度随孢子密度波动 — 深呼吸时清晰，呼气时模糊',
    temporalQuality: '如梦境般不可捉摸 — 越想看清越模糊，放松时反而清晰'
  },

  // ─────────────────────────────────────────
  // 方式4：AURORA_SIGNATURE 极光签名
  // ─────────────────────────────────────────
  auroraSignature: {
    name: 'AURORA SIGNATURE 极光签名',
    description: '出品人信息以极光触须的书写动作形成',
    effect: `一条极光触须从天际垂下，如巨大的手指在地面上方书写"{{PRODUCER}}" — 书写过程可见，每笔都是一道电离气体轨迹。写完后触须收回天际，但电离气体的余辉持续数秒。`,
    physics: '带电粒子沉降 + 大气激发 + 磁约束书写',
    visualDetail: '书写时有"笔触"变化 — 起笔重（亮），收笔轻（暗），有书法的韵律',
    temporalQuality: '是一次性的表演 — 写完后不会重复，每遍都略有不同'
  },

  // ─────────────────────────────────────────
  // 方式5：MAGNETIC_INCLUSION 磁质体包裹体
  // ─────────────────────────────────────────
  crystalInclusion: {
    name: 'CRYSTAL INCLUSION 磁质体包裹体',
    description: '出品人信息被封存在新生磁质体的内部全息影像中',
    effect: `画面角落有一颗小磁质体在生长，生长完成后磁质体内部的全息影像显现为"{{PRODUCER}}" — 需要通过磁质体的折射来看，直接看磁质体只能看到模糊的光斑。`,
    physics: '磁质体生长过程中捕获的晶格缺陷形成全息光栅',
    visualDetail: '转动视角时，内部文字从不同角度有不同的变形和颜色 — 磁质体是三棱镜+光栅的组合',
    temporalQuality: '永久封存 — 只要磁质体存在，信息就存在（数百万年）'
  },

  // ─────────────────────────────────────────
  // 方式6：GRAVITATION_LENS 引力透镜署名
  // ─────────────────────────────────────────
  gravitationalLensSignature: {
    name: 'GRAVITATIONAL LENS SIGNATURE 引力透镜署名',
    description: '出品人信息通过空间扭曲的引力透镜效应呈现',
    effect: `标题完成后，画面某处的强磁场使背景光线弯曲，弯曲后的光线在虚像位置形成"{{PRODUCER}}" — 不是真实存在的字，是空间扭曲造成的"光学幻象"。移动视角时，幻象变形、移位，但始终可读。`,
    physics: '强磁场引力透镜效应 + 虚像形成 + 视角依赖性',
    visualDetail: '文字边缘有引力透镜特有的彩色边缘畸变 — 红端偏移+蓝端偏移',
    temporalQuality: '只要磁场存在，幻象就存在 — 磁场变化时文字如水面倒影般波动'
  }
};

// ─────────────────────────────────────────
// 4.2 出品人模块 API
// ─────────────────────────────────────────

/**
 * 生成出品人信息Prompt段落
 * @param {string} producerText - 出品人文本（如 "A Nirath Original by Genius"）
 * @param {string} displayMode - 显示方式（magneticFossil/quantumEcho/sporeDream/auroraSignature/crystalInclusion/gravitationalLensSignature）
 * @param {Object} context - 上下文配置
 * @param {string} context.titleText - 标题文本（用于回声效果）
 * @param {number} context.titleDuration - 标题持续时间（秒）
 * @returns {string} 出品人Prompt段落
 */
function generateSignaturePrompt(producerText, displayMode, context = {}) {
  const mode = ASTRALIS_SIGNATURE_MODES[displayMode];
  if (!mode) return '';

  let prompt = `【ASTRALIS SIGNATURE — ${mode.name}】\n`;
  
  let effectText = mode.effect.replace(/\{\{PRODUCER\}\}/g, `"${producerText}"`);
  if (context.titleText) {
    effectText = effectText.replace(/\{\{TITLE\}\}/g, `"${context.titleText}"`);
  }
  prompt += `${effectText}\n`;
  prompt += `物理机制：${mode.physics}\n`;
  prompt += `视觉细节：${mode.visualDetail}\n`;
  prompt += `时间特性：${mode.temporalQuality}\n`;

  // v3.0-patch1: Readability mandate
  if (mode.readability) {
    prompt += `\n【可读性强制约束】`;
    prompt += `位置：${mode.readability.position}。`;
    prompt += `大小：${mode.readability.size}。`;
    prompt += `对比度：${mode.readability.contrast}。`;
    prompt += `字体：${mode.readability.font}。`;
    prompt += `出品人信息必须清晰可辨，禁止以"暗示""隐喻"形式呈现。\n`;
  }

  // v3.0：自动协调与标题的时空关系
  if (context.titleDuration) {
    const appearTime = (context.titleDuration * 0.7).toFixed(1);
    prompt += `\n【时空坐标】标题呈现后${appearTime}秒开始出现，与标题共享同一磁场环境，确保视觉连贯。\n`;
  }

  return prompt;
}

/**
 * 获取出品人显示方式列表
 * @returns {Array} [{key, name, description}]
 */
function getSignatureModesList() {
  return Object.entries(ASTRALIS_SIGNATURE_MODES).map(([key, mode]) => ({
    key,
    name: mode.name,
    description: mode.description
  }));
}

/**
 * 获取出品人显示方式详情
 * @param {string} displayMode - 显示方式键名
 * @returns {Object|null} 详情
 */
function getSignatureModeDetails(displayMode) {
  return ASTRALIS_SIGNATURE_MODES[displayMode] || null;
}

/**
 * 推荐出品人显示方式（基于情感基调）
 * @param {string} mood - 氛围
 * @returns {Array} 推荐列表
 */
function recommendSignatureMode(mood) {
  const map = {
    'epic': ['magneticFossil', 'auroraSignature'],
    'mysterious': ['quantumEcho', 'sporeDream'],
    'ancient': ['crystalInclusion', 'magneticFossil'],
    'ethereal': ['sporeDream', 'gravitationalLensSignature'],
    'dramatic': ['auroraSignature', 'magneticFossil'],
    'serene': ['quantumEcho', 'crystalInclusion']
  };
  return map[mood] || ['magneticFossil', 'auroraSignature'];
}

module.exports = {
  ASTRALIS_SIGNATURE_MODES,
  generateSignaturePrompt,
  getSignatureModesList,
  getSignatureModeDetails,
  recommendSignatureMode
};
