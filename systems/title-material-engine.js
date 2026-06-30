/**
 * 片头质感引擎 v1.0（通用模块）
 * 迪士尼/皮克斯级别质感标准库
 * 适用于所有山海经系列片头
 */

const MATERIAL_CONSTRAINTS = {
  // 毛发材质（九尾狐、白泽等有毛角色）
  fur: {
    type: '次表面散射毛发',
    description: '每根毛发独立几何体渲染，次表面散射SSS，皮下血管隐约可见',
    colorGradient: '根部深色渐变到尖端亮色',
    microstructure: '毛鳞片结构在微距下可见',
    lighting: '轮廓光勾勒毛发边缘，主光源产生体积感',
    examples: {
      nineTailedFox: '根部象牙白渐变到尖端银白色，九条尾巴各有独立毛流动态',
      baiZe: '纯白色神圣毛发，带有淡金色光泽，毛发如丝绸般顺滑'
    }
  },

  // 火焰材质（九尾狐尾巴、烛龙等）
  flame: {
    type: '等离子体体积火焰',
    description: '等离子体体积渲染，核心高色温，边缘渐变',
    coreTemp: '12000K（白热）',
    edgeTemp: '8000K（靛蓝）',
    volumetricScattering: '体积光散射，粒子密度每立方厘米10^15个',
    physics: '受气流影响产生湍流，热上升气流带动火焰飘动',
    examples: {
      nineTailedFlame: '淡蓝色火焰，核心白色，边缘靛蓝色，尾巴挥动时火焰拖尾',
      zhuLongEye: '赤红色永恒火焰，从眼睛中喷射，温度极高产生热浪扭曲'
    }
  },

  // 水面材质（瀑布、河流、湖泊）
  water: {
    type: '菲涅尔反射水体',
    description: '物理真实水面，菲涅尔反射，焦散光斑',
    ior: '折射率1.333',
    surfaceTension: '表面张力72mN/m',
    flowSpeed: '水流速度根据场景调整（瀑布3m/s，河流1m/s，静止水面0m/s）',
    caustics: '焦散光斑在河床/湖底形成',
    examples: {
      waterfall: '湍急水流，白色泡沫，撞击岩石产生水雾，彩虹折射',
      stillLake: '如镜水面，完美倒影，涟漪从中心扩散',
      river: '流动水面，水草飘动，石头周围产生小漩涡'
    }
  },

  // 岩石/地质材质（悬崖、洞穴、山脉）
  rock: {
    type: '真实地质材质',
    description: '基于真实岩石类型的材质',
    hardness: '莫氏硬度根据岩石类型',
    weathering: '表面风化纹理，裂缝，氧化痕迹',
    mineralInclusions: '内部矿物包裹体可见',
    examples: {
      basalt: '玄武岩柱状节理，深灰色，含铁氧化物呈现褐色纹理',
      crystal: '紫水晶六方晶系，折射率1.544-1.553，内部包裹体',
      sandstone: '砂岩层理结构，风化产生金黄色表面'
    }
  },

  // 发光生物材质（发光苔藓、荧光植物）
  bioluminescent: {
    type: '生物荧光材质',
    description: '基于真实生物荧光机制',
    mechanism: '荧光素酶反应或发光细菌',
    colorTemp: '色温4800K-6500K根据物种',
    intensity: '发光强度0.1-2.0流明',
    microstructure: '微观菌丝/细胞结构可见',
    examples: {
      moss: '蓝绿色荧光苔藓，菌丝网络在微距下如神经网络',
      spore: '发光孢子颗粒，空气中飘浮如萤火虫',
      flower: '荧光花朵，花瓣半透明，花蕊发光'
    }
  },

  // 金属材质（银色树木、金属矿石）
  metal: {
    type: '物理真实金属',
    description: '基于真实金属属性',
    reflectivity: '反射率根据金属类型',
    roughness: '表面粗糙度控制高光形状',
    oxidation: '氧化层/锈迹',
    examples: {
      silverTree: '银色树皮，高反射率，如镜面反射环境',
      goldOre: '金矿自然形态，与岩石混合，金色斑点',
      meteorite: '陨铁，表面熔融纹理，金属光泽'
    }
  },

  // 大气/雾气材质
  atmosphere: {
    type: '体积大气',
    description: '真实大气散射',
    scattering: '瑞利散射+米氏散射',
    density: '粒子密度根据海拔和湿度',
    color: '晨昏时金色，正午时淡蓝，夜间深蓝',
    examples: {
      morningMist: '晨雾，低处浓高处淡，金色阳光穿透',
      cloudLayer: '云层，蓬松体积，边缘受光产生金边',
      aurora: '极光，带电粒子激发，绿色/紫色光带流动'
    }
  }
};

/**
 * 获取材质约束描述
 * @param {string} materialType - 材质类型
 * @param {string} variant - 变体名称
 * @returns {string} 材质描述文本
 */
function getMaterialConstraint(materialType, variant) {
  const material = MATERIAL_CONSTRAINTS[materialType];
  if (!material) return '';

  let description = `【${material.type}】`;
  description += `${material.description}。`;

  if (material.ior) description += `折射率${material.ior}。`;
  if (material.coreTemp) description += `核心色温${material.coreTemp}。`;
  if (material.hardness) description += `莫氏硬度${material.hardness}。`;

  if (variant && material.examples[variant]) {
    description += `具体表现：${material.examples[variant]}。`;
  }

  return description;
}

/**
 * 生成完整Prompt材质段
 * @param {Array<{type, variant}>} materials - 材质列表
 * @returns {string} 完整材质描述
 */
function generateMaterialSection(materials) {
  return materials.map(m => getMaterialConstraint(m.type, m.variant)).join('\n');
}

/**
 * Prompt字数检查器
 * @param {string} prompt - 当前Prompt
 * @param {number} targetLength - 目标字数（默认950）
 * @returns {Object} 检查结果
 */
function checkPromptLength(prompt, targetLength = 1470) {
  const currentLength = prompt.length;
  const maxLength = 1500;

  return {
    current: currentLength,
    target: targetLength,
    max: maxLength,
    status: currentLength >= targetLength ? '✅ 达标' : `⚠️ 还需${targetLength - currentLength}字`,
    suggestion: currentLength < targetLength
      ? `建议补充：材质细节、光影参数、物理约束`
      : 'Prompt已打满，质感有保障'
  };
}

module.exports = {
  MATERIAL_CONSTRAINTS,
  getMaterialConstraint,
  generateMaterialSection,
  checkPromptLength
};
