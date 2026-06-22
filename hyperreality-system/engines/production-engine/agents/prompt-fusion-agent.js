/**
 * PromptFusionAgent - Prompt融合Agent（核心）
 * 负责: 将L3-L7元素创造性融合成导演分镜脚本
 * 策略: L1/L2/L9硬约束走规则，L3-L7走LLM融合
 * v2.1.4-fix8: LLM输出标准字段格式（【约束】【基础】【场景】等）
 */
const { BaseAgent } = require('./base-agent');

class PromptFusionAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'PromptFusionAgent', enabled: true, llmTimeout: 600000, ...options });
    this.maxPromptLength = options.maxPromptLength || 1500;
    this.concurrency = options.concurrency || 3;
  }

  _getSystemPrompt() {
    return `你是一位资深电影导演和摄影师。根据镜头信息，为每个镜头生成结构化的导演分镜提示词。

【核心要求】
你必须按以下标准字段格式输出，每个字段独立清晰，不要混合成一段narrative文本：

字段列表（严格按此顺序）：
1. 【约束】：画幅、帧率、禁止项（16:9 cinematic, no text, no subtitle, no watermark, 24fps cinematic）
2. 【基础】：画质基础词（hyperrealistic, ultra-detailed, high dynamic range, film grain, 35mm texture, cinematic film）
3. 【场景】：具体场景环境描述（地点、时间、空间深度、材质细节）
4. 【角色】：角色身份、服装、姿态（如：穿警服的陈卓女士，健康科普主讲人）
5. 【动作】：角色动作与镜头运动（如：镜头缓慢推近，陈卓伸手触碰墙面）
6. 【定妆照】：角色定妆照引用路径（如：image://characters/chen-zhuo/portraits/chen-zhuo-front.png）
7. 【台词】：角色直接说的话，格式：【台词】"纯台词内容"（不要写"画外音""旁白"）
8. 【时间轴】：镜头时间区间（如：T00:00-T00:10）
9. 【情绪】：3-5个关键词描述情绪氛围
10. 【音频】：环境音效、背景音乐描述
11. 【负面约束】：排除项（no watermark, no logo, no cartoon style, no flat lighting等）
12. 【角色一致性】：保持角色形象一致

输出JSON格式:
{
  "shots": [
    {
      "shotId": "SC01",
      "fields": {
        "constraint": "16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic",
        "baseline": "hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film",
        "scene": "场景环境描述",
        "character": "角色描述",
        "action": "动作与运镜描述",
        "portraits": "定妆照引用",
        "dialogue": "【台词】\"纯台词内容\"",
        "timeline": "时间轴",
        "mood": "情绪关键词",
        "audio": "音频描述",
        "negative": "负面约束列表",
        "consistency": "角色一致性约束"
      }
    }
  ]
}

关键要求：
1. 【台词】字段必须独立，角色直接对镜头说话，不要写"画外音""旁白"
2. 场景要具体真实（门诊室、宣教室、检查室），必须是写实环境，禁止科幻/抽象元素
3. 禁止词汇：全息、虚拟、投影、抽象、光影场域、数据空间、元宇宙、时间操控、霓虹、微观世界、宏观、抽象几何、流动光影、交织光影、色彩对冲
4. 不要混合成一段narrative，每个字段独立输出
5. 只描述本集内容，严禁预告后续集数
6. 保持角色视觉锚点一致
7. 负面约束要完整，包含10+条排除项`;
  }

  async process(shots, blueprint) {
    console.log(`[PromptFusionAgent] 开始处理 ${shots.length} 个镜头（并发=${this.concurrency}）`);

    const ratio = blueprint.config?.aspectRatio || '16:9';
    const characters = blueprint.character_system?.characters || [];

    const results = new Array(shots.length);
    let index = 0;
    let failed = 0;

    const worker = async () => {
      while (index < shots.length) {
        const i = index++;
        const shot = shots[i];
        try {
          const fused = await this._fuseSingleShot(shot, ratio, characters);
          results[i] = fused;
        } catch (e) {
          failed++;
          console.warn(`[PromptFusionAgent] 镜头 ${shot.shot_id || i} 融合失败: ${e.message}，规则兜底`);
          results[i] = this._fallbackSingleShot(shot, ratio);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(this.concurrency, shots.length) }, () => worker()));

    if (failed > 0) {
      console.warn(`[PromptFusionAgent] ⚠️ ${failed}/${shots.length} 镜头降级为规则 Prompt`);
    }
    console.log(`[PromptFusionAgent] 完成 ✓ | 降级: ${failed}/${shots.length}`);
    return { shots: results, degraded: failed > 0, degradeReason: null };
  }

  async _fuseSingleShot(shot, ratio, characters) {
    const prompt = this._buildBatchPrompt([shot], ratio, characters);
    const schema = { shots: [{ shotId: shot.shotId, fields: {} }] };

    const llmResult = await this._callLLM(prompt, schema, () => {
      throw new Error('LLM fallback');
    });

    const fusionEntry = llmResult.result?.shots?.find(s => s.shotId === shot.shotId);
    const fields = fusionEntry?.fields || {};
    
    // 组装标准格式Prompt
    const fullPrompt = this._assembleStandardPrompt(shot, fields, ratio);

    return {
      ...shot,
      fields,
      fusionText: fields.scene || '',
      prompt: fullPrompt,
      promptCharCount: this._countChars(fullPrompt),
      degraded: false,
      degradeReason: null
    };
  }

  _fallbackSingleShot(shot, ratio) {
    const fallbackPrompt = this._assembleFullPrompt(shot, '', ratio);
    return {
      ...shot,
      fields: {},
      fusionText: '',
      prompt: fallbackPrompt,
      promptCharCount: this._countChars(fallbackPrompt),
      degraded: true,
      degradeReason: '单镜头 LLM 融合失败，规则兜底',
      _pf_fallback: true
    };
  }

  /**
   * 组装标准格式Prompt（按之前正常版本的字段格式）
   */
  _assembleStandardPrompt(shot, fields, ratio) {
    const parts = [];

    // 【约束】
    parts.push(`【约束】${fields.constraint || `${ratio} cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic`}`);

    // 【基础】
    parts.push(`【基础】${fields.baseline || 'hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film'}`);

    // 【场景】
    // 【v2.1.4-fix9-P5】场景强制写实：禁止科幻/抽象词汇
    let sceneDesc = fields.scene || shot.scene || '';
    const forbiddenWords = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
    const hasForbidden = forbiddenWords.some(w => sceneDesc.includes(w));
    if (hasForbidden) {
      console.warn(`[PromptFusionAgent] ⚠️ 镜头 ${shot.shotId} 场景含禁止词汇: "${sceneDesc.substring(0, 50)}..."，强制替换为写实场景`);
      // 强制替换为写实场景
      const fallbackScenes = [
        '医院健康宣教室，白色荧光灯均匀照明，白墙面贴有骨骼肌解剖图与运动损伤海报，木质讲台表面带有细微使用划痕，地面浅灰色防滑PVC地胶',
        '三甲医院检验科走廊，冷白色LED光源从走廊顶部连续排列向下照射，指示牌清晰指向尿液检验窗口，地面浅色抛光瓷砖，墙面白色医用抗菌涂层',
        '医生诊室，白色墙面悬挂医学挂图，办公桌摆放听诊器与血压计，检查床铺有蓝色一次性床单，无影灯悬于上方，窗光透入',
        '医院健康管理中心，嵌入式LED灯带洒下柔和暖白光，接待台后方排列健康宣传展板，前方皮质沙发与实木茶几，地面灰色哑光瓷砖'
      ];
      const index = parseInt(shot.shotId.replace(/\D/g, '')) || 0;
      sceneDesc = fallbackScenes[index % fallbackScenes.length];
    }
    if (sceneDesc) parts.push(`【场景】${sceneDesc}`);

    // 【角色】
    // 【v2.1.4-fix9-P4】角色服装锁定：强制使用原始角色设定中的服装
    let characterDesc = fields.character || '';
    if (characterDesc && shot.character) {
      // 如果LLM输出的角色描述中没有"警"字，但原始角色设定有，则强制替换
      const originalChar = shot.character || '';
      if (originalChar.includes('警') && !characterDesc.includes('警')) {
        // LLM擅自改了服装，从原始角色描述中提取姓名+服装
        const nameMatch = originalChar.match(/([^,，]+警[^,，]+)/);
        if (nameMatch) {
          characterDesc = characterDesc.replace(/(身着|穿着|身穿|着)[^，]+/, nameMatch[1]);
          // 如果没替换成功，直接在描述开头插入正确服装
          if (!characterDesc.includes('警')) {
            characterDesc = originalChar + '，' + characterDesc;
          }
        }
      }
    }
    if (characterDesc) parts.push(`【角色】${characterDesc}`);

    // 【动作】
    if (fields.action) parts.push(`【动作】${fields.action}`);

    // 【定妆照】
    if (fields.portraits) parts.push(`【定妆照】${fields.portraits}`);

    // 【台词】
    if (fields.dialogue) parts.push(`【台词】${fields.dialogue}`);

    // 【时间轴】
    if (fields.timeline) parts.push(`【时间轴】${fields.timeline}`);

    // 【情绪】
    if (fields.mood) parts.push(`【情绪】${fields.mood}`);

    // 【音频】
    if (fields.audio) parts.push(`【音频】${fields.audio}`);

    // 【负面约束】
    if (fields.negative) parts.push(`【负面约束】${fields.negative}`);

    // 【角色一致性】
    if (fields.consistency) parts.push(`【角色一致性】${fields.consistency}`);

    // 合并
    let fullPrompt = parts.join('，');
    
    // 截断
    if (this._countChars(fullPrompt) > this.maxPromptLength) {
      fullPrompt = this._truncateStandardPrompt(fullPrompt);
    }

    return fullPrompt;
  }

  /**
   * 组装完整Prompt（降级路径，保留原有逻辑）
   */
  _assembleFullPrompt(shot, fusionText, ratio) {
    const parts = [];

    // L1: 约束层
    parts.push(`${ratio} cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic`);

    // L2: 基础层
    parts.push('hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film');

    // L3-L7: 融合段
    if (fusionText) {
      parts.push(fusionText);
    } else {
      parts.push(shot.scene || '');
      if (shot.character && shot.character !== 'NONE') parts.push(shot.character);
      if (shot.action) parts.push(shot.action);
      const pureDialogue = shot.dialogueText || this._extractPureDialogue(shot.dialogue);
      if (pureDialogue && pureDialogue !== '') parts.push(`【台词】"${pureDialogue}"`);
      if (shot.cameraString) parts.push(shot.cameraString);
      if (shot.lightingString) parts.push(shot.lightingString);
      if (shot.mood) parts.push(`mood: ${shot.mood}`);
      if (shot.backgroundSoundString) parts.push(`audio: ${shot.backgroundSoundString}`);
    }

    // L9: 质控层
    parts.push('no voiceover, no narration, no metal_gloss, no unnatural_eye_color');

    let fullPrompt = parts.filter(p => p).join(', ');
    if (this._countChars(fullPrompt) > this.maxPromptLength) {
      fullPrompt = this._truncateWithPriority(fullPrompt, parts);
    }

    return fullPrompt;
  }

  _truncateStandardPrompt(fullPrompt) {
    let prompt = fullPrompt;
    while (this._countChars(prompt) > this.maxPromptLength) {
      const lastComma = prompt.lastIndexOf('，');
      if (lastComma > 0) {
        prompt = prompt.substring(0, lastComma).trim();
      } else {
        break;
      }
    }
    return prompt;
  }

  _truncateWithPriority(fullPrompt, parts) {
    let prompt = fullPrompt;
    while (this._countChars(prompt) > this.maxPromptLength) {
      const lastComma = prompt.lastIndexOf(',');
      if (lastComma > 0) {
        prompt = prompt.substring(0, lastComma).trim();
      } else {
        break;
      }
    }
    return prompt;
  }

  _countChars(str) {
    if (!str) return 0;
    let count = 0;
    for (const char of str) {
      count += (char.charCodeAt(0) > 127) ? 1.5 : 1;
    }
    return Math.ceil(count);
  }

  _extractPureDialogue(dialogue) {
    if (!dialogue || typeof dialogue !== 'string') return dialogue;
    const parts = dialogue.split(/[|;]/);
    if (parts.length >= 5) {
      return parts[3].trim();
    }
    return dialogue.trim();
  }

  _buildBatchPrompt(shots, ratio, characters) {
    const characterInfo = characters.map(c => `- ${c.name}: ${c.description || ''}`).join('\n');

    const shotsInfo = shots.map(s => {
      const pureDialogue = s.dialogue?.lines?.map(l => l.content).join('; ') || 
                          (s.dialogue ? this._extractPureDialogue(s.dialogue) : '');
      return `${s.shotId}(${s.duration || '?'}s): ${(s.scene || '').substring(0, 50)} | ${s.mood || ''} | ${pureDialogue.substring(0, 50)} | 运镜:${(s.cameraString || '').substring(0, 30)} | 灯光:${(s.lightingString || '').substring(0, 30)}`;
    }).join('\n');
    
    // 【v2.1.4-fix9-P1】构建导演上下文
    const directorContext = this._buildDirectorContext(shots);

    return `${directorContext}
画幅:${ratio}
角色:${characterInfo || '无'}
镜头:\n${shotsInfo}

任务:为每个镜头生成标准字段格式的导演分镜提示词。

【角色服装锁定 - 强制不可修改】
角色服装必须与角色设定完全一致，禁止根据场景修改：
- 正确："陈卓女士，穿警服的陈女士，健康科普主讲人，短发，站姿挺拔"
- 错误："白色医生服"、"白大褂"、"浅蓝色衬衫"（禁止根据场景更换服装）
【角色】字段必须严格使用角色设定中的原始服装描述，不可自由发挥。

要求：
1. 按标准字段输出：【约束】【基础】【场景】【角色】【动作】【定妆照】【台词】【时间轴】【情绪】【音频】【负面约束】【角色一致性】
2. 【台词】字段必须独立，角色直接对镜头说话，不要写"画外音""旁白"
3. 场景要具体专业（门诊室、宣教室、检查室），不要写"社区健身区"
4. 负面约束要完整，包含10+条排除项
5. 只输出JSON，不要解释

输出:{"shots":[{"shotId":"SC01","fields":{...}}]}`;
  }
  
  /**
   * 【v2.1.4-fix9-P1】构建导演上下文
   */
  _buildDirectorContext(shots) {
    // 从第一个 shot 的 blueprint 引用中提取上下文
    const firstShot = shots[0];
    const blueprint = firstShot?._blueprint || {};
    const config = blueprint.config || {};
    
    const title = blueprint.title || config.title || '未命名';
    const contentTheme = config.content_theme || '';
    const sceneRequirement = config.scene_requirement || '';
    const characterDescription = config.character_description || '';
    const forbiddenScenes = config.forbidden_scenes || [];
    const keyMessages = config.key_messages || [];
    
    return `## 🎬 导演指令上下文
视频标题：${title}
内容主题：${contentTheme}
场景要求：${sceneRequirement}
角色设定：${characterDescription}
关键信息：${keyMessages.join('；') || '无'}
禁止场景：${forbiddenScenes.join('、') || '无'}

`;
  }

  _fallbackBatch(shots, ratio) {
    console.log(`[PromptFusionAgent] 批量降级...`);
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        fields: {}
      }))
    };
  }
}

module.exports = { PromptFusionAgent };