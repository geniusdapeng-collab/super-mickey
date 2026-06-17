/**
 * Prompt Schema v1.1 — 标准字段定义（上游统一，下游零映射）
 * 
 * 核心规则：
 * - 上游生成层直接使用以下标准字段名，禁止自定义别名
 * - 下游只做格式转换（如【视觉】→ CHARACTER:），不做字段内容映射
 * - 新增 CHARACTER_CARD 字段用于人物介绍卡片
 */

const PROMPT_FIELDS = [
  'CHARACTER',      // 【视觉】角色/主体描述
  'ACTION',         // 【动态】动作描述
  'SCENE',          // 【空间】场景/环境
  'MOOD',           // 【风格】情绪/氛围
  'CAMERA',         // 【镜头时间轴】运镜/时间轴
  'LIGHTING',       // 【照明】光影/照明
  'NEGATIVE',       // 【负面约束】排除项
  'AUDIO',          // 【环境音效】音频/音效
  'RENDER',         // 【渲染】技术规格
  'DIRECTOR',       // 【导演】导演风格
  'DIALOGUE',       // 【台词】对话/旁白
  'CHARACTER_CARD'  // 【人物介绍卡片】人物信息卡片
];

const FIELD_DEFAULTS = {
  CHARACTER: '',
  ACTION: '',
  SCENE: '',
  MOOD: '',
  CAMERA: '',
  LIGHTING: '',
  NEGATIVE: '',
  AUDIO: '',
  RENDER: '电影级、超写实',
  DIRECTOR: '',
  DIALOGUE: '',
  CHARACTER_CARD: ''
};

// 标准字段 ↔ 中文标记映射（仅用于最终输出格式化，不做内容映射）
const FIELD_LABELS = {
  CHARACTER: '视觉',
  ACTION: '动态',
  SCENE: '空间',
  MOOD: '风格',
  CAMERA: '镜头时间轴',
  LIGHTING: '照明',
  NEGATIVE: '负面约束',
  AUDIO: '环境音效',
  RENDER: '渲染',
  DIRECTOR: '导演',
  DIALOGUE: '台词',
  CHARACTER_CARD: '人物介绍卡片'
};

module.exports = {
  PROMPT_FIELDS,
  FIELD_DEFAULTS,
  FIELD_LABELS
};
