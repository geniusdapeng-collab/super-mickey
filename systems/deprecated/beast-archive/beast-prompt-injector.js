/**
 * Beast Prompt Injector
 * 将神兽档案自动注入Prompt，实现"神兽名→完整视觉描述"的自动展开
 * 
 * 核心能力：
 * 1. 神兽标识符解析（从剧本中提取神兽名）
 * 2. Prompt片段组装（核心特征+环境+风格）
 * 3. 字数智能控制（紧凑40-60字 vs 详细100-120字）
 * 4. 与人类角色的同框处理
 */

const fs = require('fs');
const path = require('path');

const BEAST_DB_PATH = path.join(__dirname, '../beast-database/beasts');
const HABITAT_DB_PATH = path.join(__dirname, '../beast-database/habitats');

class BeastPromptInjector {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.defaultMode = options.mode || 'compact'; // 'compact' | 'detailed'
    this.beastCache = new Map(); // 缓存已加载的神兽档案
  }

  /**
   * 主入口：从剧本文本中提取神兽并注入Prompt
   * @param {string} scriptText - 剧本文本
   * @param {Object} context - 上下文（场景、镜头类型等）
   * @returns {Object} { injectedText, beastsUsed, promptFragments }
   */
  inject(scriptText, context = {}) {
    const beasts = this.extractBeastReferences(scriptText, context);
    const results = [];
    
    for (const beastRef of beasts) {
      const beast = this.loadBeast(beastRef.id);
      if (!beast) {
        this.log(`⚠️ 神兽未找到: ${beastRef.id}`);
        continue;
      }
      
      const fragment = this.buildPromptFragment(beast, context);
      results.push({
        id: beast.id,
        name: beast.name?.chinese || beastRef.id,
        originalText: beastRef.original,
        fragment: fragment,
        mode: context.mode || this.defaultMode
      });
    }
    
    // 替换剧本中的神兽引用为完整描述
    let injectedText = scriptText;
    for (const result of results) {
      // 使用正则替换，保留上下文
      const regex = new RegExp(result.originalText, 'g');
      injectedText = injectedText.replace(regex, result.fragment);
    }
    
    return {
      injectedText,
      beastsUsed: results.map(r => ({ id: r.id, name: r.name })),
      promptFragments: results,
      stats: {
        totalBeasts: beasts.length,
        injected: results.length,
        totalChars: results.reduce((sum, r) => sum + r.fragment.length, 0)
      }
    };
  }

  /**
   * 从文本中提取神兽引用
   * 支持多种引用格式：
   * - 正式名：烛龙、应龙
   * - 别名：烛九阴、烛阴
   * - 昵称：暖暖（帝江）
   * - 描述性引用：那条赤红的巨龙、两团赤红的光芒（烛龙的竖直双目）
   * 
   * 【新增】描述性引用推断：通过颜色+形态+栖息地上下文识别神兽
   */
  extractBeastReferences(text, context = {}) {
    const references = [];
    const beastIndex = this.loadBeastIndex();
    const habitat = context.habitat || '';
    
    // ====== 1. 直接匹配（正式名/别名/昵称）======
    for (const [id, metadata] of Object.entries(beastIndex)) {
      if (text.includes(metadata.name)) {
        references.push({ id, original: metadata.name, matchType: 'name' });
        continue;
      }
      
      for (const alias of metadata.aliases || []) {
        if (text.includes(alias)) {
          references.push({ id, original: alias, matchType: 'alias' });
          break;
        }
      }
    }
    
    // ====== 2. 描述性引用推断（颜色+形态+栖息地）======
    const descriptivePatterns = this.getDescriptivePatterns();
    
    for (const [id, patterns] of Object.entries(descriptivePatterns)) {
      // 如果已通过直接匹配找到，跳过
      if (references.some(r => r.id === id)) continue;
      
      // 检查栖息地上下文匹配（提高准确性）
      const beastMeta = beastIndex[id];
      const habitatMatch = !habitat || !beastMeta?.habitat || 
                           beastMeta.habitat.includes(habitat) || 
                           habitat.includes(beastMeta.habitat);
      
      if (!habitatMatch) continue;
      
      // 检查描述模式匹配
      for (const pattern of patterns) {
        if (pattern.regex.test(text)) {
          references.push({ 
            id, 
            original: pattern.description, 
            matchType: 'descriptive',
            confidence: pattern.confidence || 'medium'
          });
          break;
        }
      }
    }
    
    return references;
  }
  
  /**
   * 描述性引用模式库
   * 颜色+形态+栖息地 → 神兽ID映射
   */
  getDescriptivePatterns() {
    return {
      'zhu-long': [
        { regex: /两团赤红.*光芒|赤红.*双目|竖直.*双目|双目.*睁开|赤红.*光芒.*黑暗|光芒.*越来越大/i, description: '烛龙的竖直双目', confidence: 'high' },
        { regex: /千里.*龙身|赤红.*龙身|赤红.*鳞片|鳞片.*红宝石|人面.*蛇身|龙身.*横亘|巨龙.*横亘/i, description: '烛龙的千里龙身', confidence: 'high' },
        { regex: /永恒.*火精|火精.*燃烧|口中.*衔.*火|衔.*火精|火精.*光芒/i, description: '烛龙口中的永恒火精', confidence: 'high' },
        { regex: /赤红.*巨龙|红色.*巨龙|赤红.*神龙|千里.*神龙|赤色.*巨龙|巨大.*龙身|赤色.*龙身/i, description: '烛龙', confidence: 'medium' },
        { regex: /金色.*泪珠|泪珠.*光点|光点.*额头|千万年.*记忆|眼中.*金色/i, description: '烛龙的金色泪珠', confidence: 'medium' }
      ],
      'ying-long': [
        { regex: /有翼.*之龙|背生.*双翼|翅膀.*龙|飞翔.*龙/i, description: '应龙', confidence: 'high' }
      ],
      'di-jiang': [
        { regex: /暖云.*状.*生物|赤红.*火球|无面.*生物|六足.*四翼|歌声.*燃烧/i, description: '帝江', confidence: 'high' }
      ],
      'bai-ze': [
        { regex: /通晓.*万物|白毛.*神兽|羊身.*独角|知道.*一切/i, description: '白泽', confidence: 'high' }
      ],
      'feng-huang': [
        { regex: /五彩.*神鸟|羽翼.*火焰|凤凰.*涅槃|百鸟.*之王/i, description: '凤凰', confidence: 'high' }
      ]
    };
  }

  /**
   * 构建Prompt片段
   * @param {Object} beast - 神兽档案
   * @param {Object} context - 上下文
   * @returns {string} Prompt片段
   */
  buildPromptFragment(beast, context = {}) {
    const mode = context.mode || this.defaultMode;
    const visual = beast.visualIdentity || {};
    
    if (mode === 'compact') {
      return this.buildCompactFragment(beast, context);
    } else {
      return this.buildDetailedFragment(beast, context);
    }
  }

  /**
   * 紧凑模式：40-60字，适合Prompt字数紧张时使用
   */
  buildCompactFragment(beast, context) {
    const parts = [];
    const visual = beast.visualIdentity || {};
    
    // 1. 核心描述（必须）
    parts.push(visual.coreDescription || `${beast.name?.chinese}神兽`);
    
    // 2. 标志性特征（最多2个）
    const features = visual.signatureFeatures || [];
    if (features.length > 0) {
      parts.push(features.slice(0, 2).join('，'));
    }
    
    // 3. 环境上下文（如果有栖息地信息）
    const habitat = context.habitat || beast.nirathStatus?.habitat;
    if (habitat && context.includeHabitat !== false) {
      parts.push(`栖息于${habitat}`);
    }
    
    return parts.join('，');
  }

  /**
   * 详细模式：100-120字，适合独立神兽特写镜头
   */
  buildDetailedFragment(beast, context) {
    const parts = [];
    const visual = beast.visualIdentity || {};
    const promptFragments = visual.promptFragments || {};
    
    // 1. 完整描述
    parts.push(visual.coreDescription || '');
    
    // 2. 各部位细节
    const bodyParts = ['head', 'body', 'eyes', 'special'];
    for (const part of bodyParts) {
      if (promptFragments[part]) {
        parts.push(promptFragments[part]);
      }
    }
    
    // 3. 标志性特征
    const features = visual.signatureFeatures || [];
    parts.push(...features);
    
    // 4. 环境
    const habitat = context.habitat || beast.nirathStatus?.habitat;
    if (habitat) {
      const habitatDesc = this.loadHabitatDescription(habitat);
      if (habitatDesc) {
        parts.push(habitatDesc);
      }
    }
    
    // 5. 风格
    parts.push('超写实CG渲染，东方神话史诗风格');
    
    return parts.join('，');
  }

  /**
   * 神兽与人类角色同框的特殊处理
   * 当剧本中同时出现神兽和人类角色时，调整Prompt结构
   */
  buildCoexistPrompt(humanCharacter, beast, interaction = '') {
    const beastFragment = this.buildCompactFragment(beast, { includeHabitat: false });
    const humanPrompt = humanCharacter.promptFragment || '';
    
    return {
      composition: `${humanPrompt}与${beastFragment}同框`,
      interaction: interaction || '相互对视，产生情感连接',
      scale: this.calculateScaleRatio(humanCharacter, beast),
      lighting: '主光源统一，避免神兽过亮压过人类角色'
    };
  }

  /**
   * 计算人与神兽的体型比例
   */
  calculateScaleRatio(human, beast) {
    const beastScale = beast.visualIdentity?.scale || 'medium';
    const scaleMap = {
      '微型': 0.1,
      '小型': 0.3,
      '中型': 1,
      '大型': 3,
      '巨型': 10,
      '超巨型': 100
    };
    
    const ratio = scaleMap[beastScale] || 1;
    
    if (ratio > 10) {
      return 'extreme_wide_needed'; // 需要超广角
    } else if (ratio > 3) {
      return 'wide_shot'; // 需要广角
    } else {
      return 'medium_shot_ok'; // 中景即可
    }
  }

  // ============ 数据加载 ============
  
  loadBeast(beastId) {
    if (this.beastCache.has(beastId)) {
      return this.beastCache.get(beastId);
    }
    
    try {
      const filePath = path.join(BEAST_DB_PATH, `${beastId}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.beastCache.set(beastId, data);
      return data;
    } catch (err) {
      this.log(`❌ 加载神兽档案失败: ${beastId} - ${err.message}`);
      return null;
    }
  }

  loadBeastIndex() {
    try {
      const indexPath = path.join(__dirname, '../beast-database/beast-index.json');
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch (err) {
      // 如果索引不存在，动态生成
      return this.generateBeastIndex();
    }
  }

  generateBeastIndex() {
    const index = {};
    try {
      const files = fs.readdirSync(BEAST_DB_PATH);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const data = JSON.parse(fs.readFileSync(path.join(BEAST_DB_PATH, file), 'utf8'));
          index[id] = {
            name: data.name?.chinese || id,
            aliases: data.name?.aliases || [],
            tier: data.classification?.tier || '未知'
          };
        }
      }
      
      // 保存索引
      const indexPath = path.join(__dirname, '../beast-database/beast-index.json');
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    } catch (err) {
      this.log(`⚠️ 生成索引失败: ${err.message}`);
    }
    return index;
  }

  loadHabitatDescription(habitatName) {
    try {
      const habitatId = this.habitatNameToId(habitatName);
      const filePath = path.join(HABITAT_DB_PATH, `${habitatId}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data.description || null;
    } catch (err) {
      return null;
    }
  }

  habitatNameToId(name) {
    // 简单的名称转ID映射
    const map = {
      '永夜裂谷': 'yongye-lieg',
      '青丘灵原': 'qingqiu-lingyuan',
      '云雷高原': 'yunlei-gaoyuan',
      '丹穴山脉': 'danxue-shanmai',
      '百兽草原': 'baishou-caoyuan',
      '智慧之峰': 'zhihui-zhifeng',
      '钩吾废墟': 'gouwu-feixu',
      '邽山裂谷带': 'guishan-liegu',
      '天山空洞': 'tianshan-kongdong',
      '三危荒原': 'sanwei-huangyuan',
      '青丘群岛': 'qingqiu-qundao',
      '双子海沟': 'shuangzi-haigou',
      '怪水三角洲': 'guaishui-sanjiaozhou',
      '阳山荒原': 'yangshan-huangyuan',
      '昆仑链': 'kunlun-lian',
      '槐江高原': 'huaijiang-gaoyuan',
      '单张荒原': 'danzhang-huangyuan',
      '赤晶荒漠': 'chijing-huangmo',
      '香火山脉': 'xianghuo-shanmai',
      '玄冥冰海': 'xuanming-binghai',
      '声骸峡谷': 'shenghai-xiagu',
      '双月荒原': 'shuangyue-huangyuan',
      '厌火高原': 'yanhuo-gaoyuan',
      '太山荒原': 'taishan-huangyuan',
      '景山山脉': 'jingshan-shanmai',
      '谯明荒原': 'qiaoming-huangyuan',
      '银霜高原': 'yinshuang-gaoyuan',
      '赤日火山带': 'chiri-huoshan',
      '焦木林带': 'jiaomu-lindai',
      '雷霆群岛': 'leiting-qundao',
      '翠穹之森': 'cuiqiong-zhisen',
      '敖岸山脉': 'aoan-shanmai',
      '金水带': 'jinshui-dai',
      '黑水区': 'heishui-qu',
      '毒泽星域': 'duze-xingyu',
      '玄圃平原': 'xuanpu-pingyuan',
      '帝之下都': 'dizhi-xiadu'
    };
    return map[name] || name;
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[BeastPromptInjector] ${msg}`);
    }
  }
}

module.exports = BeastPromptInjector;

// 如果直接运行，执行测试
if (require.main === module) {
  console.log('🧪 BeastPromptInjector 测试运行');
  const injector = new BeastPromptInjector({ verbose: true });
  
  // 测试：提取神兽引用
  const testScript = '小G在永夜裂谷遇见了烛龙，烛龙睁开竖直双目照亮黑暗。随后应龙从天而降展开巨翼。';
  const result = injector.inject(testScript, { mode: 'compact' });
  
  console.log('\n📊 测试结果:');
  console.log(`  发现神兽: ${result.stats.totalBeasts}`);
  console.log(`  成功注入: ${result.stats.injected}`);
  console.log(`  总字符数: ${result.stats.totalChars}`);
  console.log('\n📝 注入后文本:');
  console.log(result.injectedText);
}
