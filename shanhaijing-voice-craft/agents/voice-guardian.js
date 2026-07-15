/**
 * Voice Guardian v9.2.0-Peng — 声音守护者
 * 校验每句台词是否符合角色的声纹指纹
 */
class VoiceGuardian {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async check({ sceneId, dialogueComplete, voiceSignatures, checkItems }) {
    console.log(`  🛡️ [VoiceGuardian] 校验场景 ${sceneId} 的声音一致性...`);

    const complete = dialogueComplete || await this.stateBus.getDialogue(sceneId)?.complete;
    const signatures = voiceSignatures || this.stateBus.getFullState().signatures || {};
    const items = checkItems || ['syntax', 'vocabulary', 'rhythm', 'emotion-map'];

    if (!complete || !complete.dialogueSegments) {
      console.log(`    ⚠️ 无对白可校验`);
      return null;
    }

    const checks = [];
    let totalScore = 0;
    let checkCount = 0;

    for (const segment of complete.dialogueSegments) {
      if (segment.type === 'silence') continue;

      const speaker = segment.speaker;
      const signature = signatures[speaker]?.signature;
      
      if (!signature) {
        checks.push({
          segmentId: segment.segmentId,
          speaker,
          status: 'SKIP',
          reason: '无签名档案'
        });
        continue;
      }

      const result = this.checkSegment(segment, signature, items);
      checks.push(result);
      
      if (result.overallScore !== undefined) {
        totalScore += result.overallScore;
        checkCount++;
      }
    }

    const overallScore = checkCount > 0 ? Math.round(totalScore / checkCount) : 100;
    const warnings = checks.filter(c => c.status === 'WARN');
    const failures = checks.filter(c => c.status === 'FAIL');

    const report = {
      sceneId,
      totalLines: checks.filter(c => c.status !== 'SKIP').length,
      checks,
      overallScore,
      warnings: warnings.map(w => ({
        segmentId: w.segmentId,
        type: w.warningType || 'deviation',
        description: w.warningDesc || '声纹偏离'
      })),
      failures: failures.map(f => ({
        segmentId: f.segmentId,
        type: f.failureType || 'mismatch',
        description: f.failureDesc || '严重偏离',
        suggestion: f.suggestion || '建议重铸'
      })),
      corrections: failures.length > 0 ? this.generateCorrections(failures, complete, signatures) : []
    };

    await this.stateBus.appendConsistencyLog({
      scene: sceneId,
      score: overallScore,
      issues: [...warnings, ...failures].map(i => ({
        segmentId: i.segmentId,
        type: i.status === 'WARN' ? 'warning' : 'failure',
        description: i.warningDesc || i.failureDesc
      }))
    });

    console.log(`    ✅ 声音校验完成: ${overallScore}/100, ${warnings.length} 警告, ${failures.length} 失败`);
    return report;
  }

  checkSegment(segment, signature, items) {
    const text = segment.text || '';
    const emotion = segment.emotion || '';
    const speaker = segment.speaker;

    let syntaxScore = 100;
    let vocabScore = 100;
    let rhythmScore = 100;
    let emotionScore = 100;

    // 语法校验
    if (items.includes('syntax')) {
      const syntax = signature.syntaxFingerprint || {};
      const avgLen = syntax.avgSentenceLength || 10;
      const minLen = syntax.lengthRange?.min || 2;
      const maxLen = syntax.lengthRange?.max || 30;
      
      const textLen = text.length;
      
      if (textLen < minLen && textLen > 0) {
        syntaxScore = Math.max(60, 100 - (minLen - textLen) * 10);
      } else if (textLen > maxLen * 1.5) {
        syntaxScore = Math.max(60, 100 - (textLen - maxLen) * 2);
      }

      // 如果是失控时刻，允许偏离
      if (segment.isControlMoment) {
        syntaxScore = Math.min(100, syntaxScore + 20);
      }
    }

    // 词汇校验
    if (items.includes('vocabulary')) {
      const vocab = signature.vocabularyFingerprint || {};
      const signatureWords = vocab.signatureWords || [];
      const tabooWords = vocab.tabooWords || [];
      
      let usedSignature = false;
      for (const word of signatureWords) {
        if (text.includes(word)) {
          usedSignature = true;
          break;
        }
      }

      let usedTaboo = false;
      for (const word of tabooWords) {
        if (text.includes(word)) {
          usedTaboo = true;
          break;
        }
      }

      if (!usedSignature && signatureWords.length > 0 && text.length > 5) {
        vocabScore -= 15;
      }
      if (usedTaboo) {
        vocabScore -= 25;
      }

      // 失控时刻的词汇偏离可能是设计意图
      if (segment.isControlMoment && !usedSignature) {
        vocabScore = Math.min(100, vocabScore + 15);
      }
    }

    // 韵律校验
    if (items.includes('rhythm')) {
      const emotionMap = signature.emotionLanguageMap || {};
      
      // 根据台词情绪匹配对应的情绪映射
      let mappedEmotion = 'neutral';
      if (emotion.includes('愤怒')) mappedEmotion = 'angry';
      else if (emotion.includes('快乐') || emotion.includes('开心')) mappedEmotion = 'happy';
      else if (emotion.includes('悲伤') || emotion.includes('痛苦')) mappedEmotion = 'sad';
      else if (emotion.includes('恐惧')) mappedEmotion = 'fearful';
      else if (emotion.includes('爱')) mappedEmotion = 'loving';

      const map = emotionMap[mappedEmotion];
      if (map) {
        const expectedLen = map.sentenceLength || '';
        const textLen = text.length;
        
        if (expectedLen.includes('极短') && textLen > 10) {
          rhythmScore -= 15;
        } else if (expectedLen.includes('短') && textLen > 15) {
          rhythmScore -= 10;
        }
      }
    }

    // 情绪一致性校验
    if (items.includes('emotion-map')) {
      // 检查台词中的情绪是否与标注一致
      // 简单检查：台词长度与情绪强度是否匹配
      const highEmotion = ['愤怒', '绝望', '崩溃', '爆发'];
      const isHigh = highEmotion.some(e => emotion.includes(e));
      
      if (isHigh && text.length > 20) {
        emotionScore -= 10;
      }
    }

    // 计算综合得分
    const overallScore = Math.round((syntaxScore + vocabScore + rhythmScore + emotionScore) / 4);

    let status = 'PASS';
    let warningType = null;
    let warningDesc = null;
    let failureType = null;
    let failureDesc = null;
    let suggestion = null;

    if (overallScore < 60) {
      status = 'FAIL';
      failureType = 'severe-deviation';
      failureDesc = `严重偏离声纹: 语法${syntaxScore} 词汇${vocabScore} 韵律${rhythmScore} 情绪${emotionScore}`;
      suggestion = '建议反馈给 Dialogue Smith 重铸';
    } else if (overallScore < 80) {
      status = 'WARN';
      warningType = 'deviation';
      warningDesc = `声纹偏离: 语法${syntaxScore} 词汇${vocabScore} 韵律${rhythmScore} 情绪${emotionScore}`;
      
      if (segment.isControlMoment) {
        status = 'PASS';
        warningType = 'intentional-deviation';
        warningDesc = '失控时刻的声纹偏离是设计意图';
      }
    }

    return {
      segmentId: segment.segmentId,
      speaker,
      syntax: { status: syntaxScore >= 80 ? 'PASS' : syntaxScore >= 60 ? 'WARN' : 'FAIL', score: syntaxScore },
      vocabulary: { status: vocabScore >= 80 ? 'PASS' : vocabScore >= 60 ? 'WARN' : 'FAIL', score: vocabScore },
      rhythm: { status: rhythmScore >= 80 ? 'PASS' : rhythmScore >= 60 ? 'WARN' : 'FAIL', score: rhythmScore },
      emotionMap: { status: emotionScore >= 80 ? 'PASS' : emotionScore >= 60 ? 'WARN' : 'FAIL', score: emotionScore },
      overallScore,
      status,
      warningType,
      warningDesc,
      failureType,
      failureDesc,
      suggestion
    };
  }

  generateCorrections(failures, complete, signatures) {
    const corrections = [];
    
    for (const failure of failures) {
      const segment = complete.dialogueSegments.find(s => s.segmentId === failure.segmentId);
      if (!segment) continue;

      const sig = signatures[segment.speaker]?.signature;
      if (!sig) continue;

      const vocab = sig.vocabularyFingerprint || {};
      const signatureWords = vocab.signatureWords || [];
      
      corrections.push({
        segmentId: failure.segmentId,
        issue: failure.failureDesc,
        suggestion: `建议加入签名词: ${signatureWords.slice(0, 2).join('、')}`,
        originalText: segment.text,
        autoFix: signatureWords.length > 0 ? `${segment.text}（${signatureWords[0]}）` : null
      });
    }

    return corrections;
  }
}

module.exports = VoiceGuardian;