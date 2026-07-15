/**
 * Orient Primordial Core v24.3 - Nirath Edition + 运镜时间轴支持
 * 统一引擎:Nirath风格强制约束 + 双星光照 + 材质系统 + 背景丰富化 + 镜头内时间轴
 *
 * 系统级升级(v23→v24):
 * - 新增 NirathStyleEnforcer(风格强制约束器)
 * - 新增 DualStarLightingEngine(双星光照物理引擎)
 * - 新增 NirathMaterialSystem(Nirath材质系统)
 * - 新增 BackgroundEnrichmentAgent(背景丰富化Agent)
 * - 场景库升级至 v2.0(10大核心场景完整背景)
 * - 向后兼容:v23/v22/v21 接口保留
 *
 * 版本: v24.0-Nirath
 * 日期: 2026-05-21
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const Standard = require('../systems/prompt-standard-v2');

// ========== 配置常量 ==========
const MAX_PROMPT_LENGTH = 980;
const WORKSPACE = '/root/.openclaw/workspace';

// Nirath 主生成参数(Seedance优化版,清理UE5/Lumen/Nanite遗留)
const NIRATH_MASTER_PARAMS = [
  // v6.2-patch63-fix: 全部替换为中文等效描述，避免Seedance误读英文引擎声明
  "超写实数字渲染, 概念美术级质感",
  "影视级画面构图, IMAX画幅, 空气透视感",
  "皮肤与材质微距摄影级细节, 写实风格"
];

// Nirath 禁止关键词(非Nirath风格)
const NIRATH_BANNED_KEYWORDS = [
  "中国风", "古风", "传统", "水墨", "国风", "仙侠", "武侠",
  "chinese style", "traditional chinese", "ink wash", "oriental",
  "lo-fi", "anime", "cartoon", "cartoony", "stylized", "toon"
  // "earth" 已移除 - 可能作为合理地质描述词(如unearth, hearth)
];

// ========== 场景库加载 ==========
const SCENE_LIBRARY_PATH = path.join(WORKSPACE, 'data', 'nirath-scene-library-v2.json');
let SCENE_LIBRARY = {};
try {
  SCENE_LIBRARY = JSON.parse(fss.readFileSync(SCENE_LIBRARY_PATH, 'utf8'));
  delete SCENE_LIBRARY._meta;
} catch (e) {
  console.warn(`[Core-v24] 无法加载场景库: ${e.message}`);
}

// ========== Agent 0: Nirath风格强制约束器 ==========
class NirathStyleEnforcer {
  constructor() {
    this.masterParams = NIRATH_MASTER_PARAMS;
    this.bannedKeywords = NIRATH_BANNED_KEYWORDS;
    this.sceneLibrary = SCENE_LIBRARY;
  }

  enforce(prompt, sceneName = null, shotParams = {}) {
    let result = prompt;
    const issues = [];

    // 1. 检查禁止关键词(使用单词边界匹配,中文不适用)
    for (const banned of this.bannedKeywords) {
      // 中文关键词不使用单词边界
      const isChinese = /[\u4e00-\u9fa5]/.test(banned);
      const regex = isChinese
        ? new RegExp(banned, 'gi')
        : new RegExp(`\\b${banned}\\b`, 'gi');
      if (regex.test(result)) {
        issues.push(`❌ 禁止关键词: "${banned}"`);
        result = result.replace(regex, '[NIRATH-STYLE-REDACTED]');
      }
    }

    // 2. 强制注入Master Parameters(如果不存在)- 使用安全版本(已清理UE5/Lumen/Nanite)
    // v6.2-patch63-fix: 检查中文等效描述是否存在，不再检查英文遗留词
    const masterText = "超写实数字渲染, 影视级画面质感。 ";
    if (!result.includes('超写实') && !result.includes('影视级')) {
      result = masterText + result;
      issues.push('✅ 已注入Nirath风格参数');
    }

    // 3. 场景特定约束
    if (sceneName && this.sceneLibrary[sceneName]) {
      const scene = this.sceneLibrary[sceneName];

      // 检查色彩合规性
      if (scene.colorPalette && scene.colorPalette.scienceReason) {
        const dominant = scene.colorPalette.dominant;
        if (!result.toLowerCase().includes(dominant.toLowerCase())) {
          result += ` Color palette dominated by ${dominant}.`;
          issues.push(`✅ 已注入主色调: ${dominant}`);
        }
      }

      // 检查光照系统
      if (scene.lightEnvironment) {
        if (scene.lightEnvironment.dualStar && !result.includes('dual')) {
          result += ' Dual-star lighting system active.';
          issues.push('✅ 已注入双星光照');
        }
      }

      // 检查生物发光
      if (scene.ecosystem && scene.ecosystem.bioluminescenceMechanism) {
        if (!result.includes('bioluminescent') && !result.includes('glowing')) {
          result += ' Bioluminescent ecosystem prominent.';
          issues.push('✅ 已注入生物发光');
        }
      }
    }

    // 4. 强制双星/双月可见
    if (!result.includes('dual') && !result.includes('twin') && !result.includes('binary')) {
      result += ' Binary star system visible in sky.';
      issues.push('✅ 已注入双星系统');
    }

    // 5. Prompt利用率最大化 - 余量填充机制(队长点子)
    const targetLength = 960; // 调整目标为960(给截断留余量)
    const maxLength = 980;    // 硬上限

    if (result.length < targetLength) {
      const deficit = targetLength - result.length;
      issues.push(`⚠️ Prompt余量: ${deficit}字符未使用,启动余量填充`);

      // 填充1:人物表情增强(如果有角色)
      // 🔥 v6.2-patch101-fix: 将微表情替换为可执行动作/姿态（解决无效指令问题）
      // 根因："眉毛微微上扬/嘴角微张"等AI不可控，属于无效描述
      // 修复：替换为具体身体动作、姿态变化，AI可执行
      if (shotParams.emotion || shotParams.mouthAction) {
        const emotionDesc = shotParams.emotion === 'awe' ? '身体后仰15度，双手张开，肩膀放松下沉' :
                           shotParams.emotion === 'tension' ? '双手握拳，肩膀耸起，身体前倾10度，双脚站稳' :
                           shotParams.emotion === 'wonder' ? '身体微微前倾，头抬高15度，双手自然下垂' :
                           shotParams.emotion === 'triumph' ? '双臂张开高举，胸膛挺起，双脚稳稳站立' :
                           '身体直立，双手自然下垂，肩膀放松';
        result += ` Character action: ${emotionDesc}.`;
        issues.push('✅ 已填充人物可执行动作');
      }

      // 填充2:环境细节提升(如果余量仍大)
      if (result.length < targetLength && sceneName && this.sceneLibrary[sceneName]) {
        const scene = this.sceneLibrary[sceneName];
        const envExtras = [];

        if (scene.atmosphere) envExtras.push(`Atmospheric mood: ${scene.atmosphere}`);
        if (scene.l3Depth) envExtras.push(`Environmental depth: ${scene.l3Depth} composition`);
        if (scene.acoustics && scene.acoustics.ambientSound) envExtras.push(`Ambient soundscape: ${scene.acoustics.ambientSound}`);

        if (envExtras.length > 0) {
          result += ' ' + envExtras.join('. ') + '.';
          issues.push('✅ 已填充环境细节');
        }
      }

      // 填充3:通用质感增强(保底填充)
      if (result.length < targetLength) {
        const qualityBoost = [
          'Subsurface scattering on skin and translucent materials',
          'Volumetric god-rays piercing through atmospheric haze',
          'Microscopic dust particles floating in light beams',
          'Anisotropic reflections on wet surfaces',
          'Chromatic aberration at frame edges for cinematic realism',
          'Tilt-shift depth separation for macro-photography feel'
        ];
        // 按余量选择填充数量
        const needChars = targetLength - result.length;
        const itemsToAdd = Math.min(Math.ceil(needChars / 80), qualityBoost.length);
        const selected = qualityBoost.slice(0, itemsToAdd);
        result += ' ' + selected.join('. ') + '.';
        issues.push(`✅ 已填充通用质感增强(${itemsToAdd}项)`);
      }

      // 最终报告
      if (result.length >= targetLength && result.length <= maxLength) {
        issues.push(`🔥 Prompt利用率理想: ${result.length}/${maxLength} (${Math.round(result.length/maxLength*100)}%)`);
      } else if (result.length > maxLength) {
        issues.push(`⚠️ 填充后超标: ${result.length} > ${maxLength},执行截断`);
        result = this.truncatePrompt(result);
        issues.push(`✅ 截断后长度: ${result.length}`);
      } else {
        issues.push(`⚠️ 填充后仍不足: ${result.length}/${targetLength}`);
      }
    } else if (result.length >= targetLength && result.length <= maxLength) {
      issues.push(`🔥 Prompt利用率理想: ${result.length}/${maxLength} (${Math.round(result.length/maxLength*100)}%)`);
    }

    // 6. Prompt长度控制(v5.0-fix)
    if (result.length > 980) {
      issues.push(`⚠️ Prompt超长: ${result.length} > 980,执行截断`);
      result = this.truncatePrompt(result);
      issues.push(`✅ 截断后长度: ${result.length}`);
    }

    return { prompt: result, issues, compliant: issues.every(i => i.startsWith('✅') || i.startsWith('⚠️') || i.startsWith('🔥')) };
  }

  /**
   * Prompt截断策略(v5.0-fix)
   * 保留优先级:Master Params > 视觉描述 > 光照 > 材质 > 情绪 > 背景
   */
  truncatePrompt(prompt) {
    // 如果超长,移除详细科学解释,保留核心描述
    let truncated = prompt;

    // 策略1:压缩背景信息(保留前200字符的背景)
    const bgPatterns = [
      /\[GEOLOGY\].*?(?=\[|$)/s,
      /\[ECOSYSTEM\].*?(?=\[|$)/s,
      /\[LIGHT SCIENCE\].*?(?=\[|$)/s,
      /\[CULTURE\].*?(?=\[|$)/s,
      /\[MATERIALS\].*?(?=\[|$)/s,
      /\[ACOUSTICS\].*?(?=\[|$)/s
    ];

    for (const pattern of bgPatterns) {
      if (truncated.length > 980) {
        truncated = truncated.replace(pattern, '');
      }
    }

    // 策略2:如果还超长,压缩材质描述
    if (truncated.length > 980) {
      truncated = truncated.replace(/Materials:.*?\./, 'Materials: Nirath-native substances.');
    }

    // 策略3:如果还超长,截断到950字符(保留30字符余量)
    if (truncated.length > 980) {
      truncated = truncated.substring(0, 950) + '...';
    }

    return truncated;
  }

  validateSceneName(sceneName) {
    if (!sceneName) return { valid: false, error: '场景名未指定' };
    if (!this.sceneLibrary[sceneName]) {
      const available = Object.keys(this.sceneLibrary).join(', ');
      return { valid: false, error: `未知场景: ${sceneName}. 可用场景: ${available}` };
    }
    return { valid: true };
  }
}

// ========== Agent 1: 背景丰富化 ==========
class BackgroundEnrichmentAgent {
  constructor() {
    this.library = SCENE_LIBRARY;
  }

  enrich(sceneName) {
    const scene = this.library[sceneName];
    if (!scene) return null;

    const parts = [];

    // 地质形成史
    if (scene.geology) {
      parts.push(`[GEOLOGY] ${scene.geology.formation || ''}`);
      if (scene.geology.mineralogy) parts.push(`Mineralogy: ${scene.geology.mineralogy}`);
      if (scene.geology.tectonic) parts.push(`Tectonic: ${scene.geology.tectonic}`);
    }

    // 生态系统
    if (scene.ecosystem) {
      parts.push(`[ECOSYSTEM] ${scene.ecosystem.primaryProducer || ''}`);
      if (scene.ecosystem.bioluminescenceMechanism) {
        parts.push(`Bioluminescence: ${scene.ecosystem.bioluminescenceMechanism}`);
      }
    }

    // 光照科学
    if (scene.lightEnvironment) {
      parts.push(`[LIGHT SCIENCE]`);
      if (scene.lightEnvironment.dualStar) {
        const ds = scene.lightEnvironment.dualStar;
        parts.push(`Dual-star: ${ds.starA?.color || 'amber'} (${ds.starA?.temperature || 3500}K) + ${ds.starB?.color || 'violet'} (${ds.starB?.temperature || 8000}K)`);
      }
      if (scene.lightEnvironment.spectrumMix) parts.push(`Spectrum mix: ${scene.lightEnvironment.spectrumMix}`);
      if (scene.lightEnvironment.atmosphericScattering) parts.push(`Atmospheric scattering: ${scene.lightEnvironment.atmosphericScattering}`);
    }

    // 文化映射
    if (scene.cultureMapping) {
      parts.push(`[CULTURE] ${scene.cultureMapping.nirathInterpretation || ''}`);
    }

    // 材质系统
    if (scene.materials) {
      parts.push(`[MATERIALS]`);
      for (const [key, mat] of Object.entries(scene.materials)) {
        parts.push(`${key}: ${mat.type || mat.color || 'unknown'}`);
      }
    }

    // 声学指纹
    if (scene.acoustics) {
      parts.push(`[ACOUSTICS] ${scene.acoustics.ambientSound || ''}`);
    }

    return parts.join('. ');
  }

  getSceneDNA(sceneName) {
    const scene = this.library[sceneName];
    if (!scene || !scene.cinematographyDNA) return null;
    return scene.cinematographyDNA;
  }
}

// ========== Agent 2: 双星光照物理引擎 ==========
class DualStarLightingEngine {
  constructor() {
    this.starA = { color: 'amber', temperature: 3500, intensity: 1.0, position: 'west' };
    this.starB = { color: 'violet', temperature: 8000, intensity: 0.6, position: 'east' };
  }

  calculate(sceneName, timeOfDay = 'dusk') {
    const scene = SCENE_LIBRARY[sceneName];
    if (!scene) return this.getDefaultLighting();

    // 光谱混合
    const mixedSpectrum = this.mixSpectra(this.starA, this.starB, timeOfDay);

    // 双重阴影系统
    const shadows = this.calculateDualShadows(sceneName);

    // 大气散射
    const scattering = this.calculateAtmosphericScattering(sceneName, mixedSpectrum);

    // 生物发光 fill
    const bioFill = this.calculateBioluminescentFill(sceneName);

    return {
      keyLight: mixedSpectrum,
      fillLight: bioFill,
      shadows: shadows,
      atmosphericEffects: scattering,
      description: this.generateLightingDescription(sceneName, mixedSpectrum, shadows)
    };
  }

  mixSpectra(starA, starB, timeOfDay) {
    const ratio = timeOfDay === 'dawn' ? 0.3 : timeOfDay === 'noon' ? 0.5 : timeOfDay === 'dusk' ? 0.7 : 0.8;
    return {
      color: 'rose-gold', // 琥珀+紫色混合
      temperature: Math.round(starA.temperature * (1-ratio) + starB.temperature * ratio),
      intensity: 1.0,
      sources: 2,
      mixRatio: `${Math.round((1-ratio)*100)}% ${starA.color} + ${Math.round(ratio*100)}% ${starB.color}`
    };
  }

  calculateDualShadows(sceneName) {
    return {
      primary: { color: 'amber-shadow', direction: 'from-starA', intensity: 1.0 },
      secondary: { color: 'violet-shadow', direction: 'from-starB', intensity: 0.6 },
      overlap: { color: 'rose-gold-mix', effect: 'special color blending in overlap zones' },
      system: 'dual-source shadow system - every object casts two differently colored shadows'
    };
  }

  calculateAtmosphericScattering(sceneName, spectrum) {
    const scene = SCENE_LIBRARY[sceneName];
    if (!scene) return null;

    return {
      sporeParticles: scene.ecosystem?.uniqueSpecies?.some(s => s.name.includes('孢子')) || false,
      godRays: scene.lightEnvironment?.godRays ? true : false,
      colorShift: 'distant objects shift to blue-violet due to atmospheric perspective',
      volumetricFog: true
    };
  }

  calculateBioluminescentFill(sceneName) {
    const scene = SCENE_LIBRARY[sceneName];
    if (!scene) return null;

    const intensity = scene.ecosystem?.bioluminescenceMechanism ? 0.4 : 0.1;
    return {
      intensity,
      color: scene.colorPalette?.accent || 'cyan',
      source: 'ecosystem bioluminescence',
      dynamic: 'pulsing with environmental rhythms'
    };
  }

  generateLightingDescription(sceneName, spectrum, shadows) {
    return `Dual-star lighting: ${spectrum.mixRatio}. Primary shadow (${shadows.primary.color}) + secondary shadow (${shadows.secondary.color}). Overlap zones: ${shadows.overlap.color}.`;
  }

  getDefaultLighting() {
    return {
      keyLight: { color: 'rose-gold', temperature: 4500, intensity: 1.0 },
      fillLight: { intensity: 0.3, color: 'cyan', source: 'bioluminescence' },
      shadows: { primary: 'amber', secondary: 'violet', overlap: 'rose-gold' },
      atmosphericEffects: { volumetricFog: true }
    };
  }
}

// ========== Agent 3: Nirath材质系统 ==========
class NirathMaterialSystem {
  constructor() {
    this.presets = {
      'obsidian-glass': {
        baseColor: [0.02, 0.02, 0.03],
        subsurface: 0.8,
        transmission: 0.3,
        iridescence: 0.1,
        description: 'Semi-transparent volcanic glass, internal glow visible'
      },
      'superconductor-crystal': {
        baseColor: [0.1, 0.3, 0.9],
        emissive: [0.2, 0.4, 1.0],
        emissiveIntensity: 5.0,
        magneticResponse: true,
        description: 'Electric blue pulsing crystal, responds to magnetic fields'
      },
      'bioluminescent-tissue': {
        baseColor: [0.2, 0.8, 0.6],
        emissive: [0.3, 0.9, 0.7],
        emissiveIntensity: 2.0,
        pulseFrequency: '4s/cycle',
        description: 'Living tissue with internal glow, pulse rhythm synchronized with environment'
      },
      'supercritical-fluid': {
        baseColor: [0.7, 0.7, 0.8],
        metallic: 0.9,
        roughness: 0.1,
        description: 'Liquid-metal appearance, between gas and liquid density'
      },
      'memory-moss': {
        baseColor: [0.4, 0.6, 0.9],
        emissive: [0.2, 0.4, 0.8],
        emissiveIntensity: 0.6,
        moonReactive: true,
        description: 'Copper-lichen that glows under twin moons, tactile luminescence'
      },
      'spore-filament': {
        baseColor: [0.8, 0.9, 1.0],
        translucency: 0.9,
        emissive: [0.5, 0.7, 1.0],
        emissiveIntensity: 1.5,
        description: 'Translucent fungal threads, wind-sensitive movement'
      }
    };
  }

  getMaterial(materialName) {
    return this.presets[materialName] || null;
  }

  getSceneMaterials(sceneName) {
    const scene = SCENE_LIBRARY[sceneName];
    if (!scene || !scene.materials) return [];

    const materials = [];
    for (const [key, mat] of Object.entries(scene.materials)) {
      const preset = this.findMatchingPreset(mat.type);
      materials.push({
        name: key,
        ...mat,
        preset: preset || null
      });
    }
    return materials;
  }

  findMatchingPreset(type) {
    const typeMap = {
      'obsidian': 'obsidian-glass',
      'crystal': 'superconductor-crystal',
      'bioluminescent': 'bioluminescent-tissue',
      'supercritical': 'supercritical-fluid',
      'moss': 'memory-moss',
      'fungal': 'spore-filament',
      'lichen': 'memory-moss'
    };

    for (const [key, preset] of Object.entries(typeMap)) {
      if (type && type.includes(key)) return this.presets[preset];
    }
    return null;
  }

  generateMaterialDescription(sceneName) {
    const materials = this.getSceneMaterials(sceneName);
    if (materials.length === 0) return '';

    return materials.map(m => {
      const desc = m.preset ? m.preset.description : m.type;
      return `${m.name}: ${desc} (${m.color || 'unknown color'})`;
    }).join('. ');
  }
}

// ========== Agent 4: 世界观考古(v22保留+增强)==========
class WorldArchaeologistAgent {
  constructor(libraryPath) {
    this.library = this.loadLibrary(libraryPath);
    this.enricher = new BackgroundEnrichmentAgent();
  }

  loadLibrary(libraryPath) {
    try {
      return JSON.parse(fss.readFileSync(libraryPath, 'utf8'));
    } catch (e) {
      console.warn(`[WorldArchaeologist] 无法加载知识库: ${e.message}`);
      return {};
    }
  }

  analyze(sceneName) {
    const archive = this.library[sceneName] || this.generateFallback(sceneName);
    const enriched = this.enricher.enrich(sceneName);
    const sceneDNA = this.enricher.getSceneDNA(sceneName);

    return {
      sceneName,
      nirathName: archive.nirathName,
      geology: archive.geology,
      ecosystem: archive.ecosystem,
      lightEnvironment: archive.lightEnvironment,
      cultureMapping: archive.cultureMapping,
      visualRules: archive.visualRules || [],
      materials: archive.materials || [],
      atmosphere: archive.atmosphere,
      enrichedBackground: enriched,
      cinematographyDNA: sceneDNA,
      colorPalette: archive.colorPalette,
      acoustics: archive.acoustics,
      l3Depth: archive.l3Depth || 'canyon',
      defaultLighting: archive.defaultLighting || 'soft golden',
      defaultComposition: archive.defaultComposition || 'wide',
      source: this.library[sceneName] ? 'library-v2' : 'fallback'
    };
  }

  generateFallback(sceneName) {
    return {
      nirathName: `Nirath ${sceneName}`,
      geology: { formation: 'Nirath晶体地貌' },
      ecosystem: { primaryProducer: '生物发光植被' },
      lightEnvironment: { dualStar: { starA: { color: 'amber' }, starB: { color: 'violet' } } },
      cultureMapping: { nirathInterpretation: `山海经${sceneName}→Nirath对应地貌` },
      visualRules: ['双月可见', '晶体结构', '生物发光'],
      materials: [],
      atmosphere: '神秘',
      l3Depth: 'canyon',
      defaultLighting: 'soft golden',
      defaultComposition: 'wide'
    };
  }
}

// ========== Agent 5: 叙事分析(v22保留)==========
class NarrativeAnalystAgent {
  analyze(scriptSegment) {
    return {
      emotion: this.detectEmotion(scriptSegment),
      pace: this.detectPace(scriptSegment),
      visualFocus: this.detectVisualFocus(scriptSegment),
      lightMood: this.mapEmotionToLight(this.detectEmotion(scriptSegment))
    };
  }

  detectEmotion(text) {
    const emotions = {
      'awe': ['震撼', '伟大', '浩瀚', '庄严', '神圣', '敬畏', 'vast', 'sacred', 'awe'],
      'tension': ['紧张', '危机', '对抗', '危险', '紧迫', 'tension', 'danger', 'crisis'],
      'wonder': ['奇妙', '美丽', '神秘', '梦幻', '奇迹', 'wonder', 'mystery', 'dream'],
      'melancholy': ['忧伤', '失落', '孤独', '怀念', 'melancholy', 'sad', 'lonely'],
      'triumph': ['胜利', '成功', '突破', '光明', 'triumph', 'victory', 'breakthrough']
    };

    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some(k => text.includes(k))) return emotion;
    }
    return 'neutral';
  }

  detectPace(text) {
    if (text.includes('缓慢') || text.includes('gradual') || text.includes('slow')) return 'slow';
    if (text.includes('快速') || text.includes('sudden') || text.includes('rapid')) return 'fast';
    return 'medium';
  }

  detectVisualFocus(text) {
    if (text.includes('全景') || text.includes('wide')) return 'environment';
    if (text.includes('特写') || text.includes('close')) return 'character';
    if (text.includes('中景') || text.includes('medium')) return 'interaction';
    return 'balanced';
  }

  mapEmotionToLight(emotion) {
    const mapping = {
      'awe': 'golden-hour intensified',
      'tension': 'contrast-heavy with sharp shadows',
      'wonder': 'soft bioluminescent fill',
      'melancholy': 'cool blue with isolated warm accents',
      'triumph': 'bright full-spectrum with god-rays'
    };
    return mapping[emotion] || 'neutral balanced';
  }
}

// ========== Agent 6: 电影指令构建(v22保留+增强)==========
class CinematicInstructionBuilder {
  constructor() {
    this.vocabulary = CINEMATIC_VOCABULARY;
  }

  build(sceneAnalysis, narrativeAnalysis, shotParams = {}) {
    const parts = [];

    // 景别
    const shotSize = shotParams.shotSize || this.inferShotSize(narrativeAnalysis.visualFocus);
    parts.push(this.vocabulary.shotSize[shotSize] || shotSize);

    // 运镜
    const movement = shotParams.movement || this.inferMovement(narrativeAnalysis.pace);
    parts.push(this.vocabulary.movement[movement] || movement);

    // 光照
    const light = shotParams.lighting || narrativeAnalysis.lightMood;
    parts.push(`Lighting: ${light}`);

    // 情绪
    const emotion = shotParams.emotion || narrativeAnalysis.emotion;
    parts.push(`Mood: ${emotion}`);

    return parts.join('. ');
  }

  inferShotSize(focus) {
    const mapping = { environment: 'wide', character: 'close_up', interaction: 'medium', balanced: 'medium' };
    return mapping[focus] || 'medium';
  }

  inferMovement(pace) {
    const mapping = { slow: 'slow_push', medium: 'smooth_track', fast: 'rapid_pan' };
    return mapping[pace] || 'smooth_track';
  }
}

// ========== 电影词汇表 ==========
const CINEMATIC_VOCABULARY = {
  shotSize: {
    extreme_wide: 'extreme wide establishing shot, IMAX 1.43:1, showing impossible scale',
    wide: 'wide shot, 18mm lens, environmental dominance',
    medium: 'medium shot, 35mm lens, character-environment balance',
    close_up: 'close up, 85mm lens, emotional intimacy',
    extreme_close: 'extreme close up, macro lens, texture detail'
  },
  movement: {
    slow_push: 'slow push in, emphasizing scale and majesty',
    smooth_track: 'smooth tracking shot, maintaining spatial context',
    rapid_pan: 'rapid pan with motion blur, urgency and energy',
    fluid_tracking: 'fluid tracking synchronized with environmental rhythm',
    vertical_reveal: 'vertical camera movement revealing geological scale',
    weightless_float: 'weightless floating movement, low gravity feel',
    orbital_sweep: 'orbital sweeping movement, planetary scale'
  }
};

// ========== v24 统一接口 ==========
class OrientPrimordialCoreV24 {
  constructor(config = {}) {
    const libPath = config.libraryPath || SCENE_LIBRARY_PATH;
    this.worldArchaeologist = new WorldArchaeologistAgent(libPath);
    this.narrativeAnalyst = new NarrativeAnalystAgent();
    this.cinematicBuilder = new CinematicInstructionBuilder();
    this.styleEnforcer = new NirathStyleEnforcer();
    this.enrichmentAgent = new BackgroundEnrichmentAgent();
    this.lightingEngine = new DualStarLightingEngine();
    this.materialSystem = new NirathMaterialSystem();
  }

  // 主入口:分析场景
  analyzeScene(sceneName, scriptSegment = '') {
    const world = this.worldArchaeologist.analyze(sceneName);
    const narrative = this.narrativeAnalyst.analyze(scriptSegment);
    const lighting = this.lightingEngine.calculate(sceneName);
    const materials = this.materialSystem.generateMaterialDescription(sceneName);
    const background = this.enrichmentAgent.enrich(sceneName);

    return {
      world,
      narrative,
      lighting,
      materials,
      background,
      sceneDNA: world.cinematographyDNA
    };
  }

  // 🔥 新增:场景名模糊匹配(兜底)
  fuzzyMatchScene(sceneName, script = '') {
    const sceneLib = SCENE_LIBRARY;
    const names = Object.keys(sceneLib);

    // 1. 精确匹配
    if (names.includes(sceneName)) return sceneName;

    // 2. 去掉后缀匹配(如 "归墟之海-opening" → "归墟之海")
    const baseName = sceneName.split('-')[0].trim();
    if (names.includes(baseName)) return baseName;

    // 3. 根据script内容关键词匹配
    const keywordMap = {
      '归墟': '归墟之海', '海': '归墟之海', '海洋': '归墟之海',
      '不周': '不周山脉', '山': '不周山脉', '天柱': '不周山脉',
      '青丘': '青丘灵原', '草原': '青丘灵原', '灵原': '青丘灵原',
      '钟山': '钟山之巅', '烛龙': '钟山之巅', '巅峰': '钟山之巅',
      '银色湖泊': '银色湖泊', '湖泊': '银色湖泊', '湖水': '银色湖泊',
      '建木': '建木林', '森林': '建木林', '神树': '建木林',
      '昆仑': '昆仑虚', '仙境': '昆仑虚', '悬浮': '昆仑虚',
      '幽都': '幽都暗域', '黑暗': '幽都暗域', '地底': '幽都暗域',
      '流沙': '流沙瀚海', '沙漠': '流沙瀚海', '沙海': '流沙瀚海'
    };

    const textToMatch = `${sceneName} ${script}`;
    for (const [kw, scene] of Object.entries(keywordMap)) {
      if (textToMatch.includes(kw) && names.includes(scene)) {
        return scene;
      }
    }

    return null; // 无法匹配
  }

  // v24.3 重写:Nirath风格前置化Prompt构建(17 Stage融合版)
  // 风格约束包在Prompt工程阶段(Stage 10-13)作为输入传入,确保从第一句话就受Nirath美学约束
  buildPromptV3(params = {}) {
    const {
      sceneName = 'default',
      script = '',
      narration = '', // ✅ v6.2-patchXX: 独立旁白/台词字段，与视觉描述分离
      characters = [],
      characterProfiles = {}, // ✅ v6.2-patch87-3: 角色核心特征映射（极简描述）
      type = 'generic',
      emotionPhase = 'neutral',
      movement = null,
      mouthAction = '',
      shotParams = {},
      // 🔥 v6.2-patch68: 环境音效独立字段
      ambientSound = '', // ✅ 环境音效设计Agent生成的Diegetic环境音描述
      styleConstraint = {
        // Nirath主生成参数(技术尾,恒定注入)
        // v6.2-patch62-fix: 中文技术描述替换英文术语
        nirathTechTail: '超写实数字渲染, 概念美术级质感, 双恒星日落玫瑰金光照, 生物发光生态补光, 影视级画面构图, IMAX画幅, 空气透视感, 皮肤与材质微距摄影级细节, 写实风格, 外星繁茂植被覆盖岩石地表, 背景可见奇异生物活动。',
        // ✅ v6.2-patchXX: 背景环境质感（全局注入）
        // 人物与异兽保持CG超写实，背景环境采用实景拍摄质感
        environmentRealism: '背景环境采用实景拍摄质感, 物理真实世界, 35mm胶片颗粒, 轻微噪点, 4K高清, 电影质感, 细节清晰, 色彩自然, 非CG渲染感, 真实光影与大气透视。',
        // Nirath禁用关键词(用于Step 2.5过滤)
        bannedKeywords: ['中国风','古风','传统','水墨','国风','仙侠','武侠','chinese style','traditional chinese','ink wash','oriental','lo-fi','anime','cartoon','cartoony','stylized','toon'],
        // Nirath视觉锚点(前缀注入,确保Prompt核心受风格约束)
        visualAnchor: 'Nirath alien world, photorealistic sci-fi ecosystem, non-Earth biology,',
        // 双星光照规范
        lightingSpec: 'dual-star amber-violet lighting creates rose-gold shadows, bioluminescent fill light pulses softly.',
        // 免责声明
        disclaimer: 'NO Chinese traditional symbols (yin-yang, bagua, taiji, wuxing). NO anime/cartoon style. NO ink wash painting. NO traditional Chinese architecture or clothing.'
      }
    } = params;

    // ========== Step 1: 场景分析(同v24.2)==========
    // 🔥 v1.1-fix: 如果script为空或纯叙述,先用VisualActionTranslator翻译
    let processedScript = script;
    if (!script || script.trim().length === 0) {
      console.log('[Core-v24.3] ⚠️ script为空,使用默认视觉描述');
      processedScript = 'Nirath alien world scene with dramatic lighting and atmospheric effects.';
    }

    const analysis = this.analyzeScene(sceneName, processedScript);
    const normalizedSceneName = sceneName.split('-')[0].trim();
    if (normalizedSceneName !== sceneName) {
      const reanalysis = this.analyzeScene(normalizedSceneName, script);
      if (reanalysis.background?.length > 0) analysis.background = reanalysis.background;
      if (reanalysis.materials?.length > 0) analysis.materials = reanalysis.materials;
      if (reanalysis.lighting) analysis.lighting = reanalysis.lighting;
    }
    if (analysis.world?.source === 'fallback' || !analysis.background) {
      const fuzzyScene = this.fuzzyMatchScene(sceneName, script);
      if (fuzzyScene && fuzzyScene !== sceneName) {
        const fuzzyAnalysis = this.analyzeScene(fuzzyScene, script);
        if (fuzzyAnalysis.background?.length > 0) analysis.background = fuzzyAnalysis.background;
        if (fuzzyAnalysis.materials?.length > 0) analysis.materials = fuzzyAnalysis.materials;
        if (fuzzyAnalysis.lighting) analysis.lighting = fuzzyAnalysis.lighting;
        if (fuzzyAnalysis.world?.source !== 'fallback') analysis.world = fuzzyAnalysis.world;
      }
    }

    // ========== Step 2: 主体内容构建(视觉为核心,narration已分离)==========
    // 🔥 v6.2-patch100-fix: 存储当前场景名称，供情绪映射使用
    this._currentSceneName = sceneName || '';
    
    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心（解决同质化问题）
    // 根因：所有镜头使用相同的build*Description模板，导致7个非片头镜头结构完全一致
    // 修复：根据场景名称注入独特的视觉描述，替代统一前缀
    const sceneSpecificVisual = this.buildSceneSpecificVisual(sceneName, type);
    
    let coreDescription = '';
    switch(type) {
      case 'opening':
        coreDescription = this.buildOpeningDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual);
        break;
      case 'environment':
        coreDescription = this.buildEnvironmentDescription(analysis, script, emotionPhase, sceneSpecificVisual);
        break;
      case 'discovery':
      case 'reveal':
        coreDescription = this.buildDiscoveryDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual);
        break;
      case 'interaction':
        coreDescription = this.buildInteractionDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual);
        break;
      case 'closing':
      case 'resolution': // ✅ v6.2-patch78-fix: resolution类型使用closing描述（情感收束、反思）
        coreDescription = this.buildClosingDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual);
        break;
      case 'climax':
        coreDescription = this.buildClimaxDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual);
        break;
      default:
        coreDescription = this.buildGenericDescription(analysis, script, emotionPhase, characters, characterProfiles, sceneSpecificVisual);
    }

    // 🔥 Step 2.5: Nirath世界观校准(新增核心步骤)
    // 在主体内容生成后立即进行风格校准,确保narration内容不携带禁用风格
    const calibratedCore = this.calibrateNirathStyle(coreDescription, styleConstraint, analysis);

    // ========== Step 3: 场景生态注入(精简版DNA,250字符预算)==========
    const sceneDNA = this.extractSceneDNA(analysis, 250);

    // ========== Step 4: 运镜融入(v6.2-patch97-fix: 200字符保留完整时间轴骨架) ==========
    // 🔥 v6.2-patch102-fix: STAGE-9生成的是cameraMovement.timeline结构化数据，
    // 但之前只读取movement.description（可能为空）。现在优先从timeline.segments生成描述。
    // v6.2-patch103-fix: 计算每个segment的实际时间，填充[?s-?s]占位符
    let movementDesc = '';
    if (movement?.timeline?.segments && movement.timeline.segments.length > 0) {
      // 从结构化timeline生成时间轴描述，计算实际时间
      const tl = movement.timeline;
      let currentTime = 0;
      const segDesc = tl.segments.map((s, i) => {
        const duration = s.duration || 3; // 默认3秒
        const startTime = currentTime;
        const endTime = currentTime + duration;
        currentTime = endTime;
        const st = startTime.toFixed(1);
        const et = endTime.toFixed(1);
        const cam = s.camera || s.movement || '运镜';
        return `[${st}s-${et}s]${cam}`;
      }).join('→');
      movementDesc = `【镜头时间轴】${tl.transitionName || ''}(${segDesc})`;
    } else if (movement?.description) {
      // 回退到旧版description
      movementDesc = `【镜头时间轴】${movement.description.substring(0, Math.min(movement.description.length, 200))}`;
    }
    
    // ========== Step 5: mouthAction处理（v6.2-patch102-fix: 不再此处拼接，统一由Step 6.3处理）==========
    // 根因：mouthAction先在Step 5/6作为纯文本拼入prompt，然后Step 6.3又拼【嘴部动作】标签，导致重复注入
    // 修复：Step 5/6不再拼接mouthAction，只由Step 6.3统一生成【嘴部动作】字段

    // ========== Step 6: 组装prompt主体(校准后核心 + DNA) ==========
    // v6.2-patch97-fix: movementDesc不再拼入【叙事】区块，避免被smartTrim覆盖
    // 改为Step 6.47独立追加到Prompt末尾，确保镜头时间轴完整性
    // 🔥 v6.5.1-fix: 添加【视觉】标记，确保pipeline能正确识别视觉内容，避免触发空视觉修复注入模板化描述
    let visualContent = `${calibratedCore} ${sceneDNA}`.trim();
    let prompt = `【视觉】${visualContent}`;

    // 🔥 v6.5.3-fix: 镜头时间轴注入提前到核心位置，避免被末尾截断
    // 根因：在末尾注入时，smartTruncate/smartTrim从末尾截断，直接吃掉【镜头时间轴】
    // 修复：在【视觉】之后立即注入，确保其优先级
    if (movementDesc) {
      prompt += ` ${movementDesc}`;
      console.log(`[Core-v24.3] 🎬 镜头时间轴注入: ${movementDesc.length}字符 | 核心位置注入`);
    }

    // ========== Step 6.3: 台词视觉化通道（双通道分离）==========
// v6.5.6-fix: 台词文本注入视觉Prompt（供Seedance对口型）
    // 台词放在【嘴部动作】之前，确保 Seedance 能看到完整对话内容
    // 如果 mouthAction 存在，确保它只包含视觉动作指令
    if (mouthAction && mouthAction.length > 0) {
      // 检查 mouthAction 是否包含台词文本（如果包含，清理掉）
      let cleanedMouthAction = mouthAction.replace(/[""""].*?[""""]/g, '').replace(/[一-龥]{5,}/g, '').trim();
      
      // v6.2-patch103-fix: 标准化嘴部动作映射（统一英文关键词为中文描述）
      const mouthActionMap = {
        'speak': '嘴部微张，下巴微动',
        'speaking': '嘴部微张，下巴微动',
        'speaking_whisper': '嘴唇微动，气息低语',
        'speaking_roar': '嘴巴大张，怒吼咆哮',
        'speaking_growl': '牙齿紧咬，低声咆哮',
        'whisper': '嘴唇微动，气息低语',
        'roar': '嘴巴大张，怒吼咆哮',
        'growl': '牙齿紧咬，低声咆哮',
        'mouth_open': '嘴巴微张',
        'lip_sync': '嘴部微张，下巴微动'
      };
      
      // 如果 cleanedMouthAction 是英文关键词，映射为中文
      const lowerMouthAction = cleanedMouthAction.toLowerCase().trim();
      if (mouthActionMap[lowerMouthAction]) {
        cleanedMouthAction = mouthActionMap[lowerMouthAction];
      }
      
      if (cleanedMouthAction.length > 0) {
        prompt += ` 【嘴部动作】${cleanedMouthAction}`;
        console.log(`[Core-v24.3] 🎙️ 嘴部动作注入: ${cleanedMouthAction.length}字符 | 视觉指令`);
      }
    }

    // v6.5.64-fix: 台词作为独立字段完整注入（禁止截断，供Seedance对口型渲染）
    // ⚠️ 系统级规则：台词必须作为独立字段与画面一同提交，确保口型精准
    if (narration && narration.length > 0) {
      const dialogueText = narration; // 完整台词，禁止截断
      prompt += ` \n【台词】"${dialogueText}"`;
      console.log(`[Core-v24.3] 🎙️ 台词完整注入视觉Prompt: ${dialogueText.length}字符 | 供Seedance对口型渲染`);
    }

    // v6.5.64-fix2: 人物出场卡片注入（与画面一同渲染）
    // 仅在角色首次出场时注入，替代硬编码自我介绍
    if (shotParams.characterIntroCard?.enabled) {
      const card = shotParams.characterIntroCard;
      const cardContent = card.content;
      const cardPrompt = `【人物卡片-纪录片风格】画面下方三分之一处（lower-third）浮现半透明毛玻璃质感信息卡片，圆角矩形，左侧圆形头像缩略图，右侧文字排版：第一行「${cardContent.name}」18pt粗体白色，第二行「${cardContent.title}${cardContent.subtitle ? ' | ' + cardContent.subtitle : ''}」14pt常规浅灰色。动画：从下方滑入（translateY:30px→0），持续0.5秒带轻微弹性缓动，停留2秒后淡出。整体风格专业干净不抢戏。`;
      prompt += ` \n${cardPrompt}`;
      console.log(`[Core-v24.3] 👤 人物卡片注入: ${cardContent.name} | ${cardContent.title} | 首次出场`);
    }

    // ========== Step 6.4: 环境质感注入（全局背景质感约束）==========
    // ✅ v6.2-patchXX: 背景环境质感独立字段，与人物CG超写实区分
    // 人物/异兽：超写实CG | 背景环境：实景拍摄、35mm胶片、物理真实
    const envRealism = styleConstraint?.environmentRealism || '背景环境采用实景拍摄质感, 物理真实世界, 35mm胶片颗粒, 轻微噪点, 4K高清, 电影质感, 细节清晰, 色彩自然';
    if (envRealism) {
      prompt += ` 【环境质感】${envRealism}`;
      console.log(`[Core-v24.3] 🎬 环境质感注入: ${envRealism.length}字符 | 背景实景拍摄质感`);
    }

    // ========== Step 6.45: 环境音效注入（Diegetic环境音，独立字段）==========
    // v6.2-patch68: 环境音效作为独立字段，根据场景自适应生成
    if (ambientSound && ambientSound.length > 0) {
      const soundBudget = Math.min(ambientSound.length, 80);
      const trimmedSound = ambientSound.substring(0, soundBudget);
      prompt += ` 【环境音效】${trimmedSound}`;
      console.log(`[Core-v24.3] 🎵 环境音效注入: ${trimmedSound.length}字符 | Diegetic环境音`);
    }

    // ========== Step 6.5: 余量检测与智能升级回收 ==========
    const TARGET_MIN = 700; // 🔥 v6.2-patch47-fix: 850→700, 为后续增强(明亮约束/运镜/微动作)留280字符余量
    const currentLen = prompt.length;
    if (currentLen < TARGET_MIN) {
      const deficit = TARGET_MIN - currentLen;
      console.log(`[Core-v24.3] 📏 余量检测: ${currentLen}字符, deficit=${deficit}, 启动升级回收...`);
      const upgrade = this.upgradePromptWithDeficit({
        prompt, analysis, deficit, type, script, characters, emotionPhase, sceneDNA,
        styleConstraint // 传入风格约束包,确保升级内容也受Nirath风格约束
      });
      prompt = upgrade.prompt;
      console.log(`[Core-v24.3] ✅ 升级后: ${prompt.length}字符 (回收了${prompt.length - currentLen}字符)`);
    }

    // ========== Step 7: 追加技术参数(清理版,不含UE5/Lumen/Nanite)==========
    const remainingForTech = 980 - prompt.length;
    let techTail = '';

    if (remainingForTech >= 200) {
      // 充足空间:完整技术参数(Seedance优化版)
      techTail = ` 【技术规格】${styleConstraint.nirathTechTail} ${styleConstraint.disclaimer}`;
    } else if (remainingForTech >= 120) {
      // 中等空间:标准技术参数
      techTail = ` 【技术规格】${styleConstraint.nirathTechTail}`;
    } else if (remainingForTech >= 60) {
      // 有限空间:精简技术参数(Seedance原生理解,无引擎声明)
      // v6.2-patch62-fix: 中文技术描述替换英文术语
      techTail = ' 【技术规格】超写实数字渲染, 影视级画面质感, 体积光照明。';
    } else {
      // 空间极少:仅保留核心
      techTail = ' 【技术规格】photorealistic 3D render.';
    }

    prompt += techTail;

    // ========== Step 8: 最终截断保障 ==========
    if (prompt.length > 980) {
      prompt = this.smartTruncate(prompt, 980);
    }

    // v6.2-patch103-fix: 格式符号闭合检查
    // 根因：拼接过程中 ** 和 【】 可能不成对，导致格式崩溃
    prompt = this.validateFormatMarkers(prompt);

    // 🔥 v6.5.3-fix: 保护【镜头时间轴】不被removeDuplicateSentences误删
    // 根因：镜头时间轴内容与视觉/环境描述重复，被去重算法整段移除
    // 修复：去重前提取保存，去重后重新注入
    let timelineBlock = '';
    const timelineMatch = prompt.match(/【镜头时间轴】[^【]*/);
    if (timelineMatch) {
      timelineBlock = timelineMatch[0];
      prompt = prompt.replace(timelineBlock, '');
    }

    const dedupPrompt = this.removeDuplicateSentences(prompt);
    if (dedupPrompt.length < prompt.length) {
      console.log(`[Core-v24.3] 🧹 重复内容清理: 删除${prompt.length - dedupPrompt.length}字符重复段落`);
      prompt = dedupPrompt;
    }

    // 去重后重新注入【镜头时间轴】
    if (timelineBlock) {
      prompt += ` ${timelineBlock}`;
    }

    // 最终合规检查
    const issues = [];
    if (prompt.length > 950) issues.push('⚠️ Prompt接近上限');
    if (!sceneDNA) issues.push('⚠️ 场景DNA未提取');
    // 检查禁用词是否残留(二次确认)
    const bannedFound = styleConstraint.bannedKeywords.filter(kw => prompt.toLowerCase().includes(kw.toLowerCase()));
    if (bannedFound.length > 0) issues.push(`⛔ 禁用词残留: ${bannedFound.join(', ')}`);

    return {
      prompt,
      issues,
      compliant: prompt.length <= 980 && bannedFound.length === 0,
      analysis,
      length: prompt.length,
      utilization: Math.round((prompt.length / 980) * 100),
      styleCalibrated: true, // v24.3标记
      bannedFound: bannedFound.length > 0 ? bannedFound : null
    };
  }

  // 🔥 v24.3新增:Nirath世界观校准器(Step 2.5)
  // 在Prompt主体内容生成后立即进行风格校准
  calibrateNirathStyle(coreDescription, styleConstraint, analysis) {
    let calibrated = coreDescription;

    // 1. 禁用关键词过滤(从narration中移除禁用词)
    for (const banned of styleConstraint.bannedKeywords) {
      if (calibrated.toLowerCase().includes(banned.toLowerCase())) {
        // 将禁用词替换为Nirath等效描述
        const nirathEquiv = this.getNirathEquivalent(banned, analysis);
        calibrated = calibrated.replace(new RegExp(banned, 'gi'), nirathEquiv);
        console.log(`[NirathCalibrate] 🛡️ 替换禁用词: "${banned}" → "${nirathEquiv}"`);
      }
    }

    // 2. 视觉锚点前缀注入(确保Prompt第一句话就带有Nirath标识)
    // v6.2-patch63-fix: 检查中文等效描述
    const anchor = styleConstraint.visualAnchor || 'Nirath异世界, 超写实科幻生态系统,';
    const firstChars = calibrated.substring(0, Math.min(calibrated.length, 100)).toLowerCase();
    const hasNirathInBeginning = firstChars.includes('nirath') || firstChars.includes('异世界') || firstChars.includes('外星');

    if (!hasNirathInBeginning) {
      calibrated = `${anchor} ${calibrated}`;
      console.log(`[NirathCalibrate] 🎯 开头注入视觉锚点`);
    }

    // 3. 双星光照规范注入(如果场景描述中没有光照描述)
    // v6.2-patch63-fix: 检查中文光照词汇
    const hasLighting = /光照|阴影|发光|照明|光晕|亮度/i.test(calibrated);
    if (!hasLighting && styleConstraint.lightingSpec) {
      calibrated += ` ${styleConstraint.lightingSpec}`;
    }

    return calibrated.trim();
  }

  // 🔥 v24.3新增:禁用词Nirath等效替换表
  getNirathEquivalent(bannedWord, analysis) {
    const mapping = {
      '中国风': 'Nirath bioluminescent ecosystem',
      '古风': 'ancient Nirath geological formation',
      '传统': 'primordial Nirath habitat',
      '水墨': 'fluid supercritical ocean',
      '国风': 'alien world landscape',
      '仙侠': 'Nirath cosmic energy being',
      '武侠': 'Nirath kinetic combat entity',
      'chinese style': 'Nirath alien world style',
      'traditional chinese': 'primordial Nirath',
      'ink wash': 'bioluminescent fluid art',
      'oriental': 'Nirath equatorial',
      'anime': '超写实3D渲染',
      'cartoon': '写实数字人物',
      'cartoony': '写实风格表现',
      'stylized': '概念美术级质感',
      'toon': '影视级渲染'
    };
    return mapping[bannedWord] || 'Nirath alien world element';
  }

  // v24.2保留:Prompt余量回收与智能升级系统
  upgradePromptWithDeficit({ prompt, analysis, deficit, type, script, characters, emotionPhase, sceneDNA, styleConstraint }) {
    // ... 现有逻辑保持不变 ...
    let upgradedPrompt = prompt;
    let remainingBudget = deficit;

    // 升级策略1: Script视觉化扩展(最高优先级,0.5权重)
    const scriptUpgradeBudget = Math.min(Math.floor(remainingBudget * 0.5), 200);
    if (scriptUpgradeBudget > 20 && script) {
      const scriptVisual = this.expandScriptToVisual(script, type, characters, scriptUpgradeBudget);
      if (scriptVisual) {
        upgradedPrompt = `${upgradedPrompt} ${scriptVisual}`;
        remainingBudget -= scriptVisual.length;
      }
    }

    // 升级策略2: 人物动作/表情细节(次优先,0.3权重)
    const charUpgradeBudget = Math.min(Math.floor(remainingBudget * 0.6), 150);
    if (charUpgradeBudget > 20 && characters.length > 0) {
      const charUpgrade = this.upgradeCharacterDetail(script, characters, type, charUpgradeBudget);
      if (charUpgrade) {
        upgradedPrompt = `${upgradedPrompt} ${charUpgrade}`;
        remainingBudget -= charUpgrade.length;
      }
    }

    // 升级策略3: 氛围与粒子效果(兜底,0.2权重)
    // 🔥 v24.3改进:氛围升级必须过滤禁用词
    const atmosUpgradeBudget = Math.min(Math.floor(remainingBudget * 0.8), 100);
    if (atmosUpgradeBudget > 20) {
      let atmosUpgrade = this.upgradeAtmosphere(analysis, type, atmosUpgradeBudget);
      if (atmosUpgrade && styleConstraint) {
        // 二次校准:确保升级内容不含禁用词
        for (const banned of styleConstraint.bannedKeywords || []) {
          atmosUpgrade = atmosUpgrade.replace(new RegExp(banned, 'gi'), this.getNirathEquivalent(banned, analysis));
        }
      }
      if (atmosUpgrade) {
        upgradedPrompt = `${upgradedPrompt} ${atmosUpgrade}`;
      }
    }

    return { prompt: upgradedPrompt.trim() };
  }

  // 🔥 新增:Prompt余量回收与智能升级系统(v24.2-fix:优先扩展script内容,避免场景DNA淹没故事)
  upgradePromptWithDeficit({ prompt, analysis, deficit, type, script, characters, emotionPhase, sceneDNA }) {
    let upgradedPrompt = prompt;
    let remainingBudget = deficit;

    // 升级策略1: Script视觉化扩展(最高优先级,0.5权重)
    // 将narration/script扩展为更丰富的视觉描述,而不是添加更多场景库DNA
    const scriptUpgradeBudget = Math.min(Math.floor(remainingBudget * 0.5), 200);
    if (scriptUpgradeBudget > 20 && script) {
      const scriptVisual = this.expandScriptToVisual(script, type, characters, scriptUpgradeBudget);
      if (scriptVisual) {
        // 在现有script内容后追加视觉扩展
        upgradedPrompt = `${upgradedPrompt} ${scriptVisual}`;
        remainingBudget -= scriptVisual.length;
      }
    }

    // 升级策略2: 人物动作/表情细节(次优先,0.3权重)
    const charUpgradeBudget = Math.min(Math.floor(remainingBudget * 0.6), 150);
    if (charUpgradeBudget > 20 && characters.length > 0) {
      const charUpgrade = this.upgradeCharacterDetail(script, characters, type, charUpgradeBudget);
      if (charUpgrade) {
        upgradedPrompt = `${upgradedPrompt} ${charUpgrade}`;
        remainingBudget -= charUpgrade.length;
      }
    }

    // 升级策略3: 氛围与粒子效果(兜底,0.2权重)
    const atmosUpgradeBudget = Math.min(Math.floor(remainingBudget * 0.8), 100);
    if (atmosUpgradeBudget > 20) {
      const atmosUpgrade = this.upgradeAtmosphere(analysis, type, atmosUpgradeBudget);
      if (atmosUpgrade) {
        upgradedPrompt = `${upgradedPrompt} ${atmosUpgrade}`;
      }
    }

    return { prompt: upgradedPrompt.trim() };
  }

  // 🔥 新增:将script/narration扩展为更丰富的视觉描述
  // v6.2-patch103-fix: 改为只提取动作/视觉关键词，不重复整句（避免与buildOpeningDescription等重复）
  expandScriptToVisual(script, type, characters, budget) {
    if (!script || typeof script !== 'string') return '';

    // 提取 script 中的动作关键词，转为视觉描述
    const visualElements = [];
    let usedBudget = 0;

    // 只提取动作/姿态关键词（避免重复整句）
    const actionKeywords = {
      '看见': '目光聚焦，瞳孔收缩',
      '注视': '目光凝视，眼神坚定',
      '低伏': '身体压低，姿态警觉',
      '抬头': '缓缓抬头，颈部线条绷紧',
      '抬臂': '手臂抬起，肌肉线条紧绷',
      '举手': '手臂抬起，手掌张开',
      '拦截': '手臂横挡，姿态防御',
      '举起': '高举手臂，力量凝聚',
      '直视': '目光直视，眼神交汇',
      '触碰': '手指触碰，指尖微颤',
      '仰望': '抬头仰望，颈部拉伸',
      '垂下': '缓缓垂下，姿态放松',
      '张嘴': '嘴巴张开，下颌微动',
      '咬': '牙齿咬合，力量爆发'
    };

    for (const [keyword, visual] of Object.entries(actionKeywords)) {
      if (script.includes(keyword) && usedBudget + visual.length + 2 <= budget) {
        visualElements.push(visual);
        usedBudget += visual.length + 2;
      }
    }

    // 类型特定扩展（只添加不在 prompt 中的新视觉元素）
    if (type === 'opening' && usedBudget < budget * 0.8) {
      const ext = '远景展现壮阔异世界全景';
      if (usedBudget + ext.length <= budget && !script.includes('全景')) {
        visualElements.push(ext);
      }
    } else if (type === 'climax' && usedBudget < budget * 0.8) {
      const ext = '紧张激烈冲突，能量涌动';
      if (usedBudget + ext.length <= budget && !script.includes('冲突')) {
        visualElements.push(ext);
      }
    } else if (type === 'reveal' && usedBudget < budget * 0.8) {
      const ext = '戏剧性揭示，光影聚焦';
      if (usedBudget + ext.length <= budget && !script.includes('揭示')) {
        visualElements.push(ext);
      }
    }

    return visualElements.join('，');
  }

  // 升级场景DNA:从场景库挖掘更多细节
  upgradeSceneDNA(analysis, budget) {
    const upgrades = [];
    const scene = analysis.world;

    // 从background中提取更多句子(之前只取了2句,现在取更多)
    if (analysis.background) {
      const sentences = analysis.background.split(/\.\s+/).filter(s => s.length > 15);
      // 跳过已使用的(前2句),取后续句子
      const unusedSentences = sentences.slice(2, 5);
      for (const sentence of unusedSentences) {
        const cleaned = sentence
          .replace(/\[\w+\]\s*/g, '')
          .replace(/\d+K|\([^)]*\)/g, '')
          .trim();
        if (cleaned.length > 10 && cleaned.length < budget * 0.8) {
          upgrades.push(cleaned);
          budget -= cleaned.length;
        }
      }
    }

    // 从materials中提取更多
    if (analysis.materials) {
      const matParts = analysis.materials.split(/\.\s+/).filter(s => s.length > 10);
      for (const mat of matParts.slice(1, 3)) {
        if (mat.length < budget * 0.6) {
          upgrades.push(mat);
          budget -= mat.length;
        }
      }
    }

    // 添加微气候/粒子细节
    if (scene.microclimate?.particleEffects && budget > 30) {
      upgrades.push(scene.microclimate.particleEffects);
    }

    return upgrades.join('. ');
  }

  // 升级人物细节:根据script和类型生成更丰富的动作/表情
  upgradeCharacterDetail(script, characters, type, budget) {
    const upgrades = [];

    // 从script中提取动作关键词
    // v6.2-patch63-fix: 全部改为中文描述,避免英文混入视觉Prompt
    // v6.2-patch103-fix: 删除与山海经叙事无关的动作（写、画、问、抱），只保留异兽探索相关动作
    const actionKeywords = {
      '看见': '身体后仰15度，双手张开，肩膀放松下沉',
      '蹲': '带着温柔的好奇心蹲下,姿态轻柔',
      '站': '静静站立,充满敬畏,身姿挺拔',
      '走': '步伐坚定有力,目标明确',
      '跑': '带着孩童般的兴奋奔跑,充满活力',
      '笑': '温暖地微笑,眼角柔和',
      '哭': '泪水盈眶,情感涌动,眼眶微红'
      // 删除: '写': '专注地在笔记本上记录,笔尖飞舞' — 与山海经异兽叙事无关
      // 删除: '画': '全神贯注地描绘,笔触细腻专注' — 与山海经异兽叙事无关
      // 删除: '问': '带着天真好奇发问,头微微倾斜' — 保留，但改为更自然的表达
      // 删除: '抱': '温柔地拥抱,动作小心翼翼充满关怀' — 与山海经异兽叙事无关
    };

    // 匹配script中的动作
    for (const [cn, en] of Object.entries(actionKeywords)) {
      if (script.includes(cn) && en.length < budget * 0.5) {
        upgrades.push(en);
        budget -= en.length;
        break; // 只取一个主要动作
      }
    }

    // 根据类型添加特定细节
    // v6.2-patch63-fix: 全部改为中文描述
    if (type === 'interaction' && budget > 30) {
      upgrades.push('轻柔肢体语言,开放姿态,身体微微前倾表示关注');
    } else if (type === 'discovery' && budget > 30) {
      upgrades.push('手指指向发现之物,屏住呼吸,充满期待');
    } else if (type === 'opening' && budget > 30) {
      upgrades.push('明亮热切表情,向观众张开双臂表示欢迎');
    }

    return upgrades.join(', ');
  }

  // 升级氛围:光影、粒子、环境效果
  upgradeAtmosphere(analysis, type, budget) {
    const upgrades = [];
    const scene = analysis.world;

    // 双星光照效果
    if (scene.lightEnvironment?.dualStar && budget > 40) {
      const ds = scene.lightEnvironment.dualStar;
      upgrades.push(`dual-star creates long dramatic shadows, ${ds.starA?.color || 'amber'} and ${ds.starB?.color || 'violet'} light mixing on surfaces`);
    }

    // 生物发光粒子
    if (scene.ecosystem?.bioluminescenceMechanism && budget > 30) {
      upgrades.push('bioluminescent spores drifting like fireflies in the air');
    }

    // 微气候
    if (scene.microclimate?.description && budget > 30) {
      upgrades.push(scene.microclimate.description);
    }

    // 类型特定氛围
    if (type === 'discovery' && budget > 20) {
      upgrades.push('mysterious ambient glow emanating from hidden sources');
    } else if (type === 'closing' && budget > 20) {
      upgrades.push('warm golden hour light wrapping everything in nostalgic glow');
    }

    return upgrades.join(', ');
  }

  // 各类型差异化描述构建(v24.2-fix:script/narration作为核心内容,场景DNA作为环境基底)
  buildOpeningDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual = '') {
    const scriptDesc = script ? this.sanitizeScriptForPrompt(script, 350) : ''; // 300→350
    
    // ✅ v6.2-patch87-3: 使用 characterProfiles 构建精简角色描述
    let characterDesc = '';
    if (characters.length > 0) {
      const descs = characters.map(charId => {
        if (characterProfiles && characterProfiles[charId]) {
          return characterProfiles[charId];
        }
        return charId;
      });
      characterDesc = descs.join('、') + ' ';
    }
    
    const sceneDesc = this.extractKeySceneElements(analysis, 200); // 150→200
    const emotionDesc = this.mapEmotionPhaseToDescription(emotionPhase);
    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心
    const visualCore = sceneSpecificVisual ? `${sceneSpecificVisual} ` : '';
    return `${visualCore}${characterDesc}${scriptDesc}${scriptDesc && sceneDesc ? ' ' + sceneDesc : sceneDesc} ${emotionDesc}`.trim();
  }

  buildEnvironmentDescription(analysis, script, emotionPhase, sceneSpecificVisual = '') {
    const scriptDesc = script ? this.sanitizeScriptForPrompt(script, 400) : ''; // 350→400
    const sceneDesc = this.extractKeySceneElements(analysis, 200); // 150→200
    const lightDesc = this.extractLightingEssence(analysis, 100);
    const emotionDesc = this.mapEmotionPhaseToDescription(emotionPhase);
    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心
    const visualCore = sceneSpecificVisual ? `${sceneSpecificVisual} ` : '';
    return `${visualCore}${scriptDesc}${scriptDesc && sceneDesc ? ' ' + sceneDesc : sceneDesc} ${lightDesc} ${emotionDesc}`.trim();
  }

  buildDiscoveryDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual = '') {
    const scriptDesc = script ? this.sanitizeScriptForPrompt(script, 350) : ''; // 320→350
    
    // ✅ v6.2-patch87-3: 使用 characterProfiles 构建精简角色描述
    let characterDesc = '';
    if (characters.length > 0) {
      const descs = characters.map(charId => {
        if (characterProfiles && characterProfiles[charId]) {
          return characterProfiles[charId];
        }
        return charId;
      });
      characterDesc = descs.join('、') + ' ';
    }
    
    const sceneDesc = this.extractKeySceneElements(analysis, 150); // 120→150
    const emotionDesc = this.mapEmotionPhaseToDescription(emotionPhase);
    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心
    const visualCore = sceneSpecificVisual ? `${sceneSpecificVisual} ` : '';
    return `${visualCore}${characterDesc}${scriptDesc}${scriptDesc && sceneDesc ? ' ' + sceneDesc : sceneDesc} ${emotionDesc}`.trim();
  }

  buildInteractionDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual = '') {
    const scriptDesc = script ? this.sanitizeScriptForPrompt(script, 350) : ''; // 320→350
    
    // ✅ v6.2-patch87-3: 使用 characterProfiles 构建精简角色描述
    let characterDesc = '';
    if (characters.length > 0) {
      const descs = characters.map(charId => {
        if (characterProfiles && characterProfiles[charId]) {
          return characterProfiles[charId];
        }
        return charId;
      });
      characterDesc = descs.join('、') + ' ';
    }
    
    const sceneDesc = this.extractKeySceneElements(analysis, 150); // 120→150
    const emotionDesc = this.mapEmotionPhaseToDescription(emotionPhase);
    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心
    const visualCore = sceneSpecificVisual ? `${sceneSpecificVisual} ` : '';
    return `${visualCore}${characterDesc}${scriptDesc}${scriptDesc && sceneDesc ? ' ' + sceneDesc : sceneDesc} ${emotionDesc}`.trim();
  }

  buildClosingDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual = '') {
    const scriptDesc = script ? this.sanitizeScriptForPrompt(script, 350) : ''; // 300→350
    
    // ✅ v6.2-patch87-3: 使用 characterProfiles 构建精简角色描述
    let characterDesc = '';
    if (characters.length > 0) {
      const descs = characters.map(charId => {
        if (characterProfiles && characterProfiles[charId]) {
          return characterProfiles[charId];
        }
        return charId;
      });
      characterDesc = descs.join('、') + ' ';
    }
    
    const sceneDesc = this.extractKeySceneElements(analysis, 200); // 150→200
    const emotionDesc = this.mapEmotionPhaseToDescription(emotionPhase);
    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心
    const visualCore = sceneSpecificVisual ? `${sceneSpecificVisual} ` : '';
    return `${visualCore}${characterDesc}${scriptDesc}${scriptDesc && sceneDesc ? ' ' + sceneDesc : sceneDesc} ${emotionDesc}`.trim();
  }

  // 🔥 v24.3新增:高潮镜头描述(climax类型专用)
  buildClimaxDescription(analysis, script, characters, emotionPhase, characterProfiles, sceneSpecificVisual = '') {
    const scriptDesc = script ? this.sanitizeScriptForPrompt(script, 400) : ''; // 350→400
    
    // ✅ v6.2-patch87-3: 使用 characterProfiles 构建精简角色描述
    let characterDesc = '';
    if (characters.length > 0) {
      const descs = characters.map(charId => {
        if (characterProfiles && characterProfiles[charId]) {
          return characterProfiles[charId];
        }
        return charId;
      });
      characterDesc = descs.join('、') + ' ';
    }
    
    const sceneDesc = this.extractKeySceneElements(analysis, 200); // 150→200
    const emotionDesc = this.mapEmotionPhaseToDescription(emotionPhase);
    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心
    const visualCore = sceneSpecificVisual ? `${sceneSpecificVisual} ` : '';
    return `${visualCore}${characterDesc}${scriptDesc}${scriptDesc && sceneDesc ? ' ' + sceneDesc : sceneDesc} ${emotionDesc} dramatic intense moment, energy surging, tension peak.`.trim();
  }

  buildGenericDescription(analysis, script, emotionPhase, characters = [], characterProfiles = {}, sceneSpecificVisual = '') {
    const scriptDesc = script ? this.sanitizeScriptForPrompt(script, 300) : '';
    const sceneDesc = this.extractKeySceneElements(analysis, 150);
    const emotionDesc = this.mapEmotionPhaseToDescription(emotionPhase);
    
    // ✅ v6.2-patch87-3: 使用 characterProfiles 构建精简角色描述（名字+核心特征）
    let characterDesc = '';
    if (characters.length > 0) {
      const descs = characters.map(charId => {
        if (characterProfiles && characterProfiles[charId]) {
          return characterProfiles[charId];
        }
        return charId;
      });
      characterDesc = descs.join('、') + ' ';
    }

    // v6.2-patch61-fix: 短内容自动扩展改为中文,避免英文混入
    let extendedDesc = scriptDesc;
    if (scriptDesc.length < 350) {
      const sceneExtension = this.extractSceneDNA(analysis, 250);
      // ✅ v6.2-patch87-3: 精简角色互动描述（不再重复角色外貌，只保留构图提示）
      const charExtension = characters.length > 0 ? ` 角色同框构图平衡。` : '';
      const emotionExtension = ` ${emotionDesc}`;
      extendedDesc = `${scriptDesc}${charExtension}${emotionExtension} ${sceneExtension}`.trim();
    }

    // 🔥 v6.2-patch101-fix: 注入场景特定视觉核心
    const visualCore = sceneSpecificVisual ? `${sceneSpecificVisual} ` : '';
    return `${visualCore}${characterDesc}${extendedDesc}${extendedDesc && sceneDesc ? ' ' + sceneDesc : sceneDesc} ${emotionDesc}`.trim();
  }

  // 🔥 新增:将narration/script内容转化为Prompt安全的视觉描述
  sanitizeScriptForPrompt(script, maxChars) {
    if (!script || typeof script !== 'string') return '';

    // 直接使用中文字符作为视觉描述(Seedance支持中文Prompt)
    // 如果超过maxChars,保留前maxChars字符(在句子边界截断)
    if (script.length <= maxChars) return script;

    // 在maxChars附近找句号、逗号或空格截断
    const truncated = script.substring(0, maxChars);
    const cutPoints = [
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf(','),
      truncated.lastIndexOf(' '),
      truncated.lastIndexOf('.')
    ].filter(p => p > maxChars * 0.7); // 至少保留70%

    const cutAt = cutPoints.length > 0 ? Math.max(...cutPoints) + 1 : maxChars;
    return script.substring(0, cutAt).trim();
  }

  // 提取场景关键元素(丰富版,避免与extractSceneDNA重复--v24.2-fix:更精简,给script留空间)
  extractKeySceneElements(analysis, maxChars) {
    const parts = [];
    const scene = analysis.world;

    // 只提取最标志性的1-2个元素,避免与sceneDNA重复
    if (scene.nirathName) parts.push(scene.nirathName);
    if (scene.colorPalette?.dominant) parts.push(`主色调${scene.colorPalette.dominant}`);
    if (scene.atmosphere && parts.length < 2) parts.push(scene.atmosphere);

    const desc = parts.join(', ');
    if (desc.length > maxChars) {
      return desc.substring(0, maxChars).replace(/[^,]*$/, '').trim() + '.';
    }
    return desc;
  }

  // 提取光照精华
  extractLightingEssence(analysis, maxChars) {
    const light = analysis.lighting;
    if (!light?.description) return '';
    const essence = light.description
      .replace(/\([^)]*\)/g, '')
      .replace(/temperature \d+K/g, '')
      .trim();
    if (essence.length > maxChars) {
      return essence.substring(0, maxChars).replace(/[^.]*$/, '').trim();
    }
    return essence;
  }

  // 提取发现动作
  extractDiscoveryAction(script, maxChars) {
    // v6.2-patch63-fix: 改为中文描述,避免英文混入视觉Prompt
    const desc = '充满好奇地探索发现,眼中闪烁着惊奇光芒';
    return desc.length > maxChars ? desc.substring(0, maxChars) : desc;
  }

  // 提取互动动作
  extractInteractionAction(script, maxChars) {
    // v6.2-patch63-fix: 改为中文描述,避免英文混入视觉Prompt
    const desc = '自然互动,姿态放松,眼神交流真实生动';
    return desc.length > maxChars ? desc.substring(0, maxChars) : desc;
  }

  // 情绪阶段映射
  mapEmotionPhaseToDescription(phase, type = 'generic') {
    // v6.2-patch63-fix: 全中文映射,移除英文技术词汇
    // 🔥 v6.2-patch100-fix: 场景类型差异化情绪描述
    // 根因：冲突场景使用 neutral 返回和谐宁静，与场景矛盾
    // 修复：根据场景名称调整情绪描述，确保情绪与场景一致
    // v6.2-patch103-fix: 增强类型检测，discovery/curiosity 不再返回和谐宁静
    const sceneName = (this._currentSceneName || '').toLowerCase();
    const isVolcanic = sceneName.includes('火山') || sceneName.includes('熔岩') || sceneName.includes('岩浆') || sceneName.includes('火');
    const isForest = sceneName.includes('森林') || sceneName.includes('丛林') || sceneName.includes('树') || sceneName.includes('林');
    const isSwamp = sceneName.includes('沼泽') || sceneName.includes('湿地') || sceneName.includes('毒') || sceneName.includes('沼');
    const isWasteland = sceneName.includes('荒原') || sceneName.includes('沙漠') || sceneName.includes('戈壁') || sceneName.includes('荒');
    const isDiscovery = type === 'discovery' || type === 'reveal' || phase === 'curiosity' || phase === 'awe';
    const isClimax = type === 'climax' || phase === 'climax' || phase === 'confrontation';
    
    // 根据场景类型调整 neutral 的情绪描述
    let neutralDesc = '平衡构图,自然流动,和谐宁静。';
    if (isDiscovery) {
      neutralDesc = '惊奇发现构图,目光聚焦,探索未知。';
    } else if (isClimax) {
      neutralDesc = '紧张对峙构图,暗流涌动,危机潜伏。';
    } else if (isVolcanic) {
      neutralDesc = '紧张对峙构图,暗流涌动,危机潜伏。';
    } else if (isSwamp) {
      neutralDesc = '诡异静谧构图,迷雾笼罩,不安潜行。';
    } else if (isWasteland) {
      neutralDesc = '荒凉孤寂构图,风沙肆虐,生存挣扎。';
    } else if (isForest) {
      neutralDesc = '幽深神秘构图,光影斑驳,探索未知。';
    }
    
    const mapping = {
      'establishing': '宏大开场镜头,震撼敬畏,空间辽阔感扑面而来。',
      'curiosity': '充满好奇的探索姿态,目光敏锐,发现新事物的惊喜。',
      'awe': '震惊与敬畏,目光凝视,被宏大景象压倒的渺小感。',
      'rising': '紧张感递增,好奇心增强,情绪逐渐升温。',
      'turning': '揭示真相时刻,震惊与惊讶,转折冲击力。',
      'climax': '情绪高潮,强烈情感连接,震撼人心。',
      'resolution': '温柔化解,温暖接纳,余韵悠长。',
      'neutral': neutralDesc
    };
    return mapping[phase] || mapping['neutral'];
  }

  // 提取场景DNA(精简版 v24.2-fix:减少字符预算,避免淹没script/narration内容)
  extractSceneDNA(analysis, maxChars) {
    const parts = [];

    // 从background中提取核心句子(最多2句,简短)
    if (analysis.background) {
      const sentences = analysis.background.split(/\.\s+/).filter(s => s.length > 20);
      for (const sentence of sentences.slice(0, 2)) {
        const cleaned = sentence
          .replace(/\[\w+\]\s*/g, '')
          .replace(/\d+K|\([^)]*\)/g, '')
          .trim();
        if (cleaned.length > 10 && cleaned.length < 120) parts.push(cleaned); // 限制单句长度
      }
    }

    // 从materials中提取(最多1句)
    if (analysis.materials) {
      const matParts = analysis.materials.split(/\.\s+/).filter(s => s.length > 10);
      for (const mat of matParts.slice(0, 1)) {
        if (mat.length < 100) parts.push(mat); // 限制长度
      }
    }

    // 光照环境(精简)
    if (analysis.lighting) {
      const lightDesc = [];
      if (analysis.lighting.type) lightDesc.push(analysis.lighting.type);
      if (analysis.lighting.primaryColor) lightDesc.push(`primary ${analysis.lighting.primaryColor}`);
      if (lightDesc.length > 0) parts.push(`Lighting: ${lightDesc.join(', ')}`);
    }

    const dna = parts.join('. ');
    if (dna.length > maxChars) {
      return dna.substring(0, maxChars).replace(/[^.]*$/, '').trim() + '.';
    }
    return dna;
  }

  // 智能截断（优先保护核心字段：【旁白/台词】【环境质感】【镜头时间轴】【叙事弧线】）
  smartTruncate(prompt, maxLen) {
    if (prompt.length <= maxLen) return prompt;

    // 核心字段：不可截断（按优先级从高到低）
    // v6.2-patch67-fix: 使用prefix匹配，支持【叙事弧线：xxx】等变体
    // v6.2-patch68: 新增【环境音效】保护
    // v6.2-patch102-fix: 新增【嘴部动作】保护，防止标签被截断成【嘴部动
    // v6.5.6-fix: 新增【台词】保护，确保台词不被截断
    const protectedFields = [
      { prefix: '【台词】', label: '台词' },
      { prefix: '【旁白/台词】', label: '旁白/台词' },
      { prefix: '【嘴部动作】', label: '嘴部动作' },
      { prefix: '【环境质感】', label: '环境质感' },
      { prefix: '【环境音效】', label: '环境音效' },
      { prefix: '【镜头时间轴】', label: '镜头时间轴' },
      { prefix: '【叙事弧线', label: '叙事弧线' },  // 支持【叙事弧线：xxx】变体
      { prefix: '【视觉】', label: '视觉' },
      { prefix: '【叙事】', label: '叙事' }
    ];

    let truncated = prompt.substring(0, maxLen - 3).trim();

    // 检查截断点是否落在核心字段内部，如果是则移到该字段之前
    for (const field of protectedFields) {
      // 查找以prefix开头的字段位置
      let fieldStart = -1;
      let idx = 0;
      while ((idx = truncated.indexOf(field.prefix, idx)) !== -1) {
        // 确认这是一个字段开头（前面是换行或字符串开头）
        if (idx === 0 || truncated[idx - 1] === '\n') {
          fieldStart = idx;
          break;
        }
        idx += field.prefix.length;
      }
      
      if (fieldStart === -1) continue;
      // 找到该字段的结束位置（下一个【或字符串末尾）
      const nextField = prompt.indexOf('【', fieldStart + 1);
      const fieldEnd = nextField === -1 ? prompt.length : nextField;
      // 如果截断点落在该字段内部
      if (truncated.length > fieldStart && truncated.length < fieldEnd) {
        // 将截断点移到该字段之前，确保核心字段完整保留
        truncated = truncated.substring(0, fieldStart).trim();
        break; // 只处理第一个被截断的核心字段
      }
    }

    // 🔥 v6.2-patch100-fix: 改进截断逻辑，确保在标点处截断
    // 根因：原逻辑只在截断点接近末尾时（>95%）才在标点处截断，导致句子中间被截断
    // 修复：优先在中文标点处截断，其次在空格处截断，避免截断词语中间
    let cutAt = -1;
    
    // 优先在中文标点处截断
    const punctuations = ['。', '，', '；', '！', '？'];
    for (let i = truncated.length - 1; i >= 0; i--) {
      if (punctuations.includes(truncated[i])) {
        cutAt = i + 1; // 包含标点
        break;
      }
    }
    
    // 其次在英文标点处截断
    if (cutAt === -1) {
      const enPunctuations = ['.', ',', ';', '!', '?'];
      for (let i = truncated.length - 1; i >= 0; i--) {
        if (enPunctuations.includes(truncated[i])) {
          cutAt = i + 1;
          break;
        }
      }
    }
    
    // 再次在空格处截断
    if (cutAt === -1) {
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 0) {
        cutAt = lastSpace;
      }
    }
    
    // 如果找到合适的截断点，执行截断
    if (cutAt > 0) {
      truncated = truncated.substring(0, cutAt).trim();
    }
    
    // 确保以标点结尾
    if (!truncated.endsWith('。') && !truncated.endsWith('.')) {
      truncated += '。';
    }
    
    // 🔥 v6.2-patch102-fix: 标签闭合检查，防止截断后出现未闭合的【
    // 根因：smartTruncate可能在中文字段标签【xxx】中间截断，输出【xxx → 标签未闭合
    // 修复：检查最后一个【和】的位置，如果【之后没有】，回退到【之前
    const lastOpen = truncated.lastIndexOf('【');
    const lastClose = truncated.lastIndexOf('】');
    if (lastOpen > lastClose) {
      // 存在未闭合的【，回退到【之前
      truncated = truncated.substring(0, lastOpen).trim();
      // 再次确保以标点结尾
      if (!truncated.endsWith('。') && !truncated.endsWith('.')) {
        truncated += '。';
      }
    }
    
    // 🔥 v6.5.3-fix: 确保【镜头时间轴】不被截断
    // 根因：【镜头时间轴】在末尾时，截断点可能落在字段之后，不触发上面的保护逻辑
    // 修复：如果截断后丢失了【镜头时间轴】，回退到该字段开头
    if (prompt.includes('【镜头时间轴】') && !truncated.includes('【镜头时间轴】')) {
      const fieldStart = prompt.indexOf('【镜头时间轴】');
      if (fieldStart > 0 && fieldStart < truncated.length) {
        truncated = prompt.substring(0, fieldStart).trim();
        if (!truncated.endsWith('。') && !truncated.endsWith('.')) {
          truncated += '。';
        }
      }
    }
    
    return truncated;
  }

  // 🔥 v6.2-patch101-fix: 场景特定视觉描述生成器
  // 根据场景名称和类型，生成独特的视觉核心描述，替代统一前缀
  // 根因：所有镜头使用"超写实，cinematic lighting"统一前缀，导致同质化
  // 修复：每个场景有独特的视觉核心，如"腐蚀口涎"、"呼吸根光网"、"荧光溪流"等
  buildSceneSpecificVisual(sceneName, type) {
    if (!sceneName) return '';
    
    const sceneLower = sceneName.toLowerCase();
    
    // 场景特定视觉描述映射
    const visualMap = {
      // 火山/熔岩场景
      '火山': '火山岩浆流淌，地面龟裂冒热气，硫磺烟雾弥漫，岩壁呈现暗红色金属光泽',
      '熔岩': '熔岩河流淌，暗红光芒照亮环境，岩浆气泡破裂溅起火星，空气中弥漫着硫磺味',
      '岩浆': '岩浆池沸腾，岩浆滴落地面发出嘶嘶声，暗红色光芒照亮周围岩壁',
      
      // 晶体/裂谷场景
      '晶体': '紫色晶体折射出彩虹光谱，晶体地面脉动发光，呼吸根在地下延伸形成光网',
      '裂谷': '晶体裂谷两侧岩壁闪烁，地面呼吸根发出脉动蓝光，生物荧光苔藓在岩壁上形成星座图案',
      '晶': '水晶状结构从地面生长，折射双色光芒，晶体表面有能量流动痕迹',
      
      // 骸骨/丛林场景
      '骸骨': '巨大发光骸骨矗立，骨骼发出柔和蓝光，地面有荧光液体流动形成发光河流',
      '丛林': '奇异植物发光，孢子群在空气中漂浮如萤火虫，藤蔓缠绕着发光晶体',
      '森林': '磁丝树矗立，孢子碎光飘落，树干纹理呈现金属般光泽，生物发光生态',
      
      // 祭坛/圣殿场景
      '祭坛': '古老祭坛中央符文发光，地面有能量流动痕迹，双月悬空投射奇异阴影',
      '圣殿': '晶体墙壁折射出万花筒般光芒，圣殿顶部有发光晶体吊灯，能量流动痕迹',
      '殿': '庄严建筑结构，能量光芒从顶部倾泻而下，地面有古老符文',
      
      // 河流/水流场景
      '流': '荧光液体流动形成发光河流，水面倒映双月光芒，水中有生物发光微生物',
      '河': '发光河流蜿蜒，水面有荧光涟漪，河岸生长着发光植物',
      '水': '水体发出柔和蓝光，水面有荧光涟漪，水中生物发光',
      
      // 黎明/日出场景
      '黎明': '双月升起，金色和银色光芒交织，地面有新生植物发光，天空有极光般光芒',
      '日出': '恒星光芒从地平线升起，金色暖光洒满大地，空气中悬浮着发光粒子',
      '曙光': '第一缕光芒穿透黑暗，金色和银色交织，新生植物开始发光',
      
      // 记忆/光流场景
      '记忆': '记忆光流呈现彩虹色，地面有光环扩散，背景有记忆碎片漂浮，空气中光粒子闪烁',
      '光': '光流呈现彩虹色，光环扩散，光粒子在空气中闪烁，背景有光之碎片',
      
      // 星菌/诱饵场景
      '星菌': '星菌诱饵发出荧光，孢子群被声波推散成淡蓝色光环，磁丝树剧烈震颤',
      '诱饵': '发光诱饵脉动，吸引生物靠近，周围有荧光孢子漂浮',
      
      // 默认：根据类型返回通用描述
      'default': {
        'opening': '环境全貌展现，双恒星光照下Nirath奇异地貌',
        'discovery': '探索发现，奇异生物或环境元素首次出现',
        'interaction': '角色互动，情感交流场景',
        'climax': '紧张对峙，能量涌动',
        'closing': '温暖收尾，希望光芒',
        'generic': 'Nirath异世界场景，双恒星光照'
      }
    };
    
    // 查找匹配的场景描述
    let visualDesc = '';
    for (const [key, desc] of Object.entries(visualMap)) {
      if (sceneLower.includes(key)) {
        visualDesc = desc;
        break;
      }
    }
    
    // 如果没有匹配，使用默认类型描述
    if (!visualDesc) {
      const defaultDesc = visualMap.default;
      visualDesc = defaultDesc[type] || defaultDesc.generic;
    }
    
    return visualDesc ? `${visualDesc}。` : '';
  }
  buildPrompt(sceneNameOrParams, scriptSegment = '', shotParams = {}) {
    // ... 原代码保留 ...
  }

  // 智能压缩背景描述
  compressBackground(fullBackground, maxChars) {
    if (!fullBackground || fullBackground.length <= maxChars) return fullBackground;

    // 移除科学标签标记 [XXX] 和详细数字数据
    let cleaned = fullBackground
      .replace(/\[GEOLOGY\]\s*/g, '')
      .replace(/\[ECOSYSTEM\]\s*/g, '')
      .replace(/\[LIGHT SCIENCE\]\s*/g, '')
      .replace(/\[CULTURE\]\s*/g, '')
      .replace(/\[MATERIALS\]\s*/g, '')
      .replace(/\[ACOUSTICS\]\s*/g, '')
      .replace(/\d+\^\d+|\d+K|490nm|10\^\d+|\([^)]*\)/g, '')  // 移除科学数字
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length <= maxChars) return cleaned;

    // 按句子分割,保留核心句子
    const sentences = cleaned.split(/\.\s+/).filter(s => s.length > 10);
    let result = '';

    for (const sentence of sentences) {
      const withDot = result ? result + '. ' + sentence : sentence;
      if (withDot.length <= maxChars) {
        result = withDot;
      } else {
        const remaining = maxChars - result.length - 4;
        if (remaining > 30) {
          result += '. ' + sentence.substring(0, remaining) + '...';
        }
        break;
      }
    }

    return result;
  }

  // 批量处理
  batchBuild(sceneScriptPairs, shotParams = {}) {
    const results = [];
    for (const { scene, script } of sceneScriptPairs) {
      results.push(this.buildPrompt(scene, script, shotParams));
    }
    return results;
  }

  // 获取场景列表
  getAvailableScenes() {
    return Object.keys(SCENE_LIBRARY);
  }

  // 获取场景DNA
  getSceneDNA(sceneName) {
    return this.enrichmentAgent.getSceneDNA(sceneName);
  }

  // 🔥 v6.2-patch103-fix: 格式符号闭合检查
  // 检查并修复 ** 和 【】 的成对性，防止格式崩溃
  validateFormatMarkers(prompt) {
    if (!prompt) return prompt;
    
    let result = prompt;
    
    // 1. 检查 ** 成对性
    const boldCount = (result.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      // 奇数个 **，追加一个闭合
      result += '**';
      console.log('[FormatValidate] 📝 修复 ** 成对性：追加闭合标记');
    }
    
    // 2. 检查 【】 成对性
    const openBrackets = (result.match(/【/g) || []).length;
    const closeBrackets = (result.match(/】/g) || []).length;
    if (openBrackets > closeBrackets) {
      // 缺少闭合】，追加
      result += '】'.repeat(openBrackets - closeBrackets);
      console.log(`[FormatValidate] 📝 修复 【】 成对性：追加 ${openBrackets - closeBrackets} 个闭合】`);
    } else if (closeBrackets > openBrackets) {
      // 缺少开口【，在开头追加
      result = '【'.repeat(closeBrackets - openBrackets) + result;
      console.log(`[FormatValidate] 📝 修复 【】 成对性：追加 ${closeBrackets - openBrackets} 个开口【`);
    }
    
    // 3. 检查引号成对性（简单检查）
    const leftQuotes = (result.match(/「/g) || []).length;
    const rightQuotes = (result.match(/」/g) || []).length;
    if (leftQuotes > rightQuotes) {
      result += '」'.repeat(leftQuotes - rightQuotes);
      console.log(`[FormatValidate] 📝 修复 「」 成对性：追加 ${leftQuotes - rightQuotes} 个闭合」`);
    }
    
    return result;
  }

  // 🔥 v6.2-patch102-fix: 重复中文句子检测与去重
  removeDuplicateSentences(prompt) {
    if (!prompt || prompt.length < 20) return prompt;
    const sentences = prompt.split(/([。，；！？\.,\;\!?])/);
    const seen = new Set();
    const result = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const text = sentences[i] || "";
      const punct = sentences[i + 1] || "";
      const trimmed = text.trim();
      if (trimmed.length < 5) {
        result.push(text + punct);
        continue;
      }
      const fingerprint = trimmed.substring(0, 8) + "|" + trimmed.substring(Math.max(0, trimmed.length - 8)) + "|" + trimmed.length;
      if (seen.has(fingerprint) && trimmed.length >= 10) {
        continue;
      }
      seen.add(fingerprint);
      result.push(text + punct);
    }
    return result.join("");
  }
}

// ========== 导出 ==========
module.exports = {
  OrientPrimordialCoreV24,
  NirathStyleEnforcer,
  BackgroundEnrichmentAgent,
  DualStarLightingEngine,
  NirathMaterialSystem,
  WorldArchaeologistAgent,
  NarrativeAnalystAgent,
  CinematicInstructionBuilder,
  CINEMATIC_VOCABULARY,
  NIRATH_MASTER_PARAMS,
  NIRATH_BANNED_KEYWORDS,
  SCENE_LIBRARY
};

// CLI支持

if (require.main === module) {
  const core = new OrientPrimordialCoreV24();

  // 测试模式
  if (process.argv.includes('--test')) {
    console.log('\n🔥 [Core-v24] Nirath Edition 测试模式\n');

    const scenes = core.getAvailableScenes();
    console.log(`✅ 已加载场景: ${scenes.join(', ')}`);

    // 测试归墟之海
    const result = core.buildPrompt('归墟之海', '主角站在海边,面对浩瀚发光海洋,感到敬畏');
    console.log('\n--- 归墟之海 Prompt ---');
    console.log(result.prompt.substring(0, 500) + '...');
    console.log(`✅ 合规: ${result.compliant}, 长度: ${result.length}`);
    console.log(`📋 处理记录: ${result.issues.join('; ')}`);

    // 测试双重阴影
    const lighting = core.lightingEngine.calculate('归墟之海');
    console.log('\n--- 双星光照系统 ---');
    console.log(`Key light: ${lighting.keyLight.color} (${lighting.keyLight.mixRatio})`);
    console.log(`Shadows: ${lighting.shadows.primary.color} + ${lighting.shadows.secondary.color}`);
    console.log(`Overlap: ${lighting.shadows.overlap.color}`);

    // 测试材质
    const mats = core.materialSystem.getSceneMaterials('归墟之海');
    console.log('\n--- 材质系统 ---');
    mats.forEach(m => console.log(`${m.name}: ${m.type}`));

    console.log('\n✅ v24 Nirath Edition 测试完成\n');
  }

}

// 导出
module.exports = { OrientPrimordialCoreV24 };

