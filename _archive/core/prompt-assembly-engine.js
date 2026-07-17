/**
 * Prompt Assembly Engine v1.0 — 结构化Prompt组装引擎
 * 系统核心基础设施：替代字符串拼接，让Prompt从"文档"变成"数据结构"
 *
 * 职责：
 * - 结构化Prompt：每个Prompt是Section数组，而非长字符串
 * - 自动补全：缺失字段自动填充（如duration、camera）
 * - 增量裁剪：指定字段瘦身，而非整个Prompt截断
 * - 智能组装：根据镜头类型自动选择Section模板
 * - 与Smart Trim v2集成：组装后自动裁剪到490汉字
 * - 与Immutable Shot集成：确保Prompt变更可追溯
 *
 * 核心能力：
 * 1. PromptSection: { type, content, priority, minLength, required }
 * 2. PromptAssemblyEngine: 组装Section → 生成完整Prompt
 * 3. AutoCompletion: 缺失字段自动推断
 * 4. IncrementalTrim: 指定字段瘦身，优先裁剪低优先级字段
 * 5. TemplateLibrary: 镜头类型模板（开场、推进、高潮、转场）
 *
 * 设计原则：
 * - 可追踪：每个Section有来源标识（哪个Stage生成）
 * - 可恢复：裁剪前的Section保留完整版本，可回溯
 * - 智能：知道哪些字段是核心（视觉描述）vs 可裁剪（环境补充）
 *
 * @version v1.0
 * @author Core Team
 * @priority P0 - 数据完整性
 */

'use strict';

const { SmartTrimV2 } = require('../systems/smart-trim-v2');
const { safeTrimPrompt } = require('../systems/safe-prompt-trim');
const { ImmutableShot } = require('./immutable-shot');
const PROMPT_LENGTH = require('../config/prompt-length');

// ============================================================
// 一、Prompt Section（Prompt的最小原子单元）
// ============================================================

class PromptSection {
  constructor({ type, content, priority = 5, minLength = 0, required = false, source = 'unknown', trimmable = true }) {
    this.type = type;         // 'visual', 'camera', 'character', 'environment', 'emotion', 'style', 'duration', 'narration', 'negative'
    this.content = content;   // 内容字符串
    this.priority = priority; // 1-10，1最高（核心），10最低（可裁剪）
    this.minLength = minLength; // 最小保留长度
    this.required = required;   // 是否必须保留（不可裁剪）
    this.source = source;       // 来源Stage
    this.trimmable = trimmable; // 是否可裁剪
    this.originalLength = content.length; // 原始长度
  }

  /**
   * 裁剪Section到指定长度
   */
  trim(maxLength, strategy = 'end') {
    if (this.content.length <= maxLength) return this;
    if (!this.trimmable || this.required) return this; // 不可裁剪

    let trimmed = this.content;
    if (strategy === 'end') {
      trimmed = this.content.substring(0, maxLength);
    } else if (strategy === 'middle') {
      const half = Math.floor(maxLength / 2);
      trimmed = this.content.substring(0, half) + '...' + this.content.substring(this.content.length - half);
    } else if (strategy === 'smart') {
      trimmed = this.smartTrim(this.content, maxLength);
    }

    return new PromptSection({
      ...this,
      content: trimmed,
      trimmable: false  // 已裁剪，标记为不可再裁剪
    });
  }

  smartTrim(text, maxLength) {
    // 智能裁剪：保留句子完整性
    const sentences = text.split(/([。！？.!?])/);
    let result = '';
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      if (result.length + sentence.length > maxLength) break;
      result += sentence;
    }
    return result || text.substring(0, maxLength);
  }

  get length() {
    return this.content.length;
  }

  toString() {
    return this.content;
  }
}

// ============================================================
// 二、镜头类型模板库
// ============================================================

const SHOT_TEMPLATES = {
  opening: {
    name: '开场镜头',
    requiredSections: ['visual', 'character', 'environment'],
    optionalSections: ['camera', 'emotion', 'style'],
    priorityRules: {
      'visual': 1,      // 最高优先级
      'character': 2,
      'environment': 3,
      'camera': 4,
      'emotion': 5,
      'style': 6
    }
  },
  establishing: {
    name: '建景镜头',
    requiredSections: ['environment', 'visual'],
    optionalSections: ['camera', 'style'],
    priorityRules: {
      'environment': 1,
      'visual': 2,
      'camera': 3,
      'style': 4
    }
  },
  building: {
    name: '推进镜头',
    requiredSections: ['visual', 'character', 'camera'],
    optionalSections: ['emotion', 'environment'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'camera': 3,
      'emotion': 4,
      'environment': 5
    }
  },
  reveal: {
    name: '揭示镜头',
    requiredSections: ['visual', 'character', 'emotion'],
    optionalSections: ['camera', 'environment'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'emotion': 3,
      'camera': 4,
      'environment': 5
    }
  },
  climax: {
    name: '高潮镜头',
    requiredSections: ['visual', 'character', 'emotion', 'camera'],
    optionalSections: ['environment', 'style'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'emotion': 3,
      'camera': 4,
      'environment': 5,
      'style': 6
    }
  },
  transition: {
    name: '转场镜头',
    requiredSections: ['visual', 'camera'],
    optionalSections: ['environment'],
    priorityRules: {
      'camera': 1,    // 转场最重要的是运镜
      'visual': 2,
      'environment': 3
    }
  },
  closeup: {
    name: '特写镜头',
    requiredSections: ['visual', 'character'],
    optionalSections: ['emotion', 'camera'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'emotion': 3,
      'camera': 4
    }
  }
};

// ============================================================
// 三、Prompt 组装引擎
// ============================================================

class PromptAssemblyEngine {
  constructor(options = {}) {
    this.maxLength = options.maxLength || PROMPT_LENGTH.HARD_MAX;
    this.maxLengthChars = options.maxLengthChars || PROMPT_LENGTH.TARGET_MAX;
    this.templates = { ...SHOT_TEMPLATES };
    this.smartTrim = new SmartTrimV2();
    this.completions = 0;
    this.trims = 0;
  }

  /**
   * 从Shot对象组装Prompt
   */
  assembleFromShot(shot, options = {}) {
    const shotType = shot.type || 'building';
    const template = this.templates[shotType] || this.templates.building;

    // 1. 提取Section
    const sections = this.extractSections(shot, template, options);

    // 2. 自动补全
    const completedSections = this.autoComplete(sections, template, shot);

    // 3. 组装
    let assembled = this.assemble(completedSections, options);

    // 4. 裁剪到长度限制
    if (assembled.length > this.maxLength) {
      console.log(`[PromptAssembly] 📏 Prompt超长(${assembled.length}/${this.maxLength})，启动增量裁剪...`);
      assembled = this.incrementalTrim(completedSections, this.maxLength);
      this.trims++;
    }

    // 5. 生成元数据
    return {
      prompt: assembled,
      sections: completedSections.map(s => ({
        type: s.type,
        length: s.length,
        priority: s.priority,
        source: s.source,
        trimmed: s.length < s.originalLength
      })),
      totalLength: assembled.length,
      charCount: this.countChineseChars(assembled),
      wasTrimmed: assembled.length < completedSections.reduce((sum, s) => sum + s.originalLength, 0),
      template: template.name
    };
  }

  /**
   * 从Shot提取Section
   */
  extractSections(shot, template, options = {}) {
    const sections = [];
    const data = shot.data || shot._data || shot;

    // 视觉描述（核心）
    if (data.visualPrompt || data.prompt) {
      sections.push(new PromptSection({
        type: 'visual',
        content: data.visualPrompt || data.prompt,
        priority: template.priorityRules['visual'] || 1,
        required: true,
        source: 'STAGE-7',
        trimmable: false  // 视觉描述不可裁剪
      }));
    }

    // 角色描述
    if (data.characters && data.characters.length > 0) {
      const characterDesc = data.characters.map(c =>
        `${c.name || c.role}: ${c.appearance || c.visualSignature || ''}`
      ).filter(Boolean).join('；');
      if (characterDesc) {
        sections.push(new PromptSection({
          type: 'character',
          content: characterDesc,
          priority: template.priorityRules['character'] || 2,
          required: true,
          source: 'STAGE-4',
          trimmable: true
        }));
      }
    }

    // 运镜
    if (data.cameraMovement) {
      const camera = data.cameraMovement;
      const cameraDesc = `${camera.type || ''}运镜，${camera.direction || ''}`.trim();
      if (cameraDesc) {
        sections.push(new PromptSection({
          type: 'camera',
          content: cameraDesc,
          priority: template.priorityRules['camera'] || 4,
          required: false,
          source: 'STAGE-9',
          trimmable: true
        }));
      }
    }

    // 环境
    if (data.scene || data.sceneName) {
      sections.push(new PromptSection({
        type: 'environment',
        content: `场景：${data.scene || data.sceneName}`,
        priority: template.priorityRules['environment'] || 5,
        required: false,
        source: 'STAGE-5',
        trimmable: true
      }));
    }

    // 情绪
    if (data.emotionPhase || data.emotionalIntensity) {
      const emotionDesc = `情绪：${data.emotionPhase || ''}${data.emotionalIntensity ? `（强度${data.emotionalIntensity}）` : ''}`;
      sections.push(new PromptSection({
        type: 'emotion',
        content: emotionDesc,
        priority: template.priorityRules['emotion'] || 5,
        required: false,
        source: 'STAGE-5',
        trimmable: true
      }));
    }

    // 风格（Nirath注入）
    if (options.styleInjection) {
      sections.push(new PromptSection({
        type: 'style',
        content: options.styleInjection,
        priority: template.priorityRules['style'] || 6,
        required: false,
        source: 'STAGE-14',
        trimmable: true
      }));
    }

    // 时长
    if (data.duration || data.shotDuration || data.targetDuration) {
      const dur = data.duration || data.shotDuration || data.targetDuration;
      sections.push(new PromptSection({
        type: 'duration',
        content: `时长：${dur}秒`,
        priority: 10,
        required: false,
        source: 'STAGE-6',
        trimmable: true
      }));
    }

    // 负面提示词
    if (options.negativePrompt) {
      sections.push(new PromptSection({
        type: 'negative',
        content: `排除：${options.negativePrompt}`,
        priority: 10,
        required: false,
        source: 'system',
        trimmable: true
      }));
    }

    return sections;
  }

  /**
   * 自动补全缺失字段
   */
  autoComplete(sections, template, shot) {
    const completed = [...sections];
    const existingTypes = new Set(sections.map(s => s.type));

    // 检查缺失的必填Section
    for (const type of template.requiredSections) {
      if (!existingTypes.has(type)) {
        console.log(`[PromptAssembly] 🔧 自动补全缺失Section: ${type}`);
        this.completions++;

        // 根据类型推断默认值
        const defaultContent = this.inferDefault(type, shot, template);
        completed.push(new PromptSection({
          type,
          content: defaultContent,
          priority: template.priorityRules[type] || 5,
          required: true,
          source: 'auto_complete',
          trimmable: true
        }));
      }
    }

    return completed;
  }

  /**
   * 推断默认值
   */
  inferDefault(type, shot, template) {
    const data = shot.data || shot._data || shot;

    switch (type) {
      case 'visual':
        return `画面：${data.scene || data.sceneName || '未命名场景'}`;
      case 'character':
        if (data.characters && data.characters.length > 0) {
          return `角色：${data.characters.map(c => c.name || c.role).join('、')}`;
        }
        return '角色：未指定';
      case 'camera':
        return `运镜：静态`;
      case 'environment':
        return `场景：${data.scene || data.sceneName || '未指定场景'}`;
      case 'emotion':
        return `情绪：平铺直叙`;
      default:
        return `${type}：未指定`;
    }
  }

  /**
   * 组装Section为完整Prompt
   */
  assemble(sections, options = {}) {
    const separator = options.separator || '，';
    const ordered = [...sections].sort((a, b) => a.priority - b.priority);
    return ordered.map(s => s.content).join(separator);
  }

  /**
   * 增量裁剪：按优先级从低到高裁剪
   */
  incrementalTrim(sections, maxLength) {
    // 按优先级排序（低优先级在前）
    const sorted = [...sections].sort((a, b) => b.priority - a.priority);
    let totalLength = sections.reduce((sum, s) => sum + s.length, 0);

    for (const section of sorted) {
      if (totalLength <= maxLength) break;
      if (!section.trimmable || section.required) continue;

      const excess = totalLength - maxLength;
      const targetLength = Math.max(section.minLength, section.length - excess);

      const trimmed = section.trim(targetLength, 'smart');
      totalLength -= (section.length - trimmed.length);
    }

    // 如果还超长，裁剪trimmable但非required的字段
    if (totalLength > maxLength) {
      for (const section of sorted) {
        if (totalLength <= maxLength) break;
        if (section.required || !section.trimmable) continue;

        const excess = totalLength - maxLength;
        const targetLength = Math.max(section.minLength, section.length - excess);
        const trimmed = section.trim(targetLength, 'smart');
        totalLength -= (section.length - trimmed.length);
      }
    }

    // 最终防线：如果还超长，强制裁剪visual
    if (totalLength > maxLength) {
      const visualIdx = sorted.findIndex(s => s.type === 'visual');
      if (visualIdx >= 0 && sorted[visualIdx].length > maxLength * 0.5) {
        const visualTarget = Math.floor(maxLength * 0.5);
        sorted[visualIdx] = safeTrimPrompt(sorted[visualIdx], visualTarget, {
          protectedLabels: ['CHARACTER', 'ACTION', 'SCENE', 'CAMERA']
        });
        totalLength -= (sorted[visualIdx].length - visualTarget);
        console.warn(`[Trim] 最终防线: visual安全裁剪到${visualTarget}`);
      }
    }

    let finalPrompt = this.assemble(sorted);

    if (finalPrompt.length > maxLength) {
      finalPrompt = safeTrimPrompt(finalPrompt, maxLength, {
        protectedLabels: ['CHARACTER', 'ACTION', 'SCENE', 'CAMERA', 'LIGHTING']
      });
    }

    return finalPrompt;
  }

  /**
   * 统计中文字符数
   */
  countChineseChars(text) {
    const chinese = text.match(/[\u4e00-\u9fa5]/g);
    return chinese ? chinese.length : 0;
  }

  /**
   * 批量组装（多个镜头）
   */
  assembleBatch(shots, options = {}) {
    return shots.map((shot, i) => {
      console.log(`[PromptAssembly] 🔄 组装镜头 ${i + 1}/${shots.length}`);
      return this.assembleFromShot(shot, options);
    });
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      maxLength: this.maxLength,
      maxLengthChars: this.maxLengthChars,
      completions: this.completions,
      trims: this.trims
    };
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  PromptSection,
  PromptAssemblyEngine,
  SHOT_TEMPLATES,

  // 快速组装
  assemblePrompt: (shot, options) => {
    const engine = new PromptAssemblyEngine(options);
    return engine.assembleFromShot(shot, options);
  }
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Prompt Assembly Engine 集成测试 ===\n');

    const engine = new PromptAssemblyEngine();

    // 测试1：基础组装
    console.log('--- 测试1：基础组装 ---');
    const shot = {
      id: 'S01',
      sequence: 1,
      type: 'opening',
      scene: '山顶',
      visualPrompt: '一个少年站在山顶，远眺云海',
      characters: [
        { name: '少年', role: 'protagonist', appearance: '短发，白衣' }
      ],
      cameraMovement: { type: 'dolly', direction: '向前推进' },
      duration: 5,
      emotionPhase: 'exposition',
      emotionalIntensity: 0.3
    };

    const result = engine.assembleFromShot(shot);
    console.log('组装结果:', result.prompt.substring(0, 100) + '...');
    console.log('总长度:', result.totalLength);
    console.log('中文字数:', result.charCount);
    console.log('Section数:', result.sections.length);
    console.log('是否裁剪:', result.wasTrimmed);

    // 测试2：超长Prompt裁剪
    console.log('\n--- 测试2：超长Prompt裁剪 ---');
    const longShot = {
      ...shot,
      visualPrompt: '一个少年站在山顶，远眺云海，风吹动他的衣角，阳光从云层中洒下，照亮他的脸庞，他的眼神坚定而深邃，仿佛在思考什么重要的事情，远处有飞鸟掠过，天空呈现出绚丽的晚霞色彩，整个画面充满了宁静与力量，这种构图让人联想到古典山水画的意境，但同时又有现代电影摄影的质感，少年的姿态自然而不做作，与周围的环境融为一体，形成了一幅完美的视觉画面。'.repeat(5)  // 超长
    };

    const longResult = engine.assembleFromShot(longShot);
    console.log('裁剪后长度:', longResult.totalLength);
    console.log('是否裁剪:', longResult.wasTrimmed);
    console.log('裁剪Section:', longResult.sections.filter(s => s.trimmed).map(s => s.type));

    // 测试3：自动补全
    console.log('\n--- 测试3：自动补全 ---');
    const incompleteShot = {
      id: 'S02',
      sequence: 2,
      type: 'building',
      scene: '山谷',
      visualPrompt: '少年走进山谷'  // 缺少characters、cameraMovement等
    };

    const completedResult = engine.assembleFromShot(incompleteShot);
    console.log('自动补全数:', engine.completions);
    console.log('Section数:', completedResult.sections.length);

    // 测试4：转场镜头
    console.log('\n--- 测试4：转场镜头 ---');
    const transitionShot = {
      id: 'S03',
      sequence: 3,
      type: 'transition',
      scene: '切换',
      visualPrompt: '从山谷切换到湖边',
      cameraMovement: { type: 'pan', direction: '从左到右' }
    };

    const transitionResult = engine.assembleFromShot(transitionShot);
    console.log('转场Prompt:', transitionResult.prompt.substring(0, 100));

    console.log('\n=== 测试完成 ===');
    console.log('引擎统计:', engine.getStats());
  }

  test().catch(console.error);
}
