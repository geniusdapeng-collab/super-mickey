/**
 * Smart Trim v2.0 — 增量式 Prompt 裁剪引擎
 * 
 * 核心改进（对比 v1.x）：
 * 1. incrementalTrim: 精确定位每个字段贡献的字符数，计算超出量后在精确位置裁剪
 * 2. 语义边界保护: 优先在句子/从句边界裁剪，绝不截断词组
 * 3. Duration 字段保护: 时长信息从 P3 升级到 P2（被保护）
 * 4. 裁剪审计: 每次裁剪记录被移除的内容，用于质量追溯
 * 
 * 裁剪优先级（从低到高保护）：
 *   P3 (优先裁): DIRECTOR(导演风格) → RENDER(渲染参数)
 *   P2 (适度裁): NEGATIVE(负面词) → AUDIO(音效) → DURATION(时长信息)
 *   P1 (保护裁): ACTION(动作) → SCENE(场景) → MOOD(情绪) → CAMERA(运镜) → LIGHTING(灯光)
 *   P0 (绝不裁): CHARACTER(角色锚点)
 * 
 * 统计单位: Unicode 字符数（String.prototype.length），非字节
 */

'use strict';

// ============================================================
// 一、字段定义（与 config-center-v2.js / prompt-standard-v2.js 对齐）
// ============================================================

const FIELD_DEFS = {
  CHARACTER:  { priority: 'P0', label: '角色锚点',    minLength: 10,  targetLength: 30,  trimStrategy: 'never' },
  ACTION:     { priority: 'P0', label: '动作表演',    minLength: 40,  targetLength: 120,  trimStrategy: 'never' },
  SCENE:      { priority: 'P1', label: '场景环境',    minLength: 100, targetLength: 175, trimStrategy: 'protect' },
  MOOD:       { priority: 'P1', label: '情绪氛围',    minLength: 15,  targetLength: 35,  trimStrategy: 'protect' },
  CAMERA:     { priority: 'P1', label: '运镜方案',    minLength: 60,  targetLength: 115, trimStrategy: 'protect' },
  LIGHTING:   { priority: 'P1', label: '灯光设计',    minLength: 50,  targetLength: 95,  trimStrategy: 'protect' },
  NEGATIVE:   { priority: 'P2', label: '负面提示词',  minLength: 40,  targetLength: 70,  trimStrategy: 'moderate' },
  AUDIO:      { priority: 'P2', label: '音效设计',    minLength: 30,  targetLength: 65,  trimStrategy: 'moderate' },
  DURATION:   { priority: 'P2', label: '时长信息',    minLength: 20,  targetLength: 45,  trimStrategy: 'moderate' }, // v2.0: 从P3升级到P2
  DIRECTOR:   { priority: 'P3', label: '导演风格',    minLength: 15,  targetLength: 30,  trimStrategy: 'aggressive' }
};

const FIELD_ORDER = ['CHARACTER', 'ACTION', 'SCENE', 'MOOD', 'CAMERA', 'LIGHTING', 'NEGATIVE', 'AUDIO', 'DURATION', 'DIRECTOR'];
const PRIORITY_ORDER = ['P3', 'P2', 'P1', 'P0']; // 裁剪顺序：P3先被裁

// Prompt 格式常量（与 prompt-standard-v2.js 对齐）
const SEPARATOR = ' | ';
const FIELD_PREFIX = ': ';

function parsePromptFields(promptText) {
  const fields = {};
  const rawText = promptText;
  
  // 按分隔符分割
  const parts = rawText.split(SEPARATOR);
  
  for (const part of parts) {
    const colonIndex = part.indexOf(FIELD_PREFIX);
    if (colonIndex === -1) continue;
    
    const fieldName = part.substring(0, colonIndex).trim();
    const content = part.substring(colonIndex + FIELD_PREFIX.length).trim();
    
    if (FIELD_DEFS[fieldName]) {
      fields[fieldName] = {
        present: true,
        content,
        length: content.length
      };
    }
  }
  
  // 确保所有字段都有记录
  for (const fieldName of FIELD_ORDER) {
    if (!fields[fieldName]) {
      fields[fieldName] = { present: false, content: '', length: 0 };
    }
  }
  
  return fields;
}

// ============================================================
// 三、增量裁剪引擎（核心改进）
// ============================================================

class IncrementalTrimEngine {
  constructor(options = {}) {
    this.targetLength = options.targetLength || 1500;
    this.minEffectiveLength = options.minEffectiveLength || 850;
    this.auditLog = [];
    this.preserveSentences = options.preserveSentences !== false;
    this.preserveClauses = options.preserveClauses !== false;
  }

  /**
   * 主入口：增量裁剪 Prompt
   * @param {string} prompt - 完整 Prompt 字符串
   * @param {Object} options - 裁剪选项
   * @returns {Object} { trimmedPrompt, auditLog, stats }
   */
  trim(prompt, options = {}) {
    this.auditLog = [];
    
    const originalLength = prompt.length;
    
    // 1. 如果未超限，直接返回
    if (originalLength <= this.targetLength) {
      return {
        trimmedPrompt: prompt,
        wasTrimmed: false,
        auditLog: [],
        stats: {
          originalLength,
          finalLength: originalLength,
          charsRemoved: 0,
          fieldsTrimmed: 0
        }
      };
    }
    
    // 2. 解析字段
    const fields = parsePromptFields(prompt);
    
    // 3. 计算超出量
    let excess = originalLength - this.targetLength;
    
    // 4. 按优先级增量裁剪
    let trimmedFields = { ...fields };
    let totalCharsRemoved = 0;
    let fieldsTrimmed = 0;
    
    for (const priority of PRIORITY_ORDER) {
      if (excess <= 0) break;
      
      for (const fieldName of FIELD_ORDER) {
        if (excess <= 0) break;
        
        const fieldDef = FIELD_DEFS[fieldName];
        if (fieldDef.priority !== priority) continue;
        if (!trimmedFields[fieldName]?.present) continue;
        if (fieldDef.trimStrategy === 'never') continue; // P0 绝不裁剪
        
        const currentContent = trimmedFields[fieldName].content;
        const currentLen = currentContent.length;
        const minLen = fieldDef.minLength;
        
        // 计算该字段最大可裁剪量
        const maxTrim = Math.max(0, currentLen - minLen);
        if (maxTrim <= 0) continue;
        
        // 计算实际需要裁剪量（不超过超出量）
        const neededTrim = Math.min(excess, maxTrim);
        
        // 执行语义边界裁剪
        const trimmedContent = this.trimAtSemanticBoundary(
          currentContent, 
          neededTrim, 
          fieldDef,
          fieldName
        );
        
        const actualRemoved = currentLen - trimmedContent.length;
        
        if (actualRemoved > 0) {
          trimmedFields[fieldName] = {
            ...trimmedFields[fieldName],
            content: trimmedContent,
            length: trimmedContent.length
          };
          
          excess -= actualRemoved;
          totalCharsRemoved += actualRemoved;
          fieldsTrimmed++;
          
          this.auditLog.push({
            field: fieldName,
            priority: fieldDef.priority,
            originalLength: currentLen,
            trimmedLength: trimmedContent.length,
            charsRemoved: actualRemoved,
            strategy: fieldDef.trimStrategy,
            removedText: currentContent.substring(trimmedContent.length).trim(),
            reason: `超出限制，按${fieldDef.priority}优先级裁剪`
          });
        }
      }
    }
    
    // 5. 重新组装
    let trimmedPrompt = this.assemblePrompt(trimmedFields);
    
    // 6. 如果仍然超长（保护区块等特殊情况），最后手段硬截断
    if (trimmedPrompt.length > this.targetLength) {
      const hardTrimmed = this.hardTrimWithAudit(trimmedPrompt, this.targetLength);
      trimmedPrompt = hardTrimmed.prompt;
      this.auditLog.push(...hardTrimmed.auditEntries);
      totalCharsRemoved += hardTrimmed.charsRemoved;
    }
    
    // 7. 如果低于有效长度，记录警告
    const belowEffective = trimmedPrompt.length < this.minEffectiveLength;
    
    return {
      trimmedPrompt,
      wasTrimmed: true,
      auditLog: this.auditLog,
      stats: {
        originalLength,
        finalLength: trimmedPrompt.length,
        charsRemoved: totalCharsRemoved,
        fieldsTrimmed,
        targetLength: this.targetLength,
        belowEffective,
        effectiveGap: belowEffective ? this.minEffectiveLength - trimmedPrompt.length : 0
      }
    };
  }

  /**
   * 语义边界裁剪：优先在句子/从句/短语边界裁剪
   */
  trimAtSemanticBoundary(content, trimAmount, fieldDef, fieldName) {
    const targetLen = content.length - trimAmount;
    
    if (targetLen <= 0) {
      return content.substring(0, Math.max(fieldDef.minLength, 1));
    }
    
    // 策略1: 在中文句子边界裁剪（最优先）
    if (this.preserveSentences) {
      const sentenceEnd = this.findLastSentenceBoundary(content, targetLen);
      if (sentenceEnd > fieldDef.minLength) {
        return content.substring(0, sentenceEnd).trim();
      }
    }
    
    // 策略2: 在从句/短语边界裁剪
    if (this.preserveClauses) {
      const clauseEnd = this.findLastClauseBoundary(content, targetLen);
      if (clauseEnd > fieldDef.minLength) {
        return content.substring(0, clauseEnd).trim();
      }
    }
    
    // 策略3: 在词组边界裁剪（空格或标点）
    const wordEnd = this.findLastWordBoundary(content, targetLen);
    if (wordEnd > fieldDef.minLength) {
      return content.substring(0, wordEnd).trim();
    }
    
    // 策略4: 硬截断（最后手段，但保留最小长度）
    const safeLen = Math.max(targetLen, fieldDef.minLength);
    return content.substring(0, safeLen).trim();
  }

  /**
   * 查找最后一个句子边界（在 targetLen 之前）
   */
  findLastSentenceBoundary(text, targetLen) {
    // 中文句子结束符
    const sentenceMarks = /[。！？.!?]/g;
    let lastIndex = -1;
    let match;
    
    while ((match = sentenceMarks.exec(text)) !== null) {
      if (match.index + 1 <= targetLen) {
        lastIndex = match.index + 1;
      } else {
        break;
      }
    }
    
    return lastIndex;
  }

  /**
   * 查找最后一个从句/短语边界
   */
  findLastClauseBoundary(text, targetLen) {
    // 从句分隔符：逗号、分号、连接词前的空格
    const clauseMarks = /[，；,;、]/g;
    let lastIndex = -1;
    let match;
    
    while ((match = clauseMarks.exec(text)) !== null) {
      if (match.index + 1 <= targetLen) {
        lastIndex = match.index + 1;
      } else {
        break;
      }
    }
    
    // 如果没找到从句边界，尝试连接词前的空格
    if (lastIndex === -1) {
      const conjunctions = /\s+(and|or|but|with|in|on|at|from|to|of|for)\s/gi;
      while ((match = conjunctions.exec(text)) !== null) {
        if (match.index <= targetLen) {
          lastIndex = match.index;
        }
      }
    }
    
    return lastIndex;
  }

  /**
   * 查找最后一个词组边界（空格）
   */
  findLastWordBoundary(text, targetLen) {
    // 从 targetLen 往前找第一个空格或标点
    for (let i = targetLen; i >= Math.max(0, targetLen - 20); i--) {
      if (i < text.length && /\s|[，。；！？.,;!?:]/.test(text[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 硬截断（最后手段，带审计）
   */
  hardTrimWithAudit(prompt, maxLength) {
    const removed = prompt.substring(maxLength);
    const auditEntries = [{
      field: '_hardTrim',
      priority: 'EMERGENCY',
      originalLength: prompt.length,
      trimmedLength: maxLength,
      charsRemoved: removed.length,
      strategy: 'hard',
      removedText: removed,
      reason: '语义边界裁剪后仍超长，执行硬截断'
    }];
    
    return {
      prompt: prompt.substring(0, maxLength),
      charsRemoved: removed.length,
      auditEntries
    };
  }

  /**
   * 组装 Prompt（与 prompt-standard-v2.js 格式对齐）
   * 格式: CHARACTER: content | ACTION: content | SCENE: content ...
   */
  assemblePrompt(fields) {
    const parts = [];
    
    // 按顺序组装字段
    for (const fieldName of FIELD_ORDER) {
      const field = fields[fieldName];
      if (field && field.present && field.content && field.content.length > 0) {
        parts.push(`${fieldName}${FIELD_PREFIX}${field.content}`);
      }
    }
    
    return parts.join(SEPARATOR);
  }
}

// ============================================================
// 四、兼容层：保持旧 smartTrim 接口
// ============================================================

function smartTrim(prompt, options = {}) {
  const engine = new IncrementalTrimEngine({
    targetLength: options.targetLength || options.maxLength || 1500,
    minEffectiveLength: options.minEffectiveLength || 850,
    preserveSentences: options.preserveSentences !== false,
    preserveClauses: options.preserveClauses !== false
  });
  
  const result = engine.trim(prompt, options);
  
  // 旧接口只返回字符串，新接口返回对象
  // 这里兼容旧行为，但内部记录审计日志
  if (options.returnStats) {
    return result;
  }
  
  return result.trimmedPrompt;
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  IncrementalTrimEngine,
  smartTrim,
  parsePromptFields,
  FIELD_DEFS,
  FIELD_ORDER,
  PRIORITY_ORDER
};