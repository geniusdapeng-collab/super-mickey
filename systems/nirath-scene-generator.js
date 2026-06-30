/**
 * Nirath星球场景自动生成Agent
 * Nirath Scene Auto-Generator Agent
 * 
 * 功能：当场景映射失败时，基于Nirath底层生态逻辑自动生成符合物理法则的场景描述
 * 并将其保存到场景库，供后续使用
 * 
 * v1.0 设计原则：
 * - 严格遵循Nirath物理法则（重力0.82G、磁场3.2Tesla、双恒星等）
 * - 自动生成符合生态逻辑的地貌/水体/植被/大气描述
 * - 自动保存到场景库，下次自动匹配
 * - 不依赖外部LLM，纯规则+模板生成（保证确定性）
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ========== Nirath物理常数 ==========
const NIRATH_PHYSICS = {
  gravity: 0.82,           // 重力（地球倍数）
  magneticField: 3.2,      // 磁场强度（Tesla）
  starA: { name: 'Aurelius', temp: 5800, color: '金色', wavelength: '5800K' },
  starB: { name: 'Silvana', temp: 6500, color: '银白', wavelength: '6500K' },
  orbitalPeriod: 72,       // 双星互绕周期（小时）
  magneticFreq: 30,        // 磁场共振频率（Hz）
  sporeDensity: '中等',    // 以太孢子密度
  floraType: '生物发光植被',
  faunaType: '磁感生物'
};

// ========== 地形类型生态模板 ==========
const TERRAIN_TEMPLATES = {
  // 水体类
  lake: {
    category: '水体',
    gravityEffects: [
      '水面呈现微弱向上弯曲的弧度（低重力效应）',
      '水雾在低重力下缓缓上升形成悬浮水滴云',
      '浪花溅起的高度是地球的1.5倍',
      '水面反射双恒星双色光，形成双色波纹纹理'
    ],
    magneticEffects: [
      '水体中含有微量磁性矿物质，水面下可见淡蓝紫色磁场线',
      '磁场使水面形成规律的同心圆波纹（30Hz共振）',
      '水中微生物受磁场影响呈螺旋状排列'
    ],
    flora: [
      '水边生长磁感芦苇，穗尖发出与磁场同步的脉冲微光',
      '水面漂浮生物发光浮萍，夜间形成星点光斑',
      '水岸覆盖紫色苔藓，在双恒星照射下呈现蓝绿渐变'
    ],
    atmosphere: [
      '水面上方悬浮以太孢子密度较高，形成朦胧光晕',
      '双恒星双色光透过水雾形成彩虹色散条纹',
      '低重力使水蒸气上升缓慢，形成持久的晨雾/暮霭'
    ],
    lighting: {
      primary: '双恒星双色光在水面的镜面反射',
      secondary: '水体内部生物荧光的散射光',
      special: '磁场线与水面交汇处产生淡紫色辉光'
    }
  },
  
  // 山脉类
  mountain: {
    category: '山脉',
    gravityEffects: [
      '山峰高度比地球同类型高20%（低重力允许更陡峭岩壁）',
      '山顶碎石在低重力下形成缓慢漂浮的尘埃带',
      '登山者可以轻松跃起1.5米高度',
      '悬崖边缘可见因低重力而形成的悬空岩石'
    ],
    magneticEffects: [
      '山体富含磁性矿石，表面可见3.2Tesla磁场线呈螺旋状缠绕',
      '磁化岩石在双恒星照射下呈现金属光泽',
      '山体裂缝中透出淡蓝紫色磁光',
      '磁场使山顶云雾呈双螺旋形态（模仿双恒星轨道）'
    ],
    flora: [
      '岩缝中的磁感地衣，在磁场最强处呈现金色荧光',
      '山腰生长柱状水晶树，树干为透明紫晶，内部可见磁场线流动',
      '山顶无植被，但有磁场苔藓形成的发光地毯'
    ],
    atmosphere: [
      '山顶以太孢子密度低，星空清晰可见（双星伴月）',
      '山谷中孢子密度高，形成发光雾带',
      '海拔越高，磁场线越清晰可见（空气稀薄干扰少）'
    ],
    lighting: {
      primary: '5800K金色Aurelius光照射东/南坡，6500K银白Silvana光照射西/北坡',
      secondary: '山体紫晶反射双星双色光，形成棱镜色散',
      special: '磁场线与山体交汇处形成极光般的淡紫/青绿色光幕'
    }
  },
  
  // 平原/草原类
  plain: {
    category: '平原',
    gravityEffects: [
      '草原上的草穗因低重力而显得更为挺拔修长',
      '种子在低重力下可以随风飘行数公里',
      '奔跑时感觉轻盈，跳跃高度明显增加',
      '露珠在低重力下呈更完美的球形'
    ],
    magneticEffects: [
      '草原地下的磁铁矿使草叶尖端微微偏向北方',
      '风吹过草原时，草浪的起伏方向受磁场轻微影响',
      '某些草种含磁性颗粒，在磁场下会调整叶片朝向',
      '草原上可见微弱的磁场线（地面高度1-2米）'
    ],
    flora: [
      '草原主体为双色荧光草（5800K光照下偏金绿，6500K下偏银蓝）',
      '点缀着磁感蒲公英，种子绒毛带有微弱荧光',
      '偶尔可见巨型蘑菇状植物，伞盖下悬挂发光孢子囊',
      '河流/湖泊边缘有磁感芦苇丛'
    ],
    atmosphere: [
      '平原上空以太孢子密度中等，形成薄雾状光带',
      '双恒星光照下，草原呈现金绿/银蓝双色渐变',
      '地平线处可见磁场线汇聚形成的淡紫色极光环'
    ],
    lighting: {
      primary: '5800K/6500K双星直射，草原呈现双色光影交替',
      secondary: '生物发光植被在夜间形成星点/光带',
      special: '磁场线与草叶接触处产生微弱荧光'
    }
  },
  
  // 森林类
  forest: {
    category: '森林',
    gravityEffects: [
      '树冠因低重力而更加舒展宽广，枝叶呈水平展开',
      '落叶缓缓飘落，速度比地球慢30%',
      '藤蔓植物可以生长得更长，横跨数十米',
      '树冠层的孢子云因低重力而悬浮更久'
    ],
    magneticEffects: [
      '树干含磁性树脂，在树皮裂缝中可见磁场线痕迹',
      '森林中某些树木的排列方向受地下磁铁矿影响',
      '树根缠绕磁化岩石，形成天然磁场放大器',
      '林间雾气中的孢子受磁场引导形成光之流'
    ],
    flora: [
      '巨树树干为紫晶化木质，半透明，内部可见年轮般的磁场沉积纹',
      '树叶为蓝绿色，在5800K光照下泛金边，6500K下泛银边',
      '树冠层悬挂发光藤蔓，如瀑布般垂落',
      '地面覆盖发光苔藓地毯，颜色随磁场强度变化（弱=蓝，强=紫）'
    ],
    atmosphere: [
      '林间以太孢子密度极高，形成淡绿色/淡蓝色雾霭',
      '双恒星光线透过树冠形成双色光柱（丁达尔效应）',
      '树冠层阻挡部分光照，地面呈现蓝紫色调',
      '孢子云在树冠间流动，如发光河流'
    ],
    lighting: {
      primary: '双星光线透过树冠层形成双色光柱',
      secondary: '生物发光苔藓/藤蔓提供地面照明',
      special: '磁场线与树干交汇处产生紫晶般的内发光'
    }
  },
  
  // 洞穴/暗域类
  cave: {
    category: '洞穴',
    gravityEffects: [
      '洞穴顶部钟乳石因低重力而生长更细长',
      '洞穴内的水滴悬浮在空中形成微型水球',
      '回声因低重力空气密度差异而略有延迟',
      '洞穴深处可感知轻微的低重力漂浮感'
    ],
    magneticEffects: [
      '洞穴壁富含磁性矿石，表面可见磁场线如静脉般分布',
      '磁场使洞穴内的水滴呈螺旋下落（非常缓慢）',
      '某些洞穴深处磁场强度可达5Tesla，形成"磁涡"',
      '磁化钟乳石发出微弱的蓝紫色磷光'
    ],
    flora: [
      '洞穴入口附近有磁感苔藓，发出与外部光照同步的脉冲光',
      '深处无植被，但有晶体化菌类（菌丝为半透明紫晶）',
      '某些洞穴顶部生长倒挂的磁感蕨类，叶片如帘幕垂下',
      '水潭中漂浮生物发光微生物，形成"星池"'
    ],
    atmosphere: [
      '洞穴内以太孢子密度低，空气相对清澈',
      '深处无自然光，仅靠生物荧光和磁光照明',
      '磁场线在黑暗中清晰可见（如淡紫色溪流）',
      '洞穴入口与外部交界处，孢子形成光之屏障'
    ],
    lighting: {
      primary: '洞穴入口的双星自然光（逐渐衰减）',
      secondary: '生物荧光/磁磷光（洞穴内部主要光源）',
      special: '磁场线在黑暗中发出淡蓝/紫色微光（如地下星河）'
    }
  },
  
  // 悬浮/浮岛类
  floating: {
    category: '悬浮地貌',
    gravityEffects: [
      '浮岛因低重力而可以更大/更薄（厚度/宽度比可达1:100）',
      '浮岛边缘可见碎石因低重力而缓慢脱落漂浮',
      '从浮岛跃起可以体验"慢动作"的滞空感',
      '浮岛之间的跳跃距离因低重力而缩短（可达5-8米）'
    ],
    magneticEffects: [
      '浮岛底部富含反磁性矿物（受磁场排斥而悬浮）',
      '浮岛下方可见磁场线汇聚形成"磁力托举"形态',
      '浮岛之间存在磁场排斥/吸引效应，形成动态平衡',
      '强磁场区域浮岛密度更高，形成"浮岛群"'
    ],
    flora: [
      '浮岛植被根系极浅（低重力不需要深根），向四面八方展开如伞',
      '浮岛边缘生长垂挂植物，藤蔓向下延伸数米',
      '浮岛表面覆盖抗辐射苔藓（高海拔双星辐射更强）',
      '某些浮岛顶部有磁感树冠，形成独立生态孤岛'
    ],
    atmosphere: [
      '浮岛之间以太孢子形成"光之桥梁"连接',
      '从浮岛俯瞰，可见下方云海和磁场线构成的"光之网"',
      '浮岛高度越高，双星光照越强（极光效应更显著）',
      '浮岛间的风因磁场影响呈螺旋状流动'
    ],
    lighting: {
      primary: '双星直射光（无遮挡，比地面强20%）',
      secondary: '浮岛间孢子云反射的散射光',
      special: '浮岛底部磁场线与大气粒子碰撞产生的极光效应'
    }
  },
  
  // 海岸/潮汐类
  coast: {
    category: '海岸',
    gravityEffects: [
      '潮汐高度比地球高25%（低重力+双星引力叠加）',
      '海浪破碎后泡沫悬浮在空中数秒',
      '退潮时沙滩上的水因低重力而形成更高/更细的水膜',
      '海岸悬崖因低重力侵蚀更缓慢，形成更陡峭形态'
    ],
    magneticEffects: [
      '海岸线附近的磁性沙滩（黑色磁铁矿颗粒）',
      '海浪与磁场相互作用，浪花边缘呈现淡紫色',
      '潮汐受双星引力+磁场共同影响，形成复杂节律',
      '退潮时可见磁场线在湿润沙滩上的痕迹（如发光纹路）'
    ],
    flora: [
      '海岸生长耐盐碱磁感红树林，根系暴露于空气中（低重力使细根悬浮）',
      '潮间带覆盖双色荧光藻类（5800K下金红，6500K下银蓝）',
      '海岸悬崖上的岩生苔藓在浪花飞溅时发出脉冲光',
      '某些海岸有漂浮的"海草球"（低重力下聚集成球形）'
    ],
    atmosphere: [
      '海岸以太孢子密度中等，海风带来孢子形成光之流',
      '浪花飞溅的微粒在双星照射下形成彩虹光环',
      '潮汐带来的水雾与孢子结合形成光之帷幕',
      '地平线处双星同时可见（日出/日落时分双色重叠）'
    ],
    lighting: {
      primary: '双星在海面的双色反射（金色+银白波纹）',
      secondary: '浪花飞溅微粒的彩虹散射',
      special: '退潮时沙滩上磁场线痕迹的微光'
    }
  }
};

// ========== 中文场景名→地形类型推断规则 ==========
const SCENE_TYPE_RULES = [
  { keywords: ['湖', '池', '潭', '渊', '溪', '河', '瀑', '泉', '涧', '沼', '泽', '海', '洋', '滩', '湾', '港', '渡', '津', '漕', '漕'], type: 'lake' },
  { keywords: ['山', '峰', '岭', '岳', '丘', '岗', '峦', '崖', '壁', '峡', '谷', '壑', '峪', '岫', '岬', '嶂', '嶙', '峋', '巅', '顶', '麓', '岫'], type: 'mountain' },
  { keywords: ['原', '野', '漠', '沙', '滩', '涂', '坪', '坝', '甸', '毡', '毯', '场', '院', '圃', '畦', '垄', '原'], type: 'plain' },
  { keywords: ['林', '森', '木', '树', '丛', '灌', '藤', '蔓', '萝', '苔', '藓', '蕨', '茸', '菌', '菇', '蕈', '芝', '苓', '茏', '郁', '葱', '翠', '碧'], type: 'forest' },
  { keywords: ['洞', '穴', '窟', '坑', '井', '隧', '道', '峡', '沟', '壑', '渊', '冥', '幽', '暗', '玄', '冥', '黝', '黢', '晦', '朔', '朔'], type: 'cave' },
  { keywords: ['岛', '屿', '礁', '洲', '渚', '汀', '坻', '屿', '礁', '矶', '砣', '堡', '垒', '台', '坛', '墟', '砦', '栅', '浮', '悬', '漂'], type: 'floating' },
  { keywords: ['岸', '滨', '涯', '畔', '浦', '溆', '矶', '渚', '沚', '坻', '淀', '汀', '湾', '澳', '港', '浦', '口', '门', '津', '渡', '渡'], type: 'coast' }
];

// ========== 场景名解析器 ==========
function parseSceneType(sceneName) {
  if (!sceneName) return 'plain';
  
  for (const rule of SCENE_TYPE_RULES) {
    for (const kw of rule.keywords) {
      if (sceneName.includes(kw)) {
        return rule.type;
      }
    }
  }
  
  // 默认回退
  return 'plain';
}

// ========== Nirath名称生成器 ==========
function generateNirathName(earthName, terrainType) {
  const prefixes = {
    lake: ['Magna', 'Aqua', 'Lumina', 'Flux', 'Spira', 'Velum'],
    mountain: ['Arx', 'Celsus', 'Apex', 'Tor', 'Mon', 'Cirrus'],
    plain: ['Campus', 'Planum', 'Litus', 'Horizon', 'Stepp', 'Vastum'],
    forest: ['Silva', 'Arbor', 'Viridis', 'Nemus', 'Bosk', 'Canop'],
    cave: ['Crypta', 'Antrum', 'Umbra', 'Profund', 'Tenebr', 'Abyss'],
    floating: ['Aer', 'Nimbus', 'Cael', 'Levit', 'Volat', 'Strat'],
    coast: ['Litor', 'Maris', 'Aestus', 'Und', 'Break', 'Shor']
  };
  
  const suffixes = {
    lake: ['-lacus', '-aqua', '-velum', '-pool', '-mere', '-tide'],
    mountain: ['-mons', '-arx', '-peak', '-tor', '-crest', '-spire'],
    plain: ['-planum', '-campus', '-vastum', '-reach', '-expanse', '-field'],
    forest: ['-silva', '-nemus', '-boscum', '-weald', '-thicket', '-canopy'],
    cave: ['-crypta', '-antrum', '-umbra', '-depth', '-grotto', '-hollow'],
    floating: ['-aer', '-nimbus', '-caelum', '-drift', '-hover', '-lift'],
    coast: ['-litor', '-maris', '-aestus', '-shore', '-strand', '-edge']
  };
  
  const prefixList = prefixes[terrainType] || prefixes.plain;
  const suffixList = suffixes[terrainType] || suffixes.plain;
  
  // 基于earthName的哈希选择，保证相同输入产生相同输出
  let hash = 0;
  for (let i = 0; i < earthName.length; i++) {
    hash = ((hash << 5) - hash) + earthName.charCodeAt(i);
    hash = hash & hash;
  }
  hash = Math.abs(hash);
  
  const prefix = prefixList[hash % prefixList.length];
  const suffix = suffixList[hash % suffixList.length];
  
  return `${prefix}${suffix}`;
}

// ========== 场景描述生成器 ==========
function generateSceneDescription(earthName, terrainType, template) {
  const physics = NIRATH_PHYSICS;
  
  // 随机选择效果（基于earthName哈希保证确定性）
  let hash = 0;
  for (let i = 0; i < earthName.length; i++) {
    hash = ((hash << 5) - hash) + earthName.charCodeAt(i);
    hash = hash & hash;
  }
  hash = Math.abs(hash);
  
  const pickRandom = (arr) => arr[hash % arr.length];
  hash = Math.abs((hash * 31 + 17) & 0x7FFFFFFF);
  
  const gravityEffect = pickRandom(template.gravityEffects);
  const magneticEffect = pickRandom(template.magneticEffects);
  const flora = pickRandom(template.flora);
  const atmosphere = pickRandom(template.atmosphere);
  
  const description = `${earthName}（Nirath原生地貌·${template.category}）——

重力效应（${physics.gravity}G）：${gravityEffect}。在Nirath的低重力环境下，这里的一切都比地球上更轻盈、更飘逸。

磁场效应（${physics.magneticField}Tesla）：${magneticEffect}。3.2Tesla的全球磁场让这里充满了肉眼可见的淡蓝紫色磁光。

双星光照：${physics.starA.name}（${physics.starA.wavelength}金色主星）与${physics.starB.name}（${physics.starB.wavelength}银白伴星）以72小时为周期交替主导光照。这里${template.lighting.primary}，${template.lighting.secondary}，${template.lighting.special}。

原生生态：${flora}。${atmosphere}。

Nirath物理法则完整性：✅ 重力0.82G ✅ 磁场3.2Tesla ✅ 双恒星5800K/6500K ✅ 以太孢子 ✅ 生物发光植被`;

  return description;
}

// ========== 主类：Nirath场景自动生成Agent ==========
class NirathSceneGenerator {
  constructor(options = {}) {
    this.config = {
      workDir: options.workDir || path.join(__dirname, '..'),
      libraryPath: options.libraryPath || path.join(__dirname, '..', 'data', 'nirath-scene-library-v2.json'),
      autoSave: options.autoSave !== false  // 默认自动保存
    };
    
    this.generatedCount = 0;
    this.generatedScenes = [];
    
    // 🔥 v6.2-fix: 写入队列（防止并发写入冲突）
    this._saveQueue = Promise.resolve();
  }
  
  /**
   * 生成Nirath场景（主入口）
   * @param {string} earthName - 原始场景名（如"银色湖泊"）
   * @param {Object} options - 选项
   * @returns {Object} 生成的场景对象
   */
  generate(earthName, options = {}) {
    if (!earthName || typeof earthName !== 'string') {
      return null;
    }
    
    const terrainType = options.terrainType || parseSceneType(earthName);
    const template = TERRAIN_TEMPLATES[terrainType];
    
    if (!template) {
      console.warn(`[NirathSceneGenerator] 未知地形类型: ${terrainType}，回退到plain`);
      return this.generate(earthName, { ...options, terrainType: 'plain' });
    }
    
    const nirathName = options.nirathName || generateNirathName(earthName, terrainType);
    const description = generateSceneDescription(earthName, terrainType, template);
    
    const scene = {
      earthName,                          // 原始中文名
      nirathName,                         // Nirath拉丁名
      terrainType,                        // 地形类型
      category: template.category,        // 中文分类
      description,                        // 完整描述
      physics: {                          // 物理参数
        gravity: NIRATH_PHYSICS.gravity,
        magneticField: NIRATH_PHYSICS.magneticField,
        starA: NIRATH_PHYSICS.starA,
        starB: NIRATH_PHYSICS.starB
      },
      ecosystem: {                         // 生态特征
        gravityEffects: template.gravityEffects,
        magneticEffects: template.magneticEffects,
        flora: template.flora,
        atmosphere: template.atmosphere
      },
      lighting: template.lighting,        // 光照特征
      generatedAt: new Date().toISOString(),
      version: '1.0',
      source: 'auto-generated'            // 标记为自动生成
    };
    
    this.generatedCount++;
    this.generatedScenes.push(scene);
    
    console.log(`[NirathSceneGenerator] ✅ 生成场景: ${earthName} → ${nirathName} (${template.category})`);
    
    // 自动保存到场景库
    if (this.config.autoSave) {
      this.saveToLibrary(scene).catch(e => {
        console.warn(`[NirathSceneGenerator] 保存到场景库失败: ${e.message}`);
      });
    }
    
    return scene;
  }
  
  /**
   * 批量生成多个场景
   * @param {Array<string>} earthNames - 原始场景名列表
   * @returns {Array<Object>} 生成的场景列表
   */
  generateBatch(earthNames) {
    return earthNames.map(name => this.generate(name));
  }
  
  /**
   * 保存生成的场景到场景库（队列化写入，防止并发冲突）
   * @param {Object} scene - 场景对象
   */
  async saveToLibrary(scene) {
    // 将写入操作加入队列
    this._saveQueue = this._saveQueue.then(async () => {
      const libPath = this.config.libraryPath;
      
      // 确保目录存在
      const dir = path.dirname(libPath);
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (e) {
        // 目录已存在
      }
      
      // 读取现有库
      let library = {};
      try {
        const data = await fs.readFile(libPath, 'utf8');
        library = JSON.parse(data);
      } catch (e) {
        // 文件不存在或解析失败，创建新库
        library = { _meta: { version: 'v2', generatedScenes: [] } };
      }
      
      // 添加到库（以earthName为键）
      library[scene.earthName] = scene;
      
      // 记录自动生成历史
      if (!library._meta.generatedScenes) {
        library._meta.generatedScenes = [];
      }
      library._meta.generatedScenes.push({
        earthName: scene.earthName,
        nirathName: scene.nirathName,
        generatedAt: scene.generatedAt,
        terrainType: scene.terrainType
      });
      
      // 写回文件
      await fs.writeFile(libPath, JSON.stringify(library, null, 2), 'utf8');
      
      console.log(`[NirathSceneGenerator] 💾 已保存到场景库: ${scene.earthName}`);
    }).catch(err => {
      console.warn(`[NirathSceneGenerator] 保存到场景库失败: ${err.message}`);
    });
    
    return this._saveQueue;
  }
  
  /**
   * 检查场景是否已在库中（避免重复生成）
   * @param {string} earthName - 原始场景名
   * @returns {boolean}
   */
  async existsInLibrary(earthName) {
    try {
      const data = await fs.readFile(this.config.libraryPath, 'utf8');
      const library = JSON.parse(data);
      return !!library[earthName];
    } catch (e) {
      return false;
    }
  }
  
  /**
   * 获取生成统计
   */
  getStats() {
    return {
      generatedCount: this.generatedCount,
      generatedScenes: this.generatedScenes.map(s => ({
        earthName: s.earthName,
        nirathName: s.nirathName,
        terrainType: s.terrainType,
        category: s.category
      }))
    };
  }
}

// ========== 便捷函数 ==========

/**
 * 快速生成单个场景
 */
function quickGenerate(earthName, options = {}) {
  const generator = new NirathSceneGenerator(options);
  return generator.generate(earthName, options);
}

/**
 * 批量生成
 */
function batchGenerate(earthNames, options = {}) {
  const generator = new NirathSceneGenerator(options);
  return generator.generateBatch(earthNames);
}

module.exports = {
  NirathSceneGenerator,
  quickGenerate,
  batchGenerate,
  NIRATH_PHYSICS,
  TERRAIN_TEMPLATES,
  parseSceneType,
  generateNirathName
};