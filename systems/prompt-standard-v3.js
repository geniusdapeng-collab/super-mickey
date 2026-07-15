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
      '【CHARACTER】',
      '【视觉】',
      '【主体】',
      '【角色约束】'
    ],
    patterns: [
      /【CHARACTER】/i,
      /【视觉】/i,
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
      '【ACTION】',
      '【动态】',
      '【异兽动作】',
      '【嘴部动作】'
    ],
    patterns: [
      /【ACTION】/i,
      /【动态】/i,
      /【异兽动作】/i,
      /【嘴部动作】/i,
      /(?:walk|run|look|turn|approach|enter|grab|fight|move|step|动作|走|跑|看|冲|扑|转身|靠近|伸手)/i
    ]
  },

  SCENE: {
    name: '场景',
    weight: 1.0,
    blockMapping: [
      '【SCENE】',
      '【空间】',
      '【环境布景】',
      '【环境质感】'
    ],
    patterns: [
      /【SCENE】/i,
      /【空间】/i,
      /【环境布景】/i,
      /【环境质感】/i,
      /(?:forest|mountain|ocean|valley|cave|plain|beach|island|Nirath|草原|森林|山谷|洞穴|海边|岛屿|场景|星球)/i
    ]
  },

  MOOD: {
    name: '情绪',
    weight: 0.8,
    blockMapping: [
      '【MOOD】',
      '【风格】',
      '【情绪】'
    ],
    patterns: [
      /【MOOD】/i,
      /【风格】/i,
      /【情绪】/i,
      /(?:mood|emotion|atmosphere|mysterious|epic|warm|tense|sad|hopeful|神秘|敬畏|温暖|紧张|悲伤|希望|氛围)/i
    ]
  },

  CAMERA: {
    name: '运镜',
    weight: 1.0,
    blockMapping: [
      '【CAMERA】',
      '【动态】',
      '【镜头时间轴】',
      '【运镜】'
    ],
    patterns: [
      /【CAMERA】/i,
      /【镜头时间轴】/i,
      /【运镜】/i,
      /(?:camera|shot|dolly|push|pull|pan|tilt|orbit|tracking|handheld|close-up|wide shot|运镜|推进|拉远|摇镜|环绕|手持|远景|中景|特写)/i
    ]
  },

  LIGHTING: {
    name: '光影',
    weight: 0.9,
    blockMapping: [
      '【LIGHTING】',
      '【基础】',
      '【质控】',
      '【光影】',
      '【光照】'
    ],
    patterns: [
      /【LIGHTING】/i,
      /【基础】/i,
      /【质控】/i,
      /【光影】/i,
      /【光照】/i,
      /(?:lighting|light|shadow|volumetric|rim light|key light|5600K|3200K|golden hour|光影|光照|色温|体积光|轮廓光)/i
    ]
  },

  NEGATIVE: {
    name: '负面约束',
    weight: 0.7,
    blockMapping: [
      '【NEGATIVE】',
      '【负面约束】',
      '【全局负面约束】',
      '【约束】'
    ],
    patterns: [
      /【NEGATIVE】/i,
      /【负面约束】/i,
      /【全局负面约束】/i,
      /【约束】/i,
      /(?:no text|no watermark|no blurry|no subtitle|负面约束|禁止)/i
    ]
  },

  AUDIO: {
    name: '音频',
    weight: 0.7,
    blockMapping: [
      '【AUDIO】',
      '【音频】',
      '【环境音效】',
      '【旁白\/台词】'
    ],
    patterns: [
      /【AUDIO】/i,
      /【音频】/i,
      /【环境音效】/i,
      /【旁白\/台词】/i,
      /(?:sound|audio|ambient|voice|music|海浪|风声|虫鸣|音效|环境音|伴随|氛围弥漫)/i
    ]
  },

  RENDER: {
    name: '渲染规格',
    weight: 0.8,
    blockMapping: [
      '【RENDER】',
      '【基础】',
      '【质控】',
      '【技术规格】',
      '【ASTRALIS】'
    ],
    patterns: [
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
      '【DIRECTOR】',
      '【风格】',
      '【质控】'
    ],
    patterns: [
      /【DIRECTOR】/i,
      /【风格】/i,
      /【质控】/i,
      /(?:director|cinematic|style|aesthetic|导演|电影感|史诗感|镜头策略)/i
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
      VISUAL: 'CHARACTER',
      SUBJECT: 'CHARACTER',
      SPACE: 'SCENE',
      DYNAMIC: 'CAMERA',
      STYLE: 'DIRECTOR',
      SOUND: 'AUDIO',
      AUDIO: 'AUDIO'
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
    'RENDER'
  ];

  const parts = [];
  for (const key of ordered) {
    if (parsed[key] && safeText(parsed[key].content)) {
      parts.push(`【${key}】${safeText(parsed[key].content)}`);
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