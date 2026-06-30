/**
 * Beast Camera Advisor
 * 神兽运镜推荐器 - 基于神兽特性推荐最佳运镜方案
 * 
 * 核心逻辑：
 * 1. 神兽体型 → 景别选择
 * 2. 神兽类型 → 运镜风格
 * 3. 神兽能力 → 特效运镜
 * 4. 神兽情绪 → 速度曲线
 */

const CAMERA_PROFILES = {
  // 超巨型神兽：敬畏感
  'ultra_giant': {
    defaultShotSize: 'extreme_wide',
    defaultMovement: 'slow_push',
    preferredAngles: ['low_angle', 'aerial'],
    avoidAngles: ['close_up'],
    speed: 'silky',
    physics: true,
    lighting: '背光剪影',
    reference: '《降临》巨物美学',
    description: '超广角远景缓慢推进，展现神兽的宏大尺度'
  },
  
  // 巨型神兽：震撼感
  'giant': {
    defaultShotSize: 'wide',
    defaultMovement: 'slow_push',
    preferredAngles: ['low_angle', 'aerial'],
    avoidAngles: ['extreme_close_up'],
    speed: 'silky',
    physics: true,
    lighting: '侧逆光',
    reference: '《哥斯拉》巨兽压迫',
    description: '广角低角度缓慢推进，强调神兽的威严'
  },
  
  // 飞行神兽：自由感
  'flying': {
    defaultShotSize: 'wide',
    defaultMovement: 'aerial_track',
    preferredAngles: ['aerial', 'high_angle'],
    avoidAngles: ['low_angle'],
    speed: 'fast',
    physics: true,
    lighting: '天空光',
    reference: '《阿凡达》飞行场景',
    description: '航拍追踪快速平移，展现飞行姿态'
  },
  
  // 灵巧神兽：神秘感
  'agile': {
    defaultShotSize: 'medium',
    defaultMovement: 'smooth_follow',
    preferredAngles: ['eye_level', 'high_angle'],
    avoidAngles: ['low_angle'],
    speed: 'silky',
    physics: false,
    lighting: '柔光',
    reference: '《神奇动物》灵动美学',
    description: '中景平滑跟随，捕捉灵动瞬间'
  },
  
  // 凶兽：紧张感
  'ferocious': {
    defaultShotSize: 'close_up',
    defaultMovement: 'sudden_shake',
    preferredAngles: ['low_angle', 'dutch_angle'],
    avoidAngles: ['aerial'],
    speed: 'sudden',
    physics: true,
    lighting: '硬光高对比',
    reference: '《异形》紧张氛围',
    description: '特写突然震颤，制造紧张恐惧'
  },
  
  // 守护神兽：安宁感
  'guardian': {
    defaultShotSize: 'wide',
    defaultMovement: 'smooth_orbit',
    preferredAngles: ['eye_level', 'low_angle'],
    avoidAngles: ['high_angle'],
    speed: 'silky',
    physics: false,
    lighting: '暖光',
    reference: '《纳尼亚》阿斯兰',
    description: '广角丝滑环绕，营造庄严安宁'
  }
};

const BEAST_TYPE_MAP = {
  '烛龙': 'ultra_giant',
  '应龙': 'giant',
  '鲲鹏': 'ultra_giant',
  '相柳': 'giant',
  '巴蛇': 'giant',
  '凤凰': 'flying',
  '朱雀': 'flying',
  '毕方': 'flying',
  '英招': 'flying',
  '九尾狐': 'agile',
  '白泽': 'guardian',
  '麒麟': 'guardian',
  '玄武': 'guardian',
  '饕餮': 'ferocious',
  '穷奇': 'ferocious',
  '混沌': 'agile',
  '梼杌': 'ferocious',
  '蛊雕': 'ferocious',
  '狰': 'ferocious',
  '夫诸': 'agile',
  '鹿蜀': 'agile',
  '文鳐鱼': 'flying',
  '蠃鱼': 'flying'
};

class BeastCameraAdvisor {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
  }

  /**
   * 主入口：为神兽推荐运镜方案
   * @param {string} beastName - 神兽名
   * @param {string} sceneType - 场景类型（战斗/对话/展示/飞行）
   * @param {Object} custom - 自定义参数
   * @returns {Object} 完整运镜方案
   */
  advise(beastName, sceneType = '展示', custom = {}) {
    const beastType = BEAST_TYPE_MAP[beastName] || 'giant';
    const profile = CAMERA_PROFILES[beastType];
    
    if (!profile) {
      return { error: `未找到神兽类型: ${beastType}` };
    }
    
    // 根据场景类型调整
    const sceneAdjusted = this.adjustForScene(profile, sceneType);
    
    // 合并自定义参数
    const final = { ...sceneAdjusted, ...custom };
    
    return {
      beastName,
      beastType,
      sceneType,
      camera: {
        shotSize: final.defaultShotSize,
        movement: final.defaultMovement,
        angle: final.preferredAngles[0],
        speed: final.speed,
        physics: final.physics
      },
      lighting: final.lighting,
      reference: final.reference,
      description: final.description,
      alternatives: final.preferredAngles.slice(1).map(angle => ({
        angle,
        shotSize: this.getRecommendedShotSize(angle, beastType),
        movement: this.getRecommendedMovement(angle, beastType)
      }))
    };
  }

  /**
   * 为人类角色与神兽同框推荐运镜
   */
  adviseCoexist(beastName, humanRole, interactionType = '对视') {
    const beastProfile = this.advise(beastName, '对话');
    
    // 人与神兽同框的特殊处理
    const coexistConfig = {
      对视: {
        shotSize: 'medium',
        movement: 'slow_push',
        focus: '交替对焦',
        description: '中景缓慢推进，在人眼与兽眼间交替对焦'
      },
      战斗: {
        shotSize: 'wide',
        movement: 'fast_pan',
        focus: '动态追焦',
        description: '广角快速横摇，捕捉战斗动态'
      },
      骑行: {
        shotSize: 'medium',
        movement: 'smooth_follow',
        focus: '双主体清晰',
        description: '中景跟随，确保人与神兽同时清晰'
      },
      对话: {
        shotSize: 'medium_close_up',
        movement: 'static',
        focus: '浅景深',
        description: '近景固定机位，浅景深分离背景'
      }
    };
    
    const interaction = coexistConfig[interactionType] || coexistConfig['对视'];
    
    return {
      beast: beastProfile,
      human: {
        role: humanRole,
        positioning: this.calculateHumanPosition(beastProfile.beastType)
      },
      interaction,
      composition: this.calculateComposition(beastProfile.beastType)
    };
  }

  /**
   * 根据场景类型调整运镜
   */
  adjustForScene(profile, sceneType) {
    const adjustments = {
      '战斗': {
        defaultMovement: 'fast_track',
        speed: 'fast',
        preferredAngles: ['low_angle', 'dutch_angle']
      },
      '对话': {
        defaultShotSize: 'medium',
        defaultMovement: 'static',
        speed: 'silky',
        preferredAngles: ['eye_level']
      },
      '展示': {
        defaultMovement: 'slow_push',
        speed: 'silky',
        preferredAngles: ['low_angle', 'aerial']
      },
      '飞行': {
        defaultMovement: 'aerial_track',
        speed: 'fast',
        preferredAngles: ['aerial', 'high_angle']
      },
      '变身': {
        defaultShotSize: 'close_up',
        defaultMovement: 'slow_push',
        speed: 'silky',
        preferredAngles: ['close_up']
      }
    };
    
    return { ...profile, ...(adjustments[sceneType] || {}) };
  }

  /**
   * 计算人类角色在画面中的位置
   */
  calculateHumanPosition(beastType) {
    const positions = {
      'ultra_giant': '前景下方，衬托神兽巨大',
      'giant': '前景偏侧，形成大小对比',
      'flying': '地面仰望，目送飞行轨迹',
      'agile': '同层互动，平行对视',
      'guardian': '近景正面，接受守护',
      'ferocious': '远景逃跑，突出危险'
    };
    
    return positions[beastType] || '中景平视';
  }

  /**
   * 计算画面构图
   */
  calculateComposition(beastType) {
    const compositions = {
      'ultra_giant': '三分法，神兽占上2/3，人类占下1/3',
      'giant': '对称构图，神兽居中偏后',
      'flying': '对角线构图，飞行轨迹穿画',
      'agile': '黄金分割，神兽在视觉焦点',
      'guardian': '中心构图，神兽正面庄严',
      'ferocious': '不稳定构图，倾斜加剧紧张'
    };
    
    return compositions[beastType] || '标准三分法';
  }

  getRecommendedShotSize(angle, beastType) {
    const map = {
      'low_angle': 'wide',
      'aerial': 'extreme_wide',
      'eye_level': 'medium',
      'close_up': 'close_up',
      'high_angle': 'wide'
    };
    return map[angle] || 'medium';
  }

  getRecommendedMovement(angle, beastType) {
    const map = {
      'low_angle': 'slow_push',
      'aerial': 'smooth_track',
      'eye_level': 'static',
      'close_up': 'slow_push',
      'high_angle': 'smooth_orbit'
    };
    return map[angle] || 'static';
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[BeastCameraAdvisor] ${msg}`);
    }
  }
}

module.exports = BeastCameraAdvisor;

// 测试
if (require.main === module) {
  console.log('🎬 BeastCameraAdvisor 测试');
  const advisor = new BeastCameraAdvisor({ verbose: true });
  
  // 测试：烛龙展示
  const plan1 = advisor.advise('烛龙', '展示');
  console.log('\n🐉 烛龙展示运镜:');
  console.log(`  景别: ${plan1.camera.shotSize}`);
  console.log(`  运镜: ${plan1.camera.movement}`);
  console.log(`  角度: ${plan1.camera.angle}`);
  console.log(`  描述: ${plan1.description}`);
  
  // 测试：小G与烛龙对视
  const plan2 = advisor.adviseCoexist('烛龙', '小G', '对视');
  console.log('\n👦🐉 小G与烛龙同框:');
  console.log(`  人类位置: ${plan2.human.positioning}`);
  console.log(`  构图: ${plan2.composition}`);
  console.log(`  交互: ${plan2.interaction.description}`);
}
