/**
 * Nirath 布景模板库 v1.0
 * 基于10大圣经场景，细化为电影级布景参数
 * @module scenic-templates
 */

const SCENIC_TEMPLATES = {
  // ===== 不周山脉 =====
  volcanic_ridge: {
    bibleScene: '不周山脉',
    baseDescription: '超级火山带与地壳裂缝地貌，岩浆通道在 translucent 岩层下发光',
    materialPalette: ['rock_volcanic', 'mineral_igneous', 'thermal_crystal'],
    ecologyRules: ['耐高温孢子蕨从岩缝喷出', '岩浆通道光晕照亮局部植被', '磁性尘埃随热流上升'],
    lightSignature: 'Aurelius暖金光穿透火山灰形成金色通路，Silvana清冷光被热扰动折射',
    depthDefault: {
      foreground: '风化火山岩断层，磁铁矿脉呈淡蓝紫色纹路',
      midground: '岩浆通道半透岩层下橙红光芒脉动',
      background: '超级火山口剪影，双恒星低垂',
      sky: '火山灰与磁场极光混合，呈金紫交织光晕'
    }
  },

  // ===== 青丘灵原 =====
  spore_forest: {
    bibleScene: '青丘灵原',
    baseDescription: '低重力草原生态，巨型纤维素植株与漂浮孢子群',
    materialPalette: ['vegetation_cellulose', 'spore_cloud', 'moss_bioluminescent'],
    ecologyRules: ['孢子群漂浮如萤火，密度1200/cm³', '荧光苔藓地毯覆盖地面', '微小气游生物穿梭孢子间'],
    lightSignature: 'Aurelius光束穿透孢子群形成丁达尔金色通路，Silvana清冷光下孢子呈银白闪烁',
    depthDefault: {
      foreground: '荧光苔藓地毯，踩踏时产生绿色荧光涟漪',
      midground: '巨型纤维素茎干，半透明表皮下叶绿磁脉可见',
      background: '孢子森林深层，生物荧光点阵如星海',
      sky: '孢子云与双恒星光芒混合，呈玫瑰金雾霭'
    }
  },

  // ===== 归墟之海 =====
  abyssal_luminara: {
    bibleScene: '归墟之海',
    baseDescription: '深海高压环境，金属盐水与生物荧光群',
    materialPalette: ['water_metal_saline', 'crystal_deepsea', 'sediment_pressure'],
    ecologyRules: ['深海生物荧光群呈集群脉动', '压力气泡缓慢上升破裂', '底栖发光毯覆盖海床'],
    lightSignature: '上方双星光折射入深海，呈金紫分色光谱，生物荧光补充冷色调',
    depthDefault: {
      foreground: '金属盐液滴悬浮成缓慢球体，折射分色光谱',
      midground: '深海水晶质沉积柱，生物荧光附生',
      background: '深渊暗部被生物荧光毯照亮，呈蓝绿幽光',
      sky: '上方海面光锥穿透，形成金色垂直通路'
    }
  },

  // ===== 幽冥地下海 =====
  magnetic_bog: {
    bibleScene: '幽冥地下海',
    baseDescription: '磁化沼泽，液态汞珠悬浮，厌氧发光菌群',
    materialPalette: ['mud_magnetic', 'mercury_bead', 'slime_bioluminescent'],
    ecologyRules: ['磁悬浮液态汞珠反重力漂浮', '厌氧菌群发出幽绿脉冲光', '磁化淤泥表面形成波纹图案'],
    lightSignature: '无直接恒星光照，依赖菌群生物荧光与磁场可见光晕',
    depthDefault: {
      foreground: '磁化淤泥表面，磁场波纹呈几何图案',
      midground: '液态汞珠悬浮，反射菌群绿光呈银绿闪烁',
      background: '地下洞穴岩壁，厌氧菌毯呈幽绿脉动',
      sky: '洞穴顶部裂隙透入微弱双星光，呈细长三角光束'
    }
  },

  // ===== 汤谷扶桑 =====
  eternal_dawn: {
    bibleScene: '汤谷扶桑',
    baseDescription: '永恒晨雾带，焦木硅化森林，光敏孢子爆发',
    materialPalette: ['wood_silica', 'mist_magnetic', 'ash_thermal'],
    ecologyRules: ['焦木表面硅化纹理反光', '光敏孢子随光照强度爆发释放', '耐热藤蔓缠绕焦木生长'],
    lightSignature: '永恒低角度双星光，如同地球清晨5:30，一切被玫瑰金光芒染色',
    depthDefault: {
      foreground: '焦木硅化表面，晨露呈金色液滴缓慢滑落',
      midground: '永恒火焰森林，树干内部暗红余烬脉动',
      background: '晨雾层中巨型扶桑树轮廓，双恒星从其后方升起',
      sky: '晨雾与磁场极光混合，呈淡玫瑰金与蓝紫渐变'
    }
  },

  // ===== 昆仑悬境 =====
  floating_archipelago: {
    bibleScene: '昆仑悬境',
    baseDescription: '反重力悬浮群岛，瀑布逆流，气生根系从上方垂落',
    materialPalette: ['rock_antigravity', 'root_aerial', 'water_upflow'],
    ecologyRules: ['悬浮植物岛独立生态系统', '空游生物群在岛间穿梭', '瀑布水滴反重力上升形成水雾'],
    lightSignature: 'Silvana清冷光主照明，Aurelius暖金从下方反射形成异常光影',
    depthDefault: {
      foreground: '悬浮岩块边缘，气生根系垂落飘动',
      midground: '瀑布逆流，水滴反重力上升形成银色雾带',
      background: '远处悬浮群岛层叠，生物荧光点缀如空中星海',
      sky: '上方天空与下方云海镜像对称，双恒星在两处同时可见'
    }
  },

  // ===== 涿鹿战场 =====
  ancient_ruins: {
    bibleScene: '涿鹿战场',
    baseDescription: '远古战争遗迹，化石化巨型构造，共生侵蚀纹理',
    materialPalette: ['ruin_fossilized', 'scar_energy', 'dust_magnetic'],
    ecologyRules: ['侵略性共生植物侵蚀遗迹表面', '磁性尘埃在遗迹间形成漩涡', '微小六足生物群在尘埃中觅食'],
    lightSignature: '双恒星从遗迹几何间隙透射，形成戏剧性光束与浓重阴影',
    depthDefault: {
      foreground: '风化基岩断层，磁丝藤蔓垂挂',
      midground: '远古几何门柱，共生侵蚀纹理清晰',
      background: '遗迹阵列延伸，双恒星低垂地平线',
      sky: '磁场极光与遗迹尘埃混合，呈淡蓝紫漩涡'
    }
  },

  // ===== 蓬莱迷雾 =====
  misty_archipelago: {
    bibleScene: '蓬莱迷雾',
    baseDescription: '磁场雾滴群岛，海市蜃楼折射层，雾中发光生物',
    materialPalette: ['mist_droplet', 'island_porous', 'illusion_refract'],
    ecologyRules: ['雾滴中发光水母状生物漂浮', '海市蜃楼产生多重岛屿虚像', '雾中声波通道可见为波纹'],
    lightSignature: '双星光被雾滴折射扩散，无明确光源点，整体呈柔和金紫漫射',
    depthDefault: {
      foreground: '雾滴在近景形成微透镜效果，局部放大背景',
      midground: '真实岛屿与海市蜃楼虚像交叠',
      background: '雾中岛屿剪影层叠，距离感模糊',
      sky: '雾与天空融为一体，双恒星呈柔和光晕而非明确圆盘'
    }
  },

  // ===== 星门祭坛 =====
  energy_nexus: {
    bibleScene: '星门祭坛',
    baseDescription: '几何精准远古构造，能量灼烧痕迹，离子风效应',
    materialPalette: ['construct_geometric', 'burn_energy', 'wind_ionic'],
    ecologyRules: ['能量寄生植物在灼烧痕中生长', '离子风使孢子定向飘移形成光带', '磁场线在几何顶点汇聚可见'],
    lightSignature: '能量残余发出低强度幽光，与双星光混合形成非自然色温',
    depthDefault: {
      foreground: '几何构造基部，能量灼烧硅化纹理',
      midground: '星门祭坛主体，磁场线在顶点汇聚呈淡蓝紫',
      background: '远古构造阵列，能量寄生植物点缀幽光',
      sky: '能量场与磁场极光叠加，呈不规则脉动光带'
    }
  },

  // ===== 盘古之脊 =====
  primordial_spine: {
    bibleScene: '盘古之脊',
    baseDescription: '生命起源地质带，层理超清晰沉积岩，矿物结晶带',
    materialPalette: ['sediment_layered', 'crystal_mineral', 'fluid_primitive'],
    ecologyRules: ['原始单细胞发光毯覆盖地表', '地质活跃区热液喷口发光', '矿物结晶生长过程缓慢可见'],
    lightSignature: '双星光在层理岩面上产生条纹状光影，矿物结晶折射彩虹色',
    depthDefault: {
      foreground: '层理沉积岩面，矿物结晶点缀呈彩虹反光',
      midground: '原始发光毯覆盖地表，随磁场脉动明暗',
      background: '地质活跃区热液喷口，低强度橙红光芒',
      sky: '层理山脉剪影与双恒星交叠，如远古书页翻开'
    }
  }
};

// 场景别名映射（用于从 shot.scene 匹配模板）
const SCENE_ALIAS_MAP = {
  '不周': 'volcanic_ridge',
  '火山': 'volcanic_ridge',
  '青丘': 'spore_forest',
  '草原': 'spore_forest',
  '灵原': 'spore_forest',
  '归墟': 'abyssal_luminara',
  '深海': 'abyssal_luminara',
  '幽冥': 'magnetic_bog',
  '沼泽': 'magnetic_bog',
  '地下': 'magnetic_bog',
  '汤谷': 'eternal_dawn',
  '扶桑': 'eternal_dawn',
  '昆仑': 'floating_archipelago',
  '悬浮': 'floating_archipelago',
  '涿鹿': 'ancient_ruins',
  '废墟': 'ancient_ruins',
  '战场': 'ancient_ruins',
  '蓬莱': 'misty_archipelago',
  '迷雾': 'misty_archipelago',
  '星门': 'energy_nexus',
  '祭坛': 'energy_nexus',
  '盘古': 'primordial_spine',
  '脊': 'primordial_spine'
};

module.exports = { SCENIC_TEMPLATES, SCENE_ALIAS_MAP };
