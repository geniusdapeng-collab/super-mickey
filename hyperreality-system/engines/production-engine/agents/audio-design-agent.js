/**
 * AudioDesignAgent - 音频设计Agent
 * 负责: 环境音效设计
 */
const { BaseAgent } = require('./base-agent');

class AudioDesignAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'AudioDesignAgent', ...options });
  }

  _getSystemPrompt() {
    return `你是一位专业的声音设计师。根据场景信息，为每个镜头设计环境音效。

输出JSON格式:
{
  "shots": [
    {
      "shotId": "SC01",
      "backgroundSound": {
        "environment": "环境音类型",
        "description": "详细音效描述",
        "intensity": "low/medium/high"
      },
      "backgroundSoundString": "音效描述文本"
    }
  ]
}

设计原则:
1. 音效要与场景环境匹配：户外有风声/鸟鸣，室内有空调/人声;
2. 音效强度服务情绪：紧张场景音强高，平静场景音强弱;
3. 相邻镜头音效要有过渡和连贯性;`;
  }

  async process(shots, blueprint) {
    console.log(`[AudioDesignAgent] 开始处理 ${shots.length} 个镜头...`);

    const prompt = this._buildPrompt(shots, blueprint);

    const schema = {
      required: ['shots']
    };

    const llmResult = await this._callLLM(prompt, schema, () => {
      return this._fallback(shots);
    });

    if (llmResult.degraded) {
      return { shots: llmResult.result?.shots || shots, degraded: true, degradeReason: llmResult.degradeReason };
    }

    const designedShots = shots.map((shot) => {
      const designed = llmResult.result?.shots?.find(s => s.shotId === shot.shotId) || {};
      return {
        ...shot,
        backgroundSound: designed.backgroundSound || shot.backgroundSound,
        backgroundSoundString: designed.backgroundSoundString || ''
      };
    });

    console.log(`[AudioDesignAgent] 完成 ✓`);
    return { shots: designedShots, degraded: false, degradeReason: null };
  }

  _buildPrompt(shots, blueprint) {
    const shotsInfo = shots.map(s => {
      return `镜头 ${s.shotId}: 场景"${s.scene || ''}", 情绪"${s.mood || ''}"`;
    }).join('\n');

    return `## 镜头场景信息
${shotsInfo}

## 任务
为每个镜头设计环境音效:
1. backgroundSound.environment: 环境音类型（如：outdoor_urban, indoor_office, hospital, park）
2. backgroundSound.description: 详细音效描述（20-40字）
3. backgroundSound.intensity: 强度（low/medium/high）
4. backgroundSoundString: 用于Prompt融合的文本描述

要求:
- 音效要与场景环境完全匹配
- 强度要与情绪匹配（紧张=high，平静=low/medium）
- 相邻镜头音效要有连贯性

直接输出JSON。`;
  }

  _fallback(shots) {
    console.log(`[AudioDesignAgent] 使用降级规则...`);
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        backgroundSound: shot.backgroundSound,
        backgroundSoundString: ''
      }))
    };
  }
}

module.exports = { AudioDesignAgent };
