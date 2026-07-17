const { LLMEngine } = require('./llm-reasoning-engine');

class CreativeLLMRouter {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.timeoutMs = options.timeoutMs || 120000;
    this.model = options.model || 'kimi-k2p6';
    this.maxRetries = options.maxRetries || 1;
    this.maxTokens = options.maxTokens || 3000;

    this.llm = new LLMEngine({
      model: this.model,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      maxTokens: this.maxTokens
    });
  }

  /**
   * 镜头创作主入口
   * 返回统一字段结构
   */
  async decideShotCreative(shot = {}, context = {}) {
    if (!this.enabled) {
      return this._fallbackFields(shot, context);
    }

    const compactInput = this._buildCompactInput(shot, context);
    const prompt = this._buildShotPrompt(compactInput);

    try {
      const result = await this.llm.reasonStructured(
        prompt,
        {
          CHARACTER: "",
          ACTION: "",
          SCENE: "",
          MOOD: "",
          CAMERA: "",
          LIGHTING: "",
          AUDIO: "",
          DIRECTOR: ""
        },
        {
          timeoutMs: this.timeoutMs,
          maxRetries: this.maxRetries,
          maxTokens: this.maxTokens
        }
      );

      if (result && result.success && result.data) {
        return this._sanitizeLLMFields(result.data, shot, context);
      }

      return this._fallbackFields(shot, context);
    } catch (err) {
      return this._fallbackFields(shot, context);
    }
  }

  /**
   * 给异兽出场做LLM决策
   */
  async decideBeastEntrance(shot = {}, context = {}) {
    if (!this.enabled) {
      return {
        ACTION: shot.narration || '',
        CAMERA: shot.camera || '',
        AUDIO: shot.audio || ''
      };
    }

    const prompt = `
你是一名神话电影导演，请为一个异兽出场镜头生成结构化创作建议。

【异兽信息】
异兽名: ${context.beastName || context.beastId || '异兽'}
栖息地: ${context.habitat || shot.scene || ''}
能力: ${context.ability || ''}
情绪目标: ${shot.emotionPhase || shot.mood || ''}
镜头类型: ${shot.type || ''}

【要求】
1. ACTION 要体现“前兆→爆发→余波”中的至少两个阶段
2. CAMERA 要有强视觉冲击
3. AUDIO 要是环境内声音，不要配乐说明
4. 简洁、电影化、具体

只输出 JSON：
{
  "ACTION": "",
  "CAMERA": "",
  "AUDIO": ""
}
`;

    try {
      const result = await this.llm.reasonStructured(
        prompt,
        { ACTION: "", CAMERA: "", AUDIO: "" },
        {
          timeoutMs: this.timeoutMs,
          maxRetries: this.maxRetries,
          maxTokens: 1200
        }
      );

      if (result && result.success && result.data) {
        return {
          ACTION: this._clean(result.data.ACTION),
          CAMERA: this._clean(result.data.CAMERA),
          AUDIO: this._clean(result.data.AUDIO)
        };
      }
    } catch (e) {}

    return {
      ACTION: shot.narration || '',
      CAMERA: shot.camera || '',
      AUDIO: shot.audio || ''
    };
  }

  /**
   * 给开场白做LLM决策
   */
  async decideOpeningLine(context = {}) {
    if (!this.enabled) {
      return '';
    }

    const prompt = `
你是神话短视频编剧，请为一个神兽生成一句震撼开场白。

【角色信息】
名字: ${context.beastName || '神兽'}
特征: ${context.beastTrait || ''}
栖息地: ${context.habitat || ''}
主题: ${context.episodeTheme || ''}
反转点: ${context.reversal || ''}

要求：
1. 只写一句中文
2. 20-40字最佳
3. 有记忆点
4. 不要解释

输出JSON：
{
  "line": ""
}
`;

    try {
      const result = await this.llm.reasonStructured(
        prompt,
        { line: "" },
        {
          timeoutMs: this.timeoutMs,
          maxRetries: 1,
          maxTokens: 500
        }
      );

      if (result && result.success && result.data && result.data.line) {
        return this._clean(result.data.line);
      }
    } catch (e) {}

    return '';
  }

  _buildCompactInput(shot = {}, context = {}) {
    return {
      shotType: shot.type || shot.shotType || '',
      scene: shot.scene || shot.sceneName || '',
      mood: shot.emotionPhase || shot.mood || '',
      narration: shot.narration || '',
      action: shot.action || '',
      characters: shot.characters || [],
      beastName: context.beastName || '',
      habitat: context.habitat || '',
      goal: context.goal || context.storyGoal || '',
      style: context.style || '神话电影感、超写实、镜头感强'
    };
  }

  _buildShotPrompt(input) {
    return `
你是顶级视频导演和提示词设计师。请把以下镜头信息，整理成适合视频生成模型的结构化创作字段。

【镜头信息】
shotType: ${input.shotType}
scene: ${input.scene}
mood: ${input.mood}
narration: ${input.narration}
actionHint: ${input.action}
characters: ${(input.characters || []).join(', ')}
beastName: ${input.beastName}
habitat: ${input.habitat}
goal: ${input.goal}
style: ${input.style}

【字段要求】
- CHARACTER: 只写角色主体与核心识别特征
- ACTION: 只写画面里真正发生的动作与变化
- SCENE: 只写环境和空间，不要混入动作
- MOOD: 只写情绪气氛
- CAMERA: 只写镜头语言、运镜、景别
- LIGHTING: 只写光线、色温、氛围光
- AUDIO: 只写环境音/角色发声线索，不要写配乐分析
- DIRECTOR: 只写一句导演调度提示

【严格要求】
1. 只输出 JSON
2. 每个字段都必须有
3. 没有内容就输出空字符串
4. 不要输出 markdown
5. 不要解释

输出格式：
{
  "CHARACTER": "",
  "ACTION": "",
  "SCENE": "",
  "MOOD": "",
  "CAMERA": "",
  "LIGHTING": "",
  "AUDIO": "",
  "DIRECTOR": ""
}
`;
  }

  _sanitizeLLMFields(data, shot, context) {
    return {
      CHARACTER: this._clean(data.CHARACTER) || (shot.characters || []).join('，'),
      ACTION: this._clean(data.ACTION) || shot.narration || '',
      SCENE: this._clean(data.SCENE) || shot.scene || shot.visualPrompt || '',
      MOOD: this._clean(data.MOOD) || shot.emotionPhase || shot.mood || '',
      CAMERA: this._clean(data.CAMERA) || '',
      LIGHTING: this._clean(data.LIGHTING) || '',
      AUDIO: this._clean(data.AUDIO) || '',
      DIRECTOR: this._clean(data.DIRECTOR) || ''
    };
  }

  _fallbackFields(shot = {}, context = {}) {
    return {
      CHARACTER: (shot.characters || []).join('，'),
      ACTION: shot.narration || shot.action || '',
      SCENE: shot.scene || shot.sceneName || shot.visualPrompt || '',
      MOOD: shot.emotionPhase || shot.mood || '',
      CAMERA: shot.camera || shot.cameraMovement?.description || '',
      LIGHTING: shot.lighting?.description || '',
      AUDIO: shot.audio || '',
      DIRECTOR: ''
    };
  }

  _clean(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .trim();
  }
}

module.exports = { CreativeLLMRouter };
