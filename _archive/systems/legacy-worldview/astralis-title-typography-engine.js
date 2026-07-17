/**
 * ASTRALIS TITLE TYPOGRAPHY ENGINE — Nirath Title Font Design System
 * ASTRALIS v3.0-patch1
 * 
 * Controls how title text appears in Nirath openings:
 * - Typography style (elegant, geometric, fluid)
 * - Material manifestation (how letters form from Nirath substances)
 * - Surface texture (mirror, crystalline, fluid dynamic)
 * - Lighting interaction (dual-star illumination effects)
 * - 3D presence (depth, thickness, magnetic connections)
 * 
 * @module astralis-title-typography-engine
 * @version 1.0
 */

// ─────────────────────────────────────────
// Title Typography Style Definitions
// ─────────────────────────────────────────

const TYPOGRAPHY_STYLES = {
  elegant: {
    name: '优雅纤细',
    description: '字体纤细优雅，笔画如磁流体拉丝，边缘有磁场干涉产生的微光晕',
    characteristics: [
      '笔画宽度均匀纤细，如同精密仪器刻制',
      '字母间距略宽，营造呼吸感',
      '衬线部分呈现磁流体凝固的滴落形态',
      '整体气质：精密、优雅、未来感'
    ],
    forbidden: ['粗旷', '笨重', '卡通化', '圆润可爱', '过于装饰']
  },
  
  geometric: {
    name: '几何切割',
    description: '字体由几何切面构成，如水晶沿磁向生长形成的自然切面',
    characteristics: [
      '字母由多个平面切面拼接而成',
      '切面交接处有磁流体填充的细线',
      '棱角分明但不过于锐利',
      '整体气质：科技、精准、结构感'
    ],
    forbidden: ['有机曲线', '手写感', '自然流动']
  },
  
  fluid: {
    name: '流体边缘',
    description: '字体边缘呈现磁流体的微观流动，永恒动态但形态稳定',
    characteristics: [
      '字母轮廓有极细微的流动纹理',
      '如磁流体在磁场中维持的稳态形状',
      '表面有永恒的微观涟漪',
      '整体气质：动态稳定、有机科技'
    ],
    forbidden: ['完全静态', '生硬直线', '无纹理']
  }
};

// ─────────────────────────────────────────
// Title Material Manifestation
// ─────────────────────────────────────────

const MATERIAL_MANIFESTATIONS = {
  ferroflux: {
    formation: '磁流体在强磁场中冷凝成型，每个字母都是从等离子态冷却的金属',
    surface: '镜面级反射率98.5%，表面有凝固纹理、气泡痕迹、流痕等真实相变痕迹',
    dynamics: '字母表面有永恒的微观流动，磁场线穿过产生丝状发光轨迹',
    dualStar: 'Aurelius金光下暖铜色底色配紫红干涉边缘，Silvana银白光下冷钢色配青蓝干涉边缘',
    edges: '边缘有磁场干涉产生的微光晕，不是锐利切割而是物理相变的自然过渡'
  },
  
  plasmaTendril: {
    formation: '等离子触须编织成字母形状，根部量子青向尖端圣光白渐变',
    surface: '表面是30Hz磁场束缚的发光等离子体，有微微的脉动感',
    dynamics: '字母内部有能量流动的视觉，如触须末端的能量涌动',
    dualStar: '双恒星照射下呈现双色能量梯度，暖区偏金紫，冷区偏银蓝',
    edges: '边缘有等离子体逸散的微光，如火焰但受控于磁场'
  },
  
  quantumMoss: {
    formation: '量子苔藓沿标题笔画生长，菌丝网络电脉冲逐节点点亮',
    surface: '表面覆盖着量子苔藓的微观纹理，如精密的电路板但有机',
    dynamics: '苔藓网络的电脉冲在字母表面流动，形成4800K青绿荧光的动态图案',
    dualStar: '双星光下苔藓呈现不同的荧光响应，金色光下偏暖绿，银白光下偏冷翠',
    edges: '边缘有苔藓自然生长的细微不规则，如生物组织的边界'
  },
  
  voidSilk: {
    formation: '虚空丝在磁场中对齐编织成字母，10纳米丝线组成宏观字形',
    surface: '表面呈现丝绸般的微观编织纹理，30Hz光脉冲在丝间流动',
    dynamics: '字母内部的虚空丝网络有微弱的振动，如星球心跳',
    dualStar: '双星光照射下编织丝呈现不同的干涉色，暖光偏紫微，冷光偏蓝白',
    edges: '边缘有丝线发散的细微毛羽，如高级织物的自然毛边'
  }
};

// ─────────────────────────────────────────
// Title 3D Presence Design
// ─────────────────────────────────────────

const TITLE_3D_PRESENCE = {
  thickness: '字母具有实体厚度（约画面高度的3-5%），呈现立体体积感而非平面贴图',
  
  magneticConnections: '字母之间有磁丝连接，形成磁场网络的一部分，磁丝有淡紫蓝色发光',
  
  spatialDepth: '标题整体悬浮于Nirath环境中，有明确的前后景深关系，不是贴在画面上的',
  
  environmentalInteraction: '标题表面反射周围环境（孢子、磁场线、双恒星光芒），与场景融为一体',
  
  shadowAndGlow: '标题投射微弱的磁场偏折阴影（不是普通黑影，而是光线偏折产生的暗区），同时边缘有双恒星光照产生的双色光晕'
};

// ─────────────────────────────────────────
// Typography Generator Functions
// ─────────────────────────────────────────

/**
 * Generate complete title typography description
 * @param {string} titleText - The title text
 * @param {string} materialType - Material key (ferroflux, plasmaTendril, etc.)
 * @param {string} style - Typography style (elegant, geometric, fluid)
 * @returns {string} Complete typography prompt section
 */
function generateTitleTypography(titleText, materialType = 'ferroflux', style = 'elegant') {
  const mat = MATERIAL_MANIFESTATIONS[materialType] || MATERIAL_MANIFESTATIONS.ferroflux;
  const sty = TYPOGRAPHY_STYLES[style] || TYPOGRAPHY_STYLES.elegant;
  
  let result = `【ASTRALIS标题字体设计】\n`;
  
  // Typography style
  result += `字体风格：${sty.name}。${sty.description}。`;
  result += `特征：${sty.characteristics.join('；')}。`;
  result += `禁止：${sty.forbidden.join('、')}。\n\n`;
  
  // Material manifestation
  result += `材质显化：${mat.formation}。`;
  result += `表面：${mat.surface}。`;
  result += `动态：${mat.dynamics}。`;
  result += `双星光照：${mat.dualStar}。`;
  result += `边缘：${mat.edges}。\n\n`;
  
  // 3D presence
  result += `立体呈现：`;
  result += `厚度：${TITLE_3D_PRESENCE.thickness}。`;
  result += `连接：${TITLE_3D_PRESENCE.magneticConnections}。`;
  result += `景深：${TITLE_3D_PRESENCE.spatialDepth}。`;
  result += `互动：${TITLE_3D_PRESENCE.environmentalInteraction}。`;
  result += `光影：${TITLE_3D_PRESENCE.shadowAndGlow}。\n`;
  
  return result;
}

/**
 * Generate compressed title typography (for production prompts)
 * @param {string} titleText 
 * @param {string} materialType 
 * @param {string} style 
 * @returns {string} Compressed version
 */
function generateCompressedTitleTypography(titleText, materialType = 'ferroflux', style = 'elegant') {
  const sty = TYPOGRAPHY_STYLES[style] || TYPOGRAPHY_STYLES.elegant;
  
  return `标题"${titleText}"采用${sty.name}字体风格——${sty.description.substring(0, 30)}，` +
    `笔画纤细优雅边缘有磁场干涉微光晕，字母有3-5%画面高度实体厚度，` +
    `字母间有磁丝连接形成淡紫蓝色发光网络，表面镜面反射双恒星双色干涉纹，` +
    `与Nirath环境融为一体不是平面贴图。`;
}

/**
 * Get typography style list
 * @returns {Array} Available styles
 */
function getTypographyStyles() {
  return Object.entries(TYPOGRAPHY_STYLES).map(([key, style]) => ({
    key,
    name: style.name,
    description: style.description
  }));
}

/**
 * Get material manifestation list
 * @returns {Array} Available material manifestations
 */
function getMaterialManifestations() {
  return Object.entries(MATERIAL_MANIFESTATIONS).map(([key, mat]) => ({
    key,
    surface: mat.surface.substring(0, 40) + '...'
  }));
}

module.exports = {
  TYPOGRAPHY_STYLES,
  MATERIAL_MANIFESTATIONS,
  TITLE_3D_PRESENCE,
  generateTitleTypography,
  generateCompressedTitleTypography,
  getTypographyStyles,
  getMaterialManifestations
};
