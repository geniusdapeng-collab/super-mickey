/**
 * Nirath场景名映射器
 * 将剧本中的场景描述/类型映射到Nirath场景库中的标准场景名
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const { habitatToBibleMapping } = require('./habitat-bible-mapping');
// 🔥 v6.2-fix: 引入Nirath场景自动生成Agent
const { NirathSceneGenerator } = require('./nirath-scene-generator');

class NirathSceneMapper {
  constructor(options = {}) {
    this.config = {
      workDir: options.workDir || path.join(__dirname, '..'),
      libraryPath: options.libraryPath || path.join(__dirname, '..', 'data', 'nirath-scene-library-v2.json'),
      // 🔥 v6.2-fix: 自动场景生成配置
      autoGenerate: options.autoGenerate !== false,  // 默认开启
      generatorOptions: options.generatorOptions || {}
    };
    
    this.sceneLibrary = this.loadLibrary();
    this.sceneNames = Object.keys(this.sceneLibrary);
    
    // 🔥 v6.2-fix: 初始化场景生成器
    this.generator = new NirathSceneGenerator({
      libraryPath: this.config.libraryPath,
      autoSave: true,
      ...this.config.generatorOptions
    });
    
    // 记录自动生成统计
    this.generatedInSession = [];
    
    // 关键词映射表（narration关键词 → 场景名）
    this.keywordMappings = {
      '归墟': '归墟之海',
      '海': '归墟之海',
      '海洋': '归墟之海',
      '深渊': '归墟之海',
      '发光海洋': '归墟之海',
      
      '不周': '不周山脉',
      '山': '不周山脉',
      '山脉': '不周山脉',
      '天柱': '不周山脉',
      '裂谷': '不周山脉',
      
      '青丘': '青丘灵原',
      '草原': '青丘灵原',
      '灵原': '青丘灵原',
      '草地': '青丘灵原',
      '荧光草': '青丘灵原',
      
      '钟山': '钟山之巅',
      '山顶': '钟山之巅',
      '巅峰': '钟山之巅',
      '烛龙': '钟山之巅',
      
      '香火山脉': '不周山脉',
      '香炉': '不周山脉',
      '神殿': '不周山脉',
      '烟气': '不周山脉',
      '檀香': '不周山脉',
      '芳香': '不周山脉',
      '火山': '不周山脉',
      '烟雾': '不周山脉',
      '香': '不周山脉',
      
      '银色湖泊': '银色湖泊',
      '湖泊': '银色湖泊',
      '湖边': '银色湖泊',
      '湖水': '银色湖泊',
      
      '建木': '建木林',
      '森林': '建木林',
      '树林': '建木林',
      '巨树': '建木林',
      '神树': '建木林',
      
      '昆仑': '昆仑虚',
      '仙境': '昆仑虚',
      '悬浮': '昆仑虚',
      '水晶': '昆仑虚',
      
      '幽都': '幽都暗域',
      '黑暗': '幽都暗域',
      '地底': '幽都暗域',
      '洞穴': '幽都暗域',
      
      '流沙': '流沙瀚海',
      '沙漠': '流沙瀚海',
      '沙海': '流沙瀚海',
      '时间': '流沙瀚海'
    };
    
    // 类型默认映射（当关键词无法匹配时）
    this.typeDefaults = {
      'opening': '青丘灵原',
      'environment': '归墟之海',
      'discovery': '银色湖泊',
      'interaction': '青丘灵原',
      'climax': '钟山之巅',
      'closing': '昆仑虚'
    };
  }
  
  loadLibrary() {
    try {
      const data = JSON.parse(fss.readFileSync(this.config.libraryPath, 'utf8'));
      delete data._meta;
      return data;
    } catch (e) {
      console.warn(`[SceneMapper] 无法加载场景库: ${e.message}`);
      return {};
    }
  }
  
  /**
   * 根据narration和type映射到Nirath场景名
   * @param {string} narration - 镜头 narration/脚本
   * @param {string} type - 镜头类型
   * @returns {string} 场景名（中文）
   */
  map(narration = '', type = 'generic', options = {}) {
    // v6.2-fix: 第一优先级 - 栖息地匹配(40神兽栖息地 → 圣经10场景)
    const beastId = options.beastId || '';
    const sceneDescription = options.sceneDescription || '';
    const fullText = `${sceneDescription} ${narration}`;
    
    // 检查栖息地映射
    let bestMatch = null;
    let bestLength = 0;
    for (const [habitat, bibleScene] of Object.entries(habitatToBibleMapping)) {
      if (fullText.includes(habitat)) {
        if (habitat.length > bestLength) {
          bestMatch = bibleScene;
          bestLength = habitat.length;
        }
      }
    }
    if (bestMatch) {
      return bestMatch;
    }
    
    // 第二优先级 - narration关键词匹配(原有逻辑)
    if (!narration) {
      return this.typeDefaults[type] || '青丘灵原';
    }
    
    const sortedKeywords = Object.keys(this.keywordMappings).sort((a, b) => b.length - a.length);
    for (const keyword of sortedKeywords) {
      if (narration.includes(keyword)) {
        const sceneName = this.keywordMappings[keyword];
        
        // 🔥 v6.2-fix: 如果场景在库中，正常返回
        if (this.sceneNames.includes(sceneName)) {
          return sceneName;
        }
        
        // 🔥 v6.2-fix: 如果场景不在库中且开启了autoGenerate，自动生成
        if (this.config.autoGenerate) {
          const generated = this.generator.generate(sceneName, { autoSave: true });
          if (generated) {
            this.generatedInSession.push({
              earthName: sceneName,
              nirathName: generated.nirathName,
              terrainType: generated.terrainType,
              mappedFrom: `关键词匹配: "${keyword}"`
            });
            // 刷新场景名列表
            this.sceneNames.push(sceneName);
            return sceneName;
          }
        }
        
        // 生成失败，回退到类型默认
        break; // 跳出关键词循环，进入类型默认
      }
    }
    
    // 3. 回退到类型默认
    const fallback = this.typeDefaults[type] || '青丘灵原';
    
    // 🔥 v6.2-fix: 如果开启了autoGenerate，尝试自动生成场景
    if (this.config.autoGenerate && narration && narration.length > 0) {
      // 从narration中提取场景描述关键词（取前20字作为场景名）
      const sceneName = this.extractSceneName(narration, fallback);
      if (sceneName && sceneName !== fallback) {
        const generated = this.generator.generate(sceneName, { autoSave: true });
        if (generated) {
          this.generatedInSession.push({
            earthName: sceneName,
            nirathName: generated.nirathName,
            terrainType: generated.terrainType,
            mappedFrom: narration.substring(0, 50)
          });
          // 刷新场景名列表
          this.sceneNames.push(sceneName);
          return sceneName;
        }
      }
    }
    
    return fallback;
  }
  
  /**
   * 🔥 v6.2-fix: 从narration中提取场景描述词
   */
  extractSceneName(narration, fallback) {
    // 尝试提取场景描述词（如"银色湖泊"、"钟山之巅"等）
    // 优先匹配关键词映射中的未知场景
    for (const [keyword, sceneName] of Object.entries(this.keywordMappings)) {
      if (narration.includes(keyword) && !this.sceneNames.includes(sceneName)) {
        return sceneName;
      }
    }
    
    // 如果narration中有"在..."、"来到..."等短语，提取地点
    const locationPatterns = [
      /在([\u4e00-\u9fa5]{2,6})(?:上|中|里|内|边|旁|侧|下|前|后)/,
      /来到([\u4e00-\u9fa5]{2,6})(?:前|边|上|中|里)/,
      /前往([\u4e00-\u9fa5]{2,6})(?:方向|处|上|中)/,
      /站在([\u4e00-\u9fa5]{2,6})(?:上|中|里|边)/,
      /([\u4e00-\u9fa5]{2,6})(?:之上|之中|旁边|前面|背后|远处|近处)/
    ];
    
    for (const pattern of locationPatterns) {
      const match = narration.match(pattern);
      if (match && match[1]) {
        const candidate = match[1];
        // 检查是否是已知场景
        if (!this.sceneNames.includes(candidate)) {
          return candidate;
        }
      }
    }
    
    // 回退：使用fallback本身作为生成目标
    return null; // 返回null表示不需要生成新场景（fallback已在库中）
  }
  
  /**
   * 根据narration和type映射到Nirath场景名 + 光影推荐（v6.0-patch23）
   * @param {string} narration - 镜头 narration/脚本
   * @param {string} type - 镜头类型
   * @param {string} emotionPhase - 情绪阶段
   * @returns {Object} { sceneName, lighting }
   */
  mapWithLighting(narration = '', type = 'generic', emotionPhase = 'establishing', options = {}) {
    const sceneName = this.map(narration, type, options);
    
    // 情绪阶段 → 中文情绪词映射
    const emotionMap = {
      'establishing': '宁静',
      'rising': '希望',
      'building': '紧张',
      'climax': '史诗',
      'resolve': '温馨'
    };
    const emotionChinese = emotionMap[emotionPhase] || '宁静';
    
    // 根据情绪阶段推荐光源
    let lighting = null;
    try {
      const { getLightingForEmotion } = require('./intra-shot-prompt-enhancer.js');
      const lights = getLightingForEmotion(emotionChinese);
      if (lights && lights.length > 0) {
        lighting = {
          primary: lights[0],
          secondary: lights[1] || null,
          emotion: emotionPhase,
          emotionChinese
        };
      }
    } catch (e) {
      // 增强器不可用，跳过
      console.warn(`[SceneMapper] 光影推荐失败: ${e.message}`);
    }
    
    return { sceneName, lighting };
  }
  mapStoryboard(scenes = [], beastId = '') {
    const results = [];
    
    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx];
      const emotionPhase = scene.emotionPhase || this.calculateEmotionPhase(idx, scenes.length);
      
      // 🔥 v6.2-fix: 先尝试用scene.scene直接映射（如果scene.scene不是default）
      let mapped = null;
      if (scene.scene && scene.scene !== 'default' && scene.scene.trim().length > 0) {
        // 先检查scene.scene是否在库中
        if (this.sceneNames.includes(scene.scene.trim())) {
          mapped = { sceneName: scene.scene.trim(), lighting: null };
        }
      }
      
      // 如果没有直接匹配，使用narration映射
      if (!mapped) {
        mapped = this.mapWithLighting(
          scene.narration || scene.description || '', 
          scene.type || 'generic',
          emotionPhase,
          { 
            beastId,
            sceneDescription: scene.scene || ''
          }
        );
      }
      
      // 🔥 v6.2-fix: 检查是否是fallback场景（默认场景名），如果是，尝试用scene.scene自动生成
      const isFallback = mapped.sceneName === (this.typeDefaults[scene.type || 'generic'] || '青丘灵原');
      const hasSceneName = scene.scene && scene.scene.trim().length > 0 && scene.scene !== 'default';
      
      if (isFallback && hasSceneName && this.config.autoGenerate) {
        const originalSceneName = scene.scene.trim();
        const generated = this.generator.generate(originalSceneName, { autoSave: true });
        
        if (generated) {
          this.generatedInSession.push({
            earthName: originalSceneName,
            nirathName: generated.nirathName,
            terrainType: generated.terrainType,
            mappedFrom: `storyboard场景名: "${originalSceneName}"`
          });
          this.sceneNames.push(originalSceneName);
          
          results.push({
            ...scene,
            scene: originalSceneName,
            nirathName: generated.nirathName,
            autoGenerated: true,
            lighting: mapped.lighting
          });
          continue;
        }
      }
      
      results.push({
        ...scene,
        scene: mapped.sceneName,
        lighting: mapped.lighting
      });
    }
    
    return results;
  }
  
  // v6.0-patch23: 计算情绪阶段辅助方法
  calculateEmotionPhase(index, total) {
    const ratio = total > 1 ? index / (total - 1) : 0;
    if (ratio <= 0.15) return 'establishing';
    if (ratio <= 0.45) return 'rising';
    if (ratio <= 0.75) return 'building';
    if (ratio <= 0.90) return 'climax';
    return 'resolve';
  }
  
  /**
   * 🔥 v6.2-fix: 获取本次session自动生成的场景列表
   */
  getGeneratedScenes() {
    return this.generatedInSession;
  }
  
  /**
   * 获取场景详情（用于调试/日志）
   */
  getSceneInfo(sceneName) {
    const scene = this.sceneLibrary[sceneName];
    if (!scene) return null;
    return {
      name: sceneName,
      nirathName: scene.nirathName,
      chineseName: scene.chineseName,
      hasGeology: !!scene.geology,
      hasEcosystem: !!scene.ecosystem,
      hasLightEnvironment: !!scene.lightEnvironment,
      hasMaterials: !!scene.materials,
      hasVisualRules: !!(scene.visualRules && scene.visualRules.length > 0)
    };
  }
}

module.exports = { NirathSceneMapper };
