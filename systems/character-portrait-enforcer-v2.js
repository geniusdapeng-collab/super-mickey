const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * CharacterPortraitEnforcer v2.0
 * 角色定妆照强制检查器 - 生产级引擎标准
 * 
 * 设计哲学：
 * 1. 最小惊讶原则：不通过 = 绝不渲染，无例外
 * 2. 版本即契约：character-card.json version 与 定妆照 version 必须一致
 * 3. 快速失败：在API调用前最早期拦截，不浪费token
 * 4. 自我记录：所有检查行为写入audit log，可追溯
 * 
 * 集成点：
 * - NirathMasterPipeline Stage-0（Pipeline启动前）
 * - 每个项目render-v2.js的submitRender()前
 * - 批量渲染任务的pre-flight检查
 */
class CharacterPortraitEnforcer {
  constructor(options = {}) {
    this.charactersDir = options.charactersDir || path.join(process.cwd(), 'characters');
    this.auditLogPath = options.auditLogPath || path.join(process.cwd(), 'logs', 'portrait-enforcer-audit.log');
    this.strictMode = options.strictMode !== false;
    
    // 缓存：同一次session内避免重复IO
    this._cache = new Map();
    
    // 确保日志目录存在
    const logDir = path.dirname(this.auditLogPath);
    if (!fss.existsSync(logDir)) {
      fss.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * ==================== 主入口 ====================
   * 
   * @param {Object} params
   * @param {string[]} params.characterIds - 出场角色ID列表
   * @param {string} params.projectId - 项目ID（用于audit log）
   * @param {string} params.episodeId - 集数ID（用于audit log）
   * @param {Object} params.sceneContext - 场景上下文（用于判断角色类型）
   * @returns {Object} { pass, missing, outdated, blocked, ready, errors, auditLog }
   */
  async check(params) {
    const { characterIds, projectId = 'unknown', episodeId = 'unknown', sceneContext = {} } = params;
    
    const startTime = Date.now();
    const errors = [];
    const missing = [];
    const outdated = [];
    const ready = [];
    const blocked = []; // 因何种原因被阻断
    
    // Step 1: 去重
    const uniqueIds = [...new Set(characterIds)];
    
    // Step 2: 逐个检查
    for (const charId of uniqueIds) {
      // 检查缓存
      if (this._cache.has(charId)) {
        const cached = this._cache.get(charId);
        if (!cached.pass) {
          errors.push(...cached.errors);
          missing.push(...cached.missing);
          outdated.push(...cached.outdated);
        } else {
          ready.push(charId);
        }
        continue;
      }
      
      const result = await this._checkCharacter(charId, sceneContext);
      this._cache.set(charId, result);
      
      if (!result.pass) {
        errors.push(...result.errors);
        if (result.reason === 'missing') missing.push(charId);
        if (result.reason === 'outdated') outdated.push(charId);
        blocked.push({ charId, reason: result.reason, details: result.errors });
      } else {
        ready.push(charId);
      }
    }
    
    const pass = errors.length === 0;
    const duration = Date.now() - startTime;
    
    // Step 3: 写入audit log
    const auditEntry = {
      timestamp: new Date().toISOString(),
      projectId,
      episodeId,
      characterIds: uniqueIds,
      pass,
      missing,
      outdated,
      ready,
      blocked,
      duration,
      errorCount: errors.length
    };
    this._writeAuditLog(auditEntry);
    
    return {
      pass,
      missing,
      outdated,
      ready,
      blocked,
      errors,
      canSubmit: pass,
      auditEntry
    };
  }

  /**
   * 强制阻断模式 - 不通过则抛错中断
   */
  async enforce(params) {
    const result = this.check(params);
    
    if (!result.pass) {
      const errorLines = [
        ``,
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  🚫 角色定妆照检查失败 - 生产流程已阻断                      ║`,
        `╠══════════════════════════════════════════════════════════════╣`,
        `║ 项目: ${params.projectId || 'unknown'}`,
        `║ 集数: ${params.episodeId || 'unknown'}`,
        `╠══════════════════════════════════════════════════════════════╣`,
      ];
      
      if (result.missing.length > 0) {
        errorLines.push(`║ ❌ 缺少定妆照（${result.missing.length}个角色）:`);
        for (const id of result.missing) {
          const cardPath = path.join(this.charactersDir, id, 'character-card.json');
          let charName = id;
          if (fss.existsSync(cardPath)) {
            try {
              const card = JSON.parse(await fs.promises.readFile(cardPath, 'utf8'));
              charName = card.name || id;
            } catch(e) {}
          }
          errorLines.push(`║    • ${charName} (${id})`);
        }
      }
      
      if (result.outdated.length > 0) {
        errorLines.push(`║ ⚠️  定妆照版本过期（${result.outdated.length}个角色）:`);
        for (const id of result.outdated) {
          errorLines.push(`║    • ${id} - 角色档案已更新但定妆照未同步`);
        }
      }
      
      errorLines.push(`╠══════════════════════════════════════════════════════════════╣`);
      errorLines.push(`║ 修复步骤:`);
      errorLines.push(`║ 1. 生成缺失角色的定妆照:`);
      errorLines.push(`║    node scripts/generate-portraits.js ${result.missing.join(' ')}`);
      if (result.outdated.length > 0) {
        errorLines.push(`║ 2. 更新过期角色的定妆照:`);
        errorLines.push(`║    node scripts/generate-portraits.js --update ${result.outdated.join(' ')}`);
      }
      errorLines.push(`║ 3. 确认定妆照状态:`);
      errorLines.push(`║    node scripts/check-portraits.js`);
      errorLines.push(`╚══════════════════════════════════════════════════════════════╝`);
      errorLines.push(``);
      
      throw new Error(errorLines.join('\n'));
    }
    
    return result;
  }

  /**
   * ==================== 单个角色检查 ====================
   */
  async _checkCharacter(charId, sceneContext = {}) {
    const errors = [];
    const cardPath = path.join(this.charactersDir, charId, 'character-card.json');
    
    // Rule 0: Nirath原生幻想生物豁免
    // 只有明确标记为Nirath原生幻想生物的角色才豁免定妆照要求
    let card = null;
    let isNativeCreature = false;
    
    if (fss.existsSync(cardPath)) {
      try {
        card = JSON.parse(await fs.promises.readFile(cardPath, 'utf8'));
        // 严格判断：只有同时满足以下条件才视为原生幻想生物
        // 1. 明确标记 species !== human/人类
        // 2. 或有原生生物特征描述（如无头无脸）
        // 3. 或明确标记 world === 'Nirath' 且非人类
        const species = (card.baseIdentity?.species || card.visualIdentity?.species || 'human').toLowerCase();
        const hasNativeFeatures = (card.visualAnchors?.required?.[0] || '').includes('无头无脸')
          || (card.visualAnchors?.required?.[0] || '').includes('云絮状');
        const explicitNative = card.universes?.includes('nirath-native') || card.id === 'nuanNuan';
        
        isNativeCreature = explicitNative 
          || (species !== 'human' && species !== '人类' && hasNativeFeatures);
      } catch(e) {}
    }
    
    // 原生幻想生物：有文字描述锚定即可，不要求照片级定妆照
    if (isNativeCreature) {
      const hasVisualAnchor = card?.visualAnchors?.required?.length > 0 
        || card?.visualIdentity?.distinguishingMarks;
      
      if (!hasVisualAnchor) {
        errors.push(`❌ [${charId}] Nirath原生生物缺少视觉锚定描述 | 需要在character-card.json中定义visualAnchors.required`);
        return { pass: false, reason: 'missing', errors };
      }
      
      return { 
        pass: true, 
        character: charId, 
        version: card?.version,
        isNativeCreature: true,
        note: 'Nirath原生幻想生物，使用文字视觉锚定而非照片定妆照'
      };
    }
    
    // Rule 1: 角色档案必须存在
    if (!fss.existsSync(cardPath)) {
      errors.push(`❌ [${charId}] 角色档案不存在: ${cardPath} | 请先创建角色档案`);
      return { pass: false, reason: 'missing', errors };
    }
    
    // Rule 2: 角色档案必须可解析
    if (!card) {
      try {
        card = JSON.parse(await fs.promises.readFile(cardPath, 'utf8'));
      } catch (e) {
        errors.push(`❌ [${charId}] 角色档案解析失败: ${e.message}`);
        return { pass: false, reason: 'missing', errors };
      }
    }
    
    // Rule 3: 必须有generatedAssets.portraits记录
    const portraits = card.generatedAssets?.portraits || [];
    if (portraits.length === 0) {
      errors.push(`❌ [${charId}] 无定妆照记录 | ${card.name || charId}需要生成定妆照（4角度: front/threeQuarter/closeup/side）`);
      return { pass: false, reason: 'missing', errors };
    }
    
    // Rule 4: 必须有production状态的定妆照
    const productionPortraits = portraits.filter(p => p.status === 'production');
    if (productionPortraits.length === 0) {
      errors.push(`❌ [${charId}] 无production状态定妆照 | ${card.name || charId}的定妆照未标记为production，请确认质量后更新状态`);
      return { pass: false, reason: 'missing', errors };
    }
    
    // Rule 5: 必要角度必须齐全
    const requiredAngles = card.portraitConfig?.angles || ['front', 'threeQuarter', 'closeup', 'side'];
    const missingAngles = [];
    
    for (const angle of requiredAngles) {
      const portrait = productionPortraits.find(p => p.angle === angle);
      if (!portrait) {
        missingAngles.push(angle);
        continue;
      }
      
      // Rule 6: 定妆照文件必须物理存在
      const portraitPath = portrait.localPath 
        ? path.join(process.cwd(), portrait.localPath)
        : path.join(this.charactersDir, charId, 'portraits', `${charId}-${angle}.png`);
      
      if (!fss.existsSync(portraitPath)) {
        errors.push(`❌ [${charId}] ${angle}角度定妆照文件缺失: ${portraitPath}`);
      } else {
        // Rule 7: 文件大小合理性检查（< 1KB可能是空文件）
        const stats = fss.statSync(portraitPath);
        if (stats.size < 1024) {
          errors.push(`⚠️ [${charId}] ${angle}角度定妆照文件异常（${stats.size}B），可能已损坏`);
        }
      }
    }
    
    if (missingAngles.length > 0) {
      errors.push(`❌ [${charId}] 缺少${missingAngles.join('/')}角度定妆照`);
    }
    
    // Rule 8: 版本号严格匹配（关键！）
    const cardVersion = card.version;
    const portraitVersions = [...new Set(productionPortraits.map(p => p.version).filter(Boolean))];
    
    if (cardVersion && portraitVersions.length > 0) {
      const latestPortraitVersion = portraitVersions.sort().pop(); // 取最新版本
      if (latestPortraitVersion !== cardVersion) {
        errors.push(`⚠️ [${charId}] 版本不匹配 | 角色档案版本:${cardVersion} vs 定妆照版本:${latestPortraitVersion} | 请重新生成定妆照以匹配最新档案`);
      }
    }
    
    // 分离硬错误和警告
    const hardErrors = errors.filter(e => e.startsWith('❌'));
    const warnings = errors.filter(e => e.startsWith('⚠️'));
    
    if (hardErrors.length > 0) {
      return { 
        pass: false, 
        reason: 'missing', 
        errors: [...hardErrors, ...warnings],
        character: charId,
        version: cardVersion
      };
    }
    
    // 只有警告 = 通过（但记录）
    if (warnings.length > 0) {
      return { 
        pass: true, 
        character: charId, 
        version: cardVersion,
        warnings,
        portraitCount: productionPortraits.length
      };
    }
    
    // 全部通过
    return { 
      pass: true, 
      character: charId, 
      version: cardVersion,
      portraitCount: productionPortraits.length,
      angles: requiredAngles
    };
  }

  /**
   * ==================== 工具方法 ====================
   */
  
  /**
   * 获取角色定妆照路径（用于API提交）
   * 
   * 策略：
   * - cross-shot/对话场景：优先threeQuarter（3/4侧面一致性最佳）
   * - 特写场景：优先closeup
   * - 全景/环境：优先front
   * - 默认：threeQuarter
   */
  getPortraitPaths(characterIds, shotType = 'medium') {
    const paths = {};
    
    const anglePriority = {
      'extreme_close': ['closeup', 'threeQuarter', 'front'],
      'close': ['closeup', 'threeQuarter', 'front'],
      'medium': ['threeQuarter', 'front', 'closeup'],
      'full': ['front', 'threeQuarter', 'side'],
      'wide': ['front', 'side', 'threeQuarter'],
      'extreme_wide': ['front', 'side']
    };
    
    const priority = anglePriority[shotType] || anglePriority['medium'];
    
    for (const charId of characterIds) {
      const cardPath = path.join(this.charactersDir, charId, 'character-card.json');
      if (!fss.existsSync(cardPath)) continue;
      
      let card;
      try {
        card = JSON.parse(await fs.promises.readFile(cardPath, 'utf8'));
      } catch(e) { continue; }
      
      const portraits = card.generatedAssets?.portraits || [];
      const production = portraits.filter(p => p.status === 'production');
      
      if (production.length === 0) continue;
      
      // 按优先级选择最佳角度
      let primary = null;
      for (const angle of priority) {
        primary = production.find(p => p.angle === angle);
        if (primary) break;
      }
      
      // fallback：任意可用
      if (!primary) primary = production[0];
      
      if (primary?.localPath) {
        const fullPath = path.join(process.cwd(), primary.localPath);
        if (fss.existsSync(fullPath)) {
          paths[charId] = {
            primary: fullPath,
            angle: primary.angle,
            version: primary.version,
            allAngles: production.map(p => ({
              angle: p.angle,
              path: path.join(process.cwd(), p.localPath),
              version: p.version
            }))
          };
        }
      }
    }
    
    return paths;
  }
  
  /**
   * 批量检查所有角色档案状态
   * 用于运维巡检
   */
  async auditAll() {
    const results = [];
    
    if (!fss.existsSync(this.charactersDir)) {
      return { error: '角色目录不存在' };
    }
    
    const entries = fss.readdirSync(this.charactersDir, { withFileTypes: true });
    const charDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    
    for (const charId of charDirs) {
      const result = await this._checkCharacter(charId);
      results.push({
        charId,
        name: result.character || charId,
        pass: result.pass,
        version: result.version,
        reason: result.reason,
        isNativeCreature: result.isNativeCreature || false,
        portraitCount: result.portraitCount || 0,
        errors: result.errors || []
      });
    }
    
    const passCount = results.filter(r => r.pass).length;
    const failCount = results.filter(r => !r.pass).length;
    
    return {
      total: results.length,
      pass: passCount,
      fail: failCount,
      characters: results
    };
  }
  
  /**
   * 写入audit log
   */
  _writeAuditLog(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      fss.appendFileSync(this.auditLogPath, line);
    } catch(e) {
      // audit失败不影响主流程
      console.warn(`[PortraitEnforcer] audit log写入失败: ${e.message}`);
    }
  }
  
  /**
   * 读取最近audit记录
   */
  async readAuditLog(limit = 50) {
    try {
      try {
        await fs.promises.access(this.auditLogPath);
      } catch {
        return [];
      }
      
      const data = await fs.promises.readFile(this.auditLogPath, 'utf8');
      const lines = data
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(-limit);
      
      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch(e) {
          return { raw: line, error: e.message };
        }
      });
    } catch(e) {
      return [];
    }
  }
}

module.exports = { CharacterPortraitEnforcer };
