/**
 * Bestiary v24.0 — Beast Domain Model 迁移层
 * 
 * 迁移策略：
 * 1. 内部使用新的 BeastRepository（统一数据模型）
 * 2. 保持旧接口 100% 兼容（getCreature, getBeast, listCreatures, searchByLocation）
 * 3. 旧别名自动映射到新 canonical ID
 * 4. 新增数据（visualSignature, promptTemplate, lore）透传到底层
 * 
 * ID映射：
 *   旧别名            新 canonical ID
 *   zhuLong  → taisu → zhulong
 *   nuanNuan → warm  → dijiang  
 *   xuanGui  → map  → xuangui
 *   baiZe    → teacher → baize
 *   jiuWeiHu → granny → jiuweihu
 *   taotie   → taotie → taotie
 */

'use strict';

const { getBeastRepository } = require('../systems/domain/beast-domain-model.js');

// 旧ID → 新canonical ID 映射（兼容历史别名）
const LEGACY_ID_MAP = {
  // 旧最佳实践别名
  'zhuLong': 'zhulong',
  'nuanNuan': 'dijiang',
  'xuanGui': 'xuangui',
  'baiZe': 'baize',
  'jiuWeiHu': 'jiuweihu',
  // 旧内部ID
  'taisu': 'zhulong',
  'warm': 'dijiang',
  'map': 'xuangui',
  'teacher': 'baize',
  'granny': 'jiuweihu',
  // 直接canonical ID（无需映射）
  'taotie': 'taotie',
  'zhulong': 'zhulong',
  'dijiang': 'dijiang',
  'xuangui': 'xuangui',
  'baize': 'baize',
  'jiuweihu': 'jiuweihu'
};

// 旧数据字段 → 新数据字段 适配器
class BeastAdapter {
  constructor(beastData) {
    this.data = beastData;
  }

  // 兼容旧格式：返回扁平化的旧风格对象
  toLegacyFormat() {
    if (!this.data) return null;

    const b = this.data;
    return {
      // 基础信息
      id: b.id,
      name: b.canonicalName?.chinese || b.id,
      englishName: b.canonicalName?.english || b.id,
      pinyin: b.canonicalName?.pinyin || b.id,
      
      // 分类与来源
      category: b.category || 'unknown',
      source: b.source || '',
      shanhaijingOriginal: b.shanhaijingOriginal || '',
      nirathCore: b.nirathCore || '',
      
      // 描述
      description: b.description || '',
      
      // 外观（旧格式扁平化）
      appearance: this.flattenAppearance(b.appearance),
      
      // 新增：视觉签名（Prompt注入用）
      visualSignature: b.visualSignature?.description || '',
      visualKeyFeatures: b.visualSignature?.keyFeatures || [],
      colorPalette: b.visualSignature?.colorPalette || [],
      
      // 新增：Prompt模板
      promptTemplate: b.promptTemplate || '',
      negativePrompt: b.negativePrompt || '',
      
      // 新增：Lore
      lore: b.lore?.summary || '',
      abilities: b.lore?.abilities || [],
      temperament: b.lore?.temperament || 'neutral',
      
      // 栖息地
      habitat: this.flattenHabitat(b.habitat),
      
      // 版本
      version: b.version || '1.0.0',
      approved: b.approved || false
    };
  }

  flattenAppearance(appearance) {
    if (!appearance) return {};
    return {
      body: appearance.body || '',
      head: appearance.head || '',
      face: appearance.face || '',
      legs: appearance.legs || '',
      wings: appearance.wings || '',
      tail: appearance.tail || '',
      eyes: appearance.eyes || '',
      mane: appearance.mane || '',
      special: appearance.special || '',
      colors: appearance.colors || ''
    };
  }

  flattenHabitat(habitat) {
    if (!habitat) return {};
    return {
      primary: habitat.primary || '',
      secondary: Array.isArray(habitat.secondary) ? habitat.secondary : []
    };
  }
}

class Bestiary {
  constructor() {
    this.repo = getBeastRepository();
    this._migrationLog = [];
    
    // 验证所有旧ID都能映射
    this._verifyMapping();
  }

  _verifyMapping() {
    const missing = [];
    for (const [legacyId, canonicalId] of Object.entries(LEGACY_ID_MAP)) {
      const beast = this.repo.findById(canonicalId);
      if (!beast) {
        missing.push(`${legacyId} → ${canonicalId}`);
      }
    }
    
    if (missing.length > 0) {
      console.warn(`[Bestiary v24] 警告: ${missing.length} 个旧ID映射缺失:`, missing.slice(0, 5));
    } else {
      console.log(`[Bestiary v24] 所有 ${Object.keys(LEGACY_ID_MAP).length} 个旧ID映射已验证`);
    }
  }

  /**
   * 核心查找方法（兼容旧接口）
   * @param {string} id - 旧ID、别名、拼音、中文名
   */
  getCreature(id) {
    // 1. 尝试直接canonical ID查找
    let beast = this.repo.findById(id);
    
    // 2. 尝试旧ID映射
    if (!beast && LEGACY_ID_MAP[id]) {
      beast = this.repo.findById(LEGACY_ID_MAP[id]);
      this._logMigration(id, LEGACY_ID_MAP[id], 'legacy_map');
    }
    
    // 3. 尝试模糊查找（新Repository支持别名、中文名等）
    if (!beast) {
      beast = this.repo.findByName(id);
      if (beast) {
        this._logMigration(id, beast.id, 'fuzzy_search');
      }
    }
    
    // 4. fallback到default
    if (!beast) {
      console.warn(`[Bestiary v24] 未找到神兽: ${id}，返回默认`);
      return this._createDefault(id);
    }
    
    // 转换为旧格式
    return new BeastAdapter(beast).toLegacyFormat();
  }

  getBeast(id) {
    return this.getCreature(id);
  }

  listCreatures() {
    return this.repo.listIds();
  }

  searchByLocation(location) {
    // 新Repository支持分类查找，但location索引尚未实现
    // 返回所有已注册神兽
    return this.listCreatures();
  }

  /**
   * 新增：获取视觉签名Prompt（供渲染模块使用）
   * 这是迁移的关键收益：统一视觉描述入口
   */
  getVisualSignaturePrompt(id) {
    const canonicalId = LEGACY_ID_MAP[id] || id;
    return this.repo.getVisualSignaturePrompt(canonicalId);
  }

  /**
   * 新增：获取Prompt模板（带场景占位符替换）
   */
  getPromptTemplate(id, scene = '') {
    const canonicalId = LEGACY_ID_MAP[id] || id;
    return this.repo.getPromptTemplate(canonicalId, scene);
  }

  /**
   * 新增：获取负面提示词
   */
  getNegativePrompt(id) {
    const canonicalId = LEGACY_ID_MAP[id] || id;
    return this.repo.getNegativePrompt(canonicalId);
  }

  /**
   * 新增：搜索神兽
   */
  search(query) {
    const results = this.repo.search(query);
    return results.map(r => ({
      ...new BeastAdapter(r.beast).toLegacyFormat(),
      score: r.score
    }));
  }

  /**
   * 获取迁移日志（用于审计）
   */
  getMigrationLog() {
    return this._migrationLog;
  }

  _logMigration(fromId, toId, method) {
    this._migrationLog.push({
      from: fromId,
      to: toId,
      method,
      time: Date.now()
    });
  }

  _createDefault(id) {
    return {
      id: id || 'default',
      name: id || '未知神兽',
      englishName: id || 'unknown',
      category: 'unknown',
      description: '默认神兽数据（迁移中）',
      visualSignature: '',
      promptTemplate: '',
      negativePrompt: '',
      appearance: {},
      habitat: {},
      version: '1.0.0-default',
      approved: false
    };
  }
}

module.exports = { Bestiary, LEGACY_ID_MAP };
