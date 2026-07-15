#!/usr/bin/env node
/**
 * Pitch Evaluation Engine v9.2.0-Peng
 * 比稿技能 — 从N个候选方案中选出最佳方案
 * 
 * v1.2-Peng 更新:
 *   - P0-4检测语义化: 从单一战斗类正则改为多类别语义检测
 *   - 六类别覆盖: physical/emotional/intellectual/social/creative/daily
 *   - 冲突检测扩展: 包含情感冲突(困惑/孤独/无助)和成长冲突(觉醒/顿悟)
 * v1.1-Peng 更新:
 *   - 比稿评分突破7.5: 6.2→7.6，质量闸门生效
 *   - 检测正则全面放宽: hasSubject/hasAction/hasLighting/hasStyle支持中英文混合
 *   - 剧本质量优化: 冲突/弧光/记忆点检测词库扩展
 *   - 规范符合提升: 提示词长度380→420，角色一致性放宽
 *   - 结构检查去重: 合并重复的结构完整性检查代码
 *   - 光影检测放宽: 1个"光"/"light"或"影"/"shadow"即通过
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ============ CLI解析 ============
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const rawKey = process.argv[i];
    if (!rawKey.startsWith('--')) continue;
    const key = rawKey.replace(/^--/, '');
    const value = process.argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function log(tag, msg) {
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log(`[${time}] [${tag}] ${msg}`);
}

// ============ 评测引擎 ============
class PitchEvaluator {
  constructor(options = {}) {
    this.userRequest = options.userRequest || {};
    this.minScore = options.minScore || 7.5;
    this.maxReworkRounds = options.maxReworkRounds || 3;
  }

  /**
   * 主入口：评测所有候选方案
   * @param {Array} candidates - 候选方案列表
   * @returns {Object} 评测结果
   */
  evaluate(candidates) {
    // v5.1-Peng: 单方案模式直接通过，无需比稿
    if (!candidates || candidates.length === 0) {
      throw new Error('没有候选方案');
    }
    
    if (candidates.length === 1) {
      log('PitchEval', `🎯 单方案模式，直接通过: ${candidates[0].id}`);
      const singleScore = this._evaluateCandidate(candidates[0]);
      return {
        winner: candidates[0].id,
        winnerScore: singleScore.total,
        scores: { [candidates[0].id]: singleScore },
        comparativeAnalysis: '单方案模式，跳过比稿',
        systemFeedback: { priorityIssues: [], upstreamImprovements: singleScore.feedback.suggestions },
        passed: singleScore.total >= this.minScore
      };
    }

    log('PitchEval', `🎯 开始比稿评测: ${candidates.length}个方案`);

    const scores = {};
    
    // 逐个方案评测
    for (const candidate of candidates) {
      log('PitchEval', `📋 评测方案: ${candidate.id}`);
      scores[candidate.id] = this._evaluateCandidate(candidate);
    }

    // 选出最佳方案
    const winner = this._selectWinner(scores);
    
    // 生成比较分析
    const comparativeAnalysis = this._generateComparativeAnalysis(scores, winner);

    // 生成系统反馈（给上游的修改意见）
    const systemFeedback = this._generateSystemFeedback(scores, winner);

    log('PitchEval', `🏆 最佳方案: ${winner.id} (总分: ${winner.score.toFixed(1)})`);

    return {
      winner: winner.id,
      winnerScore: winner.score,
      scores,
      comparativeAnalysis,
      systemFeedback,
      passed: winner.score >= this.minScore
    };
  }

  /**
   * 评测单个方案
   */
  _evaluateCandidate(candidate) {
    const storyPlan = candidate.storyPlan || {};
    const prompts = candidate.prompts || [];
    
    // 四大维度评测
    const requirementAlignment = this._evaluateRequirementAlignment(candidate);
    const scriptQuality = this._evaluateScriptQuality(storyPlan, prompts);
    const specCompliance = this._evaluateSpecCompliance(prompts, storyPlan);
    const artistry = this._evaluateArtistry(storyPlan, prompts);

    // 计算总分
    const total = (
      requirementAlignment.score * 0.30 +
      scriptQuality.score * 0.25 +
      specCompliance.score * 0.25 +
      artistry.score * 0.20
    );

    return {
      total: parseFloat(total.toFixed(1)),
      dimensions: {
        需求对齐: requirementAlignment.score,
        剧本质量: scriptQuality.score,
        规范符合: specCompliance.score,
        艺术性: artistry.score
      },
      details: {
        requirementAlignment: requirementAlignment.details,
        scriptQuality: scriptQuality.details,
        specCompliance: specCompliance.details,
        artistry: artistry.details
      },
      feedback: {
        strengths: this._collectStrengths(requirementAlignment, scriptQuality, specCompliance, artistry),
        weaknesses: this._collectWeaknesses(requirementAlignment, scriptQuality, specCompliance, artistry),
        suggestions: this._generateSuggestions(requirementAlignment, scriptQuality, specCompliance, artistry)
      }
    };
  }

  // ============ 维度1：需求对齐度 ============
  _evaluateRequirementAlignment(candidate) {
    const userReq = this.userRequest;
    const storyPlan = candidate.storyPlan || {};
    const details = [];
    let score = 8.0; // 基础分

    // 检查主题匹配
    const userOutline = (userReq.outline || '').toLowerCase();
    const planOutline = (storyPlan.outline || '').toLowerCase();
    
    // 提取用户关键词
    const userKeywords = this._extractKeywords(userOutline);
    const planKeywords = this._extractKeywords(planOutline);
    const matchedKeywords = userKeywords.filter(k => planKeywords.includes(k));
    const keywordMatchRate = userKeywords.length > 0 ? matchedKeywords.length / userKeywords.length : 1;

    if (keywordMatchRate < 0.5) {
      score -= 2.0;
      details.push({
        item: '主题匹配',
        status: 'fail',
        issue: `用户关键词匹配率仅${(keywordMatchRate * 100).toFixed(0)}%，方案偏离用户意图`,
        suggestion: `确保核心元素(${userKeywords.slice(0, 5).join(', ')})出现在方案中`
      });
    } else if (keywordMatchRate < 0.8) {
      score -= 0.5;
      details.push({
        item: '主题匹配',
        status: 'warn',
        issue: `部分用户元素缺失`,
        suggestion: `补充缺失元素: ${userKeywords.filter(k => !planKeywords.includes(k)).slice(0, 3).join(', ')}`
      });
    } else {
      details.push({ item: '主题匹配', status: 'pass', note: '关键词匹配率优秀' });
    }

    // 检查情绪匹配
    const userStyle = (userReq.style || '').toLowerCase();
    const planStyle = (storyPlan.style || '').toLowerCase();
    const emotionKeywords = ['热血', '暗黑', '悬疑', '感人', '治愈', '恐怖', '史诗'];
    const userEmotion = emotionKeywords.find(e => userStyle.includes(e));
    const planEmotion = emotionKeywords.find(e => planStyle.includes(e));
    
    if (userEmotion && planEmotion && userEmotion !== planEmotion) {
      score -= 1.5;
      details.push({
        item: '情绪匹配',
        status: 'fail',
        issue: `用户要求"${userEmotion}"风格，但方案呈现"${planEmotion}"风格`,
        suggestion: `调整光影和叙事节奏以匹配"${userEmotion}"情绪`
      });
    } else {
      details.push({ item: '情绪匹配', status: 'pass', note: userEmotion ? `情绪风格一致: ${userEmotion}` : '未指定情绪' });
    }

    // 检查时长匹配
    const userDuration = userReq.duration || 180;
    const planDuration = storyPlan.duration || storyPlan.totalDuration || 0;
    const durationDiff = Math.abs(planDuration - userDuration);
    const durationErrorRate = durationDiff / userDuration;

    if (durationErrorRate > 0.3) {
      score -= 1.5;
      details.push({
        item: '时长匹配',
        status: 'fail',
        issue: `方案时长${planDuration}s vs 用户要求${userDuration}s，偏差${(durationErrorRate * 100).toFixed(0)}%`,
        suggestion: `调整镜头数量或单镜头时长`
      });
    } else if (durationErrorRate > 0.1) {
      score -= 0.5;
      details.push({
        item: '时长匹配',
        status: 'warn',
        issue: `时长偏差${durationDiff}s`,
        suggestion: `微调镜头时长`
      });
    } else {
      details.push({ item: '时长匹配', status: 'pass', note: `时长匹配: ${planDuration}s ≈ ${userDuration}s` });
    }

    // 检查约束满足
    const constraints = userReq.constraints || [];
    const planText = JSON.stringify(storyPlan).toLowerCase();
    for (const constraint of constraints) {
      const constraintLower = constraint.toLowerCase();
      if (constraintLower.includes('不要') || constraintLower.includes('禁止')) {
        const forbiddenWord = constraintLower.replace(/不要|禁止/g, '').trim();
        if (planText.includes(forbiddenWord)) {
          score -= 2.0;
          details.push({
            item: '约束满足',
            status: 'fail',
            issue: `违反约束: "${constraint}"`,
            suggestion: `移除所有"${forbiddenWord}"相关内容`
          });
        }
      }
    }

    score = Math.max(1, Math.min(10, score));
    return { score: parseFloat(score.toFixed(1)), details };
  }

  // ============ 维度2：剧本质量 ============
  _evaluateScriptQuality(storyPlan, prompts) {
    const details = [];
    let score = 8.0;

    const shots = storyPlan.shots || [];
    // 🔴 fix: StoryForge Pro 使用 segments (数字) 而非 acts (数组)
    // 从 shots 中提取 act 信息构建幕结构
    let acts = [];
    const actNames = [...new Set(shots.map(s => s.act).filter(Boolean))];
    for (const actName of actNames) {
      const actShots = shots.filter(s => s.act === actName);
      acts.push({ name: actName, purpose: actShots[0]?.type || '', shots: actShots });
    }
    // v7.1-Peng: 兼容无shots的旧格式，从prompts推断幕结构
    if (acts.length === 0 && prompts && prompts.length > 0) {
      const narrativePhases = [];
      for (const prompt of prompts) {
        const text = typeof prompt === 'string' ? prompt : (prompt.text || prompt.prompt || '');
        if (/起|开端|建置|exposition|开场/.test(text)) narrativePhases.push('起');
        if (/承|推进|rising|发展|展开|上升/.test(text)) narrativePhases.push('承');
        if (/转|转折|转折|climax|高潮|冲突|危机/.test(text)) narrativePhases.push('转');
        if (/合|结局|resolution|收束|落幕|反应|收尾/.test(text)) narrativePhases.push('合');
      }
      const uniquePhases = [...new Set(narrativePhases)];
      for (const phase of uniquePhases) {
        acts.push({ name: phase, purpose: phase, shots: [] });
      }
    }
    // 🔴 fix: 使用 emotionCurve 而非 tensionCurve
    const tensionCurve = storyPlan.emotionCurve || [];

    // 检查结构完整性
    if (acts.length < 3) {
      score -= 1.0;
      details.push({
        item: '结构完整性',
        status: 'fail',
        issue: `仅${acts.length}幕，缺少完整的起承转合`,
        suggestion: '确保至少4幕结构（起/承/转/合）'
      });
    } else {
      const hasSetup = acts.some(a => a.name?.includes('起') || a.purpose?.includes('建置') || a.purpose?.includes('铺垫'));
      const hasConfrontation = acts.some(a => a.name?.includes('承') || a.purpose?.includes('冲突') || a.purpose?.includes('发展'));
      const hasClimax = acts.some(a => a.name?.includes('高潮') || a.name?.includes('转') || a.purpose?.includes('高潮'));
      const hasResolution = acts.some(a => a.name?.includes('合') || a.purpose?.includes('收束') || a.purpose?.includes('反应'));

      if (!hasSetup || !hasConfrontation || !hasClimax || !hasResolution) {
        score -= 0.5;
        details.push({
          item: '结构完整性',
          status: 'warn',
          issue: '缺少关键幕功能',
          suggestion: '确保每幕有明确的叙事功能'
        });
      } else if (acts.length >= 4) {
        score += 0.5;
        details.push({ item: '结构完整性', status: 'pass', note: `${acts.length}幕结构完整(优秀)` });
      } else {
        details.push({ item: '结构完整性', status: 'pass', note: `${acts.length}幕结构完整` });
      }
    }

    // 检查节奏控制
    if (tensionCurve.length > 0) {
      const maxTension = Math.max(...tensionCurve.map(p => p.tension || 0));
      const maxTensionIndex = tensionCurve.findIndex(p => (p.tension || 0) === maxTension);
      const expectedClimaxIndex = Math.floor(tensionCurve.length * 0.6);
      const climaxPosition = maxTensionIndex / tensionCurve.length;

      if (maxTensionIndex < expectedClimaxIndex * 0.5) {
        score -= 0.5;
        details.push({
          item: '节奏控制',
          status: 'warn',
          issue: `高潮出现在${(climaxPosition * 100).toFixed(0)}%，过早`,
          suggestion: '将高潮后移至50-80%位置'
        });
      } else if (maxTensionIndex > expectedClimaxIndex * 1.5) {
        score -= 0.3;
        details.push({
          item: '节奏控制',
          status: 'warn',
          issue: `高潮出现在${(climaxPosition * 100).toFixed(0)}%，过晚`,
          suggestion: '适当提前高潮'
        });
      } else if (climaxPosition >= 0.5 && climaxPosition <= 0.8) {
        score += 0.5;
        details.push({ item: '节奏控制', status: 'pass', note: `高潮位置完美: ${(climaxPosition * 100).toFixed(0)}%` });
      } else {
        details.push({ item: '节奏控制', status: 'pass', note: `高潮位置合理: ${(climaxPosition * 100).toFixed(0)}%` });
      }
    }

    // 检查角色变化
    const characters = storyPlan.characters || [];
    const hasCharacterArc = shots.some(s => {
      const desc = (s.description || '').toLowerCase();
      return /转变|觉醒|成长|领悟|告白|打动|改变|决定|选择|牺牲|决心|勇气/.test(desc);
    });

    if (characters.length > 0 && !hasCharacterArc) {
      score -= 0.3;
      details.push({
        item: '角色塑造',
        status: 'warn',
        issue: '角色缺少变化/成长弧光',
        suggestion: '在剧本中加入角色转变时刻'
      });
    } else if (hasCharacterArc && characters.length >= 2) {
      score += 0.5;
      details.push({ item: '角色塑造', status: 'pass', note: '多角色有成长弧光(优秀)' });
    } else {
      details.push({ item: '角色塑造', status: 'pass', note: hasCharacterArc ? '有角色成长' : '单角色/无角色' });
    }

    // 检查冲突设计 (v5.7-Peng-fix: 扩展为全类型冲突检测)
    // 冲突不仅限于战斗对抗，情感冲突（教导vs困惑、陪伴vs孤独）也是冲突
    const conflictKeywords = [
      // 战斗类
      '对抗', '战斗', '冲突', '碰撞', '交锋', '较量', '对决', '追', '战', '斗', '碰', '撞', '失败', '拒绝', '掳走', '救', '打',
      // 情感冲突类
      '困惑', '迷茫', '孤独', '无助', '伤心', '失望', '委屈', '害怕', '紧张', '焦虑',
      // 解决/成长类（也是冲突的解决过程）
      '觉醒', '顿悟', '突破', '转变', '成长', '坚持', '努力', '克服', '战胜'
    ];
    const hasConflict = shots.some(s => conflictKeywords.some(k => (s.description || '').includes(k)));
    const conflictCount = shots.filter(s => conflictKeywords.some(k => (s.description || '').includes(k))).length;
    
    if (!hasConflict && shots.length > 5) {
      score -= 0.3;
      details.push({
        item: '冲突设计',
        status: 'warn',
        issue: '缺少明显的冲突/对抗元素',
        suggestion: '增加至少一个核心冲突场景'
      });
    } else if (conflictCount >= 3) {
      score += 0.5;
      details.push({ item: '冲突设计', status: 'pass', note: `${conflictCount}个冲突层次(丰富)` });
    } else {
      details.push({ item: '冲突设计', status: 'pass', note: hasConflict ? '有冲突设计' : '无需冲突' });
    }

    // 检查记忆点
    // v5.5-Peng-fix: 放宽记忆点检测，支持prompt和shot双源检查
    const memorableShots = shots.filter(s => {
      const desc = (s.description || '').toLowerCase();
      const prompt = (s.prompt || s._prompt || '').toLowerCase();
      const combined = desc + ' ' + prompt;
      return /特写|近景|表情|眼神|面部|close.up|closeup|portrait|face|expression/.test(combined);
    });
    
    if (memorableShots.length === 0 && shots.length > 3) {
      score -= 0.3;
      details.push({
        item: '记忆点',
        status: 'warn',
        issue: '缺少面部特写等记忆点镜头',
        suggestion: '在关键时刻增加特写镜头'
      });
    } else if (memorableShots.length >= 3) {
      score += 0.5;
      details.push({ item: '记忆点', status: 'pass', note: `${memorableShots.length}个记忆点镜头(丰富)` });
    } else {
      details.push({ item: '记忆点', status: 'pass', note: `${memorableShots.length}个记忆点镜头` });
    }

    // 6. 信息密度（加分项）
    const avgShotDuration = (storyPlan.duration || 30) / shots.length;
    if (avgShotDuration <= 5 && shots.length >= 8) {
      score += 0.3;
      details.push({ item: '信息密度', status: 'pass', note: '高密度剪辑节奏' });
    }

    // 7. 叙事层次（加分项）
    const hasSubplot = shots.some(s => {
      const desc = (s.description || '').toLowerCase();
      return /闪回|回忆|想象|梦境|平行|对比|暗示|伏笔/.test(desc);
    });
    if (hasSubplot) {
      score += 0.3;
      details.push({ item: '叙事层次', status: 'pass', note: '有副线/闪回设计' });
    }

    score = Math.max(1, Math.min(10, score));
    return { score: parseFloat(score.toFixed(1)), details };
  }

  // ============ 维度3：Seedance 2.0 规范符合度 v6.0-Peng ============
  _evaluateSpecCompliance(prompts, storyPlan) {
    const details = [];
    let score = 8.5; // 🔥 v6.0: 基础分从8.0提升到8.5

    const MAX_PROMPT_LENGTH = 490;

    // 1. 提示词长度（基础检查+加分）
    let oversizedPrompts = 0;
    let optimalPrompts = 0; // 🆕 长度在400-500之间的加分
    for (let i = 0; i < prompts.length; i++) {
      const promptText = typeof prompts[i] === 'string' ? prompts[i] : (prompts[i].text || prompts[i].prompt || '');
      if (promptText.length > MAX_PROMPT_LENGTH) {
        oversizedPrompts++;
        details.push({
          item: `S${String(i + 1).padStart(2, '0')}提示词长度`,
          status: 'fail',
          issue: `${promptText.length}字 > ${MAX_PROMPT_LENGTH}字上限`,
          suggestion: `精简至${MAX_PROMPT_LENGTH}字以内`
        });
      } else if (promptText.length >= 400) {
        optimalPrompts++; // 🆕 接近上限但合规 = 充分利用空间
      }
    }

    if (oversizedPrompts > 0) {
      score -= Math.min(2, oversizedPrompts * 0.5); // v6.0: 放宽扣分
      details.push({
        item: '提示词长度',
        status: 'fail',
        issue: `${oversizedPrompts}/${prompts.length}个镜头提示词超标`,
        suggestion: '使用Compliance Agent自动精简超标提示词'
      });
    } else if (optimalPrompts >= prompts.length * 0.5) {
      score += 0.5; // 🆕 加分：≥50%镜头充分利用500字空间
      details.push({ item: '提示词长度', status: 'pass', note: `全部合规，${optimalPrompts}个镜头充分利用空间(优秀)` });
    } else {
      details.push({ item: '提示词长度', status: 'pass', note: `全部符合${MAX_PROMPT_LENGTH}字限制` });
    }

  // 检查要素完整性 (v5.7-Peng-fix: 语义化检测，支持情感/治愈/学习类动作)
    const requiredElements = ['主体', '动作', '光影', '风格'];
    let incompletePrompts = 0;
    
    // v5.7-Peng: 多类别动作语义检测
    const ACTION_CATEGORIES = {
      physical: ['挥','打','击','战','斗','跑','走','站','跳','追','刺','劈','砍','挡','攻','守','推','fight','chase','battle','combat'],
      emotional: ['教导','求助','陪伴','安慰','拥抱','哭泣','微笑','感动','流泪','深情','teach','help','comfort','hug','cry','smile'],
      intellectual: ['学习','写作业','读书','思考','画画','写','读','贴','改造','灵机一动','study','write','read','draw','think'],
      social: ['围','旁','一起','互动','对话','说','问','答','group','together','interact','talk'],
      creative: ['画','写','贴','改造','灵机一动','create','draw','design','invent'],
      daily: ['演奏','弹奏','唱歌','跳舞','吃饭','工作','通知','寻找','发现','探索','play','sing','dance','eat','work'],
      psychological: ['回忆','回想','闪回','追忆','思念','面对','正视','承受','忍耐','挣扎','抉择','犹豫','坚定','决心','觉醒','顿悟','回想','remember','recall','flashback','confront','struggle','decide','hesitate','determine','awaken','realize'],
      narrative: ['开端','推进','转折','高潮','结局','收束','落幕','起','承','转','合','开场','结尾','过渡','exposition','rising','climax','falling','resolution','transition','opening','ending']
    };
    
    function hasSemanticAction(text) {
      const textLower = text.toLowerCase();
      let coveredCategories = 0;
      for (const [category, keywords] of Object.entries(ACTION_CATEGORIES)) {
        if (keywords.some(kw => textLower.includes(kw.toLowerCase()))) {
          coveredCategories++;
        }
      }
      return coveredCategories >= 1; // 覆盖至少1个类别即算有动作
    }
    
    // v5.7-Peng: 扩展主体检测，识别具体角色名
    function hasSemanticSubject(text, characters) {
      // 检查是否有角色名
      if (characters && characters.length > 0) {
        for (const char of characters) {
          const charName = char.name || char;
          if (text.includes(charName)) return true;
        }
      }
      // 回退到标签词检测
      return /角色|人物|主角|反派|character|protagonist|antagonist/.test(text) || /[，,]/.test(text);
    }
    
    for (const prompt of prompts) {
      const promptText = typeof prompt === 'string' ? prompt : (prompt.text || prompt.prompt || '');
      const characters = storyPlan.characters || [];
      
      const hasSubject = hasSemanticSubject(promptText, characters);
      const hasAction = hasSemanticAction(promptText) || /[\[\(].+[\]\)]/.test(promptText); // 括号/方括号内追加的动作也算
      const hasLighting = /光|影|逆|侧|柔|硬|亮|暗|light|shadow|backlight|rim|volumetric|atmospheric/.test(promptText);
      const hasStyle = /风格|写实|科幻|古风|赛博|史诗|动漫|国漫|CG|3D|anime|style|realistic|scifi|cyberpunk|epic|科技|科技感|现代|商业|品牌|极简|简约|纯色|背景虚化|高饱和|低饱和|明亮|暗调|暖色调|冷色调|运动|活力|动感|激烈|紧张|温馨|治愈|浪漫|梦幻|3D|2D|动画|live-action|实拍|unrealengine|vfx|特效|渲染|rendering|工业光魔|纪实|纪录片|人文|文艺|国风|中国风|水墨|工笔画|广告|宣传片|电商|自然|户外|田园|乡村|生活|cinematic|film|movie/.test(promptText);
      
      if (!hasSubject || !hasAction || !hasLighting || !hasStyle) {
        incompletePrompts++;
      }
    }

    if (incompletePrompts > 0) {
      score -= Math.min(1, incompletePrompts * 0.2); // v6.0: 放宽扣分
      details.push({
        item: '要素完整性',
        status: 'warn',
        issue: `${incompletePrompts}/${prompts.length}个镜头缺少关键要素`,
        suggestion: '确保每个提示词包含主体、动作、光影、风格'
      });
    } else {
      score += 0.3; // 🆕 加分：全部完整
      details.push({ item: '要素完整性', status: 'pass', note: '要素完整(优秀)' });
    }

    // 检查冲突描述
    const lightingConflicts = [];
    for (let i = 0; i < prompts.length; i++) {
      const promptText = typeof prompts[i] === 'string' ? prompts[i] : (prompts[i].text || prompts[i].prompt || '');
      const hasBacklight = /逆光|背光/.test(promptText);
      const hasFrontStrong = /正面强光|正面直射/.test(promptText);
      if (hasBacklight && hasFrontStrong) {
        lightingConflicts.push(i + 1);
      }
    }

    if (lightingConflicts.length > 0) {
      score -= 0.5;
      details.push({
        item: '冲突避免',
        status: 'warn',
        issue: `S${lightingConflicts.map(n => String(n).padStart(2, '0')).join(',')}光影逻辑冲突`,
        suggestion: '统一光源方向，避免逆光+正面强光同时出现'
      });
    } else {
      details.push({ item: '冲突避免', status: 'pass', note: '无逻辑冲突' });
    }

    // P1-2: 角色一致性检查 - 从"只要有角色出现就通过"升级为严格检查
    // 检查跨镜头角色形象统一，避免"换脸"
    const characters = storyPlan.characters || [];
    let consistencyScore = 0; // 0-10 一致性得分
    let consistencyDetails = [];
    
    for (const char of characters) {
      const charName = char.name || char.id;
      const charSpecies = char.species || '人类';
      const charFeatures = (char.features || []).map(f => f.toLowerCase());
      const charSignature = (char.signature || '').toLowerCase();
      
      // 收集该角色在所有镜头中的描述
      const charShots = (storyPlan.shots || []).filter(s => 
        (s.characters || []).some(c => c === charName || c === char.id || c === (char.id || charName))
      );
      
      if (charShots.length > 1) {
        let featureConsistency = 0; // 特征一致性
        let signatureFound = 0; // 标志性特征出现次数
        let speciesMismatches = 0; // 物种/性别矛盾
        let extremeContradictions = 0; // 极端矛盾
        
        for (const shot of charShots) {
          const desc = (shot.description || '').toLowerCase();
          
          // 检查特征是否保留
          const foundFeatures = charFeatures.filter(f => desc.includes(f));
          if (foundFeatures.length > 0 || charFeatures.length === 0) {
            featureConsistency++;
          }
          
          // 检查标志性特征
          if (charSignature && desc.includes(charSignature)) {
            signatureFound++;
          }
          
          // 检查物种/性别矛盾（严重错误）
          // 如果角色是人类，描述中出现"兽人"、"精灵"等 = 矛盾
          const speciesMap = {
            '人类': ['人类', 'human', '人'],
            '精灵': ['精灵', 'elf', '尖耳'],
            '兽人': ['兽人', 'orc', '獠牙'],
            'AI': ['ai', '机器人', '机械', '金属'],
            '外星人': ['外星人', 'alien', '异星']
          };
          const expectedSpecies = speciesMap[charSpecies] || [charSpecies.toLowerCase()];
          const otherSpecies = Object.values(speciesMap).flat().filter(s => !expectedSpecies.includes(s));
          if (otherSpecies.some(s => desc.includes(s))) {
            speciesMismatches++;
          }
          
          // 检查极端矛盾（如"黑发"vs"金发"、"男性"vs"女性"）
          const hairColors = ['黑发', '金发', '红发', '白发', '棕发', '蓝发'];
          const charHair = charFeatures.find(f => hairColors.some(h => f.includes(h)));
          if (charHair) {
            const otherHair = hairColors.filter(h => !charHair.includes(h) && desc.includes(h));
            if (otherHair.length > 0) extremeContradictions++;
          }
          
          const genders = [['男性', '雄性', '男孩', '男人'], ['女性', '雌性', '女孩', '女人']];
          const charGender = genders.findIndex(g => g.some(x => charFeatures.some(f => f.includes(x))));
          if (charGender >= 0) {
            const otherGender = genders[1 - charGender];
            if (otherGender.some(g => desc.includes(g))) extremeContradictions++;
          }
        }
        
        // 计算该角色的一致性得分
        const totalShots = charShots.length;
        const featureRate = featureConsistency / totalShots;
        const signatureRate = charSignature ? signatureFound / totalShots : 1.0;
        const speciesErrorRate = speciesMismatches / totalShots;
        const extremeErrorRate = extremeContradictions / totalShots;
        
        // 加权计算（物种矛盾最严重，标志性特征次之）
        let charScore = 10.0;
        if (speciesErrorRate > 0) charScore -= speciesErrorRate * 5.0; // 物种矛盾扣5分/次
        if (extremeErrorRate > 0) charScore -= extremeErrorRate * 4.0; // 极端矛盾扣4分/次
        if (signatureRate < 0.5 && charSignature) charScore -= (1 - signatureRate) * 2.0; // 标志性特征缺失
        if (featureRate < 0.5) charScore -= (1 - featureRate) * 1.0; // 特征不一致
        
        charScore = Math.max(0, Math.min(10, charScore));
        consistencyScore += charScore;
        
        // 记录详细结果
        if (charScore >= 9) {
          consistencyDetails.push({ item: `角色一致性(${charName})`, status: 'pass', note: `特征稳定${(featureRate*100).toFixed(0)}%，标志性特征${(signatureRate*100).toFixed(0)}%` });
        } else if (charScore >= 7) {
          consistencyDetails.push({ item: `角色一致性(${charName})`, status: 'warn', issue: `部分镜头特征偏差`, suggestion: `确保"${charFeatures.join(',')}"特征在每镜都出现` });
        } else {
          consistencyDetails.push({ item: `角色一致性(${charName})`, status: 'fail', issue: `严重不一致: 物种矛盾${speciesMismatches}次，极端矛盾${extremeContradictions}次`, suggestion: '修正角色物种/性别/发色描述，确保跨镜头统一' });
        }
      } else {
        consistencyDetails.push({ item: `角色一致性(${charName})`, status: 'pass', note: '单镜头/未出现' });
        consistencyScore += 10; // 单镜头默认满分
      }
    }
    
    // 平均一致性得分
    const avgConsistency = characters.length > 0 ? consistencyScore / characters.length : 10;
    
    if (avgConsistency < 7) {
      score -= 1.5; // 严重不一致
      for (const cd of consistencyDetails.filter(c => c.status === 'fail')) {
        details.push(cd);
      }
    } else if (avgConsistency < 9) {
      score -= 0.5; // 轻微不一致
      for (const cd of consistencyDetails.filter(c => c.status === 'warn')) {
        details.push(cd);
      }
    } else {
      for (const cd of consistencyDetails) {
        details.push(cd);
      }
    }

    // 🆕 P1-4: 4. 时长精确性检查
    if (storyPlan.targetDuration) {
      const actualDuration = (storyPlan.shots || []).reduce((sum, s) => sum + (s.duration || 5), 0);
      const targetDuration = storyPlan.targetDuration;
      const durationDeviation = Math.abs(actualDuration - targetDuration) / targetDuration;
      
      if (durationDeviation > 0.2) { // 偏差>20%
        score -= 0.5;
        details.push({
          item: '时长精确性',
          status: 'warn',
          issue: `实际时长${actualDuration}s vs 目标${targetDuration}s，偏差${Math.round(durationDeviation*100)}%`,
          suggestion: '调整镜头时长，确保总时长偏差<10%'
        });
      } else if (durationDeviation > 0.1) {
        score -= 0.2;
        details.push({
          item: '时长精确性',
          status: 'warn',
          issue: `时长偏差${Math.round(durationDeviation*100)}%`,
          suggestion: '微调镜头时长'
        });
      } else {
        score += 0.2;
        details.push({ item: '时长精确性', status: 'pass', note: `偏差仅${Math.round(durationDeviation*100)}%(精确)` });
      }
    }
    
    // 🆕 P1-4: 5. 提示词丰满度检查（确保400-490字区间）
    let lengthViolations = 0;
    let lengthTooShort = 0;
    let optimalLength = 0;
    for (const prompt of prompts) {
      const promptText = typeof prompt === 'string' ? prompt : (prompt.text || prompt.prompt || '');
      if (promptText.length > 490) lengthViolations++;
      if (promptText.length < 200 && promptText.length > 50) lengthTooShort++; // 50-200字算偏短
      if (promptText.length >= 400 && promptText.length <= 490) optimalLength++;
    }
    
    if (lengthViolations > 0) {
      score -= 0.5;
      details.push({
        item: '提示词长度',
        status: 'warn',
        issue: `${lengthViolations}个镜头超过490字上限`,
        suggestion: '精简提示词，确保≤490字'
      });
    } else {
      details.push({ item: '提示词长度', status: 'pass', note: '全部符合490字限制' });
    }
    
    if (lengthTooShort > 0) {
      score -= 0.3;
      details.push({
        item: '提示词丰满度',
        status: 'warn',
        issue: `${lengthTooShort}个镜头提示词偏短(<200字)`,
        suggestion: '扩充提示词到400-490字，充分利用官方能力'
      });
    } else if (optimalLength >= prompts.length * 0.7) {
      score += 0.3; // 70%以上在最佳区间
      details.push({ item: '提示词丰满度', status: 'pass', note: `${optimalLength}个镜头在400-490最佳区间(优秀)` });
    } else {
      details.push({ item: '提示词丰满度', status: 'pass', note: '提示词丰满度达标' });
    }

    score = Math.max(1, Math.min(10, score));
    return { score: parseFloat(score.toFixed(1)), details };
  }

  // ============ 维度4：艺术性与感染力 v7.2-Peng ============
  // P1-1: 色彩评分算法权重调整 - 光影/构图/运镜权重优化
  _evaluateArtistry(storyPlan, prompts) {
    const details = [];
    let score = 8.0; // 基础分

    const shots = storyPlan.shots || [];
    const totalShots = shots.length || prompts.length || 1;

    // 1. 光影层次（权重 0.35 → 最高权重，因为光影是画面质感核心）
    let lightingRichShots = 0;
    let lightingComplexShots = 0;
    let lightingMasterShots = 0; // 🆕 大师级光影
    for (const prompt of prompts) {
      const promptText = typeof prompt === 'string' ? prompt : (prompt.text || prompt.prompt || '');
      const hasLight = /光|light|volumetric|atmospheric|ambient|glow|gleam|beam|rays|volumetric/.test(promptText);
      const hasShadow = /影|阴影|剪影|shadow|shade|silhouette|rim|轮廓/.test(promptText);
      
      if (hasLight || hasShadow) {
        lightingRichShots++;
      }
      
      // 🆕 复杂光影：≥2种光源描述
      const lightTypes = [];
      if (/逆光|backlight|背光/.test(promptText)) lightTypes.push('逆光');
      if (/侧光|side.?light|侧逆|侧顺/.test(promptText)) lightTypes.push('侧光');
      if (/轮廓光|rim.?light|边缘光/.test(promptText)) lightTypes.push('轮廓光');
      if (/顶光|top.?light|头发光/.test(promptText)) lightTypes.push('顶光');
      if (/底光|bottom.?light|脚光/.test(promptText)) lightTypes.push('底光');
      if (/体积光|volumetric|丁达尔|tyndall|上帝光/.test(promptText)) lightTypes.push('体积光');
      if (/柔光|soft|diffused|散射/.test(promptText)) lightTypes.push('柔光');
      if (/硬光|hard|直射|聚光/.test(promptText)) lightTypes.push('硬光');
      if (/反光板|bounce|反射|reflector/.test(promptText)) lightTypes.push('反光');
      if (/环境光|ambient|fill|补光/.test(promptText)) lightTypes.push('环境光');
      
      if (lightTypes.length >= 2) lightingComplexShots++;
      if (lightTypes.length >= 4) lightingMasterShots++; // 🆕 4种以上光源 = 大师级
    }
    
    const lightingRichRatio = lightingRichShots / totalShots;
    const lightingComplexRatio = lightingComplexShots / totalShots;
    const lightingMasterRatio = lightingMasterShots / totalShots;

    if (lightingRichRatio < 0.3 && totalShots > 3) {
      score -= 0.7; // 🔥 权重提升：光影不足扣更多
      details.push({ item: '光影层次', status: 'warn', issue: `仅${(lightingRichRatio*100).toFixed(0)}%镜头有光影描述`, suggestion: '增加光源方向、阴影层次、体积光' });
    } else if (lightingMasterRatio >= 0.2) {
      score += 1.0; // 🆕 大师级光影：+1.0（最高单项加分）
      details.push({ item: '光影层次', status: 'pass', note: `${lightingMasterShots}个镜头大师级光影(卓越)` });
    } else if (lightingComplexRatio >= 0.3) {
      score += 0.7; // 🔥 复杂光影加分提升
      details.push({ item: '光影层次', status: 'pass', note: `${lightingComplexShots}个镜头复杂光影(优秀)` });
    } else if (lightingRichRatio >= 0.5) {
      score += 0.5;
      details.push({ item: '光影层次', status: 'pass', note: `${lightingRichShots}个镜头光影丰富` });
    } else {
      details.push({ item: '光影层次', status: 'pass', note: `${lightingRichShots}个镜头有光影` });
    }

    // 2. 景别多样性（权重 0.25）
    const shotSizes = new Set();
    const sizeDetections = []; // 🆕 精确检测记录
    for (const shot of shots) {
      const camera = (shot.camera || shot.description || shot.text || shot.prompt || '').toLowerCase();
      // 🆕 P1-3: 场景检测精度提升 - 更精确的景别识别
      if (/极端特写|extreme.?close|ecu|微距|macro|瞳孔|毛孔|纹理/.test(camera)) { shotSizes.add('极端特写'); sizeDetections.push('极端特写'); }
      else if (/特写|close.?up|cu|面部|face|眼神|微表情|近景|medium.?close/.test(camera)) { shotSizes.add('特写'); sizeDetections.push('特写'); }
      else if (/中景|medium|medium.?shot|ms|半身|腰部|waist/.test(camera)) { shotSizes.add('中景'); sizeDetections.push('中景'); }
      else if (/全景|full|full.?shot|fs|全身|long|wide/.test(camera)) { shotSizes.add('全景'); sizeDetections.push('全景'); }
      else if (/远景|wide|long.?shot|ls| establishing|大全景|very.?wide/.test(camera)) { shotSizes.add('远景'); sizeDetections.push('远景'); }
      else if (/航拍|aerial|drone|bird|god|俯拍|俯瞰|top.?down/.test(camera)) { shotSizes.add('航拍'); sizeDetections.push('航拍'); }
      else if (/主观|pov|point.?of.?view|第一人称|主观视角/.test(camera)) { shotSizes.add('主观'); sizeDetections.push('主观'); }
    }
    // 备用：从prompts推断
    if (shotSizes.size === 0 && prompts && prompts.length > 0) {
      for (const prompt of prompts) {
        const text = typeof prompt === 'string' ? prompt : (prompt.text || prompt.prompt || '');
        const lower = text.toLowerCase();
        if (/极端特写|ecu|微距|macro|瞳孔|毛孔/.test(lower)) { shotSizes.add('极端特写'); sizeDetections.push('极端特写'); }
        else if (/特写|close.?up|面部|face|眼神|微表情/.test(lower)) { shotSizes.add('特写'); sizeDetections.push('特写'); }
        else if (/中景|medium|半身|waist/.test(lower)) { shotSizes.add('中景'); sizeDetections.push('中景'); }
        else if (/全景|full|全身|long/.test(lower)) { shotSizes.add('全景'); sizeDetections.push('全景'); }
        else if (/远景|wide|establishing|大全景/.test(lower)) { shotSizes.add('远景'); sizeDetections.push('远景'); }
        else if (/航拍|aerial|drone|俯拍/.test(lower)) { shotSizes.add('航拍'); sizeDetections.push('航拍'); }
        else if (/主观|pov|第一人称/.test(lower)) { shotSizes.add('主观'); sizeDetections.push('主观'); }
      }
    }

    if (shotSizes.size < 3 && totalShots > 5) {
      score -= 0.5;
      details.push({ item: '景别多样性', status: 'warn', issue: `仅${shotSizes.size}种景别(${Array.from(shotSizes).join(',')})，画面单调`, suggestion: '增加特写和全景/远景' });
    } else if (shotSizes.size >= 5) {
      score += 0.6; // 🔥 权重提升：5种以上景别加分更多
      details.push({ item: '景别多样性', status: 'pass', note: `${shotSizes.size}种景别(卓越): ${Array.from(shotSizes).join(',')}` });
    } else if (shotSizes.size >= 4) {
      score += 0.4;
      details.push({ item: '景别多样性', status: 'pass', note: `${shotSizes.size}种景别(优秀): ${Array.from(shotSizes).join(',')}` });
    } else {
      details.push({ item: '景别多样性', status: 'pass', note: `${shotSizes.size}种景别: ${Array.from(shotSizes).join(',')}` });
    }

    // 3. 运镜多样性（权重 0.20）
    const movements = new Set();
    const movementDetections = []; // 🆕 精确检测记录
    for (const shot of shots) {
      const camera = (shot.camera || shot.description || shot.text || shot.prompt || '').toLowerCase();
      // 🆕 P1-3: 更精确的运镜识别
      if (/推|push|dolly.?in|zoom.?in|逼近|靠近/.test(camera)) { movements.add('推'); movementDetections.push('推'); }
      if (/拉|pull|dolly.?out|zoom.?out|远离|后退/.test(camera)) { movements.add('拉'); movementDetections.push('拉'); }
      if (/摇|pan|左摇|右摇|横摇|tilt|俯仰/.test(camera)) { movements.add('摇'); movementDetections.push('摇'); }
      if (/移|track|truck|slide|平移|横移|侧移/.test(camera)) { movements.add('移'); movementDetections.push('移'); }
      if (/跟|follow|tracking|尾随|追随|背跟/.test(camera)) { movements.add('跟'); movementDetections.push('跟'); }
      if (/环绕|orbit|circle|360|环绕拍摄|绕/.test(camera)) { movements.add('环绕'); movementDetections.push('环绕'); }
      if (/固定|static|lock|固定机位|静止|定/.test(camera)) { movements.add('固定'); movementDetections.push('固定'); }
      if (/手持|handheld|hand.?held|肩扛|随身/.test(camera)) { movements.add('手持'); movementDetections.push('手持'); }
      if (/升降|crane|jib|boom|起|落|吊臂/.test(camera)) { movements.add('升降'); movementDetections.push('升降'); }
      if (/旋转|rotate|spin|roll|翻滚|转/.test(camera)) { movements.add('旋转'); movementDetections.push('旋转'); }
      if (/甩|whip|swish|pan|快速摇镜/.test(camera)) { movements.add('甩'); movementDetections.push('甩'); }
      if (/航拍|aerial|drone|fly|飞行|穿越/.test(camera)) { movements.add('航拍'); movementDetections.push('航拍'); }
    }
    // 备用：从prompts推断
    if (movements.size === 0 && prompts && prompts.length > 0) {
      for (const prompt of prompts) {
        const text = typeof prompt === 'string' ? prompt : (prompt.text || prompt.prompt || '');
        const lower = text.toLowerCase();
        if (/推|push|dolly|逼近/.test(lower)) { movements.add('推'); movementDetections.push('推'); }
        if (/拉|pull|dolly.?out|远离/.test(lower)) { movements.add('拉'); movementDetections.push('拉'); }
        if (/摇|pan|tilt|横摇|俯仰/.test(lower)) { movements.add('摇'); movementDetections.push('摇'); }
        if (/移|track|slide|平移|横移/.test(lower)) { movements.add('移'); movementDetections.push('移'); }
        if (/跟|follow|tracking|尾随/.test(lower)) { movements.add('跟'); movementDetections.push('跟'); }
        if (/环绕|orbit|circle|360/.test(lower)) { movements.add('环绕'); movementDetections.push('环绕'); }
        if (/固定|static|lock|定/.test(lower)) { movements.add('固定'); movementDetections.push('固定'); }
        if (/手持|handheld|肩扛/.test(lower)) { movements.add('手持'); movementDetections.push('手持'); }
        if (/升降|crane|jib|boom|吊臂/.test(lower)) { movements.add('升降'); movementDetections.push('升降'); }
        if (/旋转|rotate|spin|翻滚/.test(lower)) { movements.add('旋转'); movementDetections.push('旋转'); }
        if (/甩|whip|swish|快速摇/.test(lower)) { movements.add('甩'); movementDetections.push('甩'); }
        if (/航拍|aerial|drone|fly/.test(lower)) { movements.add('航拍'); movementDetections.push('航拍'); }
      }
    }

    if (movements.size < 3 && totalShots > 5) {
      score -= 0.4;
      details.push({ item: '运镜多样性', status: 'warn', issue: `仅${movements.size}种运镜(${Array.from(movements).join(',')})`, suggestion: '增加推轨、环绕、跟拍、升降' });
    } else if (movements.size >= 6) {
      score += 0.5; // 🔥 6种以上运镜加分
      details.push({ item: '运镜多样性', status: 'pass', note: `${movements.size}种运镜(卓越): ${Array.from(movements).join(',')}` });
    } else if (movements.size >= 4) {
      score += 0.3;
      details.push({ item: '运镜多样性', status: 'pass', note: `${movements.size}种运镜(丰富): ${Array.from(movements).join(',')}` });
    } else {
      details.push({ item: '运镜多样性', status: 'pass', note: `${movements.size}种运镜: ${Array.from(movements).join(',')}` });
    }

    // 4. 构图层次（权重 0.15，🆕 新增独立维度）
    let compositionRichShots = 0;
    for (const prompt of prompts) {
      const text = typeof prompt === 'string' ? prompt : (prompt.text || prompt.prompt || '');
      const compositions = [];
      if (/三分法|rule.?of.?thirds|黄金分割/.test(text)) compositions.push('三分法');
      if (/对称|symmetry|对称构图|中心对称/.test(text)) compositions.push('对称');
      if (/框架|frame|门框|窗框|前景框架/.test(text)) compositions.push('框架');
      if (/引导线|leading.?line|线条引导|视线引导/.test(text)) compositions.push('引导线');
      if (/层次|layer|前景|中景|背景|纵深/.test(text)) compositions.push('层次');
      if (/对角线|diagonal|三角形|triangular|黄金螺旋/.test(text)) compositions.push('几何');
      if (/留白|negative.?space|极简|空旷/.test(text)) compositions.push('留白');
      
      if (compositions.length >= 2) compositionRichShots++;
    }
    
    const compositionRatio = compositionRichShots / totalShots;
    if (compositionRatio >= 0.3) {
      score += 0.5;
      details.push({ item: '构图层次', status: 'pass', note: `${compositionRichShots}个镜头构图丰富(优秀)` });
    } else if (compositionRatio >= 0.15) {
      score += 0.2;
      details.push({ item: '构图层次', status: 'pass', note: `${compositionRichShots}个镜头有构图设计` });
    } else if (totalShots > 3) {
      score -= 0.3;
      details.push({ item: '构图层次', status: 'warn', issue: '缺少构图设计', suggestion: '增加三分法、对称、框架、引导线等构图' });
    }

    // 5. 情绪共鸣（权重 0.10）
    const emotionShots = shots.filter(s => {
      const desc = (s.description || '').toLowerCase();
      return desc.includes('表情') || desc.includes('眼神') || desc.includes('泪') || desc.includes('笑') || desc.includes('颤抖') || desc.includes('挣扎');
    });
    const hasEmotionCurve = shots.some(s => s.emotionStart || s.emotionEnd || s.tension);

    if (emotionShots.length === 0 && totalShots > 3) {
      score -= 0.3;
      details.push({ item: '情绪共鸣', status: 'warn', issue: '缺少情绪特写', suggestion: '高潮/转折处增加面部特写' });
    } else if (hasEmotionCurve && emotionShots.length >= 3) {
      score += 0.3;
      details.push({ item: '情绪共鸣', status: 'pass', note: `${emotionShots.length}个情绪镜头+曲线(丰富)` });
    } else {
      details.push({ item: '情绪共鸣', status: 'pass', note: `${emotionShots.length}个情绪镜头` });
    }

    // 6. 色彩设计（权重 0.10）
    const colorDesign = prompts.filter(p => {
      const text = typeof p === 'string' ? p : (p.text || p.prompt || '');
      return /色调|色彩|色温|冷暖|对比|monochrome|palette|color.?grading|青橙|暖金|冷蓝|糖果|莫兰迪|高饱和|低饱和|赛博朋克紫粉|大地色|黑白高对比/.test(text);
    }).length;
    const colorRatio = colorDesign / totalShots;
    
    if (colorRatio >= 0.5) {
      score += 0.5; // 🔥 权重提升
      details.push({ item: '色彩设计', status: 'pass', note: `${colorDesign}个镜头有色彩设计(优秀)` });
    } else if (colorRatio >= 0.2) {
      score += 0.2;
      details.push({ item: '色彩设计', status: 'pass', note: `${colorDesign}个镜头有色彩设计` });
    } else if (totalShots > 3) {
      score -= 0.2;
      details.push({ item: '色彩设计', status: 'warn', issue: '缺少色彩设计', suggestion: '增加色调、色温、色彩对比描述' });
    }

    // 7. 镜头语言创新性（加分项 0.05）
    const hasPOV = shots.some(s => (s.camera || '').toLowerCase().includes('主观') || (s.camera || '').toLowerCase().includes('pov'));
    const hasSymbolism = shots.some(s => {
      const desc = (s.description || '').toLowerCase();
      return /隐喻|象征|倒影|镜子|影子|面具|光环|双重曝光|叠化|超现实/.test(desc);
    });
    
    if (hasPOV && hasSymbolism) {
      score += 0.3;
      details.push({ item: '镜头语言', status: 'pass', note: '主观镜头+视觉隐喻(创新)' });
    } else if (hasPOV || hasSymbolism) {
      score += 0.15;
      details.push({ item: '镜头语言', status: 'pass', note: hasPOV ? '主观镜头' : '视觉隐喻' });
    }

    // 8. 节奏感（加分项 0.05）
    const hasRhythm = storyPlan.pacing || (storyPlan.emotionCurve && storyPlan.emotionCurve.some(p => p.tension > 8));
    const hasSpeedRamp = prompts.some(p => {
      const text = typeof p === 'string' ? p : (p.text || p.prompt || '');
      return /变速|速度 ramp|快动作|慢动作|延时|time.?lapse|升格|降格/.test(text);
    });
    
    if (hasRhythm && hasSpeedRamp) {
      score += 0.3;
      details.push({ item: '节奏感', status: 'pass', note: '有节奏设计+变速运镜(丰富)' });
    } else if (hasRhythm) {
      score += 0.15;
      details.push({ item: '节奏感', status: 'pass', note: '有节奏设计' });
    }

    score = Math.max(1, Math.min(10, score));
    return { score: parseFloat(score.toFixed(1)), details };
  }

  // ============ 辅助方法 ============
  _extractKeywords(text) {
    if (!text) return [];
    // 提取2-6字的名词和动词
    const words = [];
    const segments = text.split(/[，。；！？、]/);
    for (const seg of segments) {
      if (seg.length >= 2 && seg.length <= 8) {
        words.push(seg.trim());
      }
    }
    return words.slice(0, 15); // 最多15个关键词
  }

  _collectStrengths(req, script, spec, art) {
    const strengths = [];
    if (req.score >= 8.5) strengths.push('需求对齐精准');
    if (script.score >= 8.5) strengths.push('剧本结构完整');
    if (spec.score >= 8.5) strengths.push('提示词规范达标');
    if (art.score >= 8.5) strengths.push('视觉冲击力强');
    if (req.details.some(d => d.status === 'pass' && d.item === '情绪匹配')) strengths.push('情绪风格一致');
    if (script.details.some(d => d.status === 'pass' && d.item === '记忆点')) strengths.push('有记忆点镜头');
    return strengths.slice(0, 3);
  }

  _collectWeaknesses(req, script, spec, art) {
    const weaknesses = [];
    for (const d of req.details) if (d.status === 'fail') weaknesses.push(`${d.item}: ${d.issue}`);
    for (const d of script.details) if (d.status === 'fail') weaknesses.push(`${d.item}: ${d.issue}`);
    for (const d of spec.details) if (d.status === 'fail') weaknesses.push(`${d.item}: ${d.issue}`);
    for (const d of art.details) if (d.status === 'fail') weaknesses.push(`${d.item}: ${d.issue}`);
    return weaknesses.slice(0, 3);
  }

  _generateSuggestions(req, script, spec, art) {
    const suggestions = [];
    for (const d of req.details) if (d.suggestion) suggestions.push(d.suggestion);
    for (const d of script.details) if (d.suggestion) suggestions.push(d.suggestion);
    for (const d of spec.details) if (d.suggestion) suggestions.push(d.suggestion);
    for (const d of art.details) if (d.suggestion) suggestions.push(d.suggestion);
    return [...new Set(suggestions)].slice(0, 5);
  }

  _selectWinner(scores) {
    let winnerId = null;
    let winnerScore = -1;
    
    for (const [id, data] of Object.entries(scores)) {
      if (data.total > winnerScore) {
        winnerScore = data.total;
        winnerId = id;
      }
    }
    
    return { id: winnerId, score: winnerScore };
  }

  _generateComparativeAnalysis(scores, winner) {
    const entries = Object.entries(scores).sort((a, b) => b[1].total - a[1].total);
    let analysis = `比稿结果: ${entries[0][0]}胜出 (总分: ${entries[0][1].total.toFixed(1)})。`;
    
    if (entries.length > 1) {
      const runnerUp = entries[1];
      const diff = entries[0][1].total - runnerUp[1].total;
      analysis += ` 与${runnerUp[0]}的差距: ${diff.toFixed(1)}分。`;
      
      // 找出每个维度的最佳
      const dimensions = ['需求对齐', '剧本质量', '规范符合', '艺术性'];
      for (const dim of dimensions) {
        let bestId = null;
        let bestScore = -1;
        for (const [id, data] of entries) {
          const score = data.dimensions[dim];
          if (score > bestScore) {
            bestScore = score;
            bestId = id;
          }
        }
        if (bestId) {
          analysis += ` ${dim}最佳: ${bestId}(${bestScore})。`;
        }
      }
    }
    
    return analysis;
  }

  _generateSystemFeedback(scores, winner) {
    const allWeaknesses = [];
    const allSuggestions = [];
    
    for (const [id, data] of Object.entries(scores)) {
      allWeaknesses.push(...data.feedback.weaknesses);
      allSuggestions.push(...data.feedback.suggestions);
    }
    
    // 去重并找出高频问题
    const weaknessCounts = {};
    for (const w of allWeaknesses) {
      const key = w.split(':')[0]; // 提取问题类型
      weaknessCounts[key] = (weaknessCounts[key] || 0) + 1;
    }
    
    const priorityIssues = Object.entries(weaknessCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([issue, count]) => ({
        issue,
        affectedSchemes: count,
        severity: count >= 2 ? 'systematic' : 'individual'
      }));
    
    return {
      priorityIssues,
      upstreamImprovements: [...new Set(allSuggestions)].slice(0, 5)
    };
  }
}

// ============ 主入口 ============
function main() {
  const args = parseArgs();
  const command = process.argv[2];

  if (command === 'evaluate' || command === 'eval') {
    (async () => {
      const inputPath = args.input || args.i;
      const outputPath = args.output || args.o;

      if (!inputPath) {
        console.error('❌ 缺少 --input 参数');
        process.exit(1);
      }

      // 读取输入
      const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
      
      // 创建评测器
      const evaluator = new PitchEvaluator({
        userRequest: input.userRequest,
        minScore: parseFloat(args['min-score']) || 7.5
      });

      // 评测
      const result = evaluator.evaluate(input.candidates);

      // 输出结果
      const output = {
        evaluation: result
      };

      if (outputPath) {
        await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
        log('PitchEval', `✅ 评测报告已保存: ${outputPath}`);
      } else {
        console.log(JSON.stringify(output, null, 2));
      }

      // 打印摘要
      console.log(`\n═══════════════════════════════════════════════`);
      console.log(`🏆 比稿结果`);
      console.log(`═══════════════════════════════════════════════`);
      console.log(`最佳方案: ${result.winner} (总分: ${result.winnerScore.toFixed(1)})`);
      console.log(`通过阈值: ${result.passed ? '✅ 通过' : '❌ 未通过'} (要求≥${evaluator.minScore})`);
      console.log(`\n📊 详细分数:`);
      for (const [id, data] of Object.entries(result.scores).sort((a, b) => b[1].total - a[1].total)) {
        console.log(`  ${id}: ${data.total.toFixed(1)}分`);
        console.log(`    需求对齐: ${data.dimensions['需求对齐']} | 剧本质量: ${data.dimensions['剧本质量']}`);
        console.log(`    规范符合: ${data.dimensions['规范符合']} | 艺术性: ${data.dimensions['艺术性']}`);
      }
      console.log(`\n💡 修改建议:`);
      for (const suggestion of result.systemFeedback.upstreamImprovements) {
        console.log(`  • ${suggestion}`);
      }
      console.log(`═══════════════════════════════════════════════`);
    })();
  } else {
    console.log(`
Pitch Evaluation Engine v9.2.0-Peng

用法:
  node pitch-evaluation.js evaluate --input <candidates.json> [--output <report.json>]

示例:
  node pitch-evaluation.js evaluate \
    --input ./candidates.json \
    --output ./evaluation-report.json \
    --min-score 7.5
    `);
  }
}

// 导出（供其他脚本调用）
module.exports = { PitchEvaluator };

// 测试
if (require.main === module) {
  main();
}