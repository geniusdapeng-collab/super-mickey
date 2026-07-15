/**
 * Agent 1: Scene Decoder（场景解码器）
 * 将镜头上下文映射到Nirath布景模板
 * @module agents/scene-decoder
 */

const { SCENIC_TEMPLATES, SCENE_ALIAS_MAP } = require('../scenic-templates');

class SceneDecoder {
  constructor() {
    this.aliasMap = SCENE_ALIAS_MAP;
    this.templates = SCENIC_TEMPLATES;
  }

  /**
   * 解码镜头场景
   * @param {Object} shot - 镜头对象
   * @returns {Object} { scenicTemplate, templateParams, confidence }
   */
  decode(shot) {
    const sceneName = shot.scene || '';
    const habitat = shot.habitat || '';
    const type = shot.type || 'generic';
    
    // Step 1: 尝试直接匹配模板
    let templateKey = this._matchTemplate(sceneName, habitat);
    
    // Step 2: 根据镜头类型调整模板参数
    const templateParams = this._deriveParams(templateKey, type, shot);
    
    // Step 3: 获取完整模板数据
    const scenicTemplate = this.templates[templateKey] || this.templates['primordial_spine'];
    
    // Step 4: 计算匹配置信度
    const confidence = templateKey ? 1.0 : 0.3;
    
    return { scenicTemplate, templateParams, confidence };
  }

  _matchTemplate(sceneName, habitat) {
    const searchText = `${sceneName} ${habitat}`;
    
    // 优先别名匹配
    for (const [alias, templateKey] of Object.entries(this.aliasMap)) {
      if (searchText.includes(alias)) {
        return templateKey;
      }
    }
    
    // 回退：关键词匹配
    if (searchText.includes('海') || searchText.includes('水') || searchText.includes('渊')) {
      return 'abyssal_luminara';
    }
    if (searchText.includes('火') || searchText.includes('山') || searchText.includes('熔')) {
      return 'volcanic_ridge';
    }
    if (searchText.includes('草') || searchText.includes('林') || searchText.includes('原')) {
      return 'spore_forest';
    }
    if (searchText.includes('雾') || searchText.includes('岛') || searchText.includes('蜃')) {
      return 'misty_archipelago';
    }
    if (searchText.includes('悬') || searchText.includes('浮') || searchText.includes('空')) {
      return 'floating_archipelago';
    }
    if (searchText.includes('沼') || searchText.includes('泥') || searchText.includes('穴')) {
      return 'magnetic_bog';
    }
    if (searchText.includes('晨') || searchText.includes('雾') || searchText.includes('焦')) {
      return 'eternal_dawn';
    }
    if (searchText.includes('战') || searchText.includes('废') || searchText.includes('迹')) {
      return 'ancient_ruins';
    }
    if (searchText.includes('星') || searchText.includes('坛') || searchText.includes('能')) {
      return 'energy_nexus';
    }
    
    // 默认回退
    return 'primordial_spine';
  }

  _deriveParams(templateKey, type, shot) {
    const params = {
      scale: 'medium',
      energyState: 'dormant',
      timeOfDay: 'dual_star_balance',
      magneticIntensity: 'normal',
      ecologyDensity: 'normal'
    };
    
    // 根据镜头类型调整
    switch (type) {
      case 'opening':
        params.scale = 'massive';
        params.ecologyDensity = 'high';
        break;
      case 'demonstration':
        params.scale = 'close';
        params.energyState = 'active';
        break;
      case 'interaction':
        params.scale = 'intimate';
        params.magneticIntensity = 'visible';
        break;
      case 'closing':
        params.energyState = 'transitional';
        break;
    }
    
    // 根据shotSize调整
    const shotSize = shot.shotSize || 'medium';
    if (shotSize.includes('extreme_wide') || shotSize.includes('wide')) {
      params.scale = 'massive';
      params.ecologyDensity = 'high';
    } else if (shotSize.includes('close') || shotSize.includes('extreme_close')) {
      params.scale = 'macro';
      params.ecologyDensity = 'focused';
    }
    
    return params;
  }
}

module.exports = { SceneDecoder };
