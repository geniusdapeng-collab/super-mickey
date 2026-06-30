/**
 * VisualLanguageAgent v6.7.0
 * 负责：生成镜头语言层和人物层字段（P0/P1）
 * - 构图（P1）：景别 + 主体位置 + 线条引导
 * - 色彩/色调（P1）：主色调 + 辅助色 + 饱和度 + 对比度
 * - 景深（P1）：焦点位置 + 虚化程度 + 清晰范围
 * - 运镜（P0）：运动方式 + 速度 + 时间分布
 * - 动作（P0）：主体动作 + 辅助动作 + 视线方向
 * - 情绪（P1）：情绪氛围关键词
 * 输入：场景描述、角色信息、叙事需求、情绪基调
 * 输出：6个字段的完整描述
 */

class VisualLanguageAgent {
  constructor(options = {}) {
    this.llm = options.llm;
    this.log = options.log || console.log;
    this.maxTokens = options.maxTokens || 2048;
  }

  async generate(fields, context) {
    const results = {};

    // 按依赖顺序串行生成（构图依赖场景，景深依赖构图，运镜依赖情绪）
    // 但为简化，先按批次调用

    // 批次1: 构图 + 色彩 + 景深（空间相关）
    const batch1 = await this._generateBatch1(fields, context);
    Object.assign(results, batch1);

    // 批次2: 运镜 + 动作 + 情绪（叙事相关）
    const batch2 = await this._generateBatch2(fields, context, results);
    Object.assign(results, batch2);

    return results;
  }

  async _generateBatch1(fields, context) {
    const prompt = `你是一名专业的影视视觉语言Agent。请根据以下信息生成构图、色彩、景深三个字段。

【上下文】
- 场景描述: ${context.sceneDescription || ''}
- 场景类型: ${context.sceneType || 'interior'}
- 情绪基调: ${context.mood || 'neutral'}
- 角色数量: ${context.characterCount || 1}
- 叙事重点: ${context.narrativeFocus || 'character'}
- 视频类型: ${context.videoType || 'education'}

【输出要求】
请按以下JSON格式输出，不要添加任何解释：
{
  "composition": {
    "shotSize": "景别（Extreme Long Shot/Long Shot/Medium Shot/Close-Up/Extreme Close-Up）",
    "subjectPosition": "主体位置（三分法/中心/对称）",
    "leadingLines": "线条引导描述"
  },
  "colorPalette": {
    "dominantColor": "主色调",
    "accentColor": "辅助色",
    "saturation": "饱和度（desaturated/muted/natural/vibrant/hyper-saturated）",
    "contrast": "对比度（high/medium/low）"
  },
  "depthOfField": {
    "focusPoint": "焦点位置",
    "bokehQuality": "虚化程度（smooth/circular/harsh/none）",
    "depthRange": "清晰范围（shallow/deep）"
  }
}`;

    try {
      const response = await this.llm(prompt, { maxTokens: this.maxTokens });
      return this._parseBatch1(response);
    } catch (err) {
      this.log('VISUAL-AGENT', `  ❌ Batch1生成失败: ${err.message}`);
      return this._fallbackBatch1(context);
    }
  }

  _parseBatch1(response) {
    try {
      const text = typeof response === 'string' ? response : response?.text || '';
      const json = JSON.parse(text.replace(/```json\s*|\s*```/g, ''));
      return {
        composition: json.composition,
        colorPalette: json.colorPalette,
        depthOfField: json.depthOfField
      };
    } catch {
      return {};
    }
  }

  _fallbackBatch1(context) {
    const shotSize = context.characterCount > 1 ? 'Medium Shot' : 'Close-Up';
    return {
      composition: {
        shotSize,
        subjectPosition: 'subject positioned at the left third intersection',
        leadingLines: 'natural sight lines from foreground to background'
      },
      colorPalette: {
        dominantColor: 'dominant natural tone',
        accentColor: 'accented with warm highlights',
        saturation: 'natural saturation',
        contrast: 'medium contrast'
      },
      depthOfField: {
        focusPoint: 'focus on subject face',
        bokehQuality: 'smooth',
        depthRange: context.characterCount > 1 ? 'deep' : 'shallow'
      }
    };
  }

  async _generateBatch2(fields, context, batch1Results) {
    const prompt = `你是一名专业的影视视觉语言Agent。请根据以下信息生成运镜、动作、情绪三个字段。

【上下文】
- 场景描述: ${context.sceneDescription || ''}
- 角色: ${context.characters?.join(', ') || '无'}
- 台词: ${context.dialogue || '无'}
- 情绪基调: ${context.mood || 'neutral'}
- 叙事节奏: ${context.pacing || 'moderate'}
- 构图: ${JSON.stringify(batch1Results.composition || {})}
- 视频类型: ${context.videoType || 'education'}

【输出要求】
请按以下JSON格式输出，不要添加任何解释：
{
  "cameraMovement": {
    "movement": "运动方式（Push In/Pull Out/Pan/Track/Follow/Crane/Orbit）",
    "speed": "速度描述",
    "duration": "时间分布"
  },
  "action": {
    "primaryAction": "主体动作",
    "secondaryAction": "辅助动作",
    "gazeDirection": "视线方向"
  },
  "mood": "情绪氛围关键词（1-2个，简洁明确）"
}`;

    try {
      const response = await this.llm(prompt, { maxTokens: this.maxTokens });
      return this._parseBatch2(response);
    } catch (err) {
      this.log('VISUAL-AGENT', `  ❌ Batch2生成失败: ${err.message}`);
      return this._fallbackBatch2(context);
    }
  }

  _parseBatch2(response) {
    try {
      const text = typeof response === 'string' ? response : response?.text || '';
      const json = JSON.parse(text.replace(/```json\s*|\s*```/g, ''));
      return {
        cameraMovement: json.cameraMovement,
        action: json.action,
        mood: json.mood
      };
    } catch {
      return {};
    }
  }

  _fallbackBatch2(context) {
    return {
      cameraMovement: {
        movement: 'Push In',
        speed: 'slow 0.5m/s',
        duration: '3 seconds'
      },
      action: {
        primaryAction: 'standing and speaking',
        secondaryAction: 'natural hand gestures',
        gazeDirection: 'looking at camera'
      },
      mood: 'calm and professional'
    };
  }
}

module.exports = { VisualLanguageAgent };
