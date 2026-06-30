/**
 * 出品人信息模块 v1.0（通用模块）
 * 统一处理片头底部出品人/制作信息
 */

const PRODUCER_DISPLAY_MODES = {
  // 方式1：水面倒影（增强版 - 字体放大）
  waterReflection: {
    name: '水面倒影',
    description: '出品人信息通过水面倒影呈现，字体更大更清晰',
    effect: '标题落入水面后，水面平静，底部浮现出品人信息，字体占据画面底部30%高度',
    material: '菲涅尔反射水面，折射率1.333，倒影清晰但略有扭曲，字体为大号粗体',
    timing: '标题完全呈现后2秒，水面涟漪平息，倒影浮现',
    font: '字体尺寸：画面底部30%高度，粗体，字重bold，清晰可见',
    visualWeight: '出品人信息视觉权重 = 标题的80%，不可忽略',
    examples: {
      byGenius: '水面倒影显示大号 "by genius"，字体占据底部30%，粗体清晰可见，如水中墨迹般晕开但仍保持清晰可读',
      producedBy: '倒影显示大号 "Produced by Nirath Studio"，底部30%高度'
    }
  },

  // 方式2：岩石刻痕
  rockCarving: {
    name: '岩石刻痕',
    description: '出品人信息如古老刻痕般在岩石上显现',
    effect: '岩石表面风化纹理中，隐约浮现刻痕',
    material: '玄武岩/砂岩表面，刻痕深度2-3mm，内有荧光物质',
    timing: '标题呈现后，镜头下移或缩放，岩石细节显现',
    examples: {
      byGenius: '岩石上古老刻痕 "by genius"，如千年铭文',
      studio: '刻痕显示 "Nirath Studio"，边缘有苔藓覆盖'
    }
  },

  // 方式3：光粒子排列
  lightParticles: {
    name: '光粒子排列',
    description: '发光粒子自然排列成出品人信息',
    effect: '地面发光苔藓/孢子汇聚成文字',
    material: '生物荧光粒子，色温4800K，发光强度0.5流明',
    timing: '标题呈现同时，底部粒子开始汇聚',
    examples: {
      byGenius: '苔藓组成 "by genius"，如地面星空',
      createdBy: '孢子排列成 "Created by Genius"'
    }
  },

  // 方式4：雾气形成
  mistFormation: {
    name: '雾气形成',
    description: '水雾/云雾自然形成出品人信息',
    effect: '底部雾气升起，在特定光线下显现文字',
    material: '水雾粒子，密度根据湿度调整',
    timing: '标题呈现后，底部雾气缓慢升起',
    examples: {
      byGenius: '雾气中显现 "by genius"，若隐若现',
      studio: '云雾中 "Nirath Studio" 如仙境题词'
    }
  },

  // 方式5：金属铭牌
  metalPlate: {
    name: '金属铭牌',
    description: '金属质感的出品人铭牌',
    effect: '一块金属铭牌从画面边缘滑入或从地面升起',
    material: '黄铜/银质铭牌，表面拉丝纹理，边缘倒角',
    timing: '标题完全呈现后，铭牌缓缓出现',
    examples: {
      byGenius: '银色金属铭牌 "by genius"，反光清晰',
      studio: '黄铜铭牌 "Nirath Studio"，复古质感'
    }
  }
};

/**
 * 生成出品人信息Prompt
 * @param {string} producerText - 出品人文字（如 "by genius"）
 * @param {string} displayMode - 显示方式
 * @returns {string} 出品人信息描述
 */
function generateProducerPrompt(producerText, displayMode = 'waterReflection') {
  const mode = PRODUCER_DISPLAY_MODES[displayMode];
  if (!mode) return '';

  let prompt = `【出品人信息 - ${mode.name}】\n`;
  prompt += `${mode.effect}\n`;
  prompt += `材质：${mode.material}\n`;
  prompt += `时机：${mode.timing}\n`;
  if (mode.font) {
    prompt += `字体规格：${mode.font}\n`;
  }
  if (mode.visualWeight) {
    prompt += `视觉权重：${mode.visualWeight}\n`;
  }
  prompt += `内容："${producerText}"\n`;
  prompt += `【出品人强调】出品人信息 "${producerText}" 必须清晰可见，字体占据画面底部30%高度，不可过小或模糊。这是创作者署名，视觉权重等同于标题的80%。\n`;

  return prompt;
}

/**
 * 获取所有显示方式
 * @returns {Array} 显示方式列表
 */
function getDisplayModes() {
  return Object.entries(PRODUCER_DISPLAY_MODES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description
  }));
}

module.exports = {
  PRODUCER_DISPLAY_MODES,
  generateProducerPrompt,
  getDisplayModes
};
