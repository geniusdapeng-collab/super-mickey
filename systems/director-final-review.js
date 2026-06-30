/**
 * 导演优化系统 v1.0
 * 预生产链路的质量升级引擎
 * 
 * 职责：
 * - 拿着原始PRD + 当前镜头方案进行整篇视角的深度优化
 * - 跨镜头进行连贯性升级，一气呵成，荡气回肠
 * - 把六七十分的基础版提升到八九十分的优质版
 * - 包含审核发现问题 + 导演专业优化，不是单纯审核
 * 
 * @version v1.0
 * @author 小G
 */

const { DirectorStyleLibrary } = require('./director-style-library.js');
const { LLMEngine } = require('./llm-reasoning-engine'); // v6.2-patch70: 接入 LLM 推理

class DirectorFinalReview {
  constructor(options = {}) {
    this.mode = options.mode || 'nirath';
    this.minPassScore = options.minPassScore || 75;
    this.useLLM = options.useLLM !== false; // v6.2-patch70: 默认启用 LLM
    
    // v6.2-patch69: 挂载导演风格库（Phase 2）
    this.styleLibrary = null;
    if (this.mode === 'nirath') {
      try {
        this.styleLibrary = new DirectorStyleLibrary({ mode: this.mode });
      } catch (e) {
        console.warn('[DirectorFinalReview] ⚠️ 导演风格库加载失败:', e.message);
      }
    }
    
    // v6.2-patch83-fix9: 导演评审LLM引擎 — 180秒超时（避免threshold卡边）
    this.llmEngine = new LLMEngine({
      model: options.llmModel || 'kimi-k2p6',
      mode: 'production',
      maxRetries: 1,
      timeoutMs: 180000, // 180秒：2470字符输入实测90-120秒，180秒留60秒余量
      maxTokens: 16000
    });
  }

  /**
   * 导演优化主入口（v6.2-patch70: LLM 推理版）
   */
  async review(input) {
    const startTime = Date.now();
    console.log(`\n[DirectorFinalReview] 🎬 导演优化开始 | 项目: ${input.projectName || 'unknown'}`);

    const result = {
      passed: false,
      score: 0,
      issues: [],
      suggestions: [],
      modifiedShots: {},
      reviewTime: 0,
      llmEnabled: true // v6.2-patch70: 标记使用了 LLM
    };

    // v6.2-patch71-fix: 并行合并4次LLM调用为2次，避免超时SIGKILL
    // v6.2-patch77: 2次也改为串行，避免OOM（导演Agent子进程内存限制4G）
    const storyCameraReview = await this._llmReviewGroup1(input);    // 故事性 + 运镜统一性
    const narrationPrdReview = await this._llmReviewGroup2(input);     // 台词/旁白 + PRD对齐
    
    // v6.2-patch79-fix: 防御性检查——LLM返回的JSON可能缺少字段
    const g1Issues = storyCameraReview?.issues || [];
    const g1Suggestions = storyCameraReview?.suggestions || [];
    const g2Issues = narrationPrdReview?.issues || [];
    const g2Suggestions = narrationPrdReview?.suggestions || [];
    
    result.issues.push(...g1Issues, ...g2Issues);
    result.suggestions.push(...g1Suggestions, ...g2Suggestions);

    // 导演前期方案一致性优化（保留原有逻辑）
    if (input.directorPlan) {
      const consistencyReview = this._reviewDirectorConsistency(input);
      result.issues.push(...consistencyReview.issues);
      result.suggestions.push(...consistencyReview.suggestions);
    }

    // 风格一致性优化（v6.2-patch69: Phase 2导演风格库挂载）
    let styleScore = 0;
    if (this.styleLibrary && this.mode === 'nirath') {
      console.log(`[DirectorFinalReview] 🎨 风格一致性优化...`);
      const styleReview = this.styleLibrary.analyzeFullFilmStyle(input.shots);
      styleScore = styleReview.score;
      result.styleReview = styleReview;
      
      if (styleScore < 60) {
        result.suggestions.push({
          category: 'style',
          message: `Nirath融合风格一致性偏低(${styleScore}/100)，镜头视觉风格可进一步优化`,
          fix: `参考风格库推荐标签: ${styleReview.summary?.styleBlend || '卡梅隆+维伦纽瓦+杰克逊+斯皮尔伯格'}`,
          styleScore
        });
      }
      console.log(`[DirectorFinalReview] 🎨 风格一致性评分: ${styleScore}/100`);
    }

    // 计算总分
    result.score = this._calculateScore(result.issues, input.shots, styleScore);
    // v6.2-patch83-fix8: 导演优化始终通过，只提建议给下游编剧优化，不阻断链路
    result.passed = true;
    result.reviewTime = Date.now() - startTime;

    // 生成修改意见（始终生成，不论分数）
    result.modifiedShots = this._generateModifications(result.issues, input.shots);

    this._printReport(result, input.shots);
    return result;
  }

  // ==================== v6.2-patch70: LLM 推理审查方法 ====================

  /**
   * 组1: 故事性 + 运镜统一性（单次LLM调用）
   * v6.2-patch71-fix: 合并减少API调用次数，避免超时SIGKILL
   */
  async _llmReviewGroup1(input) {
    if (!this.useLLM) {
      const story = this._optimizeStorytelling(input);
      const camera = this._optimizeCameraConsistency(input.shots);
      return { issues: [...story.issues, ...camera.issues], suggestions: [...story.suggestions, ...camera.suggestions] };
    }

    const shots = input.shots || [];
    // v6.2-patch77: 精简传入LLM的shots数据，只传关键字段，避免大对象内存爆炸
    const shotsMinimal = shots.map(s => ({
      id: s.id || s.shotId,
      scene: s.scene || s.beatName,
      duration: s.duration,
      emotionPhase: s.emotionPhase || s.emotionTarget?.emotion,
      cameraMovement: typeof s.cameraMovement === 'string' ? s.cameraMovement : s.cameraMovement?.description || s.movement,
      narration: (s.narration || '').substring(0, 30) // 只传前30字
    }));
    const prompt = `你是一位世界级导演，请审查以下镜头方案的故事性与运镜统一性。

## 全片统一风格锚定
本系列为「山海经」Nirath异世界史诗，全片必须坚持统一的视觉基调：
- **核心风格**：东方神话史诗 + 阿凡达式明亮奇幻（绝非Mad Max废土/普罗米修斯冷峻/通用中性）
- **光影**：双恒星琥珀-紫罗兰光照，生物发光补光，禁止暗黑/夜晚/压抑
- **生态**：繁茂植被+奇异发光植物覆盖，活跃外星生物，生机勃勃（非火星式荒芜）
- **情绪光谱**： awe敬畏 → tension紧张 → wonder惊奇 → resolve觉悟
- **禁止风格漂移**：任何镜头若出现废土高饱和高速、科幻冷峻宏大体量、或中性通用风格，视为风格不一致

## 镜头方案
${shotsMinimal.map(s => `- ${s.id || '未命名'}: ${s.scene || '未命名'} | 时长:${s.duration}s | 情绪:${s.emotionPhase || '未知'} | 运镜:${s.cameraMovement || '未指定'}`).join('\n')}

## 审查维度A：故事性（起承转合）
1. 起承转合完整性：是否有清晰的开场、冲突、高潮、结局？
2. 叙事节奏：时长分配是否合理？是否有节奏变化？
3. 主题清晰度：主题是否明确？是否有点题镜头？
4. 每个镜头是否服务于故事？

## 审查维度B：运镜统一性
1. 运镜多样性：推镜头、轨道、摇镜等是否均衡？
2. 景别过渡：是否有极端跳切？过渡是否自然？
3. 一镜到底使用：是否恰当？（注意：若标注'一镜到底'但时间轴内含'硬切''移焦过渡'，视为技术矛盾）
4. 运镜与情绪匹配：激烈情绪是否用慢速运镜？

## 审查维度C：风格一致性（新增）
1. 每颗镜头是否符合「东方神话史诗+阿凡达式明亮奇幻」的统一基调？
2. 参考影片氛围是否在全片保持一致？（禁止Mad Max/普罗米修斯/通用风格混用）
3. 色温、反差、镜头质感是否统一？

输出 JSON 格式：
{
  "issues": [{ "severity": "high/medium/low", "category": "story|camera|style", "message": "", "fix": "", "affectedShots": [] }],
  "suggestions": [{ "category": "story|camera|style", "message": "" }]
}`;

    const result = await this.llmEngine.reasonStructured(prompt, {
      issues: [],
      suggestions: []
    }, { timeoutMs: 120000, maxRetries: 1 }); // v6.2-patch83-fix5: 120秒×1次重试，导演评审Group1（故事+运镜）输入~2470字符，实测90-120秒完成，120秒覆盖95%正常情况
    // v6.2-patch83-fix9: 修复LLM结果被忽略的bug——必须返回LLM分析结果
    if (result && result.success && result.data) {
      return result.data;
    }
    console.log('[DirectorFinalReview] ⚠️ LLM Group1返回无效，回退到本地模板');
    const story = this._optimizeStorytelling(input);
    const camera = this._optimizeCameraConsistency(input.shots);
    return {
      issues: [...story.issues, ...camera.issues],
      suggestions: [...story.suggestions, ...camera.suggestions]
    };
  }

  /**
   * 组2: 台词/旁白 + PRD对齐（单次LLM调用）
   * v6.2-patch71-fix: 合并减少API调用次数，避免超时SIGKILL
   */
  async _llmReviewGroup2(input) {
    if (!this.useLLM) {
      const narration = this._optimizeNarrationCoverage(input.shots);
      const prdAlign = this._optimizePRDAlignment(input);
      return { issues: [...narration.issues, ...prdAlign.issues], suggestions: [...narration.suggestions, ...prdAlign.suggestions] };
    }

    const shots = input.shots || [];
    const prd = input.prd || {};
    // v6.2-patch77: 精简传入LLM的shots数据，只传关键字段，避免大对象内存爆炸
    const shotsMinimal = shots.map(s => ({
      id: s.id || s.shotId,
      scene: s.scene || s.beatName,
      duration: s.duration,
      narration: (s.narration || '').substring(0, 50)
    }));
    
    const prompt = `你是一位世界级导演，请审查以下镜头方案的台词覆盖与PRD对齐度。

## 镜头方案
${shotsMinimal.map(s => `- ${s.id || '未命名'}: ${s.scene || '未命名'} | 时长:${s.duration}s | 旁白前50字:「${s.narration || '无'}」`).join('\n')}

## PRD主题
${prd.core?.theme || prd.theme || '未指定'}

## 审查维度A：台词/旁白覆盖
1. 每镜是否有narration或对白？信息密度是否足够？
2. 台词是否与画面匹配？是否存在"画外音脱节"？
3. 关键信息是否在第一句就抛出？
4. 结尾是否有收束感？

## 审查维度B：PRD对齐
1. 镜头方案是否忠实实现PRD主题？
2. 角色出场完整性：所有PRD要求的角色是否都出场？
3. 时长偏差：总时长与PRD要求是否匹配？
4. 核心概念是否得到视觉化呈现？

输出 JSON 格式（只输出JSON，不要解释）：
{
  "issues": [
    { "severity": "high", "category": "narration", "message": "问题描述", "fix": "修复建议", "affectedShots": ["S01"] }
  ],
  "suggestions": [
    { "category": "narration", "message": "建议内容" }
  ]
}`;

    const result = await this.llmEngine.reasonStructured(prompt, {
      issues: [],
      suggestions: []
    }, { timeoutMs: 120000, maxRetries: 1 }); // v6.2-patch83-fix5: 120秒×1次重试，导演评审Group2（台词+PRD）输入~615字符，正常情况20-30秒完成，120秒覆盖95%正常情况
    // v6.2-patch83-fix9: 修复LLM结果被忽略的bug
    if (result && result.success && result.data) {
      return result.data;
    }
    console.log('[DirectorFinalReview] ⚠️ LLM Group2返回无效，回退到本地模板');
    const narration = this._optimizeNarrationCoverage(input.shots);
    const prdAlign = this._optimizePRDAlignment(input);
    return {
      issues: [...narration.issues, ...prdAlign.issues],
      suggestions: [...narration.suggestions, ...prdAlign.suggestions]
    };
  }

  /**
   * LLM 推理：故事性优化（已合并到组1，保留兼容）
   */
  async _llmReviewStorytelling(input) {
    const group1 = await this._llmReviewGroup1(input);
    return {
      issues: group1.issues.filter(i => i.category === 'story'),
      suggestions: group1.suggestions.filter(s => s.category === 'story')
    };
  }

  /**
   * LLM 推理：运镜统一性优化（已合并到组1，保留兼容）
   */
  async _llmReviewCameraConsistency(shots) {
    return { issues: [], suggestions: [] };
  }

  /**
   * LLM 推理：台词/旁白优化（已合并到组2，保留兼容）
   */
  async _llmReviewNarrationCoverage(shots) {
    return { issues: [], suggestions: [] };
  }

  /**
   * LLM 推理：PRD对齐审查（已合并到组2，保留兼容）
   */
  async _llmReviewPRDAlignment(input) {
    return { issues: [], suggestions: [] };
  }

  /**
   * LLM 推理：运镜统一性优化
   */
  async _llmReviewCameraConsistency(shots) {
    if (!this.useLLM) {
      return this._optimizeCameraConsistency(shots);
    }

    const prompt = `请作为导演审查以下镜头方案的运镜统一性。

镜头方案：
${shots.map(s => `- ${s.shotId}: ${s.prompt?.substring(0, 100) || '无'}...`).join('\n')}

请从以下维度评估：
1. 运镜多样性：推镜头、轨道、摇镜等是否均衡？
2. 景别过渡：是否有极端跳切？过渡是否自然？
3. 一镜到底使用：是否恰当？
4. 运镜与情绪匹配：激烈情绪是否用慢速运镜？

输出 JSON 格式：
{
  "issues": [{ "severity": "high/medium/low", "category": "camera", "message": "", "fix": "", "affectedShots": [] }],
  "suggestions": [{ "category": "camera", "message": "" }]
}`;

    const result = await this.llmEngine.reasonStructured(prompt, {
      issues: [],
      suggestions: []
    });

    if (result.success) {
      return result.data;
    }
    
    console.log('[DirectorFinalReview] ⚠️ LLM 运镜审查失败，回退到本地模板');
    return this._optimizeCameraConsistency(shots);
  }

  /**
   * LLM 推理：台词/旁白优化
   */
  async _llmReviewNarrationCoverage(shots) {
    if (!this.useLLM) {
      return this._optimizeNarrationCoverage(shots);
    }

    const prompt = `请作为导演审查以下镜头方案的台词/旁白覆盖。

镜头方案：
${shots.map(s => `- ${s.shotId}: ${s.prompt?.substring(0, 100) || '无'}...`).join('\n')}

请从以下维度评估：
1. 台词覆盖率：内容镜是否有台词或旁白？
2. 静默高潮使用：是否合理？
3. 台词与视觉同步：是否有声画分离？
4. 旁白密度：是否过高或过低？

输出 JSON 格式：
{
  "issues": [{ "severity": "high/medium/low", "category": "narration", "message": "", "fix": "", "affectedShots": [] }],
  "suggestions": [{ "category": "narration", "message": "" }]
}`;

    const result = await this.llmEngine.reasonStructured(prompt, {
      issues: [],
      suggestions: []
    });

    if (result.success) {
      return result.data;
    }
    
    console.log('[DirectorFinalReview] ⚠️ LLM 台词审查失败，回退到本地模板');
    return this._optimizeNarrationCoverage(shots);
  }

  /**
   * LLM 推理：PRD 对齐优化
   */
  async _llmReviewPRDAlignment(input) {
    if (!this.useLLM) {
      return this._optimizePRDAlignment(input);
    }

    const prd = input.prd || {};
    const shots = input.shots || [];
    
    const prompt = `请审查以下镜头方案是否与 PRD 需求对齐。

PRD 需求：
${JSON.stringify(prd, null, 2)}

镜头方案：
${shots.map(s => `- ${s.shotId}: ${s.beatName || '未命名'}`).join('\n')}

请从以下维度评估：
1. 主题对齐：PRD 主题是否在方案中体现？
2. 时长对齐：实际时长与目标时长偏差？
3. 关键场景对齐：PRD 要求的场景是否都有？
4. 角色对齐：PRD 要求的角色是否都出现？

输出 JSON 格式：
{
  "issues": [{ "severity": "high/medium/low", "category": "prd", "message": "", "fix": "" }],
  "suggestions": [{ "category": "prd", "message": "" }]
}`;

    const result = await this.llmEngine.reasonStructured(prompt, {
      issues: [],
      suggestions: []
    });

    if (result.success) {
      return result.data;
    }
    
    console.log('[DirectorFinalReview] ⚠️ LLM PRD 对齐审查失败，回退到本地模板');
    return this._optimizePRDAlignment(input);
  }

  // 保留原有方法...

  /**
   * 1. 故事性优化
   * 检查叙事弧线是否完整、主题是否清晰
   */
  _optimizeStorytelling(input) {
    const issues = [];
    const suggestions = [];
    const shots = input.shots || [];

    console.log(`[DirectorFinalReview] 📖 故事性优化...`);

    // 检查1：是否有完整的起承转合
    const shotTypes = shots.map(s => (s.shotType || s.type || '').toLowerCase());
    const hasOpening = shotTypes.some(t => t.includes('opening') || t.includes('setup') || t.includes('hook'));
    const hasConflict = shotTypes.some(t => t.includes('conflict') || t.includes('tension') || t.includes('crisis'));
    const hasResolution = shotTypes.some(t => t.includes('resolution') || t.includes('climax') || t.includes('ending'));
    
    if (!hasOpening) {
      issues.push({
        severity: 'high',
        category: 'story',
        message: '缺少开场/钩子镜头，叙事弧线不完整',
        fix: 'S00片头需强化叙事钩子，或增加开场铺垫镜'
      });
    }
    if (!hasConflict) {
      issues.push({
        severity: 'high',
        category: 'story',
        message: '缺少冲突/张力镜头，故事缺乏戏剧性',
        fix: '中间镜头需增加冲突或矛盾揭示'
      });
    }
    if (!hasResolution) {
      issues.push({
        severity: 'high',
        category: 'story',
        message: '缺少 resolution/升华镜头，故事没有收尾',
        fix: '结尾镜需明确主题升华或情感收束'
      });
    }

    // 检查2：每个镜头是否服务于故事
    const storyRelevance = shots.map((shot, idx) => {
      const prompt = shot.prompt || shot.visualPrompt || '';
      // v6.2-patch67-fix: 使用startsWith匹配，支持【叙事弧线：xxx】等变体
      const hasStoryBeat = prompt.includes('【叙事】') || prompt.includes('【情绪】') || 
                           prompt.includes('【叙事弧线') || prompt.includes('story');
      return { idx, shotId: shot.shotId, hasStoryBeat };
    });
    
    const irrelevantShots = storyRelevance.filter(s => !s.hasStoryBeat);
    if (irrelevantShots.length > 1) {
      issues.push({
        severity: 'medium',
        category: 'story',
        message: `${irrelevantShots.length}个镜头缺乏叙事锚点，可能沦为纯风景展示`,
        fix: '为每个镜头注入情绪或叙事目的',
        affectedShots: irrelevantShots.map(s => s.shotId)
      });
    }

    // 检查3：主题清晰度
    const allPrompts = shots.map(s => s.prompt || '').join(' ');
    const themeKeywords = ['主题', '升华', '核心', '真相', '改变', '成长'];
    const hasThemeClarity = themeKeywords.some(kw => allPrompts.includes(kw));
    
    if (!hasThemeClarity && shots.length > 3) {
      suggestions.push({
        category: 'story',
        message: '建议在结尾镜或核心镜明确点题，让观众记住主题'
      });
    }

    // 检查4：叙事节奏
    const durations = shots.map(s => s.duration || 0);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const allSame = durations.every(d => Math.abs(d - avgDuration) < 2);
    
    if (allSame && shots.length > 3) {
      issues.push({
        severity: 'medium',
        category: 'story',
        message: '所有镜头时长过于平均，缺乏叙事节奏变化',
        fix: '关键镜头延长，过渡镜头缩短，形成张弛有度的节奏'
      });
    }

    return { issues, suggestions };
  }

  /**
   * 2. 运镜统一性优化
   * 检查运镜是否重复、是否从整体视角统一
   */
  _optimizeCameraConsistency(shots) {
    const issues = [];
    const suggestions = [];

    console.log(`[DirectorFinalReview] 🎥 运镜统一性优化...`);

    // 提取所有运镜指令
    const cameraMoves = [];
    shots.forEach((shot, idx) => {
      const prompt = shot.prompt || '';
      const moveMatch = prompt.match(/【运镜】([^【]+)/);
      if (moveMatch) {
        const moves = moveMatch[1].split(/[→|]/).map(m => m.trim().toLowerCase());
        moves.forEach(m => {
          cameraMoves.push({ shotId: shot.shotId, idx, move: m });
        });
      }
    });

    // 检查1：运镜重复模式（大场景推镜头 → 中景近景）
    const pushInCount = cameraMoves.filter(m => m.move.includes('push_in') || m.move.includes('dolly_in')).length;
    const totalMoves = cameraMoves.length;
    const pushInRatio = pushInCount / totalMoves;

    if (pushInRatio > 0.5) {
      issues.push({
        severity: 'high',
        category: 'camera',
        message: `推镜头占比${(pushInRatio * 100).toFixed(0)}%，过高导致画面单调`,
        fix: '增加orbit_360、tilt_up、pan、static等运镜多样性',
        affectedShots: cameraMoves.filter(m => m.move.includes('push_in')).map(m => m.shotId)
      });
    }

    // 检查2：极端远景 → 近景的硬切过多
    const extremeWideToClose = [];
    for (let i = 0; i < shots.length - 1; i++) {
      const currPrompt = shots[i].prompt || '';
      const nextPrompt = shots[i + 1].prompt || '';
      const currHasExtremeWide = currPrompt.includes('极端远景') || currPrompt.includes('extreme_wide');
      const nextHasClose = nextPrompt.includes('近景') || nextPrompt.includes('closeup') || nextPrompt.includes('特写');
      
      if (currHasExtremeWide && nextHasClose) {
        extremeWideToClose.push({ from: shots[i].shotId, to: shots[i + 1].shotId });
      }
    }
    
    if (extremeWideToClose.length > 2) {
      issues.push({
        severity: 'medium',
        category: 'camera',
        message: `发现${extremeWideToClose.length}处"极端远景→近景"硬切，画面跳跃感强`,
        fix: '增加中景/全景过渡，或加入轨道渐变转场',
        affectedTransitions: extremeWideToClose
      });
    }

    // 检查3：一镜到底的使用
    const oneShotCount = shots.filter(s => {
      const prompt = s.prompt || '';
      return prompt.includes('一镜到底') || prompt.includes('one-shot');
    }).length;
    
    if (oneShotCount === 0 && shots.length >= 5) {
      suggestions.push({
        category: 'camera',
        message: '建议至少1个镜头使用一镜到底，增强沉浸感'
      });
    } else if (oneShotCount > 2) {
      issues.push({
        severity: 'low',
        category: 'camera',
        message: `一镜到底使用${oneShotCount}次，过多可能让观众疲劳`,
        fix: '精选1-2个关键场景使用一镜到底'
      });
    }

    // 检查4：运镜与情绪匹配（v6.2-patch67-fix: 基于shot字段而非prompt字符串）
    const emotionCameraMismatches = [];
    const intenseEmotions = ['tension', 'conflict', 'fear', 'anger', 'awe', 'surprise', 'disgust', 'panic', 'rage', 'intense', 'climax', 'explosive'];
    const slowSpeedCurves = ['slow_fast_slow', 'breathing', 'gentle_float', 'slow_drifting', 'steady_flow'];
    
    shots.forEach(shot => {
      const emotion = shot.emotionPhase || shot.emotion || '';
      const speedCurve = shot.cameraMovement?.speedCurve || shot.speedCurve || '';
      const isIntense = intenseEmotions.some(e => emotion.toLowerCase().includes(e));
      const isSlow = slowSpeedCurves.some(s => speedCurve.toLowerCase().includes(s));
      
      if (isIntense && isSlow) {
        emotionCameraMismatches.push(shot.shotId);
      }
    });
    
    if (emotionCameraMismatches.length > 0) {
      suggestions.push({
        category: 'camera',
        message: `${emotionCameraMismatches.length}个激烈情绪镜头使用了慢速/静态运镜，建议改为快速/手持风格`,
        affectedShots: emotionCameraMismatches
      });
    }

    return { issues, suggestions };
  }

  /**
   * 3. 台词/旁白优化
   * 检查每个内容镜是否有台词或旁白
   */
  _optimizeNarrationCoverage(shots) {
    const issues = [];
    const suggestions = [];

    console.log(`[DirectorFinalReview] 🎤 台词/旁白优化...`);

    // 排除片头，检查内容镜
    const contentShots = shots.filter(s => !s.isOpening && s.shotId !== 'S00');
    const totalContentShots = contentShots.length;

    // 检查每个内容镜是否有台词/旁白
    const shotsWithNarration = [];
    const shotsWithoutNarration = [];

    contentShots.forEach(shot => {
      const prompt = shot.prompt || '';
      const hasNarration = prompt.includes('【旁白】') || prompt.includes('【独白】') || prompt.includes('【神兽人声签名】');
      const hasLipSync = prompt.includes('【口播动作】') || prompt.includes('lipSync') || prompt.includes('嘴部');
      const isSilentClimax = prompt.includes('静默高潮') || prompt.includes('不说话');
      
      if (hasNarration || hasLipSync) {
        shotsWithNarration.push(shot.shotId);
      } else if (!isSilentClimax) {
        shotsWithoutNarration.push(shot.shotId);
      }
    });

    const coverageRatio = shotsWithNarration.length / totalContentShots;

    // 检查1：覆盖率
    if (coverageRatio < 0.5) {
      issues.push({
        severity: 'high',
        category: 'narration',
        message: `台词覆盖率仅${(coverageRatio * 100).toFixed(0)}%，内容镜缺乏音频叙事`,
        fix: '为无台词镜头添加旁白、角色内心独白或环境音效描述',
        affectedShots: shotsWithoutNarration,
        requirement: '内容镜台词覆盖率应≥70%'
      });
    } else if (coverageRatio < 0.7) {
      issues.push({
        severity: 'medium',
        category: 'narration',
        message: `台词覆盖率${(coverageRatio * 100).toFixed(0)}%，略低于70%标准`,
        fix: '为部分镜头补充简短旁白或角色反应',
        affectedShots: shotsWithoutNarration
      });
    }

    // 检查2：静默高潮的合理性
    const silentClimaxShots = contentShots.filter(s => {
      const prompt = s.prompt || '';
      return prompt.includes('静默高潮') || prompt.includes('不说话');
    });
    
    if (silentClimaxShots.length > 1) {
      issues.push({
        severity: 'medium',
        category: 'narration',
        message: `发现${silentClimaxShots.length}个静默高潮镜，过多会削弱叙事`,
        fix: '仅保留1个关键静默高潮，其余添加简短旁白',
        affectedShots: silentClimaxShots.map(s => s.shotId)
      });
    }

    // 检查3：台词与视觉同步
    const narrationVisualSync = [];
    contentShots.forEach(shot => {
      const prompt = shot.prompt || '';
      const hasNarration = prompt.includes('【旁白】') || prompt.includes('【独白】');
      const hasVisualStory = prompt.includes('【视觉】') || prompt.includes('【叙事】');
      
      if (hasNarration && !hasVisualStory) {
        narrationVisualSync.push(shot.shotId);
      }
    });
    
    if (narrationVisualSync.length > 0) {
      suggestions.push({
        category: 'narration',
        message: `${narrationVisualSync.length}个镜头的台词缺乏对应的视觉叙事支撑`,
        affectedShots: narrationVisualSync
      });
    }

    return { issues, suggestions };
  }

  /**
   * 4. PRD对齐优化
   * 检查当前方案是否偏离原始PRD需求
   */
  _optimizePRDAlignment(input) {
    const issues = [];
    const suggestions = [];
    const prd = input.prd || {};
    const shots = input.shots || [];

    console.log(`[DirectorFinalReview] 📋 PRD对齐优化...`);

    if (!prd || Object.keys(prd).length === 0) {
      issues.push({
        severity: 'medium',
        category: 'prd',
        message: '缺少原始PRD文档，无法验证需求对齐',
        fix: '确保PRD在链路中完整传递至导演优化环节'
      });
      return { issues, suggestions };
    }

    // 检查1：主题对齐
    const prdTheme = prd.core?.theme || prd.theme || prd.coreTheme || '';
    const allPrompts = shots.map(s => s.prompt || '').join(' ');
    
    if (prdTheme && !allPrompts.includes(prdTheme)) {
      issues.push({
        severity: 'high',
        category: 'prd',
        message: `PRD主题"${prdTheme}"未在当前方案中明确体现`,
        fix: `在核心镜头中明确注入"${prdTheme}"相关视觉或台词元素`
      });
    }

    // 检查2：目标时长对齐
    const prdDuration = prd.targetDuration || prd.duration || 15;
    const actualDuration = shots.reduce((sum, s) => sum + (s.duration || 0), 0);
    const durationDiff = Math.abs(actualDuration - prdDuration);
    
    if (durationDiff > 15) {
      issues.push({
        severity: 'medium',
        category: 'prd',
        message: `实际时长${actualDuration}s vs PRD要求${prdDuration}s，偏差${durationDiff}s`,
        fix: '调整镜头时长分配，使总时长接近目标'
      });
    }

    // 检查3：关键场景对齐
    const prdKeyScenes = prd.keyScenes || prd.requiredScenes || [];
    if (prdKeyScenes.length > 0) {
      const allPromptsLower = allPrompts.toLowerCase();
      const missingScenes = prdKeyScenes.filter(scene => !allPromptsLower.includes(scene.toLowerCase()));
      
      if (missingScenes.length > 0) {
        issues.push({
          severity: 'high',
          category: 'prd',
          message: `PRD要求的${missingScenes.length}个关键场景未在当前方案中找到`,
          fix: `补充场景: ${missingScenes.join(', ')}`,
          missingScenes
        });
      }
    }

    // 检查4：角色对齐
    const prdCharacters = prd.characters || prd.requiredCharacters || [];
    if (prdCharacters.length > 0) {
      const allPromptsLower = allPrompts.toLowerCase();
      const missingChars = prdCharacters.filter(char => !allPromptsLower.includes(char.toLowerCase()));
      
      if (missingChars.length > 0) {
        issues.push({
          severity: 'high',
          category: 'prd',
          message: `PRD要求的角色未在当前方案中找到: ${missingChars.join(', ')}`,
          fix: '确保所有PRD要求角色在镜头中有视觉呈现',
          missingCharacters: missingChars
        });
      }
    }

    return { issues, suggestions };
  }

  /**
   * 5. 导演前期方案一致性优化
   * 把六七十分的基础版提升到八九十分的优质版
   */
  _reviewDirectorConsistency(input) {
    const issues = [];
    const suggestions = [];
    const directorPlan = input.directorPlan || {};
    const shots = input.shots || [];

    console.log(`[DirectorFinalReview] 🎬 导演方案一致性审查...`);

    if (!directorPlan || Object.keys(directorPlan).length === 0) {
      return { issues, suggestions };
    }

    // 检查1：场景分配一致性
    const plannedScenes = directorPlan.scenes || [];
    const actualSceneIds = shots.map(s => s.sceneId || s.shotId).filter(Boolean);
    
    if (plannedScenes.length > 0) {
      const plannedIds = plannedScenes.map(s => s.id || s.sceneId);
      const missingPlanned = plannedIds.filter(id => !actualSceneIds.includes(id));
      
      if (missingPlanned.length > 0) {
        issues.push({
          severity: 'medium',
          category: 'consistency',
          message: `导演前期规划的场景在后期丢失: ${missingPlanned.join(', ')}`,
          fix: '恢复导演前期规划的场景，确保方案一致性'
        });
      }
    }

    // 检查2：情绪曲线一致性
    const plannedEmotionCurve = directorPlan.emotionCurve || [];
    if (plannedEmotionCurve.length > 0 && shots.length > 0) {
      const actualEmotions = shots.map(s => {
        const prompt = s.prompt || '';
        const emotionMatch = prompt.match(/情感曲线[:：]([^【\n]+)/);
        return emotionMatch ? emotionMatch[1].trim() : null;
      }).filter(Boolean);

      if (actualEmotions.length < shots.length * 0.5) {
        issues.push({
          severity: 'medium',
          category: 'consistency',
          message: '导演前期规划的情绪曲线在后期执行中丢失',
          fix: '为每个镜头标注情感曲线，确保与导演规划一致'
        });
      }
    }

    // 检查3：视觉风格一致性
    const plannedStyle = directorPlan.visualStyle || {};
    if (plannedStyle.keyElements && plannedStyle.keyElements.length > 0) {
      const allPrompts = shots.map(s => s.prompt || '').join(' ');
      const missingStyleElements = plannedStyle.keyElements.filter(el => !allPrompts.includes(el));
      
      if (missingStyleElements.length > 0) {
        suggestions.push({
          category: 'consistency',
          message: `导演前期规划的视觉元素未全部体现: ${missingStyleElements.join(', ')}`,
          fix: '在相关镜头中补充缺失的视觉风格元素'
        });
      }
    }

    return { issues, suggestions };
  }

  /**
   * 6. 计算导演优化总分（v6.2-patch69: 纳入风格一致性分数）
   * @param {Number} styleScore - 风格一致性评分（0-100，可选）
   */
  _calculateScore(issues, shots, styleScore = 0) {
    const baseScore = 100;
    
    // 扣分规则
    const deductions = {
      high: 15,
      medium: 8,
      low: 3
    };

    let totalDeduction = 0;
    issues.forEach(issue => {
      totalDeduction += deductions[issue.severity] || 5;
    });

    // 镜头数量加分（内容越丰富分数越高）
    const shotCountBonus = Math.min(shots.length * 2, 10);
    
    // v6.2-patch69: 风格一致性加权加分（最高10分）
    let styleBonus = 0;
    if (styleScore > 0) {
      // 风格分>=80: +10分，60-80: +5分，<60: 0分
      styleBonus = styleScore >= 80 ? 10 : (styleScore >= 60 ? 5 : 0);
    }

    return Math.max(0, baseScore - totalDeduction + shotCountBonus + styleBonus);
  }

  /**
   * 7. 生成修改意见（如果不通过）
   */
  _generateModifications(issues, shots) {
    const modifications = {};

    issues.forEach(issue => {
      if (issue.affectedShots) {
        issue.affectedShots.forEach(shotId => {
          if (!modifications[shotId]) {
            modifications[shotId] = [];
          }
          modifications[shotId].push({
            type: issue.category,
            severity: issue.severity,
            issue: issue.message,
            fix: issue.fix
          });
        });
      }
    });

    return modifications;
  }

  /**
   * 输出审查报告
   */
  _printReport(result, shots) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎬 导演优化报告`);
    console.log(`${'='.repeat(60)}`);
    console.log(`评分: ${result.score}/100`);
    // v6.2-patch69: 显示风格一致性分数
    if (result.styleReview) {
      console.log(`风格一致性: ${result.styleReview.score}/100 (${result.styleReview.summary?.styleBlend || 'Nirath融合风格'})`);
    }
    console.log(`状态: ✅ 通过（含优化建议）`);
    console.log(`审查时间: ${result.reviewTime}ms`);
    console.log(`镜头数: ${shots.length}`);
    console.log(`\n问题统计:`);
    
    const severityCount = { high: 0, medium: 0, low: 0 };
    result.issues.forEach(i => severityCount[i.severity]++);
    console.log(`  🔴 严重: ${severityCount.high}`);
    console.log(`  🟡 中等: ${severityCount.medium}`);
    console.log(`  🟢 轻微: ${severityCount.low}`);
    console.log(`  💡 建议: ${result.suggestions.length}`);

    if (result.issues.length > 0) {
      console.log(`\n问题详情:`);
      result.issues.forEach((issue, idx) => {
        const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} [${issue.category}] ${issue.message}`);
        if (issue.fix) {
          console.log(`     → 修复: ${issue.fix}`);
        }
      });
    }

    if (result.suggestions.length > 0) {
      console.log(`\n优化建议:`);
      result.suggestions.forEach((sg, idx) => {
        console.log(`  💡 [${sg.category}] ${sg.message}`);
      });
    }

    // v6.2-patch83-fix8: 导演优化始终显示优化建议，不判断是否通过
    if (Object.keys(result.modifiedShots).length > 0) {
      console.log(`\n需修改镜头:`);
      Object.entries(result.modifiedShots).forEach(([shotId, mods]) => {
        console.log(`  ${shotId}: ${mods.length}项修改`);
      });
    }

    console.log(`${'='.repeat(60)}\n`);
  }
}

module.exports = { DirectorFinalReview };
// v6.2-patch64: 导演优化系统（DirectorFinalReview）新增
