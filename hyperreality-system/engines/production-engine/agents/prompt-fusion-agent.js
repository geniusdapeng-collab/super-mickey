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

约束:
- 不能添加文本/字幕/水印;
- 不能改变画幅比例;
- 保持角色视觉锚点一致;`;
  }

  async process(shots, blueprint) {
    console.log(`[PromptFusionAgent] 开始处理 ${shots.length} 个镜头（全量模式）...`);

    const ratio = blueprint.config?.aspectRatio || '16:9';
    const characters = blueprint.character_system?.characters || [];

    const prompt = this._buildBatchPrompt(shots, ratio, characters);
    const schema = { shots: [{ shotId: 'SC01', fusionText: '...' }] };

    const llmResult = await this._callLLM(prompt, schema, () => {
      return this._fallbackBatch(shots, ratio);
    });

    const results = shots.map((shot) => {
      const fusionEntry = llmResult.result?.shots?.find(s => s.shotId === shot.shotId);
      const fusionText = fusionEntry?.fusionText || '';
      
      if (!fusionText && llmResult.degraded) {
        const fallbackPrompt = this._assembleFullPrompt(shot, '', ratio);
        return {
          ...shot,
          fusionText: '',
          prompt: fallbackPrompt,
          promptCharCount: this._countChars(fallbackPrompt),
          degraded: true,
          degradeReason: llmResult.degradeReason
        };
      }
      
      const fullPrompt = this._assembleFullPrompt(shot, fusionText, ratio);
      return {
        ...shot,
        fusionText,
        prompt: fullPrompt,
        promptCharCount: this._countChars(fullPrompt),
        degraded: false,
        degradeReason: null
      };
    });

    const degradedCount = results.filter(s => s.degraded).length;
    console.log(`[PromptFusionAgent] 完成 ✓ | 降级: ${degradedCount}/${shots.length}`);
    return { shots: results, degraded: degradedCount > 0, degradeReason: null };
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
      if (shot.dialogue && shot.dialogue !== '') parts.push(`dialogue: ${shot.dialogue}`);
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
      const dialogue = s.dialogue?.lines?.map(l => l.content).join('; ') || s.dialogue || '';
      return `${s.shotId}(${s.duration || '?'}s): ${(s.scene || '').substring(0, 50)} | ${s.mood || ''} | ${dialogue.substring(0, 50)} | 运镜:${(s.cameraString || '').substring(0, 30)} | 灯光:${(s.lightingString || '').substring(0, 30)}`;
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
