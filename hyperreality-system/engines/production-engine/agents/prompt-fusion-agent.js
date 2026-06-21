/**
 * PromptFusionAgent - Prompt融合Agent（核心）
 * 负责: 将L3-L7元素创造性融合成导演分镜脚本
 * 策略: L1/L2/L9硬约束走规则，L3-L7走LLM融合
 */
const { BaseAgent } = require('./base-agent');

class PromptFusionAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'PromptFusionAgent', enabled: true, llmTimeout: 600000, ...options });
    this.maxPromptLength = options.maxPromptLength || 1500;
    this.concurrency = options.concurrency || 3; // 【新增】并发度
  }

  _getSystemPrompt() {
    return `你是一位资深电影导演和摄影师。根据镜头信息，将场景、角色、动作、台词、运镜、灯光、情绪、音效融合成一段流畅的导演分镜脚本描述。

输出JSON格式:
{
  "shots": [
    {
      "shotId": "SC01",
      "fusionText": "融合后的导演分镜描述（80-150字）",
      "prompt": "完整Prompt（包含融合段）",
      "promptCharCount": 1234
    }
  ]
}

融合要求:
1. 不是简单拼接，而是叙事化描述：像在给摄影师和演员讲戏;
2. 运镜描述要动态：不说"dolly in"，说"镜头缓慢推近，陈卓的表情从模糊到清晰";
3. 灯光描述要场景化：不说"key light 3200K"，说"夕阳从侧面照来，她的脸部轮廓被镀上金色";
4. 角色动作与运镜要配合：角色走动时镜头跟随，角色停顿时镜头稳定;
5. 情绪要通过画面传达：紧张时画面摇晃/快切，平静时长镜头/柔和光线;

内容边界约束（极其重要）：
- 只描述本集内容，严禁暗示或提及后续集数（禁止"下一集""下次再说""后续介绍"等）
- 结尾场景严禁预告后续内容，只总结本集已讲知识点
- 严禁将本集范围外的知识点（如预防/处理）混入当前描述

约束:
- 不能添加文本/字幕/水印;
- 不能改变画幅比例;
- 保持角色视觉锚点一致;`;
  }

  async process(shots, blueprint) {
    console.log(`[PromptFusionAgent] 开始处理 ${shots.length} 个镜头（并发=${this.concurrency}）`);

    const ratio = blueprint.config?.aspectRatio || '16:9';
    const characters = blueprint.character_system?.characters || [];

    const results = new Array(shots.length);
    let index = 0;
    let failed = 0;

    // 并发 worker 池（限流，避免 6 路同时打 LLM 导致 OOM/限流）
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

  /**
   * 【新增】单镜头 LLM 融合
   */
  async _fuseSingleShot(shot, ratio, characters) {
    const prompt = this._buildBatchPrompt([shot], ratio, characters);
    const schema = { shots: [{ shotId: shot.shotId, fusionText: '...' }] };

    const llmResult = await this._callLLM(prompt, schema, () => {
      throw new Error('LLM fallback'); // 让外层 catch 处理
    });

    const fusionEntry = llmResult.result?.shots?.find(s => s.shotId === shot.shotId);
    const fusionText = fusionEntry?.fusionText || '';
    const fullPrompt = this._assembleFullPrompt(shot, fusionText, ratio);

    return {
      ...shot,
      fusionText,
      prompt: fullPrompt,
      promptCharCount: this._countChars(fullPrompt),
      degraded: false,
      degradeReason: null
    };
  }

  /**
   * 【新增】单镜头规则兜底
   */
  _fallbackSingleShot(shot, ratio) {
    const fallbackPrompt = this._assembleFullPrompt(shot, '', ratio);
    return {
      ...shot,
      fusionText: '',
      prompt: fallbackPrompt,
      promptCharCount: this._countChars(fallbackPrompt),
      degraded: true,
      degradeReason: '单镜头 LLM 融合失败，规则兜底',
      _pf_fallback: true // 标记此镜头为兜底，便于质量门识别
    };
  }

  /**
   * 从结构化 dialogue 中提取纯台词内容
   * 格式：SPEAKER|TYPE|EMOTION|TEXT|LIP_SYNC → 提取 TEXT
   */
  _extractPureDialogue(dialogue) {
    if (!dialogue || typeof dialogue !== 'string') return dialogue;

    // 检测结构化格式：至少包含4个分隔符
    const parts = dialogue.split(/[|;]/);
    if (parts.length >= 5) {
      // 格式：SPEAKER|TYPE|EMOTION|TEXT|LIP_SYNC
      // 提取第4个字段（索引3）作为纯台词
      return parts[3].trim();
    }

    return dialogue.trim();
  }

  /**
   * 组装完整Prompt（L1硬约束 + LLM融合段 + L9硬约束）
   */
  _assembleFullPrompt(shot, fusionText, ratio) {
    const parts = [];

    // L1: 约束层（规则硬约束）
    parts.push(`${ratio} cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic`);

    // L2: 基础层（规则硬约束）
    parts.push('hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film');

    // L3-L7: 融合段（LLM产出）
    if (fusionText) {
      parts.push(fusionText);
    } else {
      // 降级：用原规则拼接
      parts.push(shot.scene || '');
      if (shot.character && shot.character !== 'NONE') parts.push(shot.character);
      if (shot.action) parts.push(shot.action);
      // v2.1.4-fix7: 提取纯台词，剔除结构化标签
      const pureDialogue = shot.dialogueText || this._extractPureDialogue(shot.dialogue);
      if (pureDialogue && pureDialogue !== '') parts.push(`【台词】"${pureDialogue}"`);
      if (shot.cameraString) parts.push(shot.cameraString);
      if (shot.lightingString) parts.push(shot.lightingString);
      if (shot.mood) parts.push(`mood: ${shot.mood}`);
      if (shot.backgroundSoundString) parts.push(`audio: ${shot.backgroundSoundString}`);
    }

    // L9: 质控层（规则硬约束）
    parts.push('no voiceover, no narration, no metal_gloss, no unnatural_eye_color');

    // 合并并截断
    let fullPrompt = parts.filter(p => p).join(', ');
    if (this._countChars(fullPrompt) > this.maxPromptLength) {
      fullPrompt = this._truncateWithPriority(fullPrompt, parts);
    }

    return fullPrompt;
  }

  /**
   * 优先级截断（保持L1-L9顺序）
   */
  _truncateWithPriority(fullPrompt, parts) {
    // 简单截断：从后往前移除，保持L1在前
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

  _buildBatchPrompt(shots, ratio, characters) {
    const characterInfo = characters.map(c => `- ${c.name}: ${c.description || ''}`).join('\n');

    const shotsInfo = shots.map(s => {
      // v2.1.4-fix7: 提取纯台词，给LLM干净的输入
      const pureDialogue = s.dialogue?.lines?.map(l => l.content).join('; ') || 
                          (s.dialogue ? this._extractPureDialogue(s.dialogue) : '');
      return `${s.shotId}(${s.duration || '?'}s): ${(s.scene || '').substring(0, 50)} | ${s.mood || ''} | ${pureDialogue.substring(0, 50)} | 运镜:${(s.cameraString || '').substring(0, 30)} | 灯光:${(s.lightingString || '').substring(0, 30)}`;
    }).join('\n');

    return `画幅:${ratio}
角色:${characterInfo || '无'}
镜头:\n${shotsInfo}

任务:为每个镜头写fusionText(80-120字导演分镜描述)。叙事化、动态运镜、场景化灯光。不要长推理，直接输出JSON。

输出:{"shots":[{"shotId":"SC01","fusionText":"..."},...]}`;
  }

  _fallbackBatch(shots, ratio) {
    console.log(`[PromptFusionAgent] 批量降级...`);
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        fusionText: ''
      }))
    };
  }
}

module.exports = { PromptFusionAgent };
