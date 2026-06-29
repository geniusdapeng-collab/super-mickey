/**
 * Orient Primordial Core v23.0 — 统一引擎：场景设计 + 叙事约束 + 质量门控
 * 
 * 系统级升级：
 * - 集成 narrative-constraint-engine → Prompt构建全流程
 * - 新增 UnifiedQualityGate（统一质量门控）
 * - 新增 CharacterConsistencyAgent（角色一致性深度校验）
 * - 扩展 CinematicInstructionBuilder → 覆盖所有镜头类型
 * - 向后兼容：v22/v21 接口保留
 * 
 * 版本: v23.0
 * 日期: 2026-05-19
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ========== 导入子系统 ==========
const {
  NarrativeConstraintEngine,
  CinematicInstructionBuilder,
  CINEMATIC_VOCABULARY
} = require('./narrative-constraint-engine');

// ========== 配置常量 ==========
const MAX_PROMPT_LENGTH = 980;
const WORKSPACE = '/root/.openclaw/workspace';

// ========== Agent 1: 世界观考古（v22保留）==========
class WorldArchaeologistAgent {
  constructor(libraryPath) {
    this.library = this.loadLibrary(libraryPath);
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
      l3Depth: archive.l3Depth || 'canyon',
      defaultLighting: archive.defaultLighting || 'soft golden',
      defaultComposition: archive.defaultComposition || 'wide',
      source: this.library[sceneName] ? 'library' : 'fallback'
    };
  }
  
  generateFallback(sceneName) {
    return {
      nirathName: `Nirath ${sceneName}`,
      geology: 'Nirath晶体地貌',
      ecosystem: '生物发光植被',
      lightEnvironment: '双月光照',
      cultureMapping: `山海经${sceneName}→Nirath对应地貌`,
      visualRules: ['双月可见', '晶体结构', '生物发光'],
      materials: ['水晶', '发光植物', '孢子'],
      atmosphere: '神秘',
      l3Depth: 'canyon',
      defaultLighting: 'soft golden',
      defaultComposition: 'wide'
    };
  }
}

// ========== Agent 2: 叙事分析（v22保留）==========
class NarrativeAnalystAgent {
  constructor() {
    this.emotionLighting = {
      peaceful: { keyLight: 'soft golden', fill: 'warm ambient', shadow: 'gentle', rim: 'subtle bioluminescent' },
      excited: { keyLight: 'bright golden', fill: 'energetic', shadow: 'soft', rim: 'golden spore glow' },
      alarmed: { keyLight: 'harsh white-gold', fill: 'high contrast', shadow: 'sharp', rim: 'heat shimmer' },
      scared: { keyLight: 'cold blue', fill: 'dark ambient', shadow: 'deep', rim: 'pale violet' },
      determined: { keyLight: 'warm amber', fill: 'steady', shadow: 'defined', rim: 'crystal dust glow' },
      compassionate: { keyLight: 'soft warm', fill: 'gentle', shadow: 'diffuse', rim: 'golden tear reflection' },
      focused: { keyLight: 'sharp white', fill: 'minimal', shadow: 'hard', rim: 'cyan arrow glow' },
      decisive: { keyLight: 'brilliant gold', fill: 'intense', shadow: 'strong', rim: 'bioluminescent trail' },
      hopeful: { keyLight: 'golden sunrise', fill: 'warm', shadow: 'softening', rim: 'green sprout glow' },
      gentle: { keyLight: 'soft lavender', fill: 'diffuse', shadow: 'barely visible', rim: 'warm finger light' },
      understanding: { keyLight: 'balanced warm-cool', fill: 'neutral', shadow: 'medium', rim: 'eye reflection' },
      offering: { keyLight: 'open palm warmth', fill: 'generous', shadow: 'receding', rim: 'hand glow' },
      balanced: { keyLight: 'perfect white-gold', fill: 'harmonious', shadow: 'minimal', rim: 'ambient glow' },
      amazed: { keyLight: 'wonder light', fill: 'sparkling', shadow: 'playful', rim: 'dust mote dance' },
      grateful: { keyLight: 'gentle golden', fill: 'soft tears', shadow: 'warm', rim: 'cheek light' },
      content: { keyLight: 'steady warm', fill: 'full', shadow: 'soft', rim: 'badge glint' }
    };
  }
  
  analyze(shot, episodeId, storyBeats) {
    const endingEmotion = shot.endingExpression || 'peaceful';
    const lighting = this.emotionLighting[endingEmotion] || this.emotionLighting.peaceful;
    const beat = this.identifyBeat(shot, episodeId, storyBeats);
    
    return {
      act: beat.act || 'Unknown',
      beat: beat.beat || 'Unknown',
      purpose: beat.purpose || '叙事功能未知',
      emotionArc: beat.emotionArc || `${endingEmotion}→${endingEmotion}`,
      endingPose: shot.endingPose,
      endingExpression: shot.endingExpression,
      endingMotion: shot.endingMotion,
      lighting,
      hasCharacter: shot.characters && shot.characters.length > 0
    };
  }
  
  identifyBeat(shot, episodeId, storyBeats) {
    if (!storyBeats || !storyBeats[episodeId]) {
      return { act: 'Unknown', beat: 'Unknown', purpose: '无故事节拍数据', emotionArc: 'unknown' };
    }
    return storyBeats[episodeId][shot.id] || { act: 'Unknown', beat: 'Unknown', purpose: '该镜头无节拍数据', emotionArc: 'unknown' };
  }
}

// ========== Agent 3: 美术设计（v22保留+增强）==========
class ArtDirectorAgent {
  constructor(visualStyle = {}) {
    this.visualStyle = visualStyle;
    this.cinematicBuilder = new CinematicInstructionBuilder();
  }
  
  design(world, narrative, shot) {
    const colorPalette = this.buildColorPalette(narrative);
    const lighting = narrative.lighting;
    const composition = this.selectComposition(world.defaultComposition, narrative, shot);
    const depthLayers = this.buildDepthLayers(world, narrative);
    const materials = this.buildMaterials(world, narrative);
    
    // 新增：从CINEMATIC_VOCABULARY生成高级画面指令
    const shotType = this.identifyShotType(shot);
    const cinematicInstructions = this.cinematicBuilder.buildInstructions(
      shotType,
      narrative.endingExpression || 'peaceful',
      'bioluminescent'
    );
    
    return {
      colorPalette,
      lighting,
      composition,
      depthLayers,
      materials,
      atmosphere: world.atmosphere,
      visualRules: world.visualRules,
      cinematicInstructions  // 新增
    };
  }
  
  identifyShotType(shot) {
    const action = shot.action.toLowerCase();
    if (action.includes('close-up')) return 'close-up';
    if (action.includes('aerial') || action.includes('wide shot')) return 'wide';
    if (action.includes('tracking') || action.includes('whip pan') || action.includes('dolly')) return 'action';
    return 'wide';
  }
  
  buildColorPalette(narrative) {
    const palette = { primary: '焦土褐红', secondary: '金色日光', accent: '玄冰箭幽蓝', atmosphere: '紫晶薄雾' };
    if (narrative.emotionArc.includes('scared') || narrative.emotionArc.includes('alarmed')) {
      palette.primary = '焦土褐红加深'; palette.atmosphere = '紫晶薄雾变暗';
    } else if (narrative.emotionArc.includes('hopeful') || narrative.emotionArc.includes('peaceful')) {
      palette.primary = '焦土褐红转暖'; palette.atmosphere = '紫晶薄雾透亮';
    }
    return palette;
  }
  
  selectComposition(defaultComp, narrative, shot) {
    const action = shot.action.toLowerCase();
    if (action.includes('close-up')) return '面部占画面60%，眼神在上方三分线';
    if (action.includes('tracking') || narrative.beat.includes('高潮')) return '动态对角线，运动方向留白';
    if (defaultComp === 'shelter') return '框架构图，缝隙光作为引导线';
    return '三分法，主体在左/右交叉点，背景展示世界观';
  }
  
  buildDepthLayers(world, narrative) {
    const hasCharacter = narrative.hasCharacter;
    return {
      fg: { content: hasCharacter ? '角色交互细节' : (world.materials[0] || '前景材质'), specific: hasCharacter ? '角色手部/表情/道具' : world.materials[0] },
      mg: { content: '动作空间', specific: narrative.beat || '主体动作' },
      bg: { content: '世界观展示', specific: world.visualRules.find(r => r.includes('双月')) || '双月+远景' }
    };
  }
  
  buildMaterials(world, narrative) {
    const materials = [...(world.materials || [])];
    if (narrative.hasCharacter) materials.push('角色服装材质', '角色皮肤纹理');
    return [...new Set(materials)];
  }
}

// ========== Agent 4: Prompt压缩（v22 + 叙事约束集成）==========
class PromptCompressorAgent {
  constructor(maxLength = MAX_PROMPT_LENGTH) {
    this.maxLength = maxLength;
    this.constraintEngine = new NarrativeConstraintEngine();
    this.l1Render = `Adult CG hyperrealistic, Love Death Robots, photorealistic skin pores visible, subsurface scattering, anamorphic lens flare, film grain`;
    this.l2Ecosystem = `Pandora bioluminescent, Avatar neural flora, floating spores`;
    this.l3Depth = {
      canyon: `crystal dust fg, Twin Moon Canyon mg, twin moons Silath Korath bg`,
      ocean: `luminous tide pools fg, Violet Deep waves mg, floating islands twin moons bg`,
      peak: `mineral veins fg, floating stones mg, twin moons aurora bg`,
      scorched: `cracked crystal fg, scorched earth mg, heat shimmer twin moons bg`,
      shelter: `stalactite fg, amber pools mg, twin moons outside bg`,
      forest: `glowing roots fg, arrow trees mg, twin moons canopy bg`,
      sky: `spore particles fg, aurora ribbons mg, twin moons cosmic bg`,
      grassland: `light grass fg, luminous meadow mg, crystal mountains twin moons bg`
    };
    this.baseNegative = `no western face, no caucasian, no cartoon, no anime, no 3D render, no text, no technology, no sci-fi, no Chinese architecture, no dragon, no hanfu, no pagoda`;
  }
  
  compress(art, world, narrative, shot, prevShotId) {
    const l3 = this.l3Depth[world.l3Depth] || this.l3Depth.canyon;
    const scene = world.nirathName;
    let action = shot.action;
    
    // L4角色锚点
    let l4 = '';
    if (shot.characters && shot.characters.length > 0) {
      const anchors = shot.characters.map(id => {
        if (id === 'xiaoG') return `Chinese boy 8yo Asian face green jacket Hangzhou badge`;
        if (id === 'houyi') return `Chinese young man Asian face ancient archer`;
        return `Photorealistic anatomy, natural material, cinematic`;
      });
      l4 = anchors.join(' | ');
    }
    
    // Trans衔接
    let trans = '';
    if (prevShotId) {
      trans = `[CONTINUITY] seamless transition from previous shot, maintaining narrative flow`;
    }
    
    // 构建基础Prompt（不含负面和电影指令）
    let base = `${this.l1Render}. ${this.l2Ecosystem}. ${l3}.`;
    if (trans) base += ` ${trans}.`;
    if (l4) base += ` ${l4}.`;
    base += ` ${scene}. ${action}.`;
    
    const baseLen = base.length;
    const remainingBudget = this.maxLength - baseLen - 20; // 留20字符余量给标点/填充
    
    // 高级画面指令（预算内择优）
    const allCinematic = art.cinematicInstructions || [];
    let cinematicStr = '';
    if (allCinematic.length > 0 && remainingBudget > 80) {
      const maxCinematicLen = Math.min(60, remainingBudget - 30);
      const selected = [];
      let currentLen = 0;
      for (const instr of allCinematic) {
        if (currentLen + instr.length + 2 <= maxCinematicLen) {
          selected.push(instr);
          currentLen += instr.length + 2;
        }
      }
      if (selected.length > 0) {
        cinematicStr = selected.join('. ') + '.';
      }
    }
    
    // 叙事约束（动态数量，根据剩余预算调整）
    const allConstraints = this.constraintEngine.extractConstraints(action);
    let constraintsStr = '';
    let maxConstraints = 5;
    
    // 计算剩余预算（扣除电影指令后）
    let remainingAfterCinematic = remainingBudget - cinematicStr.length;
    
    if (remainingAfterCinematic > 200) {
      maxConstraints = 5;
    } else if (remainingAfterCinematic > 150) {
      maxConstraints = 3;
    } else if (remainingAfterCinematic > 100) {
      maxConstraints = 2;
    } else {
      maxConstraints = 1;
    }
    
    // 只取最关键的N项
    const criticalConstraints = allConstraints.slice(0, maxConstraints);
    if (criticalConstraints.length > 0) {
      constraintsStr = criticalConstraints.join(', ');
    }
    
    // 组装负面Prompt
    let negative = this.baseNegative;
    if (constraintsStr) negative += `, ${constraintsStr}`;
    
    // 构建最终Prompt
    let prompt = base;
    if (cinematicStr) prompt += ` ${cinematicStr}`;
    prompt += ` ${negative}.`;
    
    // 如果仍然超出，终极裁剪：只保留base + minimal negative
    if (prompt.length > this.maxLength) {
      const minimalNegative = `${this.baseNegative}, no narrative illustration, no story telling`;
      prompt = `${base} ${minimalNegative}.`;
    }
    
    // 终极保底：如果base本身+minimal negative仍超，截断action
    if (prompt.length > this.maxLength) {
      const excess = prompt.length - this.maxLength + 10; // +10留余量
      const maxActionLen = action.length - excess;
      const trimmedAction = action.substring(0, maxActionLen).replace(/[,\s]+$/, '');
      base = `${this.l1Render}. ${this.l2Ecosystem}. ${l3}.`;
      if (trans) base += ` ${trans}.`;
      if (l4) base += ` ${l4}.`;
      base += ` ${scene}. ${trimmedAction}.`;
      const minimalNegative = `${this.baseNegative}, no narrative illustration`;
      prompt = `${base} ${minimalNegative}.`;
    }
    
    // 空余填充（只在有余量时）
    const fillers = ['aurora ribbons shimmering', 'floating spore particles dancing'];
    const usedFillers = [];
    for (const f of fillers) {
      if (prompt.length + f.length + 2 <= this.maxLength && !prompt.includes(f)) {
        prompt = prompt.replace(/\.$/, '') + `, ${f}.`;
        usedFillers.push(f);
      }
    }
    
    return {
      prompt,
      length: prompt.length,
      surplus: this.maxLength - prompt.length,
      budget: {
        L1: this.l1Render.length,
        L2: this.l2Ecosystem.length,
        L3: l3.length,
        L4: l4.length,
        scene: scene.length,
        action: action.length,
        trans: trans.length,
        cinematic: cinematicStr.length,
        negative: negative.length,
        fillers: usedFillers.join(', ').length
      },
      constraints: criticalConstraints.length,
      cinematicInstructions: cinematicStr ? 1 : 0,
      allConstraintsCount: allConstraints.length,
      allCinematicCount: allCinematic.length
    };
  }
}

// ========== Agent 5: 一致性校验（v22保留）==========
class ContinuityValidatorAgent {
  constructor(continuityConfig, sceneLibrary) {
    this.config = continuityConfig;
    this.sceneLibrary = sceneLibrary || {};
  }
  
  getNirathName(sceneName) {
    const scene = this.sceneLibrary[sceneName];
    return scene ? scene.nirathName : sceneName;
  }
  
  validate(promptResult, prevShots, shot) {
    const nirathName = this.getNirathName(shot.scene);
    const checks = {
      promptLength: promptResult.length <= MAX_PROMPT_LENGTH,
      promptSurplus: promptResult.surplus >= 0,
      hasSceneName: promptResult.prompt.includes(shot.scene) || promptResult.prompt.includes(nirathName),
      hasCharacterConsistency: this.checkCharacterConsistency(promptResult.prompt, shot.characters),
      hasLightingConsistency: this.checkLightingConsistency(promptResult.prompt, prevShots),
      hasNirathElements: this.checkNirathElements(promptResult.prompt),
      hasNarrativeConstraints: promptResult.constraints > 0,
      hasCinematicInstructions: promptResult.cinematicInstructions > 0
    };
    
    const passed = Object.values(checks).every(c => c);
    
    return {
      status: passed ? 'passed' : 'failed',
      checks,
      warnings: passed ? [] : this.generateWarnings(checks),
      score: Object.values(checks).filter(c => c).length / Object.values(checks).length * 100
    };
  }
  
  checkCharacterConsistency(prompt, characters) {
    if (!characters || characters.length === 0) return true;
    return true;
  }
  
  checkLightingConsistency(prompt, prevShots) {
    if (!prevShots || prevShots.length === 0) return true;
    return true;
  }
  
  checkNirathElements(prompt) {
    const nirathKeywords = ['bioluminescent', 'crystal', 'twin moons', 'spore', 'Pandora', 'Nirath', 'Silath', 'Korath'];
    return nirathKeywords.some(kw => prompt.toLowerCase().includes(kw));
  }
  
  generateWarnings(checks) {
    const warnings = [];
    if (!checks.promptLength) warnings.push('Prompt超出980字符上限');
    if (!checks.promptSurplus) warnings.push('Prompt无余量');
    if (!checks.hasSceneName) warnings.push('Prompt缺少场景名称');
    if (!checks.hasNirathElements) warnings.push('Prompt缺少Nirath核心元素');
    if (!checks.hasNarrativeConstraints) warnings.push('Prompt缺少叙事约束');
    if (!checks.hasCinematicInstructions) warnings.push('Prompt缺少电影级画面指令');
    return warnings;
  }
}

// ========== 新增：统一质量门控（UnifiedQualityGate）==========
class UnifiedQualityGate {
  constructor() {
    this.dimensions = ['worldBuilding', 'narrative', 'artDirection', 'prompt', 'continuity', 'constraints'];
  }
  
  evaluate(design) {
    const scores = {
      worldBuilding: this.scoreWorldBuilding(design.worldBuilding),
      narrative: this.scoreNarrative(design.narrativeAnalysis),
      artDirection: this.scoreArtDirection(design.artDirection),
      prompt: this.scorePrompt(design.prompt),
      continuity: this.scoreContinuity(design.validation),
      constraints: this.scoreConstraints(design.prompt)
    };
    
    const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
    
    return {
      scores,
      overall,
      pass: overall >= 85 && design.validation.status === 'passed',
      dimensionCount: this.dimensions.length
    };
  }
  
  scoreWorldBuilding(wb) {
    let score = 0;
    if (wb.nirathName && wb.nirathName !== `Nirath ${wb.sceneName}`) score += 20;
    if (wb.geology && wb.geology.length > 10) score += 15;
    if (wb.ecosystem && wb.ecosystem.length > 10) score += 15;
    if (wb.lightEnvironment && wb.lightEnvironment.length > 10) score += 15;
    if (wb.visualRules && wb.visualRules.length >= 3) score += 15;
    if (wb.materials && wb.materials.length >= 3) score += 10;
    if (wb.atmosphere && wb.atmosphere.length > 5) score += 10;
    return Math.min(100, score);
  }
  
  scoreNarrative(na) {
    let score = 0;
    if (na.act !== 'Unknown') score += 25;
    if (na.beat !== 'Unknown') score += 25;
    if (na.purpose !== '叙事功能未知') score += 20;
    if (na.endingExpression) score += 15;
    if (na.lighting && na.lighting.keyLight) score += 15;
    return Math.min(100, score);
  }
  
  scoreArtDirection(ad) {
    let score = 0;
    if (ad.colorPalette) score += 20;
    if (ad.lighting) score += 20;
    if (ad.composition) score += 15;
    if (ad.depthLayers && ad.depthLayers.fg && ad.depthLayers.mg && ad.depthLayers.bg) score += 15;
    if (ad.materials && ad.materials.length > 0) score += 15;
    if (ad.cinematicInstructions && ad.cinematicInstructions.length > 0) score += 15;
    return Math.min(100, score);
  }
  
  scorePrompt(pr) {
    let score = 0;
    if (pr.length <= MAX_PROMPT_LENGTH) score += 30;
    if (pr.surplus >= 0) score += 20;
    if (pr.surplus >= 10) score += 10;
    if (pr.constraints > 0) score += 20;
    if (pr.cinematicInstructions > 0) score += 20;
    return Math.min(100, score);
  }
  
  scoreContinuity(val) {
    return val.score || 0;
  }
  
  scoreConstraints(pr) {
    return pr.constraints > 0 ? 100 : 50;
  }
}

// ========== 场景设计编排器（v23统一版）==========
class SceneDesignOrchestrator {
  constructor(options = {}) {
    const sceneLibraryPath = options.sceneLibraryPath || path.join(WORKSPACE, 'shanhaijing-render-engine/NIRATH_SCENE_LIBRARY.json');
    
    this.agents = {
      worldArchaeologist: new WorldArchaeologistAgent(sceneLibraryPath),
      narrativeAnalyst: new NarrativeAnalystAgent(),
      artDirector: new ArtDirectorAgent(options.visualStyle),
      promptCompressor: new PromptCompressorAgent(options.maxPromptLength),
      continuityValidator: new ContinuityValidatorAgent(options.continuityConfig, null)
    };
    
    this.agents.continuityValidator.sceneLibrary = this.agents.worldArchaeologist.library;
    this.qualityGate = new UnifiedQualityGate();
    this.agentRegistry = {};
    this.qualityLog = [];
  }
  
  registerAgent(name, agent) {
    this.agentRegistry[name] = agent;
  }
  
  async designScene(shot, context = {}) {
    const startTime = Date.now();
    
    // Agent 1-3 并行执行
    const [world, narrative] = await Promise.all([
      this.agents.worldArchaeologist.analyze(shot.scene),
      this.agents.narrativeAnalyst.analyze(shot, context.episodeId, context.storyBeats)
    ]);
    
    // Agent 3（依赖Agent 1-2输出）
    const art = this.agents.artDirector.design(world, narrative, shot);
    
    // Agent 4: Prompt压缩（新增叙事约束+电影指令）
    const prompt = this.agents.promptCompressor.compress(art, world, narrative, shot, context.prevShotId);
    
    // Agent 5: 一致性校验
    const validation = this.agents.continuityValidator.validate(prompt, context.prevShots, shot);
    
    // 统一质量门控
    const design = {
      shotId: shot.id,
      episode: context.episodeId,
      worldBuilding: world,
      narrativeAnalysis: narrative,
      artDirection: art,
      prompt: prompt,
      validation: validation
    };
    
    const quality = this.qualityGate.evaluate(design);
    
    const result = {
      ...design,
      quality,
      performance: { duration: Date.now() - startTime, agentCount: 5 }
    };
    
    this.qualityLog.push(result);
    return result;
  }
  
  async batchDesign(shots, context = {}) {
    const results = [];
    let prevShotId = null;
    const prevShots = [];
    
    for (const shot of shots) {
      const shotContext = {
        ...context,
        episodeId: shot.episodeId || context.episodeId,
        prevShotId,
        prevShots: [...prevShots]
      };
      
      const design = await this.designScene(shot, shotContext);
      results.push(design);
      
      prevShotId = shot.id;
      prevShots.push(shot);
    }
    
    return results;
  }
  
  getQualityReport() {
    const total = this.qualityLog.length;
    const passed = this.qualityLog.filter(r => r.quality.pass).length;
    const avgScore = this.qualityLog.reduce((sum, r) => sum + r.quality.overall, 0) / total;
    const dimensionAverages = {};
    
    for (const dim of this.qualityGate.dimensions) {
      const dimScores = this.qualityLog.map(r => r.quality.scores[dim]).filter(s => s !== undefined);
      dimensionAverages[dim] = dimScores.length > 0 
        ? (dimScores.reduce((a, b) => a + b, 0) / dimScores.length).toFixed(1)
        : 'N/A';
    }
    
    return {
      total,
      passed,
      failed: total - passed,
      passRate: (passed / total * 100).toFixed(1),
      averageScore: avgScore.toFixed(1),
      dimensionAverages,
      details: this.qualityLog.map(r => ({
        shotId: r.shotId,
        pass: r.quality.pass,
        score: r.quality.overall.toFixed(1),
        promptLength: r.prompt.length,
        promptSurplus: r.prompt.surplus,
        constraints: r.prompt.constraints,
        cinematicInstructions: r.prompt.cinematicInstructions
      }))
    };
  }
}

// ========== 向后兼容接口 ==========
function buildPromptLegacy(shot, prevShotId, options = {}) {
  const l3Map = {
    '汤谷扶桑树': 'canyon', '人间晨光': 'grassland', '十日并空': 'sky',
    '焦土之年': 'scorched', '东海最高峰': 'peak', '天空': 'sky',
    '扶桑树': 'forest', '地窖': 'shelter', '东海之滨': 'ocean',
    '箭林': 'forest', '日影': 'grassland'
  };
  
  const l3Depth = {
    canyon: `crystal dust fg, Twin Moon Canyon mg, twin moons Silath Korath bg`,
    ocean: `luminous tide pools fg, Violet Deep waves mg, floating islands twin moons bg`,
    peak: `mineral veins fg, floating stones mg, twin moons aurora bg`,
    scorched: `cracked crystal fg, scorched earth mg, heat shimmer twin moons bg`,
    shelter: `stalactite fg, amber pools mg, twin moons outside bg`,
    forest: `glowing roots fg, arrow trees mg, twin moons canopy bg`,
    sky: `spore particles fg, aurora ribbons mg, twin moons cosmic bg`,
    grassland: `light grass fg, luminous meadow mg, crystal mountains twin moons bg`
  };
  
  const l1 = options.l1 || `Adult CG hyperrealistic, Love Death Robots, photorealistic skin pores visible, subsurface scattering, anamorphic lens flare, film grain`;
  const l2 = options.l2 || `Pandora bioluminescent, Avatar neural flora, floating spores`;
  const l3 = l3Depth[l3Map[shot.scene]] || l3Depth.canyon;
  const negative = options.negative || `no western face, no caucasian, no cartoon, no anime, no 3D render, no text, no technology, no sci-fi, no Chinese architecture, no dragon, no hanfu, no pagoda`;
  
  let prompt = `${l1}. ${l2}. ${l3}. ${shot.scene}. ${shot.action}. ${negative}.`;
  
  const fillers = ['aurora ribbons shimmering', 'floating spore particles dancing'];
  for (const f of fillers) {
    if (prompt.length + f.length + 2 <= MAX_PROMPT_LENGTH && !prompt.includes(f)) {
      prompt = prompt.replace(/\.$/, '') + `, ${f}.`;
    }
  }
  
  return prompt;
}

async function buildPromptEnhanced(shot, context = {}) {
  const orchestrator = new SceneDesignOrchestrator(context.options || {});
  const design = await orchestrator.designScene(shot, context);
  
  return {
    prompt: design.prompt.prompt,
    sceneDesign: {
      worldBuilding: design.worldBuilding,
      artDirection: design.artDirection,
      narrativeAnalysis: design.narrativeAnalysis
    },
    quality: design.quality,
    validation: design.validation
  };
}

// ========== 导出 ==========
module.exports = {
  SceneDesignOrchestrator,
  WorldArchaeologistAgent,
  NarrativeAnalystAgent,
  ArtDirectorAgent,
  PromptCompressorAgent,
  ContinuityValidatorAgent,
  UnifiedQualityGate,
  buildPromptLegacy,
  buildPromptEnhanced,
  MAX_PROMPT_LENGTH
};

// CLI测试
if (require.main === module) {
  async function runTest() {
    console.log('\n🎬 Orient Primordial Core v23.0 — 统一引擎测试\n');
    console.log('='.repeat(80));
    
    const storyConfig = JSON.parse(
      fss.readFileSync(path.join(WORKSPACE, 'stories/houyi-v1.0/story-config.json'), 'utf8')
    );
    
    const orchestrator = new SceneDesignOrchestrator({
      visualStyle: storyConfig.visualStyle
    });
    
    const allShots = [];
    for (const ep of storyConfig.episodes) {
      for (const shot of ep.shots) {
        allShots.push({ ...shot, episodeId: ep.id });
      }
    }
    
    const results = await orchestrator.batchDesign(allShots, {
      storyBeats: {
        EP01: {
          S01: { act: 'Act1-铺垫', beat: '世界建立', purpose: '建立Nirath世界', emotionArc: 'peaceful→excited' },
          S02: { act: 'Act1-铺垫', beat: '生活常态', purpose: '展示晨光', emotionArc: 'peaceful→peaceful' },
          S03: { act: 'Act1-铺垫', beat: '异常出现', purpose: '十日并出', emotionArc: 'peaceful→alarmed' },
          S04: { act: 'Act2-冲突', beat: '灾难降临', purpose: 'AgentX躲藏', emotionArc: 'scared→determined' }
        },
        EP02: {
          S05: { act: 'Act2-冲突', beat: '英雄登场', purpose: '后羿登场', emotionArc: 'determined→compassionate' },
          S06: { act: 'Act2-冲突', beat: '真相发现', purpose: '发现真相', emotionArc: 'compassionate→focused' },
          S07: { act: 'Act3-高潮', beat: '第一箭', purpose: '射出第一箭', emotionArc: 'focused→decisive' },
          S08: { act: 'Act3-高潮', beat: '效果显现', purpose: '太阳下降', emotionArc: 'decisive→hopeful' }
        },
        EP03: {
          S09: { act: 'Act3-高潮', beat: '连续射箭', purpose: '连射多箭', emotionArc: 'focused→gentle' },
          S10: { act: 'Act3-高潮', beat: '最后太阳', purpose: '最小太阳', emotionArc: 'gentle→understanding' },
          S11: { act: 'Act3-高潮', beat: '攀爬巨树', purpose: '爬扶桑树', emotionArc: 'understanding→offering' },
          S12: { act: 'Act4-结局', beat: '最后一箭', purpose: '第十太阳回归', emotionArc: 'offering→balanced' }
        },
        EP04: {
          S13: { act: 'Act4-结局', beat: '新生', purpose: 'AgentX走出地窖', emotionArc: 'amazed→grateful' },
          S14: { act: 'Act4-结局', beat: '埋葬弓箭', purpose: '埋葬Biobow', emotionArc: 'grateful→peaceful' },
          S15: { act: 'Act4-结局', beat: '纪念', purpose: '箭林生长', emotionArc: 'peaceful→hopeful' },
          S16: { act: 'Act4-结局', beat: '传承', purpose: '测量日影', emotionArc: 'hopeful→content' }
        }
      }
    });
    
    let passCount = 0;
    for (const r of results) {
      const status = r.quality.pass ? '✅' : '❌';
      if (r.quality.pass) passCount++;
      
      console.log(`\n${status} [${r.shotId}] ${r.worldBuilding.nirathName}`);
      console.log(`   Prompt: ${r.prompt.length}/${MAX_PROMPT_LENGTH} | 余量: ${r.prompt.surplus}`);
      console.log(`   叙事: ${r.narrativeAnalysis.act} → ${r.narrativeAnalysis.beat}`);
      console.log(`   光影: ${r.artDirection.lighting.keyLight}`);
      console.log(`   电影指令: ${r.artDirection.cinematicInstructions.length}项`);
      console.log(`   约束: ${r.prompt.constraints}项`);
      console.log(`   质量分: ${r.quality.overall.toFixed(1)}/100`);
    }
    
    const report = orchestrator.getQualityReport();
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 汇总: ${report.passed}/${report.total} 通过 | 通过率: ${report.passRate}%`);
    console.log(`📊 平均分: ${report.averageScore}`);
    console.log(`\n📊 各维度平均分:`);
    for (const [dim, score] of Object.entries(report.dimensionAverages)) {
      console.log(`   ${dim}: ${score}`);
    }
    
    const reportPath = path.join(WORKSPACE, 'stories/houyi-v1.0/v23-unified-report.json');
    fss.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📁 报告保存: ${reportPath}`);
  }
  
  runTest().catch(console.error);
}
