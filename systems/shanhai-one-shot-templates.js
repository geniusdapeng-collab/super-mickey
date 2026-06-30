#!/usr/bin/env node
/**
 * 【系统级】山海经系列一镜到底场景模板库
 * 
 * 职责：
 * 1. 存储所有山海经系列的一镜到底场景设计
 * 2. 支持按异兽/场景/情绪自动匹配
 * 3. 新剧集生成时自动调用，无需人工配置
 * 
 * 调用时机：导演系统生成剧集计划时，自动注入一镜到底镜头
 * 集成方式：WorldviewConsistencyEngine → 自动调用
 */

const { ExperiencePackSelector } = require('./fpv-experience-library.js');

// ========== 山海经一镜到底场景模板库 ==========
const SHANHAI_ONE_SHOT_TEMPLATES = {
  // 模板元数据
  metadata: {
    name: '山海经系列一镜到底场景模板库',
    version: '1.0',
    lastUpdated: '2026-05-22',
    totalTemplates: 5,
    // 每个异兽必须有一个一镜到底场景
    mandatoryRule: '每集山海经片子必须包含至少1个一镜到底镜头'
  },

  // 按异兽分类的模板
  templates: {
    // ====== 帝江/暖暖 ======
    'nuanNuan': {
      beastId: '帝江',
      beastName: '暖暖',
      templateId: 'SH-01',
      name: '青丘灵原飞行 — 温暖初见',
      
      // 参考经验包
      experiencePack: {
        primary: 'PACK-02',   // 精灵乐园（微观飞行+温暖）
        secondary: 'PACK-14'  // 迷路蜜蜂（家居穿行+金色光线）
      },
      
      // 场景设计
      scene: {
        setting: '青丘灵原最深处',
        timeOfDay: '双恒星日落（一橙一紫）',
        environment: '荧光高草如参天发光树林，孢子植物如水母漂浮',
        atmosphere: '温暖、神秘、初见异世界'
      },
      
      // 镜头设计
      camera: {
        perspective: 'Micro-POV（微观第一人称）',
        lens: '8mm鱼眼',
        movement: '低空穿越荧光高草，跟随暖暖四片金色翅膀',
        speed: 'silky（丝滑）→ sudden（突然加速）',
        dutchAngle: '15°倾斜，营造梦幻感',
        keyFrame: '草叶荧光随镜头经过一明一灭，如大地呼吸'
      },
      
      // 节奏（五段式）
      rhythm: {
        phase1: '0-2秒：缓慢推入草丛，荧光渐亮',
        phase2: '2-4秒：加速穿越，草叶如森林掠过',
        phase3: '4-6秒：发现暖暖，盘旋上升',
        phase4: '6-8秒：跟随飞行，金色翅膀照亮前方',
        phase5: '8-10秒：突然拉高，看见整片发光草原，戛然而止'
      },
      
      // 声音设计
      sound: {
        type: 'Diegetic',
        elements: ['草叶摩擦声', '荧光孢子释放的微弱爆裂声', '暖暖翅膀的柔和嗡鸣'],
        noMusic: true,
        noNarration: true
      },
      
      // 视觉锚点（山海经原文）
      shanhaijingAnchor: '天山有神焉，其状如黄囊，赤如丹火，六足四翼',
      nirathAnchor: '双恒星日落下，光雾生物在荧光草原上漂浮',
      
      // 情绪映射
      emotion: {
        dominant: '温暖/神秘',
        arc: '初见 → 惊叹 → 亲近',
        protagonistFeeling: '我觉得...这里好像梦里来过'
      },
      
      // 核心主题句
      coreTheme: '记忆即存在。看见即救赎。'
    },

    // ====== 烛龙/太素 ======
    'zhuLong': {
      beastId: '烛龙',
      beastName: '太素',
      templateId: 'SH-02',
      name: '太素崩坏 — 维度裂缝穿越',
      
      experiencePack: {
        primary: 'PACK-06',   // 海啸（能量体+光芒吞没）
        secondary: 'PACK-03' // 交易风暴（信息过载灾难美学）
      },
      
      scene: {
        setting: '太素崩坏现场',
        timeOfDay: '黄昏→黑夜突变',
        environment: '天空撕裂的维度裂缝，能量如瀑布倾泻，光粒如雨',
        atmosphere: '末日、史诗、敬畏'
      },
      
      camera: {
        perspective: 'POV（第一人称）',
        lens: '10mm超广角',
        movement: '穿越能量风暴，螺旋上升沿光柱边缘',
        speed: 'fast（快速）→ extreme（极限）',
        dutchAngle: '35°倾斜，营造失控感',
        keyFrame: '穿越裂缝瞬间，看见两个世界叠加'
      },
      
      rhythm: {
        phase1: '0-1秒：能量风暴爆发，瞬间加速',
        phase2: '1-3秒：穿越光粒雨，擦碰能量漩涡',
        phase3: '3-5秒：空间收窄，裂缝逼近',
        phase4: '5-7秒：穿越维度裂缝，世界叠加',
        phase5: '7-10秒：沿归元光柱螺旋上升，戛然而止'
      },
      
      sound: {
        type: 'Diegetic',
        elements: ['能量撕裂的轰鸣', '光粒爆裂的噼啪声', '空间扭曲的低频嗡鸣'],
        noMusic: true,
        noNarration: true
      },
      
      shanhaijingAnchor: '钟山之神，名曰烛阴，视为昼，瞑为夜，吹为冬，呼为夏',
      nirathAnchor: '太素崩坏时，维度裂缝撕裂天空，能量倾泻',
      
      emotion: {
        dominant: '末日/敬畏',
        arc: '恐慌 → 渺小 → 敬畏',
        protagonistFeeling: '我觉得...天要塌了...但好美...'
      },
      
      coreTheme: '记忆即存在。看见即救赎。'
    },

    // ====== 旋龟/地图 ======
    'xuanGui': {
      beastId: '旋龟',
      beastName: '地图',
      templateId: 'SH-03',
      name: '弱水掠过 — 水面极速飞行',
      
      experiencePack: {
        primary: 'PACK-05',   // 陨石坠冰（垂直穿透+揭秘）
        secondary: 'PACK-13'  // 逃离北极（冰川极限运动）
      },
      
      scene: {
        setting: '弱水河面',
        timeOfDay: '双恒星正午',
        environment: '液态汞河面如镜，两岸荧光草倒映',
        atmosphere: '速度、自由、梦幻'
      },
      
      camera: {
        perspective: '载具跟拍（旋龟背部视角）',
        lens: '8mm鱼眼',
        movement: '贴近水面极速掠过，倒影破碎',
        speed: 'fast（快速）→ sudden（突然俯冲）',
        dutchAngle: '20°倾斜，速度感',
        keyFrame: '水面倒影破碎成银色碎片，旋龟鸟首虺尾入水'
      },
      
      rhythm: {
        phase1: '0-2秒：贴水加速，倒影完整',
        phase2: '2-4秒：掠过水草，倒影破碎',
        phase3: '4-6秒：旋龟入水，水花飞溅',
        phase4: '6-8秒：水下穿行，液态汞折射光线',
        phase5: '8-10秒：破水而出，看见双恒星，戛然而止'
      },
      
      sound: {
        type: 'Diegetic',
        elements: ['水花飞溅声', '液态汞流动的低沉嗡鸣', '旋龟入水的哗啦声'],
        noMusic: true,
        noNarration: true
      },
      
      shanhaijingAnchor: '怪水之中，多玄龟，鸟首虺尾',
      nirathAnchor: '弱水河液态汞表面，旋龟是唯一的活地图',
      
      emotion: {
        dominant: '自由/探索',
        arc: '平静 → 加速 → 惊喜',
        protagonistFeeling: '我想...跟着它去看看'
      },
      
      coreTheme: '记忆即存在。看见即救赎。'
    },

    // ====== 白泽/老师 ======
    'baiZe': {
      beastId: '白泽',
      beastName: '老师',
      templateId: 'SH-04',
      name: '钟山俯冲 — 智慧之光',
      
      experiencePack: {
        primary: 'PACK-10',  // 微观反重力（实验室+智慧光线）
        secondary: 'PACK-05' // 陨石坠冰（垂直穿透）
      },
      
      scene: {
        setting: '钟山之巅',
        timeOfDay: '黎明',
        environment: '龙骨化石山脉，白泽银白毛发在晨光中发光',
        atmosphere: '智慧、敬畏、神圣'
      },
      
      camera: {
        perspective: '背影跟拍（跟随白泽）',
        lens: '10mm超广角',
        movement: '沿龙脊俯冲飞行，白泽在前引导',
        speed: 'smooth（平滑）→ fast（加速）',
        dutchAngle: '10°倾斜，稳定感',
        keyFrame: '白泽银角发光，照亮前方龙脊'
      },
      
      rhythm: {
        phase1: '0-2秒：黎明微光中，白泽银角亮起',
        phase2: '2-4秒：沿龙脊加速，鳞片如山脉掠过',
        phase3: '4-6秒：白泽回头，金色眼睛对视',
        phase4: '6-8秒：继续俯冲，龙骨化石细节',
        phase5: '8-10秒：到达龙首，看见日出，戛然而止'
      },
      
      sound: {
        type: 'Diegetic',
        elements: ['龙骨的古老回响', '白泽毛发的柔和摩擦声', '晨风的呼啸'],
        noMusic: true,
        noNarration: true
      },
      
      shanhaijingAnchor: '东望山有兽，名曰白泽，能言语，达万物之情',
      nirathAnchor: '白泽银角是Nirath最后的灯塔，照亮真相之路',
      
      emotion: {
        dominant: '智慧/敬畏',
        arc: '平静 → 启迪 → 神圣',
        protagonistFeeling: '我觉得...它知道一切...'
      },
      
      coreTheme: '记忆即存在。看见即救赎。'
    },

    // ====== 九尾狐/奶奶 ======
    'jiuWeiHu': {
      beastId: '九尾狐',
      beastName: '奶奶',
      templateId: 'SH-05',
      name: '不周山崩塌 — 告别时刻',
      
      experiencePack: {
        primary: 'PACK-12',  // 逃离博物馆（爆破链+空间跃迁）
        secondary: 'PACK-09' // 万物悬浮（反重力灾难）
      },
      
      scene: {
        setting: '不周山崩塌现场',
        timeOfDay: '黄昏',
        environment: '断裂的山体，青铜机械废墟，九尾狐九条尾巴发光',
        atmosphere: '末日、告别、温柔'
      },
      
      camera: {
        perspective: 'POV（小G视角）',
        lens: '8mm鱼眼',
        movement: '穿越崩塌废墟，九尾狐在前引导',
        speed: 'fast（快速）→ silky（丝滑减速）',
        dutchAngle: '30°倾斜，崩塌感',
        keyFrame: '九尾狐九条尾巴如光带指引方向'
      },
      
      rhythm: {
        phase1: '0-2秒：崩塌开始，碎石坠落',
        phase2: '2-4秒：穿越废墟缝隙，擦碰金属与植物',
        phase3: '4-6秒：空间收窄，九尾狐尾巴照亮前路',
        phase4: '6-8秒：到达安全地带，回望崩塌',
        phase5: '8-10秒：九尾狐转身，九条尾巴如彩虹，戛然而止'
      },
      
      sound: {
        type: 'Diegetic',
        elements: ['岩石崩塌的轰鸣', '九尾狐尾巴的柔和风声', '青铜机械的古老转动声'],
        noMusic: true,
        noNarration: true
      },
      
      shanhaijingAnchor: '青丘之山有兽，其状如狐而九尾',
      nirathAnchor: '九尾狐是Nirath记忆的守护者，九条尾巴是九段历史',
      
      emotion: {
        dominant: '告别/温柔',
        arc: '紧张 → 安心 → 不舍',
        protagonistFeeling: '我觉得...她一直在保护我...'
      },
      
      coreTheme: '记忆即存在。看见即救赎。'
    }
  },

  // ========== 通用模板（按场景类型）==========
  genericScenes: {
    'forestFlight': {
      name: '森林飞行',
      description: '穿越发光森林，适合任何有植被的场景',
      applicableBeasts: ['nuanNuan', 'xuanGui'],
      pack: 'PACK-02'
    },
    'ruinsEscape': {
      name: '废墟逃离',
      description: '穿越崩塌的古代废墟',
      applicableBeasts: ['zhuLong', 'jiuWeiHu'],
      pack: 'PACK-12'
    },
    'waterSurface': {
      name: '水面掠过',
      description: '贴近水面极速飞行',
      applicableBeasts: ['xuanGui'],
      pack: 'PACK-04'
    },
    'energyStorm': {
      name: '能量风暴',
      description: '穿越能量漩涡和光粒雨',
      applicableBeasts: ['zhuLong'],
      pack: 'PACK-06'
    },
    'divineLight': {
      name: '神圣之光',
      description: '跟随发光生物飞行',
      applicableBeasts: ['baiZe', 'nuanNuan'],
      pack: 'PACK-10'
    }
  }
};

// ========== 自动调用引擎 ==========
class ShanhaiOneShotAutoGenerator {
  constructor() {
    this.templates = SHANHAI_ONE_SHOT_TEMPLATES;
    this.selector = new ExperiencePackSelector();
  }

  /**
   * 自动生成一镜到底镜头（核心方法）
   * @param {string} beastId - 异兽ID（如 'nuanNuan', 'zhuLong'）
   * @param {Object} options - 可选配置
   * @returns {Object} 一镜到底镜头定义
   */
  autoGenerate(beastId, options = {}) {
    // 1. 获取模板
    const template = this.templates.templates[beastId];
    if (!template) {
      // 回退到通用模板
      return this._fallbackGeneric(beastId, options);
    }

    // 2. 获取经验包
    const packId = template.experiencePack.primary;
    const pack = this.selector.getPackById(packId);

    // 3. 生成一镜到底镜头定义
    const oneShot = {
      type: 'one-shot',
      name: template.name,
      templateId: template.templateId,
      beastId: template.beastId,
      beastName: template.beastName,
      duration: 10,
      
      // 场景
      scene: template.scene,
      
      // 镜头
      camera: template.camera,
      
      // 节奏
      rhythm: template.rhythm,
      
      // 声音
      sound: template.sound,
      
      // 视觉锚点
      shanhaijingAnchor: template.shanhaijingAnchor,
      nirathAnchor: template.nirathAnchor,
      
      // 情绪
      emotion: template.emotion,
      
      // 核心主题
      coreTheme: template.coreTheme,
      
      // 参考经验包
      experiencePack: {
        id: packId,
        name: pack?.name || '未知',
        coreMethod: pack?.coreMethod || ''
      },
      
      // 系统标记
      systemMandatory: true,
      systemSource: 'shanhai-one-shot-templates.js',
      generatedAt: new Date().toISOString()
    };

    return oneShot;
  }

  /**
   * 批量生成所有模板
   * @returns {Array} 所有一镜到底镜头定义
   */
  generateAll() {
    return Object.keys(this.templates.templates).map(beastId =>
      this.autoGenerate(beastId)
    );
  }

  /**
   * 获取模板列表（用于导演系统展示）
   */
  getTemplateList() {
    return Object.values(this.templates.templates).map(t => ({
      templateId: t.templateId,
      beastId: t.beastId,
      beastName: t.beastName,
      name: t.name,
      scene: t.scene.setting,
      emotion: t.emotion.dominant
    }));
  }

  /**
   * 回退到通用模板
   */
  _fallbackGeneric(beastId, options) {
    const generic = this.templates.genericScenes;
    const fallback = generic.forestFlight; // 默认回退

    return {
      type: 'one-shot',
      name: `山海经探索 — ${beastId}`,
      duration: 10,
      scene: {
        setting: 'Nirath原始生态',
        timeOfDay: '双恒星日昼',
        environment: '荧光植被与科技废墟交织',
        atmosphere: '神秘/探索'
      },
      camera: {
        perspective: 'FPV穿越机',
        lens: '8mm鱼眼',
        movement: '穿越未知领地',
        speed: 'medium',
        dutchAngle: '15°'
      },
      sound: {
        type: 'Diegetic',
        elements: ['环境音'],
        noMusic: true
      },
      systemMandatory: true,
      generatedAt: new Date().toISOString()
    };
  }
}

// ========== 导演系统集成接口 ==========
/**
 * 为导演系统提供的便捷接口
 * 在 ShanhaiDirector.generateEpisodePlan 中调用
 */
function integrateOneShotWithDirector(episodePlan) {
  const generator = new ShanhaiOneShotAutoGenerator();
  const beastId = episodePlan.beastId;
  
  // 自动生成一镜到底镜头
  const oneShot = generator.autoGenerate(beastId);
  
  if (oneShot) {
    // 插入到第三幕（力量觉醒/加速混乱）
    const insertIndex = 2;
    if (episodePlan.acts && episodePlan.acts.length > insertIndex) {
      episodePlan.acts[insertIndex].oneShot = oneShot;
      episodePlan.acts[insertIndex].requiredShots = [
        ...(episodePlan.acts[insertIndex].requiredShots || []),
        '一镜到底FPV'
      ];
    }
    
    // 标记
    episodePlan.oneShotInfo = {
      templateId: oneShot.templateId,
      beastName: oneShot.beastName,
      scene: oneShot.scene,
      integratedAt: new Date().toISOString()
    };
  }
  
  return episodePlan;
}

// ========== 导出 ==========
module.exports = {
  SHANHAI_ONE_SHOT_TEMPLATES,
  ShanhaiOneShotAutoGenerator,
  integrateOneShotWithDirector,
  
  // 便捷方法
  autoGenerate: (beastId, options) => new ShanhaiOneShotAutoGenerator().autoGenerate(beastId, options),
  generateAll: () => new ShanhaiOneShotAutoGenerator().generateAll(),
  getTemplateList: () => new ShanhaiOneShotAutoGenerator().getTemplateList()
};

// CLI测试入口
if (require.main === module) {
  console.log('🎬 山海经一镜到底模板库测试模式');
  
  const generator = new ShanhaiOneShotAutoGenerator();
  
  console.log('\n📋 所有模板列表:');
  console.log(generator.getTemplateList());
  
  console.log('\n🎬 生成帝江/暖暖模板:');
  const nuanNuan = generator.autoGenerate('nuanNuan');
  console.log(JSON.stringify(nuanNuan, null, 2));
}
