/**
 * LoseControl Trigger v9.2.0-Peng — 失控触发器
 * 检测并制造角色的"失控时刻"
 */
class LoseControlTrigger {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async trigger({ sceneId, dialogueDraft, characterWounds, sceneIntensity }) {
    console.log(`  💥 [LoseControlTrigger] 检测场景 ${sceneId} 的失控时刻...`);

    const draft = dialogueDraft || await this.stateBus.getDialogue(sceneId)?.draft;
    if (!draft || !draft.dialogueSegments) {
      console.log(`    ⚠️ 无对白草稿可检测`);
      return null;
    }

    const wounds = characterWounds || {};
    const intensity = sceneIntensity || 0.5;
    const controlMoments = [];
    const modifiedSegments = [];

    // 检测每个对话段
    for (let i = 0; i < draft.dialogueSegments.length; i++) {
      const segment = draft.dialogueSegments[i];
      const speaker = segment.speaker;
      const wound = wounds[speaker];

      // 判断是否是失控候选点
      const isCandidate = this.isControlLossCandidate(segment, wound, intensity);

      if (isCandidate) {
        const controlType = this.selectControlType(segment, wound);
        const modified = this.generateControlLoss(segment, controlType, wound);
        
        controlMoments.push({
          segmentId: segment.segmentId,
          original: segment.text,
          modified: modified.text,
          controlType,
          why: modified.why
        });

        modifiedSegments.push({
          ...segment,
          text: modified.text,
          emotion: modified.emotion || segment.emotion,
          deliveryNote: modified.deliveryNote || segment.deliveryNote,
          controlType,
          isControlMoment: true
        });
      } else {
        modifiedSegments.push(segment);
      }
    }

    // 如果没有检测到失控时刻但场景强度高，人为制造一个
    if (controlMoments.length === 0 && intensity > 0.85 && modifiedSegments.length > 0) {
      const lastIdx = modifiedSegments.length - 1;
      const lastSeg = modifiedSegments[lastIdx];
      const speaker = lastSeg.speaker;
      const wound = wounds[speaker];

      const controlType = 'truth-slip';
      const modified = this.generateControlLoss(lastSeg, controlType, wound);

      controlMoments.push({
        segmentId: lastSeg.segmentId,
        original: lastSeg.text,
        modified: modified.text,
        controlType,
        why: modified.why
      });

      modifiedSegments[lastIdx] = {
        ...lastSeg,
        text: modified.text,
        emotion: modified.emotion || lastSeg.emotion,
        deliveryNote: modified.deliveryNote || lastSeg.deliveryNote,
        controlType,
        isControlMoment: true
      };
    }

    const result = {
      sceneId,
      controlMoments,
      finalDialogue: {
        ...draft,
        dialogueSegments: modifiedSegments,
        controlMomentCount: controlMoments.length
      }
    };

    await this.stateBus.updateDialogue(sceneId, 'final', result.finalDialogue);
    console.log(`    ✅ 失控检测完成: ${controlMoments.length} 个失控时刻`);
    return result;
  }

  isControlLossCandidate(segment, wound, sceneIntensity) {
    // 情绪过载检测
    const highEmotion = ['愤怒', '绝望', '崩溃', '放弃', '痛苦'];
    const hasHighEmotion = highEmotion.some(e => segment.emotion?.includes(e));

    // 伤口触发检测
    const triggers = wound?.triggers || [];
    const text = segment.text || '';
    const triggerHit = triggers.some(t => text.includes(t));

    // 场景强度
    const highIntensity = sceneIntensity > 0.8;

    // 关键台词（短句+高情感）
    const isKeyLine = text.length < 10 && hasHighEmotion;

    return (hasHighEmotion && highIntensity) || triggerHit || isKeyLine;
  }

  selectControlType(segment, wound) {
    const types = ['explosion', 'collapse', 'truth-slip', 'role-reversal'];
    const emotion = segment.emotion || '';
    const text = segment.text || '';

    if (emotion.includes('愤怒') && text.length < 5) return 'explosion';
    if (emotion.includes('放弃') || emotion.includes('崩溃')) return 'collapse';
    if (emotion.includes('告别') || emotion.includes('真诚')) return 'truth-slip';
    if (emotion.includes('决绝') || emotion.includes('反转')) return 'role-reversal';

    return types[Math.floor(Math.random() * types.length)];
  }

  generateControlLoss(segment, controlType, wound) {
    const originalText = segment.text || '';
    const emotion = segment.emotion || '';

    let modified = originalText;
    let newEmotion = emotion;
    let deliveryNote = '';
    let why = '';

    switch (controlType) {
      case 'explosion':
        modified = originalText + '（突然爆发）不！不！不！';
        newEmotion = '压抑到极限后的喷发';
        deliveryNote = '从沉默到爆发的瞬间转变';
        why = '情绪压抑到极限后的失控喷发';
        break;

      case 'collapse':
        modified = originalText.replace(/[。！]/, '...（声音颤抖）') + '...';
        newEmotion = '坚强外壳突然碎裂';
        deliveryNote = '声音从坚定突然转为颤抖';
        why = '内心防线突然崩溃';
        break;

      case 'truth-slip':
        const truthLines = [
          '......其实，我一直在骗自己。',
          '......我不知道该怎么办了。',
          '......我真的很害怕。',
          '......那个紧箍...戴上的时候，疼吗？'
        ];
        modified = truthLines[Math.floor(Math.random() * truthLines.length)];
        newEmotion = '用一个问题代替告别——最脆弱的时刻';
        deliveryNote = '声音从远处传来，不像是问别人，像是问自己';
        why = '压抑已久的真实情感突然流露——这是角色唯一一次暴露脆弱';
        break;

      case 'role-reversal':
        modified = originalText + '（突然跪下）我求你...';
        newEmotion = '做了平时绝不会做的事';
        deliveryNote = '动作和语言完全不符合角色常态';
        why = '角色在极端压力下做出反常行为';
        break;
    }

    return {
      text: modified,
      emotion: newEmotion,
      deliveryNote,
      why
    };
  }
}

module.exports = LoseControlTrigger;