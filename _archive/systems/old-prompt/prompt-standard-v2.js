/**
 * Seedance 2.0 Prompt 标准模块 v2.0
 * 
 * 适用范围：Seedance 2.0 文生视频
 * 总字符控制：970 字符（最佳区间 1470-990）
 * 核心理念：P0 保角色，P1 保叙事与视听，P2 保质量与声音，P3 保风格
 * 每一字符必须服务于画面生成
 * 
 * 全链路统一引用：剧本生成 → 导演优化 → 编剧精简 → 审核 → 渲染组装
 */

'use strict';

// 模块元数据
const VERSION = '2.0';
const MAX_PROMPT_LENGTH = 1500;
const AUDIT_AVAILABLE = false; // 是否启用完整性检查（向后兼容）

// ============================================================
// 一、字段定义（10个维度）
// ============================================================

const FIELD_DEFINITIONS = {
  CHARACTER: {
    priority: 'P0',
    label: '角色锚点',
    required: true,
    // v6.2-patch87-3: 角色一致性由 referenceImages/定妆照 保持
    // Prompt中只需极简身份锚点，省略外貌描述
    baselineChars: '角色ID引用不可删',
    targetLength: 30,  // 从140降到30（省110字符给环境/情绪/材质）
    minLength: 10,
    trimStrategy: 'never' // P0绝不裁剪
  },
  ACTION: {
    priority: 'P1',
    label: '动作表演',
    required: true,
    baselineChars: '核心动作动词+交互对象不可删',
    targetLength: 85,
    minLength: 40,
    trimStrategy: 'protect' // P1保护裁剪
  },
  SCENE: {
    priority: 'P1',
    label: '场景环境',
    required: true,
    baselineChars: '核心地点+≥2种材质细节不可删',
    targetLength: 175,
    minLength: 100,
    trimStrategy: 'protect'
  },
  MOOD: {
    priority: 'P1',
    label: '情绪氛围',
    required: true,
    baselineChars: '至少保留3个核心词',
    targetLength: 35,
    minLength: 15,
    trimStrategy: 'protect'
  },
  CAMERA: {
    priority: 'P1',
    label: '运镜控制',
    required: true,
    baselineChars: '景别+核心运镜词不可删',
    targetLength: 115,
    minLength: 60,
    trimStrategy: 'protect'
  },
  LIGHTING: {
    priority: 'P1',
    label: '光影方案',
    required: true,
    baselineChars: '主光方向+色温数值不可删',
    targetLength: 95,
    minLength: 50,
    trimStrategy: 'protect'
  },
  NEGATIVE: {
    priority: 'P2',
    label: '负面提示',
    required: true,
    baselineChars: '项目级标准排除项不可删',
    targetLength: 70,
    minLength: 40,
    trimStrategy: 'moderate' // P2适度裁剪
  },
  AUDIO: {
    priority: 'P2',
    label: '音频叙事',
    required: true,
    baselineChars: '核心台词+声音标识不可删',
    targetLength: 65,
    minLength: 30,
    trimStrategy: 'moderate'
  },
  RENDER: {
    priority: 'P2',
    label: '渲染风格',
    required: true,
    baselineChars: '风格核心词不可删',
    targetLength: 45,
    minLength: 20,
    trimStrategy: 'moderate'
  },
  DIRECTOR: {
    priority: 'P3',
    label: '导演风格',
    required: true,
    baselineChars: '导演标识不可删',
    targetLength: 30,
    minLength: 15,
    trimStrategy: 'aggressive' // P3优先裁剪
  }
};

const FIELD_ORDER = [
  'CHARACTER', 'ACTION', 'SCENE', 'MOOD', 'CAMERA', 'LIGHTING',
  'NEGATIVE', 'AUDIO', 'RENDER', 'DIRECTOR'
];

const PRIORITY_ORDER = ['P3', 'P2', 'P1', 'P0']; // 裁剪优先级（P3先被裁）

// ============================================================
// 二、分隔符规范
// ============================================================

const SEPARATOR = ' | ';
const FIELD_PREFIX = ': ';
const MAX_TOTAL_CHARS = 970;
const TARGET_MIN_CHARS = 1470;
const TARGET_MAX_CHARS = 990;
const FORMAT_OVERHEAD = 110; // 字段标记+分隔符

// ============================================================
// 三、模板库
// ============================================================

const NEGATIVE_TEMPLATES = {
  fantasy: 'no deformed hands, no extra fingers, no modern objects, no text watermark, no cartoon style, no flat lighting, no oversaturated colors, no anime eyes, no glowing eyes, no metal armor, no metal texture, no metallic sheen',
  realistic: 'no anime, no illustration, no 3D render look, no oversaturation, no deformed hands, no extra limbs, no shaky cam, no cartoon style, no flat lighting',
  scifi: 'no fantasy elements, no magic glow, no medieval objects, no deformed anatomy, no low poly, no cartoon style, no flat lighting, no modern objects'
};

const RENDER_TEMPLATES = {
  cinematic: '写实电影级, 4K超清, 胶片颗粒, 色彩分级',
  hyperrealistic: '超写实, 8K超清, 体积光, 光线追踪反射',
  stylized: '风格化电影级, 鲜艳配色, 动态光影, 艺术构图'
};

const DIRECTOR_TEMPLATES = {
  cameron: 'Cameron-scale contrast, epic bioluminescent ecosystems, grand scale environmental storytelling',
  villeneuve: 'Villeneuve-scale negative space, contemplative pacing, monolithic architecture, atmospheric fog',
  spielberg: 'Spielberg-scale emotional warmth, dappled golden light, intimate character moments, wonder',
  jackson: 'Jackson-scale epic fantasy, sweeping aerial vistas, detailed worldbuilding, mythic grandeur'
};

// ============================================================
// 四、镜头类型权重表
// ============================================================

const SHOT_TYPE_WEIGHTS = {
  'close-up': {
    total: 960,
    weights: { CHARACTER: 0.25, ACTION: 0.30, SCENE: 0.10, CAMERA: 0.20, LIGHTING: 0.15 }
  },
  'medium': {
    total: 970,
    weights: { CHARACTER: 0.20, ACTION: 0.25, SCENE: 0.20, CAMERA: 0.18, LIGHTING: 0.17 }
  },
  'wide': {
    total: 990,
    weights: { CHARACTER: 0.12, ACTION: 0.15, SCENE: 0.35, CAMERA: 0.20, LIGHTING: 0.18 }
  },
  'establishing': {
    total: 990,
    weights: { CHARACTER: 0.10, ACTION: 0.12, SCENE: 0.38, CAMERA: 0.22, LIGHTING: 0.18 }
  },
  'action': {
    total: 1500,
    weights: { CHARACTER: 0.15, ACTION: 0.35, SCENE: 0.20, CAMERA: 0.18, LIGHTING: 0.12 }
  },
  'reaction': {
    total: 1470,
    weights: { CHARACTER: 0.30, ACTION: 0.20, SCENE: 0.15, CAMERA: 0.15, LIGHTING: 0.20 }
  }
};

// ============================================================
// 五、Prompt组装器
// ============================================================

/**
 * 构建标准格式Prompt
 * @param {Object} fields - 10个字段的内容
 * @param {Object} options - 选项
 * @returns {String} 标准格式Prompt
 */
function buildPrompt(fields, options = {}) {
  const { shotType = 'medium', projectType = 'fantasy' } = options;
  
  // 自动填充模板
  const enrichedFields = { ...fields };
  if (!enrichedFields.NEGATIVE) {
    enrichedFields.NEGATIVE = getNegativeTemplate(projectType);
  }
  if (!enrichedFields.RENDER) {
    enrichedFields.RENDER = RENDER_TEMPLATES.cinematic;
  }
  if (!enrichedFields.DIRECTOR) {
    enrichedFields.DIRECTOR = DIRECTOR_TEMPLATES.cameron;
  }
  
  // 按字段顺序组装
  const parts = [];
  for (const fieldName of FIELD_ORDER) {
    const content = enrichedFields[fieldName];
    if (content && content.trim()) {
      parts.push(`${fieldName}${FIELD_PREFIX}${content.trim()}`);
    }
  }
  
  const prompt = parts.join(SEPARATOR);
  
  // 如果超出上限，进行智能裁剪
  if (prompt.length > MAX_TOTAL_CHARS) {
    return smartTrim(prompt, { 
      targetLength: MAX_TOTAL_CHARS,
      shotType,
      ...options 
    });
  }
  
  return prompt;
}

/**
 * 获取负面提示模板
 * @param {String} projectType - 项目类型：fantasy/realistic/scifi
 * @returns {String} NEGATIVE模板
 */
function getNegativeTemplate(projectType) {
  return NEGATIVE_TEMPLATES[projectType] || NEGATIVE_TEMPLATES.fantasy;
}

/**
 * 获取渲染风格模板
 * @param {String} style - 风格类型：cinematic/hyperrealistic/stylized
 * @returns {String} RENDER模板
 */
function getRenderTemplate(style) {
  return RENDER_TEMPLATES[style] || RENDER_TEMPLATES.cinematic;
}

/**
 * 获取导演风格模板
 * @param {String} director - 导演名：cameron/villeneuve/spielberg/jackson
 * @returns {String} DIRECTOR模板
 */
function getDirectorTemplate(director) {
  return DIRECTOR_TEMPLATES[director] || DIRECTOR_TEMPLATES.cameron;
}

// ============================================================
// 六、智能裁剪引擎
// ============================================================

/**
 * 智能裁剪：按优先级保护字段
 * @param {String} prompt - 原始Prompt
 * @param {Object} options - 裁剪选项
 * @returns {String} 裁剪后的Prompt
 */
function smartTrim(prompt, options = {}) {
  const { 
    targetLength = MAX_TOTAL_CHARS, 
    shotType = 'medium',
    protectFields = [],
    strategy = 'balanced' // 'minimal' | 'balanced' | 'aggressive'
  } = options;
  
  if (prompt.length <= targetLength) return prompt;
  
  // v6.2-patch102-fix: 保护所有【】包裹的独立区块（镜头时间轴、环境质感、环境音效、旁白/台词等）
  const protectedBlocks = [];
  let protectedPrompt = prompt;
  const blockRegex = /【[^】]+】[^【]*/g;
  let match;
  let blockIndex = 0;
  while ((match = blockRegex.exec(prompt)) !== null) {
    const placeholder = `__PROTECTED_BLOCK_${blockIndex}__`;
    protectedBlocks.push({ placeholder, content: match[0] });
    protectedPrompt = protectedPrompt.replace(match[0], placeholder);
    blockIndex++;
  }
  
  // 对去除保护区块后的prompt进行字段解析和裁剪
  const fields = parsePrompt(protectedPrompt);
  if (!fields) {
    // 解析失败，回退到硬截断（需恢复保护区块）
    let result = hardTrim(protectedPrompt, targetLength);
    // 恢复保护区块
    protectedBlocks.forEach(({ placeholder, content }) => {
      result = result.replace(placeholder, content);
    });
    return result;
  }
  
  // 计算需要裁剪的字符数
  let excess = protectedPrompt.length - targetLength;
  
  // 按优先级顺序裁剪（P3 → P2 → P1 → P0）
  for (const priority of PRIORITY_ORDER) {
    if (excess <= 0) break;
    
    for (const fieldName of FIELD_ORDER) {
      if (excess <= 0) break;
      
      const fieldDef = FIELD_DEFINITIONS[fieldName];
      if (fieldDef.priority !== priority) continue;
      
      // 检查是否在保护列表中
      if (protectFields.includes(fieldName)) continue;
      
      const field = fields[fieldName];
      if (!field || !field.content) continue;
      
      // 计算该字段可裁剪量
      const currentLen = field.content.length;
      const minLen = fieldDef.minLength;
      const maxTrim = currentLen - minLen;
      
      if (maxTrim <= 0) continue;
      
      // 根据策略调整裁剪量
      let trimAmount = Math.min(excess, maxTrim);
      if (strategy === 'minimal') {
        trimAmount = Math.min(trimAmount, Math.floor(maxTrim * 0.3));
      } else if (strategy === 'aggressive') {
        trimAmount = Math.min(trimAmount, Math.floor(maxTrim * 0.8));
      } else {
        trimAmount = Math.min(trimAmount, Math.floor(maxTrim * 0.5));
      }
      
      // 执行裁剪
      field.content = trimFieldContent(field.content, trimAmount, fieldDef);
      excess -= (currentLen - field.content.length);
    }
  }
  
  // 重新组装
  let result = assembleFromFields(fields);
  
  // 恢复保护区块
  protectedBlocks.forEach(({ placeholder, content }) => {
    result = result.replace(placeholder, content);
  });
  
  // 如果仍然超长，最后手段：优先裁剪P3/DIRECTOR字段，绝不碰保护区块
  if (result.length > targetLength) {
    // 尝试从DIRECTOR字段再裁一点
    const resultFields = parsePrompt(result);
    if (resultFields && resultFields.DIRECTOR) {
      const extra = result.length - targetLength;
      const dir = resultFields.DIRECTOR.content;
      if (dir.length > 15) {
        resultFields.DIRECTOR.content = dir.substring(0, Math.max(15, dir.length - extra));
        result = assembleFromFields(resultFields);
        // 再次恢复保护区块（组装可能清除了它们）
        protectedBlocks.forEach(({ placeholder, content }) => {
          if (!result.includes(content)) {
            result = result + ' ' + content;
          }
        });
      }
    }
    // 如果还是超长，硬截断非保护部分
    if (result.length > targetLength) {
      // 找到最后一个保护区块后的位置进行截断
      let lastBlockEnd = 0;
      protectedBlocks.forEach(({ content }) => {
        const idx = result.indexOf(content);
        if (idx !== -1) {
          lastBlockEnd = Math.max(lastBlockEnd, idx + content.length);
        }
      });
      if (lastBlockEnd > 0 && lastBlockEnd < result.length) {
        // 在保护区块之后截断
        const beforeBlocks = result.substring(0, lastBlockEnd);
        if (beforeBlocks.length <= targetLength) {
          result = beforeBlocks;
        } else {
          // 保护区块本身就很长，只能截断保护区块之间
          result = hardTrim(result, targetLength);
        }
      } else {
        result = hardTrim(result, targetLength);
      }
    }
  }
  
  return result;
}

/**
 * 裁剪字段内容：优先在句子/短语边界裁剪
 * @param {String} content - 字段内容
 * @param {Number} trimAmount - 需要裁剪的字符数
 * @param {Object} fieldDef - 字段定义
 * @returns {String} 裁剪后的内容
 */
function trimFieldContent(content, trimAmount, fieldDef) {
  const targetLen = content.length - trimAmount;
  
  // 优先在中文标点处裁剪
  const punctuationMarks = /[。，；！？.，;!?]/g;
  let lastIndex = -1;
  let match;
  
  while ((match = punctuationMarks.exec(content)) !== null) {
    if (match.index <= targetLen) {
      lastIndex = match.index + 1;
    } else {
      break;
    }
  }
  
  if (lastIndex > 0) {
    return content.substring(0, lastIndex).trim();
  }
  
  // 其次在英文标点处
  const enPunctuation = /[.,;!?]/g;
  lastIndex = -1;
  while ((match = enPunctuation.exec(content)) !== null) {
    if (match.index <= targetLen) {
      lastIndex = match.index + 1;
    } else {
      break;
    }
  }
  
  if (lastIndex > 0) {
    return content.substring(0, lastIndex).trim();
  }
  
  // 最后在空格处
  const spaceIndex = content.lastIndexOf(' ', targetLen);
  if (spaceIndex > 0) {
    return content.substring(0, spaceIndex).trim();
  }
  
  // 最后手段硬截断
  return content.substring(0, targetLen).trim();
}

/**
 * 硬截断：在分隔符处截断
 * @param {String} prompt - Prompt字符串
 * @param {Number} maxLength - 最大长度
 * @returns {String} 截断后的字符串
 */
function hardTrim(prompt, maxLength) {
  if (prompt.length <= maxLength) return prompt;
  
  // 找到最后一个在maxLength之前的分隔符
  let lastSeparator = -1;
  let pos = 0;
  while (pos < prompt.length) {
    const sepIndex = prompt.indexOf(SEPARATOR, pos);
    if (sepIndex === -1 || sepIndex > maxLength) break;
    lastSeparator = sepIndex;
    pos = sepIndex + SEPARATOR.length;
  }
  
  if (lastSeparator > 0) {
    return prompt.substring(0, lastSeparator);
  }
  
  return prompt.substring(0, maxLength);
}

// ============================================================
// 七、Prompt解析器
// ============================================================

/**
 * 解析标准格式Prompt为字段对象
 * @param {String} prompt - 标准格式Prompt
 * @returns {Object|null} 字段对象 {FIELDNAME: {content, original}}
 */
function parsePrompt(prompt) {
  const fields = {};
  const parts = prompt.split(SEPARATOR);
  
  for (const part of parts) {
    const colonIndex = part.indexOf(FIELD_PREFIX);
    if (colonIndex === -1) continue;
    
    const fieldName = part.substring(0, colonIndex).trim();
    const content = part.substring(colonIndex + FIELD_PREFIX.length).trim();
    
    if (FIELD_DEFINITIONS[fieldName]) {
      fields[fieldName] = {
        content: content,
        original: part
      };
    }
  }
  
  return fields;
}

/**
 * 从字段对象重新组装Prompt
 * @param {Object} fields - 字段对象
 * @returns {String} 组装后的Prompt
 */
function assembleFromFields(fields) {
  const parts = [];
  for (const fieldName of FIELD_ORDER) {
    if (fields[fieldName] && fields[fieldName].content) {
      parts.push(`${fieldName}${FIELD_PREFIX}${fields[fieldName].content}`);
    }
  }
  return parts.join(SEPARATOR);
}

// ============================================================
// 八、导演/编剧优化器
// ============================================================

/**
 * 优化Prompt：按导演意图增强特定字段
 * @param {String} prompt - 原始Prompt
 * @param {Object} options - 优化选项
 * @returns {String} 优化后的Prompt
 */
function optimize(prompt, options = {}) {
  const {
    enhancement = null, // 要增强的字段：camera/lighting/character/scene
    protectPriority = ['P0', 'P1'], // 保护的优先级
    targetLength = MAX_TOTAL_CHARS,
    shotType = 'medium'
  } = options;
  
  const fields = parsePrompt(prompt);
  if (!fields) return prompt;
  
  // 如果要增强某个字段，检查是否有空间
  if (enhancement && fields[enhancement]) {
    const currentLen = prompt.length;
    if (currentLen < targetLength) {
      // 有空间，可以增强
      const availableSpace = targetLength - currentLen;
      // 这里可以调用外部增强逻辑，或返回指示
      // 实际增强由调用方（导演Agent）决定内容
    }
  }
  
  // 如果超出目标长度，进行保护性裁剪
  if (prompt.length > targetLength) {
    const protectFields = [];
    for (const [fieldName, def] of Object.entries(FIELD_DEFINITIONS)) {
      if (protectPriority.includes(def.priority)) {
        protectFields.push(fieldName);
      }
    }
    return smartTrim(prompt, { targetLength, protectFields, shotType });
  }
  
  return prompt;
}

// ============================================================
// 九、审核检查清单（15项验证）
// ============================================================

const CHECKLIST = [
  { id: 'allFields', name: '全部10个字段均存在', check: checkAllFieldsExist },
  { id: 'totalLength', name: '总字符数在950-990区间内', check: checkTotalLength },
  { id: 'characterContent', name: 'CHARACTER包含种族+核心服装色+关键配饰', check: checkCharacterContent },
  { id: 'actionContent', name: 'ACTION包含可执行的动作动词+交互对象', check: checkActionContent },
  { id: 'sceneContent', name: 'SCENE包含核心地点+≥2种材质细节', check: checkSceneContent },
  { id: 'moodFormat', name: 'MOOD为3-5个关键词，无长句', check: checkMoodFormat },
  { id: 'cameraContent', name: 'CAMERA包含景别+焦段+运镜方式', check: checkCameraContent },
  { id: 'lightingContent', name: 'LIGHTING包含主光方向+色温数值（保留K值）', check: checkLightingContent },
  { id: 'negativeTemplate', name: 'NEGATIVE使用项目标准模板+特殊排除项', check: checkNegativeTemplate },
  { id: 'audioFormat', name: 'AUDIO台词压缩为关键词句，无完整长句', check: checkAudioFormat },
  { id: 'renderContent', name: 'RENDER声明风格+质量，无角色/背景分离指令', check: checkRenderContent },
  { id: 'directorContent', name: 'DIRECTOR包含导演名+1项风格参数', check: checkDirectorContent },
  { id: 'noConflict', name: '字段间无描述冲突', check: checkNoConflict },
  { id: 'characterConsistency', name: '同一角色描述与系列锁定句一致', check: checkCharacterConsistency },
  { id: 'separatorValid', name: '所有|均为分隔符，字段内容内部无未转义竖线', check: checkSeparatorValid }
];

/**
 * 验证Prompt是否符合标准
 * @param {String} prompt - Prompt字符串
 * @param {Object} options - 验证选项
 * @returns {Object} {passed: boolean, errors: [], warnings: [], details: {}}
 */
function validate(prompt, options = {}) {
  const {
    checkCharacterConsistency = false,
    lockedCharacter = null, // 系列锁定角色描述
    projectType = 'fantasy'
  } = options;
  
  const errors = [];
  const warnings = [];
  const details = {};
  
  const fields = parsePrompt(prompt);
  
  if (!fields) {
    return {
      passed: false,
      errors: ['Prompt无法解析为标准字段格式'],
      warnings: [],
      details: {}
    };
  }
  
  // 执行所有检查项
  for (const checkItem of CHECKLIST) {
    try {
      const result = checkItem.check(prompt, fields, { 
        projectType, 
        lockedCharacter,
        checkCharacterConsistency 
      });
      
      details[checkItem.id] = result;
      
      if (!result.passed) {
        if (result.severity === 'error') {
          errors.push(`${checkItem.name}: ${result.message}`);
        } else {
          warnings.push(`${checkItem.name}: ${result.message}`);
        }
      }
    } catch (e) {
      errors.push(`${checkItem.name}: 检查执行失败 - ${e.message}`);
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
    details
  };
}

// 各检查项的具体实现
function checkAllFieldsExist(prompt, fields) {
  const missing = [];
  for (const fieldName of FIELD_ORDER) {
    if (!fields[fieldName] || !fields[fieldName].content) {
      missing.push(fieldName);
    }
  }
  return {
    passed: missing.length === 0,
    severity: 'error',
    message: missing.length > 0 ? `缺少字段: ${missing.join(', ')}` : '全部10个字段均存在'
  };
}

function checkTotalLength(prompt, fields) {
  const len = prompt.length;
  return {
    passed: len >= TARGET_MIN_CHARS && len <= TARGET_MAX_CHARS,
    severity: len > TARGET_MAX_CHARS ? 'error' : 'warning',
    message: `当前${len}字符，目标区间950-990`
  };
}

function checkCharacterContent(prompt, fields) {
  const content = fields.CHARACTER?.content || '';
  const hasRace = /\d+-year-old|boy|girl|man|woman|creature|beast/.test(content);
  const hasClothing = /jacket|shirt|dress|armor|robe|coat/.test(content);
  const hasAccessory = /compass|pendant|ring|bracelet|bag|weapon/.test(content);
  
  return {
    passed: hasRace && hasClothing && hasAccessory,
    severity: 'error',
    message: !hasRace ? '缺少种族/物种描述' : 
             !hasClothing ? '缺少核心服装描述' : 
             !hasAccessory ? '缺少关键配饰描述' : '角色描述完整'
  };
}

function checkActionContent(prompt, fields) {
  const content = fields.ACTION?.content || '';
  const hasVerb = /\b(tracing|gripping|turning|raising|leaning|reaching|stepping|running|looking)\b/.test(content);
  const hasInteraction = /\b(over|toward|at|into|onto|with)\b/.test(content);
  
  return {
    passed: hasVerb && hasInteraction,
    severity: 'error',
    message: !hasVerb ? '缺少核心动作动词' : 
             !hasInteraction ? '缺少交互对象' : '动作描述完整'
  };
}

function checkSceneContent(prompt, fields) {
  const content = fields.SCENE?.content || '';
  const hasLocation = /canyon|forest|mountain|plain|ruin|city|temple|cave|beach/.test(content);
  // 检查材质描述（至少2种）
  const materialCount = (content.match(/\b(rock|stone|metal|wood|glass|crystal|sand|water|ice|lava|moss|grass|dust|snow|mud|clay|obsidian|granite|marble|bronze|copper|iron|gold|silver|porcelain|ceramic|fabric|leather|paper|plastic|concrete)\b/g) || []).length;
  
  return {
    passed: hasLocation && materialCount >= 2,
    severity: 'error',
    message: !hasLocation ? '缺少核心地点描述' : 
             materialCount < 2 ? `材质细节仅${materialCount}种，需≥2种` : '场景描述完整'
  };
}

function checkMoodFormat(prompt, fields) {
  const content = fields.MOOD?.content || '';
  const keywords = content.split(',').map(k => k.trim()).filter(k => k);
  const hasLongSentence = keywords.some(k => k.length > 20);
  
  return {
    passed: keywords.length >= 3 && keywords.length <= 5 && !hasLongSentence,
    severity: 'error',
    message: keywords.length < 3 ? `仅${keywords.length}个关键词，需3-5个` : 
             keywords.length > 5 ? `${keywords.length}个关键词过多，需3-5个` : 
             hasLongSentence ? '存在长句，应为关键词' : '情绪格式正确'
  };
}

function checkCameraContent(prompt, fields) {
  const content = fields.CAMERA?.content || '';
  const hasShotType = /\b(extreme close-up|close-up|medium shot|medium wide|wide shot|extreme wide|macro|aerial|overhead|bird\'s eye)\b/i.test(content);
  const hasFocalLength = /\b(\d+mm|macro|telephoto|wide-angle)\b/.test(content);
  const hasMovement = /\b(dolly|crane|handheld|static|pan|tilt|track|push|pull|orbit|drone|steadicam)\b/i.test(content);
  
  return {
    passed: hasShotType && hasFocalLength && hasMovement,
    severity: 'error',
    message: !hasShotType ? '缺少景别描述' : 
             !hasFocalLength ? '缺少焦段描述' : 
             !hasMovement ? '缺少运镜方式' : '运镜描述完整'
  };
}

function checkLightingContent(prompt, fields) {
  const content = fields.LIGHTING?.content || '';
  const hasDirection = /\b(from behind|from above|from below|from side|from front|backlight|rim light|key light|fill light|ambient)\b/i.test(content);
  const hasColorTemp = /\b(\d+K|warm|cool|cold|golden|blue|red|green|purple|orange)\b/i.test(content);
  
  return {
    passed: hasDirection && hasColorTemp,
    severity: 'error',
    message: !hasDirection ? '缺少主光方向' : 
             !hasColorTemp ? '缺少色温/颜色描述' : '光影描述完整'
  };
}

function checkNegativeTemplate(prompt, fields, options) {
  const content = fields.NEGATIVE?.content || '';
  const projectType = options.projectType || 'fantasy';
  const standardTemplate = NEGATIVE_TEMPLATES[projectType] || NEGATIVE_TEMPLATES.fantasy;
  
  // 检查是否包含项目级标准排除项的关键部分
  const standardKeywords = standardTemplate.split(',').map(k => k.trim().replace(/^no\s+/, ''));
  const missingKeywords = standardKeywords.filter(kw => !content.toLowerCase().includes(kw.toLowerCase()));
  
  return {
    passed: missingKeywords.length <= 2, // 允许少量自定义替换
    severity: 'warning',
    message: missingKeywords.length > 0 ? `缺少标准排除项: ${missingKeywords.slice(0, 3).join(', ')}` : '负面提示符合标准'
  };
}

function checkAudioFormat(prompt, fields) {
  const content = fields.AUDIO?.content || '';
  const hasSpeaker = /\b(voice|speaker|narrator|character|he|she|it|they)\b/i.test(content);
  const hasQuote = /["'][^"']{5,30}["']/.test(content); // 5-30字的台词关键词
  const tooLong = content.length > 100; // 超过100字符可能包含完整长句
  
  return {
    passed: hasSpeaker && hasQuote && !tooLong,
    severity: 'warning',
    message: !hasSpeaker ? '缺少说话者身份' : 
             !hasQuote ? '缺少台词关键词' : 
             tooLong ? '台词过长，应压缩为关键词' : '音频格式正确'
  };
}

function checkRenderContent(prompt, fields) {
  const content = fields.RENDER?.content || '';
  const hasStyle = /\b(photorealistic|hyper-realistic|stylized|cinematic|realistic|artistic|painterly|anime|cartoon|3D|2D)\b/i.test(content);
  const hasQuality = /\b(4K|8K|UHD|HD|high quality|masterpiece|best quality|ultra detailed)\b/i.test(content);
  const hasSplit = /\b(CG|3D render|real photo|background|foreground|separate)\b/i.test(content);
  
  return {
    passed: hasStyle && hasQuality && !hasSplit,
    severity: 'error',
    message: !hasStyle ? '缺少风格声明' : 
             !hasQuality ? '缺少质量声明' : 
             hasSplit ? '禁止角色/背景分离指令' : '渲染风格正确'
  };
}

function checkDirectorContent(prompt, fields) {
  const content = fields.DIRECTOR?.content || '';
  const hasDirector = /\b(Cameron|Villeneuve|Spielberg|Jackson|Nolan|Scott|Zemeckis|Kubrick|Hitchcock|Fincher|Wes Anderson|Scorsese|Tarantino|Lucas|Del Toro|Burton|Jenkins|Chazelle|Villeneuve|Spielberg|Cameron)\b/i.test(content);
  const hasStyle = /\b(contrast|lighting|scale|composition|pacing|color|texture|depth|movement|framing|rhythm|tone|mood|atmosphere|grain|saturation|exposure|focus|blur|sharpness)\b/i.test(content);
  
  return {
    passed: hasDirector && hasStyle,
    severity: 'warning',
    message: !hasDirector ? '缺少导演标识' : 
             !hasStyle ? '缺少风格参数' : '导演风格正确'
  };
}

function checkNoConflict(prompt, fields) {
  // 检查字段间是否有明显冲突
  const mood = fields.MOOD?.content?.toLowerCase() || '';
  const lighting = fields.LIGHTING?.content?.toLowerCase() || '';
  
  const conflicts = [];
  if (mood.includes('dark') && lighting.includes('bright')) {
    conflicts.push('MOOD描述"dark"但LIGHTING描述"bright"');
  }
  if (mood.includes('bright') && lighting.includes('dark')) {
    conflicts.push('MOOD描述"bright"但LIGHTING描述"dark"');
  }
  
  return {
    passed: conflicts.length === 0,
    severity: 'warning',
    message: conflicts.length > 0 ? conflicts.join('; ') : '字段间无冲突'
  };
}

function checkCharacterConsistency(prompt, fields, options) {
  if (!options.checkCharacterConsistency || !options.lockedCharacter) {
    return { passed: true, severity: 'info', message: '跳过角色一致性检查（未提供锁定描述）' };
  }
  
  const content = fields.CHARACTER?.content || '';
  const locked = options.lockedCharacter.toLowerCase();
  const current = content.toLowerCase();
  
  // 检查关键特征是否一致（颜色、配饰等）
  const lockedColor = locked.match(/\b(yellow|red|blue|green|black|white|purple|orange|pink|brown|gray|grey|silver|gold)\b/);
  const currentColor = current.match(/\b(yellow|red|blue|green|black|white|purple|orange|pink|brown|gray|grey|silver|gold)\b/);
  
  if (lockedColor && currentColor && lockedColor[0] !== currentColor[0]) {
    return {
      passed: false,
      severity: 'error',
      message: `角色颜色不一致: 锁定${lockedColor[0]} vs 当前${currentColor[0]}`
    };
  }
  
  return { passed: true, severity: 'info', message: '角色一致性检查通过' };
}

function checkSeparatorValid(prompt, fields) {
  // 检查字段内容内部是否有未转义的 |
  const parts = prompt.split(SEPARATOR);
  for (const part of parts) {
    const fieldContent = part.substring(part.indexOf(FIELD_PREFIX) + FIELD_PREFIX.length);
    // 检查是否有未转义的 |（前面不是 \）
    const unescapedPipe = fieldContent.match(/[^\\]\|/);
    if (unescapedPipe) {
      return {
        passed: false,
        severity: 'error',
        message: `字段内容包含未转义的竖线: "${fieldContent.substring(0, 30)}..."`
      };
    }
  }
  
  return { passed: true, severity: 'info', message: '分隔符使用正确' };
}

// ============================================================
// 十、渲染组装器（供渲染引擎调用）
// ============================================================

/**
 * 组装最终渲染Prompt：按镜头类型自动调整权重
 * @param {Object} shot - 镜头对象（包含所有字段）
 * @param {Object} options - 组装选项
 * @returns {String} 最终Prompt
 */
function assemble(shot, options = {}) {
  const { 
    shotType = 'medium',
    projectType = 'fantasy',
    directorStyle = 'cameron'
  } = options;
  
  // 提取字段
  const fields = {};
  for (const fieldName of FIELD_ORDER) {
    if (shot[fieldName] || shot[fieldName.toLowerCase()]) {
      fields[fieldName] = shot[fieldName] || shot[fieldName.toLowerCase()];
    }
  }
  
  // 自动填充缺失的模板字段
  if (!fields.NEGATIVE) fields.NEGATIVE = getNegativeTemplate(projectType);
  if (!fields.RENDER) fields.RENDER = getRenderTemplate('cinematic');
  if (!fields.DIRECTOR) fields.DIRECTOR = getDirectorTemplate(directorStyle);
  
  // 按镜头类型权重调整长度
  const weights = SHOT_TYPE_WEIGHTS[shotType] || SHOT_TYPE_WEIGHTS.medium;
  const adjustedFields = adjustFieldLengths(fields, weights);
  
  // 构建Prompt
  const prompt = buildPrompt(adjustedFields, { shotType, projectType });
  
  // 验证
  const audit = validate(prompt, { projectType });
  
  return {
    prompt,
    audit,
    length: prompt.length,
    shotType,
    weights: weights.weights
  };
}

/**
 * 按镜头类型权重调整字段长度
 * @param {Object} fields - 原始字段
 * @param {Object} weights - 权重配置
 * @returns {Object} 调整后的字段
 */
function adjustFieldLengths(fields, weights) {
  const adjusted = { ...fields };
  const total = weights.total || MAX_TOTAL_CHARS;
  const contentBudget = total - FORMAT_OVERHEAD;
  
  for (const [fieldName, weight] of Object.entries(weights.weights || {})) {
    if (adjusted[fieldName]) {
      const targetLen = Math.floor(contentBudget * weight);
      const currentLen = adjusted[fieldName].length;
      
      if (currentLen > targetLen) {
        // 需要裁剪
        adjusted[fieldName] = trimFieldContent(
          adjusted[fieldName], 
          currentLen - targetLen,
          FIELD_DEFINITIONS[fieldName]
        );
      }
    }
  }
  
  return adjusted;
}

// ============================================================
// 十一、统计与分析
// ============================================================

/**
 * 分析Prompt的字段分布和利用率
 * @param {String} prompt - Prompt字符串
 * @returns {Object} 分析报告
 */
function analyze(prompt) {
  const fields = parsePrompt(prompt);
  if (!fields) return null;
  
  const total = prompt.length;
  const analysis = {
    totalLength: total,
    fieldCount: 0,
    fields: {},
    priority: { P0: 0, P1: 0, P2: 0, P3: 0 },
    utilization: 0,
    recommendations: []
  };
  
  for (const fieldName of FIELD_ORDER) {
    if (fields[fieldName]) {
      const len = fields[fieldName].content.length;
      const def = FIELD_DEFINITIONS[fieldName];
      analysis.fieldCount++;
      analysis.fields[fieldName] = {
        length: len,
        target: def.targetLength,
        min: def.minLength,
        priority: def.priority,
        status: len >= def.minLength ? 'ok' : 'under',
        utilization: Math.round(len / def.targetLength * 100)
      };
      analysis.priority[def.priority] += len;
    }
  }
  
  analysis.utilization = Math.round(total / MAX_TOTAL_CHARS * 100);
  
  // 生成建议
  if (total < TARGET_MIN_CHARS) {
    analysis.recommendations.push(`总长度仅${total}字符，低于950下限，建议补充内容`);
  }
  if (total > TARGET_MAX_CHARS) {
    analysis.recommendations.push(`总长度${total}字符，超出990上限，建议精简`);
  }
  
  for (const [fieldName, info] of Object.entries(analysis.fields)) {
    if (info.status === 'under') {
      analysis.recommendations.push(`${fieldName}仅${info.length}字符，低于最低${info.min}字符要求`);
    }
  }
  
  return analysis;
}

// ============================================================
// 十二、遗留格式分析器（适配现有非标准格式Prompt）
// ============================================================

/**
 * 分析遗留格式Prompt的字段覆盖情况
 * 通过正则匹配从非标准格式Prompt中提取近似字段分布
 * @param {String} prompt - 遗留格式Prompt
 * @param {Object} options - 选项
 * @returns {Object} 分析报告
 */
function analyzeLegacy(prompt, options = {}) {
  const analysis = {
    totalLength: prompt.length,
    fieldCount: 0,
    fields: {},
    priority: { P0: 0, P1: 0, P2: 0, P3: 0 },
    utilization: Math.round(prompt.length / 1500 * 100),
    standardReadiness: 0,
    recommendations: [],
    mappedSegments: []
  };
  
  // 简化的字段检测
  const markers = [
    { name: 'CHARACTER', keywords: ['boy', 'girl', 'man', 'woman', 'creature', 'beast', '角色'], priority: 'P0' },
    { name: 'ACTION', keywords: ['gesture', 'movement', 'tracing', 'gripping', 'leaning', '动作'], priority: 'P1' },
    { name: 'SCENE', keywords: ['canyon', 'forest', 'mountain', 'temple', '场景', '环境'], priority: 'P1' },
    { name: 'CAMERA', keywords: ['push-in', 'pull-out', 'zoom', 'dolly', '镜头'], priority: 'P2' },
    { name: 'LIGHTING', keywords: ['light', 'glow', 'beam', 'flare', '光'], priority: 'P2' },
    { name: 'NEGATIVE', keywords: ['no metal', 'no anime', '负面', '约束'], priority: 'P3' }
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  let matchedFields = 0;
  
  for (const marker of markers) {
    const found = marker.keywords.some(kw => lowerPrompt.includes(kw.toLowerCase()));
    if (found) {
      matchedFields++;
      analysis.fields[marker.name] = { detected: true, priority: marker.priority };
      analysis.priority[marker.priority]++;
    }
  }
  
  analysis.fieldCount = matchedFields;
  analysis.standardReadiness = Math.round(matchedFields / 10 * 100);
  
  if (analysis.standardReadiness < 60) {
    analysis.recommendations.push(`字段覆盖率${analysis.standardReadiness}%，建议补充未检测到的标准字段`);
  }
  
  return analysis;
}

// ============================================================
// 十三、导出
// ============================================================

module.exports = {
  // 常量
  VERSION,
  MAX_PROMPT_LENGTH,
  AUDIT_AVAILABLE,
  FIELD_DEFINITIONS,
  FIELD_ORDER,
  SEPARATOR,
  MAX_TOTAL_CHARS,
  TARGET_MIN_CHARS,
  TARGET_MAX_CHARS,
  FORMAT_OVERHEAD,
  SHOT_TYPE_WEIGHTS,
  NEGATIVE_TEMPLATES,
  RENDER_TEMPLATES,
  DIRECTOR_TEMPLATES,
  CHECKLIST,
  
  // 核心函数
  buildPrompt,
  getNegativeTemplate,
  getRenderTemplate,
  getDirectorTemplate,
  smartTrim,
  optimize,
  validate,
  assemble,
  analyze,
  analyzeLegacy,
  
  // 工具函数
  parsePrompt,
  assembleFromFields,
  trimFieldContent,
  hardTrim,
  adjustFieldLengths
};

// ============================================================
// 版本记录
// ============================================================
// v2.0 (2026-05-31): 初始版本，10字段标准，全链路模块化
