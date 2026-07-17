/**
 * 标题设计Agent — Title Presentation Agent (TPA)
 * 
 * 使命：将主标题的展现从"文字出现"升级为"叙事事件"
 * 原则：每个标题展现方式都是独一无二的，与异兽能力、Nirath环境、剧情情绪深度融合
 * 
 * 设计哲学：
 * 1. 标题不是装饰，是叙事工具
 * 2. 标题出现 = 情绪峰值 moment
 * 3. 利用Nirath物理法则创造"不可能"的视觉效果
 * 4. 每个标题展现都是观众忍不住截图的瞬间
 * 
 * 输入：episodeTitle, beastData, episodeSummary, mood, nirathEnv
 * 输出：标题展现描述（含情绪节奏、物理法则交互、镜头语言、惊喜元素）
 * 
 * @module title-presentation-agent
 * @version 1.0
 */

const fs = require('fs');
const path = require('path');

// ===== 标题设计Agent =====
class TitlePresentationAgent {
  constructor() {
    this.beastDatabasePath = path.join(__dirname, '..', 'systems', 'beast-database', 'beasts');
    this.nirathBiblePath = path.join(__dirname, '..', 'systems', 'nirath-bible.js');
  }

  /**
   * 主入口：生成标题展现方案
   * @param {Object} params
   * @param {string} params.episodeTitle - 集标题
   * @param {string} params.featuredBeastId - 异兽ID
   * @param {string} params.episodeSummary - 剧情摘要
   * @param {string} params.mood - 情绪基调 (mysterious/epic/tender/tense)
   * @param {number} params.titlePhaseDuration - 标题出现阶段时长(秒)
   * @returns {TitlePresentationPlan}
   */
  generate(params) {
    const { episodeTitle, featuredBeastId, episodeSummary, mood, titlePhaseDuration = 1.2 } = params;

    // 1. 读取异兽档案
    const beastData = this.loadBeastData(featuredBeastId);
    
    // 2. 分析异兽核心能力（获取最有想象力的能力）
    const coreAbility = this.analyzeCoreAbility(beastData);
    
    // 3. 分析剧情核心冲突（获取情绪锚点）
    const emotionalAnchor = this.analyzeEmotionalAnchor(episodeSummary, mood);
    
    // 4. 获取Nirath物理法则参数
    const nirathPhysics = this.getNirathPhysics();
    
    // 5. 生成标题展现方案（核心创意）
    const presentation = this.createPresentation({
      episodeTitle,
      beastData,
      coreAbility,
      emotionalAnchor,
      nirathPhysics,
      titlePhaseDuration
    });
    
    // 6. 生成情绪节奏设计
    const emotionCurve = this.designEmotionCurve(presentation, titlePhaseDuration);
    
    // 7. 生成镜头语言设计
    const cameraLanguage = this.designCameraLanguage(presentation);
    
    // 8. 生成物理法则交互描述
    const physicsInteraction = this.designPhysicsInteraction(presentation, nirathPhysics);

    return {
      episodeTitle,
      presentationMode: presentation.mode, // 展现模式名称
      description: presentation.description, // 完整描述文本（Prompt可用）
      shortDescription: presentation.shortDescription, // 精简版（字数紧张时用）
      fontSpec: presentation.fontSpec, // 字体规格（大小/粗细/视觉权重）
      emotionCurve,
      cameraLanguage,
      physicsInteraction,
      surpriseElements: presentation.surpriseElements, // 惊喜元素清单
      originality: presentation.originality, // 原创性评分(1-100)
      mood,
      titlePhaseDuration
    };
  }

  // ===== 能力分析引擎 =====
  analyzeCoreAbility(beastData) {
    if (!beastData) return { type: 'default', name: '通用显现', description: '磁流体凝聚' };

    const abilities = Array.isArray(beastData.abilities) ? beastData.abilities : [];
    const features = beastData.visualIdentity?.signatureFeatures || [];
    
    // 能力优先级排序（越有想象力的越优先）
    // ⚠️ 注意：遍历顺序不影响优先级！所有匹配项按分数排序，取最高分
    const imaginationScores = {
      // 幻术类（最高优先级）
      '幻术': 95, '魅惑': 93, '魅': 92, '迷惑': 91, '惑': 90,
      // 通灵/预知类
      '通灵': 88, '预知': 86, '变化': 85,
      // 契约/守护类
      '契约': 84, '守护': 83,
      // 火焰/等离子类（烛龙）
      '烛': 82, '火精': 81, '火焰': 80, '等离子': 79, '炎': 78, '火': 77,
      // 冰霜/晶体类
      '冰霜': 80, '冰': 78, '晶体': 76,
      // 雷电/电磁类
      '雷电': 80, '雷': 78, '电': 77,
      // 其他
      '治愈': 70, '毒': 65,
      '飞行': 60, '巨大化': 60
    };

    // 找出最有想象力的能力（收集所有匹配项，按分数排序）
    let allMatches = [];
    
    // 从abilities中搜索
    abilities.forEach(ability => {
      const name = ability.name || '';
      const desc = ability.description || '';
      const combinedText = (name + ' ' + desc).toLowerCase();
      
      Object.entries(imaginationScores).forEach(([keyword, score]) => {
        if (combinedText.includes(keyword.toLowerCase())) {
          allMatches.push({
            keyword,
            score,
            source: 'ability',
            text: name,
            category: this.keywordToCategory(keyword)
          });
        }
      });
    });

    // 从signatureFeatures中搜索
    if (features.length > 0) {
      const featureTexts = features.join(' ').toLowerCase();
      Object.entries(imaginationScores).forEach(([keyword, score]) => {
        if (featureTexts.includes(keyword.toLowerCase())) {
          allMatches.push({
            keyword,
            score,
            source: 'feature',
            text: features[0],
            category: this.keywordToCategory(keyword)
          });
        }
      });
    }
    
    // 从beast名称中搜索（别名匹配）
    const nameTexts = [
      beastData?.name?.chinese || '',
      ...(beastData?.name?.aliases || [])
    ].join(' ').toLowerCase();
    
    Object.entries(imaginationScores).forEach(([keyword, score]) => {
      if (nameTexts.includes(keyword.toLowerCase())) {
        allMatches.push({
          keyword,
          score: score * 0.8, // 名称匹配的分数打八折
          source: 'name',
          text: beastData?.name?.chinese || '',
          category: this.keywordToCategory(keyword)
        });
      }
    });

    // 按分数降序排序，取最高分
    allMatches.sort((a, b) => b.score - a.score);
    
    if (allMatches.length > 0) {
      const best = allMatches[0];
      return {
        name: best.keyword,
        description: best.text,
        imaginationScore: best.score,
        category: best.category,
        matchSource: best.source,
        allMatches: allMatches.slice(0, 3) // 保留前3个匹配供调试
      };
    }

    return { type: 'default', name: '磁场显现', description: '磁流体凝聚', imaginationScore: 50, category: 'default' };
  }

  /**
   * 关键词映射到能力类别（用于选择模板）
   */
  keywordToCategory(keyword) {
    const mapping = {
      '幻术': '幻术', '魅惑': '幻术', '魅': '幻术', '迷惑': '幻术', '惑': '幻术',
      '通灵': '通灵', '预知': '通灵',
      '变化': '变化',
      '契约': '通灵', '守护': '冰霜',
      '烛': '火焰', '火精': '火焰', '火焰': '火焰', '等离子': '火焰', '炎': '火焰', '火': '火焰',
      '冰霜': '冰霜', '冰': '冰霜', '晶体': '冰霜',
      '雷电': '雷电', '雷': '雷电', '电': '雷电',
      '治愈': 'default', '毒': 'default',
      '飞行': 'default', '巨大化': 'default'
    };
    return mapping[keyword] || 'default';
  }

  // ===== 情绪锚点分析 =====
  analyzeEmotionalAnchor(episodeSummary, mood) {
    const anchors = {
      mysterious: { peak: '悬念揭秘', valley: '未知恐惧', trigger: '真相浮现' },
      epic: { peak: '命运转折', valley: '渺小感', trigger: '宏大揭示' },
      tender: { peak: '情感共鸣', valley: '孤独感', trigger: '温暖拥抱' },
      tense: { peak: '生死一线', valley: '窒息感', trigger: '绝处逢生' }
    };

    // 从剧情摘要中提取关键冲突
    const conflictKeywords = ['契约', '试炼', '背叛', '守护', '觉醒', '迷失', '重逢', '牺牲'];
    let detectedConflict = null;
    
    conflictKeywords.forEach(keyword => {
      if (episodeSummary && episodeSummary.includes(keyword)) {
        detectedConflict = keyword;
      }
    });

    return {
      moodProfile: anchors[mood] || anchors.mysterious,
      detectedConflict,
      emotionalIntensity: detectedConflict ? 'high' : 'medium'
    };
  }

  // ===== Nirath物理法则获取 =====
  getNirathPhysics() {
    return {
      gravity: '0.82G',
      magneticField: '3.2Tesla',
      dualStar: { aurelius: '5800K金色', silvana: '6500K银白' },
      sporeDensity: '1200/cm³',
      atmosphericRefraction: '1.00045',
      magneticResonance: '30Hz'
    };
  }

  // ===== 核心创意生成 =====
  createPresentation(params) {
    const { episodeTitle, beastData, coreAbility, emotionalAnchor, nirathPhysics, titlePhaseDuration } = params;
    
    const beastName = beastData?.name?.chinese || '异兽';
    const abilityName = coreAbility?.category || 'default';
    
    // 标题展现模板库（每个都是独特的创意）
    const templates = this.getPresentationTemplates();
    
    // 根据异兽能力匹配最有想象力的模板
    let selectedTemplate = templates[abilityName];
    if (!selectedTemplate) {
      // 回退：从通用模板中按剧情冲突选择
      selectedTemplate = this.selectByConflict(templates, emotionalAnchor.detectedConflict);
    }

    // 注入具体参数，生成完整描述
    const description = this.renderTemplate(selectedTemplate, {
      episodeTitle,
      beastName,
      coreAbility,
      emotionalAnchor,
      nirathPhysics,
      titlePhaseDuration
    });

    // 生成字体规格（动态计算，不再硬编码）
    const fontSpec = this.generateFontSpec(episodeTitle, selectedTemplate);

    return {
      mode: selectedTemplate.name,
      description: description.full,
      shortDescription: description.short,
      fontSpec,
      surpriseElements: selectedTemplate.surpriseElements,
      originality: selectedTemplate.originality
    };
  }

  // ===== 字体规格动态生成（去硬编码）=====
  generateFontSpec(episodeTitle, template) {
    const titleLength = episodeTitle?.length || 10;
    const originality = template?.originality || 80;
    
    // v6.2-patch54: 标题字体大幅放大——铺满2/3屏幕（约66%），震撼感优先
    // 短标题(≤8字) → 55-60%，中等(9-15字) → 45-55%，长标题(>15字) → 35-45%
    let sizeRange;
    if (titleLength <= 8) {
      sizeRange = '55-60%';
    } else if (titleLength <= 15) {
      sizeRange = '45-55%';
    } else {
      sizeRange = '35-45%';
    }
    
    // v6.2-patch54: 视觉权重全面提升——标题是画面核心元素
    // 高原创性(>90) → 标题是视觉焦点，权重=100%
    // 中原创性(70-90) → 标题权重=90%
    // 低原创性(<70) → 标题权重=80%
    let visualWeight;
    if (originality > 90) {
      visualWeight = '100%';
    } else if (originality >= 70) {
      visualWeight = '90%';
    } else {
      visualWeight = '80%';
    }
    
    // 粗细：根据情绪调整
    const weight = originality > 85 ? 'bold粗体' : 'medium中等粗细';
    
    // 颜色：Nirath双恒星色温
    const color = '金色5800K暖光+银白6500K边缘';
    
    // 字体风格：根据展现模式
    const fontStyle = template?.name?.includes('量子') || template?.name?.includes('坍缩') 
      ? '未来感无衬线' 
      : template?.name?.includes('古典') || template?.name?.includes('仪式')
        ? '优雅衬线体'
        : '现代人文主义';
    
    return {
      sizeRange,        // e.g. "20-22%"
      visualWeight,     // e.g. "80%"
      weight,           // e.g. "bold粗体"
      color,            // e.g. "金色5800K暖光+银白6500K边缘"
      fontStyle,        // e.g. "现代人文主义"
      fullSpec: `字体大小${sizeRange}，${weight}，${color}，视觉权重${visualWeight}，${fontStyle}风格`
    };
  }
  getPresentationTemplates() {
    return {
      // 幻术类 — 最有想象力的展现方式
      '幻术': {
        name: '认知悖论式显现',
        originality: 95,
        surpriseElements: ['文字与背景无法区分', '观众需要"二次观看"才能发现标题', '标题在欺骗视觉'],
        full: (ctx) => `主标题"${ctx.episodeTitle}"并非"出现"，而是从**观众的认知盲区中浮现**。Nirath双恒星的光照角度恰好让文字与背景在某一帧完全融合——观众先看到${ctx.beastName}的尾巴在空中划出文字轮廓，却以为是尾巴的运动轨迹；当尾巴收回，文字突然"固化"在空间中，观众才惊觉刚才看到的轨迹本身就是标题。这不是文字覆盖在画面上，而是**画面自己长出了文字**——每一笔画都是${ctx.beastName}尾巴划过的等离子体余迹，在Nirath磁场中缓慢冷却凝固。文字边缘有0.3秒的"认知延迟"——先看到形状，后识别为文字。`,
        short: (ctx) => `主标题"${ctx.episodeTitle}"由${ctx.beastName}尾巴划过的等离子体余迹在Nirath磁场中凝固成形，观众先看到运动轨迹后惊觉是文字，0.3秒认知延迟`
      },

      // 变化类
      '变化': {
        name: '形态坍缩式显现',
        originality: 90,
        surpriseElements: ['标题从无限种可能中坍缩为一种', '每个观众第一次看到的形态不同', '薛定谔的标题'],
        full: (ctx) => `主标题"${ctx.episodeTitle}"以**量子叠加态**存在于画面中——在标题出现的1.2秒内，每个汉字同时呈现${ctx.beastName}的三种不同形态特征（尾/瞳/纹），如同薛定谔的猫，在观众"注视"的瞬间坍缩为确定的文字。这不是简单的变形动画，而是**Nirath量子相干性的视觉化**：标题的每一个笔画都在0.2秒内经历"叠加→坍缩→稳定"的三态跃迁。观众会产生"我是不是刚才看错了？"的错觉——因为第一帧和最后一帧的文字形态确实不同。`,
        short: (ctx) => `主标题"${ctx.episodeTitle}"以量子叠加态呈现${ctx.beastName}三态特征，在观众注视瞬间坍缩为确定文字，经历叠加→坍缩→稳定的三态跃迁`
      },

      // 火焰/等离子类（烛龙）
      '火焰': {
        name: '燃尽重生式显现',
        originality: 88,
        surpriseElements: ['标题先被烧毁，再重生', '灰烬是标题的一部分', '毁灭与创造同时发生'],
        full: (ctx) => `主标题"${ctx.episodeTitle}"并非从虚空中生成，而是**从画面的"死亡"中诞生**。前一帧的画面内容（${ctx.beastName}的幻影或小G的背影）突然被8000K高温等离子体点燃，在0.4秒内化为灰烬——但灰烬并未散去，而是在Nirath低重力中悬浮，重新排列组合为标题的笔画。这是**凤凰涅槃的微观版本**：毁灭即创造，死亡即诞生。标题的每一个字都带有"燃烧记忆"——笔画边缘有碳化纹理，内部有暗红色余烬脉动。观众先经历"画面被毁"的震惊，再经历"灰烬重生"的惊叹。`,
        short: (ctx) => `主标题"${ctx.episodeTitle}"从画面灰烬中重生，前一帧内容被8000K等离子体点燃，灰烬在Nirath低重力中悬浮重组为标题，笔画带有碳化纹理和暗红余烬脉动`
      },

      // 冰霜/晶体类
      '冰霜': {
        name: '时间冻结式显现',
        originality: 87,
        surpriseElements: ['标题不是出现，是被发现的', '标题一直存在，只是被冰藏', '解冻过程揭示隐藏信息'],
        full: (ctx) => `主标题"${ctx.episodeTitle}"**并非从外部进入画面，而是从画面内部"解冻"而出**。Nirath的极端低温让空气中的水蒸气在标题的位置预先凝结为冰晶——这些冰晶在标题出现前0.5秒就已经存在，但呈透明状态与背景完美融合。当${ctx.beastName}呼出的气息（含有生物荧光蛋白）接触冰晶，冰晶开始从内部发光，透明度下降，文字的轮廓逐渐"显影"——如同胶片冲洗。观众意识到：**标题一直就在那里，只是他们看不见**。冰晶解冻时产生的微小裂纹恰好构成文字的衬线装饰。`,
        short: (ctx) => `主标题"${ctx.episodeTitle}"从透明冰晶中"解冻"显影，冰晶预先存在于画面中，${ctx.beastName}呼出的生物荧光气息让冰晶从内部发光显影，解冻裂纹构成文字衬线`
      },

      // 雷电/电磁类
      '雷电': {
        name: '记忆闪回式显现',
        originality: 86,
        surpriseElements: ['标题由观众的"视觉残留"构成', '需要眨眼才能看到完整标题', '利用人眼BUG作为展现方式'],
        full: (ctx) => `主标题"${ctx.episodeTitle}"利用**人眼视觉残留的BUG**作为展现机制。Nirath的3.2Tesla磁场在标题位置产生高频电磁脉冲（120Hz，高于人眼临界融合频率），使画面在"有文字"和"无文字"之间快速闪烁。人眼无法分辨单个帧，但视网膜上的感光细胞会产生"叠加残留"——当观众**眨眼**的瞬间，眼睑的遮挡让残留影像短暂"定格"，大脑终于"看到"了完整的标题。这不是技术故障，而是**生物感知的艺术化利用**：标题只存在于观众的神经系统中，不在画面上。`,
        short: (ctx) => `主标题"${ctx.episodeTitle}"利用人眼视觉残留BUG，在120Hz电磁脉冲闪烁中，观众眨眼瞬间视网膜残留影像定格为完整标题，标题只存在于神经系统中`
      },

      // 通灵/预知类
      '通灵': {
        name: '时间逆行式显现',
        originality: 92,
        surpriseElements: ['标题从未来发送到现在', '先看到结果，再看到过程', '因果关系反转'],
        full: (ctx) => `主标题"${ctx.episodeTitle}"**从时间的终点向起点逆向书写**。观众首先看到标题的最后一个笔画"完成"，然后看到这个笔画"分解"为之前的笔画，如同录像倒放——但倒放的不是动作，而是**因果关系**。标题的每一个笔画都是由"未来的墨水"书写：笔画末端先出现（未来），笔画起始后出现（过去）。这是${ctx.beastName}预知能力的视觉化——标题不是被"写"出来的，而是被"记得"出来的，如同回忆一个已经发生的事实。观众会产生强烈的时间错位感："我是不是已经看过这一集？"`,
        short: (ctx) => `主标题"${ctx.episodeTitle}"时间逆行书写，从最后一笔画向第一笔画逆向成形，利用${ctx.beastName}预知能力，标题是被"记得"而非"写出"，产生强烈时间错位感`
      },

      // 默认/通用
      'default': {
        name: '物质相变式显现',
        originality: 70,
        surpriseElements: ['标题经历固液气三态变化', '物质形态转变的过程即叙事'],
        full: (ctx) => `主标题"${ctx.episodeTitle}"经历**Nirath特有的物质三态跃迁**：先在磁场中以气态离子形式扩散（几乎不可见，只有微弱的磁光折射），然后受双恒星光照触发凝结为液态磁流体（在画面中流动，带有Aurelius金色5800K和Silvana银白6500K的双色干涉纹），最后在0.3秒内冻结为固态文字。这不是简单的"淡入"，而是**物质本身的叙事**：气态=未知，液态=流动，固态=确定。观众在标题"凝固"的瞬间感受到剧情从悬念到揭示的转化。`,
        short: (ctx) => `主标题"${ctx.episodeTitle}"经历Nirath物质三态跃迁：气态离子扩散→液态磁流体流动（双色干涉纹）→固态文字凝固`
      }
    };
  }

  // 根据剧情冲突选择模板
  selectByConflict(templates, conflict) {
    const conflictMapping = {
      '契约': templates['通灵'] || templates['变化'],
      '试炼': templates['幻术'] || templates['雷电'],
      '背叛': templates['火焰'] || templates['冰霜'],
      '守护': templates['冰霜'] || templates['通灵'],
      '觉醒': templates['变化'] || templates['火焰'],
      '迷失': templates['幻术'] || templates['雷电'],
      '重逢': templates['通灵'] || templates['变化'],
      '牺牲': templates['火焰'] || templates['冰霜']
    };
    return conflictMapping[conflict] || templates['default'];
  }

  // 渲染模板
  renderTemplate(template, ctx) {
    const fullText = typeof template.full === 'function' ? template.full(ctx) : template.full;
    const shortText = typeof template.short === 'function' ? template.short(ctx) : (template.short || fullText);
    
    return {
      full: fullText,
      short: shortText.substring(0, 150) // 精简版，Prompt字数紧张时使用
    };
  }

  // ===== 情绪节奏设计 =====
  designEmotionCurve(presentation, duration) {
    const mode = presentation.mode;
    
    // 不同展现模式对应不同的情绪节奏
    const curves = {
      '认知悖论式显现': [
        { time: 0, emotion: '困惑', intensity: 30, description: '观众看到尾巴运动，以为是普通动作' },
        { time: duration * 0.3, emotion: '惊讶', intensity: 60, description: '尾巴收回，轨迹未消失，开始怀疑' },
        { time: duration * 0.6, emotion: '顿悟', intensity: 90, description: '观众认出那是文字，"原来如此！"' },
        { time: duration * 0.9, emotion: '震撼', intensity: 100, description: '文字完全固化，忍不住截图' }
      ],
      '量子叠加式显现': [
        { time: 0, emotion: '不安', intensity: 40, description: '文字形态不确定，视觉不稳定' },
        { time: duration * 0.4, emotion: '好奇', intensity: 70, description: '叠加态开始坍缩，期待结果' },
        { time: duration * 0.7, emotion: '惊喜', intensity: 95, description: '坍缩完成，形态确定，与预期不同' },
        { time: duration, emotion: '回味', intensity: 80, description: '观众想再看一遍确认' }
      ],
      '燃尽重生式显现': [
        { time: 0, emotion: '恐惧', intensity: 50, description: '画面被烧毁，"出BUG了？"' },
        { time: duration * 0.3, emotion: '失落', intensity: 40, description: '灰烬飘散，画面空白' },
        { time: duration * 0.6, emotion: '希望', intensity: 75, description: '灰烬开始重组，有光' },
        { time: duration, emotion: '震撼', intensity: 100, description: '标题从灰烬中升起，凤凰涅槃' }
      ],
      '默认': [
        { time: 0, emotion: '期待', intensity: 40 },
        { time: duration * 0.5, emotion: '专注', intensity: 70 },
        { time: duration, emotion: '满足', intensity: 85 }
      ]
    };

    return curves[mode] || curves['默认'];
  }

  // ===== 镜头语言设计 =====
  designCameraLanguage(presentation) {
    const mode = presentation.mode;
    
    const languages = {
      '认知悖论式显现': {
        focus: '跟随九尾狐尾巴的运动轨迹，运动完成时镜头"愣住"0.2秒（模拟观众反应）',
        transition: '从运动跟踪突然切换为静态凝视，制造"发现"的错觉',
        depth: '浅景深→深景深，尾巴清晰时文字模糊，文字清晰时尾巴虚化',
        unique: '镜头本身"被骗"——先跟踪尾巴，后"醒悟"到那是文字'
      },
      '量子叠加式显现': {
        focus: '固定机位，不移动，让观众自己"观察"坍缩过程',
        transition: '快速剪辑（3帧一剪）模拟量子跃迁的不连续性',
        depth: '全清晰，刻意消除景深，强调"叠加态"的平面感',
        unique: '镜头不判断，只记录；判断权交给观众'
      },
      '燃尽重生式显现': {
        focus: '从燃烧点开始缓慢拉升，灰烬上升时镜头下沉',
        transition: '火焰的暖色→灰烬的灰色→标题的双色，色彩即叙事',
        depth: '烟雾中深景深，标题出现时浅景深突出',
        unique: '镜头参与"哀悼"：燃烧时剧烈抖动，重生时平稳呼吸'
      },
      '默认': {
        focus: '缓慢推近标题',
        transition: '淡入淡出',
        depth: '浅景深突出文字',
        unique: '无'
      }
    };

    return languages[mode] || languages['默认'];
  }

  // ===== 物理法则交互设计 =====
  designPhysicsInteraction(presentation, nirathPhysics) {
    const mode = presentation.mode;
    
    const interactions = {
      '认知悖论式显现': `3.2Tesla磁场让等离子体余迹以30Hz频率脉动，恰好是人眼"视觉暂留"的临界频率——余迹看起来"既存在又不存在"。双恒星光照角度（Aurelius ${nirathPhysics.dualStar.aurelius} + Silvana ${nirathPhysics.dualStar.silvana}）在余迹表面产生双色干涉纹，让文字边缘有"不属于这个世界"的质感。`,
      
      '量子叠加式显现': `Nirath的低重力（${nirathPhysics.gravity}）让叠加态的"形态粒子"有足够时间在空中展现所有可能态，而不像地球上那样瞬间坍缩。磁场共振频率（${nirathPhysics.magneticResonance}）与叠加态的相位差形成拍频，观众看到的"闪烁"其实是量子概率波的视觉化。`,
      
      '燃尽重生式显现': `8000K等离子体燃烧时产生的热对流在${nirathPhysics.gravity}低重力中形成缓慢的"灰烬龙卷风"，给灰烬重组提供了"雕塑家之手"。大气折射率（${nirathPhysics.atmosphericRefraction}）让燃烧的光晕有微妙的色散——标题重生时带有彩虹边缘。`,
      
      '默认': `双恒星光照（${nirathPhysics.dualStar.aurelius} + ${nirathPhysics.dualStar.silvana}）在磁流体表面产生双色干涉纹，磁场（${nirathPhysics.magneticField}）控制流体运动轨迹。`
    };

    return interactions[mode] || interactions['default'];
  }

  // ===== 数据加载 =====
  loadBeastData(beastId) {
    if (!beastId) return null;
    const filePath = path.join(this.beastDatabasePath, `${beastId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return null;
  }
}

// ===== 便捷函数 =====
function generateTitlePresentation(params) {
  const agent = new TitlePresentationAgent();
  return agent.generate(params);
}

// ===== 模块导出 =====
module.exports = {
  TitlePresentationAgent,
  generateTitlePresentation
};

// ===== 测试 =====
if (require.main === module) {
  console.log('🎨 标题设计Agent — 测试运行\n');
  
  const testCases = [
    {
      name: '九尾狐·迷局',
      params: {
        episodeTitle: '九尾狐·迷局',
        featuredBeastId: 'jiu-wei-hu',
        episodeSummary: '小G初到青丘群岛，被九尾狐幻术迷惑，两者建立信任签订真相契约。',
        mood: 'mysterious',
        titlePhaseDuration: 1.2
      }
    },
    {
      name: '烛龙·永夜',
      params: {
        episodeTitle: '烛龙·永夜',
        featuredBeastId: 'zhu-long',
        episodeSummary: '小G在永夜裂谷遭遇烛龙，以烛龙之火照亮黑暗，签订守护契约。',
        mood: 'epic',
        titlePhaseDuration: 1.5
      }
    }
  ];

  testCases.forEach(test => {
    console.log(`\n═══════════════════════════════════════`);
    console.log(`🎬 测试：${test.name}`);
    console.log(`═══════════════════════════════════════`);
    
    const result = generateTitlePresentation(test.params);
    
    console.log(`\n📌 展现模式：${result.presentationMode}`);
    console.log(`🎨 原创性评分：${result.originality}/100`);
    console.log(`\n📝 完整描述：`);
    console.log(result.description);
    console.log(`\n✂️ 精简版（Prompt用）：`);
    console.log(result.shortDescription);
    console.log(`\n🎭 情绪节奏：`);
    result.emotionCurve.forEach(e => {
      console.log(`  ${(e.time * 1000).toFixed(0)}ms: ${e.emotion} (强度${e.intensity}%) — ${e.description || ''}`);
    });
    console.log(`\n🎥 镜头语言：`);
    console.log(`  焦点：${result.cameraLanguage.focus}`);
    console.log(`  转场：${result.cameraLanguage.transition}`);
    console.log(`  景深：${result.cameraLanguage.depth}`);
    console.log(`  独特：${result.cameraLanguage.unique}`);
    console.log(`\n⚛️ 物理交互：`);
    console.log(result.physicsInteraction);
    console.log(`\n✨ 惊喜元素：`);
    result.surpriseElements.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  });

  console.log('\n\n✅ 标题设计Agent 测试完成！');
}