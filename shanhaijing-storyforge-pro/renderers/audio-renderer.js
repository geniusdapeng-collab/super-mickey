/**
 * Audio Renderer v3.6-Peng
 * 将 Story Universe 渲染为音频设计视图
 * 
 * 输出：声音设计文档
 */

class AudioRenderer {
  render(universe) {
    const audioView = {
      title: universe.theme?.coreTheme || '未命名作品',
      soundscape: this.buildSoundscape(universe),
      musicCues: this.extractMusicCues(universe),
      voiceDirection: this.extractVoiceDirection(universe),
      ambience: this.extractAmbience(universe)
    };
    
    return audioView;
  }

  buildSoundscape(universe) {
    const scenes = universe.scenes || {};
    const world = universe.world || {};
    
    // 从世界观提取基础环境音
    const baseAmbience = world.atmosphereKeywords || ['中性环境'];
    
    // 为每场景提取声音元素
    const sceneSounds = Object.entries(scenes).map(([id, scene]) => ({
      sceneId: id,
      slugline: scene.slugline || id,
      ambient: scene.audioNotes || '环境音',
      keySounds: this.extractKeySounds(scene),
      emotionalTone: scene.emotionalArc || '中性'
    }));
    
    return {
      baseAmbience,
      sceneSounds,
      overallMood: universe.theme?.emotionalFormula?.primaryEmotion || '中性'
    };
  }

  extractMusicCues(universe) {
    const scenes = universe.scenes || {};
    const plot = universe.plot || {};
    const tensionCurve = plot.tensionCurve || [];
    
    const cues = [];
    
    Object.entries(scenes).forEach(([id, scene], index) => {
      const tension = tensionCurve[index]?.value || 50;
      const emotion = scene.emotionalArc || '中性';
      
      cues.push({
        sceneId: id,
        position: scene.timeRange || '0:00',
        mood: this.inferMusicMood(emotion, tension),
        intensity: tension / 100,
        instrument: this.inferInstrument(emotion),
        tempo: this.inferTempo(tension)
      });
    });
    
    return cues;
  }

  extractVoiceDirection(universe) {
    const characters = universe.characters || {};
    const entries = Array.isArray(characters)
      ? characters.map((c, i) => [c.id || c.characterId || String(i), c])
      : Object.entries(characters);
    
    return entries.map(([id, char]) => ({
      characterId: id,
      name: char.name || id,
      voiceType: this.inferVoiceType(char),
      speakingStyle: char.voice?.pattern || char.breathing?.pace || '未指定',
      emotionalRange: char.voice?.emotionRange || ['中性'],
      notes: char.voiceProfile?.speakingStyle || ''
    }));
  }

  extractAmbience(universe) {
    const world = universe.world || {};
    
    return {
      environment: world.climate || '未指定',
      timeOfDay: this.inferTimeOfDay(world.era),
      acousticSpace: world.architecture || '未指定',
      backgroundHum: world.atmosphereKeywords?.[0] || '中性'
    };
  }

  // 辅助推断方法
  extractKeySounds(scene) {
    const sounds = [];
    if (scene.slugline?.includes('雨')) sounds.push('雨声');
    if (scene.slugline?.includes('风')) sounds.push('风声');
    if (scene.props) {
      scene.props.forEach(p => {
        if (p.includes('钟')) sounds.push('钟声');
        if (p.includes('铃')) sounds.push('铃声');
      });
    }
    return sounds;
  }

  inferMusicMood(emotion, tension) {
    if (emotion.includes('悲') || emotion.includes('伤')) return '忧郁弦乐';
    if (emotion.includes('怒') || emotion.includes('战')) return '紧张打击乐';
    if (emotion.includes('喜') || emotion.includes('乐')) return '轻快钢琴';
    if (tension > 80) return '史诗管弦';
    if (tension < 30) return '氛围电子';
    return '叙事主题';
  }

  inferInstrument(emotion) {
    if (emotion.includes('古') || emotion.includes('风')) return '古琴+笛子';
    if (emotion.includes('战') || emotion.includes('斗')) return '铜管+打击';
    if (emotion.includes('梦') || emotion.includes('幻')) return '合成器+竖琴';
    return '弦乐四重奏';
  }

  inferTempo(tension) {
    if (tension > 80) return 'Allegro (120-168 BPM)';
    if (tension > 50) return 'Moderato (108-120 BPM)';
    if (tension > 30) return 'Andante (76-108 BPM)';
    return 'Adagio (66-76 BPM)';
  }

  inferVoiceType(char) {
    const role = char.role || '';
    if (role.includes('protagonist')) return '主角音（清晰有力）';
    if (role.includes('antagonist')) return '反派音（低沉危险）';
    if (role.includes('mentor')) return '导师音（沉稳智慧）';
    if (role.includes('comic')) return '喜剧音（轻快活泼）';
    return '标准音';
  }

  inferTimeOfDay(era) {
    if (era?.includes('夜')) return '夜晚';
    if (era?.includes('晨')) return '清晨';
    if (era?.includes('昏')) return '黄昏';
    return '白天';
  }
}

module.exports = { AudioRenderer };