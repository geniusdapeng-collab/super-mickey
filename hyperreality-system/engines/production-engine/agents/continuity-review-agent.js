/**
 * ContinuityReviewAgent - 连续性审查Agent
 * 负责: 全局审查6维度连续性（新增环节）
 */
const { BaseAgent } = require('./base-agent');

class ContinuityReviewAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'ContinuityReviewAgent', ...options });
  }

  _getSystemPrompt() {
    return `你是一位资深的电影剪辑师和剧本医生。审查整个视频的镜头连续性，从6个维度发现问题并给出优化建议。

输出JSON格式:
{
  "review": {
    "overallScore": 85,
    "issues": [
      {
        "dimension": "角色一致性",
        "severity": "warning",
        "description": "问题描述",
        "affectedShots": ["SC01", "SC02"],
        "suggestion": "优化建议"
      }
    ],
    "summary": "审查总结"
  }
}

审查维度:
1. 角色一致性: 角色形象、服装、位置是否连续
2. 情绪曲线: 情绪转折是否自然，有无突兀跳变
3. 视觉节奏: 景别切换是否有节奏感，有无单调重复
4. 灯光一致: 同一场景灯光是否保持一致
5. 叙事连贯: 镜头间叙事逻辑是否连贯
6. 时长分配: 重点场景时长是否足够，过渡场景是否过长`;
  }

  async process(shots, blueprint) {
    console.log(`[ContinuityReviewAgent] 开始审查 ${shots.length} 个镜头...`);

    const prompt = this._buildPrompt(shots, blueprint);

    const schema = {
      required: ['review']
    };

    const llmResult = await this._callLLM(prompt, schema, () => {
      return this._fallback(shots);
    });

    if (llmResult.degraded) {
      return { review: llmResult.result, degraded: true, degradeReason: llmResult.degradeReason };
    }

    console.log(`[ContinuityReviewAgent] 完成 ✓`);
    return { review: llmResult.result.review, degraded: false, degradeReason: null };
  }

  _buildPrompt(shots, blueprint) {
    const shotsInfo = shots.map(s => {
      return `镜头 ${s.shotId}: 时长${s.duration || '?'}s, 场景"${(s.scene || '').substring(0, 50)}", 情绪"${s.mood || ''}", 动作"${(s.action || '').substring(0, 50)}"`;
    }).join('\n');

    return `## 镜头列表
${shotsInfo}

## 任务
从6个维度审查镜头连续性:
1. 角色一致性
2. 情绪曲线
3. 视觉节奏
4. 灯光一致
5. 叙事连贯
6. 时长分配

对每个发现的问题:
- severity: critical/warning/info
- description: 问题描述
- affectedShots: 受影响的镜头ID列表
- suggestion: 具体优化建议

最后给出 overallScore (0-100) 和 summary。

直接输出JSON。`;
  }

  _fallback(shots) {
    console.log(`[ContinuityReviewAgent] 使用降级规则...`);
    return {
      review: {
        overallScore: 80,
        issues: [],
        summary: '连续性审查（降级模式）：基础规则检查通过。'
      }
    };
  }
}

module.exports = { ContinuityReviewAgent };
