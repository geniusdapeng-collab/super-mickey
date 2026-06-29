/**
 * Habitat Knowledge Graph v1.0 — 栖息地知识图谱
 * 系统核心基础设施：建立场景-神兽-生态关系网，防止"天界出现饕餮"错误
 *
 * 职责：
 * - 场景-神兽关系：每个神兽有其栖息地，生成时自动匹配
 * - 生态关系：生物链、共生关系、捕食关系
 * - 环境约束：温度、湿度、光照等环境参数
 * - 文化语义：场景的文化含义（如昆仑=仙境）
 * - 与Prompt Assembly集成：自动注入环境约束到Prompt
 * - 与Narrative Continuity集成：确保场景-叙事一致性
 *
 * 核心能力：
 * 1. HabitatNode: 栖息地节点
 * 2. BeastNode: 神兽节点
 * 3. EcoRelation: 生态关系
 * 4. HabitatKnowledgeGraph: 知识图谱主引擎
 * 5. HabitatValidator: 栖息地验证器
 *
 * 山海经栖息地类型：
 * - 天界: 昆仑、天庭、蓬莱
 * - 海域: 东海、南海、北海
 * - 山林: 不周山、太行山、衡山
 * - 荒漠: 流沙、戈壁、大漠
 * - 沼泽: 云梦泽、洞庭
 * - 秘境: 幽都、归墟、桃林
 *
 * @version v1.0
 * @author Core Team
 * @priority P2 - 山海经专项
 */

'use strict';

const { NirathEventBus } = require('../core/event-bus');

// ============================================================
// 一、山海经栖息地数据
// ============================================================

const HABITAT_DATA = {
  // 天界
  kunlun: {
    id: 'kunlun',
    name: '昆仑',
    type: 'celestial',
    description: '万山之祖，仙境入口',
    climate: '四季如春，祥云缭绕',
    flora: ['灵芝', '玉树', '蟠桃'],
    fauna: ['凤凰', '麒麟', '仙鹤'],
    cultural: '道教圣地，西王母居所',
    visualSignature: '白玉台阶、琼楼玉宇、五彩祥云',
    lighting: '柔和金光，仙气弥漫',
    forbidden: ['饕餮', '穷奇', '混沌'],  // 这些凶兽不应出现在天界
    required: ['仙气', '祥云', '玉质']
  },

  // 海域
  east_sea: {
    id: 'east_sea',
    name: '东海',
    type: 'ocean',
    description: '浩瀚东海，龙宫所在',
    climate: '湿润海风，波涛汹涌',
    flora: ['珊瑚', '海草', '龙宫植物'],
    fauna: ['龙', '鲲', '夜叉'],
    cultural: '龙王居所，仙山漂浮',
    visualSignature: '碧蓝海水、水晶宫、珊瑚礁',
    lighting: '水下折射光，蓝绿色调',
    forbidden: ['火属性神兽'],
    required: ['水元素', '海洋生物']
  },

  // 山林
  buzhou_mountain: {
    id: 'buzhou_mountain',
    name: '不周山',
    type: 'mountain',
    description: '天柱断裂，寒风凛冽',
    climate: '极寒，狂风',
    flora: ['寒松', '雪莲'],
    fauna: ['玄武', '冰蛇'],
    cultural: '天柱遗址，女娲补天之地',
    visualSignature: '断裂山峰、寒冰、风雪',
    lighting: '冷色调，寒风效果',
    forbidden: ['火凤凰'],
    required: ['冰雪', '寒风', '断壁']
  },

  // 荒漠
  liusha: {
    id: 'liusha',
    name: '流沙',
    type: 'desert',
    description: '千里流沙，寸草不生',
    climate: '极干极热，沙尘暴',
    flora: ['仙人掌', '沙棘'],
    fauna: ['沙虫', '蜃'],
    cultural: '死亡之地，幻觉频发',
    visualSignature: '金黄沙海、热浪扭曲、蜃楼',
    lighting: '强烈阳光，金黄色调',
    forbidden: ['水属性神兽'],
    required: ['沙粒', '热浪', '干旱']
  },

  // 沼泽
  yunmeng: {
    id: 'yunmeng',
    name: '云梦泽',
    type: 'swamp',
    description: '千里沼泽，迷雾重重',
    climate: '潮湿闷热，雾气弥漫',
    flora: ['芦苇', '荷花', '毒蘑菇'],
    fauna: ['蛟龙', '水蛇', '蜃'],
    cultural: '楚地秘境，屈原放逐之地',
    visualSignature: '绿色沼泽、迷雾、芦苇荡',
    lighting: '朦胧绿光，雾气效果',
    forbidden: ['火属性神兽'],
    required: ['水雾', '绿色调', '湿地']
  },

  // 幽都
  youdu: {
    id: 'youdu',
    name: '幽都',
    type: 'underworld',
    description: '地下幽都，鬼魂居所',
    climate: '阴冷，无光',
    flora: ['彼岸花', '幽冥草'],
    fauna: ['鬼差', '阴兵', '黄泉'],
    cultural: '死后世界，轮回入口',
    visualSignature: '暗红光芒、骨制建筑、幽冥火',
    lighting: '暗红绿光，幽暗氛围',
    forbidden: ['凤凰', '麒麟'],
    required: ['幽暗', '阴森', '鬼火']
  }
};

// 神兽栖息地映射
const BEAST_HABITAT_MAP = {
  '饕餮': ['liusha', 'desert', 'wilderness'],
  '穷奇': ['buzhou_mountain', 'wilderness', 'youdu'],
  '混沌': ['void', 'youdu', 'chaos'],
  '梼杌': ['river', 'flood', 'east_sea'],
  '麒麟': ['kunlun', 'celestial', 'forest'],
  '凤凰': ['kunlun', 'volcano', 'sacred_tree'],
  '玄武': ['north_sea', 'buzhou_mountain', 'cold_water'],
  '青龙': ['east_sea', 'mountain', 'cloud'],
  '白虎': ['west_mountain', 'metal', 'autumn'],
  '朱雀': ['volcano', 'south', 'fire'],
  '刑天': ['battlefield', 'wilderness', 'ancient'],
  '帝江': ['chaos', 'void', 'primordial'],
  '应龙': ['east_sea', 'cloud', 'storm'],
  '烛龙': ['underground', 'darkness', 'mountain'],
  '夔牛': ['east_sea', 'storm', 'island'],
  '白泽': ['kunlun', 'sacred', 'forest'],
  '九尾狐': ['qingqiu', 'forest', 'mist'],
  '毕方': ['forest', 'fire', 'bamboo'],
  '重明鸟': ['sacred', 'light', 'kunlun'],
  '天狗': ['moon', 'night', 'eclipse'],
  '当康': ['field', 'harvest', 'village'],
  '狻猊': ['temple', 'incense', 'lion'],
  '睚眦': ['weapon', 'battle', 'bridge'],
  '狴犴': ['prison', 'justice', 'court'],
  '负屃': ['stone', 'writing', 'mountain'],
  '螭吻': ['roof', 'water', 'temple'],
  '貔貅': ['treasure', 'mountain', 'cave'],
  '椒图': ['gate', 'shell', 'protection'],
  '蒲牢': ['bell', 'temple', 'ocean'],
  '囚牛': ['music', 'instrument', 'zither'],
  '嘲风': ['roof', 'wind', 'adventure'],
  '狴犴': ['law', 'prison', 'judge']
};

// ============================================================
// 二、栖息地节点
// ============================================================

class HabitatNode {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.description = data.description;
    this.climate = data.climate;
    this.flora = data.flora || [];
    this.fauna = data.fauna || [];
    this.cultural = data.cultural;
    this.visualSignature = data.visualSignature;
    this.lighting = data.lighting;
    this.forbidden = data.forbidden || [];
    this.required = data.required || [];
    this.connections = new Map(); // 连接的栖息地
  }

  addConnection(habitatId, relation) {
    this.connections.set(habitatId, relation);
  }

  getPromptContext() {
    return `${this.name}：${this.description}。${this.climate}。${this.visualSignature}。${this.lighting}`;
  }

  validateBeast(beastName) {
    const habitats = BEAST_HABITAT_MAP[beastName] || [];
    const isValid = habitats.includes(this.id) || habitats.includes(this.type);
    
    if (!isValid) {
      const forbidden = this.forbidden.some(f => beastName.includes(f));
      return { valid: false, reason: forbidden ? '栖息地禁忌' : '栖息地不匹配' };
    }
    
    return { valid: true };
  }
}

// ============================================================
// 三、生态关系
// ============================================================

class EcoRelation {
  constructor({ from, to, type, description }) {
    this.from = from;  // 主体
    this.to = to;      // 客体
    this.type = type;  // predator, prey, symbiosis, competition, neutral
    this.description = description;
  }

  getRelationType() {
    const types = {
      predator: '捕食',
      prey: '被捕食',
      symbiosis: '共生',
      competition: '竞争',
      neutral: '中性'
    };
    return types[this.type] || '未知';
  }
}

// ============================================================
// 四、栖息地知识图谱
// ============================================================

class HabitatKnowledgeGraph {
  constructor() {
    this.habitats = new Map();
    this.beasts = new Map();
    this.relations = [];
    this.eventBus = new NirathEventBus({ name: 'habitat', enabled: true });
    this.initDefaultData();
  }

  initDefaultData() {
    // 加载默认栖息地
    for (const data of Object.values(HABITAT_DATA)) {
      this.habitats.set(data.id, new HabitatNode(data));
    }

    // 建立连接关系
    this.addConnection('kunlun', 'east_sea', 'spatial', '仙境与海域相邻');
    this.addConnection('east_sea', 'yunmeng', 'water', '水系相连');
    this.addConnection('buzhou_mountain', 'youdu', 'spatial', '山脚通往幽都');
    this.addConnection('liusha', 'yunmeng', 'opposite', '沙漠与沼泽对立');
  }

  addConnection(fromId, toId, type, description) {
    const from = this.habitats.get(fromId);
    const to = this.habitats.get(toId);
    if (from && to) {
      from.addConnection(toId, { type, description });
      to.addConnection(fromId, { type, description });
    }
  }

  /**
   * 获取栖息地
   */
  getHabitat(id) {
    return this.habitats.get(id);
  }

  /**
   * 根据神兽获取推荐栖息地
   */
  getRecommendedHabitats(beastName) {
    const habitatIds = BEAST_HABITAT_MAP[beastName] || [];
    return habitatIds.map(id => this.habitats.get(id)).filter(Boolean);
  }

  /**
   * 验证场景-神兽匹配
   */
  validateBeastHabitat(beastName, habitatId) {
    const habitat = this.habitats.get(habitatId);
    if (!habitat) {
      return { valid: false, reason: '未知栖息地' };
    }

    return habitat.validateBeast(beastName);
  }

  /**
   * 获取环境约束（用于Prompt注入）
   */
  getEnvironmentConstraints(habitatId, beastName) {
    const habitat = this.habitats.get(habitatId);
    if (!habitat) return null;

    const constraints = {
      required: [...habitat.required],
      forbidden: [...habitat.forbidden],
      visual: habitat.visualSignature,
      lighting: habitat.lighting,
      climate: habitat.climate
    };

    // 添加神兽特定约束
    const beastHabitats = BEAST_HABITAT_MAP[beastName] || [];
    if (!beastHabitats.includes(habitatId)) {
      constraints.warning = `${beastName} 通常不出现在 ${habitat.name}`;
    }

    return constraints;
  }

  /**
   * 生成栖息地Prompt片段
   */
  generateHabitatPrompt(habitatId, beastName) {
    const habitat = this.habitats.get(habitatId);
    if (!habitat) return '';

    const validation = this.validateBeastHabitat(beastName, habitatId);
    const context = habitat.getPromptContext();
    
    let prompt = `【场景环境】${context}`;
    
    if (!validation.valid) {
      prompt += `（⚠️ 注意：${validation.reason}）`;
    }
    
    if (habitat.required.length > 0) {
      prompt += `【必须包含】${habitat.required.join('、')}`;
    }
    
    if (habitat.forbidden.length > 0) {
      prompt += `【禁止出现】${habitat.forbidden.join('、')}`;
    }

    return prompt;
  }

  /**
   * 添加神兽
   */
  addBeast(name, habitatIds) {
    this.beasts.set(name, habitatIds);
    BEAST_HABITAT_MAP[name] = habitatIds;
  }

  /**
   * 添加生态关系
   */
  addEcoRelation(relation) {
    this.relations.push(relation);
    this.eventBus.publish('habitat.relation.added', {
      from: relation.from,
      to: relation.to,
      type: relation.type
    }, { traceId: `habitat_${Date.now()}` });
  }

  /**
   * 获取生态关系
   */
  getEcoRelations(beastName) {
    return this.relations.filter(r => r.from === beastName || r.to === beastName);
  }

  /**
   * 获取栖息地网络
   */
  getHabitatNetwork(habitatId, depth = 1) {
    const habitat = this.habitats.get(habitatId);
    if (!habitat) return null;

    const network = {
      id: habitatId,
      name: habitat.name,
      connections: []
    };

    for (const [connectedId, relation] of habitat.connections) {
      const connected = this.habitats.get(connectedId);
      if (connected) {
        network.connections.push({
          id: connectedId,
          name: connected.name,
          relation: relation.type,
          description: relation.description
        });
      }
    }

    return network;
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      totalHabitats: this.habitats.size,
      totalBeasts: this.beasts.size,
      totalRelations: this.relations.length,
      habitatTypes: Array.from(new Set(Array.from(this.habitats.values()).map(h => h.type)))
    };
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  HabitatKnowledgeGraph,
  HabitatNode,
  EcoRelation,
  HABITAT_DATA,
  BEAST_HABITAT_MAP,

  // 快速创建
  createHabitatGraph: () => new HabitatKnowledgeGraph()
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Habitat Knowledge Graph 集成测试 ===\n');

    const graph = new HabitatKnowledgeGraph();

    // 测试1：获取栖息地
    console.log('--- 测试1：获取栖息地 ---');
    const kunlun = graph.getHabitat('kunlun');
    console.log('昆仑:', kunlun.name, kunlun.type);
    console.log('视觉特征:', kunlun.visualSignature);

    // 测试2：验证神兽栖息地
    console.log('\n--- 测试2：验证神兽栖息地 ---');
    const taotieValid = graph.validateBeastHabitat('饕餮', 'liusha');
    console.log('饕餮在流沙:', taotieValid.valid ? '✅' : '❌', taotieValid.reason || '');

    const taotieInvalid = graph.validateBeastHabitat('饕餮', 'kunlun');
    console.log('饕餮在昆仑:', taotieInvalid.valid ? '✅' : '❌', taotieInvalid.reason || '');

    // 测试3：获取推荐栖息地
    console.log('\n--- 测试3：获取推荐栖息地 ---');
    const recommendations = graph.getRecommendedHabitats('饕餮');
    console.log('饕餮推荐栖息地:', recommendations.map(h => h?.name).filter(Boolean));

    // 测试4：生成Prompt片段
    console.log('\n--- 测试4：生成Prompt片段 ---');
    const prompt = graph.generateHabitatPrompt('liusha', '饕餮');
    console.log('Prompt片段:', prompt.substring(0, 100) + '...');

    // 测试5：环境约束
    console.log('\n--- 测试5：环境约束 ---');
    const constraints = graph.getEnvironmentConstraints('liusha', '饕餮');
    console.log('约束:', constraints);

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
