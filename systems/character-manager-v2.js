/**
 * 【角色管理系统 v2】Character Manager v2.0
 * 
 * 升级内容：
 * 1. 集成合规检查器（3级审查）
 * 2. 集成提示词构建器（6层结构）
 * 3. 集成年代服装指南（1920s-2020s）
 * 4. 7维角色分析模型
 * 5. 向后兼容v1.0 API
 * 
 * 7维分析模型：
 * - D1 身份维度：名字、年龄、物种、起源
 * - D2 外观维度：视觉特征、服装、角度
 * - D3 性格维度：核心特质、MBTI、成长弧
 * - D4 关系维度：人际网络、情感纽带
 * - D5 背景维度：起源故事、触发事件、冲突
 * - D6 能力维度：技能树、专长等级
 * - D7 叙事功能维度：在故事中的角色、功能、弧线
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const { CharacterComplianceChecker } = require('./character-compliance-checker.js');
const { CharacterPromptBuilder } = require('./character-prompt-builder.js');
const { CharacterEraGuide } = require('./character-era-guide.js');
const { GrowthTraceSystem } = require('./growth-trace-system.js');

const CHARACTERS_DIR = path.join(__dirname, '..', 'characters');

class CharacterManagerV2 {
  constructor(config = {}) {
    this.config = {
      strictMode: config.strictMode ?? true,
      autoCheckCompliance: config.autoCheckCompliance ?? true,
      maxChineseChars: config.maxChineseChars ?? 1500,  // 统一为980英文字符上限
      ...config
    };
    
    // 初始化子系统
    this.compliance = new CharacterComplianceChecker({
      strictMode: this.config.strictMode
    });
    this.promptBuilder = new CharacterPromptBuilder({
      maxChineseChars: this.config.maxChineseChars
    });
    this.eraGuide = new CharacterEraGuide();
    
    // v2.1升级：成长痕迹系统（山海经系列角色弧光追踪）
    this.growthTrace = new GrowthTraceSystem({
      protagonistId: this.config.protagonistId || 'xiaoG',
      traceDir: path.join(__dirname, '..', 'growth-traces')
    });
    
    this.ensureDirectory();
  }
  
  ensureDirectory() {
    if (!fss.existsSync(CHARACTERS_DIR)) {
      fss.mkdirSync(CHARACTERS_DIR, { recursive: true });
    }
  }
  
  // ====== v1兼容API ======
  
  getCharacterDir(characterId) {
    return path.join(CHARACTERS_DIR, characterId);
  }
  
  getCharacterCardPath(characterId) {
    return path.join(this.getCharacterDir(characterId), 'character-card.json');
  }
  
  getPortraitDir(characterId) {
    const dir = path.join(this.getCharacterDir(characterId), 'portraits');
    if (!fss.existsSync(dir)) fss.mkdirSync(dir, { recursive: true });
    return dir;
  }
  
  characterExists(characterId) {
    return fss.existsSync(this.getCharacterCardPath(characterId));
  }
  
  async loadCharacter(characterId) {
    const cardPath = this.getCharacterCardPath(characterId);
    try {
      const data = await fs.readFile(cardPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  async saveCharacter(characterId, characterCard) {
    characterCard.updatedAt = new Date().toISOString();
    characterCard.version = characterCard.version || '2.0';
    const cardPath = this.getCharacterCardPath(characterId);
    await fs.writeFile(cardPath, JSON.stringify(characterCard, null, 2));
  }
  
  createCharacter(characterId, characterData) {
    const characterDir = this.getCharacterDir(characterId);
    if (!fss.existsSync(characterDir)) {
      fss.mkdirSync(characterDir, { recursive: true });
    }
    
    // v6.5.62-P1: 生成极简锚点（character字段）
    const minimalAnchor = this._buildMinimalAnchor(characterData);
    
    // v6.5.62-P1: 生成定妆照路径（characterRef字段）
    const portraitPaths = this._buildPortraitPaths(characterId, characterData);
    
    const characterCard = {
      ...characterData,
      id: characterId, // 强制使用传入的ID，覆盖characterData中的id
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '2.0',
      generatedAssets: {
        portraits: portraitPaths, // v6.5.62: 注入定妆照路径
        referenceImages: []
      },
      appearances: [],
      v2Metadata: {
        analyzedDimensions: [],
        lastComplianceCheck: null,
        promptTemplates: {},
        minimalAnchor: minimalAnchor, // v6.5.62: 注入极简锚点
        portraitPaths: portraitPaths // v6.5.62: 注入定妆照路径
      }
    };
    
    this.saveCharacter(characterId, characterCard);
    return characterCard;
  }
  
  // ====== v2新功能：7维分析 ======
  
  /**
   * 7维角色分析
   * @param {string} characterId - 角色ID
   * @returns {Object} 7维分析报告
   */
  analyzeDimensions(characterId) {
    const character = this.loadCharacter(characterId);
    if (!character) return { error: '角色不存在' };
    
    const report = {
      characterId,
      characterName: character.name,
      timestamp: new Date().toISOString(),
      dimensions: {},
      overall: {
        completeness: 0,
        strength: '',
        weakness: '',
        suggestions: []
      }
    };
    
    // D1: 身份维度
    report.dimensions.D1_Identity = this._analyzeIdentity(character);
    
    // D2: 外观维度
    report.dimensions.D2_Appearance = this._analyzeAppearance(character);
    
    // D3: 性格维度
    report.dimensions.D3_Personality = this._analyzePersonality(character);
    
    // D4: 关系维度
    report.dimensions.D4_Relationships = this._analyzeRelationships(character);
    
    // D5: 背景维度
    report.dimensions.D5_Backstory = this._analyzeBackstory(character);
    
    // D6: 能力维度
    report.dimensions.D6_Skills = this._analyzeSkills(character);
    
    // D7: 叙事功能维度
    report.dimensions.D7_Narrative = this._analyzeNarrative(character);
    
    // 综合评估
    const scores = Object.values(report.dimensions).map(d => d.score);
    report.overall.completeness = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    const strengths = Object.values(report.dimensions).filter(d => d.score >= 80);
    const weaknesses = Object.values(report.dimensions).filter(d => d.score < 50);
    
    report.overall.strength = strengths.length > 0 
      ? `最强维度：${strengths[0].name}（${strengths[0].score}分）` 
      : '暂无突出维度';
    report.overall.weakness = weaknesses.length > 0
      ? `待完善：${weaknesses[0].name}（${weaknesses[0].score}分）`
      : '各维度基础完善';
    
    // 生成建议
    report.overall.suggestions = this._generateDimensionSuggestions(report.dimensions);
    
    // 更新角色元数据
    character.v2Metadata = character.v2Metadata || {};
    character.v2Metadata.analyzedDimensions = Object.keys(report.dimensions);
    character.v2Metadata.lastDimensionAnalysis = report.timestamp;
    this.saveCharacter(characterId, character);
    
    return report;
  }
  
  // ====== v2新功能：合规集成 ======
  
  /**
   * 检查角色合规性（自动+手动）
   */
  checkCompliance(characterId) {
    const character = this.loadCharacter(characterId);
    if (!character) return { error: '角色不存在' };
    
    const report = this.compliance.scanCharacterCard(character);
    
    // 更新角色元数据
    character.v2Metadata = character.v2Metadata || {};
    character.v2Metadata.lastComplianceCheck = {
      timestamp: new Date().toISOString(),
      passed: report.overallPassed,
      blockingCount: report.blockingViolations?.length || 0,
      warningCount: report.warningViolations?.length || 0
    };
    this.saveCharacter(characterId, character);
    
    return report;
  }
  
  /**
   * 自动清理角色prompt中的违规内容
   */
  sanitizeCharacterPrompts(characterId) {
    const character = this.loadCharacter(characterId);
    if (!character) return { error: '角色不存在' };
    
    const changes = [];
    
    // 清理visualIdentity.style
    if (character.visualIdentity?.style) {
      const result = this.compliance.sanitize(character.visualIdentity.style);
      if (result.changed) {
        changes.push({ field: 'visualIdentity.style', before: character.visualIdentity.style, after: result.prompt });
        character.visualIdentity.style = result.prompt;
      }
    }
    
    // 清理appearance各元素
    if (character.visualIdentity?.appearance) {
      for (const [key, data] of Object.entries(character.visualIdentity.appearance)) {
        if (data.promptFragment) {
          const result = this.compliance.sanitize(data.promptFragment);
          if (result.changed) {
            changes.push({ field: `appearance.${key}.promptFragment`, before: data.promptFragment, after: result.prompt });
            data.promptFragment = result.prompt;
          }
        }
        if (data.description) {
          const result = this.compliance.sanitize(data.description);
          if (result.changed) {
            changes.push({ field: `appearance.${key}.description`, before: data.description, after: result.prompt });
            data.description = result.prompt;
          }
        }
      }
    }
    
    if (changes.length > 0) {
      this.saveCharacter(characterId, character);
    }
    
    return {
      characterId,
      changesMade: changes.length > 0,
      changeCount: changes.length,
      changes
    };
  }
  
  // ====== v2新功能：智能Prompt构建 ======
  
  /**
   * 构建角色渲染Prompt（使用6层结构）
   */
  buildRenderPrompt(characterId, options = {}) {
    const character = this.loadCharacter(characterId);
    if (!character) return { error: '角色不存在' };
    
    // 如果使用年代服装
    if (options.era) {
      const eraResult = this.eraGuide.generateClothingPrompt(
        options.era, 
        options.gender || this._inferGender(character),
        options.eraOptions || {}
      );
      
      if (!eraResult.error) {
        // 临时替换服装描述
        character = JSON.parse(JSON.stringify(character)); // 深拷贝
        character.visualIdentity = character.visualIdentity || {};
        character.visualIdentity.appearance = character.visualIdentity.appearance || {};
        character.visualIdentity.appearance.clothing = {
          description: eraResult.prompt,
          consistency: 'strict',
          promptFragment: eraResult.prompt
        };
      }
    }
    
    const result = this.promptBuilder.build(character, options);
    
    // 自动合规检查
    if (this.config.autoCheckCompliance) {
      const compliance = this.compliance.scan(result.prompt);
      result.compliance = compliance;
      
      if (compliance.level === 'BLOCK') {
        result.warning = '生成的prompt存在L1级违规，已标记拦截';
      }
    }
    
    return result;
  }
  
  /**
   * 生成定妆照Prompt（v2增强版）
   */
  generatePortraitPromptV2(characterId, angle = 'front', options = {}) {
    const character = this.loadCharacter(characterId);
    if (!character) return null;
    
    const basePrompt = this.buildRenderPrompt(characterId, {
      angle,
      sceneType: 'portrait',
      enabledLayers: ['subject', 'clothing', 'accessories', 'expression', 'technical'],
      ...options
    });
    
    if (basePrompt.error) return basePrompt;
    
    // 添加定妆照特定技术参数
    const portraitTechnical = '纯白背景，摄影棚三点布光（主光+补光+轮廓光），极致写实照片级渲染，次世代游戏角色级精度，毛孔级纹理，次表面散射，8K品质，PNG格式';
    
    return {
      ...basePrompt,
      prompt: `${basePrompt.prompt}，${portraitTechnical}`,
      negativePrompt: basePrompt.negativePrompt,
      config: {
        model: 'seedream-5-0',
        size: '2K',
        ...character.portraitConfig
      }
    };
  }
  
  // ====== v2新功能：年代服装 ======
  
  /**
   * 为角色应用年代服装
   */
  applyEraClothing(characterId, eraId, options = {}) {
    const character = this.loadCharacter(characterId);
    if (!character) return { error: '角色不存在' };
    
    const eraResult = this.eraGuide.generateClothingPrompt(
      eraId,
      options.gender || this._inferGender(character),
      options
    );
    
    if (eraResult.error) return eraResult;
    
    // 保存年代服装到角色档案
    character.eraOutfits = character.eraOutfits || {};
    character.eraOutfits[eraId] = {
      appliedAt: new Date().toISOString(),
      prompt: eraResult.prompt,
      details: eraResult.details,
      colors: eraResult.colors,
      materials: eraResult.materials
    };
    
    this.saveCharacter(characterId, character);
    
    return {
      success: true,
      characterId,
      eraId,
      eraName: eraResult.eraName,
      prompt: eraResult.prompt,
      appliedAt: character.eraOutfits[eraId].appliedAt
    };
  }
  
  /**
   * 列出角色可用的年代服装
   */
  listEraOutfits(characterId) {
    const character = this.loadCharacter(characterId);
    if (!character) return { error: '角色不存在' };
    
    const outfits = character.eraOutfits || {};
    return Object.entries(outfits).map(([eraId, data]) => ({
      eraId,
      eraName: this.eraGuide.getEra(eraId)?.name || eraId,
      appliedAt: data.appliedAt,
      preview: data.prompt.substring(0, 50) + '...'
    }));
  }
  
  // ====== v1兼容：原有方法 ======
  
  generateMandatoryPrompt(characterId, angle = 'threeQuarter') {
    const result = this.buildRenderPrompt(characterId, { angle, sceneType: 'interaction' });
    return result.error ? '' : result.prompt;
  }
  
  validatePrompt(characterId, promptText, strictOnly = true) {
    const character = this.loadCharacter(characterId);
    if (!character) return { valid: false, error: '角色不存在' };
    
    const { appearance } = character.visualIdentity || {};
    const missing = [];
    const found = [];
    
    if (appearance) {
      Object.entries(appearance).forEach(([key, data]) => {
        if (strictOnly && data.consistency !== 'strict') return;
        
        const fragment = data.promptFragment || data.description || '';
        const keywords = fragment.split(/[，、]/).filter(Boolean);
        const hasKeyword = keywords.some(kw => promptText.includes(kw.trim()));
        
        if (!hasKeyword) {
          missing.push({ key, fragment });
        } else {
          found.push(key);
        }
      });
    }
    
    return {
      valid: missing.length === 0,
      characterId,
      characterName: character.name,
      found,
      missing,
      foundCount: found.length,
      totalCount: Object.keys(appearance || {}).length
    };
  }
  
  getReferenceImages(characterId, preferredAngles = ['front', 'threeQuarter']) {
    const character = this.loadCharacter(characterId);
    if (!character) return [];
    
    const portraits = character.generatedAssets?.portraits || [];
    const workspaceDir = path.resolve(CHARACTERS_DIR, '..');
    
    const paths = [];
    for (const angle of preferredAngles) {
      const found = portraits.filter(p => p.angle === angle && p.localPath);
      for (const p of found) {
        const fullPath = path.join(workspaceDir, p.localPath);
        if (fss.existsSync(fullPath)) paths.push(fullPath);
      }
    }
    
    return paths;
  }
  
  listCharacters() {
    if (!fss.existsSync(CHARACTERS_DIR)) return [];
    
    return fss.readdirSync(CHARACTERS_DIR)
      .filter(dir => fss.statSync(path.join(CHARACTERS_DIR, dir)).isDirectory())
      .map(dir => {
        const card = this.loadCharacter(dir);
        return card ? {
          id: card.id,
          name: card.name,
          type: card.type,
          appearances: card.appearances || [],
          portraitCount: card.generatedAssets?.portraits?.length || 0,
          version: card.version,
          v2Enabled: !!card.v2Metadata
        } : null;
      })
      .filter(Boolean);
  }
  
  recordAppearance(characterId, storyId) {
    const character = this.loadCharacter(characterId);
    if (!character) return;
    
    if (!character.appearances.includes(storyId)) {
      character.appearances.push(storyId);
      this.saveCharacter(characterId, character);
    }
  }
  
  // ====== 7维分析内部方法 ======
  
  _analyzeIdentity(character) {
    const hasName = !!character.name;
    const hasAge = !!(character.visualIdentity?.age || character.age);
    const hasOrigin = !!(character.visualIdentity?.origin || character.origin);
    const hasSpecies = !!(character.visualIdentity?.species || character.species);
    const hasType = !!character.type;
    
    const score = [hasName, hasAge, hasOrigin, hasSpecies, hasType].filter(Boolean).length * 20;
    
    return {
      name: '身份维度',
      score: Math.min(score, 100),
      fields: { hasName, hasAge, hasOrigin, hasSpecies, hasType },
      suggestion: !hasAge ? '建议添加年龄信息' : !hasOrigin ? '建议添加起源地信息' : null
    };
  }
  
  _analyzeAppearance(character) {
    const vi = character.visualIdentity || {};
    const appearance = vi.appearance || {};
    const angles = vi.angles || {};
    const hasStyle = !!vi.style;
    const hasPortraitConfig = !!character.portraitConfig;
    
    const featureCount = Object.keys(appearance).length;
    const angleCount = Object.keys(angles).length;
    const strictCount = Object.values(appearance).filter(d => d.consistency === 'strict').length;
    
    let score = 0;
    score += Math.min(featureCount * 10, 40); // 最多40分
    score += Math.min(angleCount * 10, 30); // 最多30分
    score += hasStyle ? 10 : 0;
    score += hasPortraitConfig ? 10 : 0;
    score += strictCount >= 3 ? 10 : (strictCount > 0 ? 5 : 0);
    
    return {
      name: '外观维度',
      score: Math.min(score, 100),
      fields: { featureCount, angleCount, hasStyle, hasPortraitConfig, strictCount },
      suggestion: featureCount < 4 ? '建议补充更多外观特征（建议≥5项）' : angleCount < 2 ? '建议添加多角度描述' : null
    };
  }
  
  _analyzePersonality(character) {
    const p = character.personality || {};
    const hasCore = !!p.core;
    const hasTraits = Array.isArray(p.traits) && p.traits.length > 0;
    const hasArchetype = !!p.archetype;
    const hasMBTI = !!p.MBTI;
    const hasGrowth = !!p.growthArc;
    
    const traitCount = p.traits?.length || 0;
    
    let score = 0;
    score += hasCore ? 25 : 0;
    score += hasTraits ? Math.min(traitCount * 5, 25) : 0;
    score += hasArchetype ? 15 : 0;
    score += hasMBTI ? 10 : 0;
    score += hasGrowth ? 25 : 0;
    
    return {
      name: '性格维度',
      score: Math.min(score, 100),
      fields: { hasCore, hasTraits, traitCount, hasArchetype, hasMBTI, hasGrowth },
      suggestion: !hasCore ? '建议添加核心性格描述' : !hasGrowth ? '建议添加成长弧线' : null
    };
  }
  
  _analyzeRelationships(character) {
    const r = character.relationships || {};
    const keys = Object.keys(r);
    const hasRelationships = keys.length > 0;
    const detailedCount = keys.filter(k => r[k].bond || r[k].status).length;
    
    let score = 0;
    score += hasRelationships ? 30 : 0;
    score += Math.min(keys.length * 10, 40);
    score += Math.min(detailedCount * 5, 30);
    
    return {
      name: '关系维度',
      score: Math.min(score, 100),
      fields: { hasRelationships, relationshipCount: keys.length, detailedCount },
      suggestion: !hasRelationships ? '建议添加至少1-2个关键关系' : keys.length < 2 ? '建议丰富人际网络' : null
    };
  }
  
  _analyzeBackstory(character) {
    const b = character.backstory || {};
    const hasOrigin = !!b.origin;
    const hasTrigger = !!b.trigger;
    const hasJourney = !!b.journey;
    const hasConflict = !!b.conflict;
    const hasGrowth = !!b.growth;
    
    const score = [hasOrigin, hasTrigger, hasJourney, hasConflict, hasGrowth].filter(Boolean).length * 20;
    
    return {
      name: '背景维度',
      score: Math.min(score, 100),
      fields: { hasOrigin, hasTrigger, hasJourney, hasConflict, hasGrowth },
      suggestion: !hasOrigin ? '建议添加起源背景' : !hasConflict ? '建议添加核心冲突' : null
    };
  }
  
  _analyzeSkills(character) {
    const s = character.skills || {};
    const keys = Object.keys(s);
    const hasSkills = keys.length > 0;
    const expertCount = keys.filter(k => s[k].level === 'expert').length;
    const advancedCount = keys.filter(k => s[k].level === 'advanced').length;
    
    let score = 0;
    score += hasSkills ? 20 : 0;
    score += Math.min(keys.length * 10, 40);
    score += expertCount * 10;
    score += advancedCount * 5;
    
    return {
      name: '能力维度',
      score: Math.min(score, 100),
      fields: { hasSkills, skillCount: keys.length, expertCount, advancedCount },
      suggestion: !hasSkills ? '建议添加技能树' : keys.length < 2 ? '建议丰富技能体系（建议≥3项）' : null
    };
  }
  
  _analyzeNarrative(character) {
    const r = character.roleInStory || {};
    const hasFunction = !!r.function;
    const hasArchetypal = !!r.archetypalRole;
    const hasArc = !!r.characterArc;
    const hasFirstAppearance = !!character.firstAppearance;
    const hasUniverses = Array.isArray(character.universes) && character.universes.length > 0;
    
    const score = [hasFunction, hasArchetypal, hasArc, hasFirstAppearance, hasUniverses].filter(Boolean).length * 20;
    
    return {
      name: '叙事功能维度',
      score: Math.min(score, 100),
      fields: { hasFunction, hasArchetypal, hasArc, hasFirstAppearance, hasUniverses },
      suggestion: !hasFunction ? '建议添加角色叙事功能' : !hasArc ? '建议添加角色弧线' : null
    };
  }
  
  _generateDimensionSuggestions(dimensions) {
    const suggestions = [];
    for (const [key, dim] of Object.entries(dimensions)) {
      if (dim.suggestion) {
        suggestions.push(`${dim.name}：${dim.suggestion}`);
      }
    }
    return suggestions;
  }
  
  _inferGender(character) {
    // 简单推断：根据外观描述中的关键词
    const text = JSON.stringify(character);
    if (/女孩|女人|女性| heroine | princess /i.test(text)) return 'female';
    if (/男孩|男人|男性| hero | prince /i.test(text)) return 'male';
    return 'female'; // 默认
  }

  // ====== v2.1升级：成长痕迹系统API（山海经系列） ======

  /**
   * 为当前集创建角色成长轨迹
   * @param {string} episodeId - 集数ID
   * @param {Object} initialState - 初始状态
   * @returns {Object} 轨迹对象
   */
  createGrowthTrace(episodeId, initialState = {}) {
    return this.growthTrace.createTrace(episodeId, {
      protagonistId: this.config.protagonistId || 'xiaoG',
      ...initialState
    });
  }

  /**
   * 从故事板自动提取成长转变
   * @param {string} episodeId - 集数ID
   * @param {Object} storyboard - 故事板对象
   */
  extractGrowthFromStoryboard(episodeId, storyboard) {
    return this.growthTrace.extractFromStoryboard(episodeId, storyboard);
  }

  /**
   * 设置集数最终成长状态
   * @param {string} episodeId - 集数ID
   * @param {Object} finalState - 最终状态
   */
  setGrowthFinalState(episodeId, finalState) {
    return this.growthTrace.setFinalState(episodeId, finalState);
  }

  /**
   * 从故事板自动推断最终状态
   * @param {string} episodeId - 集数ID
   * @param {Object} storyboard - 故事板对象
   */
  inferGrowthFinalState(episodeId, storyboard) {
    return this.growthTrace.inferFinalState(episodeId, storyboard);
  }

  /**
   * 设置跨集连续性
   * @param {string} currentEpisode - 当前集
   * @param {string} nextEpisode - 下集
   */
  setGrowthContinuity(currentEpisode, nextEpisode) {
    return this.growthTrace.setContinuity(currentEpisode, nextEpisode);
  }

  /**
   * 验证跨集连续性
   * @param {string} prevEpisode - 上集
   * @param {string} currentEpisode - 当前集
   */
  validateGrowthContinuity(prevEpisode, currentEpisode) {
    return this.growthTrace.validateContinuity(prevEpisode, currentEpisode);
  }

  /**
   * 生成角色成长弧光报告
   * @param {string} episodeId - 集数ID
   */
  generateGrowthArcReport(episodeId) {
    return this.growthTrace.generateArcReport(episodeId);
  }

  /**
   * 获取角色跨集成长档案
   * @param {string} characterId - 角色ID（默认小G）
   */
  getCharacterGrowthProfile(characterId) {
    return this.growthTrace.getCharacterGrowthProfile(characterId || this.config.protagonistId || 'xiaoG');
  }

  /**
   * 保存成长轨迹到文件
   * @param {string} episodeId - 集数ID
   * @param {string} filepath - 文件路径
   */
  saveGrowthTrace(episodeId, filepath) {
    return this.growthTrace.saveTrace(episodeId, filepath);
  }

  /**
   * 加载成长轨迹
   * @param {string} filepath - 文件路径
   */
  loadGrowthTrace(filepath) {
    return this.growthTrace.loadTrace(filepath);
  }

  /**
   * v6.5.62-P1: 构建极简锚点（character字段）
   * 格式：角色名: 种族, 3-5核心视觉关键词
   */
  _buildMinimalAnchor(characterData) {
    const charName = characterData.name || characterData.id || '未知角色';
    const race = characterData.race || characterData.species || 'Nirath异兽';
    
    // 提取3-5个核心视觉关键词
    const keywords = [];
    if (characterData.signatureFeatures) {
      keywords.push(...characterData.signatureFeatures.slice(0, 3));
    }
    if (characterData.coreVisualTraits) {
      keywords.push(...characterData.coreVisualTraits.slice(0, 2));
    }
    if (characterData.appearance) {
      const appearanceKeywords = characterData.appearance.split(/[,，]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      keywords.push(...appearanceKeywords.slice(0, 2));
    }
    
    // 去重并限制3-5个
    const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
    if (uniqueKeywords.length < 3) {
      uniqueKeywords.push('Nirath原生特征', '双恒星光照反射');
    }
    
    return `${charName}: ${race}, ${uniqueKeywords.join(', ')}`;
  }
  
  /**
   * v6.5.62-P1: 构建定妆照路径（characterRef字段）
   * 格式：image://bestiary/角色名-角度.png
   */
  _buildPortraitPaths(characterId, characterData) {
    const paths = [];
    const angles = ['front', 'threeQuarter', 'closeup', 'side', 'back', 'action', 'detail'];
    
    for (const angle of angles) {
      paths.push(`image://bestiary/${characterId}-${angle}.png`);
    }
    
    return paths.slice(0, 9); // 限制最多9张
  }
}

module.exports = { CharacterManagerV2 };
