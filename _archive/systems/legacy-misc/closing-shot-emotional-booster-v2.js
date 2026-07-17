/**
 * 结尾镜情绪增强器 v2
 * 字段级增强，不直接污染整段prompt
 */

class ClosingShotEmotionalBoosterV2 {
  constructor(config = {}) {
    this.config = {
      closingTypes: ['closing', 'resolution', 'ending', 'finale', 'climax', 'resolve'],
      ...config
    };

    this.emotionPool = {
      gentle: ['温柔', '柔和', '轻盈', '释然'],
      warmth: ['温暖', '治愈', '安定', '陪伴感'],
      transcendence: ['升华', '新生', '余韵', '静默震撼']
    };

    this.lightingPool = [
      '暖金色余晖缓缓铺开，边缘轮廓被柔和逆光勾勒',
      '光线从紧张高反差过渡为柔和包裹式暖光',
      '环境中残留温暖光晕，阴影被细腻填平'
    ];

    this.scenePool = [
      '环境呼应前文，但细节已悄然改变，形成完成后的余韵',
      '空间恢复平静，空气中保留事件余波与情感回声',
      '背景景物不再压迫，整体气氛转向释然与开放'
    ];

    this.directorPool = [
      '结尾不要急着收，给观众1秒情绪停留',
      '镜头以余韵收束，而不是硬性结束',
      '重点不是信息，而是情绪残留'
    ];
  }

  boost(fields = {}, shot = {}) {
    const type = (shot.type || shot.shotType || '').toLowerCase();
    const isClosing = this.config.closingTypes.some(t => type.includes(t)) ||
      !!shot.isEnding ||
      !!shot.isClosing;

    if (!isClosing) {
      return {
        fields,
        enhanced: false,
        reason: 'not-closing-shot'
      };
    }

    const next = { ...fields };

    // 1. MOOD 增强
    next.MOOD = this._mergeText(
      next.MOOD,
      `${this._pick(this.emotionPool.gentle)}、${this._pick(this.emotionPool.warmth)}、${this._pick(this.emotionPool.transcendence)}`
    );

    // 2. LIGHTING 增强
    next.LIGHTING = this._mergeText(
      next.LIGHTING,
      this._pick(this.lightingPool)
    );

    // 3. SCENE 增强
    next.SCENE = this._mergeText(
      next.SCENE,
      this._pick(this.scenePool)
    );

    // 4. ACTION 轻度增强（避免过度）
    if (next.ACTION) {
      next.ACTION = this._mergeText(
        next.ACTION,
        '动作逐渐放缓，情绪在画面中停留片刻'
      );
    }

    // 5. DIRECTOR 增强
    next.DIRECTOR = this._mergeText(
      next.DIRECTOR,
      this._pick(this.directorPool)
    );

    return {
      fields: next,
      enhanced: true,
      reason: 'closing-shot-boosted'
    };
  }

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _mergeText(a, b) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left) return right;
    if (!right) return left;
    if (left.includes(right)) return left;
    return `${left}；${right}`;
  }
}

module.exports = { ClosingShotEmotionalBoosterV2 };
