/**
 * Video View Renderer v3.6-Peng
 * 将 Story Universe 渲染为视频系统需要的视图
 */

const { StoryUniverse } = require('../universe/universe-model.js');

class VideoViewRenderer {
  constructor() {
    // v5.1-Peng: 文化情绪表达配置
    this.CULTURAL_EMOTION_PROFILES = {
      'eastern': {
        name: '东方压抑',
        style: 'surface_calm',
        expression: '克制与留白',
        modifiers: {
          highTension: '表面平静，但指尖微颤、呼吸沉重',
          lowTension: '淡然一笑，眼神低垂',
          climax: '爆发被压制，化为无声凝视或转身离去',
          resolution: '留白，余韵悠长'
        },
        emotionMap: {
          '愤怒': '隐忍不发，下颌紧咬',
          '悲伤': '转身抹泪，背对镜头',
          '喜悦': '嘴角微扬，眼含泪光',
          '恐惧': '瞳孔微缩，呼吸骤停',
          '坚定': '沉默凝视，缓缓点头'
        }
      },
      'western': {
        name: '西方外放',
        style: 'direct_expression',
        expression: '直接展示',
        modifiers: {
          highTension: '情绪外放，面部扭曲，动作激烈',
          lowTension: '放松姿态，自然流露',
          climax: '爆发式宣泄，高声或肢体伸展',
          resolution: '和解或明确结局'
        },
        emotionMap: {
          '愤怒': '怒吼，摔物，面部涨红',
          '悲伤': '痛哭流涕，双手捂面',
          '喜悦': '开怀大笑，手舞足蹈',
          '恐惧': '尖叫后退，抱头蹲下',
          '坚定': '握拳宣誓，直视前方'
        }
      },
      'middle_eastern': {
        name: '中东宿命',
        style: 'ritualistic',
        expression: '仪式感与宿命论',
        modifiers: {
          highTension: '仰望天空，双手摊开，低声祈祷',
          lowTension: '盘坐，目光深远，似在回忆',
          climax: '仪式性动作：旋转、跪拜、高举双手',
          resolution: '接受命运，静默退场'
        },
        emotionMap: {
          '愤怒': '低声诅咒，眼神阴郁',
          '悲伤': '面向麦加方向，额头触地',
          '喜悦': '双手举过头顶，呼喊赞美',
          '恐惧': '蜷缩角落，反复念诵',
          '坚定': '挺胸阔步，目光如炬'
        }
      },
      'neutral': {
        name: '中性通用',
        style: 'balanced',
        expression: '平衡表达',
        modifiers: {},
        emotionMap: {}
      }
    };
  }

  render(universe) {
    return {
      story_plan: this.extractStoryPlan(universe),
      character_specs: this.extractCharacterSpecs(universe),
      shot_suggestions: this.extractShotSuggestions(universe),
      dialogue_data: this.extractDialogueData(universe),
      sound_design: this.extractSoundDesign(universe),
      visual_language: universe.world?.visual_style || {}
    };
  }

  /**
   * 推断文化背景（从videoType或metadata）
   */
  _inferCulture(metadata, videoType) {
    // 优先使用显式culture参数
    if (metadata.culture && this.CULTURAL_EMOTION_PROFILES[metadata.culture]) {
      return metadata.culture;
    }
    
    // 从视频类型推断
    const cultureMap = {
      'action': 'western',
      'drama': 'eastern',
      'documentary': 'neutral',
      'educational': 'neutral',
      'commercial': 'western'
    };
    
    return cultureMap[videoType] || 'neutral';
  }

  extractStoryPlan(universe) {
    const metadata = universe.metadata || {};
    const plot = universe.plot || {};
    const scenes = Object.values(universe.scenes || {});
    const acts = plot.acts || [];
    
    // v5.5-Peng-CinePrompt: 幕分配 — 优先使用scene.act（来自structure-engine的五幕结构），否则动态分配
    const sceneToAct = {};
    scenes.forEach((scene, idx) => {
      if (scene.act) {
        // 使用plot-weaver分配的actName（支持五幕结构）
        const actIndex = acts.findIndex(a => a.actName === scene.act) + 1;
        sceneToAct[scene.sceneId] = { name: scene.act, index: actIndex || 1 };
      } else {
        // 回退：动态分配（兼容旧格式）
        const actNames = ['起', '承', '转', '合'];
        const pct = scenes.length > 1 ? idx / (scenes.length - 1) : 0;
        let actIdx = 0;
        if (pct >= 0.75) actIdx = 3;
        else if (pct >= 0.50) actIdx = 2;
        else if (pct >= 0.25) actIdx = 1;
        sceneToAct[scene.sceneId] = { name: actNames[actIdx] || '起', index: actIdx + 1 };
      }
    });
    
    // 情绪映射
    const toneMap = {
      '从平静到不安': { start: '平静', end: '紧张' },
      '从紧张到绝望': { start: '紧张', end: '绝望' },
      '从绝望到平静': { start: '绝望', end: '平静' },
      '从平静到希望': { start: '平静', end: '希望' },
      '从希望到坚定': { start: '希望', end: '坚定' },
      '从坚定到爆发': { start: '坚定', end: '爆发' },
    };
    
    // v5.1-Peng: 文化情绪表达
    const videoType = metadata.videoType || 'action';
    const cultureKey = this._inferCulture(metadata, videoType);
    const cultureProfile = this.CULTURAL_EMOTION_PROFILES[cultureKey] || this.CULTURAL_EMOTION_PROFILES.neutral;
    
    // 张力映射（按幕）— v5.5-Peng-CinePrompt: 支持五幕结构
    const tensionBase = { '起': 20, '承': 50, '转': 80, '高潮': 90, '合': 40 };
    
    // 从scenes提取所有shots
    const shots = [];
    let currentTime = 0;
    
    scenes.forEach((scene) => {
      const actInfo = sceneToAct[scene.sceneId] || { name: '起', index: 1 };
      const sceneShots = scene.shots || [];
      
      // 解析场景情绪
      const tone = scene.emotionalTone || '平静';
      const mapped = toneMap[tone] || { 
        start: tone.split('到')[0]?.trim() || '平静', 
        end: tone.split('到')[1]?.trim() || '平静' 
      };
      
      sceneShots.forEach((shot, shotIdx) => {
        const duration = shot.duration || 8;
        const id = `S${String(shots.length + 1).padStart(2, '0')}`;
        
        // 张力：幕基础 + 镜头在场景中的进度
        const base = tensionBase[actInfo.name] || 50;
        const progress = sceneShots.length > 1 ? shotIdx / (sceneShots.length - 1) : 0;
        const tension = Math.round(base + progress * 15);
        
        // v5.1-Peng: 应用文化情绪表达修饰
        const culturalStart = cultureProfile.emotionMap[mapped.start] || mapped.start;
        const culturalEnd = cultureProfile.emotionMap[mapped.end] || mapped.end;
        const culturalModifier = this._resolveCulturalModifier(cultureProfile, tension, actInfo.name);
        
        shots.push({
          id,
          act: actInfo.name,
          actIndex: actInfo.index,
          duration,
          timeRange: `${currentTime}-${currentTime + duration}s`,
          timeRangeAbsolute: `${currentTime}-${currentTime + duration}`,
          type: shot.type || '建置',
          description: shot.description || scene.purpose || '',
          characters: scene.characters || [],
          emotionStart: culturalStart,
          emotionEnd: culturalEnd,
          tension,
          camera: shot.cameraDirection || '中景固定',
          handoff: shotIdx === sceneShots.length - 1 ? '硬切' : '淡入淡出',
          handoffType: '动作冻结',
          notes: shot.focus || '',
          lighting: shot.lighting || scene.lightingSetup || '',
          // v5.1-Peng: 文化情绪上下文
          culturalContext: {
            style: cultureProfile.style,
            expression: cultureProfile.expression,
            modifier: culturalModifier,
            culture: cultureKey
          }
        });
        
        currentTime += duration;
      });
    });
    
    // v5.1-Peng: 多角色情绪叠加
    shots.forEach(shot => {
      if (shot.characters && shot.characters.length > 1) {
        shot.multiCharacterEmotion = this._resolveMultiCharacterEmotion(shot, cultureProfile);
      }
    });
    
    // v5.1-Peng: 视觉隐喻编码
    shots.forEach(shot => {
      shot.visualMetaphor = this._resolveVisualMetaphor(shot, cultureProfile);
    });
    
    // v5.1-Peng: 心理时间感知引擎
    shots.forEach(shot => {
      shot.timePerception = this._resolveTimePerception(shot);
    });
    
    // v5.1-Peng: 沉浸式POV系统
    shots.forEach(shot => {
      shot.pov = this._resolvePOV(shot);
    });
    for (let i = 0; i < shots.length - 1; i++) {
      shots[i].transitionTo = shots[i + 1].id;
      shots[i].transitionType = 'cut';
      shots[i].transitionDuration = 0.5;
    }
    
    // v5.1-Peng: 优先使用 structure-engine 生成的非线性张力曲线
    const structureTensionCurve = universe.plot?.tensionCurve;
    let emotionCurve;
    let nonlinearBeats = [];
    
    if (structureTensionCurve && structureTensionCurve.curve) {
      // 使用 structure-engine.js 生成的非线性曲线
      emotionCurve = structureTensionCurve.curve;
      nonlinearBeats = structureTensionCurve.nonlinearBeats || [];
      console.log(`   🎭 非线性情绪引擎: ${nonlinearBeats.length} 个情绪节拍注入`);
      for (const beat of nonlinearBeats) {
        console.log(`      - [${beat.name}] @ ${beat.time}s (${beat.zone})`);
      }
    } else {
      // 回退：从 shots 重新计算线性曲线
      emotionCurve = shots.map(s => ({
        time: parseInt(s.timeRangeAbsolute.split('-')[0]),
        tension: s.tension
      }));
      emotionCurve.push({ time: currentTime, tension: 20 });
    }
    
    // 角色时间线
    const charTimeline = [];
    const seenChars = new Set();
    shots.forEach(shot => {
      (shot.characters || []).forEach(char => {
        if (!seenChars.has(char)) {
          seenChars.add(char);
          charTimeline.push({
            character: char,
            firstAppearance: shot.id,
            firstAct: shot.act,
            firstTime: shot.timeRange
          });
        }
      });
    });
    
    // 时长缩放：如果总时长超过设定时长，按比例缩放
    const targetDuration = metadata.duration || currentTime;
    if (targetDuration > 0 && currentTime > targetDuration) {
      const scale = targetDuration / currentTime;
      let scaledTime = 0;
      shots.forEach(shot => {
        shot.duration = Math.max(2, Math.round(shot.duration * scale)); // 最少2秒
        const start = scaledTime;
        scaledTime += shot.duration;
        shot.timeRange = `${start}-${scaledTime}s`;
        shot.timeRangeAbsolute = `${start}-${scaledTime}`;
      });
      currentTime = scaledTime;
      
      // 重新计算情绪曲线
      emotionCurve.length = 0;
      shots.forEach(s => {
        emotionCurve.push({
          time: parseInt(s.timeRangeAbsolute.split('-')[0]),
          tension: s.tension
        });
      });
      emotionCurve.push({ time: currentTime, tension: 20 });
    }
    
    // v5.1-Peng: 叙事节奏动态调速
    this._applyRhythmControl(shots, videoType, emotionCurve);
    
    // 时长缩放后，为每个shot添加对白
    const allDialogues = this.extractDialogueData(universe);
    shots.forEach(shot => {
      shot.dialogues = allDialogues.filter(d => d.shot_id === shot.id || d.shotIndex === parseInt(shot.id.replace('S', '')) - 1);
      shot.dialogue = shot.dialogues.length > 0 ? shot.dialogues[0].text : null;
      shot.dialogueSpeaker = shot.dialogues.length > 0 ? shot.dialogues[0].character : null;
    });
    
    return {
      title: metadata.title || '未命名故事',
      logline: metadata.concept || metadata.source || '从 Universe 提取',
      duration_estimate: currentTime,
      structure: plot.framework || 'three_act',
      acts: acts.map(a => ({
        number: a.number,
        purpose: a.purpose,
        scene_count: a.beats?.reduce((sum, b) => sum + (b.scenes?.length || 0), 0) || 0
      })),
      scenes: scenes.map(s => ({
        id: s.sceneId,
        slugline: s.slugLine,
        purpose: s.purpose,
        emotional_arc: s.emotionalTone,
        characters: s.characters,
        shots: (s.shots || []).map(sh => ({
          shotId: sh.shotId,
          type: sh.type,
          duration: sh.duration,
          description: sh.description,
          cameraDirection: sh.cameraDirection,
          lighting: sh.lighting
        }))
      })),
      shots,
      emotionCurve,
      characterTimeline: charTimeline,
      totalDuration: currentTime,
      totalShots: shots.length,
      segments: acts.length || 4,
      styleManifesto: universe.world?.visual_style?.style || '写实风格',
      lightingThreeLayer: universe.world?.visual_style?.lighting || '自然光+补光+轮廓光',
      videoType: metadata.videoType || 'action',
      // v5.1-Peng: 文化情绪上下文
      culturalContext: {
        culture: cultureKey,
        style: cultureProfile.style,
        name: cultureProfile.name,
        expression: cultureProfile.expression
      },
      // v5.1-Peng: AI叙事完整性校验
      narrativeValidation: this._validateNarrative(shots, metadata, emotionCurve)
    };
  }

  /**
   * AI叙事完整性校验
   */
  _validateNarrative(shots, metadata, emotionCurve) {
    const errors = [];
    const warnings = [];
    const info = [];
    
    // 1. 结构完整性：起承转合四幕齐全
    const acts = [...new Set(shots.map(s => s.act))];
    const requiredActs = ['起', '承', '转', '合'];
    const missingActs = requiredActs.filter(a => !acts.includes(a));
    if (missingActs.length > 0) {
      errors.push(`结构缺失：缺少${missingActs.join('、')}幕`);
    } else {
      info.push('✅ 四幕结构完整');
    }
    
    // 2. 角色弧线：每个主要角色有首次出现
    const allChars = [...new Set(shots.flatMap(s => s.characters || []))];
    const charsWithFirstAppearance = new Set();
    shots.forEach((shot, idx) => {
      (shot.characters || []).forEach(char => {
        if (!charsWithFirstAppearance.has(char)) {
          charsWithFirstAppearance.add(char);
          info.push(`角色"${char}"首次出现在${shot.id}(${shot.act}幕)`);
        }
      });
    });
    
    // 3. 情绪曲线：有起伏，不是一条直线
    if (emotionCurve && emotionCurve.length > 2) {
      const tensions = emotionCurve.map(p => p.tension);
      const maxTension = Math.max(...tensions);
      const minTension = Math.min(...tensions);
      const tensionRange = maxTension - minTension;
      
      if (tensionRange < 20) {
        warnings.push(`情绪曲线过于平坦(范围${tensionRange})，建议增加起伏`);
      } else {
        info.push(`✅ 情绪曲线起伏正常(范围${tensionRange})`);
      }
      
      // 检查是否有高潮(>80)
      const hasClimax = tensions.some(t => t >= 80);
      if (!hasClimax) {
        warnings.push('未检测到高潮时刻(张力≥80)，故事可能缺乏高潮');
      } else {
        info.push('✅ 检测到高潮时刻');
      }
    }
    
    // 4. 镜头覆盖：总时长符合预期
    const targetDuration = metadata.duration || 0;
    const actualDuration = shots.reduce((sum, s) => sum + (s.duration || 0), 0);
    if (targetDuration > 0 && Math.abs(actualDuration - targetDuration) > 5) {
      warnings.push(`时长偏差：目标${targetDuration}s，实际${actualDuration}s`);
    } else {
      info.push(`✅ 时长合理(${actualDuration}s)`);
    }
    
    // 5. 镜头数量检查
    if (shots.length < 3) {
      warnings.push(`镜头数量过少(${shots.length})，建议至少3个镜头`);
    } else if (shots.length > 50) {
      warnings.push(`镜头数量过多(${shots.length})，可能影响节奏`);
    } else {
      info.push(`✅ 镜头数量合理(${shots.length})`);
    }
    
    // 6. 转场检查
    const transitions = shots.filter(s => s.transitionTo).length;
    if (transitions < shots.length - 1) {
      warnings.push(`转场缺失：${shots.length - 1 - transitions}个镜头缺少转场`);
    }
    
    // 7. 情感声学映射检查（第6项集成）
    const hasEmotionAcoustics = shots.some(s => s.emotionStart);
    if (!hasEmotionAcoustics) {
      warnings.push('缺少情绪声学映射数据');
    }
    
    const passed = errors.length === 0;
    
    return {
      passed,
      score: Math.max(0, 100 - errors.length * 20 - warnings.length * 10),
      errors,
      warnings,
      info,
      summary: passed 
        ? `✅ 叙事完整性校验通过(${shots.length}镜头，${actualDuration}s)` 
        : `❌ 叙事完整性校验失败(${errors.length}错误，${warnings.length}警告)`
    };
  }

  /**
   * 叙事节奏动态调速
   * 根据视频类型和情绪曲线动态调整镜头时长
   */
  _applyRhythmControl(shots, videoType, emotionCurve) {
    // 节奏配置：不同视频类型的基础节奏
    const RHYTHM_PROFILES = {
      'action': { basePacing: 0.8, tensionBoost: 1.3, lowTensionCompress: 0.7 },
      'drama': { basePacing: 1.0, tensionBoost: 1.1, lowTensionCompress: 0.9 },
      'documentary': { basePacing: 1.2, tensionBoost: 1.0, lowTensionCompress: 1.0 },
      'educational': { basePacing: 1.0, tensionBoost: 1.0, lowTensionCompress: 1.0 },
      'commercial': { basePacing: 0.7, tensionBoost: 1.2, lowTensionCompress: 0.6 }
    };
    
    const profile = RHYTHM_PROFILES[videoType] || RHYTHM_PROFILES.drama;
    
    let currentTime = 0;
    shots.forEach((shot, idx) => {
      const tension = shot.tension || 50;
      const baseDuration = shot.duration || 5;
      
      // 张力调速：高张力延长，低张力压缩
      let rhythmFactor = profile.basePacing;
      if (tension >= 80) {
        rhythmFactor = profile.tensionBoost;
      } else if (tension <= 30) {
        rhythmFactor = profile.lowTensionCompress;
      }
      
      // 变速边界：时长限制在2-15秒
      const adjustedDuration = Math.max(2, Math.min(15, Math.round(baseDuration * rhythmFactor)));
      
      shot.duration = adjustedDuration;
      shot.timeRange = `${currentTime}-${currentTime + adjustedDuration}s`;
      shot.timeRangeAbsolute = `${currentTime}-${currentTime + adjustedDuration}`;
      shot.rhythm = {
        factor: rhythmFactor,
        originalDuration: baseDuration,
        pacingStyle: tension >= 80 ? 'tension_extended' : tension <= 30 ? 'calm_compressed' : 'normal'
      };
      
      currentTime += adjustedDuration;
    });
    
    // 更新情绪曲线时间
    if (emotionCurve) {
      emotionCurve.length = 0;
      shots.forEach(s => {
        emotionCurve.push({
          time: parseInt(s.timeRangeAbsolute.split('-')[0]),
          tension: s.tension
        });
      });
      emotionCurve.push({ time: currentTime, tension: 20 });
    }
    
    return currentTime;
  }

  /**
   * 解析沉浸式POV系统
   */
  _resolvePOV(shot) {
    const desc = (shot.description || '').toLowerCase();
    const camera = (shot.camera || '').toLowerCase();
    const type = (shot.type || '').toLowerCase();
    const tension = shot.tension || 50;
    
    // POV触发条件
    const isExplicitPOV = /pov|第一人称|主观视角|主观镜头|眼睛|视线/i.test(desc + ' ' + camera);
    const isSubjectiveType = type.includes('主观') || type.includes('pov');
    const isCloseUpAndIntense = /特写|cu|ecu/i.test(camera) && tension >= 70;
    
    const isPOV = isExplicitPOV || isSubjectiveType || isCloseUpAndIntense;
    
    if (!isPOV) return null;
    
    // POV类型
    let povType = 'third_person';
    if (isExplicitPOV || isSubjectiveType) {
      povType = 'first_person';
    } else if (isCloseUpAndIntense) {
      povType = 'immersive_close';
    }
    
    // POV提示词
    const povCues = {
      'first_person': {
        perspective: '第一人称主观视角',
        cameraCue: 'POV镜头，角色双眼所见，视线轻微晃动，眨眼瞬间',
        soundCue: '主观音景，呼吸声放大，心跳低频，外部声音模糊',
        seedancePrompt: 'POV第一人称：观众即角色，所见即所感，视线晃动，眨眼，呼吸声主导'
      },
      'immersive_close': {
        perspective: '沉浸式特写',
        cameraCue: '极近距离，面部细节填满画面，皮肤纹理清晰，瞳孔反射可见',
        soundCue: '近场音频，皮肤摩擦声，衣物窸窣，微表情伴随细微声响',
        seedancePrompt: '沉浸式特写：面部填满画面，毛孔可见，情绪通过微表情直接传递'
      },
      'third_person': {
        perspective: '第三人称近身',
        cameraCue: '过肩镜头，角色肩膀在前景，视线方向引导画面',
        soundCue: '空间音频，前方声音清晰，后方环境音模糊',
        seedancePrompt: '过肩镜头：观众在角色身后，共同注视前方，共情视角'
      }
    };
    
    const cue = povCues[povType] || povCues.third_person;
    
    return {
      enabled: true,
      povType,
      ...cue
    };
  }

  /**
   * 解析视觉隐喻编码
   */
  _resolveVisualMetaphor(shot, cultureProfile) {
    const tension = shot.tension || 50;
    const emotion = shot.emotionStart || '平静';
    const act = shot.act || '起';
    
    // 视觉隐喻库
    const METAPHORS = {
      'water': {
        symbol: '水',
        meanings: {
          '平静': '静水深流，表面波澜不惊，深处暗涌',
          '紧张': '湍急河流，漩涡形成，水位上涨',
          '高潮': '巨浪滔天，浪花粉碎，水墙崩塌',
          '绝望': '深渊之水，黑潮涌动，沉没无底',
          '希望': '雨后溪流，涓涓细流，汇聚成河'
        }
      },
      'fire': {
        symbol: '火',
        meanings: {
          '愤怒': '烈焰燃烧，火舌舔舐，灰烬飞舞',
          '欲望': '烛火摇曳，飞蛾扑火，引火自焚',
          '毁灭': '大火吞噬，建筑崩塌，火光冲天',
          '温暖': '壁炉余烬，火星微光，温暖包围',
          '净化': '凤凰涅槃，浴火重生，灰烬中崛起'
        }
      },
      'mirror': {
        symbol: '镜子',
        meanings: {
          '自我': '镜中倒影，真假难辨，自我对话',
          '破碎': '镜面碎裂，碎片散落，映像分裂',
          '模糊': '雾气镜面，轮廓模糊，身份不明',
          '多面': '万花筒镜，多重人格，无限反射'
        }
      },
      'light': {
        symbol: '光影',
        meanings: {
          '希望': '光穿透云层，光束倾泻，驱散黑暗',
          '绝望': '阴影蔓延，光芒熄灭，堕入黑暗',
          '真相': '聚光灯下，真相大白，无处遁形',
          '秘密': '明暗交界，半脸阴影，隐藏秘密'
        }
      },
      'maze': {
        symbol: '迷宫',
        meanings: {
          '困境': '死胡同，四面高墙，无路可逃',
          '循环': '原地打转，回到起点，无限循环',
          '出口': '远处光亮，迷宫尽头，一线希望'
        }
      }
    };
    
    // 根据情绪和张力选择隐喻（情绪优先于张力）
    let metaphorKey = 'water';
    let meaningKey = '平静';
    
    if (['绝望', '恐惧'].includes(emotion)) {
      metaphorKey = 'water';
      meaningKey = '绝望';
    } else if (['愤怒', '爆发'].includes(emotion)) {
      metaphorKey = 'fire';
      meaningKey = '愤怒';
    } else if (['希望', '喜悦'].includes(emotion)) {
      metaphorKey = 'light';
      meaningKey = '希望';
    } else if (tension >= 60) {
      metaphorKey = 'mirror';
      meaningKey = '破碎';
    } else if (tension <= 30 && act === '合') {
      metaphorKey = 'maze';
      meaningKey = '出口';
    }
    
    const metaphor = METAPHORS[metaphorKey];
    const meaning = metaphor.meanings[meaningKey] || metaphor.meanings[Object.keys(metaphor.meanings)[0]];
    
    // 文化适配
    let culturalAdaptation = '';
    if (cultureProfile?.style === 'eastern') {
      culturalAdaptation = '东方留白：隐喻若隐若现，点到为止';
    } else if (cultureProfile?.style === 'western') {
      culturalAdaptation = '西方直接：隐喻鲜明直白，视觉冲击';
    } else if (cultureProfile?.style === 'middle_eastern') {
      culturalAdaptation = '中东象征：隐喻承载宿命与仪式感';
    }
    
    return {
      symbol: metaphor.symbol,
      meaning: meaningKey,
      description: meaning,
      culturalAdaptation,
      seedanceCue: `视觉隐喻：${metaphor.symbol}象征${meaningKey} — ${meaning}`
    };
  }

  /**
   * 解析心理时间感知类型
   */
  _resolveTimePerception(shot) {
    const tension = shot.tension || 50;
    const camera = shot.camera || '';
    const act = shot.act || '起';
    
    // 镜头距离判定
    const isCloseUp = /特写|close up|cu|ecu|微距/i.test(camera);
    const isLongShot = /全景|远景|long shot|ls/i.test(camera);
    
    // 时间感知类型
    let type = 'normal';
    let description = '正常流速';
    let seedanceCue = '';
    
    if (tension >= 75 && isCloseUp) {
      type = 'dilation';
      description = '时间膨胀 — 主观时间变慢';
      seedanceCue = '极慢动作，逐帧细节，水滴悬浮，发丝飘动清晰可见';
    } else if (tension >= 70 && act === '转') {
      type = 'freeze';
      description = '时间冻结 — 高潮凝固';
      seedanceCue = '瞬间静止，画面定格，尘埃停在半空，表情凝固';
    } else if (tension <= 25 && isLongShot) {
      type = 'compression';
      description = '时间压缩 — 主观时间加速';
      seedanceCue = '快速剪辑感，车流如光带，云影飞逝，时光流逝';
    } else if (act === '承' && tension >= 50 && tension <= 70) {
      type = 'loop';
      description = '时间循环 — 重复与梦境感';
      seedanceCue = '循环往复，似曾相识，画面轻微重复，deja vu质感';
    }
    
    return { type, description, seedanceCue, tension, camera };
  }

  /**
   * 根据张力和幕位置解析文化修饰符
   */
  _resolveCulturalModifier(profile, tension, actName) {
    const { modifiers } = profile;
    if (!modifiers || Object.keys(modifiers).length === 0) return '';
    
    // 根据张力水平和幕位置选择修饰符
    if (tension >= 85 && actName === '转') {
      return modifiers.climax || '';
    } else if (tension >= 70) {
      return modifiers.highTension || '';
    } else if (tension <= 30 && actName === '合') {
      return modifiers.resolution || '';
    } else if (tension <= 30) {
      return modifiers.lowTension || '';
    }
    
    return '';
  }

  /**
   * 解析多角色情绪叠加
   */
  _resolveMultiCharacterEmotion(shot, cultureProfile) {
    const chars = shot.characters || [];
    if (chars.length < 2) return null;
    
    const emotion = shot.emotionStart || '平静';
    const tension = shot.tension || 50;
    
    // 情绪冲突类型判定
    const conflictTypes = {
      '对抗型': ['愤怒', '紧张', '爆发'],
      '共鸣型': ['喜悦', '平静', '希望'],
      '反差型': ['悲伤', '喜悦', '平静', '愤怒'],
      '压制型': ['坚定', '恐惧', '绝望']
    };
    
    let conflictType = '共鸣型';
    const highTension = tension >= 70;
    const lowTension = tension <= 30;
    
    if (highTension && ['愤怒', '紧张', '爆发'].includes(emotion)) {
      conflictType = '对抗型';
    } else if (lowTension && ['悲伤', '绝望'].includes(emotion)) {
      conflictType = '反差型';
    } else if (['坚定', '恐惧'].includes(emotion)) {
      conflictType = '压制型';
    }
    
    // 根据文化背景生成交互提示词
    const interactionCues = {
      'eastern': {
        '对抗型': '眼神对峙，微微前倾，呼吸同步加速',
        '共鸣型': '肩并肩站立，目光同向，默契无言',
        '反差型': '一人前景一人背景，动作相反，视线不交汇',
        '压制型': '居高临下与低头回避，空间层次明显'
      },
      'western': {
        '对抗型': '面对面逼近，手指指向对方，怒吼对峙',
        '共鸣型': '拥抱击掌，相视大笑，同步动作',
        '反差型': '一人背对镜头痛哭，一人面向镜头狂笑',
        '压制型': '强势角色逼近，弱势角色后退跌坐'
      },
      'middle_eastern': {
        '对抗型': '双手摊开对峙，低声念诵，目光如炬',
        '共鸣型': '并肩跪拜，同声祈祷，面向同一方向',
        '反差型': '一人面向麦加祈祷，一人背对闭目',
        '压制型': '长者站立俯视，晚辈跪地额头触地'
      },
      'neutral': {
        '对抗型': '双方对峙，眼神交锋',
        '共鸣型': '并排站立，同步动作',
        '反差型': '一前一后，动作相反',
        '压制型': '一高一低，空间压迫'
      }
    };
    
    const culture = cultureProfile?.style || 'neutral';
    const cue = interactionCues[culture]?.[conflictType] || interactionCues.neutral[conflictType];
    
    return {
      characterCount: chars.length,
      primaryEmotion: emotion,
      tension,
      conflictType,
      interactionCue: cue,
      characters: chars,
      seedancePrompt: `多角色${conflictType}：${chars.join('与')}，${cue}`
    };
  }

  extractCharacterSpecs(universe) {
    const chars = universe.characters || {};
    const entries = Array.isArray(chars)
      ? chars.map((c, i) => [c.id || c.characterId || String(i), c])
      : Object.entries(chars);
    
    return entries.map(([id, char]) => ({
      id,
      name: char.name || id,
      role: char.role || 'protagonist',
      appearance: char.appearance || char.exterior?.appearance || char.personality?.coreDesire || '未指定',
      visual_notes: char.visual || char.exterior?.style || '',
      voice_notes: char.voice || char.voice?.pattern || ''
    }));
  }

  extractShotSuggestions(universe) {
    // 优先使用 cinematography.shotPlan（ScreenplayCraft字段）
    const cinematography = universe.cinematography || {};
    const shotPlan = cinematography.shotPlan || [];
    
    if (shotPlan.length > 0) {
      // 使用ScreenplayCraft的镜头预规划
      return shotPlan.map(shot => ({
        scene_id: shot.shotId,
        slugline: shot.slugline || '',
        shot_type: shot.type || this.inferShotTypeFromCamera(shot.camera),
        lighting: shot.lighting || '未指定',
        color_palette: shot.colorPalette || universe.world?.visual_style?.color_palette || ['中性'],
        mood: shot.mood || '中性',
        camera_notes: `${shot.camera?.shotSize || ''} ${shot.camera?.movement || ''}`.trim(),
        duration: shot.duration,
        transition: shot.transition,
        tension: shot.tension,
        isSpectacle: shot.isSpectacle || false
      }));
    }
    
    // 回退：从scenes推断
    return Object.entries(universe.scenes || {}).map(([id, scene]) => ({
      scene_id: id,
      slugline: scene.slugline,
      shot_type: this.inferShotType(scene),
      lighting: this.inferLighting(scene),
      color_palette: universe.world?.visual_style?.color_palette || ['中性'],
      mood: this.inferMood(scene),
      camera_notes: scene.visual_notes || ''
    }));
  }

  extractDialogueData(universe) {
    const dialogues = [];
    const dialogueScript = universe.dialogues?.dialogueScript || [];
    const scenes = universe.scenes || {};
    
    dialogueScript.forEach(sceneDialogue => {
      const sceneId = sceneDialogue.sceneId;
      const scene = scenes[sceneId];
      const sceneShots = scene?.shots || [];
      
      sceneDialogue.lines.forEach((line, idx) => {
        // 映射到对应的 shot（通过 shotIndex 或轮询分配）
        const shotIdx = line.shotIndex !== undefined ? line.shotIndex : (idx % Math.max(1, sceneShots.length));
        const shot = sceneShots[shotIdx];
        
        dialogues.push({
          scene_id: sceneId,
          shot_id: shot?.shotId || `${sceneId}-S${shotIdx + 1}`,
          shotIndex: shotIdx,
          character: line.speaker?.split('-')[1] || line.speaker,
          characterId: line.speaker?.split('-')[0] || 'C01',
          text: line.text,
          subtext: line.subText || line.subtext,
          function: this.inferDialogueFunction(line.emotion),
          emotion: line.emotion,
          duration: line.duration || 2
        });
      });
    });
    
    return dialogues;
  }

  inferDialogueFunction(emotion) {
    const e = (emotion || '').toLowerCase();
    if (e.includes('愤怒') || e.includes('争吵')) return '冲突推进';
    if (e.includes('温柔') || e.includes('关怀')) return '情感建立';
    if (e.includes('恐惧') || e.includes('紧张')) return '悬念构建';
    if (e.includes('决心') || e.includes('坚定')) return '决策宣告';
    if (e.includes('悲伤') || e.includes('失落')) return '内心揭示';
    if (e.includes('喜悦') || e.includes(' relief')) return '压力释放';
    return '信息传递';
  }

  extractSoundDesign(universe) {
    return Object.entries(universe.scenes || {}).map(([id, scene]) => ({
      scene_id: id,
      ambient: scene.audio_notes || '环境音',
      music_mood: this.inferMusicMood(scene.emotional_arc),
      intensity: this.calculateIntensity(scene)
    }));
  }

  // 推断方法
  inferShotType(scene) {
    if (scene.characters?.length === 1) return 'close_up';
    if (scene.characters?.length > 2) return 'wide_shot';
    return 'medium_shot';
  }

  inferLighting(scene) {
    const slug = scene.slugline || '';
    if (slug.includes('夜')) return '低key';
    if (slug.includes('外')) return '自然光';
    return '中性光';
  }

  inferMood(scene) {
    const arc = scene.emotional_arc || '';
    if (arc.includes('冷')) return '疏离';
    if (arc.includes('热')) return '紧张';
    return '中性';
  }

  inferEmotion(subtext) {
    if (!subtext) return 'neutral';
    if (subtext.includes('觉醒')) return '觉醒';
    if (subtext.includes('恐惧')) return '恐惧';
    return '复杂';
  }

  inferMusicMood(arc) {
    if (!arc) return '中性';
    if (arc.includes('冷')) return '极简';
    if (arc.includes('热')) return '紧张';
    return '叙事';
  }

  calculateIntensity(scene) {
    const arc = scene.emotional_arc || '';
    if (arc.includes('沸')) return 1.0;
    if (arc.includes('热')) return 0.8;
    if (arc.includes('温')) return 0.5;
    return 0.3;
  }

  calculateDuration(scenes) {
    return Object.keys(scenes).length * 2; // 平均每场景2分钟
  }
}

module.exports = { VideoViewRenderer };