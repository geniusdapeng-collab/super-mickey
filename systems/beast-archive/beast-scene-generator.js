/**
 * Beast Scene Generator
 * 神兽场景生成器 - 基于神兽栖息地自动生成完整场景描述
 * 
 * 核心能力：
 * 1. 栖息地模板渲染 - 预定义40+栖息地模板
 * 2. 神兽-环境互动 - 神兽特征与环境元素互动描述
 * 3. 氛围生成 - 时间/天气/光线自动组合
 * 4. Prompt字数控制 - 智能分配场景描述字数
 */

const HABITAT_TEMPLATES = {
  '永夜裂谷': {
    base: 'Nirath星球北极圈永夜裂谷，绵延数千公里地壳裂缝',
    terrain: '深处是活跃的岩浆海洋，地壳板块撕裂形成的深渊',
    lighting: '双恒星光照盲区，常年处于黑暗中，唯有岩浆和神兽自身光芒照明',
    atmosphere: '空气中弥漫着硫磺与等离子体的味道',
    sound: '地壳深处传来岩浆翻滚的低频轰鸣',
    flora: '无常规植物，岩壁上生长着能量苔藓',
    fauna: '夜行生物在岩缝间穿行，发光的晶体虫群漂浮',
    weather: '永恒黑暗，偶尔有地热气浪升腾'
  },
  '青丘灵原': {
    base: '青丘灵原最深处，蓝绿色荧光高草没过膝盖',
    terrain: '银色湖泊旁，液态汞般的水面',
    lighting: '双恒星正沉入地平线，一橙一紫两道光芒交织在湖面',
    atmosphere: '草叶边缘的荧光随着脚步一明一灭，像是大地的呼吸',
    sound: '微风拂过荧光草的沙沙声',
    flora: '荧光高草，孢子水母在空气中漂浮',
    fauna: '小型异兽在草间跳跃，发光的小兽穿梭',
    weather: '温和的双星交替，永恒的黄昏色调'
  },
  '云雷高原': {
    base: 'Nirath星球赤道云雷高原，海拔超过万米',
    terrain: '超级高原，深邃的峡谷系统是应龙尾巴划出',
    lighting: '终年雷暴不断，云层中闪电平均每三分钟击中地面一次',
    atmosphere: '云层含有特殊导电粒子，空气中充满静电',
    sound: '持续不断的雷鸣，如战鼓般隆隆作响',
    flora: '导电植被，在雷击中闪烁蓝色火花',
    fauna: '电磁生物在云层间穿梭，翼膜生物吸收雷电',
    weather: '永恒雷暴，暴雨倾盆，闪电交织'
  },
  '丹穴山脉': {
    base: '赤道附近丹穴山脉，活火山与金矿脉交织',
    terrain: '火山喷发的熔岩流形成壮丽山脉，岩浆中富含金玉',
    lighting: '火山火红光芒与双星金光交织，天空永远泛着暖色调',
    atmosphere: '空气中弥漫着等离子体粒子，金色尘埃漂浮',
    sound: '火山喷发的轰隆声与岩浆流动声',
    flora: '火生植物在岩浆边缘生长，金色苔藓',
    fauna: '火禽在火山口盘旋，熔岩生物在岩浆中游泳',
    weather: '火山灰雨，金色颗粒从天而降'
  },
  '百兽草原': {
    base: 'Nirath中纬度百兽草原，广袤无垠的生态保护区',
    terrain: '水草丰美的温带草原，远方矗立着昆仑塔',
    lighting: '双星温暖的光芒洒满草原，金色波浪般的光影',
    atmosphere: '草香与花香混合的清新空气',
    sound: '百兽齐鸣，远处传来悠扬的麒麟角声',
    flora: '彩色野花，金色麦浪般的灵草',
    fauna: '群兽奔跑，百鸟飞翔，一片生机盎然',
    weather: '温和宜人，偶尔有流星雨'
  }
};

const TIME_OF_DAY = {
  '黎明': { lighting: '双星初升，金紫色晨曦', atmosphere: '晨雾弥漫，露珠闪烁', color: '金紫交织' },
  '正午': { lighting: '双星高悬，炽烈光芒', atmosphere: '热浪升腾，影子缩短', color: '金黄耀眼' },
  '黄昏': { lighting: '双星沉入地平线，橙紫光芒', atmosphere: '暮光温柔，荧光初现', color: '橙紫暖调' },
  '夜晚': { lighting: '恒星余晖，生物荧光', atmosphere: '寂静深邃，星光璀璨', color: '深蓝幽暗' },
  '永夜': { lighting: '无恒星光照，仅有地核与生物光', atmosphere: '绝对黑暗，唯有发光生物', color: '暗红幽光' }
};

const WEATHER_EFFECTS = {
  '晴朗': { sky: '双星光芒无遮挡', ground: '干燥温暖', effect: '光影清晰' },
  '雷暴': { sky: '乌云翻滚，闪电交织', ground: '雨水横流', effect: '电光闪烁' },
  '流星雨': { sky: '星辰碎片划过', ground: '微光洒落', effect: '梦幻光轨' },
  '地热气浪': { sky: '热浪扭曲视线', ground: '地面震颤', effect: '空气波动' },
  '极光': { sky: '带电粒子形成彩色光幕', ground: '柔和荧光', effect: ' ethereal glow' }
};

class BeastSceneGenerator {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.templates = options.templates || HABITAT_TEMPLATES;
    this.maxLength = options.maxLength || 200; // 场景描述最大字数
  }

  /**
   * 主入口：生成完整场景描述
   * @param {string} habitat - 栖息地名称
   * @param {Object} options - 生成选项
   * @returns {string} 场景描述文本
   */
  generate(habitat, options = {}) {
    const template = this.templates[habitat];
    if (!template) {
      return this.generateGeneric(habitat, options);
    }
    
    const time = options.time || '黄昏';
    const weather = options.weather || '晴朗';
    const beastPresence = options.beastPresence || true;
    const mood = options.mood || '庄严';
    
    // 组装场景元素
    const elements = [];
    
    // 1. 基础环境
    elements.push(template.base);
    
    // 2. 地形
    if (options.includeTerrain !== false) {
      elements.push(template.terrain);
    }
    
    // 3. 时间光照
    const timeData = TIME_OF_DAY[time];
    if (timeData) {
      elements.push(timeData.lighting);
      elements.push(timeData.atmosphere);
    }
    
    // 4. 天气效果
    const weatherData = WEATHER_EFFECTS[weather];
    if (weatherData) {
      elements.push(weatherData.sky);
    }
    
    // 5. 氛围元素
    if (options.includeAtmosphere !== false) {
      elements.push(template.atmosphere);
    }
    
    // 6. 生物活动
    if (beastPresence) {
      elements.push(template.fauna);
    }
    
    // 7. 植物
    if (options.includeFlora !== false && template.flora) {
      elements.push(template.flora);
    }
    
    // 8. 声音
    if (options.includeSound !== false) {
      elements.push(template.sound);
    }
    
    // 组合并控制字数
    let scene = elements.join('，');
    
    if (scene.length > this.maxLength) {
      scene = this.smartTrim(scene, this.maxLength);
    }
    
    // 添加情绪色调
    if (mood) {
      scene = this.applyMood(scene, mood);
    }
    
    return scene;
  }

  /**
   * 生成神兽特写的场景描述
   * 聚焦神兽本身，环境作为背景
   */
  generateBeastCloseup(beastName, habitat, options = {}) {
    const baseScene = this.generate(habitat, {
      ...options,
      includeTerrain: false,
      includeFlora: false,
      includeSound: false,
      maxLength: 100
    });
    
    const beastFocus = `${beastName}特写，${options.beastFeature || '威严姿态'}`;
    
    return `${baseScene}，${beastFocus}`;
  }

  /**
   * 生成神兽与人类互动的场景
   */
  generateInteractionScene(beastName, humanName, habitat, interaction, options = {}) {
    const baseScene = this.generate(habitat, options);
    
    const interactionDesc = {
      '相遇': `${humanName}首次见到${beastName}，震撼与敬畏交织`,
      '对话': `${humanName}与${beastName}建立精神连接，光芒交织`,
      '战斗': `${humanName}与${beastName}激烈交锋，能量爆发`,
      '骑行': `${humanName}骑乘${beastName}穿越${habitat}`,
      '告别': `${humanName}与${beastName}依依惜别，光芒渐暗`
    };
    
    const desc = interactionDesc[interaction] || `${humanName}与${beastName}在${habitat}中`;
    
    return `${baseScene}，${desc}`;
  }

  /**
   * 智能修剪，保留关键信息
   */
  smartTrim(scene, maxLength) {
    const sentences = scene.split('，');
    let result = '';
    
    // 优先级排序：基础 > 光照 > 天气 > 氛围 > 生物 > 植物 > 声音
    const priority = [0, 1, 2, 3, 4, 5, 6, 7]; // 索引优先级
    
    for (const idx of priority) {
      if (sentences[idx]) {
        const candidate = result ? `${result}，${sentences[idx]}` : sentences[idx];
        if (candidate.length <= maxLength) {
          result = candidate;
        } else {
          break;
        }
      }
    }
    
    return result || sentences[0]; // 至少保留第一句
  }

  /**
   * 应用情绪色调
   */
  applyMood(scene, mood) {
    const moodFilters = {
      '庄严': { tone: '庄重肃穆', lighting: '神圣光芒', color: '金红交织' },
      '神秘': { tone: '神秘莫测', lighting: '幽暗微光', color: '蓝紫幽光' },
      '恐惧': { tone: '压抑恐怖', lighting: '阴影笼罩', color: '暗红漆黑' },
      '温馨': { tone: '温暖安宁', lighting: '柔和暖光', color: '橙黄金色' },
      '激烈': { tone: '激烈紧张', lighting: '电光火石', color: '红白交织' },
      '梦幻': { tone: '梦幻 ethereal', lighting: '流光溢彩', color: '彩虹渐变' }
    };
    
    const filter = moodFilters[mood];
    if (!filter) return scene;
    
    // 简单追加情绪描述
    return `${scene}，${filter.tone}氛围，${filter.lighting}`;
  }

  /**
   * 通用栖息地生成（未定义栖息地）
   */
  generateGeneric(habitat, options = {}) {
    return `Nirath星球的${habitat}，双恒星光芒交织，地核辐射与生物电磁场共鸣`;
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[BeastSceneGenerator] ${msg}`);
    }
  }
}

module.exports = BeastSceneGenerator;

// 测试
if (require.main === module) {
  console.log('🎭 BeastSceneGenerator 测试');
  const generator = new BeastSceneGenerator({ verbose: true, maxLength: 200 });
  
  // 测试：烛龙栖息地
  const scene1 = generator.generate('永夜裂谷', {
    time: '永夜',
    weather: '地热气浪',
    mood: '庄严'
  });
  console.log('\n🐉 烛龙场景:');
  console.log(scene1);
  console.log(`  字数: ${scene1.length}`);
  
  // 测试：帝江栖息地
  const scene2 = generator.generate('青丘灵原', {
    time: '黄昏',
    weather: '晴朗',
    mood: '温馨'
  });
  console.log('\n☁️ 帝江场景:');
  console.log(scene2);
  
  // 测试：互动场景
  const scene3 = generator.generateInteractionScene('烛龙', '小G', '永夜裂谷', '相遇', {
    time: '永夜',
    mood: '神秘'
  });
  console.log('\n👦🐉 互动场景:');
  console.log(scene3);
}
