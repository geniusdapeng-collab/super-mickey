/**
 * PromptFusionAgent - Prompt融合Agent（核心）
 * 负责: 将L3-L7元素创造性融合成导演分镜脚本
 * 策略: L1/L2/L9硬约束走规则，L3-L7走LLM融合
 */
const { BaseAgent } = require('./base-agent');

class PromptFusionAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'PromptFusionAgent', ...options });
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
    console.log(`[PromptFusionAgent] 开始处理 ${shots.length} 个镜头...`);

    // 获取画幅比例（用于L1约束）
    const ratio = blueprint.config?.aspectRatio || '16:9';

    // 获取角色信息（用于L9约束）
    const characters = blueprint.character_system?.characters || [];

    // 逐镜头融合（核心质量环节，每个镜头精修）
    const results = [];

    for (const shot of shots) {
      const prompt = this._buildPrompt(shot, ratio, characters);

      const schema = {
        required: ['fusionText']
      };

      const llmResult = await this._callLLM(prompt, schema, () => {
        return this._fallback(shot, ratio);
      });

      if (llmResult.degraded) {
        // 降级：使用原规则拼接的prompt
        results.push({
          ...shot,
          fusionText: '',
          prompt: shot.prompt || '',
          promptCharCount: this._countChars(shot.prompt || ''),
          degraded: true,
          degradeReason: llmResult.degradeReason
        });
      } else {
        // LLM融合成功，组装最终Prompt
        const fusionText = llmResult.result?.fusionText || '';
        const fullPrompt = this._assembleFullPrompt(shot, fusionText, ratio);
        const charCount = this._countChars(fullPrompt);

        results.push({
          ...shot,
          fusionText,
          prompt: fullPrompt,
          promptCharCount: charCount,
          degraded: false,
          degradeReason: null
        });
      }
    }

    console.log(`[PromptFusionAgent] 完成 ✓`);
    return { shots: results, degraded: results.some(s => s.degraded), degradeReason: null };
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

  _buildPrompt(shot, ratio, characters) {
    const characterInfo = characters.map(c =>
      `- ${c.name}: ${c.description || ''}${c.portraitPaths ? ' [定妆照]' : ''}`
    ).join('\n');

    const dialogue = shot.dialogue?.lines?.map(l => `"${l.content}"`).join('; ') || shot.dialogue || '';

    return `## 镜头信息
镜头ID: ${shot.shotId}
时长: ${shot.duration || shot.timing?.duration || '?'}s
场景: ${shot.scene || ''}
情绪: ${shot.mood || ''}
动作: ${shot.action || ''}
台词: ${dialogue}
运镜: ${shot.cameraString || JSON.stringify(shot.camera) || ''}
灯光: ${shot.lightingString || JSON.stringify(shot.lighting) || ''}
音效: ${shot.backgroundSoundString || ''}

## 角色信息
${characterInfo || '无'}

## 约束（不可违反）
- 画幅: ${ratio}
- 无文本/字幕/水印
- 保持角色形象一致

## 任务
请将以上信息融合成一段流畅的导演分镜描述（80-150字）。

要求:
1. 像在给摄影师讲戏一样描述
2. 运镜要动态描述（不说"dolly in"，说"镜头缓缓推近"）
3. 灯光要场景化（不说"key light"，说"阳光从侧面照来"）
4. 角色动作与镜头要配合
5. 情绪通过画面传达
6. 如果角色有定妆照，要引用"[character:角色名]"

输出格式:
{"fusionText": "融合后的导演分镜描述"}`;
  }

  _fallback(shot, ratio) {
    console.log(`[PromptFusionAgent] 镜头 ${shot.shotId} 使用降级规则...`);
    // 返回空fusionText，让外层使用原规则拼接
    return {
      fusionText: '',
      prompt: shot.prompt || '',
      promptCharCount: this._countChars(shot.prompt || '')
    };
  }
}

module.exports = { PromptFusionAgent };
