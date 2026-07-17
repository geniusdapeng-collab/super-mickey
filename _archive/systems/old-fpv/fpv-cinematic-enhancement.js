/**
 * FPV Cinematic Enhancement Module
 * FPV电影感运镜增强模块 — 融入15个标杆案例精华
 * 
 * 融入策略（方案A - 增强而非替代）：
 * 1. 保留现有NirathCinematographyAgent所有能力
 * 2. 新增FPV专用运镜库和节奏生成器
 * 3. 通过 fpvMode: true 选项启用
 * 4. 支持结构化五模块写法（摄影/动力学/环境/灯光/感官）
 * 
 * 版本: v1.0-FPV
 * 日期: 2026-05-23
 */

// ========== FPV 镜头规格库 ==========
const FPV_LENS_SPECS = {
  extreme_fisheye: {
    name: "8mm极致鱼眼",
    focalLength: "8mm",
    type: "超广角鱼眼微距",
    distortion: "强烈桶形畸变，直线弯曲成弧形穹顶",
    edgeEffects: "边缘畸变+暗角+色散三件套",
    fieldOfView: "180度+",
    useCase: "微观巨物、室内探险、洞穴穿梭"
  },
  ultra_wide_fisheye: {
    name: "10mm超广角鱼眼",
    focalLength: "10mm",
    type: "超广角鱼眼",
    distortion: "强烈桶形畸变，画面边缘拉伸扭曲",
    edgeEffects: "边缘畸变+轻微暗角+细微色散",
    fieldOfView: "170度",
    useCase: "极限运动、飞行跟拍、灾难风暴"
  },
  micro_fisheye: {
    name: "微距鱼眼",
    focalLength: "8-10mm",
    type: "鱼眼微距混合",
    distortion: "微观比例夸张，纤维级细节放大",
    edgeEffects: "微观色散、径向模糊、景深压缩",
    fieldOfView: "160度",
    useCase: "昆虫视角、精灵飞行、微观探险"
  }
};

// ========== FPV 核心运镜动作库 ==========
const FPV_MOVEMENT_LIBRARY = {
  // ===== 基础FPV动作（全部案例共性）=====
  fpv_base: {
    name: "FPV基础飞行",
    description: "穿越机风格基础运镜：极不稳定、快速晃动、频繁倾斜旋转翻滚",
    characteristics: ["高频颤动", "剧烈侧倾", "旋转翻滚", "德式斜角全程保持"],
    lens: "8-10mm鱼眼",
    duration: "约10秒",
    soundRule: "纯环境音(Diegetic)，无音乐/旁白/文字"
  },

  // ===== 高级飞行动作（特殊技法）=====
  barrel_roll: {
    name: "桶滚(Barrel Roll)",
    description: "镜头180度高速横滚，视觉中心锁定主体",
    sourceCase: ["01-狂暴蚂蚁", "12-逃离博物馆"],
    useScene: ["载具跟拍", "飞行类", "极速转弯"],
    technique: "180度高速横滚，主体始终锁定在视觉中心",
    emotion: "极限、失控、刺激"
  },

  dolly_zoom: {
    name: "希区柯克变焦(Dolly Zoom)",
    description: "后拉同时变焦锁定人物，背景剧烈透视变化而主体大小不变",
    sourceCase: ["15-尿不湿车神"],
    useScene: ["追逐", "惊悚", "空间挤压感", "心理冲击"],
    technique: "同步后拉+焦距推近，背景放大主体不变，产生空间扭曲眩晕感",
    emotion: "压迫、不安、眩晕"
  },

  snap_zoom: {
    name: "瞬间推拉(Snap-zoom)",
    description: "快速zoom in/out制造视觉惊吓",
    sourceCase: ["15-尿不湿车神"],
    useScene: ["特写冲击", "惊吓点", "细节强调"],
    technique: "极速缩放捕捉微观细节，随后瞬间恢复正常",
    emotion: "惊吓、冲击、紧张"
  },

  speed_ramp: {
    name: "变速处理(Speed Ramping)",
    description: "常速+120fps升格慢动作+2.5倍速加速的组合",
    sourceCase: ["09-万物悬浮", "15-尿不湿车神"],
    useScene: ["灾难", "破坏", "细节展示", "动作强调"],
    technique: "常速→120fps升格展示细节→猛然加速冲向下一个动作",
    emotion: "时间膨胀、细节震撼、节奏突变"
  },

  // ===== 场景转换动作 =====
  water_transition: {
    name: "入水转场",
    description: "撞破水面→水花炸裂→水下慢速梦幻世界",
    sourceCase: ["02-精灵乐园"],
    useScene: ["飞行→水下", "室内外切换", "节奏突变"],
    technique: "高速混乱瞬间切换为水下慢速，水花炸裂作为视觉转换点",
    emotion: "突变、梦幻、释放"
  },

  light_bloom_transition: {
    name: "光线过曝转场",
    description: "明亮光线涌入→过曝→恢复，标志场景转换",
    sourceCase: ["08-苍蝇出行"],
    useScene: ["室内外切换", "明暗场景转换", "窗口穿越"],
    technique: "强光瞬间涌入镜头→画面剧烈过曝→迅速恢复",
    emotion: "冲击、转换、豁然开朗"
  },

  space_leap: {
    name: "空间跃迁",
    description: "撞击隔断/破窗/跃迁，瞬间切换空间",
    sourceCase: ["09-万物悬浮", "12-逃离博物馆"],
    useScene: ["跨场景转换", "破坏穿越", "极端空间切换"],
    technique: "撞击障碍物→破碎→瞬间进入完全不同的空间",
    emotion: "突破、解放、穿越"
  },

  digital_glitch_end: {
    name: "数码噪点黑屏结尾",
    description: "撞向屏幕→触碰像素点→噪点黑屏",
    sourceCase: ["09-万物悬浮"],
    useScene: ["怪诞", "科幻", "元宇宙", "打破第四面墙"],
    technique: "视角冲向屏幕→触碰像素→画面进入数码噪点→黑屏",
    emotion: "诡异、超脱、意识流"
  },

  zero_g_flip: {
    name: "失重翻转",
    description: "重力消失→镜头划出疯狂弧线",
    sourceCase: ["12-逃离博物馆"],
    useScene: ["太空", "零重力", "超现实"],
    technique: "进入零重力空间→画面发生失重式剧烈翻转→划出疯狂弧线",
    emotion: "失重、迷失、超脱"
  },

  // ===== 特殊视觉技法 =====
  dutch_angle: {
    name: "德式斜角(Dutch Angle)",
    description: "地平线始终保持倾斜，制造不安与紧张",
    sourceCase: "全部15个案例",
    useScene: "全类型通用",
    technique: "地平线始终倾斜，从不水平，贯穿全片",
    emotion: "不安、紧张、压迫"
  },

  hyper_reveal: {
    name: "渐进揭秘",
    description: "层层深入后才发现核心秘密，形成叙事高潮",
    sourceCase: ["05-陨石坠冰"],
    useScene: ["探索", "揭秘", "发现"],
    technique: "六层空间穿透：宇宙→云层→天空→冰原→裂缝→冰洞",
    emotion: "好奇、震惊、发现"
  },

  light_devour_end: {
    name: "光芒吞没结尾",
    description: "蓝色光芒迅速吞没画面，形成强烈光爆",
    sourceCase: ["06-海啸"],
    useScene: ["能量体", "超自然", "高潮结束"],
    technique: "主体冲入发光能量体→光芒迅速吞没画面→形成强烈光爆",
    emotion: "震撼、超脱、升华"
  },

  rim_lighting: {
    name: "轮廓光(Rim Lighting)",
    description: "微弱侧光勾勒主体轮廓，黑暗中仅见轮廓",
    sourceCase: ["01-狂暴蚂蚁", "05-陨石坠冰", "10-微观反重力"],
    useScene: ["黑暗场景", "结尾", "神秘感"],
    technique: "微弱侧光从背后或侧面勾勒主体轮廓，主体正面沉入黑暗",
    emotion: "神秘、孤独、未知"
  },

  sonic_boom_visual: {
    name: "音爆视觉化",
    description: "冲击波撕裂海面/地面，物体卷上天空",
    sourceCase: ["04-音速飞行器"],
    useScene: ["超音速", "冲击波", "速度可视化"],
    technique: "超音速产生冲击波→海水/地面如巨墙般掀起→物体卷上天空",
    emotion: "毁灭、力量、压倒性"
  },

  heat_wave_distortion: {
    name: "热浪扭曲",
    description: "空气因高温产生折射扭曲",
    sourceCase: ["04-音速飞行器", "05-陨石坠冰"],
    useScene: ["高速", "高温", "火焰"],
    technique: "高温导致空气密度变化→光线折射→画面边缘热浪形变",
    emotion: "炙热、扭曲、不真实"
  },

  tindal_effect: {
    name: "丁达尔效应",
    description: "光线透过缝隙形成巨大光柱",
    sourceCase: ["01-狂暴蚂蚁"],
    useScene: ["有缝隙透光场景", "森林", "布料纤维"],
    technique: "光线穿过微粒/缝隙→形成可见光柱→增强神圣感",
    emotion: "神圣、希望、穿透"
  },

  // ===== 突发事件 =====
  sudden_intrusion: {
    name: "突发事件",
    description: "打破原有节奏的意外闯入物",
    sourceCase: ["02-精灵乐园"],
    useScene: ["打破节奏", "意外", "紧张升级"],
    technique: "突然有物体高速闯入画面→打破原有飞行节奏→制造意外紧张感",
    emotion: "意外、惊险、升级"
  },

  // ===== 破坏连锁 =====
  destruction_chain: {
    name: "灾难连锁反应",
    description: "一个动作触发连续破坏反应",
    sourceCase: ["02-精灵乐园", "04-音速飞行器"],
    useScene: ["破坏", "灾难", "连锁反应"],
    technique: "主体撞击A→A崩塌→A撞击B→B破碎→B触发C→连锁毁灭",
    emotion: "失控、毁灭、压倒性"
  }
};

// ========== FPV 五段式节奏模板 ==========
const FPV_RHYTHM_TEMPLATES = {
  classic: {
    name: "经典五段式",
    phases: [
      { name: "爆发启动", timeRange: "0-1秒", action: "瞬间速度爆发，不给适应时间", emotion: "冲击、突然" },
      { name: "擦碰穿梭", timeRange: "1-5秒", action: "掠过障碍物，反复擦肩而过", emotion: "紧张、刺激" },
      { name: "加速混乱", timeRange: "5-7秒", action: "空间收窄或障碍密度增加", emotion: "升级、压迫" },
      { name: "终极动作", timeRange: "7-9秒", action: "标志性高难度镜头", emotion: "高潮、极限" },
      { name: "戛然而止", timeRange: "9-10秒", action: "极速运动中突然结束", emotion: "意犹未尽" }
    ]
  },

  reveal: {
    name: "渐进揭秘式",
    phases: [
      { name: "神秘启动", timeRange: "0-2秒", action: "黑暗中微弱光源出现", emotion: "神秘、好奇" },
      { name: "层层深入", timeRange: "2-5秒", action: "每转一圈都更近一层", emotion: "探索、紧张" },
      { name: "发现征兆", timeRange: "5-7秒", action: "远处出现异常光源/色彩", emotion: "期待、不安" },
      { name: "揭秘时刻", timeRange: "7-9秒", action: "核心秘密完全展现", emotion: "震惊、 awe" },
      { name: "余韵", timeRange: "9-10秒", action: "秘密展现后的静默", emotion: "沉思、敬畏" }
    ]
  },

  destruction: {
    name: "破坏升级式",
    phases: [
      { name: "触发", timeRange: "0-1秒", action: "首次撞击/破坏发生", emotion: "冲击" },
      { name: "连锁", timeRange: "1-4秒", action: "破坏开始连锁扩散", emotion: "失控" },
      { name: "升级", timeRange: "4-6秒", action: "破坏规模指数级扩大", emotion: "压倒性" },
      { name: "高潮", timeRange: "6-8秒", action: "最大规模破坏/爆炸", emotion: "毁灭" },
      { name: "余波", timeRange: "8-10秒", action: "破坏后的残骸/寂静", emotion: "荒凉" }
    ]
  },

  chase: {
    name: "追逐逃亡式",
    phases: [
      { name: "被发现", timeRange: "0-1秒", action: "突然意识到被追/危险", emotion: "惊恐" },
      { name: "逃离", timeRange: "1-4秒", action: "全速逃离，躲避障碍", emotion: "紧张" },
      { name: "逼入绝境", timeRange: "4-6秒", action: "空间越来越窄，退路减少", emotion: "绝望" },
      { name: "突破", timeRange: "6-8秒", action: "冲破障碍/窗户/水面", emotion: "释放" },
      { name: "新生", timeRange: "8-10秒", action: "进入全新空间，暂时安全", emotion: " relief" }
    ]
  }
};

// ========== 场景元素映射系统 ==========
const ELEMENT_MAPPING_SYSTEM = {
  // 微观世界映射（案例01/06/08/14）
  micro_world: {
    name: "微观世界地理重构",
    description: "将日常物品重新诠释为微观地貌生态系统",
    mappings: {
      "棉质纤维": { macro: "参天大树/原始森林", interaction: "穿梭其中" },
      "布料纹理": { macro: "起伏的巨大山脉", interaction: "翻越" },
      "拉链齿扣": { macro: "冰冷金属障碍物/关卡", interaction: "侧向弹射跃过" },
      "缝纫线迹": { macro: "巨大线缆/桥梁", interaction: "疾速掠过" },
      "纽扣": { macro: "岩石/巨石", interaction: "擦边而过" },
      "布料缝隙": { macro: "深不见底的峡谷", interaction: "俯瞰坠落" },
      "褶皱": { macro: "狭窄山谷", interaction: "加速穿行" },
      "袖口": { macro: "巨大黑色空洞/深渊", interaction: "终极目的地" },
      "雨滴": { macro: "子弹/高速水线", interaction: "巨大如子弹砸落" },
      "草叶": { macro: "高耸建筑结构", interaction: "在鱼眼镜头下弯曲变形" }
    }
  },

  // 室内空间映射（案例02/09/14/15）
  indoor_space: {
    name: "室内空间巨物化",
    description: "将室内家具/物品放大为巨型障碍",
    mappings: {
      "乐高城堡": { macro: "摩天建筑", interaction: "低空穿梭、崩塌摧毁" },
      "玩具火车轨道": { macro: "高架桥/隧道", interaction: "掠过" },
      "纸皮箱": { macro: "废弃迷宫/高墙", interaction: "缝隙穿行" },
      "餐桌": { macro: "美食微观世界", interaction: "上空穿梭" },
      "红烧肉": { macro: "油亮的巨大物体", interaction: "掠过" },
      "米饭": { macro: "蒸汽升腾的山", interaction: "飞越" },
      "家具边缘": { macro: "巨大障碍", interaction: "掠过" },
      "台灯电线": { macro: "空中缆线", interaction: "穿过" }
    }
  },

  // 灾难场景映射（案例03/04/06）
  disaster_scene: {
    name: "灾难场景元素映射",
    description: "将环境元素转化为灾难视觉符号",
    mappings: {
      "电子屏幕": { macro: "闪烁的红绿色数据/故障光线", interaction: "高速穿梭" },
      "A4纸/交易单": { macro: "风暴中的飞舞碎片", interaction: "擦肩而过" },
      "航母": { macro: "被撞碎的巨型目标", interaction: "连续撞击摧毁" },
      "爆炸火球": { macro: "视觉高潮元素", interaction: "穿越" },
      "海啸": { macro: "液态光能/超自然能量体", interaction: "直冲入光芒" },
      "雨滴": { macro: "子弹/高速水线", interaction: "巨大如子弹砸落" }
    }
  },

  // 科幻场景映射（案例05/10/12/13）
  sci_fi_scene: {
    name: "科幻场景层级穿透",
    description: "多层空间穿透，每层视觉完全不同",
    mappings: {
      "宇宙高空": { macro: "陨石坠落", interaction: "紧贴陨石后方高速坠落" },
      "云层": { macro: "厚重积雨云", interaction: "高速冲入、穿云" },
      "冰原表面": { macro: "冰川裂缝", interaction: "贴近冰面飞行" },
      "实验室器材": { macro: "倒下的摩天大楼", interaction: "身侧掠过" },
      "太空": { macro: "无垠黑域", interaction: "失重式剧烈翻转" },
      "星际舰队": { macro: "激烈交战的目标", interaction: "冲向飞船火海" }
    }
  }
};

// ========== 提示词写法模板 ==========
const PROMPT_WRITING_TEMPLATES = {
  // 叙事长文本写法（案例01-08, 12-14）
  narrative: {
    name: "叙事长文本写法",
    description: "完整场景描述，故事性强，适合复杂场景",
    structure: [
      "开头：视角+镜头+运动风格设定（约50字）",
      "中段：场景描述+动作序列+环境交互（约200字）",
      "高潮：标志性动作+视觉奇观（约150字）",
      "结尾：戛然而止+音效规则（约100字）"
    ],
    totalLength: "约500-980字符",
    bestFor: ["复杂场景", "多层次", "故事性强"]
  },

  // 结构化五模块写法（案例09, 10, 15）
  structured: {
    name: "结构化五模块写法",
    description: "分模块精准控制，适合专业摄影师",
    modules: {
      cinematography: "摄影机与光学设定 | Cinematography & Optics",
      dynamics: "运动动力学 | Motion Dynamics",
      environment: "环境与物理交互 | Environment & Physics",
      lighting: "灯光与材质 | Lighting & Material",
      sensory: "感官与情绪 | Sensory & Mood"
    },
    totalLength: "约500-800字符",
    bestFor: ["专业控制", "精细调整", "技术导向"]
  },

  // 极简关键词写法（案例11）
  minimalist: {
    name: "极简关键词写法",
    description: "最短关键词组合，快速触发",
    structure: [
      "核心动作词（如：极速FPV不稳定）",
      "镜头规格（如：8mm鱼眼广角）",
      "场景关键词（如：穿梭在学校教室）",
      "效果关键词（如：试卷飞舞破窗而出）",
      "风格词（如：写实物理极致速度感）"
    ],
    totalLength: "约100-200字符",
    bestFor: ["快速生成", "简单场景", "概念验证"]
  }
};

// ========== FPV 运镜生成器 ==========
class FPVCinematographyAgent {
  constructor(options = {}) {
    this.lensSpecs = FPV_LENS_SPECS;
    this.movementLib = FPV_MOVEMENT_LIBRARY;
    this.rhythmTemplates = FPV_RHYTHM_TEMPLATES;
    this.elementMappings = ELEMENT_MAPPING_SYSTEM;
    this.promptTemplates = PROMPT_WRITING_TEMPLATES;
    this.verbose = options.verbose || false;
  }

  /**
   * 生成FPV电影感运镜方案
   * @param {Object} params - 参数
   * @param {string} params.sceneType - 场景类型（micro_world/indoor_space/disaster_scene/sci_fi_scene）
   * @param {string} params.subjectType - 主体类型（insect/fairy/vehicle/baby/disaster）
   * @param {string} params.tone - 情绪基调（mysterious/tense/explosive/epic/comic）
   * @param {string} params.rhythmTemplate - 节奏模板（classic/reveal/destruction/chase）
   * @param {string} params.writingStyle - 写法风格（narrative/structured/minimalist）
   * @param {Array} params.specialTechniques - 特殊技法数组
   * @returns {Object} FPV运镜方案
   */
  generateFPVMovement(params = {}) {
    const {
      sceneType = 'micro_world',
      subjectType = 'insect',
      tone = 'mysterious',
      rhythmTemplate = 'classic',
      writingStyle = 'narrative',
      specialTechniques = [],
      duration = 10,
      habitat = ''
    } = params;

    // 1. 选择镜头规格
    const lens = this.selectLens(subjectType, sceneType);

    // 2. 选择基础运镜
    const baseMovement = this.selectBaseMovement(subjectType);

    // 3. 生成五段式节奏
    const rhythm = this.generateRhythm(rhythmTemplate, duration);

    // 4. 选择特殊技法
    const techniques = this.selectTechniques(specialTechniques, tone, sceneType);

    // 5. 生场景元素映射
    const elementMap = this.generateElementMapping(sceneType, habitat);

    // 6. 生成音效铁律
    const soundRule = this.generateSoundRule();

    // 7. 组装完整Prompt框架
    const promptFrame = this.assemblePromptFrame({
      lens,
      baseMovement,
      rhythm,
      techniques,
      elementMap,
      soundRule,
      writingStyle,
      tone,
      duration
    });

    return {
      mode: 'FPV电影感',
      lens,
      baseMovement,
      rhythm,
      techniques,
      elementMap,
      soundRule,
      promptFrame,
      params
    };
  }

  /**
   * 根据主体类型和场景选择镜头
   */
  selectLens(subjectType, sceneType) {
    const lensMap = {
      insect: 'micro_fisheye',      // 昆虫/蜜蜂/蚂蚁/蜻蜓
      fairy: 'micro_fisheye',       // 精灵/微小生物
      baby: 'ultra_wide_fisheye',   // 婴儿/人物跟拍
      vehicle: 'ultra_wide_fisheye', // 载具/飞行器
      disaster: 'ultra_wide_fisheye', // 灾难场景
      warrior: 'ultra_wide_fisheye'   // 战士/人物
    };

    // 微观场景强制使用微距鱼眼
    if (sceneType === 'micro_world') return this.lensSpecs.micro_fisheye;
    
    return this.lensSpecs[lensMap[subjectType] || 'ultra_wide_fisheye'];
  }

  /**
   * 选择基础FPV运镜
   */
  selectBaseMovement(subjectType) {
    const movementMap = {
      insect: 'fpv_base',        // 昆虫：基础FPV飞行
      fairy: 'fpv_base',         // 精灵：基础FPV飞行
      baby: 'fpv_base',          // 婴儿：贴地跟拍
      vehicle: 'fpv_base',       // 载具：后方跟拍
      disaster: 'fpv_base',      // 灾难：高速穿梭
      warrior: 'fpv_base'        // 战士：背影跟拍
    };

    return this.movementLib[movementMap[subjectType] || 'fpv_base'];
  }

  /**
   * 生成五段式节奏
   */
  generateRhythm(templateName, duration = 10) {
    const template = this.rhythmTemplates[templateName] || this.rhythmTemplates.classic;
    
    // 根据时长调整每段的时间
    const adjustedPhases = template.phases.map(phase => {
      const [start, end] = phase.timeRange.split('-').map(t => parseInt(t));
      const ratio = duration / 10; // 以10秒为基准
      return {
        ...phase,
        timeRange: `${Math.round(start * ratio)}-${Math.round(end * ratio)}秒`,
        adjustedStart: Math.round(start * ratio),
        adjustedEnd: Math.round(end * ratio)
      };
    });

    return {
      template: template.name,
      totalDuration: duration,
      phases: adjustedPhases
    };
  }

  /**
   * 选择特殊技法
   */
  selectTechniques(requestedTechniques, tone, sceneType) {
    const selected = [];

    // 德式斜角是所有FPV的必备基础
    selected.push(this.movementLib.dutch_angle);

    // 根据请求的技法添加
    for (const techName of requestedTechniques) {
      if (this.movementLib[techName]) {
        selected.push(this.movementLib[techName]);
      }
    }

    // 根据情绪和场景自动推荐
    if (tone === 'explosive' && !requestedTechniques.includes('destruction_chain')) {
      selected.push(this.movementLib.destruction_chain);
    }

    if (tone === 'mysterious' && !requestedTechniques.includes('hyper_reveal')) {
      selected.push(this.movementLib.hyper_reveal);
    }

    if (tone === 'tense' && !requestedTechniques.includes('sudden_intrusion')) {
      selected.push(this.movementLib.sudden_intrusion);
    }

    return selected;
  }

  /**
   * 生成场景元素映射
   */
  generateElementMapping(sceneType, habitat) {
    const mapping = this.elementMappings[sceneType];
    if (!mapping) return null;

    // 如果有栖息地，筛选相关的映射
    if (habitat) {
      const filteredMappings = {};
      for (const [key, value] of Object.entries(mapping.mappings)) {
        if (habitat.includes(key) || key.includes(habitat)) {
          filteredMappings[key] = value;
        }
      }
      
      // 如果筛选后太少，返回全部
      if (Object.keys(filteredMappings).length < 3) {
        return mapping;
      }
      
      return { ...mapping, mappings: filteredMappings };
    }

    return mapping;
  }

  /**
   * 生成音效铁律
   */
  generateSoundRule() {
    return {
      type: "Diegetic",
      rule: "纯环境音，无音乐/旁白/文字",
      required: [
        "主体运动声音（振翅/引擎/脚步）",
        "环境声音（风声/水流/碰撞）",
        "交互声音（摩擦/撞击/破碎）"
      ],
      forbidden: ["音乐", "旁白", "文字", "非叙事音效"]
    };
  }

  /**
   * 组装Prompt框架
   */
  assemblePromptFrame({ lens, baseMovement, rhythm, techniques, elementMap, soundRule, writingStyle, tone, duration }) {
    const template = this.promptTemplates[writingStyle];
    
    return {
      style: template.name,
      structure: template.structure || Object.values(template.modules || {}),
      keyElements: {
        lensSpec: `${lens.name}，${lens.distortion}，${lens.edgeEffects}`,
        movementStyle: `${baseMovement.name}：${baseMovement.description}`,
        rhythm: `${rhythm.template}，${duration}秒，${rhythm.phases.length}段式`,
        techniques: techniques.map(t => t.name).join(' + '),
        elementMapping: elementMap ? `${elementMap.name}：${Object.keys(elementMap.mappings || {}).length}个元素映射` : '无',
        sound: `${soundRule.type}：${soundRule.rule}`
      },
      writingTemplate: template
    };
  }

  /**
   * 生成完整的FPV Prompt文本（叙事风格）
   */
  generateNarrativePrompt(params = {}) {
    const fpv = this.generateFPVMovement(params);
    
    const parts = [];
    
    // 开头：视角+镜头+运动风格
    parts.push(`一段${fpv.params.duration || 10}秒钟、超电影感、超写实的${this.getPOVDescription(fpv.params.subjectType)}`);
    parts.push(`采用单一连续镜头拍摄，${fpv.baseMovement.description}`);
    parts.push(`使用${fpv.lens.name}，${fpv.lens.distortion}，产生${fpv.lens.edgeEffects}`);
    
    // 中段：场景描述
    if (fpv.elementMap) {
      parts.push(`\n场景设定：${fpv.elementMap.name}`);
      const elements = Object.entries(fpv.elementMap.mappings || {}).slice(0, 4);
      for (const [key, value] of elements) {
        parts.push(`- ${key} → ${value.macro}（${value.interaction}）`);
      }
    }
    
    // 节奏描述
    parts.push(`\n动作节奏：`);
    for (const phase of fpv.rhythm.phases) {
      parts.push(`${phase.name}（${phase.timeRange}）：${phase.action}`);
    }
    
    // 特殊技法
    if (fpv.techniques.length > 1) { // >1 because dutch_angle is always included
      parts.push(`\n特殊技法：${fpv.techniques.slice(1).map(t => t.name).join('、')}`);
    }
    
    // 音效铁律
    parts.push(`\n音效：${fpv.soundRule.rule}。${fpv.soundRule.required.join('、')}。${fpv.soundRule.forbidden.join('、')}。超写实电影感现实主义。`);
    
    return {
      prompt: parts.join('\n'),
      fpvData: fpv,
      charCount: parts.join('\n').length
    };
  }

  /**
   * 生成结构化Prompt（五模块）
   */
  generateStructuredPrompt(params = {}) {
    const fpv = this.generateFPVMovement({ ...params, writingStyle: 'structured' });
    
    const modules = {};
    
    // 模块1：摄影机与光学
    modules.cinematography = `Cinematography & Optics | 摄影机与光学\n` +
      `${fpv.params.duration || 10}秒、单镜头、超写实的${this.getPOVDescription(fpv.params.subjectType)}。` +
      `采用${fpv.lens.name}，${fpv.lens.distortion}。` +
      `画面中心保持锐利，边缘大幅度拉伸扭曲。` +
      `镜头动态：模拟${fpv.baseMovement.name}的非稳态运动，包含剧烈的轴向翻转、直角切弯和受迫性高频震动。`;
    
    // 模块2：运动动力学
    modules.dynamics = `Motion Dynamics | 运动动力学\n` +
      `FPV贴地超高速运镜，完全剥离慢动作。` +
      `视频以瞬间速度爆发开启，${fpv.rhythm.phases[0]?.action || '高速启动'}。` +
      fpv.techniques.slice(1).map(t => `运用${t.name}：${t.description}。`).join('');
    
    // 模块3：环境与物理
    modules.environment = `Environment & Physics | 环境与物理\n`;
    if (fpv.elementMap) {
      modules.environment += `${fpv.elementMap.name}场景。`;
      const elements = Object.entries(fpv.elementMap.mappings || {}).slice(0, 3);
      for (const [key, value] of elements) {
        modules.environment += `${key}如${value.macro}般${value.interaction}。`;
      }
    }
    
    // 模块4：灯光与材质
    modules.lighting = `Lighting & Material | 光影与材质\n` +
      `光影极具戏剧性，冷暖对比强烈。` +
      `体积感光束穿透环境元素，形成斑驳影调。`;
    
    // 模块5：感官与情绪
    modules.sensory = `Sensory & Mood | 感官与情绪\n` +
      `整体基调是${fpv.params.tone === 'mysterious' ? '神秘探索' : fpv.params.tone}式的沉浸感。` +
      `音效：${fpv.soundRule.rule}。` +
      fpv.soundRule.required.slice(0, 3).join('、') + `。`;
    
    const prompt = Object.values(modules).join('\n\n');
    
    return {
      prompt,
      modules,
      fpvData: fpv,
      charCount: prompt.length
    };
  }

  /**
   * 获取POV描述
   */
  getPOVDescription(subjectType) {
    const povMap = {
      insect: '第一人称追踪视角，镜头紧贴昆虫背后约1厘米位置',
      fairy: '第一人称追踪视角，8mm超广角微距镜头紧贴精灵背后',
      baby: '极限FPV追随视角，摄影机紧贴主角后方',
      vehicle: '第一人称视角（POV），镜头紧贴载具后方约1米',
      disaster: '第一人称视角（POV），单一连续镜头',
      warrior: 'FPV穿越机式背影跟拍'
    };
    return povMap[subjectType] || '第一人称视角（POV）';
  }

  /**
   * 快速技法查询
   */
  queryTechnique(techniqueName) {
    return this.movementLib[techniqueName] || null;
  }

  /**
   * 获取所有可用技法列表
   */
  listAllTechniques() {
    return Object.entries(this.movementLib).map(([id, tech]) => ({
      id,
      name: tech.name,
      description: tech.description,
      sourceCase: tech.sourceCase,
      useScene: tech.useScene
    }));
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[FPV-Agent] ${msg}`);
    }
  }
}

// ========== 导出 ==========
module.exports = {
  FPVCinematographyAgent,
  FPV_LENS_SPECS,
  FPV_MOVEMENT_LIBRARY,
  FPV_RHYTHM_TEMPLATES,
  ELEMENT_MAPPING_SYSTEM,
  PROMPT_WRITING_TEMPLATES
};

// ========== 测试 ==========
if (require.main === module) {
  console.log('🎬 FPV电影感运镜增强模块测试');
  console.log('='.repeat(60));
  
  const agent = new FPVCinematographyAgent({ verbose: true });
  
  // 测试1：叙事风格Prompt（微观昆虫）
  console.log('\n📋 测试1：叙事风格 - 微观昆虫');
  const result1 = agent.generateNarrativePrompt({
    sceneType: 'micro_world',
    subjectType: 'insect',
    tone: 'mysterious',
    rhythmTemplate: 'classic',
    writingStyle: 'narrative',
    specialTechniques: ['barrel_roll', 'rim_lighting'],
    duration: 10,
    habitat: '永夜裂谷'
  });
  
  console.log(`\n生成Prompt字数: ${result1.charCount}`);
  console.log(`\n${result1.prompt.substring(0, 300)}...`);
  
  // 测试2：结构化风格Prompt（科幻场景）
  console.log('\n\n📋 测试2：结构化风格 - 科幻场景');
  const result2 = agent.generateStructuredPrompt({
    sceneType: 'sci_fi_scene',
    subjectType: 'vehicle',
    tone: 'explosive',
    rhythmTemplate: 'destruction',
    specialTechniques: ['sonic_boom_visual', 'space_leap'],
    duration: 10,
    habitat: '太空'
  });
  
  console.log(`\n生成Prompt字数: ${result2.charCount}`);
  console.log(`\n模块数: ${Object.keys(result2.modules).length}`);
  
  // 测试3：技法查询
  console.log('\n\n📋 测试3：技法查询');
  const tech = agent.queryTechnique('dolly_zoom');
  console.log(`技法: ${tech?.name}`);
  console.log(`来源: ${tech?.sourceCase}`);
  console.log(`适用: ${tech?.useScene?.join(', ')}`);
  
  console.log('\n✅ FPV增强模块测试完成！');
}
