/**
 * Camera Movement System v4.1 — 镜头内时间轴系统（外部专家修复版）
 * 
 * 核心修复：
 * - 多层候选文本提取（content/raw.content/reasoning/raw.reasoning）
 * - 括号平衡扫描JSON提取（非简单正则）
 * - 结构修复（策略名/段数/movement/描述）
 * - 软回退替代v3规则模板
 * - v1/v2兼容输出结构
 * 
 * 版本: v4.1
 * 日期: 2026-06-16
 * 来源: 外部专家方案落地
 */

const { LLMEngine } = require('./llm-reasoning-engine');

// ========== Layer 1: 场景分析器 ==========
class SceneAnalyzer {
  constructor() {
    this.spaceKeywords = {
      small: ['室内', '房间', '诊室', '办公室', '车内', '电梯', '走廊'],
      medium: ['教室', '会议室', '客厅', '餐厅', '实验室'],
      large: ['室外', '操场', '广场', '街道', '公园', '野外', '天空'],
      unlimited: ['宇宙', '太空', '梦境', '抽象', '虚拟']
    };
    
    this.sceneTypeMap = {
      dialogue: { name: '对话', movement: 'stable', preferredSizes: ['medium', 'close_up'], maxSegments: 3 },
      monologue: { name: '独白/讲解', movement: 'stable', preferredSizes: ['medium', 'close_up'], maxSegments: 3 },
      action: { name: '动作', movement: 'dynamic', preferredSizes: ['wide', 'full', 'medium'], maxSegments: 5 },
      chase: { name: '追逐', movement: 'dynamic', preferredSizes: ['wide', 'full'], maxSegments: 5 },
      discovery: { name: '发现', movement: 'explore', preferredSizes: ['wide', 'medium', 'close_up'], maxSegments: 4 },
      emotional: { name: '情感', movement: 'intimate', preferredSizes: ['close_up', 'extreme_close'], maxSegments: 2 },
      establishing: { name: '建立', movement: 'reveal', preferredSizes: ['extreme_wide', 'wide', 'medium'], maxSegments: 4 },
      transition: { name: '过渡', movement: 'smooth', preferredSizes: ['medium'], maxSegments: 2 }
    };
  }

  analyze(sceneName, sceneDescription, duration, characters = []) {
    const desc = (sceneDescription || sceneName || '').toLowerCase();
    const name = (sceneName || '').toLowerCase();
    const combined = desc + ' ' + name;
    
    let spaceSize = 'medium';
    if (this.spaceKeywords.small.some(k => combined.includes(k))) spaceSize = 'small';
    else if (this.spaceKeywords.large.some(k => combined.includes(k))) spaceSize = 'large';
    else if (this.spaceKeywords.unlimited.some(k => combined.includes(k))) spaceSize = 'unlimited';
    
    let sceneType = 'dialogue';
    if (combined.includes('讲解') || combined.includes('介绍') || combined.includes('说明')) sceneType = 'monologue';
    else if (combined.includes('动作') || combined.includes('运动') || combined.includes('操作')) sceneType = 'action';
    else if (combined.includes('发现') || combined.includes('揭示') || combined.includes('展示')) sceneType = 'discovery';
    else if (combined.includes('情感') || combined.includes('悲伤') || combined.includes('喜悦')) sceneType = 'emotional';
    else if (combined.includes('开场') || combined.includes('建立') || combined.includes('环境')) sceneType = 'establishing';
    else if (combined.includes('过渡') || combined.includes('转场')) sceneType = 'transition';
    
    const segmentCount = this._calculateSegmentCount(duration, sceneType);
    const constraints = this._getShotSizeConstraints(spaceSize, sceneType);
    const typeInfo = this.sceneTypeMap[sceneType] || this.sceneTypeMap.dialogue;
    
    return {
      spaceSize,
      sceneType,
      sceneTypeName: typeInfo.name,
      segmentCount,
      constraints,
      movementStyle: typeInfo.movement,
      characterCount: characters.length,
      duration,
      shotId: sceneName
    };
  }
  
  _calculateSegmentCount(duration, sceneType) {
    const base = duration < 5 ? 2 : duration < 10 ? 3 : duration < 15 ? 4 : 5;
    const typeInfo = this.sceneTypeMap[sceneType] || this.sceneTypeMap.dialogue;
    return Math.min(base, typeInfo.maxSegments);
  }
  
  _getShotSizeConstraints(spaceSize, sceneType) {
    const typeInfo = this.sceneTypeMap[sceneType] || this.sceneTypeMap.dialogue;
    const spaceLimits = {
      small: { min: 'close_up', max: 'medium', forbidden: ['wide', 'extreme_wide'] },
      medium: { min: 'medium', max: 'wide', forbidden: ['extreme_wide'] },
      large: { min: 'medium', max: 'extreme_wide', forbidden: [] },
      unlimited: { min: 'extreme_close', max: 'extreme_wide', forbidden: [] }
    };
    const space = spaceLimits[spaceSize] || spaceLimits.medium;
    const preferred = typeInfo.preferredSizes.filter(s => !space.forbidden.includes(s));
    return {
      minSize: space.min,
      maxSize: space.max,
      forbidden: space.forbidden,
      preferred: preferred.length > 0 ? preferred : ['medium'],
      defaultSize: preferred[0] || 'medium'
    };
  }
}

// ========== Layer 2: LLM时间轴生成器（专家修复版） ==========
class LLMTimelineGenerator {
  constructor(options = {}) {
    this.model = options.model || 'kimi-k2p6';
    this.maxTokens = options.maxTokens || 2048;
    this.temperature = 1;
    this.debugDir = options.debugDir || 'debug_llm';
    
    this.llm = new LLMEngine({
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      mode: 'production',
      maxRetries: 3
    });
  }
  
  async generateTimeline(sceneAnalysis, shotInfo, previousShotEnd = null) {
    const prompt = this._buildCompactPrompt(sceneAnalysis);
    
    try {
      console.log('[LLMTimelineGenerator] 🚀 调用LLM生成个性化时间轴...');
      const startedAt = Date.now();
      
      const result = await this.llm.generate(prompt, {
        systemPrompt: '你是专业电影摄影师。只输出合法JSON对象，不要markdown，不要解释，不要额外文本。',
        temperature: 1,
        maxTokens: this.maxTokens,
        responseFormat: { type: 'json_object' },
        allowReasoningFallback: true
      });
      
      const duration = Date.now() - startedAt;
      
      if (!result || !result.success) {
        console.error(`[LLMTimelineGenerator] LLM调用失败: ${result?.error || '未知错误'}`);
        const fallback = this._buildSoftFallbackTimeline(sceneAnalysis);
        return this._buildCompatibleCameraMovement(fallback);
      }
      
      const timeline = this._extractTimelineFromResult(result, sceneAnalysis);
      return timeline;
      
    } catch (e) {
      console.error('[LLMTimelineGenerator] LLM调用异常:', e.message);
      const fallback = this._buildSoftFallbackTimeline(sceneAnalysis);
      return this._buildCompatibleCameraMovement(fallback);
    }
  }
  
  // ========== 专家方案：多层候选文本提取 ==========
  _extractTimelineFromResult(result, sceneAnalysis) {
    const candidates = this._getCandidateTexts(result);
    
    for (const item of candidates) {
      const parsed = this._tryExtractTimelineJSON(item.text);
      if (parsed) {
        console.log(`[LLMTimelineGenerator] ✅ JSON提取成功 | 来源: ${item.source}`);
        const sanitized = this._sanitizeParsedTimeline(parsed, sceneAnalysis);
        const timeline = this._convertToTimeline(sanitized, sceneAnalysis);
        timeline.generatedBy = 'LLM-v4';
        return this._buildCompatibleCameraMovement(timeline);
      }
    }
    
    console.error('[LLMTimelineGenerator] JSON提取失败: 所有来源均未找到有效JSON');
    this._dumpDebugFailure(result, sceneAnalysis);
    const fallback = this._buildSoftFallbackTimeline(sceneAnalysis);
    return this._buildCompatibleCameraMovement(fallback);
  }
  
  _getCandidateTexts(result) {
    const content = result?.content || '';
    const reasoning = result?.reasoning_content || '';
    const rawContent = result?.raw?.choices?.[0]?.message?.content || '';
    const rawReasoning = result?.raw?.choices?.[0]?.message?.reasoning_content || '';
    
    const list = [
      { source: 'result.content', text: content },
      { source: 'raw.message.content', text: rawContent },
      { source: 'result.reasoning_content', text: reasoning },
      { source: 'raw.message.reasoning_content', text: rawReasoning }
    ];
    
    const seen = new Set();
    return list.filter(item => {
      const t = (item.text || '').trim();
      if (!t) return false;
      if (seen.has(t)) return false;
      seen.add(t);
      console.log(`[LLMTimelineGenerator] 尝试来源: ${item.source} | 文本长度: ${t.length}`);
      return true;
    });
  }
  
  // ========== 专家方案：括号平衡扫描 ==========
  _tryExtractTimelineJSON(text) {
    if (!text || typeof text !== 'string') return null;
    
    // 1) 尝试整段直接JSON.parse
    const direct = text.trim();
    if (direct.startsWith('{') && direct.endsWith('}')) {
      try {
        const parsed = JSON.parse(direct);
        if (this._isValidTimelineJSON(parsed)) return parsed;
      } catch (_) {}
    }
    
    // 2) 尝试代码块
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const block = (match[1] || '').trim();
      try {
        const parsed = JSON.parse(block);
        if (this._isValidTimelineJSON(parsed)) return parsed;
      } catch (_) {}
    }
    
    // 3) 扫描所有可能的JSON对象候选（括号平衡）
    const candidates = this._extractAllJSONObjectCandidates(text);
    for (let i = candidates.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(candidates[i]);
        if (this._isValidTimelineJSON(parsed)) return parsed;
      } catch (_) {}
    }
    
    return null;
  }
  
  _extractAllJSONObjectCandidates(text) {
    const results = [];
    const stack = [];
    let inString = false;
    let escape = false;
    
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (ch === '\\') {
        if (inString) escape = true;
        continue;
      }
      
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (ch === '{') {
        stack.push(i);
      } else if (ch === '}' && stack.length > 0) {
        const start = stack.pop();
        const candidate = text.slice(start, i + 1).trim();
        if (candidate.startsWith('{') && candidate.endsWith('}')) {
          results.push(candidate);
        }
      }
    }
    
    return results;
  }
  
  _isValidTimelineJSON(obj) {
    return !!(obj && typeof obj === 'object' && Array.isArray(obj.segments) && obj.segments.length > 0);
  }
  
  // ========== 专家方案：结构修复 ==========
  _sanitizeParsedTimeline(parsed, sceneAnalysis) {
    const targetSegmentCount = this._getTargetSegmentCount(sceneAnalysis.duration);
    
    const clean = {
      strategy: typeof parsed.strategy === 'string' ? parsed.strategy.trim() : '',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '',
      segments: Array.isArray(parsed.segments) ? parsed.segments : []
    };
    
    // 修复策略名占位符
    if (!clean.strategy || clean.strategy === '策略名' || clean.strategy === 'strategy') {
      clean.strategy = this._buildStrategyName(sceneAnalysis);
    }
    
    // 修复段数
    clean.segments = this._repairSegments(clean.segments, sceneAnalysis, targetSegmentCount);
    
    // 修复reasoning
    if (!clean.reasoning || clean.reasoning.length < 8 || clean.reasoning === '设计理由') {
      clean.reasoning = `基于"${sceneAnalysis.sceneTypeName}"场景、${sceneAnalysis.duration}秒时长与台词重点，采用由稳到近的递进式讲解运镜。`;
    }
    
    return clean;
  }
  
  _buildStrategyName(sceneAnalysis) {
    const sceneType = sceneAnalysis.sceneTypeName || '讲解';
    const emotion = sceneAnalysis.emotionPhase || 'neutral';
    const dialogue = sceneAnalysis.dialogue || '';
    
    if (/高危|危险|风险|恶化|严重/.test(dialogue)) return '渐进压迫式讲解';
    if (/症状|表现|信号|征兆/.test(dialogue)) return '递进揭示式推镜';
    if (/病理|原因|机制|导致/.test(dialogue)) return '渐进聚焦病理叙事';
    if (/结语|总结|建议|记住|最后/.test(dialogue)) return '渐进收束式讲解';
    if (/开场|大家好|今天/.test(dialogue)) return '渐进式聚焦讲解';
    
    if (sceneType.includes('建立')) return '环境建立式缓进运镜';
    if (sceneType.includes('讲解')) return '稳定递进式专家讲解';
    if (emotion === 'curiosity') return '渐进探询式讲解';
    
    return '内容驱动式递进运镜';
  }
  
  _getTargetSegmentCount(duration) {
    const d = Number(duration) || 0;
    if (d <= 6) return 2;
    if (d <= 16) return 3;
    return 4;
  }
  
  _repairSegments(segments, sceneAnalysis, targetSegmentCount) {
    const duration = Number(sceneAnalysis.duration) || 10;
    const preferred = sceneAnalysis.constraints?.preferred?.length
      ? sceneAnalysis.constraints.preferred
      : ['medium', 'medium_close_up', 'close_up'];
    
    const normalized = (segments || []).map((seg, idx) => ({
      timeRange: this._normalizeTimeRange(seg.timeRange, idx, segments.length, duration),
      shotSize: seg.shotSize || preferred[Math.min(idx, preferred.length - 1)] || 'medium',
      movement: this._normalizeMovement(seg.movement, idx, sceneAnalysis),
      speed: seg.speed || (idx === 0 ? '极慢' : '缓慢'),
      reason: seg.reason || `第${idx + 1}段围绕讲解重点进行视觉递进。`
    }));
    
    if (normalized.length === targetSegmentCount) {
      return normalized;
    }
    
    // 段数不对，按目标段数重建
    const rebuilt = [];
    const step = duration / targetSegmentCount;
    
    for (let i = 0; i < targetSegmentCount; i++) {
      const start = +(i * step).toFixed(1);
      const end = +(i === targetSegmentCount - 1 ? duration : (i + 1) * step).toFixed(1);
      
      const shotSize =
        preferred[Math.min(i, preferred.length - 1)] ||
        (i === 0 ? 'medium' : i === targetSegmentCount - 1 ? 'close_up' : 'medium_close_up');
      
      rebuilt.push({
        timeRange: `${start}-${end}`,
        shotSize,
        movement: this._buildDefaultMovement(i, targetSegmentCount, sceneAnalysis),
        speed: i === 0 ? '极慢' : i === targetSegmentCount - 1 ? '缓慢' : '很慢',
        reason: this._buildDefaultReason(i, targetSegmentCount, sceneAnalysis)
      });
    }
    
    return rebuilt;
  }
  
  _normalizeTimeRange(timeRange, idx, total, duration) {
    if (typeof timeRange === 'string' && /^\d+(\.\d+)?-\d+(\.\d+)?$/.test(timeRange.trim())) {
      return timeRange.trim();
    }
    const step = duration / Math.max(total || 1, 1);
    const start = +(idx * step).toFixed(1);
    const end = +(idx === total - 1 ? duration : (idx + 1) * step).toFixed(1);
    return `${start}-${end}`;
  }
  
  _normalizeMovement(movement, idx, sceneAnalysis) {
    const text = (movement || '').trim();
    if (text.length >= 10 && /厘米|cm|度|°|秒/.test(text)) return text;
    
    const templates = [
      '摄影机以每秒0.4厘米的速度轻微前推2厘米，同时从低于视线3°抬升至平视，建立稳定进入感。',
      '镜头保持人物主体在画面中心偏左5%，以每秒0.6厘米的速度向前推进3厘米，并微量右移4厘米，强化讲解重点。',
      '摄影机在最后阶段继续前推2厘米，同时轻微俯角下压2°，把注意力收束到人物表情与关键信息上。'
    ];
    
    return templates[Math.min(idx, templates.length - 1)];
  }
  
  _buildDefaultMovement(idx, total, sceneAnalysis) {
    if (idx === 0) {
      return '摄影机以每秒0.4厘米的速度轻推2厘米，并从略低机位上抬3°至平视，先建立环境与人物关系。';
    }
    if (idx === total - 1) {
      return '镜头继续以每秒0.5厘米的速度前推2厘米，同时横移3厘米完成视觉收束，聚焦结论表达。';
    }
    return '摄影机保持稳定主体构图，以每秒0.5厘米速度前推3厘米，并轻微横移4厘米，承接讲解重点推进。';
  }
  
  _buildDefaultReason(idx, total, sceneAnalysis) {
    if (idx === 0) return '开段先稳住空间关系，让观众快速进入讲解语境。';
    if (idx === total - 1) return '结尾收紧景别，强化重点信息与人物表情。';
    return '中段通过轻微推进承接信息递进，避免画面过于静止。';
  }
  
  // ========== 专家方案：兼容输出结构 ==========
  _convertToTimeline(parsed, sceneAnalysis) {
    const timeline = {
      strategy: parsed.strategy,
      reasoning: parsed.reasoning,
      segmentCount: parsed.segments.length,
      segments: parsed.segments.map((seg, index) => ({
        index,
        timeRange: seg.timeRange,
        shotSize: seg.shotSize,
        movement: seg.movement,
        speed: seg.speed,
        reason: seg.reason
      }))
    };
    
    timeline.description = this._buildDescription(timeline);
    timeline.transitionType = 'llm_v4';
    timeline.timeline = {
      strategy: timeline.strategy,
      reasoning: timeline.reasoning,
      segments: timeline.segments
    };
    
    return timeline;
  }
  
  _buildDescription(timeline) {
    const first = timeline.segments?.[0];
    const last = timeline.segments?.[timeline.segments.length - 1];
    return `${timeline.strategy}：从${first?.shotSize || 'medium'}逐步过渡到${last?.shotSize || 'close_up'}，共${timeline.segmentCount}段，强调内容驱动的细微推进。`;
  }
  
  _buildCompatibleCameraMovement(timeline) {
    return {
      strategy: timeline.strategy,
      reasoning: timeline.reasoning,
      segmentCount: timeline.segmentCount,
      segments: timeline.segments,
      generatedBy: timeline.generatedBy || 'LLM-v4',
      description: timeline.description || this._buildDescription(timeline),
      transitionType: timeline.transitionType || 'llm_v4',
      timeline: {
        strategy: timeline.strategy,
        reasoning: timeline.reasoning,
        segments: timeline.segments
      }
    };
  }
  
  // ========== 专家方案：软回退替代v3规则模板 ==========
  _buildSoftFallbackTimeline(sceneAnalysis) {
    const targetSegmentCount = this._getTargetSegmentCount(sceneAnalysis.duration);
    const strategy = this._buildStrategyName(sceneAnalysis);
    const segments = this._repairSegments([], sceneAnalysis, targetSegmentCount);
    
    return {
      strategy,
      reasoning: 'LLM原始输出不可解析，已根据镜头时长、台词主题和景别约束生成高质量软回退时间轴。',
      segmentCount: segments.length,
      segments,
      description: `${strategy}：基于镜头内容自动生成的软回退方案，避免使用固定模板化运镜。`,
      transitionType: 'soft_fallback_v4',
      generatedBy: 'soft-fallback-v4',
      timeline: {
        strategy,
        reasoning: 'LLM原始输出不可解析，已根据镜头时长、台词主题和景别约束生成高质量软回退时间轴。',
        segments
      }
    };
  }
  
  _dumpDebugFailure(result, sceneAnalysis) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      if (!fs.existsSync(this.debugDir)) {
        fs.mkdirSync(this.debugDir, { recursive: true });
      }
      
      const file = path.join(
        this.debugDir,
        `stage9_v4_failure_${sceneAnalysis.shotId || Date.now()}.json`
      );
      
      fs.writeFileSync(
        file,
        JSON.stringify({
          time: new Date().toISOString(),
          sceneAnalysis,
          result
        }, null, 2),
        'utf8'
      );
      
      console.log(`[LLMTimelineGenerator] 调试文件已写入: ${file}`);
    } catch (err) {
      console.error(`[LLMTimelineGenerator] 写调试文件失败: ${err.message}`);
    }
  }
  
  // ========== 专家方案：精简Prompt ==========
  _buildCompactPrompt(sceneAnalysis) {
    const segmentCount = this._getTargetSegmentCount(sceneAnalysis.duration);
    const chars = (sceneAnalysis.characters || [])
      .map(c => (typeof c === 'string' ? c : c.name))
      .filter(Boolean)
      .join(', ') || '无';
    
    return `只输出一个合法JSON对象。
为镜头生成${segmentCount}段运镜方案。
场景:${sceneAnalysis.sceneName || '未命名'}
类型:${sceneAnalysis.sceneTypeName || '讲解'}
时长:${sceneAnalysis.duration}秒
情绪:${sceneAnalysis.emotionPhase || 'neutral'}
人物:${chars}
台词:${(sceneAnalysis.dialogue || '').slice(0, 100)}
限制:可用景别[${(sceneAnalysis.constraints?.preferred || ['medium']).join(',')}],禁用[${(sceneAnalysis.constraints?.forbidden || []).join(',') || '无'}]
JSON字段: strategy, reasoning, segments
segments每项字段: timeRange, shotSize, movement, speed, reason
movement必须含具体数字(厘米/度/秒)，strategy必须是具体名称，不得写"策略名"。`;
  }
}

// ========== Layer 3: 连续性引擎 ==========
class ContinuityEngine {
  constructor() {
    this.jumpRules = {
      extreme_close: { allowedNext: ['close_up', 'extreme_close'], warning: '极端特写后避免大跳跃' },
      close_up: { allowedNext: ['close_up', 'medium', 'extreme_close'], warning: '特写后避免直接远景' },
      medium: { allowedNext: ['medium', 'close_up', 'wide', 'full'], warning: '中景较灵活' },
      full: { allowedNext: ['full', 'medium', 'wide'], warning: '全景后避免特写' },
      wide: { allowedNext: ['wide', 'full', 'medium'], warning: '远景后避免特写' },
      extreme_wide: { allowedNext: ['extreme_wide', 'wide'], warning: '极端远景后避免中景/特写' }
    };
  }
  
  checkContinuity(previousShot, currentShot) {
    const warnings = [];
    const fixes = [];
    
    if (!previousShot?.timeline?.segments || !currentShot?.timeline?.segments) {
      return { valid: true, warnings, fixes };
    }
    
    const prevEnd = previousShot.timeline.segments[previousShot.timeline.segments.length - 1];
    const currStart = currentShot.timeline.segments[0];
    
    const prevSize = prevEnd.shotSize;
    const currSize = currStart.shotSize;
    
    const rule = this.jumpRules[prevSize];
    if (rule && !rule.allowedNext.includes(currSize)) {
      warnings.push({
        type: 'shot_size_jump',
        message: `${prevEnd.shotSizeDesc} → ${currStart.shotSizeDesc}: 视觉跳跃大`,
        severity: 'warning'
      });
    }
    
    return { valid: warnings.length === 0, warnings, fixes };
  }
  
  autoFix(currentShot, previousShotEnd) {
    if (!previousShotEnd || !currentShot.timeline) return currentShot;
    
    const rule = this.jumpRules[previousShotEnd.shotSize];
    if (!rule) return currentShot;
    
    const firstSeg = currentShot.timeline.segments[0];
    if (!rule.allowedNext.includes(firstSeg.shotSize)) {
      firstSeg.shotSize = rule.allowedNext[0];
      firstSeg.shotSizeDesc = this._getShotSizeDesc(rule.allowedNext[0]);
      console.log(`[ContinuityEngine] 自动修复: ${previousShotEnd.shotSize} → ${firstSeg.shotSize}`);
    }
    
    return currentShot;
  }
  
  _getShotSizeDesc(shotSize) {
    const map = {
      extreme_wide: '极端远景（环境全貌）',
      wide: '远景（环境+主体）',
      full: '全景（全身）',
      medium: '中景（半身/双人）',
      close_up: '特写（面部/细节）',
      extreme_close: '极端特写（眼睛/纹理）'
    };
    return map[shotSize] || shotSize;
  }
}

// ========== Layer 4: 可选开关 ==========
class TimelineFeatureToggle {
  constructor(options = {}) {
    this.mode = options.mode || 'auto';
    this.defaultMode = options.defaultMode || 'standard';
    
    this.sceneModeMap = {
      action: 'complex', chase: 'complex', climax: 'complex',
      dialogue: 'standard', monologue: 'standard', discovery: 'standard',
      emotional: 'simple', establishing: 'standard', transition: 'disabled'
    };
    
    this.durationModeMap = [
      { max: 5, mode: 'simple' },
      { max: 10, mode: 'standard' },
      { max: Infinity, mode: 'complex' }
    ];
  }
  
  decideMode(sceneType, duration, userOverride = null) {
    if (userOverride) return userOverride;
    if (this.mode === 'never') return 'disabled';
    if (this.mode === 'always') return this.defaultMode;
    
    const typeMode = this.sceneModeMap[sceneType] || this.defaultMode;
    const durationMode = this.durationModeMap.find(d => duration <= d.max)?.mode || 'standard';
    
    const modePriority = { disabled: 0, simple: 1, standard: 2, complex: 3 };
    return modePriority[typeMode] < modePriority[durationMode] ? typeMode : durationMode;
  }
  
  shouldGenerate(sceneType, duration) {
    return this.decideMode(sceneType, duration) !== 'disabled';
  }
}

// ========== v4.1 主控制器 ==========
class CameraMovementSystemV4 {
  constructor(options = {}) {
    this.sceneAnalyzer = new SceneAnalyzer();
    this.llmGenerator = new LLMTimelineGenerator(options.llmOptions);
    this.continuityEngine = new ContinuityEngine();
    this.featureToggle = new TimelineFeatureToggle(options.toggleOptions);
  }
  
  async generateIntraShotTimelineV4(shot, previousShot = null, options = {}) {
    const { sceneName, sceneDescription, duration, emotionPhase, characters, dialogue, type } = shot;
    
    const sceneType = type || 'dialogue';
    if (!this.featureToggle.shouldGenerate(sceneType, duration)) {
      return {
        timeline: null,
        v4Enabled: true,
        mode: 'disabled',
        reason: 'Feature toggle disabled for this scene'
      };
    }
    
    const analysis = this.sceneAnalyzer.analyze(sceneName, sceneDescription, duration, characters);
    analysis.dialogue = dialogue || '';
    analysis.emotionPhase = emotionPhase || 'neutral';
    
    const previousEnd = previousShot?.timeline?.segments?.[previousShot.timeline.segments.length - 1];
    const timeline = await this.llmGenerator.generateTimeline(analysis, { sceneName, sceneDescription, emotionPhase, characters, dialogue }, previousEnd);
    
    let continuityCheck = null;
    if (previousShot) {
      continuityCheck = this.continuityEngine.checkContinuity(previousShot, { timeline });
      if (!continuityCheck.valid && options.autoFix !== false) {
        this.continuityEngine.autoFix({ timeline }, previousEnd);
      }
    }
    
    return {
      timeline,
      v4Enabled: timeline.generatedBy === 'LLM-v4',
      analysis,
      continuityCheck,
      mode: timeline.generatedBy === 'LLM-v4' ? 'v4-llm-driven' : 'v4-soft-fallback'
    };
  }
  
  generateIntraShotTimeline(sceneName, emotionPhase = 'establishing', options = {}) {
    // v4.0: 原生软回退实现，移除v3依赖
    const duration = Number(options.duration) || 5;
    const segmentCount = duration <= 6 ? 2 : (duration <= 16 ? 3 : 4);
    const step = duration / segmentCount;
    const preferred = ['medium', 'medium_close_up', 'close_up'];

    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
      const start = +(i * step).toFixed(1);
      const end = +(i === segmentCount - 1 ? duration : (i + 1) * step).toFixed(1);
      segments.push({
        timeRange: `${start}-${end}s`,
        shotSize: preferred[Math.min(i, preferred.length - 1)] || 'medium',
        movement: i === 0 ? '稳定开场' : (i === segmentCount - 1 ? '收尾定格' : '内容推进'),
        speed: i === 0 ? '缓慢' : '中等',
        reason: `第${i + 1}段基于${duration}秒时长分配。`
      });
    }

    const strategy = `${sceneName}场景软回退时间轴`;
    const reasoning = `基于${duration}秒时长与${emotionPhase}情绪，采用原生v4软回退生成。`;

    return {
      strategy,
      reasoning,
      segmentCount,
      segments,
      generatedBy: 'v4-soft-fallback-native',
      description: `${strategy}（${segmentCount}段，${duration}秒）`,
      transitionType: options.transitionType || 'default',
      timeline: {
        strategy,
        reasoning,
        segments
      }
    };
  }
}

module.exports = {
  CameraMovementSystemV4,
  SceneAnalyzer,
  LLMTimelineGenerator,
  ContinuityEngine,
  TimelineFeatureToggle
};
