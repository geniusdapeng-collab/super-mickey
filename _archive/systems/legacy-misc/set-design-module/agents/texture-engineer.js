/**
 * Agent 3: Texture & Material Engineer（质感工程师）
 * 为每层关键元素赋予超写实材质描述
 * @module agents/texture-engineer
 */

const { MATERIAL_LIBRARY, LIGHT_REACTION_GUIDE, composeMaterial } = require('../material-library');

class TextureEngineer {
  constructor() {
    this.materialLibrary = MATERIAL_LIBRARY;
    this.lightGuide = LIGHT_REACTION_GUIDE;
  }

  /**
   * 为各层分配材质
   * @param {Object} depthLayers - 舞台美术师输出的层描述
   * @param {Array} materialPalette - 场景模板推荐的材质调色板
   * @param {string} lightState - 光照状态
   * @returns {Object} materialSpecs
   */
  assignMaterials(depthLayers, materialPalette, lightState) {
    const materialSpecs = {};
    
    // 为每层选择合适的材质
    const layerNames = ['foreground', 'midground', 'background', 'sky'];
    
    layerNames.forEach((layerName, index) => {
      const layerDesc = depthLayers[layerName];
      if (!layerDesc || layerDesc === '无') {
        materialSpecs[layerName] = null;
        return;
      }
      
      // 从调色板选择材质（循环分配）
      const materialKey = materialPalette[index % materialPalette.length];
      const material = this.materialLibrary[materialKey];
      
      if (material) {
        materialSpecs[layerName] = {
          key: materialKey,
          base: material.base,
          detail: material.detail,
          weathering: material.weathering || null,
          lightReaction: this.lightGuide[lightState] || material.light_reaction,
          banned: material.banned,
          compressed: this._compressMaterial(material, lightState, 50) // 50字符精简版
        };
      } else {
        materialSpecs[layerName] = null;
      }
    });
    
    return materialSpecs;
  }

  /**
   * 压缩材质描述到指定长度
   */
  _compressMaterial(material, lightState, maxLength) {
    const parts = [material.base];
    if (material.detail) parts.push(material.detail);
    
    const lightDesc = this.lightGuide[lightState] || material.light_reaction;
    if (lightDesc) parts.push(lightDesc);
    
    let result = parts.join('，');
    
    if (result.length > maxLength) {
      // 裁剪策略：保留核心名词，删除修饰词
      result = result
        .replace(/表面/g, '')
        .replace(/可见/g, '')
        .replace(/微弱/g, '')
        .replace(/缓慢/g, '')
        .replace(/产生/g, '')
        .replace(/形成/g, '');
      
      if (result.length > maxLength) {
        result = result.substring(0, maxLength - 3) + '...';
      }
    }
    
    return result;
  }

  /**
   * 生成完整材质描述段落
   */
  generateMaterialParagraph(materialSpecs, maxLength = 120) {
    const parts = [];
    
    ['foreground', 'midground', 'background'].forEach(layer => {
      const spec = materialSpecs[layer];
      if (spec && spec.compressed) {
        parts.push(spec.compressed);
      }
    });
    
    let result = parts.join('。');
    
    // 追加禁止词
    const allBanned = new Set();
    Object.values(materialSpecs).forEach(spec => {
      if (spec && spec.banned) {
        spec.banned.split('、').forEach(b => allBanned.add(b.trim()));
      }
    });
    
    if (allBanned.size > 0) {
      const bannedStr = Array.from(allBanned).slice(0, 3).join('、'); // 最多3条
      result += `。${bannedStr}`;
    }
    
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }
    
    return result;
  }
}

module.exports = { TextureEngineer };
