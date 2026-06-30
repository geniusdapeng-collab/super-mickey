/**
 * Field Specs v6.7.0 — 25字段规格定义
 * 源自规范文档第2章速查表 + 第12章预算表
 */

const Priority = {
  P0: 'P0', // 致命级
  P1: 'P1', // 核心级
  P2: 'P2', // 增强级
  P3: 'P3'  // 可选级
};

const Severity = {
  FATAL: 'FATAL',
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  INFO: 'INFO'
};

const IssueType = {
  MISSING: 'MISSING',
  FORMAT_ERROR: 'FORMAT_ERROR',
  INCOMPLETE: 'INCOMPLETE',
  OVER_LENGTH: 'OVER_LENGTH',
  INCONSISTENT: 'INCONSISTENT',
  UNPROFESSIONAL: 'UNPROFESSIONAL',
  CONFLICT: 'CONFLICT'
};

const RepairMethod = {
  RULE: 'RULE',
  LLM: 'LLM'
};

class FieldSpec {
  constructor(name_cn, name_en, priority, char_min, char_max, required = true) {
    this.name_cn = name_cn;
    this.name_en = name_en;
    this.priority = priority;
    this.char_min = char_min;
    this.char_max = char_max;
    this.required = required;
  }
}

const FIELD_SPECS = [
  // P0 致命级（12个，必填）
  new FieldSpec('导演指令', 'director_instruction', Priority.P0, 50, 80),
  new FieldSpec('约束', 'constraint', Priority.P0, 100, 150),
  new FieldSpec('基础', 'baseline', Priority.P0, 80, 100),
  new FieldSpec('场景', 'scene', Priority.P0, 150, 200),
  new FieldSpec('灯光', 'lighting', Priority.P0, 100, 150),
  new FieldSpec('运镜', 'camera_movement', Priority.P0, 80, 120),
  new FieldSpec('角色', 'character', Priority.P0, 50, 80),
  new FieldSpec('动作', 'action', Priority.P0, 100, 150),
  new FieldSpec('台词', 'dialogue', Priority.P0, 0, 9999),
  new FieldSpec('负面约束', 'negative', Priority.P0, 200, 300),
  new FieldSpec('定妆照', 'portraits', Priority.P0, 0, 9999),
  new FieldSpec('角色一致性', 'consistency', Priority.P0, 50, 80),
  // P1 核心级（7个，必填）
  new FieldSpec('构图', 'composition', Priority.P1, 80, 120),
  new FieldSpec('色彩', 'color_palette', Priority.P1, 80, 120),
  new FieldSpec('景深', 'depth_of_field', Priority.P1, 60, 100),
  new FieldSpec('时间轴', 'timeline', Priority.P1, 150, 200),
  new FieldSpec('情绪', 'mood', Priority.P1, 30, 50),
  new FieldSpec('明亮约束', 'bright_constraint', Priority.P1, 50, 80),
  new FieldSpec('角色约束', 'character_constraint', Priority.P1, 50, 80),
  // P2 增强级（4个，可选）
  new FieldSpec('服装', 'costume', Priority.P2, 60, 100, false),
  new FieldSpec('道具', 'props', Priority.P2, 40, 80, false),
  new FieldSpec('节奏', 'pacing', Priority.P2, 60, 100, false),
  new FieldSpec('音频', 'audio', Priority.P2, 60, 100, false),
  // P3 可选级（2个，可选）
  new FieldSpec('化妆', 'makeup', Priority.P3, 40, 60, false),
  new FieldSpec('转场', 'transition', Priority.P3, 30, 50, false),
];

const SPEC_MAP = {};
for (const spec of FIELD_SPECS) {
  SPEC_MAP[spec.name_en] = spec;
}

const MAX_TOTAL_CHARS = 3000;

module.exports = {
  Priority, Severity, IssueType, RepairMethod,
  FieldSpec, FIELD_SPECS, SPEC_MAP, MAX_TOTAL_CHARS
};
