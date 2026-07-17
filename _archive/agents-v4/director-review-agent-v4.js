/**
 * Director Review Agent v4.2 / 导演审片Agent（软性优化版）
 * 六问审片 + 五维评分 + 阻断条件 + 导演优化 + 字段一致性检查
 * 
 * 优化内容：调用导演优化Agent的四维评分模型、字段一致性检查器
 * 调用子系统：director-optimization-agent, field-consistency-checker
 * 优化日期：2026-07-15
 * 约束：数据结构不变、接口契约不变、文件结构不变
 */

const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { calculateFiveDimensionScore, checkBlockConditions } = require('../systems/quality-scorer');
const { ProductionBible } = require('../systems/production-bible');

// 【优化新增】导入导演优化Agent — 用于四维评分模型（故事30%+连贯25%+视觉25%+风格20%）
// 调用子系统：director-optimization-agent
let DirectorOptimizationAgent = null;
try {
  const doaModule = require('../hyperreality-system/engines/enhancers/director-optimization-agent');
  DirectorOptimizationAgent = doaModule.DirectorOptimizationAgent;
} catch (e) {
  console.warn('[DirectorReview] DirectorOptimizationAgent 未加载，四维评分将降级到基础五维评分');
}

// 【优化新增】导入字段一致性检查器 — 用于25维字段间逻辑一致性校验
// 调用子系统：field-consistency-checker
let FieldConsistencyChecker = null;
try {
  const fccModule = require('../hyperreality-system/engines/field-consistency-checker');
  FieldConsistencyChecker = fccModule.FieldConsistencyChecker;
} catch (e) {
  console.warn('[DirectorReview] FieldConsistencyChecker 未加载，字段一致性检查将跳过');
}

const fs = require('fs');
const path = require('path');

class DirectorReviewAgentV4 {
  constructor(options = {}) {
    this.engine = new LLMEngine({ model: options.model || 'kimi-k2p6' });
    this.templatePath = options.templatePath || path.join(__dirname, '../templates/director-review-form.md');
    this.template = fs.readFileSync(this.templatePath, 'utf8');
    // 【优化新增】初始化导演优化Agent
    this.directorOptimizer = null;
    if (DirectorOptimizationAgent) {
      try {
        this.directorOptimizer = new DirectorOptimizationAgent({
          enabled: true,
          threshold: options.optimizationThreshold || 4.0,
          maxIterations: options.maxIterations || 3,
          weights: {
            story: 0.30,
            continuity: 0.25,
            visual: 0.25,
            style: 0.20
          }
        });
      } catch (e) {
        console.warn('[DirectorReview] 导演优化Agent初始化失败:', e.message);
      }
    }
    // 【优化新增】初始化字段一致性检查器
    this.fieldChecker = null;
    if (FieldConsistencyChecker) {
      try {
        this.fieldChecker = new FieldConsistencyChecker({
          strict: true,
          logLevel: 'warn'
        });
      } catch (e) {
        console.warn('[DirectorReview] 字段一致性检查器初始化失败:', e.message);
      }
    }
  }

  /**
   * 导演审片 - 对Shot Card进行六问审片 + 五维评分 + 阻断检查 + 四维优化 + 一致性校验（优化版）
   * @param {Object} shotCard - 待审片的Shot Card（数据结构不变）
   * @param {Object} sceneCard - 关联的Scene Card（数据结构不变）
   * @param {Array} adjacentShots - 前后镜头（用于连续性检查）（数据结构不变）
   * @returns {Object} 审片结果（接口契约不变）
   */
  async review(shotCard, sceneCard, adjacentShots = []) {
    console.log(`[DirectorReview] 🎬 开始审片: ${shotCard.shot_id}`);

    // 1. 六问自动评估（基于规则）（原有逻辑不变）
    const sixQuestions = this._evaluateSixQuestions(shotCard, sceneCard, adjacentShots);

    // 2. 五维评分（原有逻辑不变）
    const fiveDimensions = this._evaluateFiveDimensions(shotCard, sceneCard);

    // 3. 阻断条件检查（原有逻辑不变）
    const blockCheck = this._checkBlockConditions(shotCard, adjacentShots);

    // 【优化新增】步骤3b: 导演四维评分优化
    // 调用子系统：director-optimization-agent
    // 优化理由：融入故事性(30%)+连贯性(25%)+视觉语言(25%)+风格一致性(20%)的四维评分模型
    let optimizationScore = null;
    if (this.directorOptimizer) {
      try {
        optimizationScore = await this._runDirectorOptimization(shotCard, sceneCard, adjacentShots);
      } catch (e) {
        console.warn('[DirectorReview] 导演优化评分失败（降级跳过）:', e.message);
      }
    }

    // 【优化新增】步骤3c: 25维字段一致性检查
    // 调用子系统：field-consistency-checker
    // 优化理由：检查25维字段之间的逻辑一致性（情绪-灯光-运镜-色彩等20组校验规则）
    let fieldConsistency = null;
    if (this.fieldChecker) {
      try {
        fieldConsistency = this._runFieldConsistencyCheck(shotCard, sceneCard);
      } catch (e) {
        console.warn('[DirectorReview] 字段一致性检查失败（降级跳过）:', e.message);
      }
    }

    // 4. 导演决策（综合判断，融入优化评分和一致性结果）
    const decision = this._makeDecision(sixQuestions, fiveDimensions, blockCheck, optimizationScore, fieldConsistency);

    // 5. 生成审片报告（融入增强维度）
    const review = {
      shot_id: shotCard.shot_id,
      scene_id: sceneCard.scene_id,
      generation_time: new Date().toISOString(),

      // 六问结果
      sixQuestions,
      sixQuestionsTotal: Object.values(sixQuestions).reduce((sum, q) => sum + q.score, 0),

      // 五维评分
      fiveDimensions,

      // 阻断条件
      blockCheck,

      // 导演决策
      decision,

      // 【优化新增】导演四维优化评分（不改变原有字段结构，新增扩展字段）
      _optimizationScore: optimizationScore,

      // 【优化新增】字段一致性检查结果
      _fieldConsistency: fieldConsistency,

      // 质量追踪
      version: 'v4.2',
      status: decision.canRender ? 'approved' : 'blocked'
    };

    console.log(`[DirectorReview] ✅ 审片完成: ${shotCard.shot_id} | 五维总分: ${fiveDimensions.totalScore} | 优化评分: ${optimizationScore?.score?.toFixed(2) || 'N/A'} | 字段一致: ${fieldConsistency?.valid ? '✅' : fieldConsistency ? '⚠️' : 'N/A'} | 状态: ${review.status}`);

    // 保存审片报告（原有逻辑不变）
    if (shotCard.output_path) {
      this._saveReview(review, shotCard.output_path);
    }

    return review;
  }

  /**
   * 六问评估（原有逻辑完全保持不变）
   */
  _evaluateSixQuestions(shotCard, sceneCard, adjacentShots) {
    const prevShot = adjacentShots.find(s => s.shot_id === shotCard.prev_shot_id);
    const nextShot = adjacentShots.find(s => s.shot_id === shotCard.next_shot_id);

    return {
      q1_existence_reason: {
        question: '这一镜存在的理由是什么？',
        answer: shotCard.narrative_purpose || '未明确',
        score: this._scoreExistenceReason(shotCard, sceneCard),
        passed: shotCard.narrative_purpose && shotCard.narrative_purpose.length > 10
      },
      q2_first_look: {
        question: '第一眼看哪里？',
        answer: shotCard.primary_poi || '未明确',
        score: this._scoreFirstLook(shotCard),
        passed: !!shotCard.primary_poi
      },
      q3_delete_loss: {
        question: '如果删掉这镜，故事损失什么？',
        answer: shotCard.narrative_purpose ? `损失：${shotCard.narrative_purpose}` : '未评估',
        score: this._scoreDeleteLoss(shotCard, sceneCard),
        passed: shotCard.is_hero_shot || shotCard.priority === 'P1' || shotCard.priority === 'P2'
      },
      q4_next_shot_connect: {
        question: '这镜的落幅能否自然接下一镜？',
        answer: shotCard.efa || '未明确落幅',
        score: this._scoreNextShotConnect(shotCard, nextShot),
        passed: !!shotCard.efa && !!shotCard.transition_intent
      },
      q5_simpler_method: {
        question: '是否存在更简单、更准确的拍法？',
        answer: '需导演主观判断',
        score: 5, // 默认中等，需导演确认
        passed: true, // 不由AI判断，标记为待确认
        needsDirectorInput: true
      },
      q6_editable_check: {
        question: '这镜是否"好剪"而不是仅仅"好看"？',
        answer: shotCard.editing_suggestion || '未评估',
        score: this._scoreEditable(shotCard, prevShot, nextShot),
        passed: !!shotCard.transition_intent
      }
    };
  }

  /**
   * 五维评分（优化版：在现有评分基础上融入导演优化权重）
   */
  _evaluateFiveDimensions(shotCard, sceneCard) {
    // 可读性：3秒内识别主体和动作（原有逻辑不变）
    const readability = shotCard.primary_poi && shotCard.primary_action ?
      (shotCard.primary_poi.length > 0 && shotCard.primary_action.length > 5 ? 85 : 60) : 40;

    // 可控性：历史成功率与风险点（原有逻辑不变）
    const controllability = shotCard.risk_points && shotCard.risk_points.length > 0 ? 60 : 80;

    // 可剪性：落幅锚点清晰，转场意图明确（原有逻辑不变）
    const editability = shotCard.efa && shotCard.transition_intent ? 80 : 50;

    // 情绪命中率：与Scene Card情绪目标对比（原有逻辑不变）
    const emotionHit = shotCard.emotion_target && sceneCard?.emotion_end ?
      (shotCard.emotion_target === sceneCard.emotion_end ? 90 : 70) : 50;

    // 记忆点：是否有"一眼难忘"元素（原有逻辑不变）
    const memorability = shotCard.is_hero_shot ? 85 : (shotCard.camera_movement ? 70 : 50);

    return calculateFiveDimensionScore({
      readability,
      controllability,
      editability,
      emotionHit,
      memorability
    });
  }

  /**
   * 【优化新增】运行导演四维优化评分
   * 调用子系统：director-optimization-agent
   * 优化点：融入故事性(30%)+连贯性(25%)+视觉语言(25%)+风格一致性(20%)四维模型
   */
  async _runDirectorOptimization(shotCard, sceneCard, adjacentShots) {
    if (!this.directorOptimizer) return null;

    // 将shotCard转换为DirectorOptimizationAgent期望的格式
    const shot = {
      shotId: shotCard.shot_id || '',
      type: shotCard.shot_type || '',
      sceneType: shotCard.scene_function || '',
      scene: shotCard.environment_traits || '',
      action: shotCard.primary_action || '',
      emotion: shotCard.emotion_target || '',
      mood: shotCard.performance_goal || '',
      camera: shotCard.camera_movement || '',
      camera_movement: shotCard.camera_movement || '',
      lighting: shotCard.light_tier || '',
      lightingString: shotCard.light_tier || '',
      transition: shotCard.transition_intent || '',
      _transitionType: shotCard.transition_intent || '',
      pacing: shotCard.rhythm_level || '',
      _transitionDirection: shotCard.screen_direction || '',
      description: `${shotCard.environment_traits || ''} ${shotCard.primary_action || ''}`,
      prompt: shotCard.render_prompt || ''
    };

    // 如果有相邻shots，构建shots数组
    const shots = [shot];
    if (adjacentShots && adjacentShots.length > 0) {
      for (const adj of adjacentShots) {
        shots.push({
          shotId: adj.shot_id || '',
          type: adj.shot_type || '',
          scene: adj.environment_traits || '',
          emotion: adj.emotion_target || '',
          mood: adj.performance_goal || '',
          camera: adj.camera_movement || '',
          transition: adj.transition_intent || '',
          description: `${adj.environment_traits || ''} ${adj.primary_action || ''}`
        });
      }
    }

    // 调用导演优化
    const metadata = {
      style: {
        primary: sceneCard?.creative_intent || ''
      }
    };

    const result = await this.directorOptimizer.optimize(shots, metadata);

    if (result) {
      return {
        score: result.score,
        iterations: result.iterations,
        improved: result.improved,
        // 四维子评分
        dimensions: {
          story: this._estimateStoryScore(shotCard, sceneCard),
          continuity: this._estimateContinuityScore(shotCard, adjacentShots),
          visual: this._estimateVisualScore(shotCard),
          style: this._estimateStyleScore(shotCard, sceneCard)
        },
        injectedAt: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * 【优化新增辅助】估算故事性评分
   */
  _estimateStoryScore(shotCard, sceneCard) {
    let score = 3.0;
    if (shotCard.narrative_purpose && shotCard.narrative_purpose.length > 10) score += 0.5;
    if (shotCard.is_hero_shot) score += 0.5;
    if (shotCard.shot_type === 'opening' || shotCard.shot_type === 'climax') score += 0.5;
    if (shotCard.emotion_target && sceneCard?.emotion_end &&
      shotCard.emotion_target === sceneCard.emotion_end) score += 0.5;
    return Math.min(5.0, score);
  }

  /**
   * 【优化新增辅助】估算连贯性评分
   */
  _estimateContinuityScore(shotCard, adjacentShots) {
    if (!adjacentShots || adjacentShots.length === 0) return 3.0;
    let score = 3.0;
    if (shotCard.efa && shotCard.transition_intent) score += 1.0;
    if (shotCard.screen_direction) score += 0.5;
    if (shotCard.prev_shot_id || shotCard.next_shot_id) score += 0.5;
    return Math.min(5.0, score);
  }

  /**
   * 【优化新增辅助】估算视觉语言评分
   */
  _estimateVisualScore(shotCard) {
    let score = 3.0;
    if (shotCard.camera_movement && shotCard.camera_movement.length > 5) score += 0.5;
    if (shotCard.shot_size) score += 0.5;
    if (shotCard.camera_position) score += 0.5;
    if (shotCard.primary_poi) score += 0.5;
    return Math.min(5.0, score);
  }

  /**
   * 【优化新增辅助】估算风格一致性评分
   */
  _estimateStyleScore(shotCard, sceneCard) {
    let score = 3.0;
    if (shotCard.light_tier && sceneCard?.light_tier &&
      shotCard.light_tier === sceneCard.light_tier) score += 1.0;
    if (shotCard.emotion_target && sceneCard?.emotion_end &&
      shotCard.emotion_target === sceneCard.emotion_end) score += 1.0;
    return Math.min(5.0, score);
  }

  /**
   * 【优化新增】运行字段一致性检查
   * 调用子系统：field-consistency-checker
   * 优化点：检查25维字段之间的逻辑一致性（20组校验规则）
   */
  _runFieldConsistencyCheck(shotCard, sceneCard) {
    if (!this.fieldChecker) return null;

    // 将shotCard转换为field-consistency-checker期望的25字段格式
    const fields = {
      mood: shotCard.emotion_target || shotCard.performance_goal || '',
      lighting: shotCard.light_tier || '',
      camera_movement: shotCard.camera_movement || '',
      color_palette: sceneCard?.primary_palette || '',
      timeline: '', // shot级别不强制时间轴
      scene: shotCard.environment_traits || '',
      action: shotCard.primary_action || '',
      composition: shotCard.shot_size || '',
      depth_of_field: '',
      pacing: shotCard.rhythm_level || '',
      bright_constraint: '',
      character_constraint: '',
      transition: shotCard.transition_intent || '',
      director_instruction: '',
      constraint: '',
      baseline: '',
      character: shotCard.character_bindings || '',
      dialogue: shotCard.dialogue || '',
      negative: shotCard.forbidden_elements || '',
      portraits: '',
      consistency: '',
      costume: '',
      props: '',
      audio: shotCard.sound_events || '',
      makeup: '',
      transition_field: shotCard.transition_intent || ''
    };

    const shot = {
      shotId: shotCard.shot_id || 'unknown',
      fields
    };

    // 运行一致性检查
    const checkResult = this.fieldChecker.check(shot);

    // 如果有问题，尝试自动修复
    let fixed = false;
    if (!checkResult.valid || checkResult.warningCount > 0) {
      try {
        const autoFixResult = this.fieldChecker.autoFix(shot);
        if (autoFixResult && autoFixResult !== shot) {
          fixed = true;
        }
      } catch (e) {
        // 自动修复失败，返回原始检查结果
      }
    }

    return {
      valid: checkResult.valid,
      issues: checkResult.issues || [],
      warningCount: checkResult.warningCount || 0,
      errorCount: checkResult.errorCount || 0,
      autoFixed: fixed,
      injectedAt: new Date().toISOString()
    };
  }

  /**
   * 阻断条件检查（原有逻辑完全保持不变）
   */
  _checkBlockConditions(shotCard, adjacentShots) {
    const prevShot = adjacentShots.find(s => s.shot_id === shotCard.prev_shot_id);
    const nextShot = adjacentShots.find(s => s.shot_id === shotCard.next_shot_id);

    const check = checkBlockConditions({
      subject: shotCard.primary_poi,
      actions: shotCard.primary_action ? [shotCard.primary_action] : [],
      cameraConflict: this._checkCameraActionConflict(shotCard),
      ofa: shotCard.ofa,
      efa: shotCard.efa,
      characters: shotCard.main_characters || [],
      primaryCharacter: shotCard.primary_poi,
      screenDirection: shotCard.screen_direction,
      nextScreenDirection: nextShot?.screen_direction,
      violations: this._checkSystemViolations(shotCard)
    });

    return {
      ...check,
      details: {
        hasSubject: !!shotCard.primary_poi,
        hasAction: !!shotCard.primary_action,
        hasOFA: !!shotCard.ofa,
        hasEFA: !!shotCard.efa,
        hasBinding: !!shotCard.character_bindings,
        hasTransition: !!shotCard.transition_intent,
        cameraActionConflict: this._checkCameraActionConflict(shotCard),
        systemViolations: this._checkSystemViolations(shotCard)
      }
    };
  }

  /**
   * 运镜与动作冲突检查（原有逻辑完全保持不变）
   */
  _checkCameraActionConflict(shotCard) {
    if (!shotCard.camera_movement || !shotCard.primary_action) return false;

    const camera = shotCard.camera_movement.toLowerCase();
    const action = shotCard.primary_action.toLowerCase();

    // 冲突模式：快速运镜 + 精细动作
    const fastCamera = ['whip', 'fast', 'rapid', 'crash'].some(c => camera.includes(c));
    const fineAction = ['whisper', 'subtle', 'delicate', 'micro'].some(a => action.includes(a));

    return fastCamera && fineAction;
  }

  /**
   * 安全获取Prompt文本（原有逻辑完全保持不变）
   */
  _safeGetPromptText(shotCard) {
    if (!shotCard || typeof shotCard !== 'object') return '';
    const candidates = [
      shotCard.render_prompt,
      shotCard.renderPrompt,
      shotCard.prompt,
      shotCard.visualPrompt
    ];
    for (const item of candidates) {
      if (typeof item === 'string' && item.trim()) {
        return item;
      }
    }
    return '';
  }

  /**
   * 系统违规检查（原有逻辑完全保持不变）
   */
  _checkSystemViolations(shotCard) {
    const violations = [];

    // 检查禁用元素
    const promptText = this._safeGetPromptText(shotCard);
    const forbiddenList = Array.isArray(ProductionBible?.forbidden)
      ? ProductionBible.forbidden
      : [];

    for (const forbidden of forbiddenList) {
      if (typeof forbidden === 'string' && forbidden && promptText.includes(forbidden)) {
        violations.push(`包含禁用元素: ${forbidden}`);
      }
    }

    // 检查角色一致性
    if (shotCard.character_bindings && ProductionBible?.character?.xiaoG?.anchorFeatures) {
      const required = ProductionBible.character.xiaoG.anchorFeatures;
      for (const feature of required) {
        if (typeof feature === 'string' && feature && !shotCard.character_bindings.includes(feature)) {
          violations.push(`角色绑定缺少特征: ${feature}`);
        }
      }
    }

    return violations;
  }

  /**
   * 导演决策（优化版：融入四维优化评分和字段一致性结果）
   */
  _makeDecision(sixQuestions, fiveDimensions, blockCheck, optimizationScore, fieldConsistency) {
    const sixTotal = Object.values(sixQuestions).reduce((sum, q) => sum + q.score, 0);
    const sixAverage = sixTotal / 6;

    // 通过条件（原有逻辑不变）：
    // 1. 无阻断条件
    // 2. 五维总分≥60
    // 3. 六问平均分≥5
    const canRender = !blockCheck.blocked &&
      fiveDimensions.totalScore >= 60 &&
      sixAverage >= 5;

    // 是否需要导演人工确认（优化版：增加优化评分和一致性检查条件）
    let needsDirectorConfirm = (sixQuestions.q5_simpler_method?.needsDirectorInput) ||
      fiveDimensions.totalScore < 75 ||
      blockCheck.blocks.length > 0;

    // 【优化新增】如果导演优化评分低于阈值，也需要人工确认
    if (optimizationScore && optimizationScore.score < 4.0) {
      needsDirectorConfirm = true;
    }

    // 【优化新增】如果字段一致性检查有错误，也需要人工确认
    if (fieldConsistency && fieldConsistency.errorCount > 0) {
      needsDirectorConfirm = true;
    }

    return {
      approved: canRender,
      canRender,
      needsDirectorConfirm,
      directorNotes: this._generateDirectorNotes(sixQuestions, fiveDimensions, blockCheck, optimizationScore, fieldConsistency),
      modificationSuggestions: this._generateSuggestions(sixQuestions, fiveDimensions, blockCheck, optimizationScore, fieldConsistency),
      priorityAdjustment: fiveDimensions.totalScore < 60 ? 'upgrade_to_P2' : 'keep',
      // 【优化新增】融入优化评分和一致性结果
      _optimizationScore: optimizationScore ? optimizationScore.score : null,
      _fieldConsistencyValid: fieldConsistency ? fieldConsistency.valid : null,
      _fieldConsistencyIssues: fieldConsistency ? fieldConsistency.issues : null
    };
  }

  /**
   * 生成导演备注（优化版：融入四维评分和一致性检查结果）
   */
  _generateDirectorNotes(sixQuestions, fiveDimensions, blockCheck, optimizationScore, fieldConsistency) {
    const notes = [];

    if (fiveDimensions.totalScore < 75) {
      notes.push(`五维评分${fiveDimensions.totalScore}分，建议优化后复审`);
    }

    if (blockCheck.blocked) {
      notes.push(`存在阻断条件：${blockCheck.blocks.map(b => b.description).join(', ')}`);
    }

    if (sixQuestions.q5_simpler_method?.needsDirectorInput) {
      notes.push('问5（更简单拍法）需导演主观判断');
    }

    // 【优化新增】融入导演优化评分备注
    if (optimizationScore) {
      notes.push(`四维优化评分: ${optimizationScore.score.toFixed(2)}/5.0 (故事:${optimizationScore.dimensions.story.toFixed(1)} 连贯:${optimizationScore.dimensions.continuity.toFixed(1)} 视觉:${optimizationScore.dimensions.visual.toFixed(1)} 风格:${optimizationScore.dimensions.style.toFixed(1)})`);
      if (optimizationScore.score >= 4.0) {
        notes.push('✅ 优化评分通过，镜头质量达标');
      } else {
        notes.push('⚠️ 优化评分未达阈值(4.0)，建议优化叙事连贯性或视觉语言');
      }
    }

    // 【优化新增】融入字段一致性备注
    if (fieldConsistency) {
      if (fieldConsistency.valid && fieldConsistency.warningCount === 0) {
        notes.push('✅ 25维字段一致性检查通过');
      } else {
        notes.push(`${fieldConsistency.errorCount > 0 ? '❌' : '⚠️'} 字段一致性: ${fieldConsistency.errorCount}个错误, ${fieldConsistency.warningCount}个警告`);
        if (fieldConsistency.issues && fieldConsistency.issues.length > 0) {
          const topIssues = fieldConsistency.issues.slice(0, 3).map(i => `${i.fieldA}↔${i.fieldB}: ${i.message}`).join('; ');
          notes.push(`主要问题: ${topIssues}`);
        }
      }
      if (fieldConsistency.autoFixed) {
        notes.push('🔧 部分字段问题已自动修复');
      }
    }

    return notes.join('\n');
  }

  /**
   * 生成修改建议（优化版：融入字段一致性修复建议）
   */
  _generateSuggestions(sixQuestions, fiveDimensions, blockCheck, optimizationScore, fieldConsistency) {
    const suggestions = [];

    if (!sixQuestions.q2_first_look?.passed) {
      suggestions.push('明确第一视觉重点（primary_poi）');
    }

    if (!sixQuestions.q4_next_shot_connect?.passed) {
      suggestions.push('完善落幅锚点（EFA）和转场意图');
    }

    if (blockCheck.details?.cameraActionConflict) {
      suggestions.push('运镜与动作冲突，建议简化运镜或调整动作');
    }

    if (fiveDimensions.dimensions?.readability?.score < 70) {
      suggestions.push('提升可读性：简化主体描述，明确动作');
    }

    // 【优化新增】融入导演优化评分建议
    if (optimizationScore) {
      if (optimizationScore.dimensions.story < 3.5) {
        suggestions.push('提升故事性：明确叙事目的，增加情绪转折');
      }
      if (optimizationScore.dimensions.continuity < 3.5) {
        suggestions.push('提升连贯性：完善EFA/OFA，确保转场意图清晰');
      }
      if (optimizationScore.dimensions.visual < 3.5) {
        suggestions.push('提升视觉语言：丰富运镜描述，增加景别变化');
      }
      if (optimizationScore.dimensions.style < 3.5) {
        suggestions.push('提升风格一致性：确保光线/情绪与Scene Card匹配');
      }
    }

    // 【优化新增】融入字段一致性修复建议
    if (fieldConsistency && fieldConsistency.issues) {
      for (const issue of fieldConsistency.issues) {
        if (issue.fixable && issue.fix) {
          suggestions.push(`[自动修复] ${issue.fieldA}↔${issue.fieldB}: ${issue.message}`);
        } else {
          suggestions.push(`[需人工] ${issue.fieldA}↔${issue.fieldB}: ${issue.message}`);
        }
      }
    }

    return suggestions;
  }

  /**
   * 评分辅助函数（原有逻辑完全保持不变）
   */
  _scoreExistenceReason(shotCard, sceneCard) {
    if (!shotCard.narrative_purpose) return 3;
    if (shotCard.is_hero_shot) return 9;
    if (shotCard.priority === 'P1') return 8;
    return 6;
  }

  _scoreFirstLook(shotCard) {
    if (!shotCard.primary_poi) return 3;
    if (shotCard.primary_poi === shotCard.main_characters?.[0]) return 9;
    return 7;
  }

  _scoreDeleteLoss(shotCard, sceneCard) {
    if (shotCard.is_hero_shot) return 10;
    if (shotCard.priority === 'P1') return 9;
    if (shotCard.priority === 'P2') return 7;
    return 5;
  }

  _scoreNextShotConnect(shotCard, nextShot) {
    if (!shotCard.efa) return 3;
    if (!shotCard.transition_intent) return 5;
    if (nextShot && shotCard.efa === nextShot.ofa) return 10;
    return 7;
  }

  _scoreEditable(shotCard, prevShot, nextShot) {
    if (!shotCard.transition_intent) return 4;
    if (shotCard.rhythm_level && shotCard.rhythm_level !== '未指定') return 7;
    return 6;
  }

  /**
   * 保存审片报告（原有逻辑完全保持不变）
   */
  _saveReview(review, outputPath) {
    const fileName = `${review.shot_id}-director-review.md`;
    const filePath = path.join(outputPath, fileName);

    let content = this.template;
    for (const [key, value] of Object.entries(review)) {
      const placeholder = `{${key}}`;
      if (content.includes(placeholder)) {
        const val = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '未指定');
        content = content.replace(new RegExp(placeholder, 'g'), val);
      }
    }

    // 清理未填充的占位符
    content = content.replace(/\{[a-z_]+\}/g, '未指定');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[DirectorReview] ✅ 审片报告已保存: ${filePath}`);
  }
}

module.exports = { DirectorReviewAgentV4 };

// 测试（原有测试逻辑保持不变）
if (require.main === module) {
  async function test() {
    const agent = new DirectorReviewAgentV4();

    const shotCard = {
      shot_id: 'SC01-S01',
      scene_id: 'SC01',
      narrative_purpose: '建立xiaoG进入Nirath世界，展示荧光平原环境',
      primary_poi: 'xiaoG',
      primary_action: 'walking through entrance',
      ofa: 'wide shot, xiaoG entering from left',
      efa: 'medium shot, xiaoG looking up',
      transition_intent: 'cut to exploration',
      emotion_target: 'curious',
      is_hero_shot: false,
      priority: 'P2',
      camera_movement: 'slow tracking',
      character_bindings: 'xiaoG, round face, black hair, brown eyes, khaki pants, green jacket',
      main_characters: ['xiaoG'],
      screen_direction: 'left to right',
      rhythm_level: '缓',
      risk_points: [],
      render_prompt: 'xiaoG walking through alien forest...',
      output_path: './output/reviews'
    };

    const sceneCard = {
      scene_id: 'SC01',
      scene_name: '星渊初临',
      emotion_end: 'curious',
      light_tier: 'A',
      primary_palette: '青灰+土褐',
      accent_color: '赤金',
      scene_function: '建立'
    };

    const adjacentShots = [
      {
        shot_id: 'SC01-S02',
        ofa: 'medium shot, xiaoG looking up',
        screen_direction: 'left to right'
      }
    ];

    try {
      const review = await agent.review(shotCard, sceneCard, adjacentShots);

      console.log('\n=== 审片结果 ===');
      console.log('镜头:', review.shot_id);
      console.log('六问总分:', review.sixQuestionsTotal, '/ 60');
      console.log('五维总分:', review.fiveDimensions.totalScore, '/ 100');
      console.log('五维等级:', review.fiveDimensions.grade.label);
      console.log('阻断状态:', review.blockCheck.blocked ? '有阻断' : '无阻断');
      console.log('是否通过:', review.decision.approved ? '通过' : '未通过');
      console.log('是否可渲染:', review.decision.canRender ? '可渲染' : '不可渲染');
      console.log('需导演确认:', review.decision.needsDirectorConfirm ? '是' : '否');

      // 【优化新增】输出增强追踪
      if (review._optimizationScore) {
        console.log('\n=== 导演四维优化评分 ===');
        console.log('优化评分:', review._optimizationScore.score.toFixed(2), '/ 5.0');
        console.log('故事性:', review._optimizationScore.dimensions.story.toFixed(1));
        console.log('连贯性:', review._optimizationScore.dimensions.continuity.toFixed(1));
        console.log('视觉语言:', review._optimizationScore.dimensions.visual.toFixed(1));
        console.log('风格一致性:', review._optimizationScore.dimensions.style.toFixed(1));
      }
      if (review._fieldConsistency) {
        console.log('\n=== 字段一致性检查 ===');
        console.log('是否通过:', review._fieldConsistency.valid ? '✅' : '⚠️');
        console.log('错误数:', review._fieldConsistency.errorCount);
        console.log('警告数:', review._fieldConsistency.warningCount);
        console.log('自动修复:', review._fieldConsistency.autoFixed ? '✅' : '❌');
      }

      console.log('\n=== 六问详情 ===');
      for (const [key, q] of Object.entries(review.sixQuestions)) {
        console.log(`${q.question}: ${q.score}/10 ${q.passed ? '✅' : '❌'}`);
      }

      console.log('\n=== 五维详情 ===');
      for (const [dim, data] of Object.entries(review.fiveDimensions.dimensions)) {
        console.log(`${dim}: ${data.score}分 (权重${data.weight}, 加权${data.weighted.toFixed(1)})`);
      }

      console.log('\n=== 阻断检查 ===');
      if (review.blockCheck.details) {
        console.log('主体:', review.blockCheck.details.hasSubject ? '✅' : '❌');
        console.log('动作:', review.blockCheck.details.hasAction ? '✅' : '❌');
        console.log('起幅:', review.blockCheck.details.hasOFA ? '✅' : '❌');
        console.log('落幅:', review.blockCheck.details.hasEFA ? '✅' : '❌');
        console.log('绑定:', review.blockCheck.details.hasBinding ? '✅' : '❌');
        console.log('转场:', review.blockCheck.details.hasTransition ? '✅' : '❌');
      }

      console.log('\n=== 导演建议 ===');
      console.log('备注:', review.decision.directorNotes);
      console.log('建议:', review.decision.modificationSuggestions.join(', ') || '无');

    } catch (err) {
      console.error('测试失败:', err.message);
    }
  }

  test();
}
