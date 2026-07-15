/**
 * Nirath核心锚点 - v19.0-Peng 超快节奏升级版
 *
 * 总预算: 980英文字符（对应490中文字 / 火山引擎官方500中文上限）
 *
 * 队长v19.0三大升级:
 * 1. 动作更敏捷 — sprint/dash/leap/bolt/vault 替代 trudge/spot/scramble
 * 2. 信息密度更高 — L2三层景深(前景/中景/背景) + 粒子密度 + 材质复杂度
 * 3. 节奏更快 — 22镜×~4秒 = 90秒快切快剪
 * 4. 多角度定妆照 — 5-6角度/角色，全部传入referenceImages
 */

// ========== Layer1: 渲染器 & CG成人写实风格 (~98字符) ==========
// v15.0: 明确指向Love Death Robots成熟CG美学，杜绝儿童卡通
const L1_CHARACTER = `Adult CG, Love Death Robots style, photorealistic skin shader, anamorphic lens, gritty realistic, dark atmospheric, film grain, chromatic aberration, high contrast shadows.`;

// ========== Layer2: 卡梅隆生物发光生态系统 + 高密度信息层 (~220字符) ==========
// v19.0: 三层景深+粒子密度+材质复杂度，严控长度不超预算
const L2_ENVIRONMENT = `Dense Pandora bioluminescent ecosystem, Avatar glowing neural flora, moss carpets, light canopy trees, floating spores, amber bark glow, rich foreground detail, layered mid-ground depth, background scale, dense haze, volumetric fog, particle density, complex surface textures, multi-plane visual depth.`;

// ========== Layer3: 场景定制 (~55-75字符/场景) ==========
// v15.0: 大爆炸后科技归零，所有场景为纯粹自然地貌+异兽生态
const L3_SCENES = {
  mountain: `Floating crystal peaks, luminous mist waterfalls, glowing stone formations, massive scale depth, distant haze.`,
  forest: `Bioluminescent woods, ancient tree giants, glowing roots, living forest light, dense canopy layers, undergrowth detail.`,
  cave: `Crystal cavern, glowing stalactites, sacred light pool, natural cathedral, mineral vein detail.`,
  geothermal: `Golden hot spring pools, mineral terraces, steam, geothermal paradise, thermal shimmer.`,
  water: `Rainbow light stream, luminous pebbles, mist drift, river of living light, current motion.`,
  plain: `Vast luminous wilderness, firefly clouds, memory mist, rolling grasslands, horizon depth.`,
  sacred: `Divine light altar, floating energy crystals, energy aura, sacred organic power, geometry detail.`,
  default: `Primordial luminous wilderness.`
};

// ========== Layer4: 角色锚点 (~90字符) ==========
// v15.0: 普通人类男孩锚点 — CG成人写实风格（非卡通Q版），严禁奇幻化
const L4_CHARACTERS = {
  human_child: `Chinese boy 8yo 130cm, East Asian round face, straight black hair, black eyes, fair skin, blue striped pajamas, barefoot, small build.`,

  human_adult_male: `Ancient tribal male, weathered skin, strong bone, natural hair, determined.`,

  human_adult_female: `Ancient tribal female, delicate features, luminous ornament, soft grace.`,

  dragon: `Mountain-sized translucent scaled serpent, magma-glow within, horn rings, towering massive.`,

  bird: `Eagle-sized iridescent plumage, feather barb detail, organic wing structure.`,

  beast: `Elephant-sized to horse-sized, fur natural flow, biological anatomy, weathered claw, alert.`,

  default: `Photorealistic anatomy, natural material, cinematic, 8K.`
};

// ========== 负面约束 (~320字符) ==========
// v20.0: 全面覆盖队长要求 — 亚洲面孔 + 无中国元素 + 无西方元素 + 无卡通
const NEGATIVE_CONSTRAINTS = `No text letters symbols writing, no glowing eyes, no fire breath, no light beams from protagonist, no technology, no sci-fi, no cartoon anime manga cel shading toon shader Disney Pixar family-friendly bright saturated colors rounded cute features, no mechanical, no Q-version, no Chinese architecture dragon hanfu pagoda temple calligraphy traditional oriental elements Great Wall terracotta lantern garden bonsai bamboo lotus pine, no Western castle knight Gothic cathedral European armor cross church medieval Viking, no modern building car airplane phone screen electricity wire`;
// ========== v15.1: 空余空间增强模块 ==========
// 队长建议: 合规检查后发现空余空间，自动追加表情/环境细节提升
// 所有模块长度经过精确测量，按优先级和短到长排序

/** 表情增强模块 — 优先级: P1（队长首推） */
const EMOTION_ENHANCEMENTS = {
  human_child: [
    `genuine joyful smile, natural childlike wonder.`,          // 46
    `expressive curious face, warm innocent glow.`,              // 45
    `natural happy expression, authentic emotion.`,               // 43
  ],
  human_adult_male: [
    `weathered wise expression, steady determined gaze.`,       // 52
    `calm confident look, subtle emotional depth.`,             // 45
    `focused alert expression, natural human warmth.`,          // 48
  ],
  human_adult_female: [
    `gentle knowing smile, graceful serene warmth.`,            // 46
    `calm maternal glow, quiet inner strength.`,                // 43
    `soft expressive features, authentic kindness.`,            // 46
  ],
  default: [
    `expressive natural face, subtle authentic emotion.`,       // 52
    `genuine warm expression, lifelike personality.`,           // 46
    `natural emotional depth, organic character warmth.`,       // 49
  ]
};

/** 环境细节增强模块 — 优先级: P2（队长次推） */
const ENVIRONMENT_ENHANCEMENTS = {
  mountain: [
    `granite texture crystalline facets, wind-swept mist detail.`,      // 58
    `atmospheric haze depth layers, mineral richness.`,                 // 47
    `crystal refraction subtle detail, vast scale.`,                    // 43
  ],
  forest: [
    `dappled light filtering canopy, floating spore particles.`,        // 59
    `rich undergrowth texture layers, organic complexity.`,             // 52
    `depth of field natural blur, atmospheric depth.`,                  // 48
  ],
  cave: [
    `water droplets catching light, mineral crystal surfaces.`,         // 56
    `echoing vast spatial depth, damp organic texture.`,               // 50
    `subtle mineral vein details, natural rock warmth.`,                // 49
  ],
  geothermal: [
    `steam condensation particles, mineral crust detail.`,              // 52
    `thermal shimmer distortion, hot spring algae texture.`,            // 55
    `natural mineral deposition detail, warm organic mist.`,            // 53
  ],
  water: [
    `ripples catching prism light, submerged luminous flora.`,          // 55
    `mist depth layers atmospheric, natural water clarity.`,            // 52
    `organic shoreline texture detail, flowing current motion.`,      // 57
  ],
  plain: [
    `rolling grass texture detail, distant atmospheric haze.`,         // 55
    `natural earth tone richness, wind movement detail.`,               // 50
    `organic horizon depth layers, subtle terrain detail.`,             // 51
  ],
  sacred: [
    `energy field subtle distortion, floating particle motes.`,        // 57
    `sacred geometry organic texture, natural power emanation.`,      // 60
    `atmospheric reverberation detail, pure natural luminescence.`,     // 59
  ],
  default: [
    `atmospheric particles depth, organic texture richness.`,          // 52
    `natural light scattering detail, environmental depth.`,           // 50
    `organic texture subtle complexity, natural ambient detail.`,     // 55
  ]
};

/** 光影质感增强模块 — 优先级: P3（画质锦上添花） */
const LIGHTING_ENHANCEMENTS = [
  { text: `cinematic depth of field, subtle vignette.`, len: 42 },           // 景深+暗角
  { text: `natural shadow complexity, organic occlusion.`, len: 48 },        // 阴影复杂度
  { text: `subsurface light scattering, translucent skin.`, len: 49 },       // 次表面散射
  { text: `atmospheric perspective depth, organic haze.`, len: 47 },       // 大气透视
  { text: `natural rim lighting, warm ambient bounce.`, len: 44 },          // 轮廓光+环境反射
  { text: `organic texture detail, environmental storytelling.`, len: 52 },   // 环境叙事
  { text: `emotional cinematic lighting, natural warmth.`, len: 46 },      // 情绪灯光
];

/** 智能空余填充引擎 */
function _fillSurplus(prompt, sceneType, charType, maxLength) {
  const surplus = maxLength - prompt.length;
  if (surplus < 20) return prompt; // 少于20字符不做增强

  const usedModules = [];
  const modulesToAppend = [];

  // === P1: 表情增强 ===
  const emotionList = EMOTION_ENHANCEMENTS[charType] || EMOTION_ENHANCEMENTS.default;
  for (const module of emotionList.sort((a, b) => a.length - b.length)) {
    const needed = module.length + 2; // +2 for ", " separator
    if (prompt.length + needed + modulesToAppend.reduce((s, m) => s + m.length + 2, 0) <= maxLength) {
      modulesToAppend.push(module.replace(/\.$/, '')); // strip trailing period
      usedModules.push(`表情+${module.length}`);
      break;
    }
  }

  // === P2: 环境细节增强 ===
  const envList = ENVIRONMENT_ENHANCEMENTS[sceneType] || ENVIRONMENT_ENHANCEMENTS.default;
  for (const module of envList.sort((a, b) => a.length - b.length)) {
    const needed = module.length + 2;
    if (prompt.length + needed + modulesToAppend.reduce((s, m) => s + m.length + 2, 0) <= maxLength) {
      modulesToAppend.push(module.replace(/\.$/, ''));
      usedModules.push(`环境+${module.length}`);
      break;
    }
  }

  // === P3: 光影质感增强（v17.0: 大幅精简，优先保L2密度） ===
  const sortedLight = [...LIGHTING_ENHANCEMENTS].sort((a, b) => a.len - b.len);
  for (const module of sortedLight.slice(0, 2)) { // 最多2个光影模块
    const needed = module.len + 2;
    if (prompt.length + needed + modulesToAppend.reduce((s, m) => s + m.length + 2, 0) <= maxLength) {
      modulesToAppend.push(module.text.replace(/\.$/, ''));
      usedModules.push(`光影+${module.len}`);
    }
  }

  // 统一追加所有模块
  if (modulesToAppend.length > 0) {
    const cleanPrompt = prompt.replace(/\.$/, ''); // strip trailing period
    prompt = cleanPrompt + ', ' + modulesToAppend.join(', ') + '.';
    console.log(`  [增强] ${usedModules.join(', ')} | 最终${prompt.length}/${maxLength}`);
  }

  return prompt;
}

// ========== 组合函数(960字符硬控,预留20字符缓冲) ==========
function buildOrientPrompt(sceneType, charType, action, maxLength = 960) {
  const l3 = L3_SCENES[sceneType] || L3_SCENES.default;
  const l4 = L4_CHARACTERS[charType] || L4_CHARACTERS.default;

  // 固定基座部分（不可裁剪）
  const base = `${L1_CHARACTER} ${L2_ENVIRONMENT}`;
  const core = `${l3} ${l4}`;
  const negative = NEGATIVE_CONSTRAINTS;

  // 先尝试完整组合（含负面约束）
  let prompt = `${base} ${core} ${action} ${negative}`;

  if (prompt.length > maxLength) {
    // 第一步：裁剪action，保留最低40字符
    const excess = prompt.length - maxLength;
    const actionTrim = Math.max(40, action.length - excess);
    const trimmedAction = action.substring(0, actionTrim);

    prompt = `${base} ${core} ${trimmedAction} ${negative}`;

    if (prompt.length > maxLength) {
      // 第二步：裁剪L3场景，保留最低20字符
      const excess2 = prompt.length - maxLength;
      const sceneTrim = Math.max(20, l3.length - excess2);
      const trimmedScene = l3.substring(0, sceneTrim);

      prompt = `${base} ${trimmedScene} ${l4} ${trimmedAction} ${negative}`;
    }
  }

  // v15.1: 空余空间智能填充 — 表情+环境+光影
  prompt = _fillSurplus(prompt, sceneType, charType, maxLength);

  return prompt;
}

module.exports = {
  L1_CHARACTER,
  L2_ENVIRONMENT,
  L3_SCENES,
  L4_CHARACTERS,
  NEGATIVE_CONSTRAINTS,
  buildOrientPrompt
};
