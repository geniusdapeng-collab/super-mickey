/**
 * FieldRepairAgent v6.7.0 — 内容修复环节
 * 双通道修复：RuleRepairer（规则自动修） + LLMRepairer（LLM智能修，注入PRD）
 */

const { SPEC_MAP, Priority, RepairMethod, MAX_TOTAL_CHARS } = require('../field-check/field-specs');

// ============================================================
// 数据模型
// ============================================================

class RepairAction {
  constructor({ field_en, method, before, after, reason }) {
    this.field_en = field_en;
    this.method = method;
    this.before = before;
    this.after = after;
    this.reason = reason;
  }
}

class RepairLog {
  constructor(shot_id, prdReferenced = false) {
    this.shot_id = shot_id;
    this.actions = [];
    this.prd_referenced = prdReferenced;
  }

  add(action) { this.actions.push(action); }
}

class PRD {
  constructor(data = {}) {
    this.project_name = data.project_name || '';
    this.video_type = data.video_type || '';
    this.style_direction = data.style_direction || '';
    this.mood_tone = data.mood_tone || '';
    this.characters = data.characters || [];
    this.scenes = data.scenes || [];
    this.dialogues = data.dialogues || [];
    this.special_constraints = data.special_constraints || [];
    this.target_platform = data.target_platform || '';
    this.raw_text = data.raw_text || '';
  }

  toConstraintText() {
    const lines = [];
    if (this.project_name) lines.push(`项目名称：${this.project_name}`);
    if (this.video_type) lines.push(`视频类型：${this.video_type}`);
    if (this.style_direction) lines.push(`风格方向：${this.style_direction}`);
    if (this.mood_tone) lines.push(`情绪基调：${this.mood_tone}`);
    if (this.target_platform) lines.push(`目标平台：${this.target_platform}`);
    if (this.characters.length > 0) {
      const charDesc = this.characters.map(c => `${c.name || ''}(${c.identity || ''})`).join('；');
      lines.push(`角色设定：${charDesc}`);
    }
    if (this.scenes.length > 0) {
      const sceneDesc = this.scenes.map(s => s.description || '').join('；');
      lines.push(`场景要求：${sceneDesc}`);
    }
    if (this.dialogues.length > 0) {
      lines.push(`台词内容：${this.dialogues.join(' / ')}`);
    }
    if (this.special_constraints.length > 0) {
      lines.push(`特殊约束：${this.special_constraints.join('；')}`);
    }
    return lines.join('\n');
  }
}

// ============================================================
// RuleRepairer — 规则自动修复层
// ============================================================

class RuleRepairer {
  constructor(options = {}) {
    this.log = options.log || console.log;
  }

  repair(shot, report, prd = null) {
    const repaired = { ...shot };
    const actions = [];

    for (const issue of report.issues) {
      const fieldEn = issue.field_en;
      if (fieldEn === '_total') continue; // 总长度问题由LLM处理

      const current = repaired[fieldEn] || '';

      // 修复1：负面约束缺失基础词
      if (fieldEn === 'negative' && current && issue.issue_type === 'INCOMPLETE' && /no text/i.test(issue.description)) {
        let fixed = current;
        if (!fixed.toLowerCase().includes('no text')) {
          fixed = 'no text, no watermark, ' + fixed;
        }
        if (fixed !== current) {
          repaired[fieldEn] = fixed;
          actions.push(new RepairAction({
            field_en: fieldEn, method: RepairMethod.RULE,
            before: current, after: fixed,
            reason: '规则修复：自动补充 no text, no watermark 基础负面词'
          }));
        }
      }

      // 修复2：定妆照路径规范化
      if (fieldEn === 'portraits' && current && issue.issue_type === 'FORMAT_ERROR') {
        let normalized = current.replace(/^["']|["']$/g, '').trim();
        if (prd && prd.characters && prd.characters.length > 0) {
          const charName = prd.characters[0].name_en || 'character';
          normalized = `/characters/${charName}/portrait_v1.png`;
        }
        if (normalized !== current) {
          repaired[fieldEn] = normalized;
          actions.push(new RepairAction({
            field_en: fieldEn, method: RepairMethod.RULE,
            before: current, after: normalized,
            reason: '规则修复：定妆照路径规范化为标准格式'
          }));
        }
      }

      // 修复3：台词句末标点
      if (fieldEn === 'dialogue' && current && issue.issue_type === 'FORMAT_ERROR' && /句末标点/.test(issue.description)) {
        if (current && !/[。！？…]$/.test(current)) {
          const fixed = current + '。';
          repaired[fieldEn] = fixed;
          actions.push(new RepairAction({
            field_en: fieldEn, method: RepairMethod.RULE,
            before: current, after: fixed,
            reason: "规则修复：自动补充句末标点 '。'（口型闭合信号标记）"
          }));
        }
      }

      // 修复4：台词禁止标点移除
      if (fieldEn === 'dialogue' && current && issue.issue_type === 'FORMAT_ERROR' && /禁止标点/.test(issue.description)) {
        const fixed = current.replace(/[；;：:""''\[\]【】]/g, ',');
        if (fixed !== current) {
          repaired[fieldEn] = fixed;
          actions.push(new RepairAction({
            field_en: fieldEn, method: RepairMethod.RULE,
            before: current, after: fixed,
            reason: '规则修复：移除禁止标点，替换为逗号'
          }));
        }
      }

      // 修复5：P2/P3字段超长规则截断
      if (SPEC_MAP[fieldEn] && issue.issue_type === 'OVER_LENGTH' && 
          (SPEC_MAP[fieldEn].priority === 'P2' || SPEC_MAP[fieldEn].priority === 'P3')) {
        const spec = SPEC_MAP[fieldEn];
        if (current.length > spec.char_max) {
          let truncated = current.slice(0, spec.char_max);
          // 回退到最后一个自然分隔符
          const lastComma = Math.max(
            truncated.lastIndexOf(','),
            truncated.lastIndexOf('，'),
            truncated.lastIndexOf(' ')
          );
          if (lastComma > spec.char_max * 0.7) {
            truncated = truncated.slice(0, lastComma);
          }
          if (truncated !== current) {
            repaired[fieldEn] = truncated;
            actions.push(new RepairAction({
              field_en: fieldEn, method: RepairMethod.RULE,
              before: current, after: truncated,
              reason: `规则修复：${spec.priority} 字段超长，截断至 ${truncated.length} 字符`
            }));
          }
        }
      }
    }

    return { repaired, actions };
  }
}

// ============================================================
// LLMRepairer — LLM智能修复层（PRD注入）
// ============================================================

const LLM_REPAIR_SYSTEM_PROMPT = `你是 AI 视频生成提示词的【内容修复专家】，精通 HyperrealitySystem 字段规范 v3.0。

你的任务是根据检查报告中的问题，对提示词字段进行修复。修复时必须遵守以下原则：

【修复原则】
1. 业务需求优先：修复内容必须符合【用户需求文档PRD】中的业务约束，不得偏离项目定位
2. 规范合规：修复后的字段必须符合字段规范（四要素/五要素/三段式等格式要求）
3. 最小改动：仅修改有问题的部分，不改动已合规的内容
4. 风格一致：修复后的字段须与其它字段保持风格一致
5. 英文优先：画面描述类字段使用英文，约束类字段按规范使用中/英文

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
  constructor(options = {}) {
    this.llm = options.llm;
    this.log = options.log || console.log;
  }

  async repair(shot, report, prd) {
    // 筛选需要LLM修复的问题（排除规则已修复的）
    const llmIssues = report.issues.filter(i => 
      i.severity === 'FATAL' || i.severity === 'MAJOR'
    ).filter(i => i.field_en !== '_total');

    if (llmIssues.length === 0) {
      return { repaired: shot, actions: [] };
    }

    // 构建问题清单
    const issuesText = llmIssues.map(i => 
      `- 字段【${i.field_cn}】(${i.field_en})：${i.description}\n` +
      `  修改建议：${i.suggestion}\n` +
      `  当前值：${i.current_value || shot[i.field_en] || '（缺失）'}`.slice(0, 200)
    ).join('\n\n');

    // PRD约束文本（核心：防止修复偏离业务需求）
    const prdConstraint = prd.toConstraintText();

    // 需修复字段快照 + 字符预算
    const fieldsToRepair = [...new Set(llmIssues.map(i => i.field_en))];
    const currentFields = {};
    const budgetHints = [];
    for (const f of fieldsToRepair) {
      currentFields[f] = shot[f] || '';
      const spec = SPEC_MAP[f];
      if (spec && spec.char_max < 9999) {
        budgetHints.push(` - ${f}：≤ ${spec.char_max} 字符`);
      }
    }

    const userPrompt = `请根据以下信息修复提示词字段：\n\n` +
      `【用户需求文档 PRD 约束】（修复时必须遵守，不得偏离）\n${prdConstraint}\n\n` +
      `【需要修复的字段当前内容】\n${JSON.stringify(currentFields, null, 2)}\n\n` +
      `【字符数预算限制】\n${budgetHints.join('\n') || ' （无特殊限制）'}\n\n` +
      `【检查发现的问题】\n${issuesText}\n\n` +
      `请修复上述问题，确保修复后的字段符合PRD约束、规范格式、风格一致，并严格控制字符数在预算上限以内。`;

    try {
      const response = await this.llm.chat(LLM_REPAIR_SYSTEM_PROMPT, userPrompt, 0.3);
      const data = JSON.parse(response);
      const repairedFields = data.repaired_fields || {};

      const repaired = { ...shot };
      const actions = [];

      for (const [fieldEn, newValue] of Object.entries(repairedFields)) {
        if (!newValue) continue;
        const oldValue = shot[fieldEn] || '';

        // 字符数后处理
        const spec = SPEC_MAP[fieldEn];
        let finalValue = newValue;
        if (spec && spec.char_max < 9999 && finalValue.length > spec.char_max) {
          finalValue = this._smartTruncate(finalValue, spec.char_max);
        }

        if (finalValue !== oldValue) {
          repaired[fieldEn] = finalValue;
          actions.push(new RepairAction({
            field_en: fieldEn,
            method: RepairMethod.LLM,
            before: oldValue,
            after: finalValue,
            reason: 'LLM修复：参考PRD约束修复检查问题'
          }));
        }
      }

      return { repaired, actions };
    } catch (e) {
      this.log('LLM-REPAIRER', `  ⚠️ LLM修复失败: ${e.message}`);
      return { repaired: shot, actions: [] };
    }
  }

  _smartTruncate(text, maxLen) {
    if (text.length <= maxLen) return text;
    let truncated = text.slice(0, maxLen);
    // 回退到最后一个自然分隔符
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
// FieldRepairAgent — 修复环节编排
// ============================================================

class FieldRepairAgent {
  constructor(options = {}) {
    this.ruleRepairer = new RuleRepairer(options);
    this.llmRepairer = options.llm ? new LLMRepairer(options) : null;
    this.prd = options.prd ? new PRD(options.prd) : null;
  }

  async repair(shot, report, shotId = 'shot_001') {
    const log = new RepairLog(shotId, !!this.prd);
    let repaired = { ...shot };

    // 第一层：规则自动修复
    const { repaired: ruleRepaired, actions: ruleActions } = this.ruleRepairer.repair(repaired, report, this.prd);
    repaired = ruleRepaired;
    ruleActions.forEach(a => log.add(a));

    // 第二层：LLM智能修复（注入PRD约束）
    if (this.llmRepairer && this.prd) {
      const remainingReport = this._recheckRemaining(repaired, report);
      if (remainingReport.issues.length > 0) {
        const { repaired: llmRepaired, actions: llmActions } = await this.llmRepairer.repair(repaired, remainingReport, this.prd);
        repaired = llmRepaired;
        llmActions.forEach(a => log.add(a));
      }
    }

    return { repaired, log };
  }

  _recheckRemaining(shot, originalReport) {
    const { CheckReport, Issue } = require('../field-check/field-check-agent');
    const remaining = new CheckReport(originalReport.shot_id);

    // 规则可修复的字段+问题类型组合
    const ruleFixable = new Set([
      'negative:INCOMPLETE',
      'portraits:FORMAT_ERROR',
      'dialogue:FORMAT_ERROR',
    ]);

    for (const issue of originalReport.issues) {
      const key = `${issue.field_en}:${issue.issue_type}`;
      
      // 跳过规则已修复的字段问题
      if (ruleFixable.has(key)) {
        const current = shot[issue.field_en] || '';
        if (issue.field_en === 'negative' && /no text/i.test(current.toLowerCase())) continue;
        if (issue.field_en === 'portraits' && /\/characters\/[\w_]+\/portrait_v\d+\.(png|jpg)/i.test(current)) continue;
        if (issue.field_en === 'dialogue' && /句末标点/.test(issue.description)) {
          if (current && /[。！？…]$/.test(current)) continue;
        }
      }
      
      // 跳过P2/P3超长问题（规则已截断）
      if (issue.issue_type === 'OVER_LENGTH' && SPEC_MAP[issue.field_en]) {
        const spec = SPEC_MAP[issue.field_en];
        if ((spec.priority === 'P2' || spec.priority === 'P3') && 
            (shot[issue.field_en] || '').length <= spec.char_max) {
          continue;
        }
      }

      remaining.add(issue);
    }

    remaining.passed = remaining.fatal_count === 0 && remaining.major_count === 0;
    return remaining;
  }
}

module.exports = { 
  FieldRepairAgent, RuleRepairer, LLMRepairer, 
  RepairAction, RepairLog, PRD 
};
