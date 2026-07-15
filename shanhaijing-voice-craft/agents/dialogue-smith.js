/**
 * Dialogue Smith v9.2.0-Peng — 对白铁匠
 * 基于声纹指纹和潜台词地图锻造实际对白
 */
class DialogueSmith {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async forge({ sceneId, voiceSignatures, subtextMap, sceneRequirements }) {
    console.log(`  🔨 [DialogueSmith] 锻造场景 ${sceneId} 的对白...`);

    const signatures = voiceSignatures || {};
    const subtext = subtextMap || await this.stateBus.getSubtext(sceneId) || {};
    const requirements = sceneRequirements || {};

    const dialogueSegments = [];
    let segmentIndex = 1;

    // 遍历潜台词映射，为每行锻造对白
    const lineIds = Object.keys(subtext);
    
    for (const lineId of lineIds) {
      const lineData = subtext[lineId];
      const speaker = lineData.speaker;
      const signature = signatures[speaker];
      
      const segment = this.forgeLine(speaker, lineData, signature, segmentIndex);
      dialogueSegments.push(segment);
      segmentIndex++;
    }

    // 如果没有潜台词映射（直接锻造模式）
    if (dialogueSegments.length === 0 && requirements.dialogueCount) {
      for (let i = 0; i < requirements.dialogueCount; i++) {
        const speaker = Object.keys(signatures)[i % Object.keys(signatures).length];
        const signature = signatures[speaker];
        
        dialogueSegments.push({
          segmentId: `D${String(segmentIndex).padStart(2, '0')}`,
          speaker,
          text: this.generateDefaultLine(signature),
          emotion: '中性',
          deliveryNote: '正常语速',
          actionNote: '',
          subtext: '',
          duration: 3,
          seedanceCue: ''
        });
        segmentIndex++;
      }
    }

    const draft = {
      sceneId,
      dialogueSegments,
      totalSegments: dialogueSegments.length,
      estimatedDuration: dialogueSegments.reduce((sum, s) => sum + (s.duration || 3), 0)
    };

    await this.stateBus.updateDialogue(sceneId, 'draft', draft);
    console.log(`    ✅ 对白锻造完成: ${dialogueSegments.length} 段对白`);
    return draft;
  }

  forgeLine(speaker, lineData, signature, index) {
    const surface = lineData.surface || '';
    const underwater = lineData.underwater || '';
    const subtextType = lineData.subtextType || '';
    
    const sig = signature?.signature || {};
    const vocab = sig.vocabularyFingerprint || {};
    const syntax = sig.syntaxFingerprint || {};
    const emotionMap = sig.emotionLanguageMap || {};

    // 基于声纹调整台词
    let text = surface;
    let emotion = '中性';
    let deliveryNote = '正常语速';
    let duration = 4;

    // 根据潜台词类型选择情绪
    const emotionMap2 = {
      'self-protection': '恐惧伪装成的坚定',
      'pleading-under-anger': '愤怒包装下的乞求',
      'false-certainty': '关闭心门的决绝',
      'shutdown': '放弃',
      'reverse-plea': '用最狠的话掩盖最痛的心',
      'goodbye-disguised-as-anger': '告别伪装成平淡',
      'soliloquy': '内心独白'
    };
    emotion = emotionMap2[subtextType] || '中性';

    // 基于声纹调整文本
    const selfRef = vocab.selfReference || '我';
    const signatureWords = vocab.signatureWords || [];
    const tabooWords = vocab.tabooWords || [];

    // 替换自称
    if (selfRef !== '我' && !text.includes(selfRef)) {
      text = text.replace(/我/g, selfRef);
    }

    // 添加签名词（如果合适）
    if (signatureWords.length > 0 && Math.random() > 0.5) {
      const word = signatureWords[Math.floor(Math.random() * signatureWords.length)];
      if (!text.includes(word)) {
        text = text.replace(/[。！？]$/, `，${word}$&`);
      }
    }

    // 基于句式调整
    const avgLen = syntax.avgSentenceLength || 10;
    const textLen = text.length;
    
    if (textLen > avgLen * 2) {
      deliveryNote = '语速偏快——暴露内心焦虑';
    } else if (textLen < avgLen / 2) {
      deliveryNote = '极简表达——一字千钧';
      duration = 2;
    }

    // 失控时刻检测
    if (subtextType === 'shutdown' || subtextType === 'reverse-plea') {
      duration = 5;
      deliveryNote = '停顿后低沉说出——每个字都在流血';
    }

    // seedanceCue生成
    const seedanceCue = this.generateSeedanceCue(emotion, deliveryNote, speaker);

    return {
      segmentId: `D${String(index).padStart(2, '0')}`,
      speaker,
      text,
      emotion,
      deliveryNote,
      actionNote: this.generateActionNote(subtextType, text),
      subtext: underwater,
      duration,
      seedanceCue
    };
  }

  generateDefaultLine(signature) {
    const vocab = signature?.signature?.vocabularyFingerprint || {};
    const words = vocab.signatureWords || ['嗯', '好', '知道了'];
    return words[Math.floor(Math.random() * words.length)] + '。';
  }

  generateActionNote(subtextType, text) {
    const notes = {
      'self-protection': '双手握拳——在说服自己',
      'pleading-under-anger': '指向对方的手指发抖',
      'false-certainty': '闭上眼睛——不敢看对方表情',
      'shutdown': '嘴角动了一下——控制面部肌肉不要崩溃',
      'reverse-plea': '背过身去——不敢看对方离开',
      'soliloquy': '低头沉思'
    };
    return notes[subtextType] || '';
  }

  generateSeedanceCue(emotion, delivery, speaker) {
    const emotionMap = {
      '恐惧伪装成的坚定': '语气坚定但眼神闪躲',
      '愤怒包装下的乞求': '前半句怒吼后半句突然带哀求',
      '关闭心门的决绝': '快速说完后停顿',
      '放弃': '低沉一字，面部表情极度克制',
      '用最狠的话掩盖最痛的心': '前半句快后半句慢',
      '告别伪装成平淡': '低沉缓慢，三字之间有空隙',
      '中性': '正常语气'
    };
    const cue = emotionMap[emotion] || '正常语气';
    return `，${speaker}正在说话，${cue}`;
  }
}

module.exports = DialogueSmith;