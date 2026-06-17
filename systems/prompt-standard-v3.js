'use strict';

/**
 * Prompt Standard v3 - 完整替换版
 * 目标：
 * 1. 统一解析多种 Prompt 格式
 * 2. Stage 12 合规检查“块格式优先 + 内容兜底”
 * 3. 兼容新旧字段命名
 */

const { repairBrokenBlocks } = require('./safe-prompt-trim');

// ============================================================
// 一、字段定义
// ============================================================

const FIELD_DEFINITIONS = {
  CHARACTER: {
    name: '角色/主体',
    weight: 1.0,
    blockMapping: [
      '【视觉】',        // v6.6.9.4-patch9: 标准字段名优先
      '【CHARACTER】',
      '【主体】',
      '【角色约束】'
    ],
    patterns: [
      /【视觉】/i,        // 标准字段名优先
      /【CHARACTER】/i,
      /【主体】/i,
      /【角色约束】/i,
      /(?:boy|girl|man|woman|child|character|角色|人物|小G|白泽|饕餮|香香|小卓)/i,
      /\d+\s*(?:year-old|岁)/i
    ]
  },

  ACTION: {
    name: '动作',
    weight: 1.0,
    blockMapping: [
      '【动态】',        // v6.6.9.4-patch9: 标准字段名优先
      '【ACTION】',
      '【异兽动作】',
      '【嘴部动作】'
    ],
    patterns: [
      /【动态】/i,        // 标准字段名优先
      /【ACTION】/i,
      /【异兽动作】/i,
      /【嘴部动作】/i,
      /(?:walk|run|look|turn|approach|enter|grab|fight|move|step|动作|走|跑|看|冲|扑|转身|靠近|伸手)/i
    ]
  },

  SCENE: {
    name: '场景',
    weight: 1.0,
    blockMapping: [
      '【空间】',        // v6.6.9.4-patch9: 标准字段名优先
      '【SCENE】',
      '【环境布景】',
      '【环境质感】'
    ],
    patterns: [
      /【空间】/i,        // 标准字段名优先
      /【SCENE】/i,
      /【环境布景】/i,
      /【环境质感】/i,
      /(?:forest|mountain|ocean|valley|cave|plain|beach|island|Nirath|草原|森林|山谷|洞穴|海边|岛屿|场景|星球)/i
    ]
  },

  MOOD: {
    name: '情绪',
    weight: 0.8,
    blockMapping: [
      '【风格】',        // v6.6.9.4-patch9: 标准字段名优先
      '【MOOD】',
      '【情绪】'
    ],
    patterns: [
      /【风格】/i,        // 标准字段名优先
      /【MOOD】/i,
      /【情绪】/i,
      /(?:mood|emotion|atmosphere|mysterious|epic|warm|tense|sad|hopeful|神秘|敬畏|温暖|紧张|悲伤|希望|氛围)/i
    ]
  },

  CAMERA: {
    name: '运镜',
    weight: 1.0,
    blockMapping: [
      '【镜头时间轴】',   // v6.6.9.4-patch9: 标准字段名优先
      '【CAMERA】',
      '【动态】',
      '【运镜】'
    ],
    patterns: [
      /【镜头时间轴】/i,   // 标准字段名优先
      /【CAMERA】/i,
      /【运镜】/i,
      /(?:camera|shot|dolly|push|pull|pan|tilt|orbit|tracking|handheld|close-up|wide shot|运镜|推进|拉远|摇镜|环绕|手持|远景|中景|特写)/i
    ]
  },

  LIGHTING: {
    name: '光影',
    weight: 0.9,
    blockMapping: [
      '【照明】',        // v6.6.9.4-patch9: 标准字段名优先
      '【LIGHTING】',
      '【光影】',
      '【光照】'
    ],
    patterns: [
      /【照明】/i,        // 标准字段名优先
      /【LIGHTING】/i,
      /【光影】/i,
      /【光照】/i,
      /(?:lighting|light|shadow|volumetric|rim light|key light|5600K|3200K|golden hour|光影|光照|色温|体积光|轮廓光)/i
    ]
  },

  NEGATIVE: {
    name: '负面约束',
    weight: 0.7,
    blockMapping: [
      '【负面约束】',     // v6.6.9.4-patch9: 标准字段名优先
      '【NEGATIVE】',
      '【全局负面约束】'
    ],
    patterns: [
      /【负面约束】/i,     // 标准字段名优先
      /【NEGATIVE】/i,
      /【全局负面约束】/i,
      /(?:no text|no watermark|no blurry|no subtitle|负面约束|禁止)/i
    ]
  },

  AUDIO: {
    name: '音频',
    weight: 0.7,
    blockMapping: [
      '【环境音效】',     // v6.6.9.4-patch9: 标准字段名优先
      '【AUDIO】',
      '【音频】',
      '【旁白\/台词】'
    ],
    patterns: [
      /【环境音效】/i,     // 标准字段名优先
      /【AUDIO】/i,
      /【音频】/i,
      /【旁白\/台词】/i,
      /(?:sound|audio|ambient|voice|music|海浪|风声|虫鸣|音效|环境音|伴随|氛围弥漫)/i
    ]
  },

  RENDER: {
    name: '渲染规格',
    weight: 0.8,
    blockMapping: [
      '【渲染】',        // v6.6.9.4-patch9: 标准字段名优先
      '【RENDER】',
      '【技术规格】',
      '【ASTRALIS】'
    ],
    patterns: [
      /【渲染】/i,        // 标准字段名优先
      /【RENDER】/i,
      /【技术规格】/i,
      /【ASTRALIS】/i,
      /(?:render|hyperreal|ultra-detailed|8k|35mm|film grain|超写实|渲染|细节丰富|电影级)/i
    ]
  },

  DIRECTOR: {
    name: '导演风格',
    weight: 0.8,
    blockMapping: [
      '【导演】',        // v6.6.9.4-patch9: 标准字段名优先
      '【DIRECTOR】',
      '【风格】'
    ],
    patterns: [
      /【导演】/i,        // 标准字段名优先
      /【DIRECTOR】/i,
      /【风格】/i,
      /(?:director|cinematic|style|aesthetic|导演|电影感|史诗感|镜头策略)/i
    ]
  },

  DIALOGUE: {
    name: '台词',
    weight: 1.0,
    blockMapping: [
      '【台词】',        // v6.6.9.4-patch9: 标准字段名
      '【DIALOGUE】',
      '【旁白】',
      '【对话】'
    ],
    patterns: [
      /【台词】/i,
      /【DIALOGUE】/i,
      /【旁白】/i,
      /【对话】/i,
      /[""""].*?[""""]/i  // 引号包裹的台词
    ]
  },

  CHARACTER_CARD: {
    name: '人物介绍卡片',
    weight: 0.6,
    blockMapping: [
      '【人物介绍卡片】', // v6.6.9.4-patch9: 新增标准字段
      '【CHARACTER_CARD】',
      '【人物卡片】',
      '【角色卡片】'
    ],
    patterns: [
      /【人物介绍卡片】/i,
      /【CHARACTER_CARD】/i,
      /【人物卡片】/i,
      /【角色卡片】/i,
      /lower.third|信息卡片|头像缩略图|毛玻璃/i
    ]
  }
};

// ============================================================
// 二、工具函数
// ============================================================

function safeText(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function hasAny(text, patterns) {
  return patterns.some(p => p.test(text));
}

function normalizeInput(prompt) {
  let text = safeText(prompt);
  text = repairBrokenBlocks(text);

  // 去掉 markdown code fence
  text = text.replace(/^```[a-zA-Z0-9_-]*\n?/g, '').replace(/\n?```$/g, '').trim();

  return text;
}

// ============================================================
// 三、解析器
// ============================================================

function parseBlockFormat(prompt) {
  const text = normalizeInput(prompt);
  const fields = {};

  for (const [fieldName, def] of Object.entries(FIELD_DEFINITIONS)) {
    for (const block of def.blockMapping) {
      const escaped = block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${escaped}([\s\S]*?)(?=(?:\s*\|\s*【)|(?:【[^】]+】)|$)`, 'i');
      const match = text.match(regex);
      if (match && safeText(match[1])) {
        fields[fieldName] = {
          content: safeText(match[1]).replace(/^\|\s*/, ''),
          source: 'block',
          block
        };
        break;
      }
    }
  }

  return Object.keys(fields).length ? fields : null;
}

function parseKeyValueFormat(prompt) {
  let text = normalizeInput(prompt);
  const fields = {};

  // 去掉外层 {}
  if (text.startsWith('{') && text.endsWith('}')) {
    text = text.slice(1, -1).trim();
  }

  const parts = text.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;

  for (const part of parts) {
    const match = part.match(/^([A-Z_]+)\s*[:：]\s*([\s\S]+)$/i);
    if (!match) continue;

    const rawKey = match[1].toUpperCase().trim();
    const rawValue = safeText(match[2]);

    if (!rawValue) continue;

    if (FIELD_DEFINITIONS[rawKey]) {
      fields[rawKey] = {
        content: rawValue,
        source: 'key_value',
        key: rawKey
      };
      continue;
    }

    const aliasMap = {
      // v6.6.9.4-patch9: 旧字段名 → 标准字段名（兼容解析）
      VISUAL: 'CHARACTER',
      SUBJECT: 'CHARACTER',
      SPACE: 'SCENE',
      DYNAMIC: 'ACTION',      // 【动态】是ACTION，不是CAMERA
      CAMERA: 'CAMERA',
      LIGHTING: 'LIGHTING',
      MOOD: 'MOOD',
      STYLE: 'MOOD',          // 【风格】→ MOOD（色彩/情绪）
      DIRECTOR: 'DIRECTOR',
      NEGATIVE: 'NEGATIVE',
      SOUND: 'AUDIO',
      AUDIO: 'AUDIO',
      RENDER: 'RENDER',
      DIALOGUE: 'DIALOGUE',
      CHARACTER_CARD: 'CHARACTER_CARD'
    };

    const mapped = aliasMap[rawKey];
    if (mapped && FIELD_DEFINITIONS[mapped]) {
      fields[mapped] = {
        content: rawValue,
        source: 'key_value_alias',
        key: rawKey
      };
    }
  }

  return Object.keys(fields).length ? fields : null;
}

function parseNaturalPrompt(prompt) {
  const text = normalizeInput(prompt);
  if (!text) return null;

  const fields = {};

  for (const [fieldName, def] of Object.entries(FIELD_DEFINITIONS)) {
    if (hasAny(text, def.patterns)) {
      fields[fieldName] = {
        content: text,
        source: 'natural_inference'
      };
    }
  }

  return Object.keys(fields).length ? fields : null;
}

function parsePrompt(prompt) {
  const text = normalizeInput(prompt);
  if (!text) return null;

  return (
    parseBlockFormat(text) ||
    parseKeyValueFormat(text) ||
    parseNaturalPrompt(text)
  );
}

// ============================================================
// 四、标准符合度检查
// ============================================================

function checkStandardCompliance(prompt, shotId = 'unknown') {
  const text = normalizeInput(prompt);
  const parsed = parsePrompt(text);

  const checks = {};
  let totalWeight = 0;
  let passedWeight = 0;

  for (const [fieldName, def] of Object.entries(FIELD_DEFINITIONS)) {
    let found = false;

    // 1. 解析器命中优先
    if (parsed && parsed[fieldName] && safeText(parsed[fieldName].content)) {
      found = true;
    } else {
      // 2. 内容兜底
      found = hasAny(text, def.patterns);
    }

    checks[fieldName] = {
      found,
      weight: def.weight,
      name: def.name
    };

    totalWeight += def.weight;
    if (found) passedWeight += def.weight;
  }

  const score = totalWeight > 0
    ? Math.round((passedWeight / totalWeight) * 100)
    : 0;

  const missing = Object.entries(checks)
    .filter(([, v]) => !v.found)
    .map(([k]) => k);

  return {
    shotId,
    score,
    passed: score >= 70,
    missing,
    checks,
    parsed
  };
}

// ============================================================
// 五、标准块输出
// ============================================================

function toStandardBlocks(prompt) {
  const parsed = parsePrompt(prompt);
  if (!parsed) return '';

  const ordered = [
    'CHARACTER',
    'ACTION',
    'SCENE',
    'MOOD',
    'CAMERA',
    'LIGHTING',
    'AUDIO',
    'DIRECTOR',
    'NEGATIVE',
    'RENDER',
    'DIALOGUE',        // v6.6.9.4-patch9: 新增标准字段
    'CHARACTER_CARD'   // v6.6.9.4-patch9: 新增标准字段
  ];

  const parts = [];
  for (const key of ordered) {
    if (parsed[key] && safeText(parsed[key].content)) {
      // 使用中文标准标记
      const labelMap = {
        CHARACTER: '视觉',
        ACTION: '动态',
        SCENE: '空间',
        MOOD: '风格',
        CAMERA: '镜头时间轴',
        LIGHTING: '照明',
        AUDIO: '环境音效',
        DIRECTOR: '导演',
        NEGATIVE: '负面约束',
        RENDER: '渲染',
        DIALOGUE: '台词',
        CHARACTER_CARD: '人物介绍卡片'
      };
      const label = labelMap[key] || key;
      parts.push(`【${label}】${safeText(parsed[key].content)}`);
    }
  }

  return parts.join(' | ');
}

// ============================================================
// 六、向后兼容导出
// ============================================================

module.exports = {
  FIELD_DEFINITIONS,
  parsePrompt,
  parseBlockFormat,
  parseKeyValueFormat,
  parseNaturalPrompt,
  checkStandardCompliance,
  toStandardBlocks
};