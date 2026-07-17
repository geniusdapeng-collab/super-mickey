/**
 * AudioDesignAgent v6.7.0
 * 负责：生成【音频】字段（P2）—— 三层描述法
 * - 环境音效（Ambient Sound）
 * - 音乐风格（Music Style）
 * - 音量层级（Volume Level）
 * 输入：场景类型、情绪基调
 * 输出：三层音频描述字符串
 */

class AudioDesignAgent {
  constructor(options = {}) {
    this.llm = options.llm;
    this.log = options.log || console.log;
    this.maxTokens = options.maxTokens || 512;
  }

  async generate(context) {
    const prompt = this._buildPrompt(context);
    
    try {
      const response = await this.llm(prompt, { maxTokens: this.maxTokens });
      return this._parseResponse(response, context);
    } catch (err) {
      this.log('AUDIO-AGENT', `  ❌ 音频生成失败: ${err.message}`);
      return this._fallback(context);
    }
  }

  _buildPrompt(context) {
    return `你是一名专业的影视音频设计Agent。请根据以下信息生成音频字段。

【上下文】
- 场景类型: ${context.sceneType || 'interior'}
- 场景描述: ${context.sceneDescription || ''}
- 情绪基调: ${context.mood || 'neutral'}
- 视频类型: ${context.videoType || 'education'}
- 台词: ${context.hasDialogue ? '有台词' : '无台词'}

【输出要求】
请按以下格式输出，控制在80-100个英文单词或120-150个汉字：

第一层 - 环境音效: [具体列出可辨识的音源，如 distant traffic hum and occasional bird chirping]
第二层 - 音乐风格: [流派, 乐器, 情绪, BPM范围。如 ambient cinematic with strings and piano, peaceful, 70 BPM]
第三层 - 音量层级: [dominant/balanced/subtle/silent]

直接输出描述字符串，不要添加前缀或解释。`;
  }

  _parseResponse(response, context) {
    let text = (typeof response === 'string' ? response : response?.text || '').trim();
    text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
    
    // 验证三层是否齐全
    const hasAmbient = /(ambient|sound|noise|hum|chirp|wind|rain|traffic|footsteps|typing| chatter)/i.test(text);
    const hasMusic = /(music|musical|strings|piano|guitar|drums|orchestral|ambient|BPM|tempo)/i.test(text);
    const hasVolume = /(dominant|balanced|subtle|silent|volume|level)/i.test(text);
    
    if (!hasAmbient || !hasMusic || !hasVolume) {
      this.log('AUDIO-AGENT', `  ⚠️ 音频描述不完整，使用兜底`);
      return this._fallback(context);
    }

    return text;
  }

  _fallback(context) {
    const type = context.sceneType || 'interior';
    const mood = context.mood || 'neutral';
    
    if (type === 'interior') {
      return `gentle office ambient with soft keyboard typing and distant conversation, ambient cinematic with light piano and strings, ${mood}, 65 BPM, volume level: balanced`;
    }
    return `gentle breeze and distant city traffic, ambient cinematic with soft strings, ${mood}, 60 BPM, volume level: subtle`;
  }
}

module.exports = { AudioDesignAgent };
