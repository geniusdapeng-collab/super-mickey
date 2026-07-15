/**
 * 原创世界观校验层 — Nirath World Lore Validator v13.0-Peng
 * 
 * 职责：
 * - 所有异兽形象严格按Nirath原创世界观描述校验
 * - 禁止引入地球已知文化符号（东方/西方传统元素）
 * - Prompt构建时自动注入原创世界观描述
 * - 校验结果输出（通过/警告/错误）
 * 
 * v13.0转型：
 * - 从"Nirath原创世界观原著校验"→"原创世界观一致性校验"
 * - 保留叙事骨架功能定位（守护者/飞行坐骑/萌宠等）
 * - 视觉描述100%原创再造
 * - 杜绝地球已知文化符号/建筑风格/服饰纹样
 */

// ========== Nirath原创世界观数据库 ==========
const LORE_DATABASE = {
  // 光翼游天兽 — 原创飞行坐骑（功能定位：飞行/云雨/神龙）
  dragon_skyserpent: {
    category: '游天兽族',
    name: '光翼游天兽',
    source: 'Nirath原创世界观',
    canonicalDescription: 'translucent scaled sky-serpent, winged, magma glow within scales, horn rings, cloud-riding',
    mustInclude: ['sky-serpent', 'translucent scales', 'magma glow', 'winged', 'horn rings'],
    mustExclude: ['地球 dragon', 'western dragon', 'wyvern', 'four-legged dragon', 'dinosaur', 'snake without wings'],
    explanation: 'Nirath世界原创飞行生物，非地球任何龙族模板。半透明鳞片内含岩浆光流，双翼如云，乘光而行',
    severity: 'ERROR'
  },

  // 虹羽焰灵 — 原创火元素灵兽（功能定位：涅槃/重生/五彩神鸟）
  bird_flame: {
    category: '焰灵族',
    name: '虹羽焰灵',
    source: 'Nirath原创世界观',
    canonicalDescription: 'iridescent plumage, five-hued flame feathers, long serpentine neck, phoenix-like but original',
    mustInclude: ['iridescent plumage', 'flame-colored', 'serpentine neck', 'five hues'],
    mustExclude: ['western phoenix', 'firebird', 'eagle', 'hawk', 'crow', 'Earth bird'],
    explanation: 'Nirath世界原创火元素灵兽，五色彩羽如虹，非地球任何鸟类模板。象征生命轮回与光之重生',
    severity: 'ERROR'
  },

  // 晶齿萌兽 — 原创萌宠（功能定位：贪吃/可爱/伙伴）
  beast_crystal: {
    category: '萌兽族',
    name: '晶齿萌兽',
    source: 'Nirath原创世界观',
    canonicalDescription: 'crystal-toothed, fluffy round body, eyes under armpits, cute but eerie',
    mustInclude: ['crystal teeth', 'fluffy round', 'eyes under armpits', 'cute'],
    mustExclude: ['taotie', '地球 monster', 'sheep body', 'human face狰狞', 'Earth culture'],
    explanation: 'Nirath世界原创萌兽，晶钻牙齿，毛茸茸圆滚滚，眼睛长在腋下位置。贪吃可爱但带有奇异感',
    severity: 'ERROR'
  },

  // 目如星渊的守光巨兽 — 原创时间守护者（功能定位：昼夜交替/睁眼昼闭眼夜）
  beast_lightkeeper: {
    category: '守光族',
    name: '目如星渊的守光巨兽',
    source: 'Nirath原创世界观',
    canonicalDescription: 'massive eye like starry abyss, serpentine body, no wings no claws, light keeper',
    mustInclude: ['starry abyss eye', 'serpentine', 'no wings', 'no claws', 'light keeper'],
    mustExclude: ['human face', '地球 dragon', 'western dragon', 'horns', 'legs', 'candle dragon'],
    explanation: 'Nirath世界原创守光巨兽，单眼如星渊，蛇身无翼无爪。睁眼为昼闭眼为夜——时间本源守护者',
    severity: 'ERROR'
  },

  // 默认原创异兽
  default: {
    category: '未知异兽',
    name: 'Nirath神秘生物',
    source: 'Nirath原创世界观',
    canonicalDescription: '原创异世界生物，非地球任何已知物种或神话模板',
    mustInclude: ['original creature', 'alien ecosystem', 'bioluminescent'],
    mustExclude: ['地球 myth', 'western myth', 'dragon', 'phoenix', 'griffin', 'unicorn', 'Earth culture', 'anime', 'cartoon'],
    explanation: 'Nirath世界原创生物，必须100%原创视觉，杜绝任何地球文化符号',
    severity: 'ERROR'
  }
};

// ========== 校验引擎 ==========
class LoreValidator {
  constructor() {
    this.database = LORE_DATABASE;
    this.validationLog = [];
  }

  /**
   * 校验异兽Prompt是否符合Nirath原创世界观
   * @param {string} beastId — 异兽ID
   * @param {string} prompt — 待校验的Prompt文本
   * @returns {Object} 校验结果
   */
  validate(beastId, prompt) {
    const lore = this.database[beastId];
    
    if (!lore) {
      return {
        beastId,
        beastName: '未知异兽',
        isValid: false,
        passed: false,
        issues: [`未在Nirath世界观数据库中找到「${beastId}」，请确认异兽名称`],
        severity: 'ERROR',
        loreCompliant: false
      };
    }

    const issues = [];
    const promptLower = prompt.toLowerCase();

    // 1. 检查必须包含的元素
    for (const must of lore.mustInclude) {
      // 支持关键词匹配（模糊匹配）
      if (!this._containsKeyword(prompt, must)) {
        issues.push({
          type: 'MISSING_MUST_HAVE',
          severity: lore.severity,
          message: `缺少原创世界观关键特征「${must}」— ${lore.canonicalDescription}`,
          fix: `在Prompt中加入「${must}」`
        });
      }
    }

    // 2. 检查必须排除的元素
    for (const exclude of lore.mustExclude) {
      if (this._containsKeyword(prompt, exclude)) {
        issues.push({
          type: 'FORBIDDEN_ELEMENT',
          severity: 'ERROR',
          message: `包含禁止元素「${exclude}」— ${lore.explanation}`,
          fix: `从Prompt中移除「${exclude}」`
        });
      }
    }

    // 3. 地球文化符号检测（额外检查）
    const earthCulturalTerms = ['地球', 'Nirath原创世界观', '东方', 'western', 'european', 'medieval', 'gothic', 'dragon', 'phoenix', 'griffin', 'unicorn', 'anime', 'cartoon'];
    for (const term of earthCulturalTerms) {
      if (promptLower.includes(term.toLowerCase())) {
        issues.push({
          type: 'EARTH_CULTURAL_SYMBOL',
          severity: 'ERROR',
          message: `检测到地球文化符号「${term}」— Nirath世界必须100%原创视觉，杜绝任何地球已知文化模板`,
          fix: '移除地球文化符号，使用Nirath原创世界观描述'
        });
      }
    }

    const result = {
      beastId,
      beastName: lore.name,
      category: lore.category,
      source: lore.source,
      isValid: issues.filter(i => i.severity === 'ERROR').length === 0,
      passed: issues.length === 0,
      issues: issues,
      severity: issues.some(i => i.severity === 'ERROR') ? 'ERROR' : 
                issues.some(i => i.severity === 'WARNING') ? 'WARNING' : 'OK',
      loreCompliant: issues.filter(i => i.severity === 'ERROR').length === 0,
      canonicalDescription: lore.canonicalDescription,
      explanation: lore.explanation
    };

    // 记录日志
    this.validationLog.push({
      timestamp: new Date().toISOString(),
      ...result
    });

    return result;
  }

  /**
   * 自动修复Prompt（注入原创世界观描述）
   * @param {string} beastId — 异兽ID
   * @param {string} prompt — 原始Prompt
   * @returns {Object} { fixedPrompt, changes, originalValidation }
   */
  autoFix(beastId, prompt) {
    const validation = this.validate(beastId, prompt);
    
    if (validation.passed) {
      return {
        fixedPrompt: prompt,
        changes: [],
        originalValidation: validation,
        wasFixed: false
      };
    }

    let fixedPrompt = prompt;
    const changes = [];

    // 注入缺失的mustInclude元素
    for (const issue of validation.issues) {
      if (issue.type === 'MISSING_MUST_HAVE') {
        // 从fix建议中提取关键词
        const keyword = issue.fix.replace('在Prompt中加入「', '').replace('」', '');
        
        // 在Prompt末尾注入
        if (!fixedPrompt.includes(keyword)) {
          fixedPrompt += `，${keyword}`;
          changes.push({
            type: 'ADDED',
            element: keyword,
            reason: issue.message
          });
        }
      }
    }

    // 移除禁止元素（简单替换为空）
    for (const issue of validation.issues) {
      if (issue.type === 'FORBIDDEN_ELEMENT' || issue.type === 'EARTH_CULTURAL_SYMBOL') {
        const keyword = issue.fix.replace('从Prompt中移除「', '').replace('」', '');
        fixedPrompt = fixedPrompt.replace(new RegExp(keyword, 'gi'), '');
        changes.push({
          type: 'REMOVED',
          element: keyword,
          reason: issue.message
        });
      }
    }

    // 重新校验修复后的Prompt
    const reValidation = this.validate(beastId, fixedPrompt);

    return {
      fixedPrompt,
      changes,
      originalValidation: validation,
      reValidation,
      wasFixed: true,
      fullyFixed: reValidation.passed
    };
  }

  /**
   * 获取异兽的原创世界观Prompt模板
   * @param {string} beastId — 异兽ID
   * @param {Object} options — { scene: '场景描述', action: '动作' }
   * @returns {string} 符合原创世界观的Prompt
   */
  getCanonicalPrompt(beastId, options = {}) {
    const lore = this.database[beastId];
    if (!lore) {
      return `Nirath世界原创异兽（未收录），原创异世界生态，${options.scene || ''}`;
    }

    // 构建符合原创世界观的Prompt
    const parts = [
      `Nirath世界${lore.name}`,
      lore.canonicalDescription,
      options.action || '',
      options.scene || '原创异世界生态'
    ];

    return parts.filter(p => p).join('，');
  }

  /**
   * 批量校验多个Prompt
   * @param {Array} items — [{ beastId, prompt, shotId }]
   * @returns {Array} 校验结果列表
   */
  validateBatch(items) {
    return items.map(item => ({
      shotId: item.shotId,
      beastId: item.beastId,
      ...this.validate(item.beastId, item.prompt)
    }));
  }

  /**
   * 获取校验日志
   * @returns {Array} 校验历史
   */
  getValidationLog() {
    return this.validationLog;
  }

  /**
   * 打印校验报告
   * @param {Object} result — 校验结果
   */
  printReport(result) {
    console.log('\n📖 [LoreValidator] 《Nirath原创世界观》原著校验报告');
    console.log(`   异兽: ${result.beastName} (${result.category})`);
    console.log(`   出处: ${result.source}`);
    console.log(`   原文: ${result.canonicalDescription}`);
    console.log(`   状态: ${result.passed ? '✅ 通过' : result.severity === 'ERROR' ? '❌ 失败' : '⚠️ 警告'}`);
    
    if (result.issues.length > 0) {
      console.log('   问题:');
      for (const issue of result.issues) {
        const icon = issue.severity === 'ERROR' ? '❌' : '⚠️';
        console.log(`     ${icon} [${issue.type}] ${issue.message}`);
        if (issue.fix) {
          console.log(`        💡 修复: ${issue.fix}`);
        }
      }
    }
    
    console.log(`   说明: ${result.explanation}\n`);
  }

  // ========== 私有方法 ==========

  _containsKeyword(text, keyword) {
    const textLower = text.toLowerCase();
    const keywordLower = keyword.toLowerCase();
    
    // 直接包含
    if (textLower.includes(keywordLower)) return true;
    
    // 同义词扩展
    const synonyms = this._getSynonyms(keyword);
    for (const syn of synonyms) {
      if (textLower.includes(syn.toLowerCase())) return true;
    }
    
    return false;
  }

  _getSynonyms(keyword) {
    const synonymMap = {
      '蛇身': ['snake body', 'serpent body', 'long body'],
      '无翼': ['no wings', 'wingless', 'without wings'],
      '有翼': ['winged', 'with wings', '双翼'],
      '星渊之眼': ['human face', 'humanoid face'],
      '羊身': ['sheep body', 'goat body'],
      '虎齿': ['tiger teeth', 'sharp teeth'],
      '五彩': ['five colors', 'multicolored', 'colorful'],
      '独角': ['single horn', 'one horn', 'unicorn horn'],
      '雪白': ['white', 'pure white', 'snow white']
    };
    
    return synonymMap[keyword] || [];
  }
}

// ========== 导出 ==========
module.exports = {
  LoreValidator,
  LORE_DATABASE
};
