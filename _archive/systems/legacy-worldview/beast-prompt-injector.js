/**
 * 异兽Prompt注入器 v1.0
 * 将异兽特征注入Prompt，确保异兽形象一致
 * 
 * 功能：
 * - 加载异兽档案
 * - 构建异兽视觉描述
 * - 注入Prompt片段
 * - 一致性检查（颜色/形态/能力）
 * 
 * @version v1.0
 * @author 小G
 */

const fs = require('fs');
const path = require('path');

class BeastPromptInjector {
  constructor(options = {}) {
    this.mode = options.mode || 'nirath';
    this.beastDataPath = options.beastDataPath || path.join(__dirname, '..', 'data', 'nirath-creature-data.js');
    
    // 加载异兽数据库
    this.beastDatabase = this._loadBeastDatabase();
    
    // 异兽特征映射
    this.beastTraits = {
      'zhu-long': {
        name: '烛龙',
        englishName: 'Zhulong',
        category: 'serpentine',
        scale: '超巨型',
        length: '数千米',
        color: {
          primary: 'crimson-red',
          secondary: 'amber-gold',
          accent: 'obsidian-black'
        },
        features: [
          'massive serpentine body with crimson scales',
          'amber eyes reflecting the surrounding environment',
          'obsidian horns reflecting starlight',
          'bioluminescent vein patterns along spine',
          'magma-like glow from within scales'
        ],
        abilities: [
          'controls day and night cycle',
          'breath creates volcanic eruptions',
          'eyes reflect the surrounding landscape'
        ],
        habitat: '钟山之巅',
        temperament: 'wise and ancient',
        visualComplexity: 10
      },
      'qing-qiu': {
        name: '青丘',
        englishName: 'Qingqiu',
        category: 'fox-spirit',
        scale: '中型',
        length: '2-3米',
        color: {
          primary: 'jade-green',
          secondary: 'silver-white',
          accent: 'peach-blossom-pink'
        },
        features: [
          'nine flowing tails with bioluminescent tips',
          'jade-green fur with silver undertones',
          'intelligent amber eyes',
          'graceful movement with ethereal quality'
        ],
        abilities: [
          'shape-shifting',
          'illusion creation',
          'wisdom and prophecy'
        ],
        habitat: '青丘灵原',
        temperament: 'mischievous and wise',
        visualComplexity: 8
      }
    };
  }

  /**
   * 加载异兽数据库
   */
  _loadBeastDatabase() {
    try {
      // 尝试从文件加载
      if (fs.existsSync(this.beastDataPath)) {
        const data = require(this.beastDataPath);
        return data;
      }
    } catch (e) {
      console.warn(`[BeastPromptInjector] 无法加载异兽数据库: ${e.message}`);
    }
    
    // 返回内置数据
    return this.beastTraits;
  }

  /**
   * 注入异兽Prompt（核心方法）
   * @param {string} beastId - 异兽ID
   * @param {Object} options - 注入选项
   * @param {string} options.sceneType - 场景类型（reveal/interaction/climax）
   * @param {string} options.prompt - 现有Prompt（可选）
   * @returns {Object} 注入结果
   */
  inject(beastId, options = {}) {
    const startTime = Date.now();
    console.log(`[BeastPromptInjector] 🐉 开始注入异兽Prompt | 异兽: ${beastId}`);
    
    // 1. 检查异兽是否存在
    const beast = this._getBeastData(beastId);
    if (!beast) {
      console.error(`[BeastPromptInjector] ❌ 异兽未找到: ${beastId}`);
      return {
        success: false,
        error: `异兽 "${beastId}" 未在数据库中注册`,
        fragment: null
      };
    }
    
    // 2. 构建异兽Prompt片段
    const fragment = this._buildBeastFragment(beast, options.sceneType || 'reveal');
    
    // 3. 一致性检查
    const consistency = this._checkConsistency(beast, fragment);
    
    // 4. 如果提供了现有Prompt，注入片段
    let finalPrompt = options.prompt || '';
    if (finalPrompt) {
      finalPrompt = this._injectFragment(finalPrompt, fragment);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[BeastPromptInjector] ✅ 异兽Prompt注入完成 | 异兽: ${beast.name} | 片段长度: ${fragment.length} | 耗时: ${duration}ms`);
    
    return {
      success: true,
      beastId,
      beastName: beast.name,
      fragment,
      finalPrompt: finalPrompt || null,
      consistency,
      duration
    };
  }

  /**
   * 批量注入
   */
  injectBatch(beastIds, options = {}) {
    const results = [];
    
    for (const beastId of beastIds) {
      const result = this.inject(beastId, options);
      results.push(result);
    }
    
    return {
      success: results.every(r => r.success),
      results,
      totalFragments: results.filter(r => r.success).length
    };
  }

  /**
   * 获取异兽数据（支持ID和中文名）
   */
  _getBeastData(beastId) {
    // 中文名到ID的映射
    const nameToIdMap = {
      '烛龙': 'zhu-long',
      '青丘': 'qing-qiu',
      '凤凰': 'phoenix',
      '麒麟': 'qilin',
      '帝江': 'di-jiang',
      '白泽': 'bai-ze'
    };
    
    // 如果是中文名，转换为ID
    const normalizedId = nameToIdMap[beastId] || beastId;
    
    // 尝试从数据库获取
    if (this.beastDatabase && this.beastDatabase[normalizedId]) {
      return this.beastDatabase[normalizedId];
    }
    
    // 尝试内置数据
    return this.beastTraits[normalizedId] || null;
  }

  /**
   * 构建异兽Prompt片段
   */
  _buildBeastFragment(beast, sceneType) {
    const parts = [];
    
    // 基础描述
    parts.push(`${beast.englishName} (${beast.name})`);
    parts.push(`${beast.scale} ${beast.category} creature, ${beast.length} in length`);
    
    // 颜色
    const colorDesc = `Color: ${beast.color.primary} primary, ${beast.color.secondary} secondary, ${beast.color.accent} accents.`;
    parts.push(colorDesc);
    
    // 特征（根据场景类型选择）
    const featureCount = sceneType === 'reveal' ? 5 : sceneType === 'interaction' ? 3 : 2;
    const selectedFeatures = beast.features.slice(0, featureCount);
    parts.push(`Features: ${selectedFeatures.join(', ')}.`);
    
    // 能力（仅高潮/揭示场景）
    if (sceneType === 'climax' || sceneType === 'reveal') {
      parts.push(`Abilities: ${beast.abilities.join(', ')}.`);
    }
    
    // 栖息地
    if (beast.habitat) {
      parts.push(`Habitat: ${beast.habitat}.`);
    }
    
    // 气质
    parts.push(`Temperament: ${beast.temperament}.`);
    
    return parts.join('. ');
  }

  /**
   * 注入片段到Prompt
   */
  _injectFragment(prompt, fragment) {
    // 在角色描述后插入异兽描述
    if (prompt.includes('Characters:')) {
      return prompt.replace(/(Characters:.*?\.)/, `$1 ${fragment}`);
    }
    
    // 如果没有角色描述，在场景描述后插入
    if (prompt.includes('Cinematic shot,')) {
      return prompt.replace(/(Cinematic shot,.*?\.)/, `$1 ${fragment}`);
    }
    
    // 默认：追加到末尾
    return `${prompt} ${fragment}`;
  }

  /**
   * 一致性检查
   */
  _checkConsistency(beast, fragment) {
    const checks = {
      color: { passed: true, issues: [] },
      features: { passed: true, issues: [] },
      scale: { passed: true, issues: [] }
    };
    
    // 颜色一致性
    const colorChecks = [
      { key: beast.color.primary, name: '主色' },
      { key: beast.color.secondary, name: '辅色' },
      { key: beast.color.accent, name: '强调色' }
    ];
    
    for (const check of colorChecks) {
      if (!fragment.includes(check.key)) {
        checks.color.passed = false;
        checks.color.issues.push(`片段中未包含${check.name} "${check.key}"`);
      }
    }
    
    // 特征一致性
    const featureCheck = beast.features.slice(0, 3);
    for (const feature of featureCheck) {
      const keyWord = feature.split(' ')[0]; // 取第一个词
      if (!fragment.includes(keyWord)) {
        checks.features.passed = false;
        checks.features.issues.push(`片段中未包含特征关键词 "${keyWord}"`);
      }
    }
    
    // 规模一致性
    if (!fragment.includes(beast.scale)) {
      checks.scale.passed = false;
      checks.scale.issues.push(`片段中未包含规模 "${beast.scale}"`);
    }
    
    const allPassed = checks.color.passed && checks.features.passed && checks.scale.passed;
    
    return {
      passed: allPassed,
      checks,
      issueCount: checks.color.issues.length + checks.features.issues.length + checks.scale.issues.length
    };
  }

  /**
   * 验证异兽Prompt（检查是否包含必要元素）
   */
  validateBeastPrompt(prompt, beastId) {
    const beast = this._getBeastData(beastId);
    if (!beast) return { valid: false, error: '异兽不存在' };
    
    const issues = [];
    
    // 检查颜色
    if (!prompt.includes(beast.color.primary)) {
      issues.push(`缺少主色: ${beast.color.primary}`);
    }
    
    // 检查特征
    const keyFeature = beast.features[0].split(' ').slice(0, 2).join(' ');
    if (!prompt.includes(keyFeature.split(' ')[0])) {
      issues.push(`缺少特征: ${keyFeature}`);
    }
    
    // 检查规模
    if (!prompt.includes(beast.scale)) {
      issues.push(`缺少规模描述: ${beast.scale}`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      beastId,
      beastName: beast.name
    };
  }

  /**
   * 获取异兽列表
   */
  getBeastList() {
    const beasts = [];
    
    for (const [id, data] of Object.entries(this.beastTraits)) {
      beasts.push({
        id,
        name: data.name,
        englishName: data.englishName,
        scale: data.scale,
        habitat: data.habitat,
        category: data.category
      });
    }
    
    return beasts;
  }

  /**
   * 添加异兽数据
   */
  addBeast(beastId, beastData) {
    this.beastTraits[beastId] = beastData;
    console.log(`[BeastPromptInjector] ➕ 添加异兽: ${beastId} (${beastData.name})`);
    return true;
  }
}

module.exports = { BeastPromptInjector };

// CLI入口
if (require.main === module) {
  const injector = new BeastPromptInjector();
  
  // 测试注入
  const result = injector.inject('zhu-long', {
    sceneType: 'reveal',
    prompt: '16:9 widescreen电影级镜头. Epic establishing shot, Eternal Night Canyon. Characters: young protagonist.'
  });
  
  console.log('\n=== 异兽Prompt注入结果 ===');
  console.log(`成功: ${result.success}`);
  console.log(`异兽: ${result.beastName}`);
  console.log(`片段: ${result.fragment}`);
  console.log(`一致性: ${result.consistency.passed ? '通过' : '未通过'}`);
  console.log(`\n=== 最终Prompt ===`);
  console.log(result.finalPrompt);
}
