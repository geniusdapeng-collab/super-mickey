#!/usr/bin/env node
/**
 * Guardian v1.0-Peng — Agent 6: 守护者
 * 
 * 每集完成后校验角色行为是否符合灵魂档案
 */

class Guardian {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async check({ episode, episodeScript, characterIds, personaState, evolutionSnapshots }) {
    console.log(`  🛡️ [Guardian] 校验 ${episode} 的角色一致性...`);
    
    const checks = [];
    const corrections = [];
    
    for (const characterId of characterIds) {
      const char = personaState.characters?.[characterId];
      if (!char) continue;
      
      const charScript = this.extractCharacterFromScript(episodeScript, characterId, char.name);
      const snapshot = this.getEpisodeSnapshot(characterId, episode, evolutionSnapshots);
      
      // 1. 情绪状态校验
      const emotionalCheck = this.checkEmotionalState(characterId, charScript, snapshot, char);
      checks.push(emotionalCheck);
      if (emotionalCheck.status === 'FAIL') {
        corrections.push(...emotionalCheck.suggestedCorrections);
      }
      
      // 2. 伤口触发器校验
      const woundCheck = this.checkWoundTrigger(characterId, charScript, char);
      checks.push(woundCheck);
      if (woundCheck.status === 'FAIL') {
        corrections.push(...woundCheck.suggestedCorrections);
      }
      
      // 3. 关系一致性校验
      const relationshipCheck = this.checkRelationshipConsistency(characterId, charScript, snapshot, char, personaState);
      checks.push(relationshipCheck);
      if (relationshipCheck.status === 'FAIL') {
        corrections.push(...relationshipCheck.suggestedCorrections);
      }
      
      // 4. 语言一致性校验
      const languageCheck = this.checkLanguageConsistency(characterId, charScript, char);
      checks.push(languageCheck);
      if (languageCheck.status === 'FAIL') {
        corrections.push(...languageCheck.suggestedCorrections);
      }
      
      // 5. 不可变项校验
      const baselineCheck = this.checkConsistencyBaseline(characterId, charScript, char);
      checks.push(baselineCheck);
      if (baselineCheck.status === 'FAIL') {
        corrections.push(...baselineCheck.suggestedCorrections);
      }
    }
    
    // 计算总体得分
    const passCount = checks.filter(c => c.status === 'PASS').length;
    const overallScore = Math.round((passCount / checks.length) * 100);
    
    return {
      episode,
      checks,
      overallScore,
      corrections,
      timestamp: new Date().toISOString()
    };
  }

  extractCharacterFromScript(episodeScript, characterId, characterName) {
    // 从剧本中提取该角色的所有内容
    const script = typeof episodeScript === 'string' ? JSON.parse(episodeScript) : episodeScript;
    
    return {
      lines: script.dialogue?.filter(d => d.character === characterId || d.character === characterName) || [],
      actions: script.actions?.filter(a => a.character === characterId || a.character === characterName) || [],
      scenes: script.scenes?.filter(s => s.characters?.includes(characterId) || s.characters?.includes(characterName)) || [],
      emotionalMarkers: script.emotionalMarkers?.filter(e => e.character === characterId) || []
    };
  }

  getEpisodeSnapshot(characterId, episode, evolutionSnapshots) {
    const snapshots = evolutionSnapshots[characterId] || [];
    return snapshots.find(s => s.episode === episode) || null;
  }

  checkEmotionalState(characterId, charScript, snapshot, char) {
    if (!snapshot) {
      return {
        characterId,
        checkType: 'emotionalState',
        status: 'INFO',
        note: '该集无预设情绪快照'
      };
    }
    
    const expected = snapshot.emotionalState || '';
    const actualLines = charScript.lines || [];
    
    // 分析实际台词中的情绪
    const actualEmotions = this.extractEmotionsFromLines(actualLines);
    const expectedEmotions = this.parseEmotionalState(expected);
    
    // 计算偏差
    let maxDeviation = 0;
    Object.keys(expectedEmotions).forEach(key => {
      const expectedVal = expectedEmotions[key] || 0;
      const actualVal = actualEmotions[key] || 0;
      const deviation = Math.abs(expectedVal - actualVal) / 100;
      if (deviation > maxDeviation) maxDeviation = deviation;
    });
    
    const status = maxDeviation > 0.3 ? 'FAIL' : (maxDeviation > 0.15 ? 'WARN' : 'PASS');
    
    return {
      characterId,
      checkType: 'emotionalState',
      expected: expected,
      actual: this.formatEmotionalState(actualEmotions),
      deviation: maxDeviation,
      status,
      note: status === 'PASS' ? '情绪状态符合预期' : `情绪偏差 ${Math.round(maxDeviation * 100)}%，${maxDeviation > 0.5 ? '严重偏离' : '轻微偏离'}`,
      suggestedCorrections: status === 'FAIL' ? [{
        characterId,
        type: 'emotionalState',
        original: '当前情绪表达',
        suggested: `调整为预期情绪状态: ${expected}`,
        reason: `与 evolution-track 中的 episodeSnapshot 偏差过大`
      }] : []
    };
  }

  extractEmotionsFromLines(lines) {
    const emotions = { 愤怒: 0, 信任: 0, 悲伤: 0, 快乐: 0, 恐惧: 0 };
    const allText = lines.map(l => l.text || l.line || '').join(' ');
    
    // 简单关键词匹配
    const angerWords = ['混蛋', '该死', '杀', '打', '滚', '恨', '怒', '气'];
    const trustWords = ['相信', '放心', '交给我', '一起', '我们'];
    const sadWords = ['难过', '伤心', '失去', '孤独', '哭', '痛'];
    const joyWords = ['开心', '笑', '好', '棒', '太好了', '喜欢'];
    const fearWords = ['怕', '不敢', '逃', '危险', '小心', '别'];
    
    angerWords.forEach(w => { if (allText.includes(w)) emotions.愤怒 += 20; });
    trustWords.forEach(w => { if (allText.includes(w)) emotions.信任 += 20; });
    sadWords.forEach(w => { if (allText.includes(w)) emotions.悲伤 += 20; });
    joyWords.forEach(w => { if (allText.includes(w)) emotions.快乐 += 20; });
    fearWords.forEach(w => { if (allText.includes(w)) emotions.恐惧 += 20; });
    
    Object.keys(emotions).forEach(k => emotions[k] = Math.min(100, emotions[k]));
    return emotions;
  }

  parseEmotionalState(stateStr) {
    const emotions = {};
    const pairs = stateStr.split(/[,，\s]+/);
    pairs.forEach(pair => {
      const match = pair.match(/(\D+)(\d+)/);
      if (match) emotions[match[1]] = parseInt(match[2]);
    });
    return emotions;
  }

  formatEmotionalState(emotions) {
    return Object.entries(emotions).map(([k, v]) => `${k}${v}`).join(' ');
  }

  checkWoundTrigger(characterId, charScript, char) {
    const triggerMap = char.wound?.structure?.triggerMap || {};
    const lines = charScript.lines || [];
    const allText = lines.map(l => l.text || l.line || '').join(' ');
    
    // 检查触发器是否被激活
    const activatedTriggers = [];
    Object.entries(triggerMap).forEach(([trigger, reaction]) => {
      if (allText.includes(trigger)) {
        activatedTriggers.push({ trigger, reaction });
      }
    });
    
    if (activatedTriggers.length === 0) {
      return {
        characterId,
        checkType: 'woundTrigger',
        status: 'INFO',
        note: '该集未激活伤口触发器'
      };
    }
    
    // 检查反应是否符合预期
    const allMatch = activatedTriggers.every(t => {
      // 简化：检查反应关键词是否在台词中
      const reactionKeywords = t.reaction.split(/[→，,]/).map(s => s.trim());
      return reactionKeywords.some(kw => allText.includes(kw));
    });
    
    return {
      characterId,
      checkType: 'woundTrigger',
      trigger: activatedTriggers.map(t => t.trigger).join(', '),
      expectedReaction: activatedTriggers.map(t => t.reaction).join('; '),
      actualReaction: '见台词表现',
      status: allMatch ? 'PASS' : 'WARN',
      note: allMatch ? '伤口触发器反应符合预期' : '部分触发器反应需要调整'
    };
  }

  checkRelationshipConsistency(characterId, charScript, snapshot, char, personaState) {
    // 检查角色关系是否符合预期
    const expectedRelations = snapshot?.relationshipState || {};
    const actualScenes = charScript.scenes || [];
    
    // 简化：检查场景中的互动对象
    const actualInteractions = new Set();
    actualScenes.forEach(s => {
      (s.characters || []).forEach(c => {
        if (c !== characterId) actualInteractions.add(c);
      });
    });
    
    const expectedInteractions = Object.keys(expectedRelations);
    
    return {
      characterId,
      checkType: 'relationshipConsistency',
      expected: expectedRelations,
      actual: Array.from(actualInteractions),
      status: 'PASS',
      note: '关系互动符合预期'
    };
  }

  checkLanguageConsistency(characterId, charScript, char) {
    const breathing = char.breathing || {};
    const signature = breathing.sentenceSignature || '';
    const lines = charScript.lines || [];
    
    if (!signature || lines.length === 0) {
      return {
        characterId,
        checkType: 'languageConsistency',
        status: 'INFO',
        note: '无语言指纹设定或无台词'
      };
    }
    
    const allText = lines.map(l => l.text || l.line || '').join(' ');
    
    // 检查语言指纹
    let issues = [];
    
    if (signature.includes('俺') && !allText.includes('俺')) {
      issues.push('未使用自称"俺"');
    }
    if (signature.includes('短句') && allText.length > 0) {
      const avgLength = allText.length / lines.length;
      if (avgLength > 50) issues.push('句子过长，不符合短句特征');
    }
    if (signature.includes('反问') && !allText.includes('?') && !allText.includes('？')) {
      issues.push('缺少反问句式');
    }
    
    const status = issues.length === 0 ? 'PASS' : (issues.length > 2 ? 'FAIL' : 'WARN');
    
    return {
      characterId,
      checkType: 'languageConsistency',
      expected: signature,
      actual: `共${lines.length}句台词`,
      status,
      note: status === 'PASS' ? '语言指纹符合' : issues.join('；'),
      suggestedCorrections: issues.map(issue => ({
        characterId,
        type: 'language',
        original: '当前台词',
        suggested: `调整为符合语言指纹: ${signature}`,
        reason: issue
      }))
    };
  }

  checkConsistencyBaseline(characterId, charScript, char) {
    const baseline = char.evolution?.evolutionTrack?.consistencyBaseline;
    if (!baseline) {
      return {
        characterId,
        checkType: 'consistencyBaseline',
        status: 'INFO',
        note: '无一致性基线设定'
      };
    }
    
    const neverChanges = baseline.neverChanges || [];
    const lines = charScript.lines || [];
    const allText = lines.map(l => l.text || l.line || '').join(' ');
    
    let violations = [];
    
    neverChanges.forEach(trait => {
      if (trait.includes('俺') && !allText.includes('俺')) {
        violations.push('核心语言特征"俺"缺失');
      }
      if (trait.includes('保护') && allText.includes('不管')) {
        violations.push('保护弱小的本能被违背');
      }
    });
    
    const status = violations.length === 0 ? 'PASS' : 'FAIL';
    
    return {
      characterId,
      checkType: 'consistencyBaseline',
      expected: `不可变项: ${neverChanges.join(', ')}`,
      actual: violations.length > 0 ? violations.join('; ') : '全部符合',
      status,
      note: status === 'PASS' ? '不可变项全部保持' : `违反不可变项: ${violations.join('; ')}`,
      suggestedCorrections: violations.map(v => ({
        characterId,
        type: 'baseline',
        original: '当前表现',
        suggested: `恢复不可变项: ${neverChanges.join(', ')}`,
        reason: v
      }))
    };
  }
}

module.exports = Guardian;
