/**
 * FieldRepairAgent - 内容修复环节
 * 负责: 接收检查报告 + 原始PRD，对镜头提示词进行修复
 * 位置: FieldCheckAgent之后，FieldGuard之前
 * 
 * 架构:
 *   RuleRepairer (规则自动修复层) - 确定性问题秒修
 *     · 负面词补全、路径规范化、标点修复、P2/P3截断
 *   LLMRepairer (LLM智能修复层) - PRD注入
 *     · 内容补全、一致性修正、风格对齐
 *     · 后处理: _smartTruncate() 防止超长
 *   _recheckRemaining() - 规则修复后识别剩余问题，只传给LLM
 */
const { BaseAgent } = require('../production-engine/agents/base-agent');
const { deepClone } = require('../../utils/safe-clone');
const { SPEC_MAP, Priority, Severity, IssueType, MAX_TOTAL_CHARS } = require('./field-check-agent');

// ============================================================
// 数据模型 - RepairAction, RepairLog, PRD
// ============================================================

class RepairAction {
  constructor({ fieldEn, method, before, after, reason }) {
    this.fieldEn = fieldEn;
    this.method = method; // 'rule' | 'llm'
    this.before = before;
    this.after = after;
    this.reason = reason;
  }
}

class RepairLog {
  constructor(shotId) {
    this.shotId = shotId;
    this.actions = [];
    this.prdReferenced = false;
  }

  add(action) { this.actions.push(action); }
}

class PRD {
  constructor({
    projectName = '',
    videoType = '',
    styleDirection = '',
    moodTone = '',
    characters = [],
    scenes = [],
    dialogues = [],
    specialConstraints = [],
    targetPlatform = '',
    rawText = '',
  }) {
    this.projectName = projectName;
    this.videoType = videoType;
    this.styleDirection = styleDirection;
    this.moodTone = moodTone;
    this.characters = characters;
    this.scenes = scenes;
    this.dialogues = dialogues;
    this.specialConstraints = specialConstraints;
    this.targetPlatform = targetPlatform;
    this.rawText = rawText;
  }

  toConstraintText() {
    const lines = [];
    if (this.projectName) lines.push(`项目名称：${this.projectName}`);
    if (this.videoType) lines.push(`视频类型：${this.videoType}`);
    if (this.styleDirection) lines.push(`风格方向：${this.styleDirection}`);
    if (this.moodTone) lines.push(`情绪基调：${this.moodTone}`);
    if (this.targetPlatform) lines.push(`目标平台：${this.targetPlatform}`);
    if (this.characters.length) {
      const charDesc = this.characters.map(c => `${c.name || ''}(${c.identity || ''})`).join('； ');
      lines.push(`角色设定：${charDesc}`);
    }
    if (this.scenes.length) {
      const sceneDesc = this.scenes.map(s => typeof s === 'string' ? s : s.description || '').join('； ');
      lines.push(`场景要求：${sceneDesc}`);
    }
    if (this.dialogues.length) {
      lines.push(`台词内容：${this.dialogues.join(' / ')}`);
    }
    if (this.specialConstraints.length) {
      lines.push(`特殊约束：${this.specialConstraints.join('； ')}`);
    }
    return lines.join('\n');
  }

  // 从 blueprint/metadata 自动构建 PRD
  // 【脱节3 修复】使用正确的字段映射，兼容双轨 metadata 结构
  static fromBlueprint(blueprint) {
    const meta = blueprint._metadata || blueprint.config?._metadata || {};
    const characters = blueprint.characters || [];
    const scenes = blueprint.scenes || [];
    
    // 从多层级结构中解析视频类型
    const videoType = meta.videoType || blueprint.videoType || blueprint.type || 'general';
    
    // 从风格字段解析风格方向（支持单轨/双轨）
    let styleDirection = meta.styleDirection || '';
    if (!styleDirection && blueprint.style) {
      const style = typeof blueprint.style === 'string' ? blueprint.style : (blueprint.style.primary || '');
      styleDirection = style;
    }
    
    // 从情绪字段解析（支持双轨：mood/emotionProfile）
    let moodTone = meta.moodTone || '';
    if (!moodTone) {
      if (blueprint.emotionProfile?.primary) {
        moodTone = `${blueprint.emotionProfile.primary}${blueprint.emotionProfile.secondary ? '+' + blueprint.emotionProfile.secondary : ''}`;
      } else if (blueprint.mood) {
        moodTone = blueprint.mood;
      } else if (blueprint.tone) {
        moodTone = blueprint.tone;
      }
    }
    
    // 解析角色（兼容多种格式）
    const parsedCharacters = characters.map(c => ({
      name: c.name || '',
      nameEn: c.nameEn || c.name_en || '',
      identity: c.identity || c.role || c.description || '',
      appearance: c.appearance || c.costume || c.description || '',
    }));
    
    // 解析场景（兼容字符串和对象格式）
    const parsedScenes = scenes.map(s => {
      if (typeof s === 'string') return s;
      return s.description || s.purpose || s.scene || JSON.stringify(s);
    }).filter(Boolean);
    
    // 解析特殊约束（多源合并）
    const specialConstraints = [];
    if (Array.isArray(meta.specialConstraints)) {
      specialConstraints.push(...meta.specialConstraints);
    }
    if (Array.isArray(blueprint.contentConstraints)) {
      specialConstraints.push(...blueprint.contentConstraints);
    }
    if (Array.isArray(blueprint.forbiddenElements)) {
      specialConstraints.push(...blueprint.forbiddenElements.map(f => `禁止: ${f}`));
    }
    
    // 解析台词
    const dialogues = (blueprint.dialogues || []).map(d => typeof d === 'string' ? d : d.text || '').filter(Boolean);
    
    return new PRD({
      projectName: blueprint.title || meta.projectName || '',
      videoType,
      styleDirection,
      moodTone,
      characters: parsedCharacters,
      scenes: parsedScenes,
      dialogues,
      specialConstraints: specialConstraints.slice(0, 10),
      targetPlatform: meta.targetPlatform || blueprint.platform || blueprint.targetPlatform || '',
      rawText: blueprint.rawText || ''
    });
  }
}

// ============================================================
// RuleRepairer - 规则自动修复层
// ============================================================

class RuleRepairer {
  repair(shot, report, prd = null) {
    const repaired = deepClone(shot);
    const actions = [];

    for (const issue of report.issues) {
      const fieldEn = issue.fieldEn;
      if (fieldEn === '_total') continue; // 总长度由LLM统一处理
      const current = repaired[fieldEn] || '';

      // 【审计修复·P0】新增：MISSING 类型问题的智能默认值填充
      if (issue.issueType === IssueType.MISSING && (!current || this._isEffectivelyEmpty(current))) {
        const defaultValue = this._generateDefault(fieldEn, prd, repaired);
        if (defaultValue && String(defaultValue).trim()) {
          repaired[fieldEn] = defaultValue;
          actions.push(new RepairAction({
            fieldEn, method: 'rule', before: current || '(空)',
            after: defaultValue,
            reason: `规则修复：${fieldEn} 字段缺失，根据上下文填充默认值`
          }));
          continue; // 已修复，跳过后续对该字段的处理
        }
      }

      // 修复1：负面约束缺失基础词
      if (fieldEn === 'negative' && current && issue.issueType === IssueType.INCOMPLETE && /no text/.test(issue.description)) {
        let fixed = current;
        if (!fixed.toLowerCase().includes('no text')) {
          fixed = 'no text, no watermark, ' + fixed;
        }
        if (fixed !== current) {
          repaired[fieldEn] = fixed;
          actions.push(new RepairAction({
            fieldEn, method: 'rule', before: current, after: fixed,
            reason: "规则修复：自动补充 'no text, no watermark' 基础负面词"
          }));
        }
      }

      // 修复2：定妆照路径格式
      if (fieldEn === 'portraits' && current && issue.issueType === IssueType.FORMAT_ERROR) {
        // 【P1-7 修复】portraits 可能是数组，先归一化为字符串
        const portraitsStr = Array.isArray(current)
          ? current.map(p => typeof p === 'string' ? p : (p && p.path ? p.path : JSON.stringify(p))).join(', ')
          : String(current);
        let normalized = portraitsStr.replace(/^['"]|['"]$/g, '').trim();
        if (prd && prd.characters.length) {
          const charName = prd.characters[0].nameEn || 'character';
          normalized = `/characters/${charName}/portrait_v1.png`;
        }
        if (normalized !== current) {
          repaired[fieldEn] = normalized;
          actions.push(new RepairAction({
            fieldEn, method: 'rule', before: current, after: normalized,
            reason: '规则修复：定妆照路径规范化为标准格式'
          }));
        }
      }

      // 修复3：台词句末标点
      if (fieldEn === 'dialogue' && current && issue.issueType === IssueType.FORMAT_ERROR && /句末标点/.test(issue.description)) {
        if (current && !/[。！？…]$/.test(current)) {
          const fixed = current + '。';
          repaired[fieldEn] = fixed;
          actions.push(new RepairAction({
            fieldEn, method: 'rule', before: current, after: fixed,
            reason: "规则修复：自动补充句末标点 '。'（口型闭合信号标记）"
          }));
        }
      }

      // 修复4：台词禁止标点移除
      if (fieldEn === 'dialogue' && current && issue.issueType === IssueType.FORMAT_ERROR && /禁止标点/.test(issue.description)) {
        const fixed = current.replace(/[；;：:""''"'\[\]【】]/g, ',');
        if (fixed !== current) {
          repaired[fieldEn] = fixed;
          actions.push(new RepairAction({
            fieldEn, method: 'rule', before: current, after: fixed,
            reason: '规则修复：移除禁止标点，替换为逗号'
          }));
        }
      }

      // 修复5：P2/P3字段超长规则截断
      if (fieldEn in SPEC_MAP && issue.issueType === IssueType.OVER_LENGTH && [Priority.P2, Priority.P3].includes(SPEC_MAP[fieldEn].priority)) {
        const spec = SPEC_MAP[fieldEn];
        if (current.length > spec.charMax) {
          let truncated = current.slice(0, spec.charMax);
          const lastComma = Math.max(truncated.lastIndexOf(','), truncated.lastIndexOf('，'), truncated.lastIndexOf(' '));
          if (lastComma > spec.charMax * 0.7) {
            truncated = truncated.slice(0, lastComma);
          }
          if (truncated !== current) {
            repaired[fieldEn] = truncated;
            actions.push(new RepairAction({
              fieldEn, method: 'rule', before: current, after: truncated,
              reason: `规则修复：${spec.priority} 字段超长，截断至 ${truncated.length} 字符`
            }));
          }
        }
      }
    }

    // 【P1-10 修复】RuleRepairer 写值同步 snake/camel/fields 三处
    for (const action of actions) {
      const fieldEn = action.fieldEn;
      const fixed = repaired[fieldEn];
      if (fixed === undefined) continue;
      const camel = fieldEn.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (camel !== fieldEn) repaired[camel] = fixed;
      if (repaired.fields && typeof repaired.fields === 'object') {
        repaired.fields[fieldEn] = fixed;
      }
    }

    return { repaired, actions };
  }

  /**
   * 【审计修复·P0】判断值是否实际为空（支持字符串/数组/对象）
   */
  _isEffectivelyEmpty(value) {
    if (!value) return true;
    if (typeof value === 'string') return !value.trim();
    if (Array.isArray(value)) return value.length === 0 || value.every(v => !v || (typeof v === 'string' && !v.trim()));
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * 【审计修复·P0】根据字段名和上下文生成智能默认值
   */
  _generateDefault(fieldEn, prd, shot) {
    const defaults = {
      director_instruction: prd?.styleDirection
        ? `${prd.styleDirection}，超写实8K电影级，画面质感高级细腻`
        : '好莱坞电影级超写实8K质感，画面细腻真实，光影层次分明',
      constraint: 'Aspect ratio: 16:9, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, Color space Rec.709',
      baseline: '8K超高清，电影级调色，真实物理光照，皮肤纹理细节完整，毛发渲染自然',
      scene: prd?.scenes?.length
        ? String(prd.scenes[0]).substring(0, 150)
        : '写实风格室内场景，自然光线充足，材质细节丰富，空间层次分明',
      lighting: '主光源：自然光5600K柔和漫射，补光：反光板柔化阴影，光质：柔和均匀无刺眼高光',
      camera_movement: '开场固定机位2秒建立构图，中段缓慢推轨接近主体，收尾稳定定格1秒',
      character: prd?.characters?.length
        ? `${prd.characters[0].name || '主角'}，${prd.characters[0].appearance || '写实形象，自然神态，服装得体'}`
        : '主角，写实形象，自然神态，服装得体，站姿放松自然',
      action: '自然站立，双手自然摆放，眼神平视前方，呼吸平稳，身体微微放松',
      dialogue: [{ speaker: '', text: '（无对白）' }],
      negative: 'no text anywhere in frame, no watermark, no logo, no subtitle, no caption, no blur, no distortion, no extra limbs, no deformed, no cartoon style, no anime, no illustration',
      portraits: prd?.characters?.length
        ? [`/characters/${prd.characters[0].nameEn || prd.characters[0].name || 'default'}/portrait_v1.png`]
        : ['/characters/default/portrait_v1.png'],
      consistency: prd?.characters?.length
        ? `保持${prd.characters[0].name || '角色'}形象跨镜头一致：发型、服装、面部特征、体型完全统一`
        : '保持角色形象跨镜头一致：发型、服装、面部特征、体型完全统一',
      composition: 'medium shot, subject positioned at left third intersection, balanced background, clear focal point',
      color_palette: 'natural color palette, warm skin tones, neutral background, balanced saturation, cinematic color grading',
      depth_of_field: 'moderate depth of field f/4, subject in sharp focus, soft background blur, cinematic separation',
      timeline: 'T00:00-开场构图，建立场景氛围；T00:02-主体动作，叙事推进；T00:05-收尾定格，情绪沉淀',
      mood: 'calm, professional, natural atmosphere',
      bright_constraint: 'bright lighting, well-lit scene, clear visibility, no dark shadows on face, adequate illumination, face clearly lit',
      character_constraint: '只出现指定角色一人，禁止其他人物入镜，禁止同一角色重复出现，禁止角色分身或克隆',
      costume: '日常便装，整洁得体，符合角色身份设定',
      props: '符合场景逻辑的日常物品，与角色动作协调',
      pacing: '整体：舒缓自然；开头：平稳引入；中段：自然推进；高潮：轻微加速；结尾：从容收尾',
      audio: 'ambient environmental sound, subtle background atmosphere, natural room tone, no music',
      makeup: 'natural makeup, no heavy cosmetics, realistic skin texture visible',
      transition: 'hard cut, clean transition',
    };
    return defaults[fieldEn] || '';
  }
}

// ============================================================
// LLMRepairer - LLM智能修复层（PRD注入）
// ============================================================

const LLM_REPAIRER_SYSTEM_PROMPT = `你是 AI 视频生成提示词的【内容修复专家】，精通 HyperrealitySystem 字段规范 v3.0。

你的任务是根据检查报告中的问题，对提示词字段进行修复。修复时必须遵守以下原则：

【修复原则】
1. 业务需求优先：修复内容必须符合【用户需求文档PRD】中的业务约束，不得偏离项目定位
2. 规范合规：修复后的字段必须符合字段规范（四要素/五要素/三段式等格式要求）
3. 最小改动：仅修改有问题的部分，不改动已合规的内容
4. 风格一致：修复后的字段须与其它字段保持风格一致
5. 强制中文输出：所有字段必须使用中文，禁止英文单词（专有名词如人名地名除外）

【输出格式】
返回JSON，key 为需要修复的字段英文名，value 为修复后的完整字段内容：
{
  "repaired_fields": {
    "director_instruction": "修复后的完整内容",
    "lighting": "修复后的完整内容"
  }
}

只返回需要修复的字段，不要返回未出问题的字段。`;

class LLMRepairer {
  constructor(llmClient, timeoutMs = 180000) {
    this.llm = llmClient;
    this.timeoutMs = timeoutMs; // 【v2.1.4-fix13】增加超时配置
  }

  async repair(shot, report, prd) {
    // 筛选需要LLM修复的问题（排除规则已修复的）
    const llmIssues = report.issues.filter(i =>
      [Severity.FATAL, Severity.MAJOR].includes(i.severity) && i.fieldEn !== '_total'
    );

    if (!llmIssues.length || !this.llm) {
      return { repaired: shot, actions: [] };
    }

    // 构建问题清单
    const issuesText = llmIssues.map(i => {
      const currentVal = i.currentValue || shot[i.fieldEn] || '（缺失）';
      return `- 字段【${i.fieldCn}】(${i.fieldEn})：${i.description}\n  修改建议：${i.suggestion}\n  当前值：${String(currentVal).slice(0, 80)}`;
    }).join('\n');

    // PRD约束文本（核心：防止修复偏离业务需求）
    const prdConstraint = prd ? prd.toConstraintText() : '';

    // 当前字段快照 + 字符预算
    const fieldsToRepair = [...new Set(llmIssues.map(i => i.fieldEn))];
    const currentFields = {};
    for (const f of fieldsToRepair) {
      currentFields[f] = shot[f] || '';
    }
    const currentFieldsJson = JSON.stringify(currentFields, null, 2);

    const budgetHints = [];
    for (const f of fieldsToRepair) {
      const spec = SPEC_MAP[f];
      if (spec && spec.charMax < 9999) {
        budgetHints.push(` - ${f}：≤ ${spec.charMax} 字符`);
      }
    }
    const budgetText = budgetHints.length ? budgetHints.join('\n') : ' （无特殊限制）';

    const userPrompt = `请根据以下信息修复提示词字段：\n\n【用户需求文档 PRD 约束】（修复时必须遵守，不得偏离）\n${prdConstraint}\n\n【需要修复的字段当前内容】\n${currentFieldsJson}\n\n【字符数预算限制】（修复后每个字段不得超过上限）\n${budgetText}\n\n【检查发现的问题】\n${issuesText}\n\n请修复上述问题，确保修复后的字段：\n1. 符合 PRD 中的视频类型、风格方向、情绪基调等业务约束\n2. 符合字段规范的格式要求\n3. 与其它字段保持风格一致\n4. 严格控制字符数在预算上限以内\n\n返回JSON格式的修复结果。`;

    // 【v2.1.4-fix13】增加超时保护
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`LLMRepairer超时(${this.timeoutMs}ms)`)),
        this.timeoutMs
      );
    });

    try {
      const repairPromise = this.llm.reason(userPrompt, { 
        systemPrompt: LLM_REPAIRER_SYSTEM_PROMPT, 
        temperature: 1 
      });
      repairPromise.catch(() => {}); // 【v2.1.6-fix】防止悬空 rejection
      const response = await Promise.race([
        repairPromise,
        timeoutPromise
      ]).finally(() => clearTimeout(timer));

      // 【修复 P0-4/P0-6】reason() 返回信封格式 {success, content, error}，必须提取 content
      let rawContent;
      if (response && typeof response === 'object') {
        if (response.success === true && typeof response.content === 'string') {
          rawContent = response.content;
        } else if (response.success === false) {
          console.warn(`[LLMRepairer] LLM返回失败: ${response.error || '未知错误'}`);
          return { repairedShot: shot, actions: [], degraded: true };
        }
      }
      const data = (typeof rawContent === 'string') ? JSON.parse(rawContent) : (rawContent || {});
      const repairedFields = data.repaired_fields || {};

      const repairedShot = deepClone(shot);
      const actions = [];

      // 【v2.1.4-fix13】构建字段名映射表，支持 snake_case ↔ camelCase
      const { SNAKE_TO_CAMEL, CAMEL_TO_SNAKE } = require('./field-check-agent');

      for (const [fieldEn, newValue] of Object.entries(repairedFields)) {
        if (!newValue || !String(newValue).trim()) continue;

        // 【v2.1.4-fix13】将 LLM 返回的 key 统一映射到 shot 中已有的字段名
        let targetField = fieldEn;
        // 如果 shot 中有 camelCase 版本，优先用 camelCase
        if (SNAKE_TO_CAMEL[fieldEn] && SNAKE_TO_CAMEL[fieldEn] in repairedShot) {
          targetField = SNAKE_TO_CAMEL[fieldEn];
        }
        // 如果 shot 中有 snake_case 版本
        else if (CAMEL_TO_SNAKE[fieldEn] && CAMEL_TO_SNAKE[fieldEn] in repairedShot) {
          targetField = CAMEL_TO_SNAKE[fieldEn];
        }
        // 同时检查 fields 嵌套对象
        else if (repairedShot.fields) {
          if (SNAKE_TO_CAMEL[fieldEn] && SNAKE_TO_CAMEL[fieldEn] in repairedShot.fields) {
            targetField = `fields.${SNAKE_TO_CAMEL[fieldEn]}`;
          } else if (fieldEn in repairedShot.fields) {
            targetField = `fields.${fieldEn}`;
          }
        }

        const oldValue = targetField.includes('.')
          ? targetField.split('.').reduce((obj, k) => obj?.[k], repairedShot) || ''
          : repairedShot[targetField] || '';

        // 字符数后处理
        const spec = SPEC_MAP[fieldEn] || SPEC_MAP[SNAKE_TO_CAMEL[fieldEn]];
        let finalValue = newValue;
        if (spec && spec.charMax < 9999 && finalValue.length > spec.charMax) {
          finalValue = this._smartTruncate(finalValue, spec.charMax);
        }

        if (finalValue !== oldValue) {
          // 赋值（支持嵌套 fields 对象）
          if (targetField.includes('.')) {
            const [parent, child] = targetField.split('.');
            repairedShot[parent][child] = finalValue;
          } else {
            repairedShot[targetField] = finalValue;
          }
          // 【v2.1.4-fix13】同时在 snake_case 和 camelCase 两个位置都赋值，确保下游都能取到
          if (SNAKE_TO_CAMEL[fieldEn]) {
            repairedShot[SNAKE_TO_CAMEL[fieldEn]] = finalValue;
          }
          if (CAMEL_TO_SNAKE[fieldEn]) {
            repairedShot[CAMEL_TO_SNAKE[fieldEn]] = finalValue;
          }

          actions.push(new RepairAction({
            fieldEn, method: 'llm', before: oldValue, after: finalValue,
            reason: 'LLM 修复：参考 PRD 约束修复检查问题'
          }));
        }
      }

      return { repaired: repairedShot, actions };
    } catch (e) {
      // 【v2.1.4-fix13】区分超时和其他异常
      if (e.message?.includes('超时')) {
        console.warn(`[LLMRepairer] 修复超时(${this.timeoutMs}ms)，返回原始shot`);
      } else {
        console.warn(`[LLMRepairer] 修复异常: ${e.message}`);
      }
      return { repaired: shot, actions: [] };
    }
  }

  _smartTruncate(text, maxLen) {
    if (text.length <= maxLen) return text;
    let truncated = text.slice(0, maxLen);
    for (const sep of [', ', '，', '; ', '；', ' ']) {
      const idx = truncated.lastIndexOf(sep);
      if (idx > maxLen * 0.6) {
        return truncated.slice(0, idx);
      }
    }
    return truncated;
  }
}

// ============================================================
// FieldRepairAgent - 修复环节编排器
// ============================================================

class FieldRepairAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'FieldRepairAgent', llmTimeout: options.llmTimeout || 180000, ...options });
    this.ruleRepairer = new RuleRepairer();
    // 【v2.1.4-fix13】把超时配置传给 LLMRepairer
    this.llmRepairer = new LLMRepairer(this._getLLMEngine(), options.llmTimeout || 180000);
    this.prd = options.prd || null;
  }

  setPRD(prd) { this.prd = prd; }

  async repair(shot, report, shotId = 'shot_001') {
    console.log(`[FieldRepairAgent] 开始修复 ${shotId}...`);
    const log = new RepairLog(shotId);
    log.prdReferenced = !!this.prd;
    let repaired = deepClone(shot);

    // 第一层：规则自动修复
    const { repaired: ruleRepaired, actions: ruleActions } = this.ruleRepairer.repair(repaired, report, this.prd);
    repaired = ruleRepaired;
    log.actions.push(...ruleActions);
    console.log(`[FieldRepairAgent] RuleRepairer 完成：${ruleActions.length} 项修复`);

    // 第二层：LLM智能修复（注入PRD约束）
    if (this.llmRepairer.llm && this.prd) {
      // 重新检查规则修复后的shot，确认哪些问题仍需LLM修复
      const remainingReport = this._recheckRemaining(repaired, report);
      if (remainingReport.issues.length) {
        const { repaired: llmRepaired, actions: llmActions } = await this.llmRepairer.repair(repaired, remainingReport, this.prd);
        repaired = llmRepaired;
        log.actions.push(...llmActions);
        console.log(`[FieldRepairAgent] LLMRepairer 完成：${llmActions.length} 项修复`);
      }
    }

    console.log(`[FieldRepairAgent] 修复完成：共 ${log.actions.length} 项修复动作`);

    // 【v2.1.6-fix】Prompt 长度同步：修复后重新计算 promptCharCount
    const { PromptSync } = require('../../utils/prompt-sync');
    const promptSync = new PromptSync();
    promptSync.sync(repaired, 'FieldRepairAgent');

    return { repaired, log };
  }

  _recheckRemaining(shot, originalReport) {
    // 识别规则修复后仍存在的问题，供LLM修复
    const { CheckReport } = require('./field-check-agent');
    const remaining = new CheckReport(originalReport.shotId);

    // 规则可修复的字段+问题类型组合
    const ruleFixable = new Set([
      'negative|incomplete',
      'portraits|format_error',
      'dialogue|format_error',
    ]);

    for (const issue of originalReport.issues) {
      const key = `${issue.fieldEn}|${issue.issueType}`;
      if (ruleFixable.has(key)) {
        const current = shot[issue.fieldEn] || '';
        // 检查规则修复后是否已解决
        if (issue.fieldEn === 'negative' && /no text/.test(current.toLowerCase())) continue;
        if (issue.fieldEn === 'portraits' && /\/characters\/.+\/portrait_v\d+\.(png|jpg)/.test(current)) continue;
        if (issue.fieldEn === 'dialogue' && /句末标点/.test(issue.description)) {
          if (current && /[。！？…]$/.test(current)) continue;
        }
        if (issue.fieldEn === 'dialogue' && /禁止标点/.test(issue.description)) {
          if (!/[；;：:""''"'\[\]【】]/.test(current)) continue;
        }
        // 跳过P2/P3超长问题（规则已截断）
        if (issue.issueType === IssueType.OVER_LENGTH && issue.fieldEn in SPEC_MAP && [Priority.P2, Priority.P3].includes(SPEC_MAP[issue.fieldEn].priority)) {
          if (current.length <= SPEC_MAP[issue.fieldEn].charMax) continue;
        }
      }
      remaining.issues.push(issue);
    }

    return remaining;
  }

  // 批量修复多个镜头
  async repairAll(shots, reports) {
    const results = [];
    const logs = [];
    for (let i = 0; i < shots.length; i++) {
      const { repaired, log } = await this.repair(shots[i], reports[i], shots[i].shotId || shots[i].shot_id || `shot_${i}`);
      results.push(repaired);
      logs.push(log);
    }
    return { repaired: results, logs };
  }
}

module.exports = {
  FieldRepairAgent,
  RuleRepairer,
  LLMRepairer,
  RepairAction,
  RepairLog,
  PRD,
};