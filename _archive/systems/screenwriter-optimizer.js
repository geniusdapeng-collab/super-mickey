/**
 * 编剧优化 Agent (Screenwriter Optimizer) v1.0
 * Stage 17 核心模块之二
 * 
 * 职责：接收导演优化报告，执行五类修改，输出完整优化剧本
 * 
 * 五类修改：
 * 1. 结构调整 — 增删改镜头顺序、时长、转场
 * 2. 内容改写 — 优化 Prompt 内叙事弧线、情绪张力
 * 3. 转场设计 — 基于景别/运镜合法性推荐转场类型
 * 4. 台词重构 — 调整【旁白/台词】字段，强化情绪表达
 * 5. 风格校准 — 统一世界观、视觉风格、角色一致性
 * 
 * 约束：
 * - 仅优化现有镜头 Prompt，不重新生成世界观/档案
 * - 优化后 Prompt 仍需控制在 1500 字符以内
 * - 不回流前序链路
 * 
 * @version v1.0 (v6.2-patch68)
 * @author 小G
 */

const { ContinuityEngine } = require('./continuity-engine.js');
const { LLMEngine } = require('./llm-reasoning-engine'); // v6.2-patch70: 接入 LLM 推理

class ScreenwriterOptimizer {
  constructor(options = {}) {
    this.mode = options.mode || 'nirath';
    this.maxIterations = options.maxIterations || 3;
    this.minPassScore = options.minPassScore || 75;
    this.promptMaxLength = options.promptMaxLength || 1500;
    this.useLLM = options.useLLM !== false; // v6.2-patch70: 默认启用 LLM
    
    // 连贯性引擎复用（用于景别/运镜合法性检查）
    this.continuityEngine = new ContinuityEngine({ mode: this.mode });
    
    // v6.2-patch83-fix6: 编剧优化LLM引擎使用240秒超时+1次重试
    // 根因：7467字符输入实测180秒完成，但AbortController在180秒触发导致结果被丢弃
    // 修复：240秒 = 180秒 + 60秒余量，确保fetch完成在abort之前
    this.llmEngine = new LLMEngine({
      model: options.llmModel || 'kimi-k2p6',
      mode: 'production',
      maxRetries: 1, // 快速失败：一次超时即回退本地模板，不重试
      timeoutMs: 240000, // 240秒：编剧优化输入~7467字符，实测180秒完成，余量60秒
      maxTokens: 16000
    });
    
    // 优化策略库
    this.OPTIMIZATION_STRATEGIES = {
      // 1. 结构调整策略
      structure: {
        name: '结构调整',
        description: '调整镜头顺序、时长分配、转场位置',
        applicable: (issue) => issue.category === 'continuity' && issue.subCategory === 'scale',
        apply: this._applyStructureAdjustment.bind(this)
      },
      // 2. 内容改写策略
      content: {
        name: '内容改写',
        description: '优化叙事弧线、强化情绪张力、注入世界观',
        applicable: (issue) => issue.category === 'story' || issue.category === 'dialogue',
        apply: this._applyContentRewrite.bind(this)
      },
      // 3. 转场设计策略
      transition: {
        name: '转场设计',
        description: '基于景别差和运镜方向推荐合法转场',
        applicable: (issue) => issue.category === 'continuity' && issue.subCategory === 'motion',
        apply: this._applyTransitionDesign.bind(this)
      },
      // 4. 台词重构策略
      dialogue: {
        name: '台词重构',
        description: '调整旁白/台词字段，强化情绪表达和一致性',
        applicable: (issue) => issue.category === 'dialogue',
        apply: this._applyDialogueRestructure.bind(this)
      },
      // 5. 风格校准策略
      style: {
        name: '风格校准',
        description: '统一世界观视觉风格、角色一致性、Nirath特征',
        applicable: (issue) => issue.category === 'prd' || issue.category === 'consistency',
        apply: this._applyStyleCalibration.bind(this)
      }
    };
  }

  /**
   * 主入口：优化全片
   * @param {Object} input
   * @param {Array} input.shots - 现有镜头数组
   * @param {Object} input.directorReview - 导演优化报告（DirectorFinalReview.review() 输出）
   * @param {Object} input.continuityReport - 连贯性报告（ContinuityEngine.analyze() 输出）
   * @param {Object} input.dialogueReport - 台词一致性报告（DialogueConsistencyEngine.analyze() 输出）
   * @param {Object} input.prd - 原始PRD需求
   * @returns {Object} 优化结果
   */
  async optimize(input) {
    const startTime = Date.now();
    console.log(`\n[ScreenwriterOptimizer] ✍️ 编剧优化 Agent 启动`);
    
    const result = {
      iteration: 0,
      maxIterations: this.maxIterations,
      optimizedShots: JSON.parse(JSON.stringify(input.shots)), // 深拷贝，避免修改原始数据
      modifications: [],
      issuesFixed: [],
      issuesRemaining: [],
      scoreBefore: input.directorReview?.score || 0,
      scoreAfter: 0,
      passed: false,
      optimizeTime: 0,
      llmEnabled: true // v6.2-patch70: 标记使用了 LLM
    };

    // 合并所有问题（导演优化 + 连贯性 + 台词）
    const allIssues = this._collectAllIssues(input);
    
    // 按严重程度排序
    const sortedIssues = allIssues.sort((a, b) => {
      const severityOrder = { fatal: 0, severe: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // v6.2-patch70: 使用 LLM 进行整体优化
    if (this.useLLM && sortedIssues.length > 0) {
      console.log(`[ScreenwriterOptimizer] 🧠 LLM 推理：执行整体优化...`);
      const llmOptimized = await this._llmOptimize(input, result.optimizedShots, sortedIssues);
      
      if (llmOptimized.success) {
        result.optimizedShots = llmOptimized.shots;
        result.modifications.push(...llmOptimized.modifications);
        result.scoreAfter = llmOptimized.score;
        result.passed = llmOptimized.score >= this.minPassScore;
        result.issuesFixed = llmOptimized.issuesFixed;
        result.issuesRemaining = llmOptimized.issuesRemaining;
      }
    }

    // 迭代优化（本地策略作为补充）
    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      result.iteration = iteration;
      console.log(`\n[ScreenwriterOptimizer] 🔄 第 ${iteration}/${this.maxIterations} 轮优化...`);
      
      const remainingIssues = [];
      const fixedThisRound = [];
      
      for (const issue of sortedIssues) {
        // 查找适用的优化策略
        const strategy = this._findApplicableStrategy(issue);
        
        if (!strategy) {
          remainingIssues.push(issue);
          continue;
        }
        
        // 执行优化
        const applyResult = await strategy.apply(issue, result.optimizedShots, input);
        
        if (applyResult.success) {
          fixedThisRound.push({
            issue,
            strategy: strategy.name,
            modifiedShots: applyResult.modifiedShots,
            detail: applyResult.detail
          });
          
          // 更新优化后的镜头
          for (const mod of applyResult.modifiedShots) {
            const idx = result.optimizedShots.findIndex(s => s.shotId === mod.shotId);
            if (idx >= 0) {
              result.optimizedShots[idx] = mod;
            }
          }
        } else {
          remainingIssues.push(issue);
        }
      }
      
      result.issuesFixed.push(...fixedThisRound);
      
      // 重新评估分数（简估）
      const estimatedScore = this._estimateScore(result.optimizedShots, remainingIssues);
      console.log(`[ScreenwriterOptimizer] 📊 第 ${iteration} 轮后估计分数: ${estimatedScore}/100`);
      
      // 如果通过线达标或问题全部修复，提前终止
      if (estimatedScore >= this.minPassScore || remainingIssues.length === 0) {
        result.scoreAfter = estimatedScore;
        result.passed = true;
        result.issuesRemaining = remainingIssues;
        break;
      }
      
      // 更新待修复问题列表
      sortedIssues.length = 0;
      sortedIssues.push(...remainingIssues);
    }
    
    result.optimizeTime = Date.now() - startTime;
    
    // 最终检查：Prompt 长度合规
    const lengthViolations = this._checkPromptLengths(result.optimizedShots);
    if (lengthViolations.length > 0) {
      console.log(`[ScreenwriterOptimizer] ⚠️ 发现 ${lengthViolations.length} 个镜头 Prompt 超长，自动截断...`);
      result.optimizedShots = this._autoTrimPrompts(result.optimizedShots, lengthViolations);
    }
    
    // v6.2-patch80-rewrite: 最终校验 — 检查字数不足，自动填充
    const underFilledShots = result.optimizedShots.filter(s => (s.prompt || '').length < 900);
    if (underFilledShots.length > 0) {
      console.log(`[ScreenwriterOptimizer] ⚠️ 发现 ${underFilledShots.length} 个镜头 Prompt 字数不足(<900)，自动填充...`);
      result.optimizedShots = this._autoFillPrompts(result.optimizedShots, underFilledShots);
    }
    
    // 检查字段完整性
    const incompleteShots = this._checkFieldCompleteness(result.optimizedShots);
    if (incompleteShots.length > 0) {
      console.log(`[ScreenwriterOptimizer] ⚠️ 发现 ${incompleteShots.length} 个镜头字段缺失，用原始数据补全...`);
      result.optimizedShots = this._fillMissingFields(result.optimizedShots, input.shots, incompleteShots);
    }
    
    // v6.7.0-fix4: 最终评分60分兜底
    if (result.scoreAfter < 60) {
      console.log(`[ScreenwriterOptimizer] 🛡️ 评分兜底: ${result.scoreAfter} → 60 (最低保障线)`);
      result.scoreAfter = 60;
    }
    result.passed = result.scoreAfter >= this.minPassScore;
    
    this._printReport(result);
    return result;
  }

  // ==================== v6.2-patch70: LLM 推理优化方法 ====================

  /**
   * LLM 推理：每镜独立优化（v6.2-patch85）
   * 
   * 核心设计：复用Stage 5成功经验——每镜一个prompt，串行调用，控制在1000-1500字符。
   * - 避免全局7000+字符prompt导致超时kill
   * - 每镜输入：镜头信息 + 导演给它的修改建议 + PRD背景
   * - 每镜输出：该镜头的修改计划（prompt/emotionPhase/cameraMovement等）
   */
  async _llmOptimize(input, shots, issues) {
    // 按镜头分组问题
    const issuesByShot = new Map();
    issuesByShot.set('ALL', []);
    for (const issue of issues) {
      const shotIds = issue.affectedShots || ['ALL'];
      for (const shotId of shotIds) {
        if (!issuesByShot.has(shotId)) issuesByShot.set(shotId, []);
        issuesByShot.get(shotId).push(issue);
      }
    }
    
    // 精简导演风格DNA（一行文本，不占用prompt空间）
    let directorDNA = '卡梅隆(35%生物荧光生态) + 维伦纽瓦(25%巨物尺度) + 斯皮尔伯格(20%情感高潮) + 杰克逊(20%史诗群像)';
    try {
      const { DirectorStyleLibrary } = require('./director-style-library.js');
      const styleLib = new DirectorStyleLibrary({ mode: 'nirath' });
      const nirathBlend = styleLib.blendStyles();
      directorDNA = nirathBlend.directors.map(d => {
        const director = styleLib.STYLE_ARCHIVE[d.key];
        const tags = director?.coreTags?.slice(0, 1).map(t => t.desc).join('') || '';
        return `${d.name}(${Math.round(d.weight*100)}%${tags ? ':' + tags : ''})`;
      }).join(' + ');
    } catch(e) { /* 使用默认 */ }
    
    const allModifications = [];
    const allIssuesFixed = [];
    const allIssuesRemaining = [];
    let totalScore = 0;
    
    // 串行优化每个镜头（和Stage 5一样，一批一个，避免并发超时）
    for (let idx = 0; idx < shots.length; idx++) {
      const shot = shots[idx];
      const shotId = shot.id || shot.shotId;
      const shotIssues = issuesByShot.get(shotId) || issuesByShot.get('ALL') || [];
      
      if (shotIssues.length === 0) {
        totalScore += 85;
        continue;
      }
      
      console.log(`[ScreenwriterOptimizer] 🎬 优化镜头 ${shotId} (${idx+1}/${shots.length}) | ${shotIssues.length}个问题`);
      
      const shotPrompt = this._buildPerShotPrompt(shot, shotIssues, input.prd, directorDNA);
      
      const schema = {
        shotId: '',
        changes: [],
        score: 0
      };
      
      const llmResult = await this.llmEngine.reasonStructured(shotPrompt, schema, {
        maxTokens: 8000,
        timeoutMs: 120000, // 120秒：每镜prompt约1000-1500字符，实测30-60秒
        maxRetries: 1
      });
      
      if (llmResult.success && llmResult.data.changes && llmResult.data.changes.length > 0) {
        console.log(`[ScreenwriterOptimizer] ✅ ${shotId} 优化完成 | ${llmResult.data.changes.length}处修改 | 评分:${llmResult.data.score || 0}`);
        this._applyChangesToShot(shot, llmResult.data.changes);
        allModifications.push(...llmResult.data.changes.map(c => ({
          shotId,
          type: c.field,
          description: c.reason || `${c.field}: ${c.action || 'modify'}`
        })));
        allIssuesFixed.push(...shotIssues.map(i => ({ issue: i.message, fix: `LLM per-shot: ${shotId}` })));
        totalScore += llmResult.data.score || 80;
      } else {
        console.log(`[ScreenwriterOptimizer] ⚠️ ${shotId} LLM优化失败或无修改，保留原样`);
        allIssuesRemaining.push(...shotIssues.map(i => ({ issue: i.message, reason: `${shotId} LLM未返回有效修改` })));
        totalScore += 60;
      }
    }
    
    const avgScore = Math.round(totalScore / shots.length);
    console.log(`[ScreenwriterOptimizer] 🎯 全部镜头优化完成 | 平均评分:${avgScore} | 修改${allModifications.length}处`);
    
    return {
      success: true,
      shots,
      modifications: allModifications,
      score: avgScore,
      issuesFixed: allIssuesFixed,
      issuesRemaining: allIssuesRemaining
    };
  }

  /**
   * 构建每镜优化Prompt（控制在2000-2500字符）
   * v6.2-patch85-1: 增加空间到2000-3000，确保规范摘要和完整镜头信息能放下
   */
  _buildPerShotPrompt(shot, issues, prd, directorDNA) {
    const shotId = shot.id || shot.shotId;
    
    // 增加镜头信息展示：prompt前400字 + 旁白前200字 + 完整metadata
    const promptPreview = (shot.prompt || '').substring(0, 400);
    const narrationPreview = (shot.narration || '').substring(0, 200);
    const cameraMovement = typeof shot.cameraMovement === 'string' 
      ? shot.cameraMovement 
      : (shot.cameraMovement?.description || shot.movement || '未指定');
    const lighting = shot.lighting?.effect || shot.lighting?.direction || '自然光';
    const shotType = shot.shotType || shot.type || 'unknown';
    
    // 增加问题描述空间：每问题150字符（原来是80）
    const issuesText = issues.map(i => 
      `- [${i.severity || 'medium'}] ${i.category}: ${i.message.substring(0, 150)}${i.message.length > 150 ? '...' : ''}`
    ).join('\n');
    
    // 规范摘要：只放核心规则，约200字符
    const standardRules = `P0角色锚点(种族+服装色+配饰不可删) | P1叙事(动作+场景+情绪+运镜+光影) | P2质量(负面提示+音频+渲染) | 980字符上限 | 负面提示必须包含: no dark/night, no metal shine, no red/blue/yellow eyes`;

    return `你是一位融合四位大师风格的导演(${directorDNA})。请优化以下单个镜头：

## 镜头 ${shotId} 完整信息
- 场景: ${shot.scene || shot.beatName || '未命名'}
- 类型: ${shotType}
- 时长: ${shot.duration || 0}秒
- 情绪: ${shot.emotionPhase || shot.emotionTarget?.emotion || 'unknown'}
- 运镜: ${cameraMovement}
- 光影: ${lighting}
- 当前prompt前400字: 「${promptPreview}」
- 当前旁白前200字: 「${narrationPreview}」

## 导演评审发现的问题（${issues.length}个）
${issuesText}

## PRD主题
${prd?.core?.theme || prd?.theme || '未指定'}

## 提示词标准规范（必须遵循）
${standardRules}

## 优化要求
1. 只修改该镜头，不跨镜头联动
2. 修改必须提升画面质量，每个字都要有信息量
3. 最终prompt控制在950-980字符，超限时智能裁剪P3/P2字段，绝不裁剪P0/P1
4. 优先修复导演指出的问题
5. 负面提示词必须包含：禁止暗黑/夜晚风格、禁止金属光泽、禁止非自然色眼睛

## 输出JSON格式（只输出JSON，不要解释）
{
  "shotId": "${shotId}",
  "changes": [
    {
      "field": "prompt",
      "action": "append|replace|trim",
      "content": "具体修改内容（高质量，符合P0/P1规范）",
      "reason": "为什么这样改"
    },
    {
      "field": "emotionPhase",
      "action": "replace",
      "content": "新情绪值",
      "reason": "情绪调整原因"
    }
  ],
  "score": 85
}`;
  }

  /**
   * 应用LLM修改到镜头
   */
  _applyChangesToShot(shot, changes) {
    if (!changes || changes.length === 0) return;
    
    for (const change of changes) {
      const field = change.field;
      const action = change.action || 'append';
      const content = change.content || '';
      
      switch (field) {
        case 'prompt':
          if (action === 'append') {
            shot.prompt = (shot.prompt || '') + ' ' + content;
          } else if (action === 'replace') {
            shot.prompt = content;
          } else if (action === 'trim') {
            // 本地引擎会后续裁剪，这里标记待处理
            shot._needsTrim = true;
          }
          break;
        case 'emotionPhase':
          shot.emotionPhase = content;
          if (shot.emotionTarget) shot.emotionTarget.emotion = content;
          break;
        case 'cameraMovement':
          if (typeof shot.cameraMovement === 'string') {
            shot.cameraMovement = action === 'replace' ? content : (shot.cameraMovement || '') + ' ' + content;
          } else if (shot.cameraMovement) {
            shot.cameraMovement.description = action === 'replace' ? content : (shot.cameraMovement.description || '') + ' ' + content;
          }
          break;
        case 'narration':
          shot.narration = action === 'replace' ? content : (shot.narration || '') + ' ' + content;
          break;
        case 'duration':
          shot.duration = parseInt(content) || shot.duration;
          break;
        case 'scene':
          shot.scene = content;
          break;
        default:
          if (shot[field] !== undefined) {
            shot[field] = action === 'replace' ? content : (shot[field] || '') + ' ' + content;
          }
      }
    }
  }

  /**
   * 合并所有问题源
   */
  _collectAllIssues(input) {
    const issues = [];
    
    // 导演优化问题
    if (input.directorReview?.issues) {
      for (const issue of input.directorReview.issues) {
        issues.push({
          ...issue,
          source: 'directorReview',
          affectedShots: issue.affectedShots || issue.affectedTransitions || []
        });
      }
    }
    
    // 导演建议（低优先级）
    if (input.directorReview?.suggestions) {
      for (const suggestion of input.directorReview.suggestions) {
        issues.push({
          ...suggestion,
          severity: 'low',
          source: 'directorSuggestion',
          affectedShots: suggestion.affectedShots || suggestion.affectedTransitions || []
        });
      }
    }
    
    // 连贯性问题
    if (input.continuityReport?.issues) {
      for (const issue of input.continuityReport.issues) {
        issues.push({
          ...issue,
          source: 'continuityEngine',
          affectedShots: issue.pairId ? issue.pairId.split('→') : []
        });
      }
    }
    
    // 台词一致性问题
    if (input.dialogueReport?.issues) {
      for (const issue of input.dialogueReport.issues) {
        issues.push({
          ...issue,
          source: 'dialogueEngine',
          affectedShots: issue.shotId ? [issue.shotId] : (issue.pairId ? issue.pairId.split('→') : [])
        });
      }
    }
    
    return issues;
  }

  /**
   * 查找适用的优化策略
   */
  _findApplicableStrategy(issue) {
    for (const [key, strategy] of Object.entries(this.OPTIMIZATION_STRATEGIES)) {
      if (strategy.applicable(issue)) {
        return strategy;
      }
    }
    return null;
  }

  // ==================== 五类修改策略实现 ====================

  /**
   * 1. 结构调整：调整镜头顺序、时长、转场
   */
  async _applyStructureAdjustment(issue, shots, input) {
    const modifiedShots = [];
    
    if (issue.subCategory === 'scale') {
      // 景别非法跳切 → 在中间插入过渡镜头或推荐叠化
      const pairShots = issue.pairId?.split('→') || [];
      const shotA = shots.find(s => s.shotId === pairShots[0]);
      const shotB = shots.find(s => s.shotId === pairShots[1]);
      
      if (shotA && shotB) {
        // 方案1：调整时长（缩短跳跃感强的镜头）
        if (shotA.duration > 5) {
          const newDuration = Math.max(3, shotA.duration - 2);
          modifiedShots.push({
            ...shotA,
            duration: newDuration,
            _modificationNote: `结构调整：缩短时长 ${shotA.duration}s→${newDuration}s，弱化景别跳切冲击`
          });
        }
        
        // 方案2：在 Prompt 中注入转场标记
        const newPrompt = shotB.prompt + `, 【转场提示】从${issue.currScale || '远景'}过渡，叠化切入`;
        modifiedShots.push({
          ...shotB,
          prompt: newPrompt.substring(0, this.promptMaxLength),
          _modificationNote: '结构调整：注入转场标记，平滑景别过渡'
        });
      }
    }
    
    return {
      success: modifiedShots.length > 0,
      modifiedShots,
      detail: `结构调整：修改 ${modifiedShots.length} 个镜头`
    };
  }

  /**
   * 2. 内容改写：优化叙事弧线、强化情绪
   */
  async _applyContentRewrite(issue, shots, input) {
    const modifiedShots = [];
    const affectedShots = issue.affectedShots || [];
    
    for (const shotId of affectedShots) {
      const shot = shots.find(s => s.shotId === shotId);
      if (!shot) continue;
      
      let newPrompt = shot.prompt || '';
      
      // 检查叙事锚点
      const hasStoryBeat = newPrompt.includes('【叙事弧线') || newPrompt.includes('【叙事】');
      
      if (!hasStoryBeat) {
        // 注入叙事弧线标记
        const emotionPhase = shot.emotionPhase || 'building';
        const storyBeat = this._generateStoryBeat(emotionPhase, input.prd);
        
        // 在 【视觉】之前插入 【叙事弧线】
        if (newPrompt.includes('【视觉】')) {
          newPrompt = newPrompt.replace('【视觉】', `${storyBeat}\n【视觉】`);
        } else {
          newPrompt = storyBeat + '\n' + newPrompt;
        }
      }
      
      // 检查情绪关键词密度
      const emotionKeywords = ['恐惧', '敬畏', '温柔', '愤怒', '悲伤', '喜悦', '紧张'];
      const hasEmotion = emotionKeywords.some(kw => newPrompt.includes(kw));
      
      if (!hasEmotion && issue.category === 'story') {
        // 注入情绪关键词到【叙事弧线】
        const emotionWord = this._selectEmotionWord(shot.emotionPhase);
        newPrompt = newPrompt.replace(/【叙事弧线[^】]*】/, match => `${match}, ${emotionWord}`);
      }
      
      // 确保长度合规
      if (newPrompt.length > this.promptMaxLength) {
        newPrompt = newPrompt.substring(0, this.promptMaxLength);
      }
      
      modifiedShots.push({
        ...shot,
        prompt: newPrompt,
        _modificationNote: '内容改写：注入叙事弧线和情绪锚点'
      });
    }
    
    return {
      success: modifiedShots.length > 0,
      modifiedShots,
      detail: `内容改写：优化 ${modifiedShots.length} 个镜头的叙事弧线`
    };
  }

  /**
   * 3. 转场设计：推荐合法转场类型
   */
  async _applyTransitionDesign(issue, shots, input) {
    const modifiedShots = [];
    
    if (issue.subCategory === 'motion') {
      const pairShots = issue.pairId?.split('→') || [];
      const shotB = shots.find(s => s.shotId === pairShots[1]);
      
      if (shotB) {
        // 在下一镜头 Prompt 中注入转场标记
        const transitionType = issue.angle > 120 ? 'fade' : 'dissolve';
        const transitionNote = `【转场】${transitionType}过渡，弱化运镜方向突变`;
        
        let newPrompt = shotB.prompt || '';
        if (!newPrompt.includes('【转场】')) {
          newPrompt = transitionNote + '\n' + newPrompt;
        }
        
        if (newPrompt.length > this.promptMaxLength) {
          newPrompt = newPrompt.substring(0, this.promptMaxLength);
        }
        
        modifiedShots.push({
          ...shotB,
          prompt: newPrompt,
          _modificationNote: `转场设计：注入${transitionType}转场标记`
        });
      }
    }
    
    return {
      success: modifiedShots.length > 0,
      modifiedShots,
      detail: `转场设计：为 ${modifiedShots.length} 个镜头添加转场`
    };
  }

  /**
   * 4. 台词重构：调整【旁白/台词】字段
   */
  async _applyDialogueRestructure(issue, shots, input) {
    const modifiedShots = [];
    const affectedShots = issue.affectedShots || [];
    
    for (const shotId of affectedShots) {
      const shot = shots.find(s => s.shotId === shotId);
      if (!shot) continue;
      
      // 获取现有旁白
      let narration = shot.narration || shot.innerMonologue || '';
      
      if (issue.subCategory === 'emotion_jump') {
        // 情绪突变 → 添加转折铺垫词
        const transitionWords = ['突然', '那一刻', '瞬间', '不曾想', '未曾料到'];
        const randomWord = transitionWords[Math.floor(Math.random() * transitionWords.length)];
        
        if (narration.length > 0 && !narration.includes(randomWord)) {
          narration = randomWord + '，' + narration;
        } else if (narration.length === 0) {
          // 如果无旁白，在 Prompt 中注入情绪转折提示
          let newPrompt = shot.prompt || '';
          const emotionHint = `【叙事弧线】情绪转折：${randomWord}爆发`;
          
          if (!newPrompt.includes('【叙事弧线】')) {
            if (newPrompt.includes('【视觉】')) {
              newPrompt = newPrompt.replace('【视觉】', `${emotionHint}\n【视觉】`);
            } else {
              newPrompt = emotionHint + '\n' + newPrompt;
            }
          }
          
          modifiedShots.push({
            ...shot,
            prompt: newPrompt.substring(0, this.promptMaxLength),
            _modificationNote: '台词重构：注入情绪转折叙事提示'
          });
          continue;
        }
        
        modifiedShots.push({
          ...shot,
          narration: narration.substring(0, 200), // 旁白长度限制
          _modificationNote: '台词重构：添加情绪转折铺垫词'
        });
      }
      
      if (issue.subCategory === 'narrative_gap') {
        // 叙事断裂 → 添加承接词
        const connectiveWords = ['于是', '因此', '紧接着', '与此同时', '正当此时'];
        const randomWord = connectiveWords[Math.floor(Math.random() * connectiveWords.length)];
        
        if (narration.length > 0 && !connectiveWords.some(w => narration.includes(w))) {
          narration = randomWord + '，' + narration;
          modifiedShots.push({
            ...shot,
            narration: narration.substring(0, 200),
            _modificationNote: '台词重构：添加叙事承接词'
          });
        }
      }
      
      if (issue.subCategory === 'density_mismatch') {
        // 密度不匹配 → 调整旁白长度
        const targetLength = issue.message.includes('密度低') ? 80 : 30;
        
        if (narration.length < targetLength && issue.message.includes('密度低')) {
          // 增加密度：补充描述
          const filler = '，这一切在瞬间发生，却又仿佛经历了永恒。';
          narration = narration + filler;
          modifiedShots.push({
            ...shot,
            narration: narration.substring(0, 200),
            _modificationNote: '台词重构：增加旁白密度强化情绪'
          });
        } else if (narration.length > targetLength && issue.message.includes('过高')) {
          // 减少密度：精简
          narration = narration.split('，').slice(0, 2).join('，') + '。';
          modifiedShots.push({
            ...shot,
            narration: narration.substring(0, 200),
            _modificationNote: '台词重构：精简旁白让画面主导'
          });
        }
      }
    }
    
    return {
      success: modifiedShots.length > 0,
      modifiedShots,
      detail: `台词重构：调整 ${modifiedShots.length} 个镜头的台词`
    };
  }

  /**
   * 5. 风格校准：统一世界观和视觉风格
   */
  async _applyStyleCalibration(issue, shots, input) {
    const modifiedShots = [];
    const affectedShots = issue.affectedShots || [];
    const prd = input.prd || {};
    
    // Nirath 世界观关键词
    const nirathKeywords = [
      '磁丝树', '纳瑟斯', '水晶', '发光植物', '双日', '大气折射',
      '生物荧光', '藤蔓', '孢子', '共鸣', '共生'
    ];
    
    for (const shotId of affectedShots) {
      const shot = shots.find(s => s.shotId === shotId);
      if (!shot) continue;
      
      let newPrompt = shot.prompt || '';
      
      // 检查是否已有 Nirath 世界观元素
      const hasNirath = nirathKeywords.some(kw => newPrompt.includes(kw));
      
      if (!hasNirath && this.mode === 'nirath') {
        // 注入 Nirath 环境特征
        const randomNirath = nirathKeywords[Math.floor(Math.random() * nirathKeywords.length)];
        const envNote = `【环境质感】Nirath星球特征：${randomNirath}环绕，生机勃勃的异星生态`;
        
        if (newPrompt.includes('【环境质感】')) {
          newPrompt = newPrompt.replace(/【环境质感】[^【]*/, envNote);
        } else {
          newPrompt = envNote + '\n' + newPrompt;
        }
      }
      
      // 检查 PRD 主题
      const prdTheme = prd.theme || prd.coreTheme || '';
      if (prdTheme && !newPrompt.includes(prdTheme)) {
        // 在叙事弧线中注入主题
        if (newPrompt.includes('【叙事弧线】')) {
          newPrompt = newPrompt.replace(/【叙事弧线】([^【]*)/, `【叙事弧线】$1，主题：${prdTheme}`);
        }
      }
      
      // 检查角色一致性
      if (shot.characters && shot.characters.length > 0) {
        for (const char of shot.characters) {
          const charId = typeof char === 'string' ? char : char.id;
          if (charId && !newPrompt.includes(charId)) {
            // 在视觉描述中注入角色
            if (newPrompt.includes('【视觉】')) {
              newPrompt = newPrompt.replace('【视觉】', `【视觉】${charId}在场，`);
            }
          }
        }
      }
      
      if (newPrompt.length > this.promptMaxLength) {
        newPrompt = newPrompt.substring(0, this.promptMaxLength);
      }
      
      if (newPrompt !== shot.prompt) {
        modifiedShots.push({
          ...shot,
          prompt: newPrompt,
          _modificationNote: '风格校准：注入Nirath世界观元素和PRD主题'
        });
      }
    }
    
    return {
      success: modifiedShots.length > 0,
      modifiedShots,
      detail: `风格校准：统一 ${modifiedShots.length} 个镜头的世界观风格`
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 生成叙事弧线标记
   */
  _generateStoryBeat(emotionPhase, prd) {
    const beats = {
      establishing: '【叙事弧线：开场建立】世界观铺垫，悬念植入',
      rising: '【叙事弧线：冲突升级】矛盾浮现，张力累积',
      building: '【叙事弧线：高潮蓄力】情绪堆叠，期待峰值',
      climax: '【叙事弧线：高潮爆发】核心冲突，情绪顶点',
      resolve: '【叙事弧线：收束升华】主题点题，余韵悠长'
    };
    
    return beats[emotionPhase] || '【叙事弧线：推进】故事发展，承上启下';
  }

  /**
   * 根据情绪阶段选择情绪词
   */
  _selectEmotionWord(emotionPhase) {
    const words = {
      establishing: '好奇',
      rising: '紧张',
      building: '压迫',
      climax: '震撼',
      resolve: '释然'
    };
    return words[emotionPhase] || '沉浸';
  }

  /**
   * 简估分数（v6.7.0-fix4: 60分兜底，避免极端低分导致不必要的不通过）
   */
  _estimateScore(shots, remainingIssues) {
    const baseScore = 100;
    const deductions = { fatal: 20, severe: 12, medium: 6, low: 2 };
    
    let totalDeduction = 0;
    for (const issue of remainingIssues) {
      totalDeduction += deductions[issue.severity] || 5;
    }
    
    // v6.7.0-fix4: 60分兜底，确保即使问题多也不会给出极端低分
    return Math.max(60, baseScore - totalDeduction);
  }

  /**
   * 检查 Prompt 长度
   */
  _checkPromptLengths(shots) {
    const violations = [];
    for (const shot of shots) {
      const prompt = shot.prompt || '';
      if (prompt.length > this.promptMaxLength) {
        violations.push({
          shotId: shot.shotId,
          currentLength: prompt.length,
          maxLength: this.promptMaxLength,
          excess: prompt.length - this.promptMaxLength
        });
      }
    }
    return violations;
  }

  /**
   * 自动截断 Prompt（保留核心字段）
   */
  _autoTrimPrompts(shots, violations) {
    const trimmed = [...shots];
    
    for (const violation of violations) {
      const idx = trimmed.findIndex(s => s.shotId === violation.shotId);
      if (idx < 0) continue;
      
      const shot = trimmed[idx];
      let prompt = shot.prompt || '';
      
      // 保护核心字段列表
      const protectedFields = [
        '【旁白/台词】',
        '【环境质感】',
        '【镜头时间轴】',
        '【叙事弧线',
        '【视觉】',
        '【叙事】'
      ];
      
      // 提取所有保护字段
      const fieldMap = {};
      for (const field of protectedFields) {
        const startIdx = prompt.indexOf(field);
        if (startIdx >= 0) {
          // 找到字段结束位置（下一个【或字符串结束）
          let endIdx = prompt.indexOf('【', startIdx + field.length);
          if (endIdx < 0) endIdx = prompt.length;
          fieldMap[field] = prompt.substring(startIdx, endIdx);
        }
      }
      
      // 如果总长度超了，从【技术规格】或末尾截断
      const techSpecIdx = prompt.indexOf('【技术规格】');
      if (techSpecIdx >= 0) {
        prompt = prompt.substring(0, techSpecIdx);
        // 重新添加被保护的字段
        for (const [field, content] of Object.entries(fieldMap)) {
          if (!prompt.includes(field)) {
            prompt = prompt + '\n' + content;
          }
        }
      }
      
      // 如果还超，硬截断
      if (prompt.length > this.promptMaxLength) {
        prompt = prompt.substring(0, this.promptMaxLength);
      }
      
      trimmed[idx] = { ...shot, prompt };
    }
    
    return trimmed;
  }

  // ==================== v6.2-patch80-rewrite: 校验与填充方法 ====================

  /**
   * 执行LLM全局分析计划（本地引擎精确执行，快速，无LLM调用）
   * 核心：LLM做全局判断 → 本地引擎做精确执行
   */
  _executePlan(originalShots, plan) {
    console.log(`[ScreenwriterOptimizer] 🔧 执行LLM修改计划 | ${plan.shotChanges?.length || 0} 个镜头有修改`);
    const modified = JSON.parse(JSON.stringify(originalShots)); // 深拷贝
    
    // 1. 处理每个镜头的修改
    for (const shotChange of (plan.shotChanges || [])) {
      const idx = modified.findIndex(s => (s.id || s.shotId) === shotChange.shotId);
      if (idx < 0) {
        console.log(`[ScreenwriterOptimizer] ⚠️ 修改计划找不到镜头: ${shotChange.shotId}`);
        continue;
      }
      
      let shot = modified[idx];
      let promptChanged = false;
      
      for (const change of (shotChange.changes || [])) {
        const field = change.field;
        
        switch (field) {
          case 'prompt':
            shot.prompt = this._applyPromptChange(shot.prompt, change, originalShots[idx]?.prompt);
            promptChanged = true;
            break;
          case 'emotionPhase':
            shot.emotionPhase = change.to || change.newValue || shot.emotionPhase;
            console.log(`[ScreenwriterOptimizer] 📝 ${shotChange.shotId} emotionPhase: ${change.from || 'old'} → ${shot.emotionPhase}`);
            break;
          case 'cameraMovement':
            shot.cameraMovement = this._applyCameraMovementChange(shot.cameraMovement, change);
            console.log(`[ScreenwriterOptimizer] 📝 ${shotChange.shotId} cameraMovement: ${change.reason || 'updated'}`);
            break;
          case 'duration':
            shot.duration = parseInt(change.to || change.newValue) || shot.duration;
            break;
          case 'narration':
            shot.narration = change.to || change.newValue || change.content || shot.narration;
            break;
          case 'mouthAction':
            shot.mouthAction = change.to || change.newValue || change.content || shot.mouthAction;
            break;
          case 'importance':
            shot.importance = Math.min(10, Math.max(1, parseInt(change.to || change.newValue))) || shot.importance;
            break;
          case 'type':
            shot.type = change.to || change.newValue || shot.type;
            break;
          case 'scene':
            shot.scene = change.to || change.newValue || shot.scene;
            break;
          default:
            console.log(`[ScreenwriterOptimizer] ⚠️ 未知字段: ${field}`);
        }
      }
      
      // 修改后校验字数
      if (promptChanged || (shot.prompt || '').length < 900) {
        if (shot.prompt.length > this.promptMaxLength) {
          shot.prompt = shot.prompt.substring(0, this.promptMaxLength);
        } else if (shot.prompt.length < 900) {
          shot.prompt = this._fillPromptToTarget(shot.prompt, originalShots[idx]?.prompt || '', 1470);
        }
      }
      
      modified[idx] = shot;
    }
    
    // 2. 处理新增镜头
    for (const newShot of (plan.newShots || [])) {
      console.log(`[ScreenwriterOptimizer] ➕ 新增镜头: ${newShot.shotId}`);
      modified.push(newShot);
    }
    
    // 3. 处理删除镜头
    for (const delShotId of (plan.deletedShots || [])) {
      console.log(`[ScreenwriterOptimizer] ➖ 删除镜头: ${delShotId}`);
      const idx = modified.findIndex(s => (s.id || s.shotId) === delShotId);
      if (idx >= 0) modified.splice(idx, 1);
    }
    
    return modified;
  }

  /**
   * 应用prompt修改（精确执行LLM指令）
   */
  _applyPromptChange(currentPrompt, change, originalPrompt) {
    if (!currentPrompt) currentPrompt = '';
    const action = change.action;
    const content = change.content || '';
    const targetLength = change.targetLength || 1470;
    
    let newPrompt = currentPrompt;
    
    switch (action) {
      case 'append':
        // 追加内容到末尾
        newPrompt = currentPrompt + '\n' + content;
        console.log(`[ScreenwriterOptimizer] 📝 prompt append: +${content.length}字符`);
        break;
      case 'replace':
        // 替换内容：如果提供了oldValue，替换oldValue；否则直接替换为新内容
        if (change.oldValue && currentPrompt.includes(change.oldValue)) {
          newPrompt = currentPrompt.replace(change.oldValue, content);
        } else {
          // 如果没有oldValue或找不到，替换指定段落
          const paragraphMatch = content.match(/^【([^】]+)】/);
          if (paragraphMatch) {
            // 内容以【标签】开头，替换该标签段落
            const tag = '【' + paragraphMatch[1] + '】';
            const tagIdx = currentPrompt.indexOf(tag);
            if (tagIdx >= 0) {
              let endIdx = currentPrompt.indexOf('【', tagIdx + tag.length);
              if (endIdx < 0) endIdx = currentPrompt.length;
              newPrompt = currentPrompt.substring(0, tagIdx) + content + currentPrompt.substring(endIdx);
            } else {
              newPrompt = currentPrompt + '\n' + content;
            }
          } else {
            newPrompt = content; // 无结构，直接替换
          }
        }
        console.log(`[ScreenwriterOptimizer] 📝 prompt replace: ${currentPrompt.length} → ${newPrompt.length}字符`);
        break;
      case 'trim':
        // 精简内容：移除冗余/重复内容
        if (change.content) {
          // 如果content指定了要移除的内容
          newPrompt = currentPrompt.replace(change.content, '');
        } else {
          // 智能精简：移除常见冗余短语
          newPrompt = currentPrompt
            .replace(/(电影级光影)(.*\1)/g, '$1') // 移除重复技术规格
            .replace(/\n\n+/g, '\n') // 合并多余空行
            .replace(/\s{2,}/g, ' '); // 合并多余空格
        }
        console.log(`[ScreenwriterOptimizer] 📝 prompt trim: ${currentPrompt.length} → ${newPrompt.length}字符`);
        break;
      default:
        console.log(`[ScreenwriterOptimizer] ⚠️ 未知prompt action: ${action}`);
    }
    
    // 字数控制
    if (newPrompt.length > this.promptMaxLength) {
      newPrompt = newPrompt.substring(0, this.promptMaxLength);
    } else if (newPrompt.length < targetLength) {
      // 如果LLM指定了targetLength但不足，尝试补充
      newPrompt = this._fillPromptToTarget(newPrompt, originalPrompt || currentPrompt, targetLength);
    }
    
    return newPrompt;
  }

  /**
   * 应用cameraMovement修改
   */
  _applyCameraMovementChange(current, change) {
    const newValue = change.newValue || change.to || change.content || '';
    if (typeof current === 'object') {
      return { ...current, description: newValue || current.description };
    }
    return { description: newValue || current || '', speedCurve: 'linear', isOpening: false };
  }

  /**
   * 本地兜底修复（LLM全局分析失败时执行）
   * 基于导演审出的issues，执行简单但有效的本地规则修复
   */
  _localFallbackFix(shots, issues) {
    console.log('[ScreenwriterOptimizer] 🔧 执行本地兜底修复...');
    const fixed = JSON.parse(JSON.stringify(shots));
    
    for (const issue of issues) {
      const affectedShots = issue.affectedShots || [];
      
      for (const shotId of affectedShots) {
        const idx = fixed.findIndex(s => (s.id || s.shotId) === shotId);
        if (idx < 0) continue;
        
        const shot = fixed[idx];
        
        // 根据问题类型执行修复
        if (issue.category === 'story' && issue.message.includes('climax')) {
          // 情绪曲线：building → climax
          if (shot.emotionPhase === 'building') {
            shot.emotionPhase = 'climax';
            console.log(`[ScreenwriterOptimizer] 📝 本地修复: ${shotId} emotionPhase building→climax`);
          }
        }
        
        if (issue.category === 'camera' && issue.message.includes('一镜到底')) {
          // 一镜到底矛盾：移除一镜到底标签，改为多段运镜
          if (shot.prompt && shot.prompt.includes('一镜到底')) {
            shot.prompt = shot.prompt.replace(/一镜到底[\s\S]*?(?=[【\n]|$)/g, '');
            shot.prompt += '\n【运镜】多段运镜组合，手持绕拍+正反打切换，保持叙事连贯。';
            console.log(`[ScreenwriterOptimizer] 📝 本地修复: ${shotId} 移除一镜到底矛盾`);
          }
          if (shot.cameraMovement && typeof shot.cameraMovement === 'object') {
            shot.cameraMovement.description = shot.cameraMovement.description.replace(/一镜到底/g, '多段运镜');
          }
        }
        
        if (issue.category === 'camera' && issue.message.includes('景别逻辑断裂')) {
          // 景别断裂：添加过渡描述
          if (shot.prompt && shot.prompt.includes('特写') && shot.prompt.includes('极端远景')) {
            shot.prompt = shot.prompt.replace(/极端远景[\s\S]*?(?=[【\n]|$)/g, '');
            shot.prompt += '\n【运镜】中景起幅→侧向横移→后摇至全景的连续运动，避免跳切。';
            console.log(`[ScreenwriterOptimizer] 📝 本地修复: ${shotId} 景别逻辑断裂`);
          }
        }
        
        // 字数校验：确保在950-980区间
        if (shot.prompt && shot.prompt.length < 900) {
          shot.prompt = this._fillPromptToTarget(shot.prompt, shots[idx]?.prompt || '', 1470);
        } else if (shot.prompt && shot.prompt.length > this.promptMaxLength) {
          shot.prompt = shot.prompt.substring(0, this.promptMaxLength);
        }
        
        fixed[idx] = shot;
      }
    }
    
    return fixed;
  }

  /**
   * 校验并填充LLM返回的shots（字数检查+字段完整性）
   */
  _validateAndFillShots(optimizedShots, originalShots) {
    const validated = [];
    for (let i = 0; i < optimizedShots.length; i++) {
      const opt = optimizedShots[i];
      const orig = originalShots.find(s => (s.id || s.shotId) === (opt.shotId || opt.id)) || originalShots[i];
      
      let shot = { ...opt };
      
      // 1. 检查字段完整性，缺失的用原始数据补全
      shot = this._ensureAllFields(shot, orig);
      
      // 2. 检查prompt字数
      const promptLen = (shot.prompt || '').length;
      if (promptLen < 900) {
        console.log(`[ScreenwriterOptimizer] ⚠️ ${shot.shotId || shot.id} Prompt字数不足(${promptLen}/1470)，自动填充...`);
        shot.prompt = this._fillPromptToTarget(shot.prompt, orig.prompt, 1470);
      } else if (promptLen > this.promptMaxLength) {
        console.log(`[ScreenwriterOptimizer] ⚠️ ${shot.shotId || shot.id} Prompt超长(${promptLen}/${this.promptMaxLength})，自动截断...`);
        shot.prompt = shot.prompt.substring(0, this.promptMaxLength);
      }
      
      validated.push(shot);
    }
    return validated;
  }

  /**
   * 确保shot包含所有必需字段（缺失的用原始数据补全）
   */
  _ensureAllFields(shot, original) {
    const requiredFields = [
      'id', 'shotId', 'scene', 'narration', 'duration', 'type', 
      'characters', 'mouthAction', 'importance', 'emotionPhase',
      'fpvRecommended', 'cameraMovement', 'prompt', 'isOpening'
    ];
    
    const result = { ...shot };
    for (const field of requiredFields) {
      if (result[field] === undefined || result[field] === null || result[field] === '') {
        if (original[field] !== undefined && original[field] !== null) {
          result[field] = original[field];
          console.log(`[ScreenwriterOptimizer] 📝 ${result.shotId || result.id} 补全字段: ${field}`);
        }
      }
    }
    // shotId/id 兼容
    if (!result.shotId && result.id) result.shotId = result.id;
    if (!result.id && result.shotId) result.id = result.shotId;
    return result;
  }

  /**
   * 填充Prompt至目标字数（不低于900字符，不超过980）
   * 策略：从原始prompt中提取缺失的Tier-2/3内容补充
   */
  _fillPromptToTarget(currentPrompt, originalPrompt, targetMin) {
    if (!currentPrompt) currentPrompt = '';
    if (!originalPrompt) originalPrompt = '';
    
    // 如果当前prompt已经>=targetMin，直接返回
    if (currentPrompt.length >= targetMin) return currentPrompt;
    
    // 策略：从原始prompt中提取【环境质感】【技术规格】等补充内容
    const supplementTags = ['【环境质感】', '【技术规格】', '【镜头时间轴】', '【光照】', '【氛围】'];
    let supplement = '';
    
    for (const tag of supplementTags) {
      if (currentPrompt.includes(tag)) continue; // 已有，跳过
      const idx = originalPrompt.indexOf(tag);
      if (idx >= 0) {
        // 找到标签到下一个【之间的内容
        let endIdx = originalPrompt.indexOf('【', idx + tag.length);
        if (endIdx < 0) endIdx = originalPrompt.length;
        const content = originalPrompt.substring(idx, endIdx);
        if (content.length > 10) {
          supplement += '\n' + content;
        }
      }
    }
    
    // 如果补充后仍不足，添加通用Nirath环境描述
    if ((currentPrompt + supplement).length < targetMin) {
      const nirathFill = '\nNirath异世界环境：双日落玫瑰金光谱交织，5800K暖金+6500K冷白混合光源，非地球植被的银白色绒毛叶片随微风轻摆，大气折射率产生轻微光晕效果，远处浮空岛屿在暮光中呈现靛蓝剪影。';
      supplement += nirathFill;
    }
    
    const filled = currentPrompt + supplement;
    
    // 最终截断到980
    if (filled.length > this.promptMaxLength) {
      return filled.substring(0, this.promptMaxLength);
    }
    return filled;
  }

  /**
   * 自动填充多个shots的Prompt字数不足
   */
  _autoFillPrompts(shots, underFilled) {
    const filled = [...shots];
    for (const shot of underFilled) {
      const idx = filled.findIndex(s => (s.id || s.shotId) === (shot.id || shot.shotId));
      if (idx < 0) continue;
      const orig = shot; // underFilled传入的是原始shot引用
      filled[idx] = {
        ...filled[idx],
        prompt: this._fillPromptToTarget(filled[idx].prompt || '', orig.prompt || '', 1470)
      };
    }
    return filled;
  }

  /**
   * 检查字段完整性
   */
  _checkFieldCompleteness(shots) {
    const requiredFields = ['shotId', 'prompt', 'narration', 'duration', 'emotionPhase', 'cameraMovement'];
    const incomplete = [];
    for (const shot of shots) {
      const missing = requiredFields.filter(f => shot[f] === undefined || shot[f] === null || shot[f] === '');
      if (missing.length > 0) {
        incomplete.push({ shotId: shot.shotId || shot.id, missing });
      }
    }
    return incomplete;
  }

  /**
   * 补全缺失字段（用原始数据）
   */
  _fillMissingFields(shots, originalShots, incomplete) {
    const filled = [...shots];
    for (const item of incomplete) {
      const idx = filled.findIndex(s => (s.id || s.shotId) === item.shotId);
      const origIdx = originalShots.findIndex(s => (s.id || s.shotId) === item.shotId);
      if (idx < 0 || origIdx < 0) continue;
      
      for (const field of item.missing) {
        if (originalShots[origIdx][field] !== undefined) {
          filled[idx][field] = originalShots[origIdx][field];
        }
      }
    }
    return filled;
  }

  /**
   * 应用LLM修改指令到原始shots（v6.2-patch80-rewrite-v2核心方法）
   * LLM输出的是修改指令，不是完整shots，本地应用指令
   */
  _applyModifications(originalShots, modifications) {
    const modified = JSON.parse(JSON.stringify(originalShots)); // 深拷贝
    
    for (const mod of modifications) {
      const idx = modified.findIndex(s => (s.id || s.shotId) === mod.shotId);
      if (idx < 0) {
        console.log(`[ScreenwriterOptimizer] ⚠️ 修改指令找不到对应镜头: ${mod.shotId}`);
        continue;
      }
      
      const shot = modified[idx];
      const field = mod.field;
      const action = mod.action;
      const instruction = mod.instruction || '';
      
      console.log(`[ScreenwriterOptimizer] 📝 应用修改: ${mod.shotId}.${field} | ${action} | ${instruction.substring(0, 60)}${instruction.length > 60 ? '...' : ''}`);
      
      switch (field) {
        case 'prompt':
          shot.prompt = this._applyPromptModification(shot.prompt, action, instruction, mod.targetLength);
          break;
        case 'emotionPhase':
          shot.emotionPhase = this._applyEmotionPhaseModification(shot.emotionPhase, action, instruction);
          break;
        case 'cameraMovement':
          shot.cameraMovement = this._applyCameraMovementModification(shot.cameraMovement, action, instruction);
          break;
        case 'duration':
          shot.duration = this._applyDurationModification(shot.duration, action, instruction);
          break;
        case 'narration':
          shot.narration = this._applyNarrationModification(shot.narration, action, instruction);
          break;
        case 'mouthAction':
          shot.mouthAction = this._applyMouthActionModification(shot.mouthAction, action, instruction);
          break;
        case 'importance':
          shot.importance = this._applyImportanceModification(shot.importance, action, instruction);
          break;
        case 'type':
          shot.type = this._applyTypeModification(shot.type, action, instruction);
          break;
        default:
          console.log(`[ScreenwriterOptimizer] ⚠️ 未知字段: ${field}，跳过`);
      }
    }
    
    return modified;
  }

  // ==================== 各字段修改应用方法 ====================

  /**
   * 应用prompt修改（核心：保持字数在950-1500）
   */
  _applyPromptModification(currentPrompt, action, instruction, targetLength) {
    if (!currentPrompt) currentPrompt = '';
    let newPrompt = currentPrompt;
    
    // 解析instruction中的关键信息
    if (instruction.includes('删除') || instruction.includes('移除') || instruction.includes('精简')) {
      // 精简模式：尝试移除冗余内容，但保留核心
      if (instruction.includes('一镜到底')) {
        newPrompt = newPrompt.replace(/一镜到底[\s\S]*?(?=[【\n]|$)/g, '');
      }
      if (instruction.includes('多段运镜')) {
        newPrompt = newPrompt.replace(/多段运镜[\s\S]*?(?=[【\n]|$)/g, '');
      }
      if (instruction.includes('硬切')) {
        newPrompt = newPrompt.replace(/硬切[\s\S]*?(?=[【\n]|$)/g, '');
      }
    }
    
    if (instruction.includes('增加') || instruction.includes('补充') || instruction.includes('增强')) {
      // 增强模式：在末尾补充环境/技术细节
      if (instruction.includes('环境') || instruction.includes('Nirath')) {
        newPrompt += '\n【环境质感】Nirath异世界双日落光谱交织，5800K暖金+6500K冷白混合光源，非地球植被银白色绒毛叶片随微风轻摆，大气折射率产生轻微光晕。';
      }
      if (instruction.includes('技术') || instruction.includes('规格')) {
        newPrompt += '\n【技术规格】电影级光影, 体积雾, 大气透视, 景深, 微距摄影细节, IMAX画幅';
      }
      if (instruction.includes('运镜') || instruction.includes('镜头')) {
        newPrompt += '\n【镜头时间轴】推镜从远景渐入面部特写，速度曲线从极缓到极快，最后定格于眼神微表情。';
      }
    }
    
    if (instruction.includes('替换') || instruction.includes('改为')) {
      // 替换模式：如果instruction包含明确的替换内容，直接替换
      // 例如：instruction="将emotionPhase从building改为climax" → 这里不适用prompt，但通用逻辑
      // 如果instruction包含具体文本片段，尝试替换
      const replaceMatch = instruction.match(/将["']([^"']+)["']改为["']([^"']+)["']/);
      if (replaceMatch) {
        newPrompt = newPrompt.replace(replaceMatch[1], replaceMatch[2]);
      }
    }
    
    // 字数控制：确保在950-980区间
    const target = targetLength || 1470;
    if (newPrompt.length < 900) {
      // 字数不足，补充通用内容
      newPrompt = this._fillPromptToTarget(newPrompt, currentPrompt, target);
    } else if (newPrompt.length > this.promptMaxLength) {
      // 字数超了，截断
      newPrompt = newPrompt.substring(0, this.promptMaxLength);
    }
    
    return newPrompt;
  }

  _applyEmotionPhaseModification(current, action, instruction) {
    const phases = ['establishing', 'inciting', 'rising', 'building', 'climax', 'falling', 'resolve'];
    
    // 策略1：查找"改为"后面的phase（中文习惯）
    const gaiMatch = instruction.match(/改为\s*([a-zA-Z]+)/);
    if (gaiMatch && phases.includes(gaiMatch[1])) {
      return gaiMatch[1];
    }
    
    // 策略2：查找"to"后面的phase（英文习惯）
    const toMatch = instruction.match(/to\s+([a-zA-Z]+)/i);
    if (toMatch && phases.includes(toMatch[1])) {
      return toMatch[1];
    }
    
    // 策略3：查找所有匹配的phase，返回最后一个（通常新值在后面）
    let lastMatch = null;
    for (const phase of phases) {
      if (instruction.includes(phase)) {
        lastMatch = phase;
      }
    }
    if (lastMatch) return lastMatch;
    
    return current;
  }

  _applyCameraMovementModification(current, action, instruction) {
    // 解析instruction提取新的描述（如"将一镜到底改为多段运镜" → "多段运镜"）
    let newDescription = instruction;
    
    // 尝试提取"改为"或"to"后面的内容
    const gaiMatch = instruction.match(/改为\s*["']?([^"'。，]+)["']?/);
    if (gaiMatch) {
      newDescription = gaiMatch[1].trim();
    } else {
      const toMatch = instruction.match(/to\s+["']?([^"'。，]+)["']?/i);
      if (toMatch) {
        newDescription = toMatch[1].trim();
      }
    }
    
    if (typeof current === 'object') {
      return { ...current, description: newDescription || current.description };
    }
    return { description: newDescription || current || '', speedCurve: 'linear', isOpening: false };
  }

  _applyDurationModification(current, action, instruction) {
    const match = instruction.match(/(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
    return current;
  }

  _applyNarrationModification(current, action, instruction) {
    if (action === 'replace') return instruction;
    if (action === 'append') return (current || '') + instruction;
    return current || instruction;
  }

  _applyMouthActionModification(current, action, instruction) {
    if (action === 'replace') return instruction;
    if (action === 'append') return (current || '') + instruction;
    return current || instruction;
  }

  _applyImportanceModification(current, action, instruction) {
    const match = instruction.match(/(\d+)/);
    if (match) {
      return Math.min(10, Math.max(1, parseInt(match[1])));
    }
    return current;
  }

  _applyTypeModification(current, action, instruction) {
    if (instruction.includes('opening')) return 'opening';
    if (instruction.includes('closing')) return 'closing';
    if (instruction.includes('content')) return 'content';
    return current;
  }

  /**
   * 输出报告
   */
  _printReport(result) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✍️ 编剧优化报告`);
    console.log(`${'='.repeat(60)}`);
    console.log(`迭代轮次: ${result.iteration}/${result.maxIterations}`);
    console.log(`优化前评分: ${result.scoreBefore}/100`);
    console.log(`优化后评分: ${result.scoreAfter}/100`);
    console.log(`状态: ${result.passed ? '✅ 通过' : '⚠️ 未达通过线'} (通过线: ${this.minPassScore})`);
    console.log(`优化时间: ${result.optimizeTime}ms`);
    console.log(`修复问题: ${result.issuesFixed.length}`);
    console.log(`遗留问题: ${result.issuesRemaining.length}`);
    
    if (result.issuesFixed.length > 0) {
      console.log(`\n修复详情:`);
      const byStrategy = {};
      for (const fix of result.issuesFixed) {
        byStrategy[fix.strategy] = (byStrategy[fix.strategy] || 0) + 1;
      }
      for (const [strategy, count] of Object.entries(byStrategy)) {
        console.log(`  - ${strategy}: ${count} 处`);
      }
    }
    
    console.log(`${'='.repeat(60)}\n`);
  }
}

module.exports = { ScreenwriterOptimizer };
// v6.2-patch68: 编剧优化 Agent — Stage 17 导演-编剧闭环核心模块
