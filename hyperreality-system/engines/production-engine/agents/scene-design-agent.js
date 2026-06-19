/**
 * SceneDesignAgent - 场景设计Agent
 * 负责: 场景五维描述、情绪设计、动作设计
 */
const { BaseAgent } = require('./base-agent');

class SceneDesignAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'SceneDesignAgent', ...options });
  }

  _getSystemPrompt() {
    return `你是一位专业的电影场景设计师。根据剧本场景信息，为每个镜头设计完整的场景描述、情绪基调和角色动作。

输出JSON格式要求:
{
  "shots": [
    {
      "shotId": "SC01",
      "scene": "完整场景描述（环境+时间+天气+氛围）",
      "mood": "情绪关键词和氛围描述",
      "action": "角色动作描述（含肢体语言、走位）",
      "emotional_target": "场景情绪目标（如：警示、安抚、引导）"
    }
  ]
}

设计原则:
1. 场景描述要具体：不说"户外"，说"清晨7点的社区健身区，阳光从左侧45度角洒下";
2. 情绪要与台词匹配：台词警示时情绪紧张，台词安抚时情绪平和;
3. 动作要自然：走动、手势、转身、指向等;
4. 考虑镜头连续性：相邻场景的环境和光线要有逻辑关联;`;
  }

  async process(shots, blueprint) {
    console.log(`[SceneDesignAgent] 开始处理 ${shots.length} 个镜头...`);

    const prompt = this._buildPrompt(shots, blueprint);

    const schema = {
      required: ['shots']
    };

    const llmResult = await this._callLLM(prompt, schema, () => {
      // 降级：使用原规则方法
      return this._fallback(shots);
    });

    if (llmResult.degraded) {
      return { shots: llmResult.result, degraded: true, degradeReason: llmResult.degradeReason };
    }

    // 合并LLM结果回原shots
    const designedShots = shots.map((shot, index) => {
      const designed = llmResult.result?.shots?.find(s => s.shotId === shot.shotId) || {};
      return {
        ...shot,
        scene: designed.scene || shot.scene || '',
        mood: designed.mood || shot.mood || '',
        action: designed.action || shot.action || '',
        emotional_target: designed.emotional_target || ''
      };
    });

    console.log(`[SceneDesignAgent] 完成 ✓`);
    return { shots: designedShots, degraded: false, degradeReason: null };
  }

  _buildPrompt(shots, blueprint) {
    const characters = blueprint.character_system?.characters || [];
    const characterDesc = characters.map(c =>
      `- ${c.name}: ${c.description || '无描述'}${c.portraitPaths ? ' [有定妆照]' : ''}`
    ).join('\n');

    const shotsInfo = shots.map(s => {
      const dialogue = s.dialogue?.lines?.map(l => `"${l.content}"`).join('; ') || s.dialogue || '';
      return `镜头 ${s.shotId}: 时长${s.duration || s.timing?.duration || '?'}s, 类型${s.sceneType || '?'}\n  台词: ${dialogue}`;
    }).join('\n\n');

    return `## 角色信息
${characterDesc || '无角色信息'}

## 镜头列表
${shotsInfo}

## 任务
为每个镜头设计:
1. scene: 完整场景描述（环境+时间+光线+氛围，50-100字）
2. mood: 情绪氛围描述（20-30字）
3. action: 角色动作（含肢体语言、走位、手势，30-50字）
4. emotional_target: 场景情绪目标（1个关键词）

要求:
- 场景要写实、具体、有画面感
- 情绪要与台词内容匹配
- 动作要自然流畅
- 相邻镜头要有环境连续性

直接输出JSON。`;
  }

  _fallback(shots) {
    console.log(`[SceneDesignAgent] 使用降级规则...`);
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        scene: shot.scene || '',
        mood: shot.mood || '',
        action: shot.action || '',
        emotional_target: ''
      }))
    };
  }
}

module.exports = { SceneDesignAgent };
