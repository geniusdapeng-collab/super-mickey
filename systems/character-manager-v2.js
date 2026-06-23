const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const { CharacterComplianceChecker } = require('./character-compliance-checker.js');
const { CharacterPromptBuilder } = require('./character-prompt-builder.js');
const { CharacterEraGuide } = require('./character-era-guide.js');
const { GrowthTraceSystem } = require('./growth-trace-system.js');

const CHARACTERS_DIR = path.join(__dirname, '..', 'characters');

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
class CharacterManager {
  constructor(config = {}) {
    this.config = { ...config };
    this.compliance = new CharacterComplianceChecker(config);
    this.promptBuilder = new CharacterPromptBuilder(config);
    this.eraGuide = new CharacterEraGuide(config);
    this.growthTrace = new GrowthTraceSystem(config);
    
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fss.existsSync(CHARACTERS_DIR)) {
      fss.mkdirSync(CHARACTERS_DIR, { recursive: true });
    }
  }

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
      // 【v2.1.4-fix10-P25-fix5】fs 已是 promises，不要 .promises
      const data = await fs.readFile(cardPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      // 【v2.1.4-fix10-P25-fix5】不要静默吞错，至少打印日志
      console.warn(`[CharacterManager] 加载角色失败 ${characterId}: ${e.message}`);
      return null;
    }
  }
  
  async saveCharacter(characterId, characterCard) {
    // 【v2.1.4-fix10-P25-fix5】类型保护，防止把 Promise/非对象写入磁盘
    if (!characterCard || typeof characterCard !== 'object' || Array.isArray(characterCard)) {
      console.error(`[CharacterManager] 拒绝保存非对象数据到 ${characterId}`);
      return;
    }
    characterCard.updatedAt = new Date().toISOString();
    characterCard.version = characterCard.version || '2.0';
    const cardPath = this.getCharacterCardPath(characterId);
    await fs.writeFile(cardPath, JSON.stringify(characterCard, null, 2));
  }

  // v6.6.5-fix: 标准化角色数据，统一提取 outfit 等字段
  _normalizeCharacterData(characterId, characterData = {}) {
    const baseIdentity = characterData.baseIdentity || {};
    const visual = characterData.visual || {};
    const visualIdentity = characterData.visualIdentity || {};

    const mergedVisualIdentity = {
      age: visualIdentity.age ?? visual.age ?? characterData.age ?? baseIdentity.age ?? null,
      gender: visualIdentity.gender ?? visual.gender ?? characterData.gender ?? baseIdentity.gender ?? 'unknown',
      build: visualIdentity.build ?? visual.build ?? characterData.build ?? '',
      height: visualIdentity.height ?? visual.height ?? characterData.height ?? '',
      skinTone: visualIdentity.skinTone ?? visual.skinTone ?? characterData.skinTone ?? '',
      hair: visualIdentity.hair ?? visual.hair ?? characterData.hair ?? '',
      eyes: visualIdentity.eyes ?? visual.eyes ?? characterData.eyes ?? '',
      facialFeatures: visualIdentity.facialFeatures ?? visual.facialFeatures ?? characterData.facialFeatures ?? '',
      distinguishingMarks: visualIdentity.distinguishingMarks ?? visual.distinguishingMarks ?? characterData.distinguishingMarks ?? '',
      outfit: visualIdentity.outfit ?? visual.outfit ?? characterData.outfit ?? '',
      appearance: {
        ...(visualIdentity.appearance || {})
      }
    };

    if (mergedVisualIdentity.outfit && !mergedVisualIdentity.appearance.clothing) {
      mergedVisualIdentity.appearance.clothing = {
        promptFragment: mergedVisualIdentity.outfit,
        consistency: 'strict'
      };
    }

    return {
      ...characterData,
      id: characterId,
      name: characterData.name || baseIdentity.name || characterId,
      baseIdentity: {
        name: baseIdentity.name || characterData.name || characterId,
        age: baseIdentity.age ?? characterData.age ?? visual.age ?? visualIdentity.age ?? null,
        gender: baseIdentity.gender || characterData.gender || visual.gender || visualIdentity.gender || 'unknown',
        species: baseIdentity.species || characterData.species || characterData.race || 'human',
        role: baseIdentity.role || characterData.role || characterData.occupation || '',
        origin: baseIdentity.origin || characterData.origin || 'Earth'
      },
      visualIdentity: mergedVisualIdentity
    };
  }

  mergeRuntimeCharacterData(characterCard = {}, runtimeData = {}) {
    const normalizedRuntime = this._normalizeCharacterData(characterCard.id || runtimeData.id || 'unknown', runtimeData);

    const merged = {
      ...characterCard,
      ...normalizedRuntime,
      baseIdentity: {
        ...(characterCard.baseIdentity || {}),
        ...(normalizedRuntime.baseIdentity || {})
      },
      visualIdentity: {
        ...(characterCard.visualIdentity || {}),
        ...(normalizedRuntime.visualIdentity || {}),
        appearance: {
          ...((characterCard.visualIdentity || {}).appearance || {}),
          ...((normalizedRuntime.visualIdentity || {}).appearance || {})
        }
      }
    };

    merged.v2Metadata = {
      ...(characterCard.v2Metadata || {}),
      minimalAnchor: this._buildMinimalAnchor(merged),
      portraitPaths: this._buildPortraitPaths(merged.id, merged)
    };

    return merged;
  }

  createCharacter(characterId, characterData) {
    const characterDir = this.getCharacterDir(characterId);
    if (!fss.existsSync(characterDir)) {
      fss.mkdirSync(characterDir, { recursive: true });
    }

    const characterCard = {
      ...characterData,
      id: characterId,
      createdAt: new Date().toISOString(),
      version: '2.0'
    };

    const cardPath = this.getCharacterCardPath(characterId);
    fss.writeFileSync(cardPath, JSON.stringify(characterCard, null, 2));

    return characterCard;
  }

  updateCharacter(characterId, updates) {
    const cardPath = this.getCharacterCardPath(characterId);
    if (!fss.existsSync(cardPath)) {
      return { error: '角色不存在' };
    }

    const current = JSON.parse(fss.readFileSync(cardPath, 'utf8'));
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    fss.writeFileSync(cardPath, JSON.stringify(updated, null, 2));

    return updated;
  }

  deleteCharacter(characterId) {
    const characterDir = this.getCharacterDir(characterId);
    if (fss.existsSync(characterDir)) {
      fss.rmSync(characterDir, { recursive: true, force: true });
      return { success: true };
    }
    return { error: '角色不存在' };
  }

  listCharacters() {
    if (!fss.existsSync(CHARACTERS_DIR)) return [];
    return fss.readdirSync(CHARACTERS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }

  // ====== v2新功能：7维分析 ======

  /**
   * 7维角色分析
   * @param {string} characterId - 角色ID
   * @returns {Object} 7维分析报告
   */
  async analyzeDimensions(characterId) {
    const character = await this.loadCharacter(characterId);
    if (!character || typeof character !== 'object' || Array.isArray(character)) {
      return { error: '角色不存在或数据损坏' };
    }
    
    const report = {
      characterId,
      characterName: character.name,
      timestamp: new Date().toISOString(),
      dimensions: {},
      overall: {
        completeness: 0,
        consistency: 0,
        quality: 0
      }
    };

    // D1: 身份维度
    report.dimensions.identity = this._analyzeIdentity(character);
    // D2: 外观维度
    report.dimensions.appearance = this._analyzeAppearance(character);
    // D3: 性格维度
    report.dimensions.personality = this._analyzePersonality(character);
    // D4: 关系维度
    report.dimensions.relationships = this._analyzeRelationships(character);
    // D5: 背景维度
    report.dimensions.background = this._analyzeBackground(character);
    // D6: 能力维度
    report.dimensions.abilities = this._analyzeAbilities(character);
    // D7: 叙事功能维度
    report.dimensions.narrative = this._analyzeNarrative(character);

    // 综合评分
    const dimensionScores = Object.values(report.dimensions).map(d => d.score || 0);
    report.overall.completeness = Math.round(dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length);
    report.overall.consistency = this._checkConsistency(character);
    report.overall.quality = Math.round((report.overall.completeness + report.overall.consistency) / 2);

    // 保存分析结果
    if (character && typeof character === 'object' && !Array.isArray(character)) {
      await this.saveCharacter(characterId, character);
    }
    return report;
  }

  // ====== v2新功能：合规检查 ======

  /**
   * 检查角色合规性
   * @param {string} characterId - 角色ID
   * @returns {Object} 合规报告
   */
  async checkCompliance(characterId) {
    const character = await this.loadCharacter(characterId);
    if (!character || typeof character !== 'object' || Array.isArray(character)) {
      return { error: '角色不存在或数据损坏' };
    }

    const characterPrompt = this.promptBuilder.build(character);
    const compliance = this.compliance.scan(characterPrompt.prompt);
    
    const report = {
      characterId,
      characterName: character.name,
      timestamp: new Date().toISOString(),
      compliance,
      violations: compliance.violations || [],
      recommendations: compliance.recommendations || []
    };

    if (character && typeof character === 'object' && !Array.isArray(character)) {
      await this.saveCharacter(characterId, character);
    }
    return report;
  }

  // ====== v2新功能：提示词清理 ======

  /**
   * 清理角色提示词
   * @param {string} characterId - 角色ID
   * @returns {Object} 清理报告
   */
  async sanitizeCharacterPrompts(characterId) {
    const character = await this.loadCharacter(characterId);
    if (!character || typeof character !== 'object' || Array.isArray(character)) {
      return { error: '角色不存在或数据损坏' };
    }

    const changes = [];
    
    // 清理视觉风格提示词
    if (character.visualIdentity?.style) {
      const result = this.promptBuilder.sanitizeStyle(character.visualIdentity.style);
      if (result.changed) {
        character.visualIdentity.style = result.text;
        changes.push({ field: 'visualIdentity.style', reason: result.reason });
      }
    }
    
    // 清理外观描述
    if (character.visualIdentity?.appearance) {
      for (const [key, data] of Object.entries(character.visualIdentity.appearance)) {
        if (data.promptFragment) {
          const result = this.promptBuilder.sanitizeFragment(data.promptFragment);
          if (result.changed) {
            data.promptFragment = result.text;
            changes.push({ field: `appearance.${key}`, reason: result.reason });
          }
        }
        if (data.description) {
          const result = this.promptBuilder.sanitizeDescription(data.description);
          if (result.changed) {
            data.description = result.text;
            changes.push({ field: `description.${key}`, reason: result.reason });
          }
        }
      }
    }
    
    if (changes.length > 0) {
      await this.saveCharacter(characterId, character);
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
  async buildRenderPrompt(characterId, options = {}) {
    const character = await this.loadCharacter(characterId);
    if (!character || typeof character !== 'object' || Array.isArray(character)) {
      return { error: '角色不存在或数据损坏' };
    }
    
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
  async generatePortraitPromptV2(characterId, angle = 'front', options = {}) {
    const character = await this.loadCharacter(characterId);
    if (!character || typeof character !== 'object' || Array.isArray(character)) {
      return null;
    }
    
    const basePrompt = await this.buildRenderPrompt(characterId, {
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
  async applyEraClothing(characterId, eraId, options = {}) {
    const character = await this.loadCharacter(characterId);
    if (!character || typeof character !== 'object' || Array.isArray(character)) {
      return { error: '角色不存在或数据损坏' };
    }
    
    const eraResult = this.eraGuide.generateClothingPrompt(
      eraId,
      options.gender || this._inferGender(character),
      options
    );
    
    if (eraResult.error) return eraResult;
    
    character.visualIdentity = character.visualIdentity || {};
    character.visualIdentity.appearance = character.visualIdentity.appearance || {};
    character.visualIdentity.appearance.clothing = {
      description: eraResult.prompt,
      consistency: 'strict',
      promptFragment: eraResult.prompt
    };
    
    await this.saveCharacter(characterId, character);
    return { success: true, character };
  }

  // ====== 角色管理与档案 ======

  getCharacterArchive(characterId) {
    const characterDir = this.getCharacterDir(characterId);
    if (!fss.existsSync(characterDir)) {
      return { error: '角色不存在' };
    }
    
    const archive = {
      characterId,
      card: null,
      portraits: [],
      generations: [],
      logs: []
    };
    
    // 读取角色卡
    const cardPath = path.join(characterDir, 'character-card.json');
    if (fss.existsSync(cardPath)) {
      archive.card = JSON.parse(fss.readFileSync(cardPath, 'utf8'));
    }
    
    // 读取定妆照
    const portraitDir = path.join(characterDir, 'portraits');
    if (fss.existsSync(portraitDir)) {
      archive.portraits = fss.readdirSync(portraitDir)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
        .map(f => path.join(portraitDir, f));
    }
    
    return archive;
  }

  // ====== 辅助方法 ======

  _inferGender(character) {
    return character.visualIdentity?.gender || 'unknown';
  }

  _buildMinimalAnchor(character) {
    return {
      name: character.name,
      coreTraits: (character.visualIdentity?.coreTraits || []).slice(0, 3),
      outfitSignature: character.visualIdentity?.appearance?.clothing?.promptFragment || '',
      facialSignature: character.visualIdentity?.facialFeatures || ''
    };
  }

  _buildPortraitPaths(characterId, character) {
    const portraitDir = this.getPortraitDir(characterId);
    return {
      front: path.join(portraitDir, 'portrait-front.png'),
      side: path.join(portraitDir, 'portrait-side.png'),
      back: path.join(portraitDir, 'portrait-back.png')
    };
  }

  _analyzeIdentity(character) {
    const identity = character.baseIdentity || {};
    const fields = ['name', 'age', 'gender', 'species', 'role', 'origin'];
    const present = fields.filter(f => identity[f]).length;
    return {
      score: Math.round((present / fields.length) * 100),
      fields: present,
      total: fields.length,
      details: identity
    };
  }

  _analyzeAppearance(character) {
    const visual = character.visualIdentity || {};
    const fields = ['build', 'height', 'skinTone', 'hair', 'eyes', 'facialFeatures', 'distinguishingMarks'];
    const present = fields.filter(f => visual[f]).length;
    return {
      score: Math.round((present / fields.length) * 100),
      fields: present,
      total: fields.length,
      details: visual
    };
  }

  _analyzePersonality(character) {
    const personality = character.personality || {};
    const fields = ['mbti', 'coreTraits', 'motivation', 'fears', 'growthArc'];
    const present = fields.filter(f => personality[f]).length;
    return {
      score: Math.round((present / fields.length) * 100),
      fields: present,
      total: fields.length,
      details: personality
    };
  }

  _analyzeRelationships(character) {
    const relationships = character.relationships || [];
    return {
      score: Math.min(100, relationships.length * 20),
      count: relationships.length,
      details: relationships
    };
  }

  _analyzeBackground(character) {
    const background = character.background || {};
    const fields = ['originStory', 'triggerEvent', 'centralConflict', 'worldSetting'];
    const present = fields.filter(f => background[f]).length;
    return {
      score: Math.round((present / fields.length) * 100),
      fields: present,
      total: fields.length,
      details: background
    };
  }

  _analyzeAbilities(character) {
    const abilities = character.abilities || [];
    return {
      score: Math.min(100, abilities.length * 25),
      count: abilities.length,
      details: abilities
    };
  }

  _analyzeNarrative(character) {
    const narrative = character.narrative || {};
    const fields = ['role', 'function', 'arc', 'transformation'];
    const present = fields.filter(f => narrative[f]).length;
    return {
      score: Math.round((present / fields.length) * 100),
      fields: present,
      total: fields.length,
      details: narrative
    };
  }

  _checkConsistency(character) {
    let score = 100;
    const issues = [];
    
    if (character.baseIdentity?.age && character.visualIdentity?.age) {
      if (character.baseIdentity.age !== character.visualIdentity.age) {
        score -= 10;
        issues.push('基础年龄与视觉年龄不一致');
      }
    }
    
    if (character.baseIdentity?.gender && character.visualIdentity?.gender) {
      if (character.baseIdentity.gender !== character.visualIdentity.gender) {
        score -= 10;
        issues.push('基础性别与视觉性别不一致');
      }
    }
    
    return Math.max(0, score);
  }
}

module.exports = { CharacterManager };
