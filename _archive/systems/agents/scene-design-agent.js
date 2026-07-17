/**
 * SceneDesignAgent v6.7.0
 * 负责：生成【场景】字段（P0）—— 三维度描述法
 * 输入：剧本场景概要（scene name, description, type, era, timeOfDay）
 * 输出：三维度场景描述字符串（空间类型 + 环境特征 + 时代背景）
 */

class SceneDesignAgent {
  constructor(options = {}) {
    this.llm = options.llm;
    this.log = options.log || console.log;
    this.maxTokens = options.maxTokens || 1024;
  }

  async generate(sceneInput) {
    const { name, description, type = 'interior', era = 'contemporary', timeOfDay = 'daytime' } = sceneInput;

    const prompt = this._buildPrompt(sceneInput);
    
    try {
      const response = await this.llm(prompt, { maxTokens: this.maxTokens });
      return this._parseResponse(response, sceneInput);
    } catch (err) {
      this.log('SCENE-AGENT', `  ❌ 场景生成失败: ${err.message}`);
      // 兜底：返回基础描述
      return this._fallback(sceneInput);
    }
  }

  _buildPrompt(input) {
    return `你是一名专业的影视场景设计Agent。请根据以下场景信息生成一段符合三维度描述法的场景描述。

【输入信息】
- 场景名称: ${input.name || '未命名'}
- 场景描述: ${input.description || ''}
- 空间类型: ${input.type || 'interior'}
- 时代背景: ${input.era || 'contemporary'}
- 时段: ${input.timeOfDay || 'daytime'}
- 角色: ${input.characters?.join(', ') || '无'}
- 情绪基调: ${input.mood || 'neutral'}

【输出要求】
必须同时覆盖三个维度，用逗号分隔，控制在40-60个英文单词或60-80个汉字：
1. 空间类型（Where）: 室内/室外，具体场所子类别
2. 环境特征（What）: 关键视觉元素（建筑结构、家具、自然元素、天气）
3. 时代背景（When）: 一天中的时段和历史时代

【标准示例】
interior of a modern hospital ward, clean white walls with medical equipment along the bedside, bright fluorescent ceiling lights, contemporary setting, daytime

【输出格式】
直接输出场景描述字符串，不要添加任何前缀或解释。`;
  }

  _parseResponse(response, input) {
    let text = (typeof response === 'string' ? response : response?.text || '').trim();
    
    // 清理可能的引号或前缀
    text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
    
    // 验证三个维度是否齐全
    const hasWhere = /(interior|exterior|outdoor|indoor|inside|outside)/i.test(text);
    const hasWhat = text.length > 20; // 环境特征至少有一些描述
    const hasWhen = /(morning|afternoon|evening|night|daytime|dusk|dawn|golden hour|contemporary|vintage|modern|1960s|1970s|1980s|1990s|2000s)/i.test(text);
    
    if (!hasWhere || !hasWhen) {
      this.log('SCENE-AGENT', `  ⚠️ 场景描述维度不完整，使用兜底`);
      return this._fallback(input);
    }

    return text;
  }

  _fallback(input) {
    const type = input.type || 'interior';
    const name = input.name || '场景';
    const era = input.era || 'contemporary';
    const time = input.timeOfDay || 'daytime';
    return `${type} of a ${name}, ${era} setting, ${time}`;
  }
}

module.exports = { SceneDesignAgent };
