/**
 * Nirath Character Enhancement Module v1.0
 * 为角色系统注入Nirath世界观适应性
 * 
 * 功能：
 * - 为角色添加Nirath生态适应性字段
 * - 角色伤口与Nirath地质隐喻绑定
 * - 角色情绪映射到环境光照变化
 * - 与世界灵魂绑定（WorldSoulBinding）
 * 
 * 版本: v1.0
 * 日期: 2026-05-21
 */

const fs = require('fs');
const path = require('path');

// Nirath生态适应性模板
const NIRATH_ADAPTATION_TEMPLATES = {
  "归墟之海": {
    gravityTolerance: "standard-G, ocean-adapted swimming movements",
    lightSpectrumVision: "deep-sea adapted, sees bioluminescent spectrum 400-700nm",
    bioluminescenceHarmony: "skin emits soft cyan glow matching ocean waves",
    materialCulture: "clothing woven from Lumivine fiber and coral silk",
    pressureAdaptation: "deep-ocean pressure tolerant, movements are fluid and slow",
    thermalRegulation: "cold-water adapted, skin has insulating bioluminescent layer"
  },
  "不周山脉": {
    gravityTolerance: "high-G mountain adapted, strong muscular build",
    lightSpectrumVision: "volcanic-light adapted, sees through smoke and ash",
    bioluminescenceHarmony: "skin emits warm amber glow matching crystal veins",
    materialCulture: "armor made from obsidian scales and crystal threads",
    thermalRegulation: "heat-resistant, skin has cooling mineral deposit patterns",
    seismicSense: "can detect geological vibrations through feet"
  },
  "青丘灵原": {
    gravityTolerance: "low-G grassland adapted, movements are light and bounding",
    lightSpectrumVision: "twilight adapted, enhanced night vision for dual-moon",
    bioluminescenceHarmony: "skin emits soft blue-green glow matching grass",
    materialCulture: "clothing woven from grass fiber and spore silk",
    windSense: "antenna-like hair sensors detect wind changes",
    photosynthesis: "limited skin photosynthesis from rhodopsin-like pigments"
  },
  "幽冥地下海": {
    gravityTolerance: "standard-G, cave-adapted careful movements",
    lightSpectrumVision: "dark-adapted, sees infrared and phosphorescent light",
    bioluminescenceHarmony: "skin emits pale blue glow matching soul threads",
    materialCulture: "clothing woven from fungal fiber and mineral silk",
    echolocation: "subsonic click communication, cave navigation",
    pressureSense: "detects air pressure changes from geothermal vents"
  },
  "汤谷扶桑": {
    gravityTolerance: "standard-G, heat-adapted slow graceful movements",
    lightSpectrumVision: "intense-light adapted, sees through golden mist",
    bioluminescenceHarmony: "skin emits golden glow matching crystal refraction",
    materialCulture: "clothing woven from crystal fiber and light-conducting silk",
    heatRegulation: "extreme heat tolerant, skin has reflective crystal dust layer",
    lightStorage: "skin can store and slowly release absorbed light"
  },
  "昆仑悬境": {
    gravityTolerance: "low-G sky-continent adapted, floating graceful movements",
    lightSpectrumVision: "vacuum-edge adapted, sees cosmic rays as colors",
    bioluminescenceHarmony: "skin emits electric blue glow matching superconductor veins",
    materialCulture: "clothing woven from magnetic fiber and cloud silk",
    magneticSense: "detects magnetic field lines, navigates by field topology",
    altitudeAdaptation: "thin-atmosphere adapted, efficient oxygen use"
  },
  "涿鹿战场": {
    gravityTolerance: "variable-G, seismic-adapted balanced stance",
    lightSpectrumVision: "electromagnetic-storm adapted, sees aurora spectrum",
    bioluminescenceHarmony: "skin emits multi-colored glow matching fissure lights",
    materialCulture: "armor made from monolith stone and electromagnetic mesh",
    seismicReflexes: "automatic balance adjustment during earthquakes",
    electromagneticImmunity: "resistant to electromagnetic pulse effects"
  },
  "蓬莱迷雾": {
    gravityTolerance: "low-G floating-island adapted, drifting movements",
    lightSpectrumVision: "fog-penetrating adapted, sees through supercritical fluid",
    bioluminescenceHarmony: "skin emits silver glow matching mercury lakes",
    materialCulture: "clothing woven from acidic-fern fiber and bridge-crystal silk",
    acidResistance: "skin resistant to acidic atmospheric conditions",
    floatationControl: "limited buoyancy control in supercritical environment"
  },
  "星门祭坛": {
    gravityTolerance: "standard-G, sacred-ground adapted ceremonial movements",
    lightSpectrumVision: "full-spectrum adapted, sees from infrared to ultraviolet",
    bioluminescenceHarmony: "skin emits full-color glow matching plasma sphere",
    materialCulture: "clothing woven from energy-conducting fiber and aurora silk",
    energySensitivity: "detects energy field fluctuations",
    cosmicAlignment: "instinctive sense of astronomical alignments"
  },
  "盘古之脊": {
    gravityTolerance: "standard-G, planetary-scale adapted heavy movements",
    lightSpectrumVision: "mantle-glow adapted, sees through translucent obsidian",
    bioluminescenceHarmony: "skin emits crimson pulse matching mantle heartbeat",
    materialCulture: "clothing woven from mantle-fiber and mountain-root silk",
    geologicalEmpathy: "feels planetary geological rhythms",
    tectonicCommunication: "subsonic vibration communication over long distances"
  }
};

// ========== Nirath角色增强器 ==========
class NirathCharacterEnhancer {
  constructor() {
    this.templates = NIRATH_ADAPTATION_TEMPLATES;
  }
  
  /**
   * 为角色添加Nirath适应性
   * @param {Object} character - 角色档案
   * @param {string} homeScene - 主场场景（Nirath 10大场景之一）
   * @returns {Object} 增强后的角色
   */
  enhance(character, homeScene = null) {
    const enhanced = { ...character };
    
    // 自动推断主场场景（如果未指定）
    if (!homeScene && character.nirathScene) {
      homeScene = character.nirathScene;
    }
    
    // 添加Nirath适应性
    if (homeScene && this.templates[homeScene]) {
      enhanced.nirathAdaptation = {
        ...this.templates[homeScene],
        homeScene,
        adaptationLevel: "native-born",
        generation: "Nirath-native"
      };
    } else {
      // 通用适应性
      enhanced.nirathAdaptation = {
        gravityTolerance: "standard-G adapted",
        lightSpectrumVision: "dual-star standard vision",
        bioluminescenceHarmony: "skin emits soft ambient glow",
        materialCulture: "clothing woven from native fibers",
        homeScene: homeScene || "unknown",
        adaptationLevel: "visitor",
        generation: "first-generation"
      };
    }
    
    // 添加Nirath元数据
    enhanced.nirathMetadata = {
      enhancedAt: new Date().toISOString(),
      enhancerVersion: "1.0",
      homeScene,
      sceneSpecific: homeScene ? true : false
    };
    
    return enhanced;
  }
  
  /**
   * 批量增强角色组
   * @param {Array} characters - 角色数组
   * @param {Object} sceneAssignments - 场景分配 {characterId: sceneName}
   * @returns {Array} 增强后的角色数组
   */
  enhanceGroup(characters, sceneAssignments = {}) {
    return characters.map(char => {
      const scene = sceneAssignments[char.id] || char.nirathScene || null;
      return this.enhance(char, scene);
    });
  }
  
  /**
   * 获取角色的Nirath描述（用于Prompt）
   * @param {Object} character - 增强后的角色
   * @returns {string} Nirath描述文本
   */
  getNirathDescription(character) {
    if (!character.nirathAdaptation) return "";
    
    const adapt = character.nirathAdaptation;
    const parts = [];
    
    if (adapt.gravityTolerance) {
      parts.push(`Movement: ${adapt.gravityTolerance}`);
    }
    if (adapt.lightSpectrumVision) {
      parts.push(`Vision: ${adapt.lightSpectrumVision}`);
    }
    if (adapt.bioluminescenceHarmony) {
      parts.push(`Skin glow: ${adapt.bioluminescenceHarmony}`);
    }
    if (adapt.materialCulture) {
      parts.push(`Attire: ${adapt.materialCulture}`);
    }
    if (adapt.homeScene) {
      parts.push(`Native to: ${adapt.homeScene}`);
    }
    
    return parts.join('. ');
  }
  
  /**
   * 检查角色是否需要增强
   * @param {Object} character - 角色档案
   * @returns {boolean}
   */
  needsEnhancement(character) {
    return !character.nirathAdaptation || !character.nirathMetadata;
  }
}

// ========== 世界灵魂绑定（WorldSoulBinding） ==========
class WorldSoulBinding {
  constructor() {
    this.bindings = new Map();
  }
  
  /**
   * 绑定角色到Nirath世界灵魂
   * @param {string} characterId - 角色ID
   * @param {string} sceneName - 场景名
   * @param {Object} soulMap - 灵魂映射 {wound: string, emotion: string, lightMood: string}
   */
  bind(characterId, sceneName, soulMap = {}) {
    const binding = {
      characterId,
      sceneName,
      woundToGeology: soulMap.wound || null,
      emotionToLight: soulMap.emotion || null,
      personalityToAtmosphere: soulMap.personality || null,
      boundAt: new Date().toISOString()
    };
    
    this.bindings.set(characterId, binding);
    return binding;
  }
  
  /**
   * 获取角色的世界绑定
   * @param {string} characterId - 角色ID
   * @returns {Object|null}
   */
  getBinding(characterId) {
    return this.bindings.get(characterId) || null;
  }
  
  /**
   * 生成环境-情绪映射（用于光照和氛围控制）
   * @param {string} characterId - 角色ID
   * @param {string} emotion - 当前情绪
   * @returns {Object} 环境调整建议
   */
  generateEnvironmentMapping(characterId, emotion) {
    const binding = this.bindings.get(characterId);
    if (!binding) return null;
    
    const emotionToLightMap = {
      "joy": "bioluminescence intensifies, warm golden fill",
      "sadness": "cool blue dominant, isolated warm accents",
      "anger": "magma-red highlights, contrast-heavy shadows",
      "fear": "flickering bioluminescence, deep shadow pools",
      "awe": "god-rays intensify, full spectrum bloom",
      "love": "soft pink-gold aura, gentle luminescent wrap"
    };
    
    return {
      characterId,
      emotion,
      lightAdjustment: emotionToLightMap[emotion] || "neutral balanced",
      sceneBinding: binding.sceneName,
      timestamp: new Date().toISOString()
    };
  }
}

// ========== 导出 ==========
module.exports = {
  NirathCharacterEnhancer,
  WorldSoulBinding,
  NIRATH_ADAPTATION_TEMPLATES
};

// CLI测试
if (require.main === module) {
  const enhancer = new NirathCharacterEnhancer();
  const worldBinding = new WorldSoulBinding();
  
  console.log('\n🔥 Nirath Character Enhancement Module v1.0\n');
  
  // 测试角色增强
  const testCharacter = {
    id: "xiaoG",
    name: "小G",
    age: 8,
    nirathScene: "青丘灵原"
  };
  
  const enhanced = enhancer.enhance(testCharacter);
  console.log('--- 增强后的角色 ---');
  console.log(`Name: ${enhanced.name}`);
  console.log(`Nirath Adaptation:`);
  console.log(`  Gravity: ${enhanced.nirathAdaptation.gravityTolerance}`);
  console.log(`  Vision: ${enhanced.nirathAdaptation.lightSpectrumVision}`);
  console.log(`  Skin: ${enhanced.nirathAdaptation.bioluminescenceHarmony}`);
  console.log(`  Attire: ${enhanced.nirathAdaptation.materialCulture}`);
  
  // 测试Prompt描述生成
  const desc = enhancer.getNirathDescription(enhanced);
  console.log(`\nPrompt描述: ${desc}`);
  
  // 测试世界灵魂绑定
  worldBinding.bind("xiaoG", "青丘灵原", {
    wound: "孤独感映射到草原的无尽属性",
    emotion: "好奇映射到孢子水母的漂浮",
    personality: "活泼映射到草浪的波动"
  });
  
  const mapping = worldBinding.generateEnvironmentMapping("xiaoG", "joy");
  console.log(`\n环境映射: ${mapping.lightAdjustment}`);
  
  console.log('\n✅ Nirath Character Enhancement 测试完成\n');
}
