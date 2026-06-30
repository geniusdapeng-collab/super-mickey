/**
 * Nirath 材质纹理库 v1.0
 * 为布景设计提供超写实材质描述，禁止塑料/CG感
 * @module material-library
 */

const MATERIAL_LIBRARY = {
  // ===== 岩石类 =====
  rock_volcanic: {
    base: '风化玄武岩表面，层理构造清晰',
    detail: '磁铁矿脉呈淡蓝紫色可见纹路，矿物结晶点缀',
    weathering: '热液蚀变痕迹，表面覆盖磁性孢子花粉产生微弱虹彩光泽',
    light_reaction: 'Aurelius暖金光下呈玫瑰金反光，Silvana清冷光下呈银灰高光',
    banned: '禁止塑料质感、禁止CG平滑、禁止均匀着色、禁止人工切割痕迹'
  },
  
  rock_sediment: {
    base: '层理沉积岩面，地质年代纹清晰可见',
    detail: '矿物结晶带呈彩虹色折射，风化微起伏自然不规则',
    weathering: '侵蚀沟槽中积聚磁性尘埃，形成淡蓝紫色填色线条',
    light_reaction: '双恒星光线在层理面上产生条纹状光影',
    banned: '禁止塑料质感、禁止CG平滑、禁止均匀纹理'
  },
  
  rock_antigravity: {
    base: '反重力悬浮岩块，断裂面新鲜裸露',
    detail: '断面可见内部气孔结构，矿物填充呈金属光泽',
    weathering: '悬浮导致风化模式异常，底部风化程度高于顶部',
    light_reaction: 'Silvana清冷光主照明，Aurelius暖金从下方反射形成异常光影',
    banned: '禁止塑料质感、禁止CG平滑'
  },
  
  ruin_fossilized: {
    base: '化石化远古构造，几何精度与自然侵蚀共存',
    detail: '表面硅化纹理，能量灼烧痕呈玻璃质光泽',
    weathering: '共生侵蚀纹理——植物根须与岩石相互替代边界清晰',
    light_reaction: '双星光从几何间隙透射，形成戏剧性光束',
    banned: '禁止塑料质感、禁止CG平滑、禁止人工新造痕迹'
  },
  
  construct_geometric: {
    base: '几何精准远古构造，尺度超越自然形成',
    detail: '接缝处矿物填充，表面覆盖能量灼烧硅化层',
    weathering: '长期磁暴侵蚀形成的微观坑洞阵列',
    light_reaction: '能量残余发出低强度幽光，与双星光混合形成非自然色温',
    banned: '禁止塑料质感、禁止现代建筑材料感'
  },

  // ===== 植被类 =====
  vegetation_cellulose: {
    base: '纤维素-木质素复合茎干，抗拉强度超越碳纤维',
    detail: '半透明表皮下可见叶绿磁脉，孢子囊呈几何排列',
    ecology: '低重力下生长高度远超地球同类，顶部孢子囊随风向倾斜',
    light_reaction: '双恒星光照下产生虹彩干涉，磁场脉冲触发顶部荧光释放',
    banned: '禁止地球标准绿叶、禁止均匀绿色、禁止卡通植物、禁止标准树木形态'
  },
  
  moss_bioluminescent: {
    base: '生物荧光苔藓地毯，踩踏产生荧光涟漪',
    detail: '菌丝网络在苔藓层下形成发光脉络',
    ecology: '覆盖所有岩石表面，确保无裸露死寂区域',
    light_reaction: 'Aurelius暖金光下呈翠绿荧光，Silvana清冷光下呈蓝白荧光',
    banned: '禁止地球标准苔藓、禁止均匀绿色'
  },
  
  root_aerial: {
    base: '气生根系，无土壤悬浮生长',
    detail: '根尖分泌粘性物质捕获大气孢子作为养分',
    ecology: '从悬浮岛屿边缘垂落，随离子风飘动',
    light_reaction: '半透明根壁内可见养分运输荧光脉动',
    banned: '禁止地球标准树根、禁止深扎土壤描述'
  },
  
  wood_silica: {
    base: '焦木硅化表面，高温转化形成的玻璃质纹理',
    detail: '内部暗红余烬脉动，表面裂纹中渗出硅化物',
    ecology: '耐热藤蔓缠绕生长，形成焦木-藤蔓复合结构',
    light_reaction: 'Silvana清冷光下呈银黑反光，Aurelius暖金光穿透裂纹呈橙红',
    banned: '禁止地球标准木材、禁止燃烧后灰烬感'
  },

  // ===== 水体类 =====
  water_metal_saline: {
    base: '高密度金属盐液，低表面张力',
    detail: '0.82G低重力下形成缓慢悬浮球体，折射双星光呈分色光谱',
    ecology: '微生物群在液面形成彩虹色油膜',
    light_reaction: '磁场作用下液面产生规则波纹图案，双星光下呈金属光泽',
    banned: '禁止地球标准蓝色水面、禁止无来源反光、禁止清澈透明'
  },
  
  mercury_bead: {
    base: '液态汞珠，反重力悬浮',
    detail: '表面张力形成完美球体，反射环境光呈银绿闪烁',
    ecology: '磁悬浮汞珠群中偶有微小生物寄生',
    light_reaction: '反射菌群绿光与双星光，呈动态银绿金三色交替',
    banned: '禁止地球标准水滴、禁止简单透明'
  },

  // ===== 大气/特效类 =====
  spore_cloud: {
    base: '1200/cm³以太孢子缓慢漂浮',
    detail: '大气折射率1.00045产生微弱光晕，孢子群随磁场线漂移',
    ecology: '孢子群密度随磁场脉冲周期性变化',
    light_reaction: 'Aurelius光束穿透时形成丁达尔效应，呈金色通路；Silvana光下呈银白闪烁',
    banned: '禁止均匀雾、禁止无介质发光、禁止粒子特效感'
  },
  
  mist_magnetic: {
    base: '磁场雾滴，每个雾滴内含磁性微粒',
    detail: '雾滴在近景形成微透镜效果，局部放大背景',
    ecology: '雾滴中发光水母状生物漂浮，声波通道可见为波纹',
    light_reaction: '双星光被雾滴折射扩散，整体呈柔和金紫漫射',
    banned: '禁止均匀雾、禁止地球标准云海'
  },
  
  dust_magnetic: {
    base: '磁性尘埃，随风与磁场力共同运动',
    detail: '尘埃颗粒在遗迹间形成漩涡，微小六足生物在其中觅食',
    ecology: '尘埃沉积层为底层生态系统提供基质',
    light_reaction: '双星光下呈金色悬浮雾霭，局部浓集处呈暗金色',
    banned: '禁止地球标准沙尘、禁止无生命尘埃'
  }
};

// 光照反应速查表（根据双恒星状态自动生成材质光影描述）
const LIGHT_REACTION_GUIDE = {
  aurelius_dominant: 'Aurelius金色5800K主照明，表面呈暖金玫瑰色调，阴影区域被Silvana6500K填充为淡紫',
  silvana_dominant: 'Silvana银白6500K主照明，表面呈清冷银灰，高光处被Aurelius5800K点缀为金边',
  balanced: '双恒星均衡照明，表面呈中性白，边缘同时反射金与银双色高光',
  magnetic_glow: '磁场极光主导，表面被淡蓝紫光晕覆盖，矿物结晶发出次级荧光',
  bioluminescent: '生物荧光主导，表面呈现有机绿色/蓝色/紫色光脉，与恒星光照混合产生非自然色温'
};

// 快速材质组合器（根据层位和光照条件生成材质描述）
function composeMaterial(materialKeys, lightState, maxLength = 60) {
  const parts = [];
  materialKeys.forEach(key => {
    const mat = MATERIAL_LIBRARY[key];
    if (mat) {
      parts.push(mat.base);
      if (mat.detail) parts.push(mat.detail);
    }
  });
  
  let result = parts.join('，');
  
  // 添加光照反应
  const lightDesc = LIGHT_REACTION_GUIDE[lightState];
  if (lightDesc) {
    result += `。${lightDesc}`;
  }
  
  // 裁剪到指定长度
  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3) + '...';
  }
  
  return result;
}

module.exports = { MATERIAL_LIBRARY, LIGHT_REACTION_GUIDE, composeMaterial };
