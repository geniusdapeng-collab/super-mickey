/**
 * 神兽出场Agent v2.0 — 灵气型个性化出场设计系统
 * 
 * 设计哲学：
 * 1. 每只异兽都是独一无二的，出场方式也应该是独一无二的
 * 2. 不套用模板，而是基于异兽档案特征动态生成
 * 3. 身体部位即出场语言，能力即出场节奏
 * 4. 充满灵气，像天才艺术家一样为每只异兽量身定制
 * 
 * 核心流程：
 * 1. BeastFeatureAnalyzer — 深度分析异兽档案，提取出场可用特征
 * 2. EntranceDesigner — 基于特征动态设计三阶段出场（前兆/爆发/余波）
 * 3. FullScreenComposer — 生成全屏铺满+震撼音效描述
 * 
 * 输出：完整的出场描述（叙事+运镜+全屏铺满+震撼音效）
 * 
 * @module beast-entrance-agent
 * @version 2.0
 */

const fs = require('fs');
const path = require('path');

// ===== 异兽特征分析器 =====
class BeastFeatureAnalyzer {
  constructor() {
    this.beastDatabasePath = path.join(__dirname, '..', 'systems', 'beast-database', 'beasts');
  }

  // 加载异兽档案
  loadBeastData(beastId) {
    const filePath = path.join(this.beastDatabasePath, `${beastId}.json`);
    if (!fs.existsSync(filePath)) {
      // 尝试从fallback查找
      return this.getFallbackData(beastId);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // 深度特征分析 — 提取所有可用于出场的特征
  analyzeFeatures(beastData) {
    const visual = beastData?.visualIdentity || {};
    const abilities = beastData?.abilities || [];
    const nirath = beastData?.nirathStatus || {};
    const narrative = beastData?.narrative || {};

    // ===== 1. 身体部位特征 =====
    const bodyParts = this.extractBodyParts(visual);

    // ===== 2. 能力特征 =====
    // v6.2-patch101-fix: 防御性检查，确保abilities是数组
    const safeAbilities = Array.isArray(abilities) ? abilities : [];
    const abilityFeatures = safeAbilities.slice(0, 3).map(a => ({
      name: a?.name || '',
      description: a?.description || '',
      rarity: a?.rarity || ''
    }));

    // ===== 3. 栖息地/环境特征 =====
    const habitat = nirath.habitat || 'Nirath未知区域';
    const ecosystemRole = nirath.ecosystemRole || '未知角色';

    // ===== 4. 体型/存在感 =====
    const scale = this.parseScale(visual.scale);
    const presence = this.inferPresence(visual, abilities);

    // ===== 5. 特殊视觉元素 =====
    const visualElements = this.extractVisualElements(visual);

    // ===== 6. 移动方式推断 =====
    const movementType = this.inferMovementType(visual, abilities);

    return {
      id: beastData.id,
      name: beastData.name?.chinese || '未知异兽',
      bodyParts,
      abilities: abilityFeatures,
      habitat,
      ecosystemRole,
      scale,
      presence,
      visualElements,
      movementType,
      originStory: narrative.originStory || '',
      // 关键特征摘要（用于快速匹配）
      keyTraits: this.generateKeyTraits(bodyParts, abilityFeatures, visualElements)
    };
  }

  // 提取身体部位
  extractBodyParts(visual) {
    const parts = [];
    
    // 合并所有文本来源用于特征检测
    const allText = [
      visual.bodyPlan || '',
      visual.coreDescription || '',
      visual.promptFragments?.head || '',
      visual.promptFragments?.body || '',
      visual.promptFragments?.eyes || '',
      visual.promptFragments?.special || ''
    ].join(' ');
    
    // 从所有文本提取特征（不局限于bodyPlan）
    if (allText.includes('人面') || allText.includes('人脸')) {
      parts.push({ type: 'face', name: '人面', description: '人类面孔，表情庄严', significance: 'high' });
    }
    if (allText.includes('羊身') || allText.includes('羊')) {
      parts.push({ type: 'body', name: '羊身', description: '山羊般的四足结构', significance: 'medium' });
    }
    if (allText.includes('腋下') || allText.includes('腋')) {
      parts.push({ type: 'eyes', name: '腋下之眼', description: '双眼生于腋下，暗红幽光', significance: 'critical' });
    }
    if (allText.includes('巨口') || allText.includes('大嘴')) {
      parts.push({ type: 'mouth', name: '巨口', description: '占据面部三分之二的巨口', significance: 'high' });
    }
    if (allText.includes('虎齿') || allText.includes('利齿')) {
      parts.push({ type: 'teeth', name: '虎齿/利齿', description: '螺旋排列的利齿', significance: 'high' });
    }
    if (allText.includes('人爪') || allText.includes('手掌')) {
      parts.push({ type: 'claws', name: '人爪', description: '五指修长的手掌', significance: 'medium' });
    }
    if (allText.includes('九尾')) {
      parts.push({ type: 'tails', name: '九尾', description: '九条尾巴', significance: 'critical' });
    } else if (allText.includes('尾') || allText.includes('尾巴')) {
      parts.push({ type: 'tail', name: '尾巴', description: '尾巴', significance: 'low' });
    }
    if (allText.includes('翼') || allText.includes('翅膀') || allText.includes('飞')) {
      parts.push({ type: 'wings', name: '翅膀', description: '翅膀', significance: 'critical' });
    }

    // 从signatureFeatures补充
    const features = visual.signatureFeatures || [];
    features.forEach(f => {
      if (f.includes('火山岩装甲')) {
        parts.push({ type: 'armor', name: '火山岩装甲', description: '高温压缩火山陶瓷装甲', significance: 'high' });
      }
      if (f.includes('熔岩核心')) {
        parts.push({ type: 'core', name: '熔岩核心', description: '体内熔岩核心', significance: 'high' });
      }
    });

    return parts;
  }

  // 解析体型
  parseScale(scaleText) {
    if (!scaleText) return { category: 'medium', height: 10, weight: 1000 };
    
    if (scaleText.includes('30米') || scaleText.includes('50米')) {
      return { category: 'large', height: 30, weight: 5000 };
    }
    if (scaleText.includes('100米') || scaleText.includes('山岳')) {
      return { category: 'mountain', height: 100, weight: 50000 };
    }
    if (scaleText.includes('公里') || scaleText.includes('千米')) {
      return { category: 'colossal', height: 1000, weight: 1000000 };
    }
    if (scaleText.includes('小型') || scaleText.includes('5米')) {
      return { category: 'small', height: 5, weight: 500 };
    }
    return { category: 'medium', height: 15, weight: 3000 };
  }

  // 推断存在感
  inferPresence(visual, abilities) {
    const safeAbilities = Array.isArray(abilities) ? abilities : [];
    const abilitiesText = safeAbilities.map(a => a?.name || '').join('');
    if (abilitiesText.includes('吞噬') || abilitiesText.includes('毁灭')) {
      return '压倒性';
    }
    if (abilitiesText.includes('光暗') || abilitiesText.includes('昼') || abilitiesText.includes('夜')) {
      return '神性';
    }
    if (abilitiesText.includes('幻') || abilitiesText.includes('迷雾')) {
      return '魅惑';
    }
    if (abilitiesText.includes('阴影') || abilitiesText.includes('暗')) {
      return '诡秘';
    }
    if (visual.bodyPlan?.includes('龙') || visual.bodyPlan?.includes('凤')) {
      return '神性';
    }
    return '威严';
  }

  // 提取视觉元素
  extractVisualElements(visual) {
    const elements = [];
    const palette = visual.colorPalette || [];
    
    palette.forEach(c => {
      if (c.includes('红') || c.includes('熔岩')) elements.push({ type: 'color', value: c, name: '红色系' });
      if (c.includes('金') || c.includes('橙')) elements.push({ type: 'color', value: c, name: '金色系' });
      if (c.includes('蓝') || c.includes('紫')) elements.push({ type: 'color', value: c, name: '蓝紫色系' });
      if (c.includes('黑') || c.includes('暗')) elements.push({ type: 'color', value: c, name: '暗色系' });
      if (c.includes('白') || c.includes('银')) elements.push({ type: 'color', value: c, name: '银白色系' });
    });

    const texture = visual.texture || '';
    if (texture.includes('岩浆') || texture.includes('熔岩')) {
      elements.push({ type: 'effect', name: '岩浆流动', description: '体表岩浆纹路发光' });
    }
    if (texture.includes('光') || texture.includes('发光')) {
      elements.push({ type: 'effect', name: '光芒', description: '身体发光效果' });
    }

    return elements;
  }

  // 推断移动方式
  inferMovementType(visual, abilities) {
    const bodyPlan = visual.bodyPlan || '';
    const safeAbilities = Array.isArray(abilities) ? abilities : [];
    const abilitiesText = safeAbilities.map(a => a?.description || '').join('');

    if (bodyPlan.includes('翼') || bodyPlan.includes('翅膀') || bodyPlan.includes('飞')) {
      return 'flying';
    }
    if (abilitiesText.includes('遁') || abilitiesText.includes('潜') || abilitiesText.includes('地下')) {
      return 'burrowing';
    }
    if (abilitiesText.includes('游') || abilitiesText.includes('水')) {
      return 'swimming';
    }
    if (bodyPlan.includes('四足') || bodyPlan.includes('足')) {
      return 'quadruped';
    }
    if (bodyPlan.includes('蛇') || bodyPlan.includes('蜿蜒')) {
      return 'slithering';
    }
    return 'walking';
  }

  // 生成关键特征摘要
  generateKeyTraits(bodyParts, abilities, visualElements) {
    const traits = [];
    const safeAbilities = Array.isArray(abilities) ? abilities : [];
    
    // 最重要的3个身体部位
    const criticalParts = bodyParts.filter(p => p.significance === 'critical');
    criticalParts.forEach(p => traits.push(p.name));
    
    // 最重要的能力
    if (safeAbilities[0]) traits.push(safeAbilities[0].name);
    
    // 视觉元素
    const effects = visualElements.filter(e => e.type === 'effect');
    effects.forEach(e => traits.push(e.name));

    return traits.slice(0, 5);
  }

  getFallbackData(beastId) {
    // 简化fallback数据
    const fallbacks = {
      'tao-tie': {
        name: { chinese: '饕餮' },
        visualIdentity: {
          bodyPlan: '羊身人面，腋下之眼，巨口虎齿',
          signatureFeatures: ['巨口螺旋利齿', '火山岩装甲', '熔岩核心'],
          scale: '肩高30米，体长50米',
          colorPalette: ['暗红色', '熔岩橙', '灰烬黑'],
          texture: '火山岩质装甲，岩浆纹路'
        },
        abilities: [
          { name: '吞噬万物', description: '吞噬一切物质' },
          { name: '行动迅疾', description: '速度极快' }
        ],
        nirathStatus: {
          habitat: '钩吾废墟/熔岩裂谷',
          ecosystemRole: '物质重构者'
        }
      }
    };
    return fallbacks[beastId] || fallbacks['tao-tie'];
  }
}

// ===== 灵气型出场设计师 =====
class EntranceDesigner {
  constructor() {
    this.analyzer = new BeastFeatureAnalyzer();
  }

  // 主入口：生成完整出场方案
  generate(params) {
    const { beastId, habitat, mood, episodeTheme, episodeSummary, entranceDuration } = params;
    
    // 1. 加载并分析异兽
    const beastData = this.analyzer.loadBeastData(beastId);
    const features = this.analyzer.analyzeFeatures(beastData);

    // 2. 基于特征动态设计出场
    const entrance = this.designEntrance(features, habitat, mood, entranceDuration);

    // 3. 生成全屏铺满描述
    const fullScreen = this.composeFullScreen(features, entrance);

    // 4. 生成震撼音效
    const audio = this.composeAudio(features, entrance);

    // 5. 生成运镜方案
    const camera = this.designCamera(features, entrance, entranceDuration);

    // 6. 计算震撼度
    const impactScore = this.calculateImpact(features, entrance);

    return {
      beastName: features.name,
      mode: entrance.name,
      originality: entrance.originality,
      phases: entrance.phases,
      fullScreen,
      audio,
      cameraWork: camera,
      impactScore,
      features,
      keyTraits: features.keyTraits
    };
  }

  // 核心：基于特征动态设计出场
  designEntrance(features, habitat, mood, duration) {
    const { bodyParts, abilities, movementType, scale, visualElements, habitat: beastHabitat } = features;

    // ===== 前兆阶段：基于最重要特征制造悬念 =====
    const precursor = this.designPrecursor(features, habitat);

    // ===== 爆发阶段：全屏铺满，核心特征集中展现 =====
    const burst = this.designBurst(features, scale);

    // ===== 余波阶段：环境反应，留下印象 =====
    const aftermath = this.designAftermath(features, habitat);

    // 生成出场名称
    const entranceName = this.generateEntranceName(features);

    return {
      name: entranceName,
      originality: this.calculateOriginality(features),
      phases: {
        precursor: { phase: '前兆', description: precursor },
        burst: { phase: '爆发', description: burst },
        aftermath: { phase: '余波', description: aftermath }
      }
    };
  }

  // 设计前兆：制造悬念
  designPrecursor(features, habitat) {
    const { bodyParts, visualElements, movementType } = features;
    
    // 找到最关键的特征作为前兆线索
    const criticalPart = bodyParts.find(p => p.significance === 'critical');
    const highPart = bodyParts.find(p => p.significance === 'high');

    let precursorText = '';

    // 根据移动方式设计前兆
    if (movementType === 'flying') {
      precursorText = '天空云层突然向两侧撕裂，大气电离发出嗡鸣，一道阴影从云层裂缝中投射下来，地面温度骤降';
    } else if (movementType === 'burrowing') {
      precursorText = '地面开始轻微震颤，土壤粒子开始向上悬浮，空气中传来地下深处的低频轰鸣，地面出现细微裂缝';
    } else if (movementType === 'swimming') {
      precursorText = '水面出现不自然的波纹，水下传来低沉的共鸣声，水体颜色开始变深，气泡从深处上浮';
    } else {
      // 陆地行走
      if (criticalPart?.name === '腋下之眼') {
        precursorText = '黑暗中两团暗红光芒缓缓睁开，光芒从腋下位置扩散开来，照亮周围数十米，空气中传来沉重的呼吸声';
      } else if (criticalPart?.name === '九尾') {
        precursorText = '地面开始渗出幻色迷雾，九条尾巴的虚影在雾中若隐若现，风铃般的幻音从四面八方传来';
      } else if (visualElements.some(e => e.name === '岩浆流动')) {
        precursorText = '地面温度骤然升高，岩石开始发红，岩浆纹路从地下透出光芒，空气中弥漫硫磺气息';
      } else {
        precursorText = '地面开始轻微震颤，空气中粒子密度骤增，远处传来低沉的共鸣，环境光线发生微妙变化';
      }
    }

    return precursorText;
  }

  // 设计爆发：全屏铺满，核心特征集中展现
  designBurst(features, scale) {
    const { bodyParts, abilities, visualElements, movementType, name } = features;
    const safeAbilities = Array.isArray(abilities) ? abilities : [];
    
    // 收集关键特征用于爆发描述
    const criticalParts = bodyParts.filter(p => p.significance === 'critical');
    const highParts = bodyParts.filter(p => p.significance === 'high');
    const mainAbility = safeAbilities[0];

    let burstParts = [];

    // 根据身体部位构建爆发描述
    criticalParts.forEach(part => {
      if (part.name === '腋下之眼') {
        burstParts.push('腋下之眼完全睁开，暗红幽光如探照灯般扫过全场');
      } else if (part.name === '九尾') {
        burstParts.push('九条尾巴在画面中完全展开，每条尾巴占据画面10%宽度');
      } else if (part.name === '翅膀') {
        burstParts.push('巨翼撕裂云层降临，翼展遮蔽画面80%天空');
      }
    });

    highParts.forEach(part => {
      if (part.name === '巨口' && mainAbility?.name === '吞噬万物') {
        burstParts.push('巨口张开，周围物质被吸入，光线在口器中扭曲');
      } else if (part.name === '火山岩装甲') {
        burstParts.push('火山岩装甲表面岩浆纹路亮起，橙红光芒从装甲缝隙中喷涌');
      } else if (part.name === '人面') {
        burstParts.push('人面表情庄严，双眼直视镜头');
      }
    });

    // 体型描述
    let scaleText = '';
    if (scale.category === 'colossal') {
      scaleText = '天体级巨躯';
    } else if (scale.category === 'mountain') {
      scaleText = '山岳级巨躯';
    } else if (scale.category === 'large') {
      scaleText = '巨兽级身躯';
    }

    // 移动方式
    let movementText = '';
    if (movementType === 'flying') {
      movementText = '从天空俯冲而下';
    } else if (movementType === 'burrowing') {
      movementText = '从地裂中升起';
    } else {
      movementText = '从虚空中踏出';
    }

    // 组装爆发描述
    const burstDesc = [
      `${name}${scaleText}${movementText}`,
      ...burstParts,
      '画面被其身躯完全占据，视觉冲击力极强'
    ].join('，');

    return burstDesc;
  }

  // 设计余波：环境反应
  designAftermath(features, habitat) {
    const { visualElements, movementType, name } = features;
    
    let aftermathText = '';

    if (visualElements.some(e => e.name === '岩浆流动')) {
      aftermathText = '地面留下熔岩灼烧痕迹，空气中弥漫着硫磺气息，周围温度持续升高';
    } else if (movementType === 'flying') {
      aftermathText = '气流仍在剧烈涌动，云层裂缝缓慢愈合，羽毛/鳞片缓缓飘落';
    } else if (movementType === 'burrowing') {
      aftermathText = '裂缝边缘仍有岩浆光芒，地面震颤逐渐平息，碎石持续滚落';
    } else {
      aftermathText = '环境逐渐恢复平静，但空气中仍残留着异兽存在的气场，地面留下独特痕迹';
    }

    return `${name}已完全显现，${aftermathText}`;
  }

  // 生成出场名称
  generateEntranceName(features) {
    const { name, keyTraits, movementType } = features;
    
    if (keyTraits.includes('腋下之眼')) {
      return `${name}·暗眼觉醒`;
    }
    if (keyTraits.includes('九尾')) {
      return `${name}·幻尾天降`;
    }
    if (keyTraits.includes('翅膀')) {
      return `${name}·翼破苍穹`;
    }
    if (movementType === 'burrowing') {
      return `${name}·地心崛起`;
    }
    if (movementType === 'flying') {
      return `${name}·天穹撕裂`;
    }
    return `${name}·震撼降临`;
  }

  // 计算原创度
  calculateOriginality(features) {
    let score = 85;
    const { bodyParts, abilities } = features;
    
    // 独特身体部位加分
    const uniqueParts = ['腋下之眼', '九尾', '龙角', '凤冠', '麒麟角'];
    bodyParts.forEach(p => {
      if (uniqueParts.includes(p.name)) score += 5;
    });

    // 传说级能力加分
    const safeAbilities = Array.isArray(abilities) ? abilities : [];
    if (safeAbilities.some(a => a?.rarity === 'legendary')) score += 3;

    return Math.min(score, 100);
  }

  // 生成全屏铺满描述
  composeFullScreen(features, entrance) {
    const { bodyParts, scale, name } = features;
    
    // 找出最具视觉冲击的特征
    const visualParts = bodyParts.filter(p => 
      p.significance === 'critical' || p.significance === 'high'
    );

    const descriptions = visualParts.slice(0, 3).map(p => {
      if (p.name === '腋下之眼') return '腋下之眼暗红幽光扫过全场';
      if (p.name === '巨口') return '巨口张开占据画面40%';
      if (p.name === '九尾') return '九尾展开铺满画面60%';
      if (p.name === '火山岩装甲') return '岩浆装甲纹路发光';
      if (p.name === '翅膀') return '巨翼遮蔽画面80%天空';
      return `${p.name}极具压迫感`;
    });

    const scaleText = scale.category === 'large' || scale.category === 'mountain' || scale.category === 'colossal'
      ? '巨躯铺满画面80%'
      : '身躯占据画面60%';

    return `${name}${scaleText}，${descriptions.join('，')}`;
  }

  // 生成震撼音效
  composeAudio(features, entrance) {
    const { abilities, visualElements, movementType, name } = features;
    
    const sounds = [];

    // 基于移动方式的基础音效
    if (movementType === 'flying') {
      sounds.push('翼膜撕裂空气的高频呼啸');
      sounds.push('大气电离嗡鸣');
    } else if (movementType === 'burrowing') {
      sounds.push('地壳碎裂的低频轰鸣');
      sounds.push('岩浆涌动咕噜声');
    } else {
      sounds.push('地面崩塌的沉闷巨响');
      sounds.push('空气被排开的冲击波');
    }

    // 基于能力的特殊音效
    const safeAbilities = Array.isArray(abilities) ? abilities : [];
    const mainAbility = safeAbilities[0];
    if (mainAbility?.name === '吞噬万物') {
      sounds.push('物质被吸入的扭曲音爆');
      sounds.push('饕餮低沉的共鸣咆哮');
    }
    if (mainAbility?.name?.includes('光') || mainAbility?.name?.includes('昼')) {
      sounds.push('光芒爆发的空间震颤');
    }

    // 基于视觉元素的音效
    if (visualElements.some(e => e.name === '岩浆流动')) {
      sounds.push('岩浆爆裂的噼啪声');
    }

    return `${name}专属震撼音效：${sounds.join(' + ')}，形成多重音墙冲击`;
  }

  // 设计运镜
  designCamera(features, entrance, duration) {
    const { movementType, scale, bodyParts } = features;
    
    const sequence = [];

    // 开场：建立尺度
    if (scale.category === 'colossal' || scale.category === 'mountain') {
      sequence.push('extreme_wide环境异变全景');
    } else {
      sequence.push('wide环境变化全景');
    }

    // 前兆特写
    const criticalPart = bodyParts.find(p => p.significance === 'critical');
    if (criticalPart?.name === '腋下之眼') {
      sequence.push('extreme_close暗红双眼睁开特写');
    } else if (criticalPart?.name === '九尾') {
      sequence.push('soft_focus九尾虚影特写');
    } else if (movementType === 'flying') {
      sequence.push('aerial云层撕裂俯视');
    }

    // 爆发全屏铺满
    sequence.push('full_body巨躯铺满屏幕');
    sequence.push('extreme_close核心特征压迫特写');

    // 余波
    sequence.push('pull_back reveal全景');

    return {
      sequence,
      duration,
      keyMoment: `${(duration * 0.5).toFixed(1)}s — 全屏铺满爆发峰值`
    };
  }

  // 计算震撼度
  calculateImpact(features, entrance) {
    let score = entrance.originality || 85;
    const { scale, bodyParts } = features;

    // 体型加分
    const sizeBonus = { colossal: 15, mountain: 12, large: 8, medium: 5, small: 0 };
    score += sizeBonus[scale.category] || 0;

    // 独特特征加分
    const uniqueParts = bodyParts.filter(p => p.significance === 'critical');
    score += uniqueParts.length * 3;

    return Math.min(score, 100);
  }
}

// ===== 主Agent类 =====
class BeastEntranceAgent {
  constructor() {
    this.designer = new EntranceDesigner();
  }

  // 主入口：生成完整出场方案
  generate(params) {
    return this.designer.generate(params);
  }

  // 生成Prompt可用字符串
  generatePromptString(params, options = {}) {
    const plan = this.generate(params);
    const { phases, cameraWork, beastName, fullScreen, audio } = plan;
    const compact = options.compact || false;

    // v2.0: 支持紧凑模式（Prompt空间紧张时使用）
    let promptText;
    if (compact) {
      // 紧凑模式：只保留前兆+爆发的核心部分
      promptText = `${phases.precursor.description.substring(0, 40)}，${phases.burst.description.substring(0, 80)}`;
    } else {
      // 完整模式：前兆+爆发
      promptText = [
        `${phases.precursor.description}，`,
        `${phases.burst.description}`
      ].join('');
    }

    const cameraText = cameraWork.sequence.join('→');

    return {
      narrative: promptText,
      camera: cameraText,
      fullScreen: `【全屏铺满】${fullScreen}`,
      audio: `【震撼音效】${audio}`,
      impactScore: plan.impactScore,
      mode: plan.mode,
      keyTraits: plan.keyTraits,
      fullPlan: plan
    };
  }
}

// 单例导出
const beastEntranceAgent = new BeastEntranceAgent();

module.exports = {
  BeastEntranceAgent,
  beastEntranceAgent,
  BeastFeatureAnalyzer,
  EntranceDesigner,
  generateBeastEntrance: (params) => beastEntranceAgent.generatePromptString(params)
};