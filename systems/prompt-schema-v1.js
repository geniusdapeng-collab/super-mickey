/**
 * Prompt Schema v1
 * 定义最终标准字段
 */

const PROMPT_FIELDS = [
  'CHARACTER',
  'ACTION',
  'SCENE',
  'MOOD',
  'CAMERA',
  'LIGHTING',
  'NEGATIVE',
  'AUDIO',
  'RENDER',
  'DIRECTOR'
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
  DIRECTOR: ''
};

module.exports = {
  PROMPT_FIELDS,
  FIELD_DEFAULTS
};
