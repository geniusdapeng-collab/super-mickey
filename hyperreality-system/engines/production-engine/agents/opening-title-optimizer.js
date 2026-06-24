/**
 * OpeningTitleOptimizer - 片头标题优化Agent（后处理环节）
 * 负责: 在最终提交前，专门为片头SC00生成营销向的标题、动画、音效设计
 * 策略: 不动现有链路，作为后处理环节插入
 * v1.0: 基于已有blueprint和prompt，生成片头专属字段
 */
const { BaseAgent } = require('./base-agent');

class OpeningTitleOptimizer extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'OpeningTitleOptimizer', ...options });
  }

  _getSystemPrompt() {
    return `你是一位专业的电影片头营销设计师。你的任务是为片头设计极具吸引力的主标题、副标题、出场动画和开场音效。

设计原则:
1. 标题要带有营销属性，让用户产生点击欲望
2. 动画设计要精致、有电影感
3. 字体设计要匹配视频气质
4. 开场音效要有品牌辨识度
5. 所有设计要服务于"让用户停留"的目标

输出严格的JSON格式，不要markdown代码块。`;
  }

  /**
   * 主入口：优化片头
   * @param {Object} shot - SC00镜头数据（含已有fields和prompt）
   * @param {Object} blueprint - 完整剧本蓝图
   * @returns {Object} 优化后的片头字段
   */
  async optimize(shot, blueprint) {
    console.log(`[OpeningTitleOptimizer] 开始优化片头...`);

    const prompt = this._buildPrompt(shot, blueprint);

    const schema = {
      required: ['title_content', 'subtitle_content', 'title_animation', 'title_font_design', 'opening_audio_design']
    };

    const llmResult = await this._callLLM(prompt, schema, () => {
      return this._fallback(shot, blueprint);
    });

    if (llmResult.degraded) {
      console.log(`[OpeningTitleOptimizer] 降级处理`);
      return { ...llmResult.result, degraded: true, degradeReason: llmResult.degradeReason };
    }

    console.log(`[OpeningTitleOptimizer] 完成 ✓`);
    return { ...llmResult.result, degraded: false, degradeReason: null };
  }

  _buildPrompt(shot, blueprint) {
    const title = blueprint.title || '未命名';
    const meta = blueprint._metadata || blueprint.config?._metadata || {};
    const episodeNumber = meta.episodeNumber || meta.series?.currentEpisode || 1;
    const totalEpisodes = meta.totalEpisodes || meta.series?.totalEpisodes || 1;
    const genre = blueprint.genre || '科普';
    const style = blueprint.style || 'REAL';
    const targetAudience = blueprint.targetAudience || '通用受众';
    
    // 提取已有prompt中的场景信息
    const existingPrompt = shot.prompt || '';
    const existingScene = shot.fields?.scene || '';
    const existingDialogue = shot.fields?.dialogue || '';
    const existingMood = shot.fields?.mood || '';
    const existingAudio = shot.fields?.audio || '';

    return `## 视频信息
标题: ${title}
类型: ${genre}
风格: ${style}（写实风格）
目标受众: ${targetAudience}
集数: 第${episodeNumber}集/${totalEpisodes}集

## 片头场景信息
场景描述: ${existingScene}
情绪基调: ${existingMood}
已有音频: ${existingAudio}

## 片头台词（开场第一句）
${existingDialogue}

## 已有Prompt片段
${existingPrompt.substring(0, 300)}...

## 任务
为片头设计以下5个字段，输出JSON格式:

1. title_content: 主标题（10-15字，带营销属性，吸引点击）
   - 要求: 有冲击力、有悬念、或有关键词
   - 示例: "尿出可乐色？你可能正在横纹肌溶解！" / "横纹肌溶解：藏在肌肉里的致命杀手"
   - 要求: 让用户一看就想点进去

2. subtitle_content: 副标题（15-25字，补充说明，增强可信度）
   - 要求: 解释主标题、给出关键信息、或制造对比
   - 示例: "第1集 | 症状与实验室检查全解析" / "健身党必看：三大症状+三项检查"

3. title_animation: 出场动画设计（150-200字，详细描述）
   - 包含: 入场方式（淡入/滑入/缩放/爆裂等）、持续时长、出场节奏
   - 包含: 主标题和副标题的出场顺序、时间差
   - 包含: 动画质感（金属/玻璃/粒子/水墨等）
   - 示例: "主标题以金属质感从屏幕中央爆裂入场，伴随粒子消散效果，持续1.5秒；副标题从底部缓慢滑入，带轻微模糊渐入，延迟0.5秒出场；整体动画时长3秒，节奏紧凑有力"

4. title_font_design: 字体设计（100-150字，详细描述）
   - 包含: 字体类型（无衬线/衬线/手写体等）
   - 包含: 字体风格（粗体/细体/斜体等）
   - 包含: 颜色设计（主色/描边/阴影/渐变）
   - 包含: 质感效果（金属/玻璃/发光/浮雕等）
   - 示例: "主标题使用粗体无衬线字体（类似Impact），猩红色渐变填充，带2px白色描边和微阴影，金属质感光泽；副标题使用细体无衬线字体，浅灰色，无描边，简约现代"

5. opening_audio_design: 开场音效设计（100-150字，详细描述）
   - 包含: 专属开场音效（品牌辨识度）
   - 包含: 音效与动画同步节奏
   - 包含: 环境音/配乐风格
   - 示例: "开场0.5秒静音留白，随后低沉低频嗡鸣渐起，伴随标题爆裂入场的金属撞击声；1.5秒处加入紧张弦乐拨奏，与副标题滑入同步；整体音调冷峻、压抑，建立医疗危机感"

要求:
- 标题必须有营销属性（让用户想点击）
- 动画设计要有电影质感
- 字体设计要匹配写实风格
- 音效要有品牌辨识度
- 整体时长控制在3-5秒

直接输出JSON格式:
{
  "title_content": "...",
  "subtitle_content": "...",
  "title_animation": "...",
  "title_font_design": "...",
  "opening_audio_design": "..."
}`;
  }

  _fallback(shot, blueprint) {
    console.log(`[OpeningTitleOptimizer] 使用降级规则...`);
    const title = blueprint.title || '未命名';
    return {
      title_content: `${title} - 第1集`,
      subtitle_content: '症状与实验室检查全解析',
      title_animation: '主标题淡入入场，副标题延迟0.5秒跟随淡入，整体2秒',
      title_font_design: '粗体无衬线字体，白色，带微阴影',
      opening_audio_design: '环境音渐起，配合标题入场'
    };
  }
}

module.exports = { OpeningTitleOptimizer };
