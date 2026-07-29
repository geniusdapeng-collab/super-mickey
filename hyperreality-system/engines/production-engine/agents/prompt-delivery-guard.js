'use strict';

/**
 * PromptDeliveryGuard（交付守卫）
 * ------------------------------------------------------------
 * 【v2.4.5 新增】三段式混合生产的阶段4：语义精炼后的硬性规则闸机。
 *
 * 职责：对任何将要交付的镜头提示词做纯规则终验。
 * LLM 环节（语义精炼）的输出必须过此闸机；任一校验不过，
 * 调用方必须回退到语义精炼之前的机器精炼结果——LLM 犯错的代价归零。
 *
 * 校验项（全部确定性，规则驱动，永不交给 LLM）：
 *   1. 字段完整性：内容镜头必备 25 字段，片头镜头另备 5 专属字段（共 30）
 *   2. 长度口径：REFINED_MIN ≤ 字符数 ≤ HARD_MAX（两阶段口径②，唯一真源 prompt-length.js）
 *   3. 台词纪律：有台词镜头【台词】字段在场且格式规范（时间戳+角色+情绪副词+说:"…"）；
 *      无台词镜头禁止出现【台词】（空镜禁虚构）
 *   4. 台词速率：分段时间戳内字数 ≤ LIMIT(4.5 字/秒)，总时长占比 ≤ MAX_DIALOGUE_RATIO(0.8)
 *   5. 必备锚点：【时间轴】【情绪】【负面约束】【角色一致性】在场
 *   6. 情绪可见性：【情绪】须含可见部位微动作描述（面部/眼/手/呼吸等），
 *      防止"紧张、温情"式关键词写法通过语义层漏网
 *
 * 不做的事：不评判文采、不压缩、不改写——只判定 pass/fail 并给出 issues。
 */

const PromptLengthConfig = require('../../../config/prompt-length.js');
const SpeechRate = require('../../../config/speech-rate.js');

const REQUIRED_CONTENT = [
  '语言约束', '导演意图', '基础', '约束', '场景', '灯光设计', '明亮约束', '构图',
  '色彩/色调', '景深', '运镜', '角色', '服装', '化妆', '动作', '道具', '定妆照',
  '时间轴', '情绪', '节奏', '转场', '音频', '负面约束', '角色约束', '角色一致性'
];
const REQUIRED_OPENING_EXTRA = ['主标题内容', '副标题内容', '标题动画设计', '标题字体设计', '开场音频设计'];
// 情绪字段可见部位判定（含"仅手部入画"类镜头的合法形态）
const EMOTION_VISIBLE_PATTERN = /眼|眉|嘴角|面部|瞳孔|眼睑|视线|喉结|鼻翼|指尖|拇指|手|肌肉|呼吸|心跳|步频|肩|背|颈/;

class PromptDeliveryGuard {
  /**
   * @param {string} promptText 待交付提示词（' | ' 分隔或换行分隔均可，不含序号前缀）
   * @param {object} shot 镜头数据（shotId/sceneType/duration/dialogueBlocks/dialogues/character）
   * @returns {{pass:boolean, issues:string[], fieldCount:number, charCount:number}}
   */
  verify(promptText, shot = {}) {
    const issues = [];
    const text = String(promptText || '');
    const names = this._fieldNames(text);
    const isOpening = shot.sceneType === 'opening' || shot.shotId === 'SC00' || shot.shotId === 'S00';

    // 1. 字段完整性
    for (const f of REQUIRED_CONTENT) {
      if (!names.includes(f)) issues.push(`缺必备字段:${f}`);
    }
    if (isOpening) {
      for (const f of REQUIRED_OPENING_EXTRA) {
        if (!names.includes(f)) issues.push(`缺片头专属字段:${f}`);
      }
    }
    const expectedMin = isOpening ? 30 : 25;

    // 2. 长度口径
    const charCount = this._countChars(text);
    if (charCount > PromptLengthConfig.HARD_MAX) {
      issues.push(`长度超硬上限:${charCount}>${PromptLengthConfig.HARD_MAX}`);
    }
    if (charCount < PromptLengthConfig.REFINED_MIN) {
      issues.push(`长度低于精炼后下限:${charCount}<${PromptLengthConfig.REFINED_MIN}`);
    }

    // 3. 台词纪律
    const hasDialogueField = names.includes('台词');
    const expectsDialogue = this._shotExpectsDialogue(shot);
    if (expectsDialogue && !hasDialogueField) issues.push('数据层有台词但【台词】字段缺失');
    if (!expectsDialogue && hasDialogueField && !this._isEmptyShot(shot)) {
      // 数据层无台词但出现台词字段：LLM 可能虚构，记 issue（空镜走空镜分支）
      issues.push('数据层无台词但出现【台词】字段（疑似虚构）');
    }
    if (this._isEmptyShot(shot) && hasDialogueField) {
      const dlgBody = this._fieldBody(text, '台词');
      if (/说[:：]/.test(dlgBody)) issues.push('空镜出现实际台词内容（空镜禁虚构）');
    }

    // 4. 台词格式与速率
    if (hasDialogueField) {
      const dlgBody = this._fieldBody(text, '台词');
      const blocks = dlgBody.split(/\n/).map(l => l.trim()).filter(Boolean);
      let totalDialogueChars = 0;
      for (const block of blocks) {
        const m = block.match(/^\[(\d+)s-(\d+)s\]\s*(.+?)\s*[,，]\s*(.+?)\s*说[:：]\s*\\?["“](.+)\\?["”]\s*$/);
        if (!m) {
          issues.push(`台词格式不规范:${block.slice(0, 24)}`);
          continue;
        }
        const segSec = Math.max(1, parseInt(m[2], 10) - parseInt(m[1], 10));
        const chars = m[5].replace(/[，。！？…—、；：""]/g, '').length;
        totalDialogueChars += chars;
        if (chars / segSec > SpeechRate.LIMIT) {
          issues.push(`台词超速:${chars}字/${segSec}s=${(chars / segSec).toFixed(1)}字/秒>${SpeechRate.LIMIT}`);
        }
      }
      const duration = Number(shot.duration) || 0;
      if (duration > 0 && totalDialogueChars / SpeechRate.NORMAL > duration * SpeechRate.MAX_DIALOGUE_RATIO) {
        issues.push(`台词总占比超标:约${(totalDialogueChars / SpeechRate.NORMAL).toFixed(1)}s/${duration}s>${SpeechRate.MAX_DIALOGUE_RATIO * 100}%`);
      }
    }

    // 5. 必备锚点
    for (const f of ['时间轴', '情绪', '负面约束', '角色一致性']) {
      if (!names.includes(f)) issues.push(`缺锚点字段:${f}`);
    }

    // 6. 情绪可见部位
    if (names.includes('情绪')) {
      const mood = this._fieldBody(text, '情绪');
      if (!EMOTION_VISIBLE_PATTERN.test(mood)) {
        issues.push('【情绪】缺可见部位微动作描述（疑似关键词式写法）');
      }
    }

    return {
      pass: issues.length === 0,
      issues,
      fieldCount: names.length,
      expectedMin,
      charCount
    };
  }

  _fieldNames(text) {
    const out = [];
    const re = /【([^【】]{1,12})】/g;
    let m;
    while ((m = re.exec(text)) !== null) out.push(m[1]);
    return out;
  }

  _fieldBody(text, name) {
    const re = new RegExp('【' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '】([^【]*)');
    const m = text.match(re);
    if (!m) return '';
    // 剥掉字段分隔符尾巴（' | ' 分隔格式下，捕获段会带上一个分隔符残留）
    return m[1].replace(/[\s|]+$/, '');
  }

  _countChars(text) {
    return String(text || '').length;
  }

  _shotExpectsDialogue(shot) {
    const blocks = shot.dialogueBlocks || shot.dialogues || shot.dialogue || [];
    if (Array.isArray(blocks)) return blocks.length > 0;
    return !!blocks;
  }

  _isEmptyShot(shot) {
    const c = shot.character;
    // 未提供角色信息不视为空镜（空镜判定以数据层显式标记为准，宁缺勿滥）
    if (c === undefined || c === null) return false;
    if (typeof c === 'string') return c === 'NONE' || c.trim() === '';
    if (typeof c === 'object' && (c.name === 'NONE' || c.empty === true)) return true;
    return false;
  }
}

module.exports = { PromptDeliveryGuard };
