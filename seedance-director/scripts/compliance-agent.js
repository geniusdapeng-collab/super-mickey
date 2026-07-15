#!/usr/bin/env node
/**
 * Seedance Compliance Agent v5.6-Peng
 * 智能合规闸门 — 在限制内把效果拉满
 * 
 * v5.6-Peng 更新:
 *   - 动作词库全类型扩展: 60+词覆盖战斗/喜剧/情感/驾驶/日常/奇幻/舞蹈
 *   - P0动作隐藏修复: _checkMissingP0检查所有P0 token内容中的动作词
 *   - 角色过滤null: shot.characters过滤null/undefined
 *
 * 核心原则：
 * - ≤500字 → 直接放行，一字不动，充分利用空间（v5.8-Peng: 对齐火山引擎500字上限）
 * - >500字 → 按优先级精炼重构（不是删除！）
 * - P0要素绝对不可动
 * - 用更强有力的短句替代冗长散文
 */

const MAX_PROMPT_LENGTH = 490; // v6.0-Peng: 490字安全上限，留10字缓冲

class ComplianceAgent {
  constructor(options = {}) {
    this.maxLength = options.maxLength || MAX_PROMPT_LENGTH;
    this.debug = options.debug || false;
  }

  /**
   * 主入口：合规检查与精炼
   * @param {string} prompt - 原始提示词
   * @param {Object} shot - 镜头信息
   * @param {Array} refs - 参考图列表
   * @returns {Object} 合规结果
   */
  check(prompt, shot = {}, refs = []) {
    const originalLength = prompt.length;

    // 1. 预检：≤500字直接放行（充分利用空间！v5.8-Peng: 对齐火山引擎上限）
    if (originalLength <= this.maxLength) {
      return {
        action: 'pass',
        gateDecision: 'PASS',
        compliant: true,
        compliantPrompt: prompt,
        originalLength,
        compressedLength: originalLength,
        compressionRatio: '0%',
        preserved: this._extractP0Elements(prompt, shot),
        refined: [],
        removed: [],
        qualityScore: this._calcQualityScore(prompt, shot, refs, 'pass'),
        qualityComment: '已合规，充分利用提示词空间',
        warnings: []
      };
    }

    // 2. >500字，需要精炼（v5.8-Peng: 对齐火山引擎上限）
    const tokens = this._parseAndTag(prompt, shot, refs);
    const overflow = originalLength - this.maxLength;
    const refineResult = this._smartRefine(tokens, overflow, shot, refs);

    // 3. 重构提示词
    const compliantPrompt = this._rebuild(refineResult.tokens);
    const finalLength = compliantPrompt.length;

    // 4. 质检
    const missingP0 = this._checkMissingP0(refineResult.tokens, shot);
    const qualityScore = this._calcQualityScore(compliantPrompt, shot, refs, 'refine', refineResult);
    
    let gateDecision = 'PASS';
    let warnings = [];

    if (missingP0.length > 0) {
      gateDecision = 'BLOCK';
      warnings.push(`P0要素丢失: ${missingP0.join(', ')}`);
    } else if (finalLength > this.maxLength) {
      gateDecision = 'BLOCK';
      warnings.push(`精炼后仍超标: ${finalLength} > ${this.maxLength}`);
    } else if (qualityScore < 0.85) {
      gateDecision = 'WARN';
      warnings.push(`质量分偏低: ${qualityScore.toFixed(2)} < 0.85`);
    }

    return {
      action: gateDecision === 'PASS' ? 'refine' : (gateDecision === 'WARN' ? 'refine' : 'refine'),
      gateDecision,
      compliant: finalLength <= this.maxLength && missingP0.length === 0,
      compliantPrompt,
      originalLength,
      compressedLength: finalLength,
      compressionRatio: `${Math.round((1 - finalLength / originalLength) * 100)}%`,
      preserved: refineResult.preserved.map(t => t.content),
      refined: refineResult.refined.map(r => ({ type: r.type, from: r.from, to: r.to, reason: r.reason })),
      removed: refineResult.removed.map(r => ({ content: r.content, reason: r.reason })),
      qualityScore,
      qualityComment: this._generateQualityComment(qualityScore, refineResult),
      warnings
    };
  }

  // ====== 解析与标记 ======

  _parseAndTag(prompt, shot, refs) {
    // 按语义分割
    const segments = prompt.split(/[，、；。]/).map(s => s.trim()).filter(Boolean);

    return segments.map((seg, index) => ({
      id: index,
      content: seg,
      original: seg,
      priority: this._tagPriority(seg, shot, refs),
      type: this._classifyType(seg, shot)
    }));
  }

  _tagPriority(seg, shot, refs) {
    // P0: 主体、核心动作、对白、运镜、程度副词、视觉化情绪
    if (this._isSubjectIdentity(seg, shot)) return 'P0';
    if (this._isCoreAction(seg)) return 'P0';
    if (this._isKeyDialogue(seg)) return 'P0';
    if (this._isCameraMovement(seg)) return 'P0';
    if (this._isIntensityModifier(seg)) return 'P0';
    if (this._isVisualEmotion(seg)) return 'P0';

    // P1: 光影、景别、情绪、风格
    if (this._isLighting(seg)) return 'P1';
    if (this._isShotSize(seg)) return 'P1';
    if (this._isEmotionLabel(seg)) return 'P1';
    if (this._isStyle(seg)) return 'P1';

    // P2: 环境（可重构为氛围词）
    if (this._isEnvironment(seg)) return 'P2';

    // P3: 冗余（仅删除）
    if (this._isRedundant(seg, refs)) return 'P3';
    if (this._isNonVisual(seg)) return 'P3';

    return 'P2';
  }

  _classifyType(seg, shot) {
    if (this._isSubjectIdentity(seg, shot)) return 'subject';
    if (this._isCoreAction(seg)) return 'action';
    if (this._isKeyDialogue(seg)) return 'dialogue';
    if (this._isCameraMovement(seg)) return 'camera';
    if (this._isLighting(seg)) return 'lighting';
    if (this._isEnvironment(seg)) return 'environment';
    if (this._isVisualEmotion(seg)) return 'emotion';
    return 'other';
  }

  // ====== P0 判断 ======

  _isSubjectIdentity(seg, shot = {}) {
    // v4.2-Peng-fix: 不再硬编码任何角色名，只从 shot.characters 判断
    const characters = (shot.characters || []).filter(Boolean); // v5.1-Peng: 过滤null
    const charNames = characters.map(c => {
      if (typeof c === 'string') return c;
      return c.name || c.id || '';
    }).filter(Boolean);
    for (const name of charNames) {
      if (seg.includes(name)) return true;
    }
    // 通用主体关键词（与具体角色无关）
    const genericKeywords = ['主角', '角色', '战士', '英雄', '反派', '对手', '人物'];
    return genericKeywords.some(kw => seg.includes(kw));
  }

  _isCoreAction(seg) {
    // v5.5-Peng-fix: 扩展动作词库 — 支持战斗/喜剧/情感/日常/舞蹈全类型
    const actionKeywords = [
      // 战斗动作
      '挥', '打', '击', '砸', '刺', '劈', '砍', '射', '发',
      '闪', '避', '躲', '跳', '跃', '冲', '撞', '飞', '跑',
      '挡', '防', '守', '攻', '战', '斗', '变', '化', '转',
      '抓', '握', '持', '举', '抬', '踢', '蹬', '踏', '摔',
      // 喜剧/日常动作
      '笑', '哭', '跑', '追', '逃', '跳', '爬', '滚', '翻',
      '摔', '滑', '撞', '碰', '跌', '倒', '扑', '抱', '背',
      '推', '拉', '拖', '拽', '扯', '扔', '抛', '接', '递',
      '吃', '喝', '咬', '嚼', '吞', '吐', '吹', '吸', '喷',
      '唱', '喊', '叫', '吼', '吵', '闹', '哭', '笑', '骂',
      '弹', '奏', '演', '舞', '扭', '摆', '摇', '晃', '抖',
      '开', '关', '按', '敲', '打', '拍', '摸', '捏', '揉',
      // 情感/互动动作
      '求', '婚', '爱', '恋', '抱', '吻', '亲', '牵', '挽',
      '扶', '搀', '挽', '搂', '拥', '依', '靠', '偎', '贴',
      '看', '望', '盯', '瞪', '瞥', '瞄', '视', '瞅', '瞧',
      '问', '答', '说', '讲', '谈', '聊', '诉', '告', '白',
      '求', '救', '帮', '助', '护', '守', '挡', '拦', '阻',
      '送', '给', '递', '交', '接', '受', '拿', '取', '放',
      // 驾驶/移动动作
      '驾', '驶', '开', '骑', '乘', '坐', '站', '立', '走',
      '行', '进', '退', '停', '泊', '靠', '追', '赶', '超',
      // 魔法/奇幻动作
      '施', '展', '念', '咒', '法', '术', '魔', '变', '化',
      '召', '唤', '引', '导', '控', '制', '凝', '聚', '散'
    ];
    return actionKeywords.some(kw => seg.includes(kw));
  }

  _isKeyDialogue(seg) {
    return seg.includes('对白') || seg.includes('"') || seg.includes('"');
  }

  _isCameraMovement(seg) {
    const cameraKeywords = [
      '推', '拉', '摇', '移', '跟', '升', '降', '环绕', '航拍',
      '变焦', '手持', '固定', '特写', '近景', '中景', '全景', '远景',
      '镜头', '推进', '拉远', '旋转', '甩镜'
    ];
    return cameraKeywords.some(kw => seg.includes(kw));
  }

  _isIntensityModifier(seg) {
    const intensityWords = [
      '快速', '剧烈', '大幅度', '高频率', '强力', '疯狂', '猛烈',
      '极速', '全力', '拼命', '怒吼', '咆哮', '炸裂', '爆发',
      '狠狠', '重重', '疾速', '迅猛', '激烈', '狂暴', '狠狠',
      '大幅度', '小幅度', '缓慢', '匀速', '加速', '减速'
    ];
    return intensityWords.some(kw => seg.includes(kw));
  }

  _isVisualEmotion(seg) {
    const visualEmotions = [
      '眉心', '咬肌', '眼神', '嘴角', '青筋', '瞳孔', '眉头',
      '表情', '面部', '狰狞', '扭曲', '紧绷', '抽搐'
    ];
    return visualEmotions.some(kw => seg.includes(kw));
  }

  // ====== P1 判断 ======

  _isLighting(seg) {
    const lightingKeywords = [
      '光', '影', '逆光', '侧光', '顶光', '底光', '柔和', '硬光',
      '黄昏', '清晨', '昏暗', '明亮', '金色', '暖光', '冷光',
      '霓虹', '荧光', '火光', '电光', '发光', '剪影', '阴影'
    ];
    return lightingKeywords.some(kw => seg.includes(kw));
  }

  _isShotSize(seg) {
    const shotSizeKeywords = ['特写', '近景', '中景', '全景', '远景', '大全景', '微距', '大特写'];
    return shotSizeKeywords.some(kw => seg.includes(kw));
  }

  _isEmotionLabel(seg) {
    const emotionKeywords = [
      '愤怒', '恐惧', '绝望', '悲伤', '紧张', '压迫', '兴奋',
      '平静', '冷酷', '残忍', '痛苦', '坚毅', '决绝', '疯狂',
      '杀意', '仇恨', '怒火', '惊恐', '哀伤', '悲壮'
    ];
    return emotionKeywords.some(kw => seg.includes(kw));
  }

  _isStyle(seg) {
    const styleKeywords = [
      '写实', '科幻', '古风', '赛博', '朋克', '奇幻', '史诗',
      '漫画', '动画', '油画', '水墨', '素描', '超现实', '暗黑'
    ];
    return styleKeywords.some(kw => seg.includes(kw));
  }

  // ====== P2 判断 ======

  _isEnvironment(seg) {
    const envKeywords = [
      '山', '水', '天', '地', '云', '雾', '雨', '雪', '风',
      '建筑', '宫殿', '城市', '森林', '沙漠', '海洋', '废墟',
      '碎石', '烟尘', '火焰', '爆炸', '崩塌', '破碎', '岩浆'
    ];
    return envKeywords.some(kw => seg.includes(kw));
  }

  // ====== P3 判断 ======

  _isRedundant(seg, refs) {
    if (refs.length === 0) return false;
    const appearanceKeywords = [
      '金色', '银色', '红色', '蓝色', '黑色', '白色',
      '长发', '短发', '戴眼镜', '年轻', '年老',
      '穿着', '戴着', '披着', '手持'
    ];
    return appearanceKeywords.some(kw => seg.includes(kw));
  }

  _isNonVisual(seg) {
    const nonVisualPatterns = [
      /他?心想/, /他?觉得/, /他?感到/, /内心/, /心里/,
      /然后/, /接着/, /随后/, /突然/, /这时/, /此刻/,
      /只见/, /但见/, /但见/, /但见/
    ];
    return nonVisualPatterns.some(p => p.test(seg));
  }

  // ====== 智能精炼 ======

  _smartRefine(tokens, overflow, shot, refs) {
    const preserved = [];
    const refined = [];
    const removed = [];

    // 第一步：删除P3（纯冗余）
    for (const token of tokens) {
      if (token.priority === 'P3') {
        removed.push({ ...token, reason: 'P3冗余：参考图已有或非视觉信息' });
        token.removed = true;
      }
    }

    let currentLength = tokens.filter(t => !t.removed).reduce((sum, t) => sum + t.content.length, 0);

    // 第二步：重构P2环境（长句→氛围关键词）
    if (currentLength > this.maxLength) {
      for (const token of tokens) {
        if (token.priority === 'P2' && !token.removed) {
          const result = this._refineEnvironment(token.content);
          if (result.refined) {
            refined.push({
              type: 'P2环境重构',
              from: token.content,
              to: result.content,
              reason: '长句→氛围关键词，信息密度翻倍'
            });
            token.content = result.content;
          }
        }
      }
    }
    currentLength = tokens.filter(t => !t.removed).reduce((sum, t) => sum + t.content.length, 0);

    // 第三步：精简P1（保留核心词）
    if (currentLength > this.maxLength) {
      for (const token of tokens) {
        if (token.priority === 'P1' && !token.removed) {
          const result = this._simplifyP1(token.content);
          if (result.refined) {
            refined.push({
              type: 'P1精简',
              from: token.content,
              to: result.content,
              reason: '保留核心光影/风格词'
            });
            token.content = result.content;
          }
        }
      }
    }
    currentLength = tokens.filter(t => !t.removed).reduce((sum, t) => sum + t.content.length, 0);

    // 第四步：最后手段——精简P0动作修饰（保留核心动词）
    if (currentLength > this.maxLength) {
      for (const token of tokens) {
        if (token.priority === 'P0' && !token.removed && token.type === 'action') {
          const result = this._trimActionModifiers(token.content);
          if (result.refined) {
            refined.push({
              type: 'P0动作精简',
              from: token.content,
              to: result.content,
              reason: '保留核心动词，删除次要修饰'
            });
            token.content = result.content;
          }
        }
        currentLength = tokens.filter(t => !t.removed).reduce((sum, t) => sum + t.content.length, 0);
        if (currentLength <= this.maxLength) break;
      }
    }

    tokens.filter(t => !t.removed && t.content).forEach(t => preserved.push(t));

    return { tokens, preserved, refined, removed };
  }

  // ====== 重构函数 ======

  _refineEnvironment(content) {
    // v4.2-Peng-fix: 移除所有硬编码的具体场景描述，只保留通用精炼规则
    // 通用精炼：删除冗余副词，保留核心名词+动词
    const refined = content
      .replace(/非常|极其|特别|十分|相当/g, '')
      .replace(/漫天|满地|四处|到处/g, '')
      .replace(/不断|持续|一直|反复/g, '')
      .replace(/着|了|过/g, ''); // 删除时态助词

    if (refined !== content) {
      return { content: refined, refined: true };
    }

    return { content, refined: false };
  }

  _simplifyP1(content) {
    // v4.2-Peng-fix: 移除硬编码的光影映射，改为通用精简规则
    // 通用精简：删除冗余修饰词
    const refined = content
      .replace(/柔和的自然光/g, '柔光')
      .replace(/强烈的直射阳光/g, '强光')
      .replace(/温暖的黄昏光线/g, '暖黄昏')
      .replace(/冷峻的蓝色调光影/g, '冷蓝光')
      .replace(/昏暗的室内光线/g, '昏暗室内')
      .replace(/金色的逆光剪影/g, '金色逆光')
      .replace(/内心充满/g, '')
      .replace(/感到极度的/g, '')
      .replace(/情绪紧张而/g, '紧张')
      .replace(/杀气腾腾，眼神凶狠/g, '杀气凶狠');

    if (refined !== content) {
      return { content: refined, refined: true };
    }

    return { content, refined: false };
  }

  _trimActionModifiers(content) {
    // 保留核心动词，删除次要修饰词（最后手段）
    const trimmed = content
      .replace(/疯狂地|猛烈地|狠狠地|重重地/g, '')
      .replace(/快速地|极速地|迅猛地/g, '快速')
      .replace(/慢慢地|缓缓地|轻轻地/g, '缓慢')
      .replace(/大幅度地|大幅度/g, '大幅度')
      .replace(/小幅度地|小幅度/g, '小幅度');

    if (trimmed !== content) {
      return { content: trimmed, refined: true };
    }
    return { content, refined: false };
  }

  // ====== 重构提示词 ======

  _rebuild(tokens) {
    // 按类型排序：主体→动作→对白→环境→运镜→光影→情绪→其他
    const orderMap = {
      'subject': 1,
      'action': 2,
      'dialogue': 3,
      'environment': 4,
      'camera': 5,
      'lighting': 6,
      'emotion': 7,
      'other': 8
    };

    const activeTokens = tokens
      .filter(t => !t.removed && t.content)
      .sort((a, b) => (orderMap[a.type] || 99) - (orderMap[b.type] || 99));

    let prompt = activeTokens.map(t => t.content).join('，');
    prompt = prompt.replace(/，{2,}/g, '，');

    // 最终截断（保险，但避免截断在词中间）
    if (prompt.length > this.maxLength) {
      const truncated = prompt.substring(0, this.maxLength);
      const lastComma = truncated.lastIndexOf('，');
      if (lastComma > this.maxLength * 0.8) {
        prompt = truncated.substring(0, lastComma);
      } else {
        prompt = truncated;
      }
    }

    return prompt;
  }

  // ====== 质检 ======

  _checkMissingP0(tokens, shot) {
    const activeTokens = tokens.filter(t => !t.removed && t.content);
    const missing = [];

    const hasSubject = activeTokens.some(t => t.priority === 'P0' && t.type === 'subject');
    if (!hasSubject && shot.characters?.length > 0) {
      missing.push('主体身份');
    }

    // v5.5-Peng-fix: 检查所有P0 token的内容中是否包含动作词
    // 原逻辑只检查 type=action 的token，但包含角色名的segment被标记为subject，动作词被隐藏
    const hasAction = activeTokens.some(t => {
      // 直接标记为action的token
      if (t.priority === 'P0' && t.type === 'action') return true;
      // 被标记为subject但内容中包含动作词的token（角色名+动作词在同一个segment中）
      if (t.priority === 'P0' && t.type === 'subject' && this._isCoreAction(t.content)) return true;
      return false;
    });
    if (!hasAction) {
      missing.push('核心动作');
    }

    return missing;
  }

  _extractP0Elements(prompt, shot) {
    const tokens = this._parseAndTag(prompt, shot, []);
    return tokens.filter(t => t.priority === 'P0').map(t => t.content);
  }

  // ====== 质量评分（效果导向） ======

  _calcQualityScore(prompt, shot, refs, mode, refineResult = null) {
    let score = 0.70; // 基础分：保留P0骨架

    const tokens = this._parseAndTag(prompt, shot, refs);
    const activeTokens = tokens.filter(t => !t.removed && t.content);

    // +0.10：保留P1光影/氛围/环境
    const hasP1 = activeTokens.some(t => t.priority === 'P1');
    if (hasP1) score += 0.10;

    // +0.05：使用程度副词强化动作
    const hasIntensity = activeTokens.some(t => this._isIntensityModifier(t.content));
    if (hasIntensity) score += 0.05;

    // +0.05：环境用氛围词而非删除（精炼而非删除）
    const envTokens = activeTokens.filter(t => t.type === 'environment');
    if (envTokens.length > 0 && envTokens.every(t => t.content.length <= 20)) {
      score += 0.05;
    }

    // +0.05：对白保留
    const hasDialogue = activeTokens.some(t => t.type === 'dialogue');
    if (hasDialogue) score += 0.05;

    // +0.05：运镜明确
    const hasCamera = activeTokens.some(t => t.type === 'camera');
    if (hasCamera) score += 0.05;

    // +0.05：视觉化情绪
    const hasVisualEmotion = activeTokens.some(t => t.type === 'emotion');
    if (hasVisualEmotion) score += 0.05;

    // 扣分项
    if (mode === 'refine' && refineResult) {
      // 如果P0被精简了（最后手段），扣分
      const p0Refined = refineResult.refined.filter(r => r.type === 'P0动作精简').length;
      score -= p0Refined * 0.03;
    }

    return Math.max(0, Math.min(1.0, score));
  }

  _generateQualityComment(score, refineResult) {
    if (score >= 0.95) return '优秀：6要素齐全，表达精炼有力，程度副词强化了动作冲击力';
    if (score >= 0.90) return '良好：核心要素保留，表达有力';
    if (score >= 0.85) return '合格：核心要素保留，部分精炼';
    if (score >= 0.80) return '及格：核心骨架完整，但氛围和细节有损';
    return '警告：精炼过度，建议调整上游生成策略';
  }
}

module.exports = { ComplianceAgent };

// 测试
if (require.main === module) {
  const agent = new ComplianceAgent({ debug: true });

  // 测试1：≤500字，直接放行（v5.8-Peng）
  // v4.2-Peng-fix: 使用通用占位符，不硬编码任何具体角色名
  const test1 = '主角A疯狂挥舞武器强力砸向对手B，(环绕)，崩塌场景，碎石飞溅，逆光，写实';
  const result1 = agent.check(test1, { characters: ['主角A', '对手B'] }, []);
  console.log('\n🧪 测试1：≤500字，直接放行');
  console.log(`  action: ${result1.action}`);
  console.log(`  字数: ${result1.compressedLength}`);
  console.log(`  质量分: ${result1.qualityScore.toFixed(2)}`);

  // 测试2：>500字，智能精炼（v5.8-Peng）
  const test2 = `参考2张角色图片，身穿金色铠甲的主角A（标志性特征，手持专属武器，铠甲在火光中闪耀）vs银色铠甲的对手B（手持长兵器，特殊能力发光，神情冷酷无情），战场上空全力激战，主角A疯狂挥舞武器强力砸向对手B，对手B极速闪避后反手一刀劈出，两人你来我往战斗激烈，(环绕跟拍，镜头快速旋转)，对白："你逃不掉！"，写实风格，逆光剪影，黄昏光线，狂风呼啸，沙尘漫天，天地昏暗，能见度极低，碎石飞溅，浓烟滚滚，火光冲天，岩浆喷发，热浪翻滚，天空染红，周围崩塌的建筑物，气氛紧张压抑，双方眼神中都充满杀意，咬肌紧绷，眉心紧锁，愤怒压抑的咆哮声震耳欲聋`;
  
  const result2 = agent.check(test2, { characters: ['主角A', '对手B'] }, ['ref1.jpg', 'ref2.jpg']);
  console.log('\n🧪 测试2：>500字，智能精炼');
  console.log(`  action: ${result2.action}`);
  console.log(`  字数: ${result2.originalLength} → ${result2.compressedLength}`);
  console.log(`  质量分: ${result2.qualityScore.toFixed(2)}`);
  console.log(`  gate: ${result2.gateDecision}`);
  
  if (result2.refined.length > 0) {
    console.log('  精炼记录:');
    result2.refined.forEach(r => console.log(`    - ${r.type}: "${r.from}" → "${r.to}"`));
  }
  
  console.log(`  最终提示词: ${result2.compliantPrompt}`);
}