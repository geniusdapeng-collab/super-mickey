/**
 * MD Beast Parser
 * MD→JSON转换器 - 将神兽MD档案解析为标准JSON格式
 * 
 * 解析能力：
 * 1. 自动识别10大维度字段
 * 2. 提取Prompt片段（外观描述→结构化）
 * 3. 颜色提取（主色调自动识别）
 * 4. 体型分类（基于关键词）
 * 5. 关系图谱构建
 * 6. 栖息地映射
 */

const fs = require('fs');

class MDBeastParser {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
  }

  /**
   * 主入口：解析MD文本为JSON
   * @param {string} mdText - MD文件内容
   * @returns {Object} 标准神兽JSON档案
   */
  parse(mdText) {
    const sections = this.splitSections(mdText);
    
    const beast = {
      id: this.extractId(sections),
      catalogNo: this.extractCatalogNo(sections),
      name: this.extractName(sections),
      classification: this.extractClassification(sections),
      nirathStatus: this.extractNirathStatus(sections),
      visualIdentity: this.extractVisualIdentity(sections),
      abilities: this.extractAbilities(sections),
      narrative: this.extractNarrative(sections),
      production: this.extractProduction(sections),
      metadata: {
        parsedAt: new Date().toISOString(),
        parserVersion: '1.0',
        sourceFormat: 'markdown'
      }
    };
    
    // 后处理：自动补全和优化
    this.enrichBeast(beast);
    
    return beast;
  }

  /**
   * 分割MD为章节
   */
  splitSections(mdText) {
    const sections = {};
    const lines = mdText.split('\n');
    let currentSection = null;
    let currentContent = [];
    
    for (const line of lines) {
      // 检测章节标题（## 或 ### 开头）
      const match = line.match(/^#{2,4}\s+(.+)$/);
      if (match) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n');
        }
        currentSection = this.normalizeSectionName(match[1]);
        currentContent = [];
      } else {
        if (currentSection) {
          currentContent.push(line);
        }
      }
    }
    
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n');
    }
    
    return sections;
  }

  /**
   * 规范化章节名
   */
  normalizeSectionName(name) {
    const map = {
      '神兽名称': 'name',
      '名称': 'name',
      '山海经出处': 'origin',
      '出处': 'origin',
      '神兽介绍': 'intro',
      '介绍': 'intro',
      '神兽外观': 'appearance',
      '外观': 'appearance',
      '外形': 'appearance',
      '神兽能力/神通': 'abilities',
      '能力': 'abilities',
      '神通': 'abilities',
      '神兽故事': 'stories',
      '故事': 'stories',
      '传说': 'stories',
      '象征寓意': 'symbolism',
      '象征': 'symbolism',
      '寓意': 'symbolism',
      '影视创作建议': 'production',
      '创作建议': 'production',
      '影视': 'production',
      '与Nirath星球结合的建议': 'nirath',
      'Nirath': 'nirath',
      '与Nirath': 'nirath',
      '相关神兽': 'relations',
      '相关': 'relations'
    };
    
    for (const [key, value] of Object.entries(map)) {
      if (name.includes(key)) return value;
    }
    
    return name.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * 提取ID（从编号和名称生成）
   */
  extractId(sections) {
    const nameSection = sections.name || '';
    const catalogMatch = nameSection.match(/【档案(\d+)】/);
    const nameMatch = nameSection.match(/[①②③④⑤⑥⑦⑧⑨⑩]?\s*\*\*中文名称\*\*\s*：\s*(.+)/);
    
    let id = '';
    if (catalogMatch) {
      id = `beast-${catalogMatch[1].padStart(3, '0')}`;
    } else if (nameMatch) {
      id = this.nameToId(nameMatch[1]);
    } else {
      // 从内容推断
      const firstLine = Object.values(sections)[0] || '';
      const fallbackMatch = firstLine.match(/(\S{2,4})/);
      id = fallbackMatch ? this.nameToId(fallbackMatch[1]) : 'unknown';
    }
    
    return id;
  }

  /**
   * 提取图鉴编号
   */
  extractCatalogNo(sections) {
    const nameSection = sections.name || '';
    const match = nameSection.match(/【档案(\d+)】/);
    return match ? match[1] : '';
  }

  /**
   * 提取名称信息
   */
  extractName(sections) {
    const text = sections.name || '';
    
    const chineseMatch = text.match(/\*\*中文名称\*\*\s*：\s*(.+)/);
    const pinyinMatch = text.match(/\*\*拼音注音\*\*\s*：\s*(.+)/);
    const aliasMatches = text.match(/\*\*别名\*\*\s*：\s*(.+)/g);
    
    return {
      chinese: chineseMatch ? chineseMatch[1].trim() : '',
      pinyin: pinyinMatch ? pinyinMatch[1].trim() : '',
      aliases: aliasMatches 
        ? aliasMatches.map(m => m.replace(/\*\*别名\*\*\s*：\s*/, '').trim())
        : []
    };
  }

  /**
   * 提取分类信息
   */
  extractClassification(sections) {
    const text = sections.intro || '';
    
    // 从介绍中提取定位和级别
    const tierKeywords = {
      '创世神祇': ['创世', '至高', '主宰', '原始'],
      '上古凶兽': ['凶兽', '四大凶', '恶兽'],
      '四方灵兽': ['四灵', '守护', '方位'],
      '异界灵兽': ['异界', '灵兽', '祥瑞'],
      '灾厄之兽': ['灾厄', '预兆', '凶兆'],
      '奇幻生灵': ['奇幻', '生灵', '异兽']
    };
    
    let tier = '异界灵兽'; // 默认
    for (const [t, keywords] of Object.entries(tierKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        tier = t;
        break;
      }
    }
    
    // 提取出处
    const originText = sections.origin || '';
    const sourceMatch = originText.match(/《(.+?)》/);
    
    return {
      tier,
      category: this.extractCategory(text),
      originText: sourceMatch ? `《${sourceMatch[1]}》` : '《山海经》'
    };
  }

  /**
   * 提取Nirath状态
   */
  extractNirathStatus(sections) {
    const text = sections.nirath || '';
    
    const habitatMatch = text.match(/栖息地.*?["""'']?([^"""''\n]+?)(?:["""'']|[，。]|\n)/);
    const sciFiMatch = text.match(/外星生态.*?["""'']?([^"""''\n]+?)(?:["""'']|[，。]|\n)/);
    const humanMatch = text.match(/与人类文明.*?["""'']?([^"""''\n]+?)(?:["""'']|[，。]|\n)/);
    
    return {
      isNative: true,
      habitat: habitatMatch ? habitatMatch[1].trim() : '',
      ecosystemRole: this.extractEcosystemRole(text),
      firstAppearance: '' // 待人工标注
    };
  }

  /**
   * 提取视觉身份
   */
  extractVisualIdentity(sections) {
    const text = sections.appearance || '';
    
    // 提取核心描述（前30字）
    const coreDesc = text.substring(0, 60).replace(/\n/g, '').trim();
    
    // 提取颜色
    const colors = this.extractColors(text);
    
    // 提取体型关键词
    const scale = this.detectScale(text);
    
    // 提取身体结构
    const bodyPlan = this.detectBodyPlan(text);
    
    // 提取标志性特征
    const features = this.extractSignatureFeatures(text);
    
    // 生成Prompt片段
    const promptFragments = this.generatePromptFragments(text);
    
    return {
      coreDescription: coreDesc,
      bodyPlan,
      colorPalette: colors,
      scale,
      texture: this.detectTexture(text),
      signatureFeatures: features,
      promptFragments,
      portraitConfig: this.generatePortraitConfig(colors, scale)
    };
  }

  /**
   * 提取颜色
   */
  extractColors(text) {
    const colorKeywords = {
      '赤红': ['赤红', '赤色', '火红', '殷红'],
      '金黄': ['金黄', '金色', '黄金', '橙黄'],
      '雪白': ['雪白', '白色', '银白', '纯白'],
      '墨黑': ['墨黑', '黑色', '漆黑', '暗黑'],
      '青碧': ['青碧', '青色', '碧绿', '翠绿'],
      '暗紫': ['暗紫', '紫色', '紫红', '靛紫'],
      '五彩': ['五彩', '斑斓', '五彩色', '五色']
    };
    
    const found = [];
    for (const [color, keywords] of Object.entries(colorKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        found.push(color);
      }
    }
    
    return found.length > 0 ? found : ['未知'];
  }

  /**
   * 检测体型
   */
  detectScale(text) {
    const scaleKeywords = {
      '超巨型': ['千里', '万丈', '遮天蔽日', '几千里', '如山'],
      '巨型': ['百丈', '翼展百米', '如山岳', '庞大'],
      '大型': ['数丈', '数倍于', '巨大'],
      '中型': ['如人', '如马', '如牛'],
      '小型': ['如猫', '如鼠', '小巧']
    };
    
    for (const [scale, keywords] of Object.entries(scaleKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return scale;
      }
    }
    
    return '大型'; // 默认
  }

  /**
   * 检测身体结构
   */
  detectBodyPlan(text) {
    const plans = {
      '人首蛇身': ['人面蛇身', '人首蛇身', '人脸蛇身'],
      '有翼神龙': ['有翼', '翅膀', '翼展'],
      '鸟形': ['鸟', '禽', '羽', '翼'],
      '兽形': ['虎', '豹', '牛', '羊', '鹿'],
      '混合型': ['鱼身鸟翼', '马身人面', '虎身九尾']
    };
    
    for (const [plan, keywords] of Object.entries(plans)) {
      if (keywords.some(kw => text.includes(kw))) {
        return plan;
      }
    }
    
    return '神兽形';
  }

  /**
   * 检测材质
   */
  detectTexture(text) {
    const textures = {
      '鳞片': ['鳞片', '鳞甲', '鳞'],
      '毛发': ['毛发', '毛皮', '鬃毛', '毫毛'],
      '羽毛': ['羽毛', '羽翼', '翅羽'],
      '甲壳': ['甲壳', '硬壳', '外壳'],
      '皮肤': ['皮肤', '光滑', '肌肤'],
      '能量体': ['能量', '光芒', '等离子', '半透明']
    };
    
    for (const [texture, keywords] of Object.entries(textures)) {
      if (keywords.some(kw => text.includes(kw))) {
        return texture;
      }
    }
    
    return '未知';
  }

  /**
   * 提取标志性特征
   */
  extractSignatureFeatures(text) {
    const features = [];
    
    // 常见特征模式
    const patterns = [
      /(\S{2,6}.*?)(?:特征|标志|最显著|最引人)/,
      /生有(\S{2,8})/,
      /长着(\S{2,8})/,
      /(\S{2,4}?)目/,
      /(\S{2,4}?)角/,
      /(\S{2,4}?)尾/,
      /(\S{2,4}?)翼/,
      /(\S{2,4}?)足/
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(new RegExp(pattern, 'g'));
      if (matches) {
        features.push(...matches.slice(0, 3)); // 最多取3个
      }
    }
    
    return features.slice(0, 5); // 最多5个
  }

  /**
   * 生成Prompt片段
   */
  generatePromptFragments(text) {
    // 简单提取关键描述句
    const sentences = text.split(/[。！？]/);
    
    return {
      head: this.findSentenceWithKeywords(sentences, ['首', '头', '面', '目', '眼']),
      body: this.findSentenceWithKeywords(sentences, ['身', '体', '躯', '背']),
      special: this.findSentenceWithKeywords(sentences, ['特殊', '独特', '标志', '最']),
      environment: this.findSentenceWithKeywords(sentences, ['栖息', '生活', '出没'])
    };
  }

  findSentenceWithKeywords(sentences, keywords) {
    for (const sentence of sentences) {
      if (keywords.some(kw => sentence.includes(kw))) {
        return sentence.trim();
      }
    }
    return '';
  }

  /**
   * 生成定妆照配置
   */
  generatePortraitConfig(colors, scale) {
    const colorStr = colors.slice(0, 2).join('');
    
    return {
      model: 'seedream-5-0',
      size: '2K',
      style: `超写实CG渲染，东方神话史诗风格，${colorStr}主色调`,
      background: 'Nirath星球特征环境',
      angles: ['front', 'threeQuarter', 'closeup', 'side'],
      lighting: '史诗级光影，IMAX质感',
      priority: scale === '超巨型' || scale === '巨型' ? 'critical' : 'high'
    };
  }

  /**
   * 提取能力
   */
  extractAbilities(sections) {
    const text = sections.abilities || '';
    const lines = text.split('\n');
    const abilities = [];
    
    for (const line of lines) {
      const match = line.match(/[\-\*]\s*(.+)/);
      if (match) {
        const content = match[1];
        const nameMatch = content.match(/([^：:]+)[：:](.+)/);
        
        if (nameMatch) {
          abilities.push({
            name: nameMatch[1].trim(),
            description: nameMatch[2].trim(),
            visualCue: '',
            nirathSciFi: '',
            sfxTemplate: '',
            rarity: 'epic'
          });
        }
      }
    }
    
    return abilities;
  }

  /**
   * 提取叙事信息
   */
  extractNarrative(sections) {
    return {
      originStory: (sections.stories || '').substring(0, 300),
      keyLegends: this.extractLegends(sections.stories || ''),
      symbolism: this.extractSymbolism(sections.symbolism || ''),
      modernLesson: this.extractModernLesson(sections.symbolism || ''),
      relationships: this.extractRelationships(sections.relations || ''),
      storyArcs: []
    };
  }

  extractLegends(text) {
    const legends = [];
    const matches = text.match(/《[^》]+》/g);
    if (matches) {
      return matches.map(m => m.replace(/[《》]/g, ''));
    }
    return legends;
  }

  extractSymbolism(text) {
    const symbols = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('象征') || line.includes('代表') || line.includes('寓意')) {
        const match = line.match(/["""'']?([^"""''\n]+?)["""'']?/);
        if (match) symbols.push(match[1]);
      }
    }
    
    return symbols.slice(0, 5);
  }

  extractModernLesson(text) {
    const match = text.match(/对现代人.*?["""'']?([^"""''\n]+?)["""'']?/);
    return match ? match[1] : '';
  }

  extractRelationships(text) {
    const relations = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const match = line.match(/(\S{2,6}).*?[与和].*?(\S{2,6})/);
      if (match) {
        relations.push({
          target: this.nameToId(match[2]),
          type: '关联',
          dynamic: match[0]
        });
      }
    }
    
    return relations;
  }

  /**
   * 提取影视信息
   */
  extractProduction(sections) {
    const text = sections.production || '';
    const nirathText = sections.nirath || '';
    
    return {
      visualStyle: {
        referenceFilms: this.extractReferences(text),
        coreConcept: this.extractCoreConcept(text),
        vfxHighlights: this.extractVfxHighlights(text),
        cameraPresets: []
      },
      nirathIntegration: {
        habitatDescription: this.extractHabitatDesc(nirathText),
        sciFiAdaptation: this.extractSciFiAdaptation(nirathText),
        humanRelation: this.extractHumanRelation(nirathText),
        storylines: this.extractStorylines(nirathText)
      }
    };
  }

  extractReferences(text) {
    const matches = text.match(/《[^》]+》/g);
    return matches ? matches.map(m => m.replace(/[《》]/g, '')) : [];
  }

  extractCoreConcept(text) {
    const match = text.match(/核心概念.*?["""'']?([^"""''\n]+?)["""'']?/);
    return match ? match[1] : '';
  }

  extractVfxHighlights(text) {
    const highlights = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('特效') || line.includes('视觉')) {
        highlights.push(line.trim());
      }
    }
    
    return highlights.slice(0, 3);
  }

  extractHabitatDesc(text) {
    const match = text.match(/栖息地.*?["""'']?([^"""''\n]+?)["""'']?/);
    return match ? match[1] : '';
  }

  extractSciFiAdaptation(text) {
    const match = text.match(/外星生态.*?["""'']?([^"""''\n]+?)["""'']?/);
    return match ? match[1] : '';
  }

  extractHumanRelation(text) {
    const match = text.match(/与人类文明.*?["""'']?([^"""''\n]+?)["""'']?/);
    return match ? match[1] : '';
  }

  extractStorylines(text) {
    const lines = [];
    const matches = text.match(/[①②③④⑤⑥].+?[。\n]/g);
    if (matches) {
      return matches.slice(0, 3);
    }
    return lines;
  }

  /**
   * 后处理：自动补全
   */
  enrichBeast(beast) {
    // 补全缺失字段
    if (!beast.visualIdentity.scale) {
      beast.visualIdentity.scale = '大型';
    }
    
    if (!beast.visualIdentity.texture) {
      beast.visualIdentity.texture = '未知';
    }
    
    // 生成ID（如果缺失）
    if (!beast.id && beast.name?.chinese) {
      beast.id = this.nameToId(beast.name.chinese);
    }
    
    // 设置Nirath原生标志
    if (!beast.nirathStatus) {
      beast.nirathStatus = { isNative: true };
    }
  }

  /**
   * 中文名转ID
   */
  nameToId(name) {
    return name
      .toLowerCase()
      .replace(/[\s\u4e00-\u9fa5]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  extractCategory(text) {
    const categories = {
      '时空': '时空主宰',
      '战神': '战神至尊',
      '百鸟': '百鸟之王',
      '仁德': '仁德之兽',
      '智慧': '智慧化身',
      '贪欲': '贪欲之祖',
      '凶': '灾厄之兽',
      '瑞': '祥瑞之兽',
      '守护': '守护神兽'
    };
    
    for (const [key, value] of Object.entries(categories)) {
      if (text.includes(key)) return value;
    }
    
    return '异界灵兽';
  }

  extractEcosystemRole(text) {
    const roles = {
      '调节器': '生态调节器',
      '守护者': '区域守护者',
      '掠食者': '顶级掠食者',
      '预警': '灾厄预警者',
      '智慧': '智慧导师'
    };
    
    for (const [key, value] of Object.entries(roles)) {
      if (text.includes(key)) return value;
    }
    
    return '生态参与者';
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[MDBeastParser] ${msg}`);
    }
  }
}

module.exports = MDBeastParser;

// 测试
if (require.main === module) {
  console.log('📄 MDBeastParser 测试');
  const parser = new MDBeastParser({ verbose: true });
  
  // 模拟MD内容
  const testMD = `
## 【档案01】烛龙

### ① 神兽名称
- **中文名称**：烛龙
- **拼音注音**：Zhú Lóng
- **别名**：烛九阴、烛阴、逴龙、火精

### ② 山海经出处
- **具体篇章**：《山海经·大荒北经》

### ③ 神兽介绍
烛龙，又名烛九阴、烛阴，是中国古代神话中地位最为崇高的神兽之一...

### ④ 神兽外观
人面蛇身而赤，直目正乘，身长千里...

### ⑤ 神兽能力/神通
- **掌控昼夜**：睁眼为白昼，闭眼为黑夜
- **主宰四季**：吹气则寒冬降临
- **呼风唤雨**

### ⑥ 影视创作建议
参考《降临》的巨物美学

### ⑨ 与Nirath星球结合的建议
- **栖息地**：永夜裂谷
- **外星生态**：半能量态生物
  `;
  
  const beast = parser.parse(testMD);
  
  console.log('\n📊 解析结果:');
  console.log(`  ID: ${beast.id}`);
  console.log(`  名称: ${beast.name.chinese}`);
  console.log(`  级别: ${beast.classification.tier}`);
  console.log(`  体型: ${beast.visualIdentity.scale}`);
  console.log(`  颜色: ${beast.visualIdentity.colorPalette.join('/')}`);
  console.log(`  能力数: ${beast.abilities.length}`);
}
