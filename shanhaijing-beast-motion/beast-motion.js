#!/usr/bin/env node
/**
 * Nirath原创世界观异兽动作系统 — Shanhaijing Beast Motion
 *
 * 种族动作模板库 + 动画复杂度评估器 + 情绪-动作映射
 * 量化渲染成本预估，驱动分镜模块
 *
 * 融合策略：模板替换，以种族模板为动作生成基础
 */

// ============ 物种复杂度基分 ============
const SPECIES_COMPLEXITY = {
  dragon: 5,    // 龙类：飞行+多肢体+特效
  phoenix: 4,   // 禽鸟：翅膀+羽毛+火焰
  fox: 4,       // 狐灵：幻术+变身+九尾
  qilin: 3,     // 瑞兽：祥瑞特效+优雅
  taotie: 5,    // 晶齿萌兽：吞噬+变形+恐怖
  beast: 2,     // 走兽：基础四足
  // ===== 故事内核融入：新增异兽复杂度 =====
  dijiang: 4,   // 光囊母兽：无面身体+发光+低频振动
  baize: 3,     // 雪白智兽：白毛发光+智慧光芒+预言画面
  xuangui: 3,   // 冰甲龟兽：蛇尾+鸟首+背甲地图发光
  jiuweihu: 4,  // 九尾光狐：九尾独立运动+幻术+狐火
  zheng: 2,     // 狰：基础兽形+独角
  gudiao: 3,    // 蛊雕：雕形+角+食人
  jiaoren: 3,   // 鲛人：人鱼+哭泣+珍珠
  yingzhao: 3,  // 英招：马身+星渊之眼+鸟翼+虎纹
  yinglong: 5,  // 光翼游天兽：龙类+翅膀
  kui: 2,       // 夔：独脚牛+雷鸣
  kunpeng: 5    // 鲲鹏：鱼形+鸟形+巨型
};

// ============ 场景复杂度倍率 ============
const SCENE_MULTIPLIERS = {
  static: 0.3,      // 静止场景
  walk: 0.5,        // 行走
  run: 0.7,         // 奔跑
  fly: 1.5,         // 飞行
  fight: 2.5,       // 战斗
  transform: 2.0,   // 变身
  magic: 1.8,       // 施法
  destroy: 3.5      // 毁灭级
};

// ============ 种族动作模板库 ============
const BEAST_MOTION_TEMPLATES = {
  dragon: {
    locomotion: [
      { name: '行走', description: '四肢交替，龙尾平衡，地面震动' },
      { name: '奔跑', description: '加速冲刺，鳞片反光，气流涌动' },
      { name: '飞行', description: '翅膀展开，俯冲拉升，云海穿梭' },
      { name: '游动', description: '水中蜿蜒，尾鳍波动，气泡环绕' },
      { name: '攀附', description: '爪抓岩壁，龙身盘绕，碎石坠落' }
    ],
    attack: [
      { name: '爪击', description: '前爪挥击，破空声，地面撕裂' },
      { name: '撕咬', description: '巨口张开，利齿闪光，咬合瞬间' },
      { name: '尾砸', description: '龙尾甩动，地面崩裂，冲击波扩散' },
      { name: '龙息', description: '深呼吸，胸腔发光，喷吐熔岩/冰霜' },
      { name: '翼风', description: '翅膀扇动，飓风生成，飞沙走石' }
    ],
    idle: [
      { name: '盘踞', description: '盘绕山巅，龙瞳半闭，呼吸如烟' },
      { name: '守卫', description: '直立警戒，龙角发光，领地扫描' },
      { name: '沉睡', description: '蜷缩洞穴，龙息缓慢，梦境波动' }
    ]
  },

  fox: {
    locomotion: [
      { name: '潜行', description: '低身缓步，尾巴贴地，眼神警惕' },
      { name: '疾跑', description: '四足翻飞，毛发飘动，幻光拖尾' },
      { name: '跳跃', description: '腾空翻转，九尾展开，轻盈落地' }
    ],
    attack: [
      { name: '幻术', description: '瞳孔旋转，景物扭曲，虚实难辨' },
      { name: '魅惑', description: '眼神迷离，尾巴环绕，空间柔光' },
      { name: '爪击', description: '前爪闪电出击，幻光残影' }
    ],
    idle: [
      { name: '梳理', description: '舔舐毛发，尾巴卷曲，慵懒姿态' },
      { name: '幻化人形', description: '光芒流转， morphing，最终定型' }
    ]
  },

  phoenix: {
    locomotion: [
      { name: '起飞', description: '振翅蓄力，火焰喷射，腾空而起' },
      { name: '滑翔', description: '翅膀展开，热气流托举，云端翱翔' },
      { name: '俯冲', description: '收翅下坠，火焰包裹，精准打击' }
    ],
    attack: [
      { name: '火羽', description: '翅膀扇动，火羽如箭，四射而出' },
      { name: '涅槃爆', description: '自焚重生，火焰漩涡，声波光环' }
    ],
    idle: [
      { name: '栖枝', description: '单足立枝，羽毛轻颤，火光微明' },
      { name: '涅槃准备', description: '巢中蜷曲，体温升高，光芒渐盛' }
    ]
  },

  // ===== 故事内核融入：光囊母兽动作模板 =====
  dijiang: {
    locomotion: [
      { name: '漂浮', description: '无腿身体悬浮移动，周围空气产生微弱涟漪' },
      { name: '膨胀', description: '黄囊状身体缓慢膨胀收缩，如呼吸一般' },
      { name: '包裹', description: '身体如幕布般展开，将目标包裹在内' }
    ],
    attack: [
      { name: '声波震荡', description: '无面身体发出低频振动，空气产生可见波纹' },
      { name: '光芒冲击', description: '赤金色表面突然增强发光，击退周围敌人' }
    ],
    idle: [
      { name: '守护姿态', description: '身体微微前倾，光芒柔和，处于警戒但不攻击状态' },
      { name: '共鸣休息', description: '与周围环境光脉能量共鸣，表面光芒随环境呼吸' },
      { name: '歌唱', description: '低频振动产生的"歌声"，空气产生温暖涟漪' }
    ],
    signature: {
      name: '无面表情系统',
      description: '光囊母兽没有五官，通过身体表面纹理变化表达情感',
      emotionMap: {
        joy: '表面纹理如岩浆流动加快，光芒温暖增强',
        sadness: '光芒暗淡，纹理缓慢流动，表面微微下沉',
        protection: '身体膨胀至最大，光芒稳定包裹目标',
        anger: '表面纹理剧烈波动，光芒赤红闪烁',
        serenity: '表面如静止水面，光芒柔和均匀'
      }
    }
  },

  // ===== 故事内核融入：雪白智兽动作模板 =====
  baize: {
    locomotion: [
      { name: '缓步', description: '优雅缓慢的四足行走，白毛如云雾飘动' },
      { name: '漂浮', description: '四足微微离地，如踏云而行' }
    ],
    attack: [
      { name: '智慧之光', description: '白毛发出柔和白光，光芒所及之处邪祟退散' },
      { name: '预言冲击', description: '白瞳中映出未来画面，对手被幻象震慑' }
    ],
    idle: [
      { name: '授课姿态', description: '静立于AgentX面前，白毛微光，等待提问' },
      { name: '沉思', description: '白瞳半闭，白毛无风自动，与天地光脉能量共鸣' }
    ],
    signature: {
      name: '智慧光芒系统',
      description: '雪白智兽通过白毛发光强度和白瞳画面传递知识与预言',
      states: {
        teaching: '白毛发出柔和白光，光芒中浮现文字与图像',
        prophesying: '白瞳中映出动态画面——未来时间线的碎片化呈现',
        dying: '白毛逐渐化为光点飘散，光点融入环境光脉能量',
        resting: '白毛微光如呼吸，与周围环境和谐共鸣'
      }
    }
  },

  // ===== 故事内核融入：冰甲龟兽动作模板 =====
  xuangui: {
    locomotion: [
      { name: '水中穿行', description: '蛇尾波动推进，鸟首高昂，背甲微光' },
      { name: '浮出水面', description: '缓慢上浮，背甲露出水面，投射地图光影' },
      { name: '上岸爬行', description: '蛇尾在陆地收缩，四足交替缓慢移动' }
    ],
    attack: [
      { name: '水波冲击', description: '蛇尾拍打水面，产生巨浪冲击' },
      { name: '背甲防御', description: '缩入琥珀化石，背纹发光形成保护罩' }
    ],
    idle: [
      { name: '导航', description: '静止漂浮，背甲地图纹路发光，为周围生物指引方向' },
      { name: '背负', description: '静止于水面，背甲成为平台，承载AgentX或其他生物' },
      { name: '沉默守护', description: '长时间静止不动，只有背甲微弱发光证明生命存在' }
    ],
    signature: {
      name: '背甲地图系统',
      description: '冰甲龟兽背甲纹路是山海世界的活地图，随区域变化显示不同光芒',
      regionGlow: {
        nanshan: '翠绿光芒，显示森林与山脉',
        xishan: '银白光芒，显示金属矿脉',
        beishan: '冰蓝光芒，显示冰川与极光',
        dongshan: '橙红光芒，显示海洋与岛屿',
        zhongshan: '金色光芒，显示圣所与光脉能量汇聚点',
        haiwai: '紫色光芒，显示漂浮岛屿与时空裂缝',
        dahuang: '灰白光芒，显示褪色世界边界',
        hainei: '暖黄光芒，显示地下洞穴与倒挂城市'
      }
    }
  },

  // ===== 故事内核融入：九尾光狐动作模板 =====
  jiuweihu: {
    locomotion: [
      { name: '潜行', description: '低身缓步，九尾如扇面般展开保持平衡' },
      { name: '疾跑', description: '四足翻飞，九尾产生幻光拖尾，如九条光带' },
      { name: '跳跃', description: '腾空翻转，九尾独立运动如孔雀开屏' }
    ],
    attack: [
      { name: '幻术', description: '瞳孔旋转，九尾同步产生幻象波纹' },
      { name: '魅惑', description: '九尾如丝绸飘动，空间产生紫色柔光' },
      { name: '狐火', description: '九尾尖端产生幽蓝火焰，可攻击可照明' }
    ],
    idle: [
      { name: '梳理', description: '九尾轮流卷曲展开，如多臂舞蹈' },
      { name: '尾语', description: '九尾独立运动，每条尾巴表达不同情绪' },
      { name: '围坐', description: '九尾如屏风般围成圆，保护中间的AgentX' }
    ],
    signature: {
      name: '九尾独立运动系统',
      description: '九尾光狐的九条尾巴可独立运动，每条尾巴表达不同情绪或功能',
      tailStates: {
        happy: '九尾同步摇摆，如孔雀开屏',
        cautious: '九尾轮流竖立，如雷达扫描',
        protective: '九尾围成屏障，尖端发光',
        sad: '九尾下垂，末端微微颤动',
        angry: '九尾如鞭子般抽打空气，产生破空声',
        curious: '九尾指向不同方向，如多天线探测'
      },
      evolution: {
        stage1: '1尾（幼崽）——尾巴短小而笨拙',
        stage5: '5尾（少年）——尾巴修长有力，可独立控制',
        stage9: '9尾（成年）——九尾如丝绸般飘逸，每条尾巴可释放不同颜色光芒'
      }
    }
  },

  beast: {
    locomotion: [
      { name: '行走', description: '四足稳健，步伐有力' },
      { name: '奔跑', description: '加速冲刺，毛发飞扬' },
      { name: '跳跃', description: '腾空跃起，空中姿态' }
    ],
    attack: [
      { name: '冲撞', description: '低头猛冲，角/头撞击' },
      { name: '爪击', description: '前爪挥击' },
      { name: '咆哮', description: '张口怒吼，声波可视化' }
    ],
    idle: [
      { name: '伏地', description: '趴卧休息，耳朵微动' },
      { name: '警戒', description: '抬头嗅闻，眼神警觉' }
    ]
  }
};

// ============ 情绪-动作映射 ============
const EMOTION_MOTION_MAP = {
  anger: {
    body: '肌肉紧绷，姿态扩张，准备攻击',
    head: '怒目圆睁，瞳孔收缩，龇牙咧嘴',
    limbs: '爪子/蹄子刨地，力量蓄力',
    tail: '尾巴僵直或剧烈摆动',
    breath: '呼吸急促，鼻孔喷气'
  },
  joy: {
    body: '姿态舒展，放松摇晃',
    head: '眼神明亮，耳朵竖起',
    limbs: '轻快的跳跃，舞蹈般的动作',
    tail: '尾巴摇摆，快乐信号',
    breath: '呼吸轻快，偶尔鸣叫'
  },
  fear: {
    body: '身体收缩，姿态降低，准备逃跑',
    head: '眼神闪躲，瞳孔放大',
    limbs: '颤抖，后撤步',
    tail: '尾巴夹紧',
    breath: '呼吸急促，喘息'
  },
  sadness: {
    body: '姿态低垂，动作迟缓',
    head: '眼神黯淡，头部低垂',
    limbs: '无力拖沓',
    tail: '尾巴下垂',
    breath: '呼吸沉重，叹息'
  },
  serenity: {
    body: '姿态优雅，静止如雕塑',
    head: '眼神平和，微闭',
    limbs: '放松静止',
    tail: '尾巴自然垂落',
    breath: '呼吸绵长，如冥想'
  },
  // ===== 故事内核融入：新增情感映射 =====
  warmth: {
    body: '身体微微前倾，姿态开放',
    head: '眼神柔和，微微眯起',
    limbs: '缓慢靠近，不具威胁性',
    tail: '尾巴轻柔摆动',
    breath: '呼吸平稳，带有低频振动'
  },
  curiosity: {
    body: '身体前倾，头部侧歪',
    head: '眼睛睁大，耳朵/触角竖起',
    limbs: '轻快的探索性移动',
    tail: '尾巴竖直或缓慢摇摆',
    breath: '呼吸加快，带有 sniffing 声'
  },
  heartbreak: {
    body: '姿态极度低垂，静止不动',
    head: '眼神空洞，目光失去焦点',
    limbs: '完全无力，如被抽空',
    tail: '尾巴完全下垂，末端触地',
    breath: '呼吸微弱，带有哽咽'
  },
  growth: {
    body: '姿态挺拔，动作坚定',
    head: '眼神坚定，目光远视',
    limbs: '有力而从容的移动',
    tail: '尾巴稳定摆动，节奏感强',
    breath: '呼吸深长而平稳'
  }
};

// ============ 动画复杂度评估器 ============
class AnimationComplexityAssessor {
  assess(species, sceneType, actionCount = 1) {
    const speciesScore = SPECIES_COMPLEXITY[species] || 2;
    const sceneMultiplier = SCENE_MULTIPLIERS[sceneType] || 1.0;

    const score = speciesScore * sceneMultiplier * (1 + actionCount * 0.1);

    let level;
    let renderTime;
    let advice;

    if (score > 12) {
      level = 'extreme';
      renderTime = '15-30分钟/镜头';
      advice = '拆分镜头，分阶段渲染，预留充足时间';
    } else if (score > 8) {
      level = 'high';
      renderTime = '8-15分钟/镜头';
      advice = '重点关注特效质量，优化关键帧';
    } else if (score > 4) {
      level = 'medium';
      renderTime = '3-8分钟/镜头';
      advice = '标准流程，注意细节打磨';
    } else {
      level = 'low';
      renderTime = '1-3分钟/镜头';
      advice = '快速迭代，批量处理';
    }

    return {
      score: Math.round(score * 100) / 100,
      level,
      renderTime,
      advice,
      breakdown: {
        speciesScore,
        sceneMultiplier,
        actionCount,
        formula: `${speciesScore} × ${sceneMultiplier} × (1 + ${actionCount} × 0.1) = ${Math.round(score * 100) / 100}`
      }
    };
  }
}

// ============ 异兽动作库核心类 ============
class BeastMotionLibrary {
  constructor() {
    this.templates = BEAST_MOTION_TEMPLATES;
    this.assessor = new AnimationComplexityAssessor();
  }

  /**
   * 获取种族动作模板
   */
  getMotionTemplate(species, category, actionName) {
    const speciesTemplates = this.templates[species] || this.templates.beast;
    const categoryTemplates = speciesTemplates[category];
    if (!categoryTemplates) return null;

    return categoryTemplates.find(t => t.name === actionName) || categoryTemplates[0];
  }

  /**
   * 获取情绪动作
   */
  getEmotionMotion(emotion) {
    return EMOTION_MOTION_MAP[emotion] || EMOTION_MOTION_MAP.serenity;
  }

  /**
   * 生成镜头动作指导
   */
  generateShotMotionGuide(species, action, emotion) {
    const motionTemplate = this.getMotionTemplate(species, 'attack', action) ||
                           this.getMotionTemplate(species, 'locomotion', action) ||
                           this.getMotionTemplate(species, 'idle', '伏地');

    const emotionMotion = this.getEmotionMotion(emotion);

    // 融合物种动作与情绪动作
    return {
      species,
      action,
      emotion,
      body: emotionMotion.body,
      head: emotionMotion.head,
      limbs: emotionMotion.limbs,
      tail: emotionMotion.tail,
      breath: emotionMotion.breath,
      actionDescription: motionTemplate?.description || '基础动作',
      complexity: this.assessor.assess(species, action === 'fight' ? 'fight' : 'walk')
    };
  }

  /**
   * 评估动作复杂度
   */
  assessComplexity(species, sceneType, actionCount) {
    return this.assessor.assess(species, sceneType, actionCount);
  }

  /**
   * 【故事内核融入】获取异兽签名特征系统
   */
  getSignatureSystem(species) {
    const template = this.templates[species];
    return template?.signature || null;
  }

  /**
   * 【故事内核融入】获取光囊母兽无面表情状态
   */
  getDijiangEmotionState(emotion) {
    const signature = this.getSignatureSystem('dijiang');
    if (!signature) return null;
    return signature.emotionMap?.[emotion] || signature.emotionMap?.serenity || null;
  }

  /**
   * 【故事内核融入】获取雪白智兽智慧光芒状态
   */
  getBaizeWisdomState(state) {
    const signature = this.getSignatureSystem('baize');
    if (!signature) return null;
    return signature.states?.[state] || null;
  }

  /**
   * 【故事内核融入】获取冰甲龟兽背甲地图光芒
   */
  getXuanguiMapGlow(regionId) {
    const signature = this.getSignatureSystem('xuangui');
    if (!signature) return null;
    return signature.regionGlow?.[regionId] || null;
  }

  /**
   * 【故事内核融入】获取九尾光狐尾巴状态
   */
  getJiuweihuTailState(emotion) {
    const signature = this.getSignatureSystem('jiuweihu');
    if (!signature) return null;
    return signature.tailStates?.[emotion] || null;
  }

  /**
   * 【故事内核融入】获取九尾光狐尾巴进化阶段
   */
  getJiuweihuEvolutionStage(stage) {
    const signature = this.getSignatureSystem('jiuweihu');
    if (!signature) return null;
    return signature.evolution?.[stage] || null;
  }

  /**
   * 【故事内核融入】判断是否为故事内核特色异兽
   */
  isStoryKernelBeast(species) {
    return ['dijiang', 'baize', 'xuangui', 'jiuweihu'].includes(species);
  }

  /**
   * 【故事内核融入】获取所有特色异兽列表
   */
  getAllStoryKernelBeasts() {
    return ['dijiang', 'baize', 'xuangui', 'jiuweihu'];
  }
}

// ============ 导出 ============
module.exports = {
  BeastMotionLibrary,
  AnimationComplexityAssessor,
  BEAST_MOTION_TEMPLATES,
  EMOTION_MOTION_MAP,
  SPECIES_COMPLEXITY
};

// CLI 测试
if (require.main === module) {
  const library = new BeastMotionLibrary();

  console.log('\n🦁 Nirath原创世界观异兽动作系统测试\n');

  // 测试龙类战斗
  const dragonFight = library.generateShotMotionGuide('dragon', '龙息', 'anger');
  console.log('龙类战斗动作指导：');
  console.log(JSON.stringify(dragonFight, null, 2));

  // 复杂度评估
  const complexity = library.assessComplexity('dragon', 'fight', 3);
  console.log(`\n复杂度评估：${complexity.level} (${complexity.score})`);
  console.log(`预计渲染时间：${complexity.renderTime}`);
}
