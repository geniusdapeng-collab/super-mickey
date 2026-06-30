/**
 * Nirath Config Center v2.0
 * 统一配置管理中心 — 消除所有硬编码值的单一可信源
 * 
 * 核心原则：
 * 1. 所有常量必须通过此中心读取，禁止任何模块硬编码
 * 2. 配置分层：默认值 -> 项目配置 -> 环境变量 -> 运行时覆盖
 * 3. 配置变更无需修改代码，重启即生效
 * 4. 所有配置变更记录审计日志
 * 
 * 收敛的硬编码值（来自审计）：
 * - MAX_PROMPT_LENGTH: 1500（原分散在buildPromptV3=980, MicroMotion=500, screenwriter=6000等）
 * - MAX_DURATION: 15秒（原Math.max/min混淆）
 * - EMOTION_PHASES: 6阶段（原5/6阶段混用）
 * - LLM_TIMEOUT: 120000ms（原各模块不一致）
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// 一、默认配置（单一可信源）
// ============================================================

const DEFAULT_CONFIG = {
  version: '2.0.0',
  pipeline: {
    version: '6.3.2',
    mode: 'nirath', // 'nirath' | 'generic'
    maxStages: 17,
    strictMode: false, // v2.0新增：Schema验证是否强制阻断（渐进启用）
  },

  // 【P0】Prompt约束 — 统一以"字符"为统计单位（Unicode字符数，非字节数）
  // JavaScript .length 属性：中文1字=1字符，英文1字母=1字符，符号=1字符
  // Seedance API 限制按字符数计算，禁止混用字节统计
  prompt: {
    maxLength: 1500,           // 绝对上限：API提交总字符数（含标记符号），不可突破（v6.5.34-fix: 从980放宽至1500）
    optimalLength: 1470,       // 最佳目标长度（推荐值，允许±30浮动）
    minEffectiveLength: 1300,  // 最低有效长度（低于此值可能画面信息不足）
    formatOverhead: 110,      // 字段标记+分隔符开销（如"[SCENE:]"等标记符号约110字符）
    
    // 统计单位声明（所有模块必须遵循）
    unit: 'chars',            // 'chars'=Unicode字符 | 禁止改为'bytes'
    countMethod: 'js_length', // 使用 String.prototype.length（非 Buffer.byteLength）
    // 说明：js_length 对中/英/符号均按1字符计数，与Seedance API计数方式一致
    
    // 字段定义（10维度）— 与prompt-standard-v2.js对齐
    fields: {
      CHARACTER: { priority: 'P0', targetLength: 30, minLength: 10, trimStrategy: 'never' },
      ACTION:    { priority: 'P1', targetLength: 85, minLength: 40, trimStrategy: 'protect' },
      SCENE:     { priority: 'P1', targetLength: 175, minLength: 100, trimStrategy: 'protect' },
      MOOD:      { priority: 'P1', targetLength: 35, minLength: 15, trimStrategy: 'protect' },
      CAMERA:    { priority: 'P1', targetLength: 115, minLength: 60, trimStrategy: 'protect' },
      LIGHTING:  { priority: 'P1', targetLength: 95, minLength: 50, trimStrategy: 'protect' },
      NEGATIVE:  { priority: 'P2', targetLength: 70, minLength: 40, trimStrategy: 'moderate' },
      AUDIO:     { priority: 'P2', targetLength: 65, minLength: 30, trimStrategy: 'moderate' },
      RENDER:    { priority: 'P2', targetLength: 45, minLength: 20, trimStrategy: 'moderate' },
      DIRECTOR:  { priority: 'P3', targetLength: 30, minLength: 15, trimStrategy: 'aggressive' }
    },
    
    fieldOrder: ['CHARACTER', 'ACTION', 'SCENE', 'MOOD', 'CAMERA', 'LIGHTING', 'NEGATIVE', 'AUDIO', 'RENDER', 'DIRECTOR'],
    priorityOrder: ['P3', 'P2', 'P1', 'P0'], // 裁剪优先级（P3先被裁）
    
    // 负面提示词模板
    negativeTemplates: {
      fantasy: 'no deformed hands, no extra fingers, no modern objects, no text watermark, no cartoon style, no flat lighting, no oversaturated colors, no anime eyes, no glowing eyes, no metal armor, no metal texture, no metallic sheen',
      realistic: 'no anime, no illustration, no 3D render look, no oversaturation, no deformed hands, no extra limbs, no shaky cam, no cartoon style, no flat lighting',
      scifi: 'no fantasy elements, no magic glow, no medieval objects, no deformed anatomy, no low poly, no cartoon style, no flat lighting, no modern objects'
    },
    
    // 渲染风格模板
    renderTemplates: {
      cinematic: '写实电影级, 4K超清, 胶片颗粒, 色彩分级',
      hyperrealistic: '超写实, 8K超清, 体积光, 光线追踪反射',
      stylized: '风格化电影级, 鲜艳配色, 动态光影, 艺术构图'
    },
    
    // 导演风格模板
    directorTemplates: {
      cameron: 'Cameron-scale contrast, epic bioluminescent ecosystems, grand scale environmental storytelling',
      villeneuve: 'Villeneuve-scale negative space, contemplative pacing, monolithic architecture, atmospheric fog',
      spielberg: 'Spielberg-scale emotional warmth, dappled golden light, intimate character moments, wonder',
      jackson: 'Jackson-scale epic fantasy, sweeping aerial vistas, detailed worldbuilding, mythic grandeur'
    }
  },

  // 镜头时长约束
  duration: {
    maxShotDuration: 15,      // 单镜头最大秒数（原Math.max bug修复）
    minShotDuration: 3,       // 单镜头最小秒数
    narrationWordsPerSecond: 2.5, // 口播字数/秒
    totalDuration: {          // 不同总时长的镜头数建议
      '60': { minShots: 5, maxShots: 8 },
      '90': { minShots: 7, maxShots: 12 },
      '120': { minShots: 10, maxShots: 16 }
    }
  },

  // 情绪阶段（6阶段统一，消除5/6阶段混用）
  emotion: {
    phases: [
      { id: 'exposition', name: '铺垫', weight: 0.15 },
      { id: 'rising_action', name: '上升', weight: 0.20 },
      { id: 'complication', name: '复杂化', weight: 0.15 },
      { id: 'climax', name: '高潮', weight: 0.20 },
      { id: 'falling_action', name: '回落', weight: 0.15 },
      { id: 'resolution', name: '解决', weight: 0.15 }
    ],
    phaseOrder: ['exposition', 'rising_action', 'complication', 'climax', 'falling_action', 'resolution']
  },

  // LLM网关配置
  llm: {
    defaultProvider: 'volcengine',
    timeoutMs: 120000,        // 统一超时（原各模块不一致）
    maxRetries: 3,
    retryBackoffMultiplier: 2,
    maxPromptChars: {         // 各模块的Prompt字符上限（原分散在各模块）
      screenwriter: 4000,     // 编剧模块
      director: 6000,         // 导演模块
      promptBuilder: 1500,     // Prompt构建模块（=MAX_PROMPT_LENGTH）
      micromotion: 1500        // 微动作模块（原硬编码500，已修复）
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeoutMs: 30000,
      halfOpenMaxCalls: 2
    }
  },

  // 渲染引擎配置
  render: {
    engine: 'Seedance-2.0',
    // v6.6.6: 安全占位符 - 请从 config/seedance.json 或环境变量配置实际 endpoint
    endpoint: process.env.SEEDANCE_ENDPOINT || 'YOUR_SEEDANCE_ENDPOINT_ID',
    fastEndpoint: process.env.SEEDANCE_FAST_ENDPOINT || 'YOUR_SEEDANCE_FAST_ENDPOINT_ID',
    imageEndpoint: process.env.SEEDREAM_ENDPOINT || 'YOUR_SEEDREAM_ENDPOINT_ID',
    maxConcurrent: 3,
    safetyGate: {
      tripleLockEnabled: true,
      minExecutionTimeMs: 100,
      dataFreshnessTimeoutMs: 300000
    }
  },

  // 资产路径
  assets: {
    basePath: './assets',
    characterCardsPath: './characters',
    beastDatabasePath: './shanhaijing-bestiary',
    referenceImagesPath: './assets/reference-images',
    portraitsPath: './characters/{characterId}/portraits',
    maxFileSizeMb: 10
  },

  // 世界设定（Nirath）
  world: {
    name: 'Nirath',
    setting: '2147年科技废墟星球，地球前身',
    lightingStyle: '暗红色熔岩光 + 灰烬黑阴影 + 硫磺黄能量光',
    atmosphere: '火山灰弥漫，空气中充满硫磺气息',
    colorPalette: ['暗红', '熔岩橙', '灰烬黑', '硫磺黄', '幽蓝'],
    ecologyStyle: '生机勃勃、地球式生态丰富度（禁止戈壁/火星式光秃）'
  },

  // 项目级约束（P0级）
  constraints: {
    // 【P0】禁止旁白/独白/innerMonologue — 仅保留Dialogue（对嘴）
    forbiddenVoiceover: true,
    // 【P0】全局明亮风格
    forbidDarkStyle: true,
    // 【P0】禁止金属光泽
    forbidMetalSheen: true,
    // 【P0】禁止非自然眼睛颜色（仅黑色眼圈+倒影）
    forbidUnnaturalEyeColor: true,
    // 全局负面提示词（自动注入）
    globalNegativePrompts: [
      'no dark style', 'no night scene', 'no metallic sheen', 'no metal texture',
      'no glowing eyes', 'no unnatural eye color', 'no voiceover', 'no narration text'
    ]
  },

  // 审片工作流
  review: {
    enabled: true,
    autoApproveThreshold: 7.0,  // 导演评分>=7自动通过
    maxRevisionRounds: 3        // 最大修改轮次
  },

  // 调试与日志
  debug: {
    auditLog: true,
    lineageTrace: false,        // 字段血缘追踪（v2.1启用）
    eventBus: false,            // 事件总线调试（v2.1启用）
    schemaValidation: 'warn'    // 'warn' | 'strict' — 渐进切换
  }
};

// ============================================================
// 二、配置中心类
// ============================================================

class ConfigCenter {
  constructor() {
    this.config = null;
    this.configPath = null;
    this.auditLog = [];
    this._loadTime = null;
  }

  /**
   * 加载配置（分层合并）
   * 优先级：环境变量 > 项目配置 > 默认配置
   */
  load(options = {}) {
    this.configPath = options.configPath || path.join(__dirname, '../../config/nirath.json');
    
    // 层1：默认值
    let merged = this.deepClone(DEFAULT_CONFIG);
    
    // 层2：项目配置文件（如果存在）
    if (fs.existsSync(this.configPath)) {
      try {
        const projectConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        merged = this.deepMerge(merged, projectConfig);
        this.audit(`[ConfigCenter] 加载项目配置: ${this.configPath}`);
      } catch (e) {
        console.warn(`[ConfigCenter] 项目配置加载失败: ${e.message}`);
      }
    }
    
    // 层3：环境变量覆盖（高优先级）
    const envOverrides = this.loadFromEnv();
    if (Object.keys(envOverrides).length > 0) {
      merged = this.deepMerge(merged, envOverrides);
      this.audit(`[ConfigCenter] 环境变量覆盖: ${Object.keys(envOverrides).join(', ')}`);
    }
    
    this.config = merged;
    this._loadTime = Date.now();
    
    console.log(`[ConfigCenter] v${merged.version} 加载完成 | prompt.maxLength=${merged.prompt.maxLength} | duration.max=${merged.duration.maxShotDuration}s`);
    return merged;
  }

  /**
   * 从环境变量读取覆盖
   */
  loadFromEnv() {
    const overrides = {};
    const env = process.env;
    
    if (env.NIRATH_PROMPT_MAXLENGTH) {
      overrides.prompt = { maxLength: parseInt(env.NIRATH_PROMPT_MAXLENGTH, 10) };
    }
    if (env.NIRATH_MAX_DURATION) {
      overrides.duration = { maxShotDuration: parseInt(env.NIRATH_MAX_DURATION, 10) };
    }
    if (env.NIRATH_LLM_TIMEOUT) {
      overrides.llm = { timeoutMs: parseInt(env.NIRATH_LLM_TIMEOUT, 10) };
    }
    if (env.NIRATH_LLM_PROVIDER) {
      overrides.llm = { defaultProvider: env.NIRATH_LLM_PROVIDER };
    }
    if (env.NIRATH_SCHEMA_MODE) {
      overrides.debug = { schemaValidation: env.NIRATH_SCHEMA_MODE };
    }
    if (env.NIRATH_STRICT_MODE) {
      overrides.pipeline = { strictMode: env.NIRATH_STRICT_MODE === 'true' };
    }
    
    return overrides;
  }

  /**
   * 获取配置值（支持点路径）
   * @param {string} path - 如 'prompt.maxLength' 或 'duration.maxShotDuration'
   * @param {*} defaultValue - 默认值
   */
  get(path, defaultValue) {
    if (!this.config) {
      this.load();
    }
    
    const parts = path.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current;
  }

  // 快捷方法：获取Prompt最大长度
  getPromptMaxLength() {
    return this.get('prompt.maxLength', 1500);
  }

  // 快捷方法：获取字段定义
  getFieldDef(fieldName) {
    return this.get(`prompt.fields.${fieldName}`, null);
  }

  // 快捷方法：获取所有字段定义
  getAllFieldDefs() {
    return this.get('prompt.fields', {});
  }

  // 快捷方法：获取导演模板
  getDirectorTemplate(directorName) {
    return this.get(`prompt.directorTemplates.${directorName}`, '');
  }

  // 快捷方法：获取负面提示词模板
  getNegativeTemplate(style) {
    return this.get(`prompt.negativeTemplates.${style}`, '');
  }

  // 快捷方法：获取情绪阶段
  getEmotionPhases() {
    return this.get('emotion.phases', []);
  }

  // 快捷方法：获取资产路径
  getAssetPath(type, params = {}) {
    const basePath = this.get('assets.basePath', './assets');
    let template = this.get(`assets.${type}Path`, basePath);
    
    // 替换模板变量
    for (const [key, value] of Object.entries(params)) {
      template = template.replace(`{${key}}`, value);
    }
    
    return template;
  }

  /**
   * 热重载配置
   */
  reload() {
    console.log('[ConfigCenter] 热重载配置...');
    this.auditLog = []; // 清空旧日志
    return this.load({ configPath: this.configPath });
  }

  /**
   * 审计日志
   */
  audit(message) {
    this.auditLog.push({
      timestamp: Date.now(),
      message
    });
  }

  /**
   * 获取审计日志
   */
  getAuditLog() {
    return this.auditLog;
  }

  /**
   * 深合并（不修改源对象）
   */
  deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    if (!target || typeof target !== 'object') return this.deepClone(source);
    
    const result = this.deepClone(target);
    
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * 深克隆
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (const key of Object.keys(obj)) {
      cloned[key] = this.deepClone(obj[key]);
    }
    return cloned;
  }

  /**
   * 验证配置完整性
   */
  validate() {
    const errors = [];
    const required = [
      'prompt.maxLength',
      'duration.maxShotDuration',
      'emotion.phases',
      'llm.timeoutMs',
      'render.endpoint'
    ];
    
    for (const path of required) {
      if (this.get(path) === undefined) {
        errors.push(`缺失必要配置: ${path}`);
      }
    }
    
    // 验证Prompt长度约束
    const maxLen = this.getPromptMaxLength();
    if (maxLen > 1200 || maxLen < 100) {
      errors.push(`prompt.maxLength ${maxLen} 超出合理范围 [100, 1200]`);
    }
    
    // 验证时长约束
    const maxDur = this.get('duration.maxShotDuration');
    const minDur = this.get('duration.minShotDuration');
    if (maxDur <= minDur) {
      errors.push(`duration.maxShotDuration(${maxDur}) 必须 > minShotDuration(${minDur})`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      configVersion: this.get('version')
    };
  }

  /**
   * 导出当前配置（用于调试/备份）
   */
  export() {
    return this.deepClone(this.config);
  }
}

// ============================================================
// 三、单例管理
// ============================================================

let instance = null;

function getConfigCenter(options) {
  if (!instance) {
    instance = new ConfigCenter();
    instance.load(options);
  }
  return instance;
}

function resetConfigCenter() {
  instance = null;
}

// ============================================================
// 四、向后兼容（v5.5旧接口）
// ============================================================

function getConfig() {
  return getConfigCenter().export();
}

function getConfigPath() {
  return getConfigCenter().configPath || path.join(__dirname, '../../config');
}

module.exports = {
  ConfigCenter,
  getConfigCenter,
  getConfig,        // 向后兼容
  getConfigPath,    // 向后兼容
  resetConfigCenter,
  DEFAULT_CONFIG
};
