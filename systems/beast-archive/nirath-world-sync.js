/**
 * Nirath World Sync
 * Nirath世界观校准器 - 确保神兽表现符合Nirath星球设定
 *
 * 校准维度:
 * 1. 栖息地匹配 - 神兽只出现在正确栖息地
 * 2. 生态逻辑 - 神兽与环境的关系合理
 * 3. 科技水平 - 无现代科技元素
 * 4. 能量体系 - 统一双恒星/地核辐射/生物电磁场
 * 5. 时间线 - 符合Nirath历史时间线
 */

const NIRATH_WORLD_RULES = {
  // 科技禁令
  techBan: [
    '机甲', '机器人', '飞船', '激光', '枪支', '坦克',
    '汽车', '飞机', '手机', '电脑', '网络', '卫星',
    'mecha', 'robot', 'spaceship', 'laser', 'gun', 'tank',
    'car', 'airplane', 'phone', 'computer', 'internet', 'satellite'
  ],

  // Nirath特有能量体系关键词(必须优先使用)
  energySystem: {
    lighting: ['双恒星光芒', '恒星辐射', '双星交辉', '橙紫光芒'],
    environment: ['地核辐射', '等离子体', '能量晶体', '生物电磁场'],
    atmosphere: ['电离层', '极光', '星辰碎片', '永恒风暴']
  },

  // 栖息地生态规则
  habitatEcology: {
    '永夜裂谷': {
      climate: '永恒黑暗,地核辐射照明',
      flora: '无常规植物,能量苔藓',
      fauna: '夜行生物,能量吸收型',
      terrain: '裂谷,岩浆海洋',
      forbidden: ['阳光', '森林', '草原']
    },
    '青丘灵原': {
      climate: '温和,双恒星交替',
      flora: '蓝绿色荧光高草',
      fauna: '小型异兽,孢子水母',
      terrain: '灵原,银色湖泊',
      forbidden: ['沙漠', '冰雪', '熔岩']
    },
    '云雷高原': {
      climate: '永恒雷暴',
      flora: '导电植被',
      fauna: '电磁生物',
      terrain: '万米高原',
      forbidden: ['平静', '无风', '低海拔']
    }
  },

  // 负面提示词 - 禁止出现的元素(全局)
  negativePrompts: {
    // 禁止中国山水画风
    artStyle: [
      '中国山水画', '水墨画', '国画风格', '水墨风格', '山水意境',
      '留白', '写意', '工笔', '山水画', '水墨',
      'Chinese ink painting', 'ink wash', 'traditional Chinese painting',
      'watercolor landscape', 'mountain painting'
    ],
    // 禁止水晶类(俗套)
    crystal: [
      '水晶', '水晶柱', '水晶球', '水晶簇', '紫水晶', '蓝水晶',
      'crystal', 'crystal pillar', 'crystal ball', 'crystal cluster',
      'amethyst', 'quartz', 'gemstone'
    ],
    // 禁止传统外星俗套
    clicheAlien: [
      '传统外星人', '小灰人', '外星飞船', 'UFO', '飞碟',
      'typical alien', 'little grey', 'flying saucer', 'UFO'
    ],
    // 禁止现代人类元素
    modernHuman: [
      '现代人', '牛仔裤', 'T恤', '运动鞋', '眼镜', '手表',
      'modern human', 'jeans', 't-shirt', 'sneakers'
    ]
  },

  // Nirath特殊能量形式(替代水晶)
  nirathEnergyForms: {
    plasmaVines: {
      name: '等离子体能量藤蔓',
      description: '发光的能量线条缠绕地形,如神经网络般蔓延',
      visual: '淡蓝色发光能量线,直径2-5cm,表面有电弧跳动',
      material: '电离气体,温度3000K,色温8000K,不固定形态'
    },
    bioSporeClouds: {
      name: '生物荧光孢子云',
      description: '漂浮的发光微生物群落,如星云般聚集',
      visual: '淡金色至琥珀色的发光孢子,直径1-3mm,聚集成云状',
      material: '微生物外壳,发光强度0.3流明,色温3200K'
    },
    stellarEnergyVeins: {
      name: '双恒星能量脉络',
      description: '恒星能量在岩石中形成的能量纹路,如血管般分布',
      visual: '岩石表面橙金色发光纹路,宽度1-10cm,脉动发光',
      material: '能量结晶化矿物质,色温4500K,脉冲频率0.5Hz'
    },
    magneticFieldLines: {
      name: '磁场可视化线条',
      description: '淡蓝色磁场能量线,肉眼可见的能量场',
      visual: '淡蓝色半透明线条,如极光般飘动,宽度可变',
      material: '电离粒子轨迹,色温9000K,强度随磁场变化'
    },
    geoflora: {
      name: '地核发光菌丝',
      description: '从地核辐射中汲取能量的菌丝网络',
      visual: '深红色至橙色的发光菌丝,交织如神经网络',
      material: '嗜热菌丝体,温度耐受500°C,色温2800K'
    }
  },

  // 时间线约束
  timeline: {
    ancientEra: '远古文明时期(人类文明前)',
    humanArrival: '2147年人类抵达',
    currentEra: '2150年殖民初期',
    forbiddenEvents: ['工业化', '核战争', '互联网革命']
  }
};

class NirathWorldSync {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.rules = options.rules || NIRATH_WORLD_RULES;
  }

  /**
   * 主入口:校准Prompt的Nirath世界观一致性
   * @param {string} prompt - 待校准的Prompt
   * @param {Object} scene - 场景信息(栖息地、时间等)
   * @returns {Object} { passed, violations, corrected }
   */
  calibrate(prompt, scene = {}) {
    const violations = [];
    let corrected = prompt;

    // 1. 科技禁令检查
    const techCheck = this.checkTechBan(prompt);
    if (!techCheck.passed) violations.push(techCheck);

    // 2. 栖息地生态检查
    if (scene.habitat) {
      const ecoCheck = this.checkHabitatEcology(prompt, scene.habitat);
      if (!ecoCheck.passed) violations.push(ecoCheck);
    }

    // 3. 能量体系校准
    const energyCheck = this.checkEnergySystem(prompt);
    if (!energyCheck.passed) violations.push(energyCheck);

    // 4. 时间线检查
    const timeCheck = this.checkTimeline(prompt);
    if (!timeCheck.passed) violations.push(timeCheck);

    // 5. 环境描述增强(非违规,是优化建议)
    const enhancement = this.enhanceEnvironment(prompt, scene);

    // 5. 负面提示词检查（新增）
    const negativeChecks = this.checkNegativePrompts(prompt);
    if (negativeChecks.length > 0) violations.push(...negativeChecks);

    // 6. Nirath能量形式增强（替代水晶等俗套元素）
    const energyEnhancement = this.enhanceNirathEnergy(prompt);

    const passed = violations.length === 0;

    // 尝试自动修正
    corrected = this.autoCorrect(prompt, violations);
    
    // 如果检测到水晶，自动替换为Nirath能量形式
    if (negativeChecks.some(v => v.type === 'crystal')) {
      corrected = this.replaceCrystalWithEnergy(corrected);
    }

    // 7. 增强环境描述（包括能量形式）
    const enhancement = this.enhanceEnvironment(prompt, scene);
    if (energyEnhancement.length > 0) {
      enhancement.push(...energyEnhancement);
    }

    return {
      passed,
      violations,
      corrected,
      enhancement,
      scene,
      severity: this.calculateSeverity(violations)
    };
  }

  /**
   * 负面提示词检查 - 确保Prompt不包含禁止元素
   */
  checkNegativePrompts(prompt) {
    const negatives = this.rules.negativePrompts;
    const violations = [];
    
    // 检查艺术风格
    for (const term of negatives.artStyle) {
      if (prompt.includes(term)) {
        violations.push({
          type: 'art_style',
          level: 'error',
          term,
          detail: `检测到禁止艺术风格"${term}"`,
          fix: '替换为: 超写实3D渲染、电影级光影、皮克斯级质感',
          reason: 'Nirath为异星科幻设定，禁止中国山水画等传统地球艺术风格'
        });
      }
    }
    
    // 检查水晶类
    for (const term of negatives.crystal) {
      if (prompt.includes(term)) {
        violations.push({
          type: 'crystal',
          level: 'error',
          term,
          detail: `检测到禁用元素"${term}"（俗套）`,
          fix: `替换为Nirath特殊能量形式: ${this.getRandomEnergyForm()}`,
          reason: '水晶形象过于俗套，使用Nirath特有的能量形式'
        });
      }
    }
    
    // 检查传统外星俗套
    for (const term of negatives.clicheAlien) {
      if (prompt.includes(term)) {
        violations.push({
          type: 'cliche_alien',
          level: 'warning',
          term,
          detail: `检测到俗套外星元素"${term}"`,
          fix: '替换为Nirath原生生物或能量现象',
          reason: '避免传统外星俗套形象'
        });
      }
    }
    
    return violations;
  }

  /**
   * 获取随机Nirath能量形式（替代水晶）
   */
  getRandomEnergyForm() {
    const forms = Object.values(this.rules.nirathEnergyForms);
    const form = forms[Math.floor(Math.random() * forms.length)];
    return `${form.name}（${form.description}）`;
  }

  /**
   * 生成Nirath能量形式Prompt段落
   */
  generateNirathEnergyPrompt(formName) {
    const form = this.rules.nirathEnergyForms[formName];
    if (!form) return '';
    
    return `【Nirath能量形式 - ${form.name}】${form.description}。视觉特征：${form.visual}。材质：${form.material}。`;
  }

  /**
   * Nirath能量形式增强 - 为Prompt添加特殊能量形式
   */
  enhanceNirathEnergy(prompt) {
    const enhancements = [];
    
    // 如果prompt中有"能量"或"发光"但未指定具体形式
    if ((prompt.includes('能量') || prompt.includes('发光')) && !prompt.includes('等离子体') && !prompt.includes('孢子') && !prompt.includes('脉络')) {
      const form = this.rules.nirathEnergyForms.plasmaVines;
      enhancements.push({
        type: 'energy_form',
        suggestion: this.generateNirathEnergyPrompt('plasmaVines'),
        reason: '使用Nirath特有能量形式替代俗套描述'
      });
    }
    
    return enhancements;
  }

  /**
   * 自动替换水晶为Nirath能量形式
   */
  replaceCrystalWithEnergy(prompt) {
    let corrected = prompt;
    const crystalTerms = this.rules.negativePrompts.crystal;
    const replacement = '双恒星能量脉络';
    
    for (const term of crystalTerms) {
      corrected = corrected.replace(new RegExp(term, 'g'), replacement);
    }
    
    return corrected;
  }

  /**
   * 科技禁令检查 - 确保没有现代科技元素
   */
  checkTechBan(prompt) {
    const banned = this.rules.techBan;
    const found = [];

    for (const tech of banned) {
      if (prompt.includes(tech)) {
        found.push(tech);
      }
    }

    if (found.length > 0) {
      return {
        passed: false,
        type: 'tech_ban',
        level: 'critical',
        detail: `检测到禁用科技元素: ${found.join(', ')}`,
        fix: `删除: ${found.join(', ')}。Nirath为原始生态星球,无现代科技`,
        replacement: '使用: 生物发光、能量晶体、原始工具'
      };
    }

    return { passed: true, type: 'tech_ban', detail: '无科技违规' };
  }

  /**
   * 栖息地生态检查
   */
  checkHabitatEcology(prompt, habitatName) {
    const ecology = this.rules.habitatEcology[habitatName];
    if (!ecology) {
      return { passed: true, type: 'habitat', detail: `未定义栖息地: ${habitatName}` };
    }

    const violations = [];

    // 检查禁用元素
    for (const forbidden of ecology.forbidden) {
      if (prompt.includes(forbidden)) {
        violations.push({
          element: forbidden,
          reason: `${habitatName}不存在${forbidden}`
        });
      }
    }

    if (violations.length > 0) {
      return {
        passed: false,
        type: 'habitat',
        level: 'error',
        detail: `栖息地生态违规: ${violations.map(v => v.element).join(', ')}`,
        fix: `删除: ${violations.map(v => v.element).join(', ')}`,
        expected: `${habitatName}应有: ${ecology.flora.join(', ')}`
      };
    }

    return { passed: true, type: 'habitat', detail: '栖息地生态合规' };
  }

  /**
   * 能量体系检查 - 确保使用Nirath特有的能量描述
   */
  checkEnergySystem(prompt) {
    const system = this.rules.energySystem;
    const hasNirathEnergy = Object.values(system).some(category =>
      category.some(term => prompt.includes(term))
    );

    if (!hasNirathEnergy) {
      return {
        passed: false,
        type: 'energy',
        level: 'warning',
        detail: '未检测到Nirath能量体系描述',
        fix: '添加: 双恒星光芒、地核辐射、能量晶体等',
        suggestion: '推荐使用: ' + system.lighting.slice(0, 2).join('或')
      };
    }

    return { passed: true, type: 'energy', detail: '能量体系合规' };
  }

  /**
   * 时间线检查
   */
  checkTimeline(prompt) {
    const forbidden = this.rules.timeline.forbiddenEvents;
    const found = [];

    for (const event of forbidden) {
      if (prompt.includes(event)) {
        found.push(event);
      }
    }

    if (found.length > 0) {
      return {
        passed: false,
        type: 'timeline',
        level: 'error',
        detail: `检测到时间线违规: ${found.join(', ')}`,
        fix: `删除: ${found.join(', ')}`,
        context: `当前时间: ${this.rules.timeline.currentEra}`
      };
    }

    return { passed: true, type: 'timeline', detail: '时间线合规' };
  }

  /**
   * 环境描述增强 - 为Prompt添加Nirath特色描述
   */
  enhanceEnvironment(prompt, scene = {}) {
    const enhancements = [];
    const system = this.rules.energySystem;

    // 如果缺少光照描述,添加双恒星
    if (!prompt.includes('光') && !prompt.includes('照')) {
      enhancements.push({
        type: 'lighting',
        suggestion: '双恒星橙紫光芒交织',
        reason: 'Nirath有双恒星系统'
      });
    }

    // 如果缺少环境氛围
    if (scene.habitat === '永夜裂谷' && !prompt.includes('岩浆')) {
      enhancements.push({
        type: 'atmosphere',
        suggestion: '深处岩浆海洋散发赤红微光',
        reason: '永夜裂谷核心特征'
      });
    }

    return enhancements;
  }

  /**
   * 自动修正
   */
  autoCorrect(prompt, violations) {
    let corrected = prompt;

    for (const v of violations) {
      if (v.type === 'tech_ban') {
        // 删除科技词汇
        for (const tech of this.rules.techBan) {
          corrected = corrected.replace(new RegExp(tech, 'g'), '');
        }
      }
    }

    return corrected;
  }

  calculateSeverity(violations) {
    if (violations.some(v => v.level === 'critical')) return 'critical';
    if (violations.some(v => v.level === 'error')) return 'error';
    if (violations.some(v => v.level === 'warning')) return 'warning';
    return 'pass';
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[NirathWorldSync] ${msg}`);
    }
  }
}

module.exports = NirathWorldSync;

// 测试
if (require.main === module) {
  console.log('🌍 NirathWorldSync 测试');
  const sync = new NirathWorldSync({ verbose: true });

  const badPrompt = '烛龙驾驶机甲飞船,使用激光武器,站在摩天大楼顶端,手机响了';
  const result = sync.calibrate(badPrompt, { habitat: '永夜裂谷' });

  console.log('\n❌ 违规测试:');
  console.log(`  通过: ${result.passed}`);
  console.log(`  严重等级: ${result.severity}`);
  result.violations.forEach(v => {
    console.log(`    - [${v.type}] ${v.detail}`);
  });

  const goodPrompt = '赤红烛龙横亘于永夜裂谷,双恒星橙紫光芒交织,地核辐射照亮千里龙身';
  const result2 = sync.calibrate(goodPrompt, { habitat: '永夜裂谷' });
  console.log('\n✅ 合规测试:');
  console.log(`  通过: ${result2.passed}`);
  console.log(`  增强建议: ${result2.enhancement.length}项`);
}
