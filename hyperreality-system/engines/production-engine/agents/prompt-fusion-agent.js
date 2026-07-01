/**
 * PromptFusionAgent - Prompt融合Agent（核心）
 * 负责: 将L3-L7元素创造性融合成导演分镜脚本
 * 策略: L1/L2/L9硬约束走规则，L3-L7走LLM融合
 * v2.1.4-fix8: LLM输出标准字段格式（【约束】【基础】【场景】等）
 */
const { BaseAgent } = require('./base-agent');
const { normalizeFields, makeGetter } = require('../../field-standardizer');
const { FieldConsistencyChecker } = require('../../field-consistency-checker');

// 【v2.1.4-fix10-P25-fix3】外部专家建议：填满 schema 解决 LLM 字段缺失问题
// 25 个标准字段的 schema 模板：键名 + 类型提示
// 这是给 LLM 看的"结构契约"，绝不能再传 fields: {}
// ⚠️ value 使用空字符串占位，避免 LLM 把描述当输出值（风险5）
const STANDARD_FIELDS_SCHEMA = {
  director_instruction: '',
  constraint: '',
  baseline: '',
  scene: '',
  lighting: '',
  composition: '',
  color_palette: '',
  depth_of_field: '',
  camera_movement: '',
  character: '',
  costume: '',
  makeup: '',
  action: '',
  props: '',
  portraits: '',
  dialogue: '',
  timeline: '',
  mood: '',
  pacing: '',
  transition: '',
  audio: '',
  negative: '',
  bright_constraint: '',
  character_constraint: '',
  consistency: ''
};

// 字段描述表（仅用于补齐 prompt，不放入 schema）
const FIELD_DESCS = {
  director_instruction: 'string，≥80字符，导演整体质感指令',
  constraint: 'string，画幅/分辨率/帧率/格式/禁用项',
  baseline: 'string，8K/电影级/写实等基础画质词',
  scene: 'string，≥120字符，场景空间细节',
  lighting: 'string，≥150字符，主光/辅光/色温/方向',
  composition: 'string，≥100字符，景别/主体位置/线条/留白',
  color_palette: 'string，≥80字符，主色/辅色/肤色/饱和度/对比度',
  depth_of_field: 'string，≥80字符，焦点/景深/前景背景虚化',
  camera_movement: 'string，≥100字符，分时间段运镜',
  character: 'string，角色外貌与姿态',
  costume: 'string，服装材质款式',
  makeup: 'string，妆造',
  action: 'string，≥120字符，肢体动作与走位',
  props: 'string，道具',
  portraits: 'string，定妆照引用 image://...',
  dialogue: 'string，台词/旁白原文',
  timeline: 'string或object，分镜时间轴。支持两种格式：\n1. 纯文本: T00:00 - 描述；T00:XX - 描述（≥3段）\n2. 结构化: {"totalDuration":10,"beats":[{"time":0,"label":"开场","description":"...","cameraHint":"..."},{"time":3,"label":"推进","description":"...","cameraHint":"..."}],"sync":{"cameraMovement":"...","audio":"..."}}',
  mood: 'string，情绪基调',
  pacing: 'string，节奏',
  transition: 'string，转场方式',
  audio: 'string，≥100字符，环境音/配乐/音效',
  negative: 'string，负面约束',
  bright_constraint: 'string，明亮约束',
  character_constraint: 'string，角色一致性约束',
  consistency: 'string，跨镜头一致性'
};

// 25 字段标准名称列表（用于校验）
const REQUIRED_FIELDS = Object.keys(STANDARD_FIELDS_SCHEMA);

// 字段最低字符数要求
const MIN_LEN = {
  scene: 120, lighting: 150, composition: 100, action: 120,
  camera_movement: 100, timeline: 200, director_instruction: 80,
  color_palette: 80, depth_of_field: 80, audio: 100
};

function buildFullSchema(shotId) {
  // 用真实字段键填充，让 LLM 在 JSON 模式下有明确的 key 列表
  // value 使用空字符串，避免描述污染（风险5）
  return { shotId, fields: { ...STANDARD_FIELDS_SCHEMA } };
}

class PromptFusionAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'PromptFusionAgent', enabled: true, llmTimeout: 300000, llmMaxRetries: 5, ...options });
const PromptLengthConfig = require('../../../config/prompt-length.js');
// ...
    // 【审计修复】从配置文件读取，不再硬编码
    this.maxPromptLength = options.maxPromptLength || PromptLengthConfig.HARD_MAX || 12000;
    this.llmTimeout = options.llmTimeout || this.llmTimeout || 300000;
    this.llmMaxRetries = options.llmMaxRetries || 2;
    // v2.1.7: 新增跨字段一致性校验器
    this.consistencyChecker = new FieldConsistencyChecker({ strict: true, logLevel: 'warn' });
  }

  _getSystemPrompt() {
    return `你是一位资深电影导演和摄影师。根据镜头信息，生成结构化的导演分镜提示词。

【输出格式】
输出严格JSON：{"shots":[{"shotId":"SC01","fields":{...}}]}

【25个字段】按此顺序：
1. constraint: 技术参数(画幅/分辨率/格式/帧率)
2. baseline: 画质基础(8K/cinematic/photorealistic)
3. scene: 场景环境(地点/时间/空间/材质)
4. lighting: 灯光设计(主光方向+色温K值+光质+补光)
5. composition: 构图(景别+主体位置+线条引导)
6. color_palette: 色彩方案(主色调+辅助色+饱和度+对比度)
7. depth_of_field: 景深(焦点+光圈+前景/背景虚化)
8. camera_movement: 运镜(运动方式+速度+时间分布)
9. character: 角色身份/姿态/表情
10. costume: 服装(颜色/款式/质地/配饰)
11. makeup: 妆容发型
12. action: 具体动作(手势/步伐/视线)
13. props: 关键道具
14. portraits: 定妆照路径(image://characters/...)
15. dialogue: 角色台词(纯台词，不要旁白)
16. timeline: 时间轴(T00:XX格式，≥3段，每段画面+动作)
17. mood: 情绪关键词(1-2个，如tense/epic)
18. pacing: 节奏(五段式：整体/开头/中段/高潮/结尾)
19. transition: 转场(类型+持续时间+方向)
20. audio: 音频(环境音+音乐风格+BPM)
21. negative: 负面约束(no text/watermark/blurry等)
22. consistency: 跨镜头一致性
23. bright_constraint: 明亮约束(well-lit/clear visibility)
24. character_constraint: 角色约束(只出现指定角色，禁止分身)
25. director_instruction: 导演指令(风格定位+质感要求)

【最低字符数要求】
scene≥120, lighting≥150, composition≥100, action≥120, camera_movement≥100, timeline≥200, director_instruction≥80, color_palette≥80, depth_of_field≥80, audio≥100

【禁止词汇】全息/虚拟/投影/抽象/光影场域/数据空间/元宇宙/时间操控/霓虹/微观世界/宏观/抽象几何/流动光影/色彩对冲/空间扭曲/时间残影/数据流/光即角色/梦境流动性/湿版摄影/AI瑕疵

【关键约束】
- 不要照搬示例，根据真实场景和角色创作
- 每个字段独立，不要混成一段narrative
- 场景必须写实，禁止科幻/抽象元素
- 动作必须是真实物理动作，禁止全息/空间扭曲等
- 场景中不得出现含文字的物品描述
- 台词必须是角色直接对话，不要画外音/旁白
- 只描述当前镜头内容，严禁预告后续
- 保持角色视觉锚点一致`;
  }

  async process(shots, blueprint) {
    console.log(`[PromptFusionAgent] 开始处理 ${shots.length} 个镜头（串行模式，避免并发超时）`);

    const ratio = blueprint.config?.aspectRatio || '16:9';
    const characters = blueprint.character_system?.characters || [];

    const results = new Array(shots.length);
    let failed = 0;

    // 【审计修复】串行处理，避免并发导致API超时
    for (let i = 0; i < shots.length; i++) {
      // 每3个镜头检查一次内存，防止 OOM
      if (i % 3 === 0) {
        const mem = process.memoryUsage();
        const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
        if (heapMB > 1500) {  // 1.5GB 阈值
          console.warn(`[PromptFusionAgent] ⚠️ 内存告警: ${heapMB}MB，建议启用GC`);
          if (global.gc) global.gc();
        }
      }
      
      const shot = shots[i];
      console.log(`\n🎬 处理镜头 ${i + 1}/${shots.length}: ${shot.shotId}`);
      try {
        const fused = await this._fuseSingleShot(shot, ratio, characters, blueprint);
        results[i] = fused;
        console.log(`  ✅ ${shot.shotId} 完成`);
      } catch (e) {
        failed++;
        console.warn(`  ❌ ${shot.shotId} 融合失败: ${e.message}`);
        
        // 【修复】增加主调用重试（3次），不立即降级
        let fused = null;
        for (let retry = 1; retry <= 3; retry++) {
          console.log(`  🔄 主调用重试 ${retry}/3...`);
          try {
            await new Promise(r => setTimeout(r, 2000 * retry)); // 指数退避
            fused = await this._fuseSingleShot(shot, ratio, characters, blueprint);
            console.log(`  ✅ ${shot.shotId} 重试成功`);
            break;
          } catch (retryErr) {
            console.warn(`  ❌ 重试 ${retry} 失败: ${retryErr.message}`);
          }
        }
        
        if (fused) {
          results[i] = fused;
          continue;
        }
        
        // 主调用彻底失败，尝试补全
        try {
          console.log(`  🔄 尝试补全缺失字段...`);
          const filled = await this._fillMissingFieldsWithRetry(shot, ratio, characters);
          results[i] = filled;
          console.log(`  ✅ ${shot.shotId} 补全完成`);
        } catch (fillError) {
          console.warn(`  ❌ ${shot.shotId} 补全也失败: ${fillError.message}`);
          // 【修复】不直接规则兜底，而是尝试用已有数据组装
          const shotFields = this._extractFieldsFromShot(shot);
          if (Object.keys(shotFields).some(k => shotFields[k])) {
            console.log(`  ⚠️ 使用已有字段组装 prompt（非兜底）`);
            results[i] = this._buildShotResult(shot, shotFields);
          } else {
            console.warn(`  ❌ ${shot.shotId} 无任何可用数据，规则兜底`);
            results[i] = this._fallbackSingleShot(shot, ratio);
          }
        }
      }
    }

    if (failed > 0) {
      console.warn(`[PromptFusionAgent] ⚠️ ${failed}/${shots.length} 镜头需要补全/兜底`);
    }
    console.log(`[PromptFusionAgent] 完成 ✓ | 降级: ${failed}/${shots.length}`);
    return { shots: results, degraded: failed > 0, degradeReason: null };
  }

  /**
   * 【v2.1.4-fix11】构建shot结果（用于补全后的组装）
   */
  _buildShotResult(shot, fields) {
    const expandedFields = { ...fields };
    const fullPrompt = this._assembleStandardPrompt(shot, fields, shot.ratio || '16:9');
    
    return {
      ...shot,
      ...expandedFields,
      fields,
      fusionText: fields.scene || '',
      prompt: fullPrompt,
      promptCharCount: this._countChars(fullPrompt),
      degraded: true,
      degradeReason: '主LLM超时，通过重试补全生成'
    };
  }

  async _fuseSingleShot(shot, ratio, characters, blueprint) {
    const prompt = this._buildBatchPrompt([shot], ratio, characters);
    // 【v2.1.4-fix10-P25-fix3】把空 schema 换成带 25 字段键名的完整模板
    // 【P1-4 修复】schema 加 required/requiredArrays/rejectEmptyArray，让质量门真正生效
    const schema = {
      required: ['shots'],
      requiredArrays: ['shots'],
      rejectEmptyArray: true,
      shots: [buildFullSchema(shot.shotId)]
    };

    const llmResult = await this._callLLM(prompt, schema, () => {
      throw new Error('LLM fallback');
    });

    const fusionEntry = llmResult.result?.shots?.find(s => s.shotId === shot.shotId);
    let fields = fusionEntry?.fields || {};
    
    // 【v2.1.4-fix10】在 LLM 输出入口统一标准化为 snake_case
    fields = normalizeFields(fields);
    
    // 【P1-4 修复】根据LLM结果和字段完整性标记降级状态
    const usedFallback = llmResult.degraded || Object.keys(fields).length === 0;
    const completeness = await this._ensureFieldCompleteness(shot, fields, ratio, characters);
    fields = completeness.fields;
    const finalDegraded = usedFallback || completeness.usedRuleFallback;
    const finalDegradeReason = finalDegraded
      ? (usedFallback ? '主LLM失败,规则兜底' : '部分字段规则补齐')
      : null;
    
    // 【v2.1.4-fix9-P25-fix7】将 fields 中的关键字段展开到 shot 顶层
    const expandedFields = { ...fields };
    
    const fullPrompt = this._assembleStandardPrompt(shot, fields, ratio);

    // v2.1.7: 跨字段一致性校验 + 自动修复
    const shotWithBlueprint = { ...shot, fields, blueprint: shot.blueprint || blueprint };
    const checkResult = this.consistencyChecker.check(shotWithBlueprint);
    if (!checkResult.valid || checkResult.warningCount > 0) {
      console.log(`[PromptFusionAgent] ${shot.shotId} 字段一致性: ${checkResult.issues.length} issues, 自动修复中...`);
      const fixed = this.consistencyChecker.autoFix(shotWithBlueprint);
      if (fixed.fields) {
        Object.assign(fields, fixed.fields);
      }
    }

    return {
      ...shot,
      ...expandedFields,
      fields,
      fusionText: fields.scene || '',
      prompt: fullPrompt,
      promptCharCount: this._countChars(fullPrompt),
      degraded: finalDegraded, // 【P1-4 修复】真实降级标记
      degradeReason: finalDegradeReason
    };
  }

  /**
   * 【v2.1.4-fix10-P25-fix3】字段完整性校验 + 定向补齐
   * 先校验，缺哪些就只让 LLM 补哪些，一次轻量调用搞定
   */
  async _ensureFieldCompleteness(shot, fields, ratio, characters) {
    let usedRuleFallback = false;
    // 1. 找出缺失或过短字段
    const missing = REQUIRED_FIELDS.filter(f => {
      const v = fields[f];
      if (!v || String(v).trim() === '') return true;
      const min = MIN_LEN[f] || 0;
      return min > 0 && this._countChars(String(v)) < min;
    });

    if (missing.length === 0) return { fields, usedRuleFallback: false }; // 全齐，无需补

    console.log(`[PromptFusion] ${shot.shotId} 缺失/过短字段 ${missing.length} 个: ${missing.join(',')} → 定向补齐`);

    // 2. 只补缺失字段，给 LLM 一个极简、聚焦的 prompt
    const fillPrompt = this._buildFillPrompt(shot, missing, fields, ratio, characters);
    const fillSchema = { shotId: shot.shotId, fields: Object.fromEntries(missing.map(k => [k, STANDARD_FIELDS_SCHEMA[k]])) };

    try {
      // 【P1-2 修复】fill调用用小预算，不占用主调用时间
  // 【修复】提升重试和超时，给补齐更多机会
      const fillResult = await this._callLLM(fillPrompt, fillSchema, () => null, {
        maxRetries: 2,
        maxTokens: 4096,
        timeoutMs: 60000 // fill 用 60s，不占用主预算
      });
      const fillFields = fillResult?.result?.fields || fillResult?.result?.[shot.shotId] || {};
      const normalized = normalizeFields(fillFields);
      for (const k of missing) {
        if (normalized[k] && String(normalized[k]).trim() !== '') {
          fields[k] = normalized[k];
        }
      }
    } catch (e) {
      console.warn(`[PromptFusion] ${shot.shotId} 补齐失败，保留已有: ${e.message}`);
    }

    // 3. 仍缺的字段，尝试最小 LLM 降级（保留灵气），失败再用固定模板兜底
    const stillMissing = REQUIRED_FIELDS.filter(f => !fields[f] || String(fields[f]).trim() === '');
    if (stillMissing.length > 0) {
      usedRuleFallback = true;
      const shotData = this._extractFieldsFromShot(shot);
      
      // 【v2.1.0】先尝试最小 LLM 降级，保留创作灵气
      for (const f of stillMissing) {
        if (shotData[f]) {
          fields[f] = shotData[f];
        } else {
          // 尝试最小 LLM 调用生成个性化字段
          const minimalValue = await this._minimalLLMDegradation(f, shot, ratio, characters);
          fields[f] = minimalValue || this._defaultFieldValue(f, shot);
        }
      }
      console.warn(`[PromptFusion] ${shot.shotId} 兜底 ${stillMissing.length} 字段（先尝试最小LLM降级）`);
    }

    return { fields, usedRuleFallback };
  }

  /**
   * 【v2.1.4-fix13-审计修复】降为1次重试，去掉指数退避等待，失败后直接规则兜底
   */
  async _fillMissingFieldsWithRetry(shot, ratio, characters) {
    // 【修复】从 1 次提升到 3 次，给补齐更多机会
    const maxRetries = 3;
    
    // 先从shot中提取已有数据
    const fields = {};
    const shotData = this._extractFieldsFromShot(shot);
    for (const f of REQUIRED_FIELDS) {
      fields[f] = shotData[f] || '';
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 【修复】放宽预算检查到 10s，不因时间紧张就放弃
      const remaining = this._remainingMs();
      if (remaining < 10000) {
        console.warn(`  ⏰ 剩余预算不足(${remaining}ms)，中止补全重试`);
        break;
      }

      try {
        console.log(`  🔄 补全尝试 ${attempt}/${maxRetries}...`);
        const completeness = await this._ensureFieldCompleteness(shot, fields, ratio, characters);
        
        // 【审计修复】更新 fields，让下次重试基于最新状态
        Object.assign(fields, completeness.fields);
        
        // 检查是否还有空字段
        const stillEmpty = REQUIRED_FIELDS.filter(f => !fields[f] || String(fields[f]).trim() === '');
        if (stillEmpty.length === 0) {
          console.log(`  ✅ 补全成功，所有字段已填充`);
          return this._buildShotResult(shot, fields);
        }
        console.log(`  ⚠️ 仍有 ${stillEmpty.length} 字段为空，继续重试...`);
      } catch (e) {
        console.warn(`  ❌ 补全尝试 ${attempt} 失败: ${e.message}`);
      }
    }
    
    // 【修复】重试用完仍有缺失，返回当前已填充的字段（不强制兜底为默认值）
    // 原因：部分字段有值比全部模板化更好，保留 LLM 已生成的内容
    console.warn(`  ⚠️ 补全重试耗尽，返回已有字段（${Object.keys(fields).filter(k => fields[k]).length}/${REQUIRED_FIELDS.length} 已填充）`);
    return this._buildShotResult(shot, fields);
  }

  // 【v2.1.0】最小 LLM 降级：用缩短的 prompt + 剧本上下文推断字段，保留创作灵气
  async _minimalLLMDegradation(field, shot, ratio, characters) {
    try {
      const ctx = this._buildMinimalContext(shot, ratio, characters);
      const prompt = `根据以下镜头上下文，生成 "${field}" 字段的值。只输出该字段的值，不要解释。

镜头上下文：
${ctx}

字段要求：${FIELD_DESCS[field] || '无特殊要求'}

注意：
- 必须与镜头上下文（角色、场景、情绪）匹配
- 拒绝通用模板（如"好莱坞电影级质感"）
- 保持创作灵气，个性化描述`;

      const schema = { [field]: STANDARD_FIELDS_SCHEMA[field] || '' };
      const result = await this._callLLM(prompt, schema, () => null, {
        maxRetries: 2,
        maxTokens: 2048,
        timeoutMs: 60000,
        shotBudget: 60000 // 镜头级独立预算 60s
      });
      
      if (result?.result?.[field] && String(result.result[field]).trim()) {
        const value = String(result.result[field]).trim();
        // 过滤掉明显的模板文本
        if (value.length > 10 && !value.includes('好莱坞') && !value.includes('室内写实')) {
          console.log(`[PromptFusion] ${shot.shotId} ${field} 最小降级成功 ✓`);
          return value;
        }
      }
      return null;
    } catch (e) {
      console.warn(`[PromptFusion] ${shot.shotId} ${field} 最小降级失败: ${e.message}`);
      return null;
    }
  }
  
  _buildMinimalContext(shot, ratio, characters) {
    const parts = [];
    parts.push(`场景: ${shot.scene || shot.sceneDescription || '未知'}`);
    parts.push(`情绪: ${shot.mood || shot.emotional_target || '未知'}`);
    parts.push(`动作: ${shot.action || '未知'}`);
    
    if (shot.characters && shot.characters.length > 0) {
      parts.push(`角色: ${shot.characters.map(c => c.name || c).join(', ')}`);
    }
    if (characters && characters.length > 0) {
      const charNames = characters.map(c => c.name || c.character?.name || c).join(', ');
      if (charNames) parts.push(`角色系统: ${charNames}`);
    }
    
    if (shot.dialogue) {
      const dialogue = typeof shot.dialogue === 'string' ? shot.dialogue : 
        (shot.dialogue.lines || []).map(l => l.content).join('; ');
      if (dialogue) parts.push(`台词: ${dialogue}`);
    }
    
    parts.push(`时长: ${shot.duration || '?'}s`);
    parts.push(`画幅: ${ratio || '16:9'}`);
    
    if (shot.timeOfDay) parts.push(`时间: ${shot.timeOfDay}`);
    if (shot.location) parts.push(`地点: ${shot.location}`);
    if (shot.sceneType) parts.push(`场景类型: ${shot.sceneType}`);
    
    return parts.join('\n');
  }

  // 【v2.1.4-fix11】规则兜底默认值 - 25字段完整默认值，确保绝不返回空字符串
  // 【v2.1.0】注意：此方法仅在最小 LLM 降级失败后才调用，作为最终底线
  _defaultFieldValue(field, shot) {
    const ratio = shot.ratio || '16:9';
    const sceneType = shot.sceneType || 'standard';
    const character = shot.character || '主角';
    
    const defaults = {
      director_instruction: '好莱坞电影级质感，写实风格，专业摄影布光，8K超高清',
      constraint: `Aspect ratio: ${ratio}, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text anywhere in frame, no subtitle, no caption, no watermark, no logo, no readable characters`,
      baseline: '8K resolution, cinematic quality, highly detailed, photorealistic, hyperrealistic, sharp focus, ultra high definition, lifelike textures, professional color grading',
      scene: `${sceneType}场景，室内写实环境，自然光线照射，真实材质质感，空间层次分明，环境细节丰富`,
      lighting: '主光：右侧45度自然光 5600K柔光漫射；补光：左前侧反光板填充阴影；背景光：轮廓光分离层次；光比3:1，整体明亮清晰',
      composition: '景别：中景（膝上）；主体位置：画面黄金分割点；线条引导：纵深层次感；画框边缘：适度留白',
      color_palette: '主色调：自然偏暖；辅助色：环境本色；肤色：自然健康；饱和度：中等自然；对比度：中高清晰',
      depth_of_field: '焦点：主体面部或动作中心；景深：中等（f/4），背景适度虚化；前景：轻微虚化增加层次；层次：前景-中景-背景三层分离',
      camera_movement: '0-3s：固定机位稳定构图；3-6s：缓慢推近或平移；6-10s：回到固定机位',
      character: `${character}，写实人物形象，自然姿态，真实表情，符合场景身份`,
      costume: '符合角色身份的写实服装，面料质感真实，颜色自然，款式简洁大方',
      makeup: '素颜或淡妆，妆容自然真实，发型整洁，符合日常生活场景',
      action: `${character}自然站立或行走，手部自然动作，眼神交流，真实肢体语言`,
      props: '场景中必要的写实道具，材质真实，无文字标识，符合场景功能',
      portraits: 'image://characters/default/portrait.png',
      dialogue: '',
      timeline: 'T00:00 - 开场构图，环境展示；T00:03 - 主体进入画面；T00:06 - 核心动作或对白；T00:09 - 收尾定格',
      mood: 'calm, professional, natural',
      pacing: '整体：沉稳中等节奏；开头：平缓引入；中段：自然推进；结尾：平稳收尾',
      transition: '自然切换，无特效转场，直接硬切或微淡入淡出',
      audio: '环境底噪真实自然，无明显配乐干扰，人声音量适中清晰，空间感真实',
      negative: 'no text anywhere in frame, no watermark, no logo, no subtitle, no caption, no blur, no distortion, no extra limbs, no deformed features, no cartoon style, no anime, no illustration, no painting, no 3D render, no CGI, no special effects, no abstract, no surreal',
      bright_constraint: 'bright lighting, well-lit scene, clear visibility, natural illumination, avoid dark shadows',
      character_constraint: '只出现指定角色一人，禁止其他人物入镜，禁止同一角色重复出现，禁止角色分身或克隆，保持角色形象一致',
      consistency: '保持角色面部特征、服装造型、发型妆容跨镜头一致，场景光线连续，色调统一'
    };
    
    const value = defaults[field];
    if (!value) {
      console.warn(`[PromptFusionAgent] 未知字段的默认值: ${field}`);
      return `[规则兜底] ${field} 默认值`;
    }
    return value;
  }

  // ==================== v2.1.7: 动态字段生成 ====================

  /**
   * 从blueprint动态生成导演指令
   */
  _generateDirectorInstruction(blueprint, mood) {
    const style = blueprint.style || blueprint.config?.style || 'cinematic';
    const creativeIntensity = blueprint.creativeIntensity || blueprint.config?.creativeIntensity || 0.7;
    const genre = blueprint.genre || blueprint.config?.genre || '';
    
    const styleTemplates = {
      cinematic: {
        low: '电影级写实风格，专业摄影布光，细腻质感，自然光效',
        medium: '好莱坞电影级质感，写实风格，专业摄影布光，8K超高清， cinematic color grading',
        high: '史诗电影级大制作，IMAX质感，专业电影摄影，极致细节，戏剧化布光，8K超高清'
      },
      documentary: {
        low: '纪录片风格，自然光，真实记录，手持摄影质感',
        medium: '纪实电影风格，自然光效，真实环境，专业纪录片摄影',
        high: '沉浸式纪录片，电影级纪实摄影，环境光主导，真实质感'
      },
      animation: {
        low: '柔和动画风格，温暖色调，简洁线条，清晰画面',
        medium: '精品动画风格，丰富色彩，流畅动作，专业动画摄影',
        high: '顶级动画电影风格，极致色彩表现，复杂场景，电影级动画摄影'
      }
    };

    const intensity = creativeIntensity < 0.4 ? 'low' : creativeIntensity < 0.8 ? 'medium' : 'high';
    const template = styleTemplates[style]?.[intensity] || styleTemplates.cinematic[intensity];
    
    // 根据情绪微调
    const moodModifiers = {
      tense: '，紧张氛围，高对比布光，强化戏剧张力',
      sad: '，忧郁基调，低饱和色调，柔光处理',
      epic: '，史诗气势，宏大构图，金色光线，戏剧化阴影',
      warm: '，温馨氛围，暖色调，柔和光线',
      calm: '，宁静基调，均匀布光，自然色调'
    };

    const moodStr = this._extractMoodFromString(mood);
    const modifier = moodModifiers[moodStr] || '';
    
    return `${template}${modifier}`;
  }

  /**
   * 从blueprint动态生成画质基础
   */
  _generateBaseline(blueprint, duration) {
    const style = blueprint.style || blueprint.config?.style || 'cinematic';
    const resolution = duration <= 30 ? '4K' : duration <= 60 ? '6K' : '8K';
    
    const styleWords = {
      cinematic: 'cinematic quality, film grain, professional color grading',
      documentary: 'documentary realism, natural textures, authentic lighting',
      animation: 'vivid colors, smooth gradients, clean lines, vibrant animation'
    };

    return `${resolution} resolution, ${styleWords[style] || styleWords.cinematic}, highly detailed, photorealistic, sharp focus, ultra high definition, lifelike textures`;
  }

  /**
   * 从lighting动态推导明亮约束
   */
  _generateBrightConstraint(lighting, mood) {
    const lightingStr = String(lighting || '').toLowerCase();
    const moodStr = this._extractMoodFromString(mood);
    
    // 夜晚场景
    if (lightingStr.includes('night') || lightingStr.includes('moon') || lightingStr.includes('dark')) {
      return 'atmospheric low-key lighting, moonlight or artificial light sources, visible through contrast rather than brightness, moody ambiance with clear visibility of key subjects';
    }
    
    // 悲伤/忧郁情绪
    if (moodStr === 'sad') {
      return 'soft diffused lighting, gentle shadows, adequate visibility without harsh brightness, low-key moody atmosphere';
    }
    
    // 史诗/宏大
    if (moodStr === 'epic') {
      return 'dramatic bright lighting with strong contrast, golden hour or strong directional light, clear visibility of grand scale';
    }
    
    // 默认
    return 'bright lighting, well-lit scene, clear visibility, natural illumination, avoid dark shadows on face, adequate illumination';
  }

  /**
   * 提取情绪关键词
   */
  _extractMoodFromString(moodStr) {
    if (!moodStr) return null;
    const str = String(moodStr).toLowerCase();
    const moodMap = {
      tense: ['tense', '紧张', '紧迫', '悬疑', 'anxious', 'nervous'],
      sad: ['sad', '悲伤', '忧郁', 'melancholy', 'sorrow', 'grief'],
      epic: ['epic', '史诗', '宏大', '壮丽', 'grand', 'majestic'],
      warm: ['warm', '温馨', '温暖', 'cozy', 'gentle', 'tender'],
      calm: ['calm', '平静', '宁静', 'peaceful', 'serene', 'tranquil']
    };
    for (const [mood, markers] of Object.entries(moodMap)) {
      if (markers.some(m => str.includes(m))) return mood;
    }
    return null;
  }

  /**
   * ⭐ v2.1.7: 渲染结构化时间轴对象为文本
   */
  _renderStructuredTimeline(timelineObj) {
    if (!timelineObj || !timelineObj.beats || !Array.isArray(timelineObj.beats)) {
      return '';
    }
    const beats = timelineObj.beats;
    const duration = timelineObj.totalDuration || 10;
    
    return beats.map(b => {
      const timeStr = `T00:${String(b.time || 0).padStart(2, '0')}`;
      const label = b.label || '';
      const desc = b.description || '';
      const cameraHint = b.cameraHint ? ` [运镜:${b.cameraHint}]` : '';
      return `${timeStr} - ${label}${desc ? '，' + desc : ''}${cameraHint}`;
    }).join('；');
  }

  /**
   * ⭐ v2.1.7: 按镜头时长动态生成时间轴节拍
   * 5秒→3节拍, 8秒→5节拍, 12秒→6节拍, 15秒+→7节拍
   */
  _generateTimelineBeats(duration) {
    const d = duration || 10;
    if (d <= 5) {
      return 'T00:00 - 全景establishing，环境展示；T00:02 - 主体动作，情绪推进；T00:04 - 收尾定格，情绪落定';
    } else if (d <= 8) {
      const s2 = Math.floor(d * 0.25);
      const s3 = Math.floor(d * 0.5);
      const s4 = Math.floor(d * 0.75);
      return `T00:00 - 全景establishing，环境展示；T00:${String(s2).padStart(2, '0')} - 主体入画，动作开始；T00:${String(s3).padStart(2, '0')} - 情绪推进，动作展开；T00:${String(s4).padStart(2, '0')} - 动作高潮，情绪升温；T00:${String(d-1).padStart(2, '0')} - 收尾定格，情绪落定`;
    } else if (d <= 12) {
      const s2 = Math.floor(d * 0.2);
      const s3 = Math.floor(d * 0.4);
      const s4 = Math.floor(d * 0.6);
      const s5 = Math.floor(d * 0.8);
      return `T00:00 - 全景establishing，环境展示，冷静氛围；T00:${String(s2).padStart(2, '0')} - 中景推进，主体动作；T00:${String(s3).padStart(2, '0')} - 情绪升温，动作展开；T00:${String(s4).padStart(2, '0')} - 动作高潮，情绪顶点；T00:${String(s5).padStart(2, '0')} - 情绪回落，光线平复；T00:${String(d-1).padStart(2, '0')} - 收尾定格`;
    } else {
      const s2 = Math.floor(d * 0.15);
      const s3 = Math.floor(d * 0.3);
      const s4 = Math.floor(d * 0.45);
      const s5 = Math.floor(d * 0.6);
      const s6 = Math.floor(d * 0.75);
      const s7 = Math.floor(d * 0.9);
      return `T00:00 - 全景establishing，环境展示，冷静氛围；T00:${String(s2).padStart(2, '0')} - 主体入画，动作开始；T00:${String(s3).padStart(2, '0')} - 中景推进，情绪升温；T00:${String(s4).padStart(2, '0')} - 动作展开，情绪推进；T00:${String(s5).padStart(2, '0')} - 情绪顶点，动作高潮；T00:${String(s6).padStart(2, '0')} - 情绪回落，光线变化；T00:${String(s7).padStart(2, '0')} - 收尾定格，情绪落定`;
    }
  }

  // ==================== 原有方法 ====================
  _buildFillPrompt(shot, missing, existingFields, ratio, characters) {
    const ctx = Object.entries(existingFields)
      .filter(([k, v]) => v && String(v).trim())
      .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
      .join('\n');
    return `## 镜头补齐任务
镜头ID：${shot.shotId}（时长 ${shot.duration || '?'}s）
场景：${shot.scene || ''}
情绪：${shot.mood || ''}
台词：${(shot.dialogue?.lines?.map(l => l.content).join('; ') || shot.dialogue || '')}

## 已生成字段（保持风格一致）
${ctx}

## 本次只补齐以下字段，每个必须达到最低字符数
${missing.map(f => `- ${f}：${FIELD_DESCS[f]}`).join('\n')}

只输出 JSON，不要解释。`;
  }

  /**
   * 【v2.1.4-fix10-fix1】从 shot 对象提取字段数据，用于补充 LLM 缺失字段
   */
  _extractFieldsFromShot(shot) {
    const result = {};
    if (!shot) return result;
    
    // 提取已有数据 - 使用多名字段映射，兼容不同阶段的字段命名
    const scene = this._resolveField(shot, 'scene');
    if (scene) result.scene = scene;
    
    const mood = this._resolveField(shot, 'mood');
    if (mood) result.mood = mood;
    
    const action = this._resolveField(shot, 'action');
    if (action) result.action = action;
    
    const character = this._resolveField(shot, 'character');
    if (character) result.character = typeof character === 'string' ? character : character?.name || '';
    
    // 【审计修复】多名字段映射：cameraString/cameraMovement/camera → camera_movement
    const cameraMovement = this._resolveField(shot, 'cameraString', 'cameraMovement', 'camera', 'camera_movement');
    if (cameraMovement) result.camera_movement = cameraMovement;
    
    // 【审计修复】多名字段映射：lightingString → lighting
    const lighting = this._resolveField(shot, 'lightingString', 'lighting');
    if (lighting) result.lighting = lighting;
    
    // 【审计修复】多名字段映射：backgroundSoundString → audio
    const audio = this._resolveField(shot, 'backgroundSoundString', 'backgroundSound', 'audio');
    if (audio) result.audio = audio;
    
    if (shot.dialogue) {
      const pureDialogue = shot.dialogueText || this._extractPureDialogue(shot.dialogue);
      if (pureDialogue) result.dialogue = `"${pureDialogue}"`;
    }
    
    // 【审计修复】多名字段映射：emotional_target/emotionalTarget → mood
    const emotionalTarget = this._resolveField(shot, 'emotionalTarget', 'emotional_target');
    if (emotionalTarget) {
      const et = emotionalTarget;
      result.mood = `${et.valence > 0.5 ? 'positive' : 'neutral'}, ${et.arousal > 0.5 ? 'high energy' : 'calm'}`;
    }
    if (shot.duration) {
      const d = shot.duration;
      const seg1 = Math.floor(d * 0.3);
      const seg2 = Math.floor(d * 0.6);
      result.timeline = `T00:00 - 全景establishing，环境展示；T00:${String(seg1).padStart(2, '0')} - 中景推进，人物动作；T00:${String(seg2).padStart(2, '0')} - 情绪收尾，光线平复`;
    }
    if (shot.characterRef) result.portraits = shot.characterRef;
    
    result.bright_constraint = 'bright lighting, well-lit scene, clear visibility, no dark shadows on face, adequate illumination';
    
    // 【修复】多角色场景：character_constraint 应锁定到所有角色，不是只出现一人
    const characterNames = shot.characters?.map(c => c.name || c).join('、') 
      || shot.character?.name 
      || '指定角色';
    result.character_constraint = `只出现${characterNames}，禁止其他未指定人物入镜，禁止同一角色重复出现，禁止角色分身或克隆`;
    
    result.director_instruction = '好莱坞大导演质感，电影级画面，写实风格，无特效，无科幻元素';
    result.consistency = '保持角色形象一致，造型不变，面部特征与体型每帧统一';
    
    return result;
  }

  _fallbackSingleShot(shot, ratio) {
    const fallbackPrompt = this._assembleFullPrompt(shot, '', ratio);
    // 【v2.1.4-fix13-审计修复】保留原始 fields，避免降级时丢失所有字段
    const preservedFields = shot.fields && typeof shot.fields === 'object' && Object.keys(shot.fields).length > 0
      ? shot.fields
      : this._extractFieldsFromShot(shot);
    return {
      ...shot,
      fields: preservedFields,
      fusionText: '',
      prompt: fallbackPrompt,
      promptCharCount: this._countChars(fallbackPrompt),
      degraded: true,
      degradeReason: '单镜头 LLM 融合失败，规则兜底',
      _pf_fallback: true
    };
  }

  /**
   * 组装标准格式Prompt（按之前正常版本的字段格式）
   */
  _assembleStandardPrompt(shot, fields, ratio) {
    const parts = [];
    
    // 【语言约束】⭐ 新增：强制中文输出
    parts.push('【语言约束】全部字段必须使用中文输出，禁止出现英文单词、英文短语、英文描述。');

    // 辅助函数：获取字段值（支持驼峰和下划线命名）
    const getField = (...names) => {
      for (const name of names) {
        if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') {
          return fields[name];
        }
      }
      return undefined;
    };

    // ⭐ v2.1.7 P3: 导演意图合并输出
    // 将 director_instruction + constraint + baseline 合并为一个流畅段落
    // 保持数据结构独立（兼容性），但输出更自然
    const directorInstruction = getField('director_instruction', 'directorInstruction') 
      || this._generateDirectorInstruction(shot.blueprint || {}, fields.mood);
    const constraint = fields.constraint || `Aspect ratio: ${ratio}, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background`;
    const duration = shot.duration || 10;
    const baseline = fields.baseline || this._generateBaseline(shot.blueprint || {}, duration);
    
    // 合并为自然流畅的导演意图段落
    const directorIntentParts = [];
    if (directorInstruction) directorIntentParts.push(directorInstruction);
    directorIntentParts.push(baseline);
    directorIntentParts.push(constraint);
    
    parts.push(`【导演意图】${directorIntentParts.join('。')}`);

    // 【场景】
    // 【v2.1.4-fix9-P5】场景强制写实：禁止科幻/抽象词汇
    let sceneDesc = fields.scene || shot.scene || '';
    const forbiddenWords = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
    const hasForbidden = forbiddenWords.some(w => sceneDesc.includes(w));
    if (hasForbidden) {
      console.warn(`[PromptFusionAgent] ⚠️ 镜头 ${shot.shotId} 场景含禁止词汇: "${sceneDesc.substring(0, 50)}..."，强制替换为写实场景`);
      // 强制替换为写实场景
      const fallbackScenes = [
        '医院健康宣教室，白色荧光灯均匀照明，白墙面贴有无文字骨骼肌解剖图与运动损伤海报（纯图形版），木质讲台表面带有细微使用划痕，地面浅灰色防滑PVC地胶',
        '三甲医院检验科走廊，冷白色LED光源从走廊顶部连续排列向下照射，无文字箭头标识牌指向尿液检验窗口，地面浅色抛光瓷砖，墙面白色医用抗菌涂层',
        '医生诊室，白色墙面悬挂无文字人体解剖示意图（纯图形版），办公桌摆放听诊器与血压计，检查床铺有蓝色一次性床单，无影灯悬于上方，窗光透入',
        '医院健康管理中心，嵌入式LED灯带洒下柔和暖白光，接待台后方排列无文字健康宣传展板（纯图形版），前方皮质沙发与实木茶几，地面灰色哑光瓷砖'
      ];
      const index = parseInt(shot.shotId.replace(/\D/g, '')) || 0;
      sceneDesc = fallbackScenes[index % fallbackScenes.length];
    }
    if (sceneDesc) parts.push(`【场景】${sceneDesc}`);

    // 【灯光/照明】⭐ v2.1.7 P3: 灯光设计统一输出
    // 将 lighting + bright_constraint 合并为统一的【灯光设计】段落
    const lightingField = getField('lighting');
    const brightConstraint = getField('bright_constraint', 'brightConstraint') 
      || this._generateBrightConstraint(fields.lighting, fields.mood);
    
    if (lightingField || brightConstraint) {
      const lightingParts = [];
      if (lightingField) lightingParts.push(lightingField);
      if (brightConstraint) lightingParts.push(`[亮度要求] ${brightConstraint}`);
      parts.push(`【灯光设计】${lightingParts.join('；')}`);
    }

    // 【构图】⭐ 新增：景别+画面比例+主体位置+线条引导
    const compositionField = getField('composition');
    if (compositionField) parts.push(`【构图】${compositionField}`);

    // 【色彩/色调】⭐ 新增：调色方案+色温倾向+饱和度
    const colorPalette = getField('color_palette', 'colorPalette');
    if (colorPalette) parts.push(`【色彩/色调】${colorPalette}`);

    // 【景深】⭐ 新增：焦点控制+虚化程度+前景/背景层次
    const depthOfField = getField('depth_of_field', 'depthOfField');
    if (depthOfField) parts.push(`【景深】${depthOfField}`);

    // 【运镜】⭐ 新增：镜头运动方式（从【动作】拆分）
    const cameraMovement = getField('camera_movement', 'cameraMovement');
    if (cameraMovement) parts.push(`【运镜】${cameraMovement}`);

    // 【角色】
    // 【v2.1.4-fix9-P4】角色服装锁定：强制使用原始角色设定中的服装
    let characterDesc = fields.character || '';
    if (characterDesc && shot.character) {
      // 如果LLM输出的角色描述中没有"警"字，但原始角色设定有，则强制替换
      const originalChar = shot.character || '';
      if (originalChar.includes('警') && !characterDesc.includes('警')) {
        // LLM擅自改了服装，从原始角色描述中提取姓名+服装
        const nameMatch = originalChar.match(/([^,，]+警[^,，]+)/);
        if (nameMatch) {
          characterDesc = characterDesc.replace(/(身着|穿着|身穿|着)[^，]+/, nameMatch[1]);
          // 如果没替换成功，直接在描述开头插入正确服装
          if (!characterDesc.includes('警')) {
            characterDesc = originalChar + '，' + characterDesc;
          }
        }
      }
    }
    if (characterDesc) parts.push(`【角色】${characterDesc}`);

    // 【服装】⭐ 新增：详细服装描述（从【角色】拆分）
    const costumeField = getField('costume');
    if (costumeField) parts.push(`【服装】${costumeField}`);

    // 【化妆】⭐ 新增：妆容、发型细节
    const makeupField = getField('makeup');
    if (makeupField) parts.push(`【化妆】${makeupField}`);

    // 【动作】
    // 【v2.1.4-fix9-P9】动作强制写实：禁止科幻/抽象词汇
    let actionDesc = getField('action') || shot.action || '';
    const actionForbidden = ['全息', '虚拟', '投影', '空间扭曲', '时间残影', '霓虹', '数据流', '光即角色', '抽象构图', '梦境流动性', '手绘动画'];
    const actionHasForbidden = actionForbidden.some(w => actionDesc.includes(w));
    if (actionHasForbidden) {
      console.warn(`[PromptFusionAgent] ⚠️ 镜头 ${shot.shotId} 动作含禁止词汇: "${actionDesc.substring(0, 50)}..."，强制替换为写实动作`);
      // 提取角色名
      const charName = shot.character?.name || '示例角色';
      // 根据场景类型生成写实动作
      const fallbackActions = [
        '镜头缓慢推近，示例角色站立讲台前，自然手势讲解，眼神注视镜头，警服在荧光灯下轮廓清晰',
        '稳定机位中景，示例角色沿走廊缓步前行，侧头指向检验窗口，白大褂医生从背景走过',
        '手持微晃跟拍，示例角色靠近检查床，手指轻触医学挂图，无影灯在头顶形成柔和光晕',
        '固定机位中景，示例角色坐于沙发边缘，双手交叠置于膝上，LED灯带在身后形成均匀轮廓光',
        '缓慢后拉全景，示例角色站立检验窗口前，转身面向镜头，不锈钢台面反射冷白色光源'
      ];
      const idx = parseInt(shot.shotId.replace(/\D/g, '')) || 0;
      actionDesc = fallbackActions[idx % fallbackActions.length];
    }
    if (actionDesc) parts.push(`【动作】${actionDesc}`);

    // 【道具】⭐ 新增：关键道具（手持物、桌面物品、背景物件）
    const propsField = getField('props');
    if (propsField) parts.push(`【道具】${propsField}`);

    // 【定妆照】
    const portraitsField = getField('portraits');
    if (portraitsField) parts.push(`【定妆照】${portraitsField}`);

    // 台词
    // 【v2.1.6】优先使用 dialogueBlocks 渲染为 Seedance 2.0 内联格式
    if (shot.dialogueBlocks && Array.isArray(shot.dialogueBlocks) && shot.dialogueBlocks.length > 0) {
      const renderedDialogue = this._renderDialogueBlocks(shot.dialogueBlocks, shot.duration || 10);
      if (renderedDialogue) {
        parts.push(renderedDialogue);
      }
    } else {
      // 回退：使用旧的 dialogue 字段
      const dialogueField = getField('dialogue');
      if (dialogueField) {
        // 【v2.1.4-fix13】确保台词有【台词】前缀
        const dialogueText = dialogueField.startsWith('【台词】') ? dialogueField : `【台词】${dialogueField}`;
        parts.push(dialogueText);
      }
    }

    // 【时间轴】镜头内部微观导演调度
    const timelineField = getField('timeline');
    if (timelineField) {
      // ⭐ v2.1.7: 支持结构化时间轴对象
      if (typeof timelineField === 'object' && timelineField.beats) {
        const rendered = this._renderStructuredTimeline(timelineField);
        parts.push(`【时间轴】${rendered}`);
      } else {
        parts.push(`【时间轴】${timelineField}`);
      }
    } else {
      // ⭐ v2.1.7: 按镜头时长动态生成时间轴节拍
      const duration = shot.duration || 10;
      const beats = this._generateTimelineBeats(duration);
      parts.push(`【时间轴】${beats}`);
    }

    // 【情绪】
    const moodField = getField('mood');
    if (moodField) parts.push(`【情绪】${moodField}`);

    // 【节奏】⭐ 新增：镜头速度+紧迫感+舒缓度
    const pacingField = getField('pacing');
    if (pacingField) parts.push(`【节奏】${pacingField}`);

    // 【转场】⭐ 新增：与下一镜头的衔接方式
    const transitionField = getField('transition');
    if (transitionField) parts.push(`【转场】${transitionField}`);

    // 【音频】
    const audioField = getField('audio');
    if (audioField) parts.push(`【音频】${audioField}`);

    // 【负面约束】⭐ v2.1.7: 从style动态选择负面约束
    const negativeField = getField('negative');
    if (negativeField) {
      parts.push(`【负面约束】${negativeField}`);
    } else {
      const style = shot.blueprint?.style || shot.blueprint?.config?.style || 'cinematic';
      const baseNegative = 'no text, no watermark, no caption, no subtitle, no logo, no blurry, no low resolution, no pixelated, no distorted, no artifacts, no compression noise, no extra limbs, no deformed hands, no malformed fingers, no extra fingers, no fused fingers';
      const styleNegative = style === 'cinematic' 
        ? 'no cartoon style, no flat lighting, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background, no brand logos with text, no text on posters, no text on billboards, no text on packaging, no handwritten text, no printed text, no signage text, no text overlays, no UI elements with text'
        : style === 'animation'
        ? 'no photorealistic, no live-action, no realistic textures, no film grain'
        : 'no cartoon style, no flat lighting, no text anywhere in frame';
      parts.push(`【负面约束】${baseNegative}; ${styleNegative}`);
    }

    // 【角色约束】⭐ 新增：防止多角色/分身
    const characterConstraint = getField('character_constraint', 'characterConstraint');
    if (characterConstraint) {
      parts.push(`【角色约束】${characterConstraint}`);
    } else if (shot.character && shot.character !== 'NONE') {
      // 兜底：根据角色名自动生成
      const charName = shot.character.name || shot.character;
      parts.push(`【角色约束】只出现${charName}一人，禁止其他人物入镜，禁止同一角色重复出现，禁止角色分身或克隆`);
    }

    // 【角色一致性】
    const consistencyField = getField('consistency');
    if (consistencyField) parts.push(`【角色一致性】${consistencyField}`);

    // 合并
    let fullPrompt = parts.join('，');
    
    // 截断
    if (this._countChars(fullPrompt) > this.maxPromptLength) {
      fullPrompt = this._truncateStandardPrompt(fullPrompt);
    }

    // 【v2.2.0】语言检查：检测英文输出并警告
    const chineseCharCount = (fullPrompt.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalCharCount = this._countChars(fullPrompt);
    const chineseRatio = chineseCharCount / totalCharCount;
    if (chineseRatio < 0.3 && totalCharCount > 500) {
      console.warn(`[PromptFusionAgent] ⚠️ 镜头 ${shot.shotId} 中文占比过低(${(chineseRatio * 100).toFixed(1)}%)，可能为英文输出`);
    }

    return fullPrompt;
  }

  /**
   * 组装完整Prompt（降级路径，保留原有逻辑）
   */
  _assembleFullPrompt(shot, fusionText, ratio) {
    const parts = [];

    // L1: 约束层
    // 【v2.1.4-fix9-P25】约束字段：画幅+分辨率+格式+帧率+禁止项
    parts.push(`Aspect ratio: ${ratio}, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background`);

    // L2: 基础层
    // 【v2.1.4-fix9-P25】基础字段：分辨率锚定+风格质量+细节增强
    parts.push('8K resolution, cinematic quality, highly detailed, photorealistic, intricate textures, sharp focus');

    // L3-L7: 融合段
    if (fusionText) {
      parts.push(fusionText);
    } else {
      // 【v2.1.4-fix9-P11】降级路径也强制写实场景和动作
      let sceneDesc = shot.scene || '';
      const sceneForbidden = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
      if (sceneForbidden.some(w => sceneDesc.includes(w))) {
        const fallbackScenes = [
          '医院健康宣教室，白色荧光灯均匀照明，白墙面贴有无文字骨骼肌解剖图与运动损伤海报（纯图形版），木质讲台表面带有细微使用划痕，地面浅灰色防滑PVC地胶',
          '三甲医院检验科走廊，冷白色LED光源从走廊顶部连续排列向下照射，无文字箭头标识牌指向尿液检验窗口，地面浅色抛光瓷砖，墙面白色医用抗菌涂层',
          '医生诊室，白色墙面悬挂无文字人体解剖示意图（纯图形版），办公桌摆放听诊器与血压计，检查床铺有蓝色一次性床单，无影灯悬于上方，窗光透入',
          '医院健康管理中心，嵌入式LED灯带洒下柔和暖白光，接待台后方排列无文字健康宣传展板（纯图形版），前方皮质沙发与实木茶几，地面灰色哑光瓷砖'
        ];
        const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
        sceneDesc = fallbackScenes[idx % fallbackScenes.length];
      }
      parts.push(sceneDesc);
      
      if (shot.character && shot.character !== 'NONE') parts.push(shot.character);
      
      let actionDesc = shot.action || '';
      const actionForbidden = ['全息', '虚拟', '投影', '空间扭曲', '时间残影', '霓虹', '数据流', '光即角色', '抽象构图', '梦境流动性', '手绘动画', '湿版摄影', '黑色电影'];
      if (actionForbidden.some(w => actionDesc.includes(w))) {
        const fallbackActions = [
          '镜头缓慢推近，示例角色站立讲台前，自然手势讲解，眼神注视镜头，警服在荧光灯下轮廓清晰',
          '稳定机位中景，示例角色沿走廊缓步前行，侧头指向检验窗口，白大褂医生从背景走过',
          '手持微晃跟拍，示例角色靠近检查床，手指轻触医学挂图，无影灯在头顶形成柔和光晕',
          '固定机位中景，示例角色坐于沙发边缘，双手交叠置于膝上，LED灯带在身后形成均匀轮廓光',
          '缓慢后拉全景，示例角色站立检验窗口前，转身面向镜头，不锈钢台面反射冷白色光源'
        ];
        const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
        actionDesc = fallbackActions[idx % fallbackActions.length];
      }
      if (actionDesc) parts.push(actionDesc);
      
      const pureDialogue = shot.dialogueText || this._extractPureDialogue(shot.dialogue);
      if (pureDialogue && pureDialogue !== '') parts.push(`"${pureDialogue}"`);
      if (shot.cameraString) parts.push(shot.cameraString);
      if (shot.lightingString) parts.push(shot.lightingString);
      if (shot.mood) parts.push(`mood: ${shot.mood}`);
      if (shot.backgroundSoundString) parts.push(`audio: ${shot.backgroundSoundString}`);
    }

    // L9: 质控层
    // 【v2.1.4-fix9-P14】全局禁止文字：详细负面约束覆盖所有可能含文字的位置
    parts.push('no voiceover, no narration, no metal_gloss, no unnatural_eye_color, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters');
    parts.push('no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background');
    parts.push('no brand logos with text, no text in medical charts, no text on posters, no text on billboards, no text on packaging, no handwritten text, no printed text, no signage text');
    parts.push('no text overlays, no UI elements with text, no text on book covers, no text on medicine bottles, no text on report forms, no text on devices, no text on badges, no text on nameplates');
    parts.push('no text on doors, no text on windows, no text on floors, no text on ceilings');

    let fullPrompt = parts.filter(p => p).join(', ');
    if (this._countChars(fullPrompt) > this.maxPromptLength) {
      fullPrompt = this._truncateWithPriority(fullPrompt, parts);
    }

    return fullPrompt;
  }

  /**
   * 【审计修复】按字段压缩而非整段砍除：保留全部25个【字段】标签，只压缩字段内文案
   */
  _truncateStandardPrompt(fullPrompt) {
    if (this._countChars(fullPrompt) <= this.maxPromptLength) return fullPrompt;
    // 按字段标签切分
    const segments = fullPrompt.split(/(?=【)/);
    if (segments.length <= 1) return fullPrompt.substring(0, this.maxPromptLength);
    // 计算每个字段当前字符数，等比压缩到目标长度
    const target = this.maxPromptLength;
    const totalNow = this._countChars(fullPrompt);
    const ratio = target / totalNow;
    const compressed = segments.map(seg => {
      const segLen = this._countChars(seg);
      const want = Math.max(40, Math.floor(segLen * ratio)); // 每字段至少保留40字符
      if (segLen <= want) return seg;
      // 保留字段标签头，截断内容
      const headMatch = seg.match(/^(【[^】]+】)/);
      const head = headMatch ? headMatch[1] : '';
      const body = seg.slice(head.length);
      let kept = body;
      while (this._countChars(head + kept) > want && kept.length > 20) {
        kept = kept.substring(0, kept.length - 10);
      }
      return head + kept;
    });
    return compressed.join('').trim();
  }

  _truncateWithPriority(fullPrompt, parts) {
    // 复用相同的按字段压缩逻辑
    return this._truncateStandardPrompt(fullPrompt);
  }

  _countChars(str) {
    // 【P2-13 修复】使用真实字符数，中文不再按1.5计
    return str ? String(str).length : 0;
  }

  _extractPureDialogue(dialogue) {
    if (!dialogue || typeof dialogue !== 'string') return dialogue;
    const parts = dialogue.split(/[|;]/);
    if (parts.length >= 5) {
      return parts[3].trim();
    }
    return dialogue.trim();
  }

  /**
   * 【v2.1.6】将 DIALOGUE_BLOCK 数组渲染为 Seedance 2.0 内联对话格式
   * 格式：【台词】[时间戳] 角色 trigger, emotion 说："line"
   */
  _renderDialogueBlocks(blocks, duration) {
    if (!blocks || blocks.length === 0) return '';
    
    const lines = [];
    const segmentDuration = duration / blocks.length;
    
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const startTime = Math.round(i * segmentDuration);
      const endTime = Math.round((i + 1) * segmentDuration);
      const timeStr = `[${String(startTime).padStart(2, '0')}s-${String(endTime).padStart(2, '0')}s]`;
      
      // 构建内联格式
      const trigger = b.trigger || 'looks at camera';
      const emotion = b.emotion || 'neutral';
      const line = b.line || '';
      const speaker = b.speaker || '角色';
      
      // Seedance 2.0 格式：时间戳 + 动作触发 + 情绪副词 + 说："台词"
      lines.push(`${timeStr} ${speaker} ${trigger}, ${emotion} 说："${line}"`);
    }
    
    return '【台词】' + lines.join('\n');
  }

  _buildBatchPrompt(shots, ratio, characters) {
    const characterInfo = characters.map(c => `- ${c.name}: ${c.description || ''}`).join('\n');

    const shotsInfo = shots.map(s => {
      const pureDialogue = s.dialogue?.lines?.map(l => l.content).join('; ') || 
                          (s.dialogue ? this._extractPureDialogue(s.dialogue) : '');
      return `${s.shotId}(${s.duration || '?'}s): ${s.scene || ''} | ${s.mood || ''} | ${pureDialogue} | 运镜:${s.cameraString || ''} | 灯光:${s.lightingString || ''}`;
    }).join('\n');
    
    // 【v2.1.4-fix9-P1】构建导演上下文
    const directorContext = this._buildDirectorContext(shots);

    const sufficiency = [
      '【字段最低字符数 - 硬性要求，不达标会被打回重写】',
      ' scene ≥ 120 | lighting ≥ 150 | composition ≥ 100 | action ≥ 120',
      ' camera_movement ≥ 100 | timeline ≥ 200 | director_instruction ≥ 80',
      ' color_palette ≥ 80 | depth_of_field ≥ 80 | audio ≥ 100',
      ' 其余字段 ≥ 40 字符',
      ' 全部 25 个字段必须全部输出，禁止省略任何一个。',
      '',
      '【字段内容规范 - 必须包含的子要素】',
      ' director_instruction: 风格定位(电影/纪录片/广告风格) + 写实要求(真实感/无特效) + 情绪基调(冷静/紧张/温馨等)',
      ' constraint: 画幅比例(16:9/9:16) + 分辨率(1920x1080/4K) + 格式(MP4/MOV) + 帧率(24fps/30fps)',
      ' lighting: 主光描述(位置/方向) + 色温参数(5600K/3200K等) + 光质定义(柔光/硬光/漫射)',
      ' camera_movement: 运动方式(推/拉/摇/移/跟) + 速度参数(慢速/快速) + 时间分布(0-3s/3-6s等)',
      ' negative: 必须包含 "no text" 和 "no watermark" 两项基础排除',
      ' composition: 景别等级(远景/全景/中景/近景/特写) + 主体位置(三分法/中心/对称)',
      ' bright_constraint: 亮度要求 + 可见性 + 面部明亮(避免面部阴影)',
      ' 每个字段内容必须体现上述子要素，缺失会被标记为不合格。'
    ].join('\n');

    return `${directorContext}
画幅:${ratio}
角色:${characterInfo || '无'}
镜头:\n${shotsInfo}

${sufficiency}

任务:为每个镜头生成标准字段格式的导演分镜提示词。

【角色服装锁定 - 强制不可修改】
角色服装必须与角色设定完全一致，禁止根据场景修改：
- 正确："示例角色女士，穿警服的陈女士，健康科普主讲人，短发，站姿挺拔"
- 错误："白色医生服"、"白大褂"、"浅蓝色衬衫"（禁止根据场景更换服装）
【角色】字段必须严格使用角色设定中的原始服装描述，不可自由发挥。

【动作写实锁定 - 强制不可修改】
【动作】字段必须是真实物理动作和镜头运动，严禁使用任何科幻/抽象/超现实词汇：
- 正确："镜头缓慢推近，示例角色站立讲台前，自然手势讲解"
- 错误："全息投影"、"空间扭曲"、"时间残影"、"霓虹色数据流"、"抽象构图"、"梦境流动性"、"湿版摄影"、"光即角色"
- 正确运镜：推近、跟拍、手持、稳定器、缓慢后拉、固定机位
- 错误运镜：无人机穿越微观世界、时间操控慢动作、宏大比例展示

要求：
1. 【语言约束 - 强制】所有字段内容必须使用中文输出，禁止出现英文（技术参数如8K/MP4/24fps/5600K等除外）。mood字段可用英文单词（如tense/epic）。
2. 按标准字段输出：【约束】【基础】【场景】【灯光/照明】【构图】【色彩/色调】【景深】【运镜】【角色】【服装】【化妆】【动作】【道具】【定妆照】【台词】【时间轴】【情绪】【节奏】【转场】【音频】【负面约束】【明亮约束】【角色约束】【导演指令】【角色一致性】
3. 【台词】字段必须独立，角色直接对镜头说话，不要写"画外音""旁白"
3. 场景要具体专业（门诊室、宣教室、检查室），不要写"社区健身区"。场景中不得出现含文字的物品：如"有文字的报告单"、"标牌上的文字"、"商标"、"有字的海报"等。可以描述"空白报告单"、"无文字标识牌"、"图形海报"等不含文字的物品
4. 负面约束要完整，包含10+条排除项，必须包含全局禁止文字：no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls objects documents signs labels screens clothing packaging, no handwritten text, no printed text, no signage text, no text overlays, no UI elements with text
5. 只输出JSON，不要解释

输出:{"shots":[{"shotId":"SC01","fields":{...}}]}`;
  }
  
  /**
   * 【v2.1.4-fix9-P1】构建导演上下文
   */
  _buildDirectorContext(shots) {
    // 从第一个 shot 的 blueprint 引用中提取上下文
    const firstShot = shots[0];
    const blueprint = firstShot?._blueprint || {};
    const config = blueprint.config || {};
    
    const title = blueprint.title || config.title || '未命名';
    const contentTheme = config.content_theme || '';
    const sceneRequirement = config.scene_requirement || '';
    const characterDescription = config.character_description || '';
    const forbiddenScenes = config.forbidden_scenes || [];
    const keyMessages = config.key_messages || [];
    
    return `## 🎬 导演指令上下文
视频标题：${title}
内容主题：${contentTheme}
场景要求：${sceneRequirement}
角色设定：${characterDescription}
关键信息：${keyMessages.join('；') || '无'}
禁止场景：${forbiddenScenes.join('、') || '无'}

`;
  }

  _fallbackBatch(shots, ratio) {
    console.log(`[PromptFusionAgent] 批量降级...`);
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        fields: {}
      }))
    };
  }

  /**
   * 【审计修复】多名字段解析：支持多种命名风格读取同一字段
   * 解决 Phase 2 输出的 camera/cameraMovement/cameraString 等字段
   * PromptFusion 只认 camera_movement 的问题
   */
  _resolveField(shot, ...names) {
    for (const name of names) {
      if (shot[name] !== undefined && shot[name] !== null && shot[name] !== '') {
        return shot[name];
      }
    }
    return undefined;
  }
}

module.exports = { PromptFusionAgent };