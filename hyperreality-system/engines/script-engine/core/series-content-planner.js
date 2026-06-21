// series-content-planner.js
// 系列内容规划器
// 输入：用户需求 + 集数，输出：带边界契约的多集内容规划
// v1.0 | 2026-06-21

class SeriesContentPlanner {
  constructor(options = {}) {
    this.config = {
      llmEngine: options.llmEngine || null,
      model: options.model || 'kimi-k2p6',
      timeout: options.timeout || 120000,
      ...options
    };
  }

  /**
   * 主入口：生成系列内容规划
   * @param {object} params - 参数
   * @param {string} params.userRequirement - 用户需求描述
   * @param {number} params.totalEpisodes - 总集数
   * @param {string[]} params.episodeThemes - 每集主题（用户已指定，可选）
   * @param {string} params.seriesTitle - 系列标题（可选）
   * @returns {object} 系列内容规划
   */
  async plan({ userRequirement, totalEpisodes, episodeThemes, seriesTitle }) {
    console.log(`[SeriesContentPlanner] 开始规划系列内容：${totalEpisodes}集...`);

    // 如果用户已明确指定每集主题，直接构造规划
    if (episodeThemes && episodeThemes.length === totalEpisodes) {
      console.log(`[SeriesContentPlanner] 用户已指定主题，构造边界契约...`);
      return this._buildPlanFromThemes({ userRequirement, totalEpisodes, episodeThemes, seriesTitle });
    }

    // 否则，调用LLM生成规划
    if (!this.config.llmEngine) {
      console.warn(`[SeriesContentPlanner] 未配置LLM引擎，使用简单回退规划`);
      return this._buildFallbackPlan({ userRequirement, totalEpisodes, seriesTitle });
    }

    return this._generatePlanWithLLM({ userRequirement, totalEpisodes, seriesTitle });
  }

  /**
   * 从用户指定的主题构造规划（含边界契约）
   */
  _buildPlanFromThemes({ userRequirement, totalEpisodes, episodeThemes, seriesTitle }) {
    const episodes = episodeThemes.map((theme, i) => {
      const index = i + 1;
      
      // 构造边界契约
      const mustCover = [theme];
      const canMention = [];
      const mustNotCover = [];

      // 前一集内容：canMention（一句话回顾）
      if (i > 0) {
        canMention.push(`${episodeThemes[i - 1]}（一句话回顾）`);
        mustNotCover.push(`${episodeThemes[i - 1]}（详细展开）`);
      }

      // 后一集内容：mustNotCover（不要提前讲）
      if (i < totalEpisodes - 1) {
        canMention.push(`${episodeThemes[i + 1]}（一句话引出，不展开）`);
        mustNotCover.push(`${episodeThemes[i + 1]}（详细展开/预告）`);
      }

      // 再后几集内容：mustNotCover
      for (let j = i + 2; j < totalEpisodes; j++) {
        mustNotCover.push(`${episodeThemes[j]}（任何提及）`);
      }

      return {
        index,
        title: theme,
        coreTopics: [theme],
        mustCover,
        canMention,
        mustNotCover
      };
    });

    return {
      seriesTitle: seriesTitle || this._extractTitle(userRequirement),
      totalEpisodes,
      episodes
    };
  }

  /**
   * 使用LLM生成完整规划
   */
  async _generatePlanWithLLM({ userRequirement, totalEpisodes, seriesTitle }) {
    const prompt = `你是一名专业的内容策划师。请根据以下需求，设计一个${totalEpisodes}集的系列内容规划，并明确每集的内容边界。

## 用户需求
${userRequirement}

## 任务
为${totalEpisodes}集系列设计完整的内容规划，每集包含：
1. 集标题
2. 核心主题（2-3个）
3. 必须覆盖的内容（mustCover）
4. 可以提及但不展开的内容（canMention，每处≤15秒）
5. 绝对不能深入的内容（mustNotCover）

## 边界规则
- 每集只讲本集核心主题，不跨集
- 前一集内容：本集可以一句话回顾，但不能详细展开
- 后一集内容：本集绝对不能预告或提前展开
- 后几集内容：本集不要提及

## 输出格式
输出JSON：
{
  "seriesTitle": "系列标题",
  "totalEpisodes": ${totalEpisodes},
  "episodes": [
    {
      "index": 1,
      "title": "第1集标题",
      "coreTopics": ["主题1", "主题2"],
      "mustCover": ["必须覆盖1", "必须覆盖2"],
      "canMention": ["可以提及1（一句话）", "可以提及2（一句话）"],
      "mustNotCover": ["不要深入1", "不要深入2"]
    }
  ]
}

注意：
- 确保${totalEpisodes}集的内容互不重叠，合起来覆盖完整主题
- 每集mustCover明确具体，不能模糊
- canMention只列出前后紧邻集的内容，且注明"一句话"
- mustNotCover要列出所有本集不该讲的内容`;

    try {
      const result = await this.config.llmEngine.generate(prompt, {
        systemPrompt: '你是一位专业的系列内容策划师。只输出JSON，不要解释。',
        maxTokens: 4000,
        timeoutMs: this.config.timeout,
        forceJson: true
      });

      if (!result.success || !result.content) {
        return this._buildFallbackPlan({ userRequirement, totalEpisodes, seriesTitle });
      }

      let parsed;
      try {
        parsed = JSON.parse(result.content.trim());
      } catch (e) {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw e;
        }
      }

      // 验证结构
      if (!parsed.episodes || parsed.episodes.length !== totalEpisodes) {
        return this._buildFallbackPlan({ userRequirement, totalEpisodes, seriesTitle });
      }

      return parsed;

    } catch (err) {
      console.warn(`[SeriesContentPlanner] LLM规划失败: ${err.message}，使用回退方案`);
      return this._buildFallbackPlan({ userRequirement, totalEpisodes, seriesTitle });
    }
  }

  /**
   * 回退规划（简单均分）
   */
  _buildFallbackPlan({ userRequirement, totalEpisodes, seriesTitle }) {
    const episodes = Array.from({ length: totalEpisodes }, (_, i) => ({
      index: i + 1,
      title: `第${i + 1}集`,
      coreTopics: [`主题${i + 1}`],
      mustCover: [`第${i + 1}集核心内容`],
      canMention: i > 0 ? [`第${i}集内容（一句话回顾）`] : [],
      mustNotCover: i < totalEpisodes - 1 ? [`第${i + 2}集及后续内容`] : []
    }));

    return {
      seriesTitle: seriesTitle || '系列内容',
      totalEpisodes,
      episodes
    };
  }

  /**
   * 从用户需求提取标题
   */
  _extractTitle(userRequirement) {
    if (!userRequirement) return '系列内容';
    // 简单提取前20字作为标题
    return userRequirement.substring(0, 20).replace(/[,.!?。，！？]/g, '');
  }
}

module.exports = { SeriesContentPlanner };
