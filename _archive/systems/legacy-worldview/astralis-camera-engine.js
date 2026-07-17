/**
 * ASTRALIS Camera Engine v1.0 — Nirath专属运镜系统
 * 系统级设计：每镜支持多手法组合（运镜+转场+特效+灯光+音效）
 * 不针对单个case，通用服务所有Nirath系列片头
 */

const NIRATH_CAMERA_MOVEMENTS = {
  // ===== 基础运镜（8种） =====
  dolly_in: {
    name: '推镜',
    description: '镜头缓慢推进，景别从extreme_wide→medium或medium→close_up',
    speedModifiers: ['silky', 'fast', 'sudden', 'smooth', 'extreme'],
    seedanceKeyword: 'slow push in, dolly in',
    typicalDuration: '2-4s',
    emotion: '聚焦/紧张/揭示'
  },
  dolly_out: {
    name: '拉镜',
    description: '镜头缓慢拉出，展示更大环境，景别放大',
    speedModifiers: ['silky', 'smooth'],
    seedanceKeyword: 'slow pull out, dolly out',
    typicalDuration: '2-4s',
    emotion: '释放/宏大/全景揭示'
  },
  pan: {
    name: '摇镜',
    description: '镜头水平旋转，展示横向环境',
    speedModifiers: ['silky', 'fast', 'smooth'],
    seedanceKeyword: 'smooth pan',
    typicalDuration: '2-3s',
    emotion: '探索/环境展示'
  },
  truck: {
    name: '移镜',
    description: '镜头平行移动，跟随主体或展示侧面',
    speedModifiers: ['silky', 'smooth'],
    seedanceKeyword: 'truck movement, lateral tracking',
    typicalDuration: '2-4s',
    emotion: '跟随/侧面展示'
  },
  crane: {
    name: '升降',
    description: '镜头垂直升降，从低到高或高到低',
    speedModifiers: ['silky', 'extreme'],
    seedanceKeyword: 'crane shot, vertical movement',
    typicalDuration: '3-5s',
    emotion: '崇高/俯视/升起'
  },
  orbit: {
    name: '环绕',
    description: '镜头围绕主体360度环绕',
    speedModifiers: ['silky', 'smooth', 'extreme'],
    seedanceKeyword: 'orbiting camera, circular movement around subject',
    typicalDuration: '3-6s',
    emotion: '神秘/全方位展示'
  },
  whip: {
    name: '甩镜',
    description: '快速甩动镜头到新的主体',
    speedModifiers: ['fast', 'sudden', 'extreme'],
    seedanceKeyword: 'whip pan, fast camera snap',
    typicalDuration: '0.5-1s',
    emotion: '冲击/突变/加速'
  },
  track: {
    name: '跟拍',
    description: '镜头跟随移动中的主体',
    speedModifiers: ['silky', 'fast', 'smooth'],
    seedanceKeyword: 'tracking shot, following camera',
    typicalDuration: '3-6s',
    emotion: '沉浸/动态/紧张'
  },

  // ===== Nirath专属运镜（5种） =====
  magnetic_line_follow: {
    name: '磁场线跟随',
    description: '镜头沿Nirath磁场光丝轨迹滑行，30Hz磁场共振驱动镜头运动',
    physicsBinding: '30Hz磁场共振 + 1.2T磁通密度',
    seedanceKeyword: 'camera gliding along magnetic field lines, following glowing aurora trails',
    typicalDuration: '3-5s',
    emotion: '神秘/能量流动',
    nirathSignature: true
  },
  gravity_drift: {
    name: '重力漂移升降',
    description: '低重力0.82G下镜头缓慢升降，带物理惯性和磁场推力',
    physicsBinding: '0.82G低重力 + 磁场推力',
    seedanceKeyword: 'low gravity camera drift, slow vertical float with magnetic push',
    typicalDuration: '4-6s',
    emotion: '失重/梦幻/漂浮',
    nirathSignature: true
  },
  dual_star_sweep: {
    name: '双恒星扫光',
    description: '双恒星色温从5800K金色渐变到6500K银白扫过画面',
    physicsBinding: '双恒星色温渐变 5800K→6500K',
    seedanceKeyword: 'dual star light sweep, golden to silver white color temperature shift',
    typicalDuration: '2-3s',
    emotion: '时间流逝/光的变化',
    nirathSignature: true
  },
  ferrofluid_trail: {
    name: '磁流体轨迹',
    description: '镜头跟随磁流体形成的路径运动，1.2T磁场约束',
    physicsBinding: '1.2T饱和磁化磁流体',
    seedanceKeyword: 'camera following ferrofluid trail, magnetic fluid path',
    typicalDuration: '3-5s',
    emotion: '科技/流动/成形',
    nirathSignature: true
  },
  aether_spore_float: {
    name: '以太孢子流',
    description: '镜头随1200/cm³以太孢子飘浮运动，低重力粒子动力学',
    physicsBinding: '1200/cm³孢子密度 + 0.82G低重力',
    seedanceKeyword: 'camera floating with glowing spore particles, ethereal drift',
    typicalDuration: '4-6s',
    emotion: '梦幻/微观/沉浸',
    nirathSignature: true
  }
};

const NIRATH_TRANSITIONS = {
  ferrofluid_dissolve: {
    name: '磁流体溶解',
    description: '磁流体扩散覆盖画面，新场景从磁流体中凝聚成形',
    physicsBinding: '磁流体相变 + 表面张力',
    seedanceKeyword: 'ferrofluid dissolving transition, new scene forming from magnetic liquid',
    typicalDuration: '1.5-2.5s'
  },
  spore_dissipate: {
    name: '孢子消散',
    description: '以太孢子群消散，露出新画面',
    physicsBinding: '孢子扩散动力学',
    seedanceKeyword: 'glowing spore particles dissipating to reveal new scene',
    typicalDuration: '1-2s'
  },
  magnetic_restructure: {
    name: '磁场线重组',
    description: '磁场光丝断裂→重组为新场景结构',
    physicsBinding: '磁场拓扑重构',
    seedanceKeyword: 'magnetic field lines breaking and restructuring into new scene geometry',
    typicalDuration: '2-3s'
  }
};

const NIRATH_LIGHTING_SYSTEM = {
  dualStarColorShift: {
    name: '双恒星色温渐变',
    description: 'Aurelius 5800K金色 → Silvana 6500K银白，2秒平滑过渡',
    parameters: {
      from: { star: 'Aurelius', temp: 5800, color: 'golden' },
      to: { star: 'Silvana', temp: 6500, color: 'silver-white' },
      duration: '2s',
      curve: 'smoothEase'
    },
    seedanceKeyword: 'dual star color temperature shift from golden 5800K to silver white 6500K'
  },
  magnetospherePulse: {
    name: '磁场光晕脉动',
    description: '30Hz环境共鸣，光强±15%呼吸节奏',
    parameters: {
      frequency: '30Hz',
      intensityVariation: '±15%',
      pattern: 'breathing'
    },
    seedanceKeyword: '30Hz magnetosphere pulse, breathing light intensity ±15%'
  },
  ferrofluidGlowRamp: {
    name: '磁流体自发光渐变',
    description: '标题成型时磁流体亮度从20%→100%',
    parameters: {
      from: '20%',
      to: '100%',
      trigger: 'title formation',
      curve: 'easeInOut'
    },
    seedanceKeyword: 'ferrofluid self-illuminating glow ramp from dim to bright during title formation'
  }
};

const NIRATH_AUDIO_DESIGN = {
  magneticResonance: {
    name: '磁场共鸣',
    frequency: '30Hz',
    description: '极低频磁场共鸣，深沉有力',
    bindToMovement: 'slow movements, orbit, gravity_drift',
    volume: 'background ambient'
  },
  ferrofluidFormation: {
    name: '磁流体成形',
    frequency: '200-800Hz',
    description: '磁流体聚集成形时的液态金属声',
    bindToMovement: 'ferrofluid_trail, title formation',
    volume: 'foreground medium'
  },
  plasmaBurst: {
    name: '等离子体爆发',
    frequency: '2-5kHz',
    description: '九尾狐尾尖等离子体喷射高频爆发',
    bindToMovement: 'whip, sudden movements, climax moments',
    volume: 'peak transient'
  },
  sporeWhisper: {
    name: '孢子低语',
    frequency: '4-8kHz',
    description: '以太孢子飘浮的细微环境音',
    bindToMovement: 'aether_spore_float, ambient drift',
    volume: 'background subtle'
  }
};

/**
 * 运镜组合生成器
 * 将多个运镜+转场+灯光+音效组合成一段Seedance可理解的Prompt片段
 * @param {Array} movements - 运镜ID数组
 * @param {Object} options - 配置选项
 * @returns {string} - 精简运镜描述（30-80字符）
 */
function generateCameraMovementDescription(movements, options = {}) {
  if (!movements || movements.length === 0) {
    return '';
  }

  const descriptions = movements.map(id => {
    const movement = NIRATH_CAMERA_MOVEMENTS[id];
    if (!movement) return '';
    
    // Nirath专属运镜优先使用完整描述
    if (movement.nirathSignature) {
      return movement.seedanceKeyword;
    }
    
    // 基础运镜使用精简描述
    const speed = options.speed || 'silky';
    return `${speed} ${movement.seedanceKeyword}`;
  }).filter(Boolean);

  // 组合为一句（Seedance偏好简洁）
  if (descriptions.length === 1) {
    return descriptions[0];
  }
  
  // 多个运镜组合
  return descriptions.join(', then ');
}

/**
 * 单镜头多手法运镜方案生成器
 * 针对一个镜头生成完整的运镜+转场+灯光+音效方案
 * @param {Object} shot - 镜头配置
 * @param {number} duration - 镜头时长(秒)
 * @returns {Object} - 完整运镜方案
 */
function generateMultiTechniqueShot(shot, duration = 8) {
  const { type = 'opening', intensity = 'medium', hasTitle = false } = shot;
  
  // 根据镜头类型推荐运镜组合
  const movementMap = {
    opening: ['dolly_in', 'gravity_drift', 'dual_star_sweep'],
    title_formation: ['ferrofluid_trail', 'orbit', 'magnetic_line_follow'],
    character_reveal: ['orbit', 'dolly_in', 'aether_spore_float'],
    climax: ['whip', 'magnetic_line_follow', 'ferrofluid_trail'],
    ending: ['dolly_out', 'gravity_drift', 'dual_star_sweep']
  };
  
  const selectedMovements = movementMap[type] || ['dolly_in'];
  
  // 分配时间轴
  const timeline = [];
  const segmentDuration = duration / selectedMovements.length;
  
  selectedMovements.forEach((movementId, index) => {
    const movement = NIRATH_CAMERA_MOVEMENTS[movementId];
    const startTime = (index * segmentDuration).toFixed(1);
    const endTime = ((index + 1) * segmentDuration).toFixed(1);
    
    timeline.push({
      timeRange: `${startTime}s-${endTime}s`,
      movement: movement.name,
      movementId: movementId,
      description: movement.seedanceKeyword,
      emotion: movement.emotion,
      lighting: index === 0 ? 'magnetospherePulse' : (index === selectedMovements.length - 1 ? 'ferrofluidGlowRamp' : null),
      audio: movement.nirathSignature ? 'magneticResonance' : 'sporeWhisper'
    });
  });
  
  // 生成精简Prompt片段（Seedance空间限制）
  const promptFragment = generateCameraMovementDescription(selectedMovements, { speed: 'silky' });
  
  return {
    type,
    duration,
    timeline,
    promptFragment,
    lighting: hasTitle ? ['dualStarColorShift', 'ferrofluidGlowRamp'] : ['magnetospherePulse'],
    audio: selectedMovements.some(m => NIRATH_CAMERA_MOVEMENTS[m]?.nirathSignature) 
      ? ['magneticResonance', 'sporeWhisper'] 
      : ['sporeWhisper']
  };
}

/**
 * Prompt空间感知压缩器
 * 根据剩余Prompt空间自动选择运镜描述详细程度
 * @param {number} remainingChars - 剩余字符数
 * @param {Array} movements - 运镜ID数组
 * @returns {string} - 适配空间的运镜描述
 */
function compressCameraForPromptSpace(remainingChars, movements) {
  if (remainingChars > 80) {
    // 空间充裕：完整描述
    return generateCameraMovementDescription(movements);
  } else if (remainingChars > 40) {
    // 空间有限：精简描述
    const keywords = movements.map(id => {
      const m = NIRATH_CAMERA_MOVEMENTS[id];
      return m ? m.seedanceKeyword.split(',')[0] : '';
    }).filter(Boolean);
    return keywords.join(', ');
  } else if (remainingChars > 20) {
    // 空间紧张：极简锚定词
    const keywords = movements.map(id => {
      const m = NIRATH_CAMERA_MOVEMENTS[id];
      if (!m) return '';
      // 提取最核心的词
      if (id.includes('orbit')) return 'orbiting';
      if (id.includes('dolly_in')) return 'slow push';
      if (id.includes('gravity')) return 'low gravity drift';
      if (id.includes('magnetic')) return 'magnetic line follow';
      return m.name;
    }).filter(Boolean);
    return `camera: ${keywords.join('+')}`;
  } else {
    // 无空间：返回空，依赖Seedance默认运镜
    return '';
  }
}

module.exports = {
  NIRATH_CAMERA_MOVEMENTS,
  NIRATH_TRANSITIONS,
  NIRATH_LIGHTING_SYSTEM,
  NIRATH_AUDIO_DESIGN,
  generateCameraMovementDescription,
  generateMultiTechniqueShot,
  compressCameraForPromptSpace
};

// ===== 测试 =====
if (require.main === module) {
  console.log('🎬 ASTRALIS Camera Engine v1.0 — Nirath运镜系统测试\n');
  
  // Test 1: 基础运镜查询
  console.log('=== 基础运镜库 ===');
  Object.entries(NIRATH_CAMERA_MOVEMENTS).forEach(([id, m]) => {
    const tag = m.nirathSignature ? '⭐ Nirath专属' : '';
    console.log(`${id}: ${m.name} ${tag}`);
  });
  
  // Test 2: 多手法片头运镜
  console.log('\n=== 片头多手法运镜方案 ===');
  const openingShot = generateMultiTechniqueShot({ type: 'opening', duration: 8, hasTitle: true });
  console.log('Type:', openingShot.type);
  console.log('Duration:', openingShot.duration + 's');
  console.log('Timeline:');
  openingShot.timeline.forEach(t => {
    console.log(`  ${t.timeRange}: ${t.movement} (${t.emotion})`);
  });
  console.log('Prompt Fragment:', openingShot.promptFragment);
  console.log('Lighting:', openingShot.lighting);
  console.log('Audio:', openingShot.audio);
  
  // Test 3: 空间压缩
  console.log('\n=== Prompt空间自适应压缩 ===');
  const movements = ['dolly_in', 'orbit', 'magnetic_line_follow'];
  [100, 50, 30, 15].forEach(space => {
    const compressed = compressCameraForPromptSpace(space, movements);
    console.log(`  剩余${space}字符: "${compressed}" (${compressed.length}字符)`);
  });
  
  console.log('\n✅ ASTRALIS Camera Engine v1.0 测试完成');
}
