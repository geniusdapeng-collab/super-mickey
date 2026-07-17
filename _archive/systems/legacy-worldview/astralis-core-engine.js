/**
 * ASTRALIS CORE ENGINE — Nirath Opening Title Generator
 * ASTRALIS v3.0 Main Integration Engine
 *
 * Core upgrade from v3.0:
 * 1. Auto-inject Nirath planetary context (astronomy/magnetosphere/ecosystem)
 * 2. Material-motion physical consistency validation
 * 3. Smart word count allocation (no longer fixed segment lengths)
 * 4. Absolute style lock (Nirath tone cannot deviate)
 *
 * @module astralis-core-engine
 * @version 3.0
 */

const MaterialEngine = require('./aetherium-material-engine');
const KineticsEngine = require('./astralis-kinetics-engine');
const SignatureEngine = require('./astralis-signature-engine');
const {
  NIRATH_PLANET_CORE,
  ASTRALIS_LIGHTING_MODEL,
  getStarDescription,
  getMagnetosphereDescription,
  getEcosystemDescription
} = require('./nirath-bible');

/**
 * ASTRALIS CORE — Generate complete Nirath opening title Prompt
 *
 * @param {Object} config - Configuration
 * @param {string} config.titleText - Title text (e.g. "THE NINE-TAILED FOX")
 * @param {string} config.subtitleText - Subtitle text (optional)
 * @param {string} config.producerText - Producer text (e.g. "A Nirath Original by Genius")
 * @param {string} config.kineticsType - Kinetics type (astralEvent/geomorphic/chronos/symbiotic/voidResonance)
 * @param {string} config.kineticsVariant - Kinetics variant ID
 * @param {string} config.signatureMode - Signature mode (magneticFossil/quantumEcho/etc.)
 * @param {Array} config.materials - Material configs [{type, variant}]
 * @param {number} config.duration - Duration in seconds (default 9)
 * @param {boolean} config.celestialContext - Include celestial context (default true)
 * @param {Object} config.customCelestial - Custom celestial context overrides
 * @param {boolean} config.styleLock - Include style lock (default true)
 * @returns {Object} {prompt, lengthCheck, consistencyCheck, nirathFingerprint, modules}
 */
function generateNirathOpening(config) {
  let prompt = '';
  const sectionWeights = calculateSectionWeights(config);

  // ═══════════════════════════════════════
  // Section 1: ASTRALIS Technical Spec (auto-injected, cannot be omitted)
  // ═══════════════════════════════════════
  prompt += generateTechSpec();

  // ═══════════════════════════════════════
  // Section 2: Nirath Astronomical Environment
  // ═══════════════════════════════════════
  if (config.celestialContext !== false) {
    prompt += generateCelestialContext(config.customCelestial);
  }

  // ═══════════════════════════════════════
  // Section 3: AETHERIUM Material Constraints
  // ═══════════════════════════════════════
  if (config.materials && config.materials.length > 0) {
    prompt += `【AETHERIUM材质约束】\n`;
    prompt += MaterialEngine.generateNirathMaterialSection(
      config.materials,
      config.titleText
    );
    prompt += `\n`;
  }

  // ═══════════════════════════════════════
  // Section 4: ASTRALIS KINETICS Motion
  // ═══════════════════════════════════════
  if (config.kineticsType && config.kineticsVariant) {
    prompt += KineticsEngine.generateKineticsPrompt(
      config.kineticsType,
      config.kineticsVariant,
      config.titleText,
      { duration: config.duration || 9, nCount: config.nCount || '3' }
    );
    prompt += `\n`;
  }

  // ═══════════════════════════════════════
  // Section 5: ASTRALIS SIGNATURE Producer Info
  // ═══════════════════════════════════════
  if (config.producerText && config.signatureMode) {
    prompt += SignatureEngine.generateSignaturePrompt(
      config.producerText,
      config.signatureMode,
      {
        titleText: config.titleText,
        titleDuration: config.duration || 9
      }
    );
    prompt += `\n`;
  }

  // ═══════════════════════════════════════
  // Section 6: ASTRALIS Style Lock
  // ═══════════════════════════════════════
  if (config.styleLock !== false) {
    prompt += generateStyleLock();
  }

  // Section 6.5: NIRATH Brightness Mandate (v3.0-patch1)
  // ═══════════════════════════════════════
  const brightnessMandate = require('./nirath-bible').getBrightnessMandate();
  prompt += `【NIRATH明亮约束】${brightnessMandate}\n\n`;

  // ═══════════════════════════════════════
  // Validation & Return
  // ═══════════════════════════════════════
  const lengthCheck = checkPromptLength(prompt, 1470, 1500);
  const consistencyCheck = validatePhysicalConsistency(config);

  return {
    prompt,
    lengthCheck,
    consistencyCheck,
    nirathFingerprint: generateNirathFingerprint(config),
    modules: {
      material: config.materials?.length > 0,
      kinetics: !!config.kineticsType,
      signature: !!config.producerText,
      celestial: config.celestialContext !== false,
      styleLock: config.styleLock !== false
    }
  };
}

/**
 * Generate ASTRALIS Technical Spec (v3.0 exclusive)
 */
function generateTechSpec() {
  return `【ASTRALIS技术规格】超写实渲染，电影级光影+虚拟几何，路径追踪品质。16:9电影画幅，48fps时间分辨率（支持时间扭曲效果）。Nirath星球物理引擎：0.82G重力，3.2Tesla磁场，双恒星光照模型（Aurelius 5800K + Silvana 6500K），大气折射率1.00045，磁光效应可见。每一帧是Nirath星球呼吸的切片。\n\n`;
}

/**
 * Generate Nirath Astronomical Environment context
 */
function generateCelestialContext(custom = {}) {
  return `【Nirath天文环境】${custom.starConfig || getStarDescription()}${custom.magnetosphere || getMagnetosphereDescription()}${custom.atmosphere || '大气含1200个/cm³以太孢子，低重力0.82G下缓慢飘浮沉降。空气折射率1.00045产生强化彩虹效应。'}${custom.ecosystem || '量子苔藓覆盖地表形成生物神经网络，银木林沿磁场线分形生长，磁质体沿磁向优先生长。'}\n\n`;
}

/**
 * Generate Style Lock Declaration
 */
function generateStyleLock() {
  return `【ASTRALIS风格锁死】Nirath星球原生视觉语言，绝对禁止以下偏离：禁止地球标准光照（三点布光/柔光箱）；禁止卡通/动漫/二次元风格；禁止地球常见色彩方案（蓝天绿草标准配色）；禁止物理不合理效果（无来源发光、无介质光线）；禁止模板化片头语言（"史诗级""震撼"等空泛描述）；禁止暗黑/压抑/哥特色调（必须以双恒星明亮光照为主，Aurelius金色5800K提供温暖明亮基调占据画面60%以上光照权重，Silvana银白6500K提供清冷银白高光，阴影区域必须有淡蓝紫磁场光晕填充禁止纯黑死黑，整体必须呈现明亮奇幻而非暗黑压抑）。必须呈现：双恒星天文光照的真实感与明亮感，磁场可见光效应的独特性，低重力环境的飘浮感，生物荧光的有机温度，量子相干性的神秘感。这是Nirath，不是地球。`;
}

/**
 * Physical Consistency Validation (v3.0 new)
 */
function validatePhysicalConsistency(config) {
  const issues = [];

  // Check 1: Material-Motion physical compatibility
  if (config.materials && config.kineticsType) {
    const materials = config.materials.map(m => m.type);

    // FERROFLUX + magnetic_storm_birth = perfect match
    if (materials.includes('ferroflux') && config.kineticsVariant === 'magnetic_storm_birth') {
      issues.push({ type: 'synergy', message: 'FERROFLUX + magnetic_storm_birth = 完美物理协同，推荐' });
    }

    // QUANTUM_MOSS + mycelium_mind = perfect match
    if (materials.includes('quantumMoss') && config.kineticsVariant === 'mycelium_mind') {
      issues.push({ type: 'synergy', message: 'QUANTUM_MOSS + mycelium_mind = 生态网络内外联动，推荐' });
    }

    // VOID_SILK + voidResonance = visual synergy
    if (materials.includes('voidSilk') && config.kineticsType === 'voidResonance') {
      issues.push({ type: 'synergy', message: 'VOID_SILK + voidResonance = 不可见物质协同，推荐' });
    }

    // PLASMA_TENDRIL + astralEvent = energy synergy
    if (materials.includes('plasmaTendril') && config.kineticsType === 'astralEvent') {
      issues.push({ type: 'synergy', message: 'PLASMA_TENDRIL + astralEvent = 高能天文事件协同，推荐' });
    }
  }

  // Check 2: Lighting consistency
  if (config.customLighting) {
    if (config.customLighting.singleSource && !config.customLighting.binaryDisabled) {
      issues.push({ type: 'warning', message: 'Nirath是双星系统，单光源需要解释（如日蚀/夜间场景）' });
    }
  }

  // Check 3: Phase compatibility
  if (config.kineticsType && config.kineticsVariant) {
    const variant = KineticsEngine.getKineticsVariant(config.kineticsType, config.kineticsVariant);
    if (variant && variant.experimental) {
      issues.push({ type: 'warning', message: `${variant.name} 是实验性动效，渲染成功率可能较低` });
    }
  }

  return { valid: issues.filter(i => i.type === 'error').length === 0, issues };
}

/**
 * Generate Nirath Visual Fingerprint
 */
function generateNirathFingerprint(config) {
  return {
    spectral: ['深渊紫', '琥珀金', '量子青', '磁质体紫', '星尘粉'],
    lighting: '双恒星天文光照',
    magnetic: '30Hz可见磁场',
    gravity: '0.82G低重力飘浮',
    biomimetic: '量子苔藓神经网络',
    unique: `ASTRALIS-v3-${Date.now()}`
  };
}

/**
 * Prompt length check
 */
function checkPromptLength(prompt, target = 1470, max = 1500) {
  const current = prompt.length;
  return {
    current,
    target,
    max,
    status: current >= target ? 'ASTRALIS达标' : `还需${target - current}字`,
    nirathDensity: (prompt.match(/Nirath|磁场|量子|孢子|磁流体|等离子|双恒星|Aurelius|Silvana/gi) || []).length,
    suggestion: current < target
      ? '建议补充：材质双恒星互动细节 / 动效时间线细分 / 磁场可见效应描述'
      : 'Prompt已满载Nirath能量'
  };
}

/**
 * Smart section weight calculation
 */
function calculateSectionWeights(config) {
  const weights = {
    techSpec: 120,
    celestial: 150,
    materials: 0,
    kinetics: 0,
    signature: 0,
    styleLock: 100
  };

  if (config.materials) {
    weights.materials = Math.min(config.materials.length * 60, 300);
  }
  if (config.kineticsType) {
    const variant = KineticsEngine.getKineticsVariant(config.kineticsType, config.kineticsVariant);
    if (variant && variant.timeline) {
      weights.kinetics = Object.keys(variant.timeline).length * 40;
    }
  }
  if (config.producerText) {
    weights.signature = 80;
  }

  return weights;
}

/**
 * Quick generation for common use cases
 */
function quickGenerate(titleText, producerText, options = {}) {
  const defaults = {
    kineticsType: 'astralEvent',
    kineticsVariant: 'binary_convergence',
    signatureMode: 'magneticFossil',
    materials: [
      { type: 'ferroflux', variant: 'titleForm' },
      { type: 'quantumMoss', variant: 'growthPath' }
    ],
    duration: 9,
    celestialContext: true
  };

  return generateNirathOpening({
    ...defaults,
    ...options,
    titleText,
    producerText
  });
}

module.exports = {
  generateNirathOpening,
  quickGenerate,
  generateTechSpec,
  generateCelestialContext,
  generateStyleLock,
  validatePhysicalConsistency,
  generateNirathFingerprint,
  checkPromptLength,
  calculateSectionWeights
};
