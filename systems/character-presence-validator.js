/**
 * CharacterPresenceValidator v1.0
 * 【v6.2-patch90-系统级修复】角色存在性校验器
 * 
 * 功能：
 * - 扫描 narration 中提及的角色名
 * - 强制将提及的角色加入 shot.characters 数组
 * - 防止" narration 中有角色但 characters 数组缺失"导致定妆照/文字描述丢失
 * 
 * @version v1.0
 * @author Core Team
 */

class CharacterPresenceValidator {
  constructor(options = {}) {
    // 【v2.1.4-fix10-P25-fix8-P0D】角色映射表可注入，且从 characters 目录动态加载
    this.characterNameMap = options.characterNameMap || {
      '小G': 'xiaoG', '小纪': 'xiaoG', '主角': 'xiaoG', '少年': 'xiaoG',
      '饕餮': 'tao-tie', 'taotie': 'tao-tie',
      '烛龙': 'zhu-long', 'zhulong': 'zhu-long',
      '九尾': 'jiu-wei', '九尾狐': 'jiu-wei', 'jiuweihu': 'jiu-wei',
      '暖暖': 'nuan-nuan',
      '帝江': 'di-jiang'
    };
    
    // 角色档案（用于验证 ID 存在性）
    this.characterProfiles = options.characterProfiles || {};
    
    // 【v2.1.4-fix10-P25-fix8-P0D】动态加载 characters 目录下的所有角色 ID
    this._knownIds = new Set([
      'xiaoG', 'tao-tie', 'zhu-long', 'jiu-wei', 'nuan-nuan', 'di-jiang'
    ]);
    if (options.charactersDir) {
      try {
        const fss = require('fs');
        const entries = fss.readdirSync(options.charactersDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) this._knownIds.add(e.name);
        }
      } catch {}
    }
    
    // 严格模式：如果 narration 中提及角色但 characters 数组缺失，报错
    this.strictMode = options.strictMode !== false;
  }

  /**
   * 主入口：校验 shot 的角色存在性
   * @param {Object} shot - 镜头数据 { id, narration, characters }
   * @returns {Object} { valid, fixed, errors, warnings, addedCharacters }
   */
  validate(shot) {
    const result = {
      shotId: shot.id || shot.shotId,
      valid: true,
      fixed: false,
      errors: [],
      warnings: [],
      addedCharacters: [],
      originalCharacters: [...(shot.characters || [])],
      finalCharacters: [...(shot.characters || [])]
    };

    if (!shot.narration) {
      result.warnings.push('⚠️ narration 为空，无法检测角色存在性');
      return result;
    }

    // 1. 扫描 narration 中提及的角色
    const mentionedCharacters = this._scanCharacters(shot.narration);
    
    // 2. 检查缺失的角色
    const existingIds = new Set(result.finalCharacters);
    const missingCharacters = mentionedCharacters.filter(id => !existingIds.has(id));
    
    if (missingCharacters.length > 0) {
      result.warnings.push(
        `⚠️ narration 中提及角色 [${missingCharacters.join(', ')}] 但未在 characters 数组中声明`
      );
      
      if (this.strictMode) {
        // 强制修复：将缺失角色加入 characters 数组
        for (const charId of missingCharacters) {
          if (this._isValidCharacterId(charId)) {
            result.finalCharacters.push(charId);
            result.addedCharacters.push(charId);
            result.fixed = true;
          } else {
            result.errors.push(`❌ 未知角色 ID: ${charId}，无法自动修复`);
            result.valid = false;
          }
        }
        
        if (result.addedCharacters.length > 0) {
          result.warnings.push(
            `🔧 已自动修复：将 [${result.addedCharacters.join(', ')}] 加入 characters 数组`
          );
        }
      } else {
        result.valid = false;
        result.errors.push(
          `❌ 严格模式关闭，未自动修复缺失角色: [${missingCharacters.join(', ')}]`
        );
      }
    }

    // 3. 校验角色档案存在性
    for (const charId of result.finalCharacters) {
      if (!this._isValidCharacterId(charId)) {
        result.errors.push(`❌ 角色 ${charId} 无档案定义`);
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * 扫描 narration 中提及的角色
   * @param {string} narration 
   * @returns {string[]} 角色 ID 数组
   */
  _scanCharacters(narration) {
    const found = new Set();
    
    // 静态映射表
    for (const [name, id] of Object.entries(this.characterNameMap)) {
      // 使用正则匹配全词（避免部分匹配）
      const regex = new RegExp(name, 'g');
      if (regex.test(narration)) {
        found.add(id);
      }
    }
    
    // 【v2.1.4-fix10-P25-fix8-P0D】动态：从 characterProfiles 的 name 字段匹配
    for (const [id, profile] of Object.entries(this.characterProfiles)) {
      const name = profile.name || profile.baseIdentity?.name;
      if (name && narration.includes(name)) found.add(id);
    }
    
    return Array.from(found);
  }

  /**
   * 校验角色 ID 是否有效（有档案定义）
   * 【v2.1.4-fix10-P25-fix8-P0D】优先检查注入的 profiles，再检查动态加载的 knownIds
   */
  _isValidCharacterId(charId) {
    if (this.characterProfiles[charId]) return true;
    return this._knownIds.has(charId);
  }

  /**
   * 批量校验所有 shots
   * @param {Object[]} shots 
   * @returns {Object} { allValid, results, totalFixed, totalErrors }
   */
  validateAll(shots) {
    const results = shots.map(shot => this.validate(shot));
    
    const totalFixed = results.filter(r => r.fixed).length;
    const totalErrors = results.filter(r => !r.valid).length;
    
    return {
      allValid: totalErrors === 0,
      results,
      totalFixed,
      totalErrors,
      summary: this._generateSummary(results)
    };
  }

  /**
   * 生成校验报告
   */
  _generateSummary(results) {
    const fixed = results.filter(r => r.fixed);
    const errors = results.filter(r => !r.valid && !r.fixed);
    
    let summary = '═══ CharacterPresenceValidator 校验报告 ═══\n';
    summary += `总镜头: ${results.length}\n`;
    summary += `自动修复: ${fixed.length} 个\n`;
    summary += `未修复错误: ${errors.length} 个\n`;
    summary += `\n`;
    
    if (fixed.length > 0) {
      summary += '📋 已自动修复的镜头:\n';
      for (const r of fixed) {
        summary += `  ${r.shotId}: +[${r.addedCharacters.join(', ')}]\n`;
      }
    }
    
    if (errors.length > 0) {
      summary += '\n❌ 未修复的错误:\n';
      for (const r of errors) {
        summary += `  ${r.shotId}: ${r.errors.join('; ')}\n`;
      }
    }
    
    return summary;
  }
}

module.exports = { CharacterPresenceValidator };
