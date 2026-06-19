# 卓越系统 (zhuoyue-system) - DOMAIN 模块

> 导出时间: 2026-06-18T07:15:48.341Z

---

## domain/habitat-knowledge-graph.js

> 文件大小: 14679 bytes

```javascript
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
 * @author 小G
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

```

---

## domain/sound-visual-binding.js

> 文件大小: 14742 bytes

```javascript
/**
 * Sound-Visual Binding System v1.0 — 声画绑定系统
 * 系统核心基础设施：基于场景描述自动推荐音频，并生成音频规格
 *
 * 职责：
 * - 音频推荐：基于场景描述自动推荐音频素材（音乐、音效、环境音）
 * - 音频规格生成：生成音频规格参数（音量、淡入淡出、循环）
 * - 场景-音频映射：场景类型与音频的映射关系
 * - 音效绑定：镜头与音效的绑定关系
 * - 与Prompt Assembly集成：音频描述注入到Prompt
 * - 与Event Bus集成：发布音频事件
 *
 * 核心能力：
 * 1. AudioAsset: 音频资产定义
 * 2. AudioBinding: 声画绑定关系
 * 3. AudioSpec: 音频规格参数
 * 4. SoundVisualBindingSystem: 主系统
 * 5. AudioRecommendation: 音频推荐引擎
 *
 * 音频类型：
 * - background_music: 背景音乐
 * - ambient_sound: 环境音（风声、雨声、鸟鸣）
 * - sound_effect: 音效（战斗、魔法、脚步）
 * - voice_over: 旁白/配音
 * - foley: 拟音（衣物摩擦、脚步声）
 *
 * 场景-音频映射：
 * - 山顶: 风声、鹰鸣、空灵感音乐
 * - 山谷: 溪流、鸟鸣、回声
 * - 海边: 海浪、海鸥、潮汐声
 * - 森林: 树叶沙沙、虫鸣、神秘音乐
 * - 战场: 金属碰撞、呐喊、战鼓
 * - 仙境: 仙乐、铃铛、祥云音效
 * - 幽都: 阴森音乐、鬼哭、锁链声
 * - 沙漠: 风沙、寂静、驼铃
 *
 * @version v1.0
 * @author 小G
 * @priority P2 - 山海经专项
 */

'use strict';

const { NirathEventBus } = require('../core/event-bus');

// ============================================================
// 一、音频资产定义
// ============================================================

const AUDIO_TYPES = {
  background_music: { name: '背景音乐', layer: 1, priority: 'low' },
  ambient_sound: { name: '环境音', layer: 2, priority: 'medium' },
  sound_effect: { name: '音效', layer: 3, priority: 'high' },
  voice_over: { name: '旁白', layer: 4, priority: 'highest' },
  foley: { name: '拟音', layer: 5, priority: 'medium' }
};

// 场景-音频映射
const SCENE_AUDIO_MAP = {
  '山顶': {
    ambient: ['风声', '鹰鸣', '远处回声'],
    music: ['空灵', '史诗', '宏大'],
    effects: ['脚步碎石', '衣袂飘动']
  },
  '山谷': {
    ambient: ['溪流', '鸟鸣', '回声'],
    music: ['自然', '宁静', '神秘'],
    effects: ['脚步草地', '树枝断裂']
  },
  '海边': {
    ambient: ['海浪', '海鸥', '潮汐'],
    music: ['悠扬', '忧郁', '宽广'],
    effects: ['脚步沙滩', '水花溅起']
  },
  '森林': {
    ambient: ['树叶沙沙', '虫鸣', '远处兽吼'],
    music: ['神秘', '紧张', '异域'],
    effects: ['脚步落叶', '树枝摩擦']
  },
  '战场': {
    ambient: ['远处呐喊', '金属碰撞', '战鼓'],
    music: ['激昂', '紧张', '悲壮'],
    effects: ['剑击', '爆炸', '马蹄']
  },
  '仙境': {
    ambient: ['仙乐', '铃铛', '祥云'],
    music: ['仙气', '飘渺', '神圣'],
    effects: ['仙气流动', '祥云飘动']
  },
  '幽都': {
    ambient: ['阴森音乐', '鬼哭', '锁链'],
    music: ['恐怖', '压抑', '诡异'],
    effects: ['鬼魂飘动', '锁链拖动']
  },
  '沙漠': {
    ambient: ['风沙', '寂静', '驼铃'],
    music: ['荒凉', '孤独', '异域'],
    effects: ['脚步沙地', '风声呼啸']
  },
  '沼泽': {
    ambient: ['水泡', '昆虫', '迷雾'],
    music: ['阴郁', '危险', '神秘'],
    effects: ['脚步泥泞', '水花']
  },
  '城市': {
    ambient: ['人声', '车马', '叫卖'],
    music: ['热闹', '繁华', '市井'],
    effects: ['脚步石板', '门开关']
  }
};

// 神兽-音频映射
const BEAST_AUDIO_MAP = {
  '饕餮': { effects: ['咀嚼', '低吼', '地面震动'], music: ['恐怖', '压迫'] },
  '麒麟': { effects: ['祥瑞之光', '仙气环绕'], music: ['神圣', '祥和'] },
  '凤凰': { effects: ['凤鸣', '火焰', '翅膀扇动'], music: ['神圣', '热烈'] },
  '青龙': { effects: ['龙吟', '水波', '云雾'], music: ['威严', '古老'] },
  '白虎': { effects: ['虎啸', '风声', '金属'], music: ['肃杀', '勇猛'] },
  '玄武': { effects: ['龟息', '水波', '沉稳'], music: ['厚重', '古老'] },
  '朱雀': { effects: ['鸟鸣', '火焰', '热浪'], music: ['热烈', '神圣'] },
  '刑天': { effects: ['战斗呐喊', '武器碰撞', '脚步'], music: ['激昂', '悲壮'] },
  '帝江': { effects: ['混沌', '空间扭曲', '无形'], music: ['神秘', '原始'] },
  '应龙': { effects: ['龙吟', '雷鸣', '风暴'], music: ['威严', '磅礴'] },
  '烛龙': { effects: ['呼吸', '火焰', '睁眼'], music: ['古老', '神秘'] },
  '夔牛': { effects: ['牛吼', '雷鸣', '震地'], music: ['原始', '力量'] },
  '白泽': { effects: ['祥瑞', '智慧', '低语'], music: ['神圣', '智慧'] },
  '九尾狐': { effects: ['狐鸣', '幻术', '魅惑'], music: ['魅惑', '神秘'] },
  '毕方': { effects: ['鸟鸣', '火焰', '单足'], music: ['热烈', '神秘'] }
};

// ============================================================
// 二、音频规格
// ============================================================

class AudioSpec {
  constructor({ type, volume, fadeIn, fadeOut, loop, duration, delay, pan, reverb }) {
    this.type = type;
    this.volume = volume ?? 0.8;           // 0-1
    this.fadeIn = fadeIn ?? 0;            // 淡入时间（秒）
    this.fadeOut = fadeOut ?? 0;          // 淡出时间（秒）
    this.loop = loop ?? false;            // 是否循环
    this.duration = duration ?? null;    // 持续时间（秒）
    this.delay = delay ?? 0;              // 延迟播放（秒）
    this.pan = pan ?? 0;                  // 声像 -1(左) 到 1(右)
    this.reverb = reverb ?? 0;            // 混响 0-1
  }

  toJSON() {
    return {
      type: this.type,
      volume: this.volume,
      fadeIn: this.fadeIn,
      fadeOut: this.fadeOut,
      loop: this.loop,
      duration: this.duration,
      delay: this.delay,
      pan: this.pan,
      reverb: this.reverb
    };
  }
}

// ============================================================
// 三、声画绑定
// ============================================================

class AudioBinding {
  constructor({ shotId, audioId, audioType, spec, startTime, endTime }) {
    this.id = `binding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.shotId = shotId;
    this.audioId = audioId;
    this.audioType = audioType;
    this.spec = spec || new AudioSpec({ type: audioType });
    this.startTime = startTime || 0;
    this.endTime = endTime || null;
  }

  toJSON() {
    return {
      id: this.id,
      shotId: this.shotId,
      audioId: this.audioId,
      audioType: this.audioType,
      spec: this.spec.toJSON(),
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
}

// ============================================================
// 四、声画绑定系统
// ============================================================

class SoundVisualBindingSystem {
  constructor() {
    this.bindings = new Map();  // shotId -> Array<AudioBinding>
    this.audioLibrary = new Map(); // audioId -> AudioAsset
    this.eventBus = new NirathEventBus({ name: 'sound-visual', enabled: true });
  }

  /**
   * 基于场景推荐音频
   */
  recommendAudio(shot) {
    const scene = shot.scene || shot.sceneName || '';
    const beastName = this.extractBeastName(shot);
    const recommendations = [];

    // 场景推荐
    for (const [sceneKey, audioSet] of Object.entries(SCENE_AUDIO_MAP)) {
      if (scene.includes(sceneKey)) {
        recommendations.push(...this.createRecommendations(sceneKey, audioSet, 'scene'));
      }
    }

    // 神兽推荐
    if (beastName && BEAST_AUDIO_MAP[beastName]) {
      recommendations.push(...this.createRecommendations(beastName, BEAST_AUDIO_MAP[beastName], 'beast'));
    }

    // 去重
    const unique = new Map();
    for (const rec of recommendations) {
      unique.set(rec.name, rec);
    }

    return Array.from(unique.values());
  }

  extractBeastName(shot) {
    const prompt = shot.visualPrompt || '';
    const beasts = Object.keys(BEAST_AUDIO_MAP);
    return beasts.find(b => prompt.includes(b));
  }

  createRecommendations(source, audioSet, type) {
    const recommendations = [];
    
    if (audioSet.ambient) {
      for (const name of audioSet.ambient) {
        recommendations.push({
          name: `${name}（环境音）`,
          type: 'ambient_sound',
          source,
          sourceType: type,
          spec: new AudioSpec({ type: 'ambient_sound', volume: 0.4, loop: true, fadeIn: 1, fadeOut: 1 })
        });
      }
    }
    
    if (audioSet.music) {
      for (const name of audioSet.music) {
        recommendations.push({
          name: `${name}（背景音乐）`,
          type: 'background_music',
          source,
          sourceType: type,
          spec: new AudioSpec({ type: 'background_music', volume: 0.6, loop: true, fadeIn: 2, fadeOut: 2 })
        });
      }
    }
    
    if (audioSet.effects) {
      for (const name of audioSet.effects) {
        recommendations.push({
          name: `${name}（音效）`,
          type: 'sound_effect',
          source,
          sourceType: type,
          spec: new AudioSpec({ type: 'sound_effect', volume: 0.8, loop: false, fadeIn: 0.1, fadeOut: 0.5 })
        });
      }
    }

    return recommendations;
  }

  /**
   * 绑定音频到镜头
   */
  bindAudio(shotId, audioId, audioType, options = {}) {
    const spec = options.spec || new AudioSpec({ type: audioType });
    const binding = new AudioBinding({
      shotId,
      audioId,
      audioType,
      spec,
      startTime: options.startTime || 0,
      endTime: options.endTime || null
    });

    if (!this.bindings.has(shotId)) {
      this.bindings.set(shotId, []);
    }
    this.bindings.get(shotId).push(binding);

    this.eventBus.publish('audio.bound', {
      shotId,
      audioId,
      audioType
    }, { traceId: `svb_${Date.now()}` });

    return binding;
  }

  /**
   * 获取镜头的音频绑定
   */
  getBindings(shotId) {
    return this.bindings.get(shotId) || [];
  }

  /**
   * 生成音频规格（基于镜头和音频）
   */
  generateAudioSpec(shot, audioType, recommendations) {
    const spec = new AudioSpec({ type: audioType });

    // 根据镜头时长调整
    const duration = shot.duration || 5;
    spec.duration = duration;

    // 根据镜头类型调整音量
    if (shot.type === 'close-up') {
      spec.volume = 0.6;  // 特写镜头降低音量，突出对话
      spec.reverb = 0.2;
    } else if (shot.type === 'establishing') {
      spec.volume = 0.8;  // 建景镜头增加音量，营造氛围
      spec.reverb = 0.5;
    }

    // 根据情绪调整
    if (shot.emotionPhase === 'climax') {
      spec.volume = 0.9;  // 高潮增加音量
      spec.fadeIn = 0.5;
    } else if (shot.emotionPhase === 'exposition') {
      spec.volume = 0.5;  // 铺垫降低音量
      spec.fadeIn = 2;
    }

    return spec;
  }

  /**
   * 生成完整音频绑定方案
   */
  generateAudioPlan(shot) {
    const recommendations = this.recommendAudio(shot);
    const bindings = [];

    for (const rec of recommendations) {
      const spec = this.generateAudioSpec(shot, rec.type, rec);
      const binding = this.bindAudio(
        shot.id || shot.shotId,
        rec.name,
        rec.type,
        { spec }
      );
      bindings.push(binding);
    }

    return {
      shotId: shot.id || shot.shotId,
      bindings: bindings.map(b => b.toJSON()),
      recommendations: recommendations.map(r => ({
        name: r.name,
        type: r.type,
        source: r.source
      }))
    };
  }

  /**
   * 生成音频描述（注入Prompt）
   */
  generateAudioPrompt(shot) {
    const recommendations = this.recommendAudio(shot);
    const audioDesc = recommendations.map(r => r.name).join('，');
    
    if (audioDesc) {
      return `【音频环境】${audioDesc}`;
    }
    return '';
  }

  /**
   * 获取统计
   */
  getStats() {
    const totalBindings = Array.from(this.bindings.values()).reduce((sum, arr) => sum + arr.length, 0);
    const byType = {};
    
    for (const bindings of this.bindings.values()) {
      for (const binding of bindings) {
        byType[binding.audioType] = (byType[binding.audioType] || 0) + 1;
      }
    }

    return {
      totalBindings,
      totalShots: this.bindings.size,
      byType
    };
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  SoundVisualBindingSystem,
  AudioBinding,
  AudioSpec,
  SCENE_AUDIO_MAP,
  BEAST_AUDIO_MAP,
  AUDIO_TYPES,

  // 快速创建
  createSoundVisualBinding: () => new SoundVisualBindingSystem()
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Sound-Visual Binding System 集成测试 ===\n');

    const svb = new SoundVisualBindingSystem();

    // 测试1：场景推荐
    console.log('--- 测试1：场景推荐 ---');
    const shot1 = {
      id: 'S01',
      scene: '山顶',
      visualPrompt: '少年穿着白衣站在山顶，饕餮在远处咆哮',
      duration: 5,
      type: 'climax',
      emotionPhase: 'climax'
    };
    const recs = svb.recommendAudio(shot1);
    console.log('推荐音频数:', recs.length);
    console.log('推荐:', recs.map(r => r.name).slice(0, 5).join(', '));

    // 测试2：音频绑定
    console.log('\n--- 测试2：音频绑定 ---');
    const binding = svb.bindAudio('S01', 'wind_ambient', 'ambient_sound', {
      spec: new AudioSpec({ type: 'ambient_sound', volume: 0.5, loop: true })
    });
    console.log('绑定ID:', binding.id);
    console.log('绑定类型:', binding.audioType);

    // 测试3：生成音频方案
    console.log('\n--- 测试3：生成音频方案 ---');
    const plan = svb.generateAudioPlan(shot1);
    console.log('方案绑定数:', plan.bindings.length);
    console.log('绑定类型:', plan.bindings.map(b => b.audioType).join(', '));

    // 测试4：音频Prompt
    console.log('\n--- 测试4：音频Prompt ---');
    const audioPrompt = svb.generateAudioPrompt(shot1);
    console.log('音频Prompt:', audioPrompt);

    // 测试5：统计
    console.log('\n--- 测试5：统计 ---');
    console.log(svb.getStats());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

