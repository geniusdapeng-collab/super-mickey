/**
 * Director Adapter v3.6-Peng
 * 将 Story Universe 转换为现有导演系统需要的输入格式
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const { StoryUniverse } = require('../universe/universe-model.js');
const { VideoViewRenderer } = require('./video-renderer.js');

class DirectorAdapter {
  constructor() {
    this.renderer = new VideoViewRenderer();
  }

  adapt(universePath) {
    // 加载 Universe
    const universe = StoryUniverse.fromJSON(
      require('fs').readFileSync(universePath, 'utf8')
    );

    // 验证
    const errors = universe.validate();
    if (errors.length > 0) {
      throw new Error(`Universe validation failed: ${errors.join(', ')}`);
    }

    // 渲染视频视图
    const videoView = this.renderer.render(universe.data);

    // 转换为现有导演系统的文件格式
    return {
      // 01-story-plan.json
      storyPlan: this.toStoryPlan(videoView.story_plan),
      
      // 02-characters.json  
      characters: this.toCharacters(videoView.character_specs),
      
      // 03-shot-suggestions.json
      shotSuggestions: this.toShotSuggestions(videoView.shot_suggestions),
      
      // 04-dialogues.json
      dialogues: this.toDialogues(videoView.dialogue_data),
      
      // 05-sound-design.json
      soundDesign: this.toSoundDesign(videoView.sound_design),
      
      // 06-visual-language.json
      visualLanguage: videoView.visual_language
    };
  }

  toStoryPlan(plan) {
    // video-renderer.js 现在直接生成完整的 shots 数据
    // 直接使用，无需重新生成
    const shots = plan.shots || [];
    const emotionCurve = plan.emotionCurve || [];
    const characterTimeline = plan.characterTimeline || [];
    
    // 如果shots为空，回退到从scenes生成（兼容旧格式）
    if (shots.length === 0) {
      return this.fallbackStoryPlan(plan);
    }
    
    return {
      title: plan.title || '未命名作品',
      totalDuration: plan.totalDuration || 0,
      totalShots: plan.totalShots || shots.length,
      segments: plan.segments || 4,
      styleManifesto: plan.styleManifesto || plan.visualManifesto || '写实风格',
      lightingThreeLayer: plan.lightingThreeLayer || plan.lighting || '自然光+补光+轮廓光',
      videoType: plan.videoType || 'action',
      outline: plan.logline || plan.outline || '',
      characters: plan.characters || [],
      shots,
      emotionCurve,
      characterTimeline,
      // v5.1-Peng: 传递非线性节拍信息
      nonlinearBeats: plan.nonlinearBeats || [],
      nonlinearEngineVersion: plan.nonlinearEngineVersion || 'v5.1-Peng',
      // v5.1-Peng: 传递文化情绪上下文
      culturalContext: plan.culturalContext || null,
      // v5.1-Peng: 传递叙事完整性校验
      narrativeValidation: plan.narrativeValidation || null
    };
  }

  fallbackStoryPlan(plan) {
    // 兼容旧格式：从 scenes 重新生成 shots
    const scenes = plan.scenes || [];
    const shots = [];
    let currentTime = 0;
    
    scenes.forEach((scene) => {
      const sceneShots = scene.shots || [{ type: '建置', duration: 8 }];
      sceneShots.forEach((shot, shotIdx) => {
        const duration = shot.duration || 8;
        const id = `S${String(shots.length + 1).padStart(2, '0')}`;
        shots.push({
          id,
          act: scene.act || '起',
          actIndex: scene.actIndex || 1,
          duration,
          timeRange: `${currentTime}-${currentTime + duration}s`,
          timeRangeAbsolute: `${currentTime}-${currentTime + duration}`,
          type: shot.type || '建置',
          description: shot.description || scene.description || `${scene.purpose || '场景内容'}`,
          characters: scene.characters || [],
          emotionStart: shot.emotionStart || '平静',
          emotionEnd: shot.emotionEnd || '平静',
          tension: shot.tension || 50,
          camera: shot.camera || '中景固定',
          handoff: shot.handoff || '硬切',
          handoffType: shot.handoffType || '动作冻结',
          notes: shot.notes || '',
          transitionTo: shot.transitionTo || null,
          transitionType: shot.transitionType || 'cut',
          transitionDuration: shot.transitionDuration || 0.5,
          multiCharacterEmotion: shot.multiCharacterEmotion || null,
          timePerception: shot.timePerception || null,
          visualMetaphor: shot.visualMetaphor || null,
          pov: shot.pov || null // v5.1-Peng: 沉浸式POV
        });
        currentTime += duration;
      });
    });
    
    // 转场信息
    for (let i = 0; i < shots.length - 1; i++) {
      if (!shots[i].transitionTo) {
        shots[i].transitionTo = shots[i + 1].id;
        shots[i].transitionType = 'cut';
        shots[i].transitionDuration = 0.5;
      }
    }
    
    // 情绪曲线
    const emotionCurve = shots.map(s => ({
      time: parseInt(s.timeRangeAbsolute.split('-')[0]),
      tension: s.tension
    }));
    emotionCurve.push({ time: currentTime, tension: 20 });
    
    return {
      title: plan.title || '未命名作品',
      totalDuration: currentTime,
      totalShots: shots.length,
      segments: plan.acts?.length || 4,
      styleManifesto: plan.visualManifesto || plan.style || '写实风格',
      lightingThreeLayer: plan.lighting || '自然光+补光+轮廓光',
      videoType: plan.videoType || 'action',
      outline: plan.logline || plan.outline || '',
      characters: plan.characters || [],
      shots,
      emotionCurve,
      characterTimeline: this.generateCharacterTimeline(shots, plan.characters || []),
      // v5.1-Peng: 传递叙事完整性校验
      narrativeValidation: plan.narrativeValidation || null
    };
  }generateCharacterTimeline(shots, characters) {
    const timeline = [];
    const charSet = new Set();
    
    shots.forEach(shot => {
      (shot.characters || []).forEach(char => {
        if (!charSet.has(char)) {
          charSet.add(char);
          timeline.push({
            character: char,
            firstAppearance: shot.id,
            firstAct: shot.act,
            firstTime: shot.timeRange
          });
        }
      });
    });
    
    return timeline;
  }

  toCharacters(specs) {
    return specs.map(char => ({
      id: char.id,
      name: char.name,
      appearance: char.appearance,
      visual: char.visual_notes,
      voice: char.voice_notes
    }));
  }

  toShotSuggestions(shots) {
    return shots.map(shot => ({
      scene: shot.scene_id,
      shot_type: shot.shot_type,
      lighting: shot.lighting,
      color: shot.color_palette?.[0] || '中性',
      mood: shot.mood,
      camera: shot.camera_notes
    }));
  }

  toDialogues(dialogues) {
    return dialogues.map(d => ({
      scene: d.scene_id,
      character: d.character,
      text: d.text,
      subtext: d.subtext,
      function: d.function,
      emotion: d.emotion
    }));
  }

  toSoundDesign(sounds) {
    return sounds.map(s => ({
      scene: s.scene_id,
      ambient: s.ambient,
      music: s.music_mood,
      intensity: s.intensity
    }));
  }

  // 从 VideoView 直接生成文件（v3.6-Peng：支持ScreenplayCraft字段）
  generateFilesFromView(videoView, outputDir) {
    const adapted = {
      storyPlan: this.toStoryPlan(videoView.story_plan || {}),
      characters: this.toCharacters(videoView.character_specs || []),
      shotSuggestions: this.toShotSuggestions(videoView.shot_suggestions || []),
      dialogues: this.toDialogues(videoView.dialogue_data || []),
      soundDesign: this.toSoundDesign(videoView.sound_design || []),
      visualLanguage: videoView.visual_language || {}
    };

    // 确保目录存在
    if (!fss.existsSync(outputDir)) {
      fss.mkdirSync(outputDir, { recursive: true });
    }

    // 写入各个文件
    fss.writeFileSync(
      path.join(outputDir, '01-story-plan.json'),
      JSON.stringify(adapted.storyPlan, null, 2)
    );
    fss.writeFileSync(
      path.join(outputDir, '02-characters.json'),
      JSON.stringify(adapted.characters, null, 2)
    );
    fss.writeFileSync(
      path.join(outputDir, '03-shot-suggestions.json'),
      JSON.stringify(adapted.shotSuggestions, null, 2)
    );
    fss.writeFileSync(
      path.join(outputDir, '04-dialogues.json'),
      JSON.stringify(adapted.dialogues, null, 2)
    );
    fss.writeFileSync(
      path.join(outputDir, '05-sound-design.json'),
      JSON.stringify(adapted.soundDesign, null, 2)
    );
    fss.writeFileSync(
      path.join(outputDir, '06-visual-language.json'),
      JSON.stringify(adapted.visualLanguage, null, 2)
    );

    console.log(`✅ Director Adapter: 已生成6个对接文件到 ${outputDir}`);
    return adapted;
  }
}

module.exports = { DirectorAdapter };