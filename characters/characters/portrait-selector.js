/**
 * 角色定妆照选择器
 * 支持按场景/镜头自动选择正确的定妆照风格
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'character-portrait-registry.json');

class PortraitSelector {
  constructor() {
    this.registry = this._loadRegistry();
  }

  _loadRegistry() {
    try {
      const data = fs.readFileSync(REGISTRY_PATH, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('❌ 无法加载定妆照注册表:', err.message);
      return { characters: {}, selectionRules: {} };
    }
  }

  /**
   * 根据场景选择角色定妆照风格
   * @param {string} characterId - 角色ID (e.g., "chen-nurse")
   * @param {string} scene - 场景描述 (e.g., "警局", "家庭")
   * @param {string} angle - 角度 (e.g., "front", "closeup", "fullBody")
   * @returns {string|null} - 定妆照路径
   */
  selectPortrait(characterId, scene, angle = 'front') {
    const character = this.registry.characters[characterId];
    if (!character) {
      console.warn(`⚠️ 角色不存在: ${characterId}`);
      return null;
    }

    // 1. 根据场景选择风格
    const styleId = this._selectStyleByScene(scene, characterId);
    const style = character.styles[styleId];
    
    if (!style) {
      console.warn(`⚠️ 风格不存在: ${styleId} for ${characterId}`);
      return null;
    }

    // 2. 根据角度选择具体照片
    const portraitPath = style.portraits[angle] || style.portraits.front;
    
    if (!portraitPath) {
      console.warn(`⚠️ 角度不存在: ${angle} for ${characterId}/${styleId}`);
      return null;
    }

    // 3. 返回绝对路径
    const absolutePath = path.join('/root/.openclaw/workspace', portraitPath);
    
    console.log(`✅ 选择定妆照: ${characterId} | 场景: ${scene} | 风格: ${styleId} | 角度: ${angle} | 路径: ${portraitPath}`);
    
    return absolutePath;
  }

  /**
   * 批量选择多个角色的定妆照（用于多角色场景）
   * @param {Array} characters - [{id, scene, angle}]
   * @returns {Object} - {characterId: portraitPath}
   */
  selectPortraitsForShot(characters) {
    const result = {};
    for (const char of characters) {
      result[char.id] = this.selectPortrait(char.id, char.scene, char.angle || 'front');
    }
    return result;
  }

  /**
   * 获取角色所有可用风格
   * @param {string} characterId
   * @returns {Object} - {styleId: styleInfo}
   */
  getCharacterStyles(characterId) {
    const character = this.registry.characters[characterId];
    if (!character) return null;
    return character.styles;
  }

  /**
   * 注册新风格（用于动态添加新定妆照）
   * @param {string} characterId
   * @param {string} styleId
   * @param {Object} styleInfo
   */
  registerStyle(characterId, styleId, styleInfo) {
    if (!this.registry.characters[characterId]) {
      this.registry.characters[characterId] = { styles: {} };
    }
    this.registry.characters[characterId].styles[styleId] = styleInfo;
    this._saveRegistry();
  }

  _selectStyleByScene(scene, characterId) {
    const mapping = this.registry.selectionRules?.sceneToStyleMapping || {};
    
    // 1. 精确匹配
    if (mapping[scene]) {
      return mapping[scene];
    }
    
    // 2. 模糊匹配（包含关键词）
    for (const [key, style] of Object.entries(mapping)) {
      if (scene.includes(key)) {
        return style;
      }
    }
    
    // 3. 默认风格
    const character = this.registry.characters[characterId];
    const defaultStyle = this.registry.selectionRules?.defaultStyle || 'default';
    
    if (character.styles[defaultStyle]) {
      return defaultStyle;
    }
    
    // 4. 第一个可用风格
    return Object.keys(character.styles)[0];
  }

  _saveRegistry() {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(this.registry, null, 2));
  }
}

module.exports = PortraitSelector;

// CLI 测试
if (require.main === module) {
  const selector = new PortraitSelector();
  
  console.log('=== 测试定妆照选择器 ===\n');
  
  // 测试1: 警局场景
  console.log('测试1: 陈卓在警局');
  const policePortrait = selector.selectPortrait('chen-nurse', '警局', 'front');
  console.log('  结果:', policePortrait);
  console.log();
  
  // 测试2: 家庭场景
  console.log('测试2: 陈卓在家庭客厅');
  const lifePortrait = selector.selectPortrait('chen-nurse', '客厅', 'sitting');
  console.log('  结果:', lifePortrait);
  console.log();
  
  // 测试3: 多角色
  console.log('测试3: 多角色场景');
  const multiChar = selector.selectPortraitsForShot([
    { id: 'chen-nurse', scene: '警局', angle: 'front' },
    { id: 'xiangXiang', scene: '家庭', angle: 'front' }
  ]);
  console.log('  结果:', multiChar);
}
