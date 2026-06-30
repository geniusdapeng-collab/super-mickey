/**
 * 场景设计 Agent v1.0
 * 集名展示融入方式智能设计与生成
 * 
 * 链路位置：导演系统 → 场景设计Agent → Prompt构建器 → 渲染
 */

const fs = require('fs');
const path = require('path');

/**
 * 融入方式创意库
 * 每个融入方式包含：名称、适用场景、视觉描述模板、炸裂指数
 */
const INTEGRATION_LIBRARY = {
  // ========== 自然场景 ==========
  mountain_engraving: {
    name: '巨石刻痕',
    category: '自然场景',
    applicableScenes: ['山脉', '山峰', '悬崖', '峡谷', '岩石'],
    applicableBeasts: [],
    descriptionTemplate: `【巨石刻痕】山峰表面自然风化形成深达数米的刻痕纹理，岩石纹理与天然侵蚀纹路融为一体。阳光以{angle}度斜射，刻痕边缘产生淡{glowColor}色磁场光晕，岩粉如星尘般从刻痕中飘散。刻痕纹理呈现几何线条感，暗示信息存在但不形成具体文字。副标题区域以较小刻痕纹理呈现于主峰下方，同样为抽象纹路。`,
    visualElements: ['岩石纹理', '阳光斜射', '磁场光晕', '岩粉飘散'],
    epicLevel: 9,
    uniqueness: 8
  },

  waterfall_text: {
    name: '水流光效',
    category: '自然场景',
    applicableScenes: ['瀑布', '河流', '水域', '海边', '湖泊'],
    applicableBeasts: [],
    descriptionTemplate: `【水流光效】瀑布水流在半空凝结成发光晶体结构，阳光穿透水幕产生彩虹折射。晶体结构随水流波动而微微扭曲，如液态水晶般晶莹剔透，形成抽象的几何形状暗示标题存在。副标题区域以水泡气泡形式从水底升起，在晶体结构下方排列成光环。水流声与磁场共鸣产生低沉音律。`,
    visualElements: ['水流凝结', '彩虹折射', '水泡气泡', '磁场共鸣'],
    epicLevel: 10,
    uniqueness: 9
  },

  forest_smoke: {
    name: '烟雾光纹',
    category: '自然场景',
    applicableScenes: ['森林', '林间', '雾气', '沼泽'],
    applicableBeasts: ['jiu-wei-hu', 'huo-feng'],
    descriptionTemplate: `【烟雾光纹】{beastName}的尾巴扫过地面产生烟雾，烟雾受磁场影响自动凝聚成发光纹路，淡{glowColor}色荧光在烟雾中脉动。纹路如活物般缓慢漂浮，形成抽象的几何图案暗示标题形状，周围环绕细小光粒子。副标题区域以孢子粉尘形式从苔藓中升起，在烟雾下方形成光环。磁场波动使纹路产生轻微扭曲变形。`,
    visualElements: ['烟雾凝聚', '荧光脉动', '光粒子', '磁场扭曲'],
    epicLevel: 9,
    uniqueness: 10
  },

  star_constellation: {
    name: '星辰排列',
    category: '天空场景',
    applicableScenes: ['星空', '夜空', '太空', '高空'],
    applicableBeasts: ['zhu-long', 'ying-long'],
    descriptionTemplate: `【星辰排列】九颗主星与数百颗辅星排列成特定图案，星辰之间以淡{glowColor}色磁场光线连接。星座图案缓慢旋转，每颗星都是一个微型磁场核心，形成抽象的几何轮廓。副标题区域以星云尘埃形式在星座下方凝聚，由暗物质能量勾勒光环。整片星空因磁场活跃而产生轻微极光效果。`,
    visualElements: ['星座排列', '磁场光线', '星云尘埃', '极光效果'],
    epicLevel: 10,
    uniqueness: 10
  },

  // ========== 人工/遗迹场景 ==========
  ancient_stone_tablet: {
    name: '能量石碑',
    category: '遗迹场景',
    applicableScenes: ['古建筑', '遗迹', '废墟', '神殿', '祭坛'],
    applicableBeasts: [],
    descriptionTemplate: `【能量石碑】巨大石碑表面覆盖发光菌斑与苔藓，石碑高{height}米。石碑表面有自然形成的能量纹路，被磁场能量激活后淡{glowColor}色光芒从纹路中渗出，形成抽象的几何图案暗示信息存在。副标题区域以较小能量纹路呈现于石碑底部，周围环绕微型浮空光粒子。石碑基座有液态能量流过，水面倒映发光纹路。`,
    visualElements: ['发光菌斑', '磁场激活', '光芒渗出', '水面倒映'],
    epicLevel: 8,
    uniqueness: 7
  },

  sword_aura_carving: {
    name: '能量束刻痕',
    category: '战斗场景',
    applicableScenes: ['战场', '竞技场', '武器', '能量', '激烈'],
    applicableBeasts: [],
    descriptionTemplate: `【能量束刻痕】一道{glowColor}色高能束划过虚空留下刻痕，刻痕边缘带有等离子灼烧效果，空气中残留电离粒子闪烁。能量余波使周围岩石产生裂纹，裂纹中透出光芒，形成抽象的几何纹路。副标题区域由第二道能量束留下的纹路构成，更小但同样带有能量残留效果。整个场景充满战斗后的肃杀之气。`,
    visualElements: ['能量轨迹', '等离子灼烧', '电离粒子', '岩石裂纹'],
    epicLevel: 9,
    uniqueness: 8
  },

  // ========== 角色/异兽场景 ==========
  scroll_unfolding: {
    name: '全息投影板',
    category: '角色场景',
    applicableScenes: ['角色特写', '探险', '发现', '人物'],
    applicableBeasts: [],
    descriptionTemplate: `【全息投影板】小G从背包中取出一块Nirath原生晶体板，轻触激活。晶体板表面浮现淡{glowColor}色磁场光芒，形成能量纹路图案，纹路如能量流动般脉动，暗示信息存在但不形成具体文字。副标题区域以较小能量纹路出现于晶体板底部边缘。晶体板材质带有星云纹理，激活时散发古老磁场气息与微弱能量波动。`,
    visualElements: ['晶体板', '能量纹路', '脉动光芒', '星云纹理'],
    epicLevel: 7,
    uniqueness: 7
  },

  beast_tail_manifestation: {
    name: '尾巴幻化',
    category: '异兽场景',
    applicableScenes: ['异兽登场', '幻术', '变身'],
    applicableBeasts: ['jiu-wei-hu', 'yao-cao'],
    descriptionTemplate: `【尾巴幻化】{beastName}的{tailCount}条尾巴同时展开，每条尾巴尖端释放淡{glowColor}色生物荧光。荧光在空中交织，自然凝聚成发光纹路图案，纹路由纯能量构成，不断有光粒子从笔画中飘散。副标题区域由尾巴根部的磁场感应器投射，在地面形成全息光环投影。整个幻化过程伴随着低频磁场共鸣声。`,
    visualElements: ['尾巴展开', '生物荧光', '能量纹路', '全息投影', '磁场共鸣'],
    epicLevel: 10,
    uniqueness: 10
  },

  eye_projection: {
    name: '瞳孔投影',
    category: '异兽场景',
    applicableScenes: ['凝视', '对视', '瞳孔', '眼睛'],
    applicableBeasts: ['jiu-wei-hu', 'zhu-long'],
    descriptionTemplate: `【瞳孔投影】{beastName}的巨大瞳孔中倒映出场景全貌，瞳孔表面如镜面般光滑。在瞳孔中央，有微型全息投影形成的抽象纹路图案，由瞳孔内部的生物发光细胞生成。副标题区域以更小光环浮现在瞳孔边缘的虹膜纹理中。小G的倒影出现在瞳孔中，与纹路重叠，产生"信息刻于眼中"的视觉效果。`,
    visualElements: ['瞳孔镜面', '全息投影', '生物发光', '倒影重叠'],
    epicLevel: 10,
    uniqueness: 10
  },

  crystal_formation: {
    name: '水晶凝结',
    category: '异兽场景',
    applicableScenes: ['洞穴', '矿脉', '晶体', '宝石'],
    applicableBeasts: ['bai-ze'],
    descriptionTemplate: `【水晶凝结】洞穴顶部钟乳石滴落含矿物质水滴，水滴在半空中凝结成六棱柱结构水晶，水晶内部有{glowColor}色磁场光芒流转，形成抽象的几何纹路图案。副标题区域由较小水晶珠串联而成的光环，悬浮于主水晶下方。整个洞穴因水晶光芒而被照亮，岩壁上产生折射光斑。`,
    visualElements: ['水滴凝结', '六棱水晶', '光芒流转', '折射光斑'],
    epicLevel: 9,
    uniqueness: 9
  }
};

/**
 * 场景分析器
 * 分析场景描述，提取关键特征
 */
function analyzeScene(scene, beastIds = []) {
  const sceneLower = scene.toLowerCase();
  
  // 场景类型检测
  const sceneTypes = [];
  
  // 自然场景检测
  if (/山|峰|崖|岩|谷/.test(sceneLower)) sceneTypes.push('山脉');
  if (/瀑布|河|水|海|湖|溪/.test(sceneLower)) sceneTypes.push('水域');
  if (/森林|林|树|木|雾|沼/.test(sceneLower)) sceneTypes.push('森林');
  if (/星|空|夜|天|云/.test(sceneLower)) sceneTypes.push('星空');
  
  // 人工/遗迹场景检测
  if (/古|建|遗|殿|坛|碑/.test(sceneLower)) sceneTypes.push('遗迹');
  if (/战|武|能|激/.test(sceneLower)) sceneTypes.push('战斗');
  if (/洞|穴|矿|晶|宝/.test(sceneLower)) sceneTypes.push('洞穴');
  
  // 角色/异兽场景检测
  if (/特|人|物|探/.test(sceneLower)) sceneTypes.push('角色');
  if (/兽|妖|幻|变/.test(sceneLower)) sceneTypes.push('异兽');
  
  return {
    sceneTypes,
    beastIds,
    atmosphere: detectAtmosphere(sceneLower),
    lighting: detectLighting(sceneLower)
  };
}

function detectAtmosphere(scene) {
  if (/激|战|烈|爆/.test(scene)) return 'intense';
  if (/静|宁|和|柔/.test(scene)) return 'peaceful';
  if (/秘|神|幻|异/.test(scene)) return 'mysterious';
  if (/悲|哀|伤|凄/.test(scene)) return 'sad';
  return 'neutral';
}

function detectLighting(scene) {
  if (/夜|暗|黑|昏/.test(scene)) return 'dark';
  if (/晨|曦|朝/.test(scene)) return 'dawn';
  if (/午|阳|光/.test(scene)) return 'bright';
  if (/暮|夕|霞/.test(scene)) return 'dusk';
  return 'neutral';
}

/**
 * 融入方式匹配器
 * 根据场景分析结果，从库中匹配最佳融入方式
 */
function matchIntegrationMethod(sceneAnalysis) {
  const { sceneTypes, beastIds, atmosphere } = sceneAnalysis;
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [key, method] of Object.entries(INTEGRATION_LIBRARY)) {
    let score = 0;
    
    // 场景类型匹配
    for (const sceneType of sceneTypes) {
      if (method.applicableScenes.some(s => sceneType.includes(s) || s.includes(sceneType))) {
        score += 3;
      }
    }
    
    // 异兽匹配
    for (const beastId of beastIds) {
      if (method.applicableBeasts.includes(beastId)) {
        score += 5; // 异兽匹配权重更高
      }
    }
    
    // 氛围匹配
    if (atmosphere === 'intense' && method.category === '战斗场景') score += 2;
    if (atmosphere === 'mysterious' && method.category === '异兽场景') score += 2;
    if (atmosphere === 'peaceful' && method.category === '自然场景') score += 2;
    
    // 独特性加成
    score += method.uniqueness * 0.3;
    score += method.epicLevel * 0.2;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { key, ...method };
    }
  }
  
  return bestMatch;
}

/**
 * 视觉描述生成器
 * 根据匹配的融入方式，生成完整的视觉描述
 */
function generateVisualDescription(integrationMethod, episodeTitle, episodeAuthor, sceneAnalysis) {
  const { sceneTypes, beastIds, atmosphere, lighting } = sceneAnalysis;
  
  // 确定发光颜色
  const glowColorMap = {
    '山脉': '金',
    '水域': '蓝',
    '森林': '青',
    '星空': '紫',
    '遗迹': '橙',
    '战斗': '红',
    '洞穴': '绿',
    '角色': '白',
    '异兽': '银'
  };
  
  const glowColor = glowColorMap[sceneTypes[0]] || '蓝';
  
  // 确定阳光角度
  const angleMap = {
    'dawn': 15,
    'bright': 45,
    'dusk': 75,
    'dark': 0,
    'neutral': 30
  };
  
  const angle = angleMap[lighting] || 30;
  
  // 确定风格
  const styleMap = {
    'intense': '锐利',
    'peaceful': '柔和',
    'mysterious': '神秘',
    'sad': '飘逸',
    'neutral': '标准'
  };
  
  const style = styleMap[atmosphere] || '隶书';
  
  // 异兽信息
  const beastId = beastIds[0];
  const beastName = beastId === 'jiu-wei-hu' ? '九尾狐' : 
                    beastId === 'zhu-long' ? '烛龙' :
                    beastId === 'ying-long' ? '应龙' : '神兽';
  const tailCount = beastId === 'jiu-wei-hu' ? '九' : '数';
  const height = sceneTypes.includes('遗迹') ? '10' : '50';
  
  // 填充模板
  let description = integrationMethod.descriptionTemplate
    .replace(/{mainTitle}/g, episodeTitle)
    .replace(/{subTitle}/g, episodeAuthor)
    .replace(/{glowColor}/g, glowColor)
    .replace(/{angle}/g, angle)
    .replace(/{style}/g, style)
    .replace(/{beastName}/g, beastName)
    .replace(/{tailCount}/g, tailCount)
    .replace(/{height}/g, height);
  
  return {
    method: integrationMethod.name,
    category: integrationMethod.category,
    epicLevel: integrationMethod.epicLevel,
    uniqueness: integrationMethod.uniqueness,
    visualElements: integrationMethod.visualElements,
    description: description,
    timing: '0-3秒',
    duration: 3
  };
}

/**
 * 主函数：设计集名展示
 * @param {string} scene - 场景描述
 * @param {string} episodeTitle - 集名（如"九尾狐·迷局"）
 * @param {string} episodeAuthor - 出品人（如"大鹏出品"）
 * @param {string[]} beastIds - 出场异兽ID列表
 * @returns {object} 集名展示设计方案
 */
function designTitleDisplay(scene, episodeTitle, episodeAuthor, beastIds = []) {
  console.log('🎨 场景设计 Agent v1.0 - 集名展示设计');
  console.log(`📖 集名: ${episodeTitle}`);
  console.log(`👤 出品人: ${episodeAuthor}`);
  console.log(`🌄 场景: ${scene}`);
  console.log('');
  
  // 1. 分析场景
  const sceneAnalysis = analyzeScene(scene, beastIds);
  console.log(`🔍 场景分析: ${sceneAnalysis.sceneTypes.join(', ')} | 氛围: ${sceneAnalysis.atmosphere} | 光照: ${sceneAnalysis.lighting}`);
  
  // 2. 匹配融入方式
  const integrationMethod = matchIntegrationMethod(sceneAnalysis);
  console.log(`🎯 匹配融入方式: ${integrationMethod.name} (${integrationMethod.category})`);
  console.log(`   炸裂指数: ${integrationMethod.epicLevel}/10 | 独特性: ${integrationMethod.uniqueness}/10`);
  
  // 3. 生成视觉描述
  const visualDesign = generateVisualDescription(
    integrationMethod, 
    episodeTitle, 
    episodeAuthor, 
    sceneAnalysis
  );
  
  console.log('');
  console.log('📝 视觉描述:');
  console.log(visualDesign.description);
  
  return {
    episodeTitle,
    episodeAuthor,
    scene,
    sceneAnalysis,
    integrationMethod: {
      name: integrationMethod.name,
      key: integrationMethod.key,
      category: integrationMethod.category
    },
    visualDesign
  };
}

// 测试
if (require.main === module) {
  const result = designTitleDisplay(
    '青丘群岛·核心区域（山脉、森林、水域混合场景）',
    '九尾狐·迷局',
    '大鹏出品',
    ['jiu-wei-hu']
  );
  
  console.log('');
  console.log('✅ 设计完成！');
  console.log(`🎨 融入方式: ${result.integrationMethod.name}`);
  console.log(`🌟 炸裂指数: ${result.visualDesign.epicLevel}/10`);
}

module.exports = {
  designTitleDisplay,
  analyzeScene,
  matchIntegrationMethod,
  generateVisualDescription,
  INTEGRATION_LIBRARY
};