/**
 * Silence Architect v9.2.0-Peng — 沉默建筑师
 * 在关键位置精确设计沉默
 */
class SilenceArchitect {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async design({ sceneId, dialogueFinal, sceneEmotionCurve, keyLines }) {
    console.log(`  🤫 [SilenceArchitect] 设计场景 ${sceneId} 的沉默...`);

    const final = dialogueFinal || await this.stateBus.getDialogue(sceneId)?.final;
    if (!final || !final.dialogueSegments) {
      console.log(`    ⚠️ 无对白可设计沉默`);
      return null;
    }

    const segments = final.dialogueSegments;
    const silenceDesign = [];

    // 为每个关键台词后设计沉默
    const targetLines = keyLines || this.identifyKeyLines(segments);

    for (const lineId of targetLines) {
      const segment = segments.find(s => s.segmentId === lineId);
      if (!segment) continue;

      const silence = this.calculateSilence(segment, sceneEmotionCurve);
      if (silence) {
        silenceDesign.push(silence);
      }
    }

    // 为失控时刻后强制设计沉默
    const controlMoments = segments.filter(s => s.isControlMoment);
    for (const moment of controlMoments) {
      const existing = silenceDesign.find(s => s.position === `${moment.segmentId}之后`);
      if (!existing) {
        silenceDesign.push({
          position: `${moment.segmentId}之后`,
          type: 'weight',
          duration: this.calculateDuration('weight', 90, '失控时刻'),
          visualDirection: '面部特写——观众和角色一起窒息',
          audioDirection: '完全静音——只有心跳声',
          audienceEffect: '重量感——那个问题在空中回荡',
          seedanceCue: `，${moment.speaker}面部特写，张嘴无声，完全静音`
        });
      }
    }

    // 合并沉默到对白
    const completeDialogue = this.mergeSilence(segments, silenceDesign);

    const result = {
      sceneId,
      silenceDesign,
      completeDialogue
    };

    await this.stateBus.updateSilences(sceneId, silenceDesign);
    await this.stateBus.updateDialogue(sceneId, 'complete', completeDialogue);
    console.log(`    ✅ 沉默设计完成: ${silenceDesign.length} 处沉默`);
    return result;
  }

  identifyKeyLines(segments) {
    const keyLines = [];
    for (const seg of segments) {
      // 短句+高情感 = 关键
      if (seg.text.length < 10) {
        const highEmotion = ['愤怒', '绝望', '崩溃', '放弃', '痛苦', '决绝'];
        if (highEmotion.some(e => seg.emotion?.includes(e))) {
          keyLines.push(seg.segmentId);
        }
      }
      // 失控时刻
      if (seg.isControlMoment) {
        keyLines.push(seg.segmentId);
      }
    }
    return keyLines;
  }

  calculateSilence(segment, emotionCurve) {
    const text = segment.text || '';
    const emotion = segment.emotion || '';
    const isControl = segment.isControlMoment;

    let type = 'weight';
    let lineWeight = '普通台词';

    if (isControl) {
      type = 'choke';
      lineWeight = '失控时刻';
    } else if (emotion.includes('放弃') || emotion.includes('告别')) {
      type = 'farewell';
      lineWeight = '生死告别';
    } else if (emotion.includes('愤怒') && text.length < 5) {
      type = 'choke';
      lineWeight = '关键转折';
    } else if (emotion.includes('决绝')) {
      type = 'standoff';
      lineWeight = '关键转折';
    }

    const intensity = this.getIntensityFromCurve(segment.segmentId, emotionCurve) || 80;
    const duration = this.calculateDuration(type, intensity, lineWeight);

    const visualMap = {
      'choke': `${segment.speaker}的面部特写——想说点什么，但嘴动了动，没发出声音`,
      'standoff': '两个人对视——谁先开口谁输',
      'weight': `${segment.speaker}的背影。然后慢慢转过身来。`,
      'farewell': '远景——一个人站在荒野中。镜头缓慢拉远。'
    };

    const audioMap = {
      'choke': '完全静音——连背景音乐都停止。只有风的声音。',
      'standoff': '只有呼吸声——两个人的呼吸节奏不同。',
      'weight': '低沉的音乐缓缓进入——空旷的、回声般的。',
      'farewell': '音乐渐强——距离感。像这个人离你越来越远。'
    };

    const effectMap = {
      'choke': '窒息感——观众和角色一样说不出话。',
      'standoff': '紧张感——谁先开口谁输。',
      'weight': '重量感——那个问题在空中回荡，没有答案就是最好的答案。',
      'farewell': '孤独感——观众意识到：这可能是最后一次见面了。'
    };

    return {
      position: `${segment.segmentId}之后`,
      type,
      duration,
      visualDirection: visualMap[type],
      audioDirection: audioMap[type],
      audienceEffect: effectMap[type],
      seedanceCue: `，${segment.speaker}面部特写，张嘴无声，完全静音仅余风声`
    };
  }

  calculateDuration(type, intensity, lineWeight) {
    const base = {
      'choke': 3,
      'standoff': 4,
      'weight': 5,
      'farewell': 6
    };

    let emotionBonus = 0;
    if (intensity >= 70 && intensity < 80) emotionBonus = 0;
    else if (intensity >= 80 && intensity < 90) emotionBonus = 1;
    else if (intensity >= 90) emotionBonus = 2;

    let weightBonus = 0;
    if (lineWeight === '普通台词') weightBonus = 0;
    else if (lineWeight === '关键转折') weightBonus = 1;
    else if (lineWeight === '失控时刻') weightBonus = 2;
    else if (lineWeight === '生死告别') weightBonus = 3;

    return Math.min(12, base[type] + emotionBonus + weightBonus);
  }

  getIntensityFromCurve(segmentId, curve) {
    if (!curve || !Array.isArray(curve)) return 80;
    const idx = parseInt(segmentId.replace(/\D/g, '')) || 1;
    const entry = curve[Math.min(idx - 1, curve.length - 1)];
    return entry?.intensity || 80;
  }

  mergeSilence(segments, silenceDesign) {
    const merged = [];
    
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      merged.push(seg);

      // 检查是否在该段后有沉默
      const silence = silenceDesign.find(s => s.position === `${seg.segmentId}之后`);
      if (silence) {
        merged.push({
          segmentId: `${seg.segmentId}-SILENCE`,
          type: 'silence',
          text: `（${silence.duration}秒沉默——${silence.type}）`,
          emotion: '沉默',
          duration: silence.duration,
          visualDirection: silence.visualDirection,
          audioDirection: silence.audioDirection,
          seedanceCue: silence.seedanceCue
        });
      }
    }

    return {
      dialogueSegments: merged,
      silenceCount: silenceDesign.length,
      totalSilenceDuration: silenceDesign.reduce((sum, s) => sum + s.duration, 0)
    };
  }
}

module.exports = SilenceArchitect;