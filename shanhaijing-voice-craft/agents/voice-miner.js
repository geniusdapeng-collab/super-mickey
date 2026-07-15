/**
 * Voice Miner v9.2.0-Peng — 声纹矿工
 * 从角色档案中提取并构建精确的语言指纹
 */
class VoiceMiner {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async extract({ characterId, personaData }) {
    console.log(`  🔍 [VoiceMiner] 提取 ${personaData.name || characterId} 的声纹...`);

    const wound = personaData.wound || {};
    const breathing = personaData.breathing || {};
    const role = personaData.role || 'protagonist';

    // Pass 1: 语法指纹
    const syntaxFingerprint = this.extractSyntax(breathing, wound, role);
    
    // Pass 2: 词汇指纹
    const vocabularyFingerprint = this.extractVocabulary(wound, breathing, role);
    
    // Pass 3: 韵律指纹
    const rhythmicFingerprint = this.extractRhythm(breathing, wound);
    
    // Pass 4: 情绪-语言映射
    const emotionLanguageMap = this.buildEmotionMap(wound, breathing, vocabularyFingerprint);

    const signature = {
      characterId,
      characterName: personaData.name || characterId,
      signature: {
        syntaxFingerprint,
        vocabularyFingerprint,
        rhythmicFingerprint,
        emotionLanguageMap
      }
    };

    await this.stateBus.updateSignature(characterId, signature);
    console.log(`    ✅ 声纹提取完成: ${vocabularyFingerprint.signatureWords?.length} 个签名词`);
    return signature;
  }

  extractSyntax(breathing, wound, role) {
    const pace = breathing.pace || 'normal';
    const coping = wound.structure?.copingMechanism || '';
    
    let avgLength = 10;
    let minLen = 5, maxLen = 20;
    let dominantStructure = '主谓宾完整句';
    let questionStyle = '直接疑问句';
    let imperativeRatio = 0.15;
    let interruptionFreq = '低';
    let fragmentUsage = '低';

    if (pace.includes('急促') || pace.includes('爆发')) {
      avgLength = 6;
      minLen = 2; maxLen = 15;
      dominantStructure = '短句为主，主谓结构，极少从句';
      fragmentUsage = '高';
    } else if (pace.includes('缓慢') || pace.includes('沉稳')) {
      avgLength = 14;
      minLen = 8; maxLen = 30;
      dominantStructure = '完整复合句，逻辑严密';
    }

    if (coping.includes('愤怒') || coping.includes('攻击')) {
      questionStyle = '反问为主';
      imperativeRatio = 0.35;
      interruptionFreq = '高';
    } else if (coping.includes('回避') || coping.includes('逃避')) {
      questionStyle = '很少提问，回答简短';
      imperativeRatio = 0.05;
    }

    if (role === 'antagonist') {
      questionStyle = '诱导式反问';
      imperativeRatio = Math.max(imperativeRatio, 0.25);
    }

    return {
      avgSentenceLength: avgLength,
      lengthRange: { min: minLen, max: maxLen },
      dominantStructure,
      questionStyle,
      imperativeRatio,
      interruptionFrequency: interruptionFreq,
      fragmentUsage
    };
  }

  extractVocabulary(wound, breathing, role) {
    const surfaceWound = wound.surface || '';
    const structuralWound = wound.structure || {};
    const existentialWound = wound.existential || '';
    
    // 基于创伤提取签名词
    let signatureWords = [];
    let tabooWords = [];
    let selfReference = '我';
    let insultStyle = '无';
    let honorificUsage = '常规使用';
    let intensityModifiers = [];

    // 从表面伤口提取
    if (surfaceWound.includes('被压') || surfaceWound.includes('被关')) {
      signatureWords.push('压', '关', '牢', '锁');
      tabooWords.push('自由', '飞');
    }
    if (surfaceWound.includes('失败')) {
      signatureWords.push('败', '输', '错');
    }

    // 从结构性伤口提取
    if (structuralWound.coreLie) {
      const lie = structuralWound.coreLie;
      if (lie.includes('强大') || lie.includes('强')) {
        signatureWords.push('强', '弱', '打', '力量');
        intensityModifiers.push('俺老孙', '吃我一棒', '找死');
      }
      if (lie.includes('信任') || lie.includes('信')) {
        signatureWords.push('信', '骗', '真', '假');
      }
    }

    // 从存在性伤口提取
    if (existentialWound.includes('无父无母') || existentialWound.includes('孤独')) {
      selfReference = '俺';
      signatureWords.push('俺', '一个人', '孤零零');
      tabooWords.push('父母', '家', '温暖');
    }

    // 从呼吸方式推断
    const volume = breathing.volume || '正常';
    if (volume.includes('大') || volume.includes('从不低语')) {
      insultStyle = '直接+比喻';
      honorificUsage = '从不使用敬语';
    } else if (volume.includes('低') || volume.includes('柔')) {
      insultStyle = '讽刺+委婉';
    }

    // 角色类型修正
    if (role === 'antagonist') {
      signatureWords.push('蠢', '可笑', '天真');
      insultStyle = '居高临下式';
      honorificUsage = '表面客气实则讽刺';
    }

    // 去重
    signatureWords = [...new Set(signatureWords)];
    tabooWords = [...new Set(tabooWords)];
    intensityModifiers = [...new Set(intensityModifiers)];

    return {
      selfReference,
      signatureWords,
      tabooWords,
      insultStyle,
      honorificUsage,
      intensityModifiers
    };
  }

  extractRhythm(breathing, wound) {
    const pace = breathing.pace || '正常';
    const silencePattern = breathing.silencePattern || '';

    let breathPattern = '正常呼吸节奏';
    let pauseBehavior = '常规停顿';
    let cadence = '平稳';
    let stressPattern = '常规重读';

    if (pace.includes('急促') || pace.includes('爆发')) {
      breathPattern = '短促呼吸，句子之间几乎不停';
      cadence = '像心跳加速——快-快-快-停-爆发';
      stressPattern = '关键词重读，虚词几乎省略';
    }

    if (silencePattern.includes('越危险越安静')) {
      pauseBehavior = '愤怒前停顿（2-3秒窒息沉默），然后爆发';
    } else if (silencePattern.includes('悲伤') || silencePattern.includes('痛苦')) {
      pauseBehavior = '痛苦时长时间的沉默';
    }

    return {
      pace,
      breathPattern,
      pauseBehavior,
      cadence,
      stressPattern
    };
  }

  buildEmotionMap(wound, breathing, vocab) {
    const coping = (wound.structure?.copingMechanism || '').toLowerCase();
    const pace = breathing.pace || 'normal';
    
    const emotions = ['angry', 'happy', 'sad', 'fearful', 'loving'];
    const map = {};

    for (const emotion of emotions) {
      let sentenceLength = '中等，8-12字';
      let vocabulary = '常规词汇';
      let volume = '正常';
      let signature = '';

      switch (emotion) {
        case 'angry':
          sentenceLength = '极短，2-6字';
          vocabulary = '暴力动词，侮辱性称呼';
          volume = '最大';
          signature = '重复关键词——' + (vocab.signatureWords?.[0] || '打') + '打打打';
          break;
        case 'happy':
          sentenceLength = pace.includes('急促') ? '较长，12-20字' : '中等，8-12字';
          vocabulary = '调侃，戏谑';
          volume = pace.includes('急促') ? '大但柔和' : '正常偏高';
          signature = '笑声穿插';
          break;
        case 'sad':
          sentenceLength = '短，3-8字';
          vocabulary = '极简，回避具体情感词';
          volume = '低';
          signature = coping.includes('愤怒') ? '沉默+摩挲武器+自言自语' : '长时间的停顿';
          break;
        case 'fearful':
          sentenceLength = '不固定，可能结巴';
          vocabulary = '重复，语无伦次';
          volume = '不稳定';
          signature = coping.includes('愤怒') ? '罕见——通常转化为愤怒来掩盖' : '结巴+重复';
          break;
        case 'loving':
          sentenceLength = '中，8-12字';
          vocabulary = '朴素但温暖，不直接说"爱"';
          volume = '低';
          signature = '用行动代替语言';
          break;
      }

      map[emotion] = { sentenceLength, vocabulary, volume, signature };
    }

    return map;
  }
}

module.exports = VoiceMiner;