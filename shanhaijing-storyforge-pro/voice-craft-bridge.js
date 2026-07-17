/**
 * VoiceCraft Bridge v1.0-Peng
 * StoryForge Pro ↔ VoiceCraft 融合接口
 */
const VoiceCraft = require('../shanhaijing-voice-craft/voice-craft.js');

class VoiceCraftBridge {
  constructor(dataDir = './voice-craft-data', storyforgeDataDir) {
    this.vc = new VoiceCraft(dataDir);
    this.storyforgeDataDir = storyforgeDataDir;
  }

  /**
   * Step 3.5: 在角色锻造后注入声纹提取
   * 输入: characters[] 来自 character-forge
   * 输出: voice-signatures 注入 voice-state.json
   */
  async forgeVoiceSignatures(characters) {
    console.log('🔊 [VoiceCraftBridge] 为角色铸造声纹...');

    // v5.1-Peng: 防御式编程，确保characters是数组
    const charArray = Array.isArray(characters) ? characters : 
                      (characters && Array.isArray(characters.characters)) ? characters.characters :
                      (characters ? [characters] : []);

    const signatures = {};

    for (const char of charArray) {
      const characterId = char.id || char.characterId;
      
      // 将character-forge格式转换为VoiceMiner期望的personaData格式
      const personaData = {
        name: char.name || characterId,
        wound: char.wound || {
          surface: char.backstory?.wound || char.personality?.coreFear || '未定义的创伤',
          structure: {
            coreLie: char.personality?.lieTheyBelieve || char.backstory?.coreLie || '我很强大',
            coreNeed: char.personality?.truthTheyNeed || char.backstory?.coreNeed || '被理解'
          },
          existential: char.backstory?.existential || '存在本身缺乏根基'
        },
        breathing: char.breathing || {
          pace: char.backstory?.breathing?.pace || '正常',
          volume: char.backstory?.breathing?.volume || '中等',
          silencePattern: char.backstory?.breathing?.silencePattern || '常规沉默'
        },
        role: char.role || 'protagonist'
      };

      try {
        const sig = await this.vc.mine({
          characterId,
          personaData
        });
        signatures[characterId] = sig;
      } catch (err) {
        console.warn(`  ⚠️ 声纹提取失败 ${characterId}: ${err.message}`);
      }
    }

    console.log(`✅ 声纹铸造完成: ${Object.keys(signatures).length} 个角色`);
    return signatures;
  }

  /**
   * Step 5.5: 在场景大纲完成后铺设潜台词和对白
   * 输入: scenes[] 来自 scene-writer, signatures 来自 forgeVoiceSignatures
   * 输出: dialogue-complete 注入 voice-state.json
   */
  async enhanceScenes(scenes, characters, options = {}) {
    console.log('🎙️ [VoiceCraftBridge] 为场景注入声音...');

    // 构建角色ID到personaData的映射
    const personaData = {};
    for (const char of characters) {
      const id = char.id || char.characterId;
      if (id) {
        personaData[id] = {
          name: char.name,
          wound: char.wound || {
            surface: char.backstory?.wound || char.personality?.coreFear || '',
            structure: {
              coreLie: char.personality?.lieTheyBelieve || '',
              coreNeed: char.personality?.truthTheyNeed || ''
            }
          },
          breathing: char.breathing || {
            pace: '正常',
            volume: '中等',
            silencePattern: '常规沉默'
          }
        };
      }
    }

    const results = [];
    
    // 兼容 scenes 是数组或 {scenes: [...]} 对象的情况
    const scenesList = Array.isArray(scenes) ? scenes : (scenes.scenes || []);

    for (const scene of scenesList) {
      const sceneId = scene.sceneId || scene.id;
      if (!sceneId) continue;

      // 解析场景中的角色
      let charsInScene = scene.characters || scene.actors || [];
      
      // 如果characters是字符串数组（角色名），映射为ID
      if (charsInScene.length === 0 && characters.length > 0) {
        charsInScene = characters.map(c => c.id || c.characterId);
      }

      try {
        // 1. 铺设潜台词
        await this.vc.subtext({
          sceneId,
          sceneContext: {
            setting: scene.setting || scene.description || '',
            emotionalState: scene.emotionalState || {},
            sceneGoal: scene.goal || scene.purpose || ''
          },
          characters: charsInScene,
          personaData
        });

        // 2. 锻造对白
        const draft = await this.vc.forge({
          sceneId,
          sceneRequirements: {
            dialogueCount: options.dialogueCount || 6,
            totalDuration: scene.duration || 45,
            keyMoments: scene.keyMoments || []
          }
        });

        // 3. 失控检测
        const control = await this.vc.loseControl({
          sceneId,
          sceneIntensity: scene.intensity || 0.8,
          characterWounds: options.characterWounds || {}
        });

        // 4. 沉默设计
        const silence = await this.vc.silence({
          sceneId,
          sceneEmotionCurve: scene.emotionCurve || []
        });

        // 5. 声音校验
        const report = await this.vc.guard({ sceneId });

        results.push({
          sceneId,
          segments: draft.dialogueSegments?.length || 0,
          controlMoments: control?.controlMoments?.length || 0,
          silences: silence?.silenceDesign?.length || 0,
          consistencyScore: report?.overallScore || 0
        });
      } catch (err) {
        console.warn(`  ⚠️ 场景 ${sceneId} 声音注入失败: ${err.message}`);
        results.push({ sceneId, error: err.message });
      }
    }

    console.log(`✅ 声音注入完成: ${results.filter(r => !r.error).length}/${results.length} 个场景`);
    return results;
  }

  /**
   * Step 9.5: 生成声音报告
   */
  generateReport(episode, format) {
    format = format || 'md';
    const scenes = episode.scenes || [];
    let report = `# Episode 声音报告\n\n`;

    for (const scene of scenes) {
      const sceneId = scene.sceneId || scene.id;
      const exported = this.vc.export({ sceneId, format });
      if (exported.markdown) {
        report += `---\n${exported.markdown}\n`;
      }
    }

    return report;
  }

  /**
   * 获取场景的完整对白（供 seedance-adapter 使用）
   */
  getDialogueForScene(sceneId) {
    const state = this.vc.state({ sceneId });
    return state.dialogue?.complete || state.dialogue?.final || state.dialogue?.draft;
  }

  /**
   * 获取场景的 seedanceCue 列表（供视频生成使用）
   */
  getSeedanceCues(sceneId) {
    const dialogue = this.getDialogueForScene(sceneId);
    if (!dialogue?.dialogueSegments) return [];

    return dialogue.dialogueSegments
      .filter(seg => seg.seedanceCue)
      .map(seg => ({
        segmentId: seg.segmentId,
        cue: seg.seedanceCue,
        duration: seg.duration,
        type: seg.type || 'dialogue'
      }));
  }

  /**
   * 获取场景的潜台词（供导演参考）
   */
  getSubtextForScene(sceneId) {
    return this.vc.state({ sceneId }).subtext;
  }
}

module.exports = VoiceCraftBridge;