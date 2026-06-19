/**
 * VisualLanguageAgent - 视觉语言Agent
 * 负责: 运镜设计、灯光设计、动态时间轴
 */
const { BaseAgent } = require('./base-agent');

class VisualLanguageAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'VisualLanguageAgent', ...options });
  }

  _getSystemPrompt() {
    return `你是一位专业的电影摄影师和灯光师。根据剧本和场景信息，为每个镜头设计运镜方案和灯光方案。

输出JSON格式:
{
  "shots": [
    {
      "shotId": "SC01",
      "camera": {
        "shot_size": "wide/medium/close_up/extreme_close_up",
        "movement": "dolly_in/static/handheld/push_in/pull_back",
        "angle": "eye_level/low/high",
        "lens": "35mm/50mm/85mm",
        "speed": "slow/normal/fast"
      },
      "cameraString": "运镜描述文本",
      "lighting": {
        "key_light": "主光描述",
        "fill_light": "辅光描述",
        "time_of_day": "golden_hour/midday/blue_hour/night",
        "atmosphere": "氛围光描述"
      },
      "lightingString": "灯光描述文本",
      "timeline": [
        { "segment": 1, "timeRange": "0s-3s", "cameraMovement": "缓推全景", "shotType": "wide", "purpose": "建立空间" }
      ]
    }
  ]
}

设计原则:
1. 运镜要服务叙事：情绪紧张用手持晃动，情绪平和用稳定机位;
2. 时间轴动态切分：根据台词密度和情绪变化切分2-6段，不等分;
3. 灯光要场景化：不说"key light 3200K"，说"夕阳从右侧窗户斜射进来，在陈卓脸上形成温暖的侧光";
4. 考虑镜头间衔接：相邻镜头的景别和运动要有逻辑过渡;`;
  }

  async process(shots, blueprint) {
    console.log(`[VisualLanguageAgent] 开始处理 ${shots.length} 个镜头...`);

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

    // 合并LLM结果
    const designedShots = shots.map((shot) => {
      const designed = llmResult.result?.shots?.find(s => s.shotId === shot.shotId) || {};
      return {
        ...shot,
        camera: designed.camera || shot.camera,
        cameraString: designed.cameraString || '',
        lighting: designed.lighting || shot.lighting,
        lightingString: designed.lightingString || '',
        timeline: designed.timeline || shot.timeline,
        cameraMovement: {
          ...shot.cameraMovement,
          timeline: designed.timeline
        }
      };
    });

    console.log(`[VisualLanguageAgent] 完成 ✓`);
    return { shots: designedShots, degraded: false, degradeReason: null };
  }

  _buildPrompt(shots, blueprint) {
    const shotsInfo = shots.map(s => {
      const dialogue = s.dialogue?.lines?.map(l => `"${l.content}"`).join('; ') || s.dialogue || '';
      return `镜头 ${s.shotId}: ${s.duration || '?'}s | 场景: ${(s.scene || '').substring(0, 60)} | 情绪: ${s.mood || ''} | 台词: ${dialogue.substring(0, 80)}`;
    }).join('\n');

    return `## 镜头信息
${shotsInfo}

## 任务
为每个镜头设计运镜+灯光+时间轴。

输出每个镜头的:
1. camera: {shot_size, movement, angle, lens, speed}
2. cameraString: 运镜描述文本（30-50字，动态描述）
3. lighting: {key_light, fill_light, time_of_day, atmosphere}
4. lightingString: 灯光场景化描述（30-50字）
5. timeline: 运镜时间轴（动态切分2-4段，不等分）

设计要点:
- 台词密集处：短切+手持
- 情绪铺垫处：长镜头+缓慢推近
- 景别过渡：相邻镜头不要跳跃太大
- 灯光场景化：不用技术术语，用自然描述

输出JSON: {"shots": [{"shotId":"SC01","camera":{},"cameraString":"...","lighting":{},"lightingString":"...","timeline":[]}]}`;
  }

  _fallback(shots) {
    console.log(`[VisualLanguageAgent] 使用降级规则...`);
    // 返回原规则生成的数据，让外层使用原方法
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        camera: shot.camera,
        cameraString: '',
        lighting: shot.lighting,
        lightingString: '',
        timeline: shot.timeline
      }))
    };
  }
}

module.exports = { VisualLanguageAgent };
