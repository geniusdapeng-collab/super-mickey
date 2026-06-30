/**
 * Beast Consistency Guard
 * 神兽一致性守卫 - 确保同一神兽跨镜头、跨剧集形象统一
 * 
 * 核心规则：
 * 1. 颜色一致性 - 神兽主色调不可被篡改
 * 2. 形态一致性 - 身体结构不可变形
 * 3. 能力一致性 - 核心能力不可突变
 * 4. 规模一致性 - 体型等级不可跳跃
 * 5. 环境一致性 - 栖息地不可错乱
 */

const COLOR_RULES = {
  'zhu-long': { allowed: ['赤红', '金色', '暗紫', '橙红'], forbidden: ['蓝色', '绿色', '白色'] },
  'ying-long': { allowed: ['金黄', '青铜', '彩虹', '碧绿'], forbidden: ['红色'] },
  'feng-huang': { allowed: ['朱红', '金黄', '翠绿', '玉白', '靛蓝', '紫红'], forbidden: ['黑色', '灰色'] },
  'qi-lin': { allowed: ['青', '赤', '黄', '白', '黑', '五彩'], forbidden: ['纯色无纹'] },
  'bai-ze': { allowed: ['雪白', '银白', '淡青', '月白'], forbidden: ['黑色', '红色'] },
  'tao-tie': { allowed: ['死灰', '暗褐', '青黑'], forbidden: ['鲜艳', '明亮'] },
  'qiong-qi': { allowed: ['深灰', '黑色', '暗红', '赤褐'], forbidden: ['白色', '金色'] },
  'hun-dun': { allowed: ['黄色', '赤红', '金色'], forbidden: ['蓝色', '绿色'] },
  'tao-wu': { allowed: ['灰褐', '赤红', '黑色'], forbidden: ['白色', '金色'] },
  'jiu-wei-hu': { allowed: ['纯白', '青灰', '赤红', '金黄', '彩虹'], forbidden: ['黑色'] }
};

const FORM_RULES = {
  'zhu-long': { bodyPlan: '人首蛇身', aliases: ['人面蛇身'], forbidden: ['西方龙', '蜥蜴', '四足龙'] },
  'ying-long': { bodyPlan: '有翼神龙', forbidden: ['无翼', '西方龙', '鸟身'] },
  'feng-huang': { bodyPlan: '鸡形神鸟', forbidden: ['鹰', '孔雀', '西方凤凰'] },
  'qi-lin': { bodyPlan: '鹿身龙首', forbidden: ['马', '牛', '纯狮'] },
  'bai-ze': { bodyPlan: '狮虎身双角', forbidden: ['单角', '无角', '龙身'] },
  'tao-tie': { bodyPlan: '羊身人面', forbidden: ['纯兽', '无人面', '美丽'] },
  'hun-dun': { bodyPlan: '黄囊六足四翼', forbidden: ['有面目', '五足', '三翼'] },
  'jiu-wei-hu': { bodyPlan: '狐形九尾', forbidden: ['单尾', '西方狐', '无毛'] }
};

const ABILITY_RULES = {
  'zhu-long': { core: '掌控昼夜', forbidden: ['吐水', '冰冻', '飞行'] },
  'ying-long': { core: '兴云作雨', forbidden: ['喷火', '治愈', '瞬移'] },
  'feng-huang': { core: '浴火涅槃', forbidden: ['控水', '冰封', '毒液'] },
  'tao-tie': { core: '吞噬万物', forbidden: ['守护', '治愈', '飞行'] },
  'qiong-qi': { core: '善恶颠倒', forbidden: ['正义审判', '明辨是非'] },
  'hun-dun': { core: '混沌之力', forbidden: ['秩序', '治愈', '光明'] }
};

const SCALE_RULES = {
  'zhu-long': '超巨型', // 千里龙身不可缩小
  'ying-long': '巨型',  // 翼展百米
  'feng-huang': '大型', // 数倍于普通鸟
  'kun-peng': '超巨型', // 几千里
  'xiang-liu': '超巨型', // 九首蛇身
  'ba-she': '超巨型'    // 吞象
};

const HABITAT_RULES = {
  'zhu-long': ['永夜裂谷', '章尾山', '钟山'],
  'ying-long': ['云雷高原', '南方', '天际'],
  'feng-huang': ['丹穴山脉', '梧桐', '南方'],
  'qi-lin': ['百兽草原', '昆仑塔', '盛世'],
  'bai-ze': ['智慧之峰', '桓山', '东海之滨'],
  'tao-tie': ['钩吾废墟', '钩吾山', '黑暗之地'],
  'hun-dun': ['天山空洞', '混沌之地', '时空裂隙']
};

// 新增：全局禁用元素（适用于所有神兽/所有Prompt）
const GLOBAL_BANNED_ELEMENTS = {
  // 水晶类 - 俗套
  crystal: ['水晶', '水晶柱', '水晶球', '水晶簇', '紫水晶', '蓝水晶', 
            'crystal', 'crystal pillar', 'crystal ball', 'crystal cluster',
            'amethyst', 'quartz', 'gemstone'],
  // 山水画风
  artStyle: ['中国山水画', '水墨画', '国画风格', '水墨风格', '山水意境', '山水画',
             'Chinese ink painting', 'ink wash', 'traditional Chinese painting',
             'watercolor landscape'],
  // 传统外星人俗套
  clicheAlien: ['传统外星人', '小灰人', '外星飞船', 'UFO', '飞碟',
                'typical alien', 'little grey', 'flying saucer']
};

// Nirath特殊能量形式（替代水晶）
const NIRATH_ENERGY_REPLACEMENTS = {
  '水晶': '双恒星能量脉络',
  '水晶柱': '等离子体能量藤蔓',
  '水晶球': '生物荧光孢子云',
  '水晶簇': '地核发光菌丝',
  'crystal': 'stellar energy veins',
  'crystal pillar': 'plasma vines',
  'crystal ball': 'bio-luminescent spore cloud'
};

class BeastConsistencyGuard {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.strictMode = options.strictMode || true; // 严格模式：违规即拦截
    this.warningMode = options.warningMode || false; // 警告模式：记录但不拦截
  }

  /**
   * 主入口：检查Prompt中的神兽一致性
   * @param {string} prompt - 待检查的Prompt
   * @param {string} beastId - 神兽ID
   * @returns {Object} { passed, violations, fixed }
   */
  check(prompt, beastId) {
    const violations = [];
    
    // 1. 颜色检查
    const colorCheck = this.checkColor(prompt, beastId);
    if (!colorCheck.passed) violations.push(colorCheck);
    
    // 2. 形态检查
    const formCheck = this.checkForm(prompt, beastId);
    if (!formCheck.passed) violations.push(formCheck);
    
    // 3. 能力检查
    const abilityCheck = this.checkAbility(prompt, beastId);
    if (!abilityCheck.passed) violations.push(abilityCheck);
    
    // 4. 规模检查（如果有尺寸描述）
    const scaleCheck = this.checkScale(prompt, beastId);
    if (!scaleCheck.passed) violations.push(scaleCheck);
    
    // 5. 环境检查（如果有环境描述）
    const habitatCheck = this.checkHabitat(prompt, beastId);
    if (!habitatCheck.passed) violations.push(habitatCheck);
    
    // 6. 全局禁用元素检查（新增 - 适用于所有神兽）
    const globalChecks = this.checkGlobalBans(prompt);
    if (globalChecks.length > 0) violations.push(...globalChecks);
    
    const passed = violations.length === 0;
    
    // 尝试自动修复
    let fixed = prompt;
    if (!passed) {
      fixed = this.autoFix(prompt, violations);
    }
    
    // 如果检测到水晶，自动替换为Nirath能量形式
    if (globalChecks.some(v => v.type === 'crystal')) {
      fixed = this.replaceCrystalWithEnergy(fixed);
    }
    
    return {
      passed,
      violations,
      fixed,
      beastId,
      severity: this.calculateSeverity(violations)
    };
  }

  /**
   * 批量检查多个神兽
   */
  checkMulti(prompt, beastIds) {
    const results = [];
    for (const id of beastIds) {
      results.push(this.check(prompt, id));
    }
    
    const allPassed = results.every(r => r.passed);
    const allViolations = results.flatMap(r => r.violations);
    
    return {
      allPassed,
      results,
      totalViolations: allViolations.length,
      mostSevere: this.findMostSevere(results)
    };
  }

  /**
   * 全局禁用元素检查（适用于所有神兽）
   */
  checkGlobalBans(prompt) {
    const violations = [];
    
    // 检查水晶类
    for (const term of GLOBAL_BANNED_ELEMENTS.crystal) {
      if (prompt.includes(term)) {
        violations.push({
          passed: false,
          type: 'crystal',
          level: 'error',
          detail: `检测到全局禁用元素"${term}"（水晶类俗套）`,
          expected: '使用Nirath特殊能量形式替代',
          fix: `将"${term}"替换为Nirath能量形式如"双恒星能量脉络"或"等离子体能量藤蔓"`,
          global: true
        });
      }
    }
    
    // 检查山水画风
    for (const term of GLOBAL_BANNED_ELEMENTS.artStyle) {
      if (prompt.includes(term)) {
        violations.push({
          passed: false,
          type: 'art_style',
          level: 'error',
          detail: `检测到全局禁用艺术风格"${term}"`,
          expected: '超写实3D渲染、电影级光影',
          fix: `删除"${term}"，使用"超写实3D数字人渲染"或"皮克斯级质感"`,
          global: true
        });
      }
    }
    
    // 检查传统外星人俗套
    for (const term of GLOBAL_BANNED_ELEMENTS.clicheAlien) {
      if (prompt.includes(term)) {
        violations.push({
          passed: false,
          type: 'cliche_alien',
          level: 'warning',
          detail: `检测到俗套外星元素"${term}"`,
          expected: 'Nirath原生生物或能量现象',
          fix: `删除"${term}"，使用Nirath特有设定`,
          global: true
        });
      }
    }
    
    return violations;
  }

  /**
   * 自动替换水晶为Nirath能量形式
   */
  replaceCrystalWithEnergy(prompt) {
    let corrected = prompt;
    for (const [crystal, replacement] of Object.entries(NIRATH_ENERGY_REPLACEMENTS)) {
      corrected = corrected.replace(new RegExp(crystal, 'g'), replacement);
    }
    return corrected;
  }

  /**
   * 颜色一致性检查
   */
  checkColor(prompt, beastId) {
    const rules = COLOR_RULES[beastId];
    if (!rules) return { passed: true, type: 'color', detail: '无颜色规则' };
    
    // 检查禁用色
    for (const forbidden of rules.forbidden) {
      if (prompt.includes(forbidden)) {
        return {
          passed: false,
          type: 'color',
          level: 'error',
          detail: `检测到禁用颜色"${forbidden}"`,
          expected: `应使用: ${rules.allowed.join('/')}`,
          fix: `将"${forbidden}"替换为${rules.allowed[0]}`
        };
      }
    }
    
    return { passed: true, type: 'color', detail: '颜色合规' };
  }

  /**
   * 形态一致性检查
   */
  checkForm(prompt, beastId) {
    const rules = FORM_RULES[beastId];
    if (!rules) return { passed: true, type: 'form', detail: '无形态规则' };
    
    // 检查禁用形态词
    for (const forbidden of rules.forbidden) {
      if (prompt.includes(forbidden)) {
        return {
          passed: false,
          type: 'form',
          level: 'critical',
          detail: `检测到禁用形态"${forbidden}"`,
          expected: `应为: ${rules.bodyPlan}`,
          fix: `删除"${forbidden}"，确保${rules.bodyPlan}特征`
        };
      }
    }
    
    // 检查应有形态是否存在（包括别名）
    const validForms = [rules.bodyPlan, ...(rules.aliases || [])];
    const hasValidForm = validForms.some(form => prompt.includes(form));
    
    if (!hasValidForm) {
      return {
        passed: false,
        type: 'form',
        level: 'warning',
        detail: `未检测到应有形态"${rules.bodyPlan}"`,
        expected: `应包含: ${rules.bodyPlan}`,
        fix: `添加${rules.bodyPlan}描述`
      };
    }
    
    return { passed: true, type: 'form', detail: '形态合规' };
  }

  /**
   * 能力一致性检查
   */
  checkAbility(prompt, beastId) {
    const rules = ABILITY_RULES[beastId];
    if (!rules) return { passed: true, type: 'ability', detail: '无能力规则' };
    
    // 检查禁用能力
    for (const forbidden of rules.forbidden) {
      if (prompt.includes(forbidden)) {
        return {
          passed: false,
          type: 'ability',
          level: 'error',
          detail: `检测到禁用能力"${forbidden}"`,
          expected: `核心能力: ${rules.core}`,
          fix: `删除"${forbidden}"，强调${rules.core}`
        };
      }
    }
    
    return { passed: true, type: 'ability', detail: '能力合规' };
  }

  /**
   * 规模一致性检查
   */
  checkScale(prompt, beastId) {
    const expectedScale = SCALE_RULES[beastId];
    if (!expectedScale) return { passed: true, type: 'scale', detail: '无规模规则' };
    
    // 检测规模关键词
    const scaleKeywords = {
      '超巨型': ['千里', '万丈', '遮天蔽日', '山一样'],
      '巨型': ['百丈', '翼展百米', '如山'],
      '大型': ['数丈', '数倍于'],
      '中型': ['如人', '如马'],
      '小型': ['如猫', '如鼠']
    };
    
    // 如果神兽应为超巨型，但Prompt中描述为小型
    if (expectedScale === '超巨型') {
      for (const [scale, keywords] of Object.entries(scaleKeywords)) {
        if (scale === '超巨型') continue;
        for (const kw of keywords) {
          if (prompt.includes(kw)) {
            return {
              passed: false,
              type: 'scale',
              level: 'warning',
              detail: `规模描述"${kw}"与预期"${expectedScale}"不符`,
              expected: `应体现: ${expectedScale}`,
              fix: `删除"${kw}"，添加"千里"或"万丈"等超巨型描述`
            };
          }
        }
      }
    }
    
    return { passed: true, type: 'scale', detail: '规模合规' };
  }

  /**
   * 栖息地一致性检查
   */
  checkHabitat(prompt, beastId) {
    const validHabitats = HABITAT_RULES[beastId];
    if (!validHabitats) return { passed: true, type: 'habitat', detail: '无栖息地规则' };
    
    // 检查是否出现在错误栖息地
    const allHabitats = Object.values(HABITAT_RULES).flat();
    const wrongHabitats = allHabitats.filter(h => !validHabitats.includes(h));
    
    for (const wrong of wrongHabitats) {
      if (prompt.includes(wrong)) {
        return {
          passed: false,
          type: 'habitat',
          level: 'error',
          detail: `神兽出现在错误栖息地"${wrong}"`,
          expected: `应出现在: ${validHabitats.join('/')}`,
          fix: `将"${wrong}"替换为${validHabitats[0]}`
        };
      }
    }
    
    return { passed: true, type: 'habitat', detail: '栖息地合规' };
  }

  /**
   * 自动修复违规Prompt
   */
  autoFix(prompt, violations) {
    let fixed = prompt;
    
    for (const v of violations) {
      if (v.fix) {
        // 简单替换逻辑
        if (v.type === 'color' && v.detail.includes('检测到禁用颜色')) {
          const color = v.detail.match(/"([^"]+)"/)?.[1];
          if (color) {
            const replacement = v.expected?.match(/应使用: (.+)/)?.[1]?.split('/')?.[0] || '';
            fixed = fixed.replace(new RegExp(color, 'g'), replacement);
          }
        }
      }
    }
    
    return fixed;
  }

  /**
   * 计算严重等级
   */
  calculateSeverity(violations) {
    if (violations.some(v => v.level === 'critical')) return 'critical';
    if (violations.some(v => v.level === 'error')) return 'error';
    if (violations.some(v => v.level === 'warning')) return 'warning';
    return 'pass';
  }

  findMostSevere(results) {
    const severityOrder = { critical: 4, error: 3, warning: 2, pass: 1 };
    return results.reduce((most, current) => {
      return severityOrder[current.severity] > severityOrder[most.severity] ? current : most;
    }, results[0]);
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[BeastConsistencyGuard] ${msg}`);
    }
  }
}

module.exports = BeastConsistencyGuard;

// 测试
if (require.main === module) {
  console.log('🛡️ BeastConsistencyGuard 测试');
  const guard = new BeastConsistencyGuard({ verbose: true });
  
  // 测试：烛龙出现蓝色（违规）
  const badPrompt = '蓝色烛龙翱翔于永夜裂谷，展开西方龙的双翼，吐出冰冷的水柱';
  const result = guard.check(badPrompt, 'zhu-long');
  
  console.log('\n❌ 违规测试:');
  console.log(`  通过: ${result.passed}`);
  console.log(`  严重等级: ${result.severity}`);
  console.log(`  违规项: ${result.violations.length}`);
  result.violations.forEach(v => {
    console.log(`    - [${v.type}] ${v.detail}`);
    console.log(`      修复: ${v.fix}`);
  });
  
  // 测试：合规Prompt
  const goodPrompt = '赤红烛龙横亘于永夜裂谷，人面蛇身，竖直双目如炬，口中衔持永恒火精';
  const result2 = guard.check(goodPrompt, 'zhu-long');
  console.log('\n✅ 合规测试:');
  console.log(`  通过: ${result2.passed}`);
}
