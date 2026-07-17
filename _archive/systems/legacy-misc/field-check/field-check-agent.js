/**
 * FieldCheckAgent v6.7.0 — 字段内容检查环节
 * 双层检查：规则引擎（80%确定性问题） + LLM语义层（20%语义一致性）
 */

const { Priority, Severity, IssueType, SPEC_MAP, MAX_TOTAL_CHARS } = require('./field-specs');

// ============================================================
// 数据模型
// ============================================================

class Issue {
  constructor({ field_en, field_cn, severity, issue_type, description, suggestion, current_value = '' }) {
    this.field_en = field_en;
    this.field_cn = field_cn;
    this.severity = severity;
    this.issue_type = issue_type;
    this.description = description;
    this.suggestion = suggestion;
    this.current_value = current_value;
  }
}

class CheckReport {
  constructor(shot_id) {
    this.shot_id = shot_id;
    this.issues = [];
    this.passed = false;
  }

  add(issue) { this.issues.push(issue); }

  get fatal_count() { return this.issues.filter(i => i.severity === 'FATAL').length; }
  get major_count() { return this.issues.filter(i => i.severity === 'MAJOR').length; }
  get minor_count() { return this.issues.filter(i => i.severity === 'MINOR').length; }

  summary() {
    return `检查结果：${this.passed ? '✅ 通过' : '❌ 未通过'} | 致命 ${this.fatal_count} · 严重 ${this.major_count} · 轻微 ${this.minor_count} · 共 ${this.issues.length} 项问题`;
  }
}

// ============================================================
// RuleChecker — 规则引擎层
// ============================================================

class RuleChecker {
  constructor(options = {}) {
    this.log = options.log || console.log;
    this.mode = options.mode || 'nirath'; // P1-4-fix: 模式感知
    this.SHOT_SIZE_PATTERNS = [
      /extreme long shot/i, /establishing shot/i, /long shot/i, /full shot/i,
      /medium shot/i, /close-?up/i, /extreme close-?up/i, /wide shot/i,
      /远景/i, /全景/i, /中景/i, /近景/i, /特写/i
    ];
    this.POSITION_PATTERNS = [
      /third/i, /center/i, /symmetr/i, /左侧/i, /右侧/i, /居中/i, /对称/i,
      /positioned at/i, /aligned to/i
    ];
    this.TRANSITION_PATTERNS = [
      /hard cut/i, /fade in/i, /fade out/i, /dissolve/i, /wipe/i, /zoom/i,
      /切镜/i, /淡入/i, /淡出/i, /叠化/i, /划像/i
    ];
  }

  // P1-4-fix: 模式感知——generic模式下FATAL降级为MAJOR
  _severity(defaultSeverity) {
    if (this.mode === 'generic' && defaultSeverity === 'FATAL') return 'MAJOR';
    return defaultSeverity;
  }

  check(shot) {
    const issues = [];
    issues.push(...this._checkCompleteness(shot));
    issues.push(...this._checkFormat(shot));
    issues.push(...this._checkStructure(shot));
    issues.push(...this._checkLength(shot));
    return issues;
  }

  _checkCompleteness(shot) {
    const issues = [];
    for (const spec of Object.values(SPEC_MAP)) {
      if (!spec.required) continue;
      const value = shot[spec.name_en] || '';
      if (!value || (typeof value === 'string' && !value.trim())) {
        const sev = spec.priority === 'P0' ? 'FATAL' : 'MAJOR';
        issues.push(new Issue({
          field_en: spec.name_en,
          field_cn: spec.name_cn,
          severity: sev,
          issue_type: 'MISSING',
          description: `${spec.priority} 字段【${spec.name_cn}】缺失`,
          suggestion: `请补充【${spec.name_cn}】字段内容，参考规范文档`
        }));
      }
    }
    return issues;
  }

  _checkFormat(shot) {
    const issues = [];

    // 导演指令：风格定位 + 写实要求 + 情绪基调
    const di = shot.director_instruction || '';
    if (di) {
      const diLower = di.toLowerCase();
      const hasStyle = /(质感|风格|纪录片|电影|广告|cinematic|documentary|realistic|photorealistic|hollywood)/i.test(diLower);
      const hasRealism = /(写实|无特效|无科幻|realistic|no effect|no sci)/i.test(diLower);
      const hasMood = /(基调|氛围|情绪|冷静|紧张|温馨|tone|mood|atmosphere|professional|intense|warm)/i.test(diLower);
      const missing = [];
      if (!hasStyle) missing.push('风格定位');
      if (!hasRealism) missing.push('写实要求');
      if (!hasMood) missing.push('情绪基调');
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'director_instruction', field_cn: '导演指令',
          severity: this._severity('FATAL'), issue_type: 'INCOMPLETE',
          description: `导演指令缺少要素：${missing.join('、')}`,
          suggestion: '导演指令须覆盖四要素（风格定位+写实要求+情绪基调+技术方向）',
          current_value: di.slice(0, 60)
        }));
      }
    }

    // 约束：画幅 + 分辨率 + 格式 + 帧率
    const cs = shot.constraint || '';
    if (cs) {
      const csLower = cs.toLowerCase();
      const missing = [];
      if (!/(aspect ratio|画幅|16:9|9:16)/i.test(csLower)) missing.push('画幅比例');
      if (!/(resolution|分辨率|1920|1080|4k|8k)/i.test(csLower)) missing.push('分辨率');
      if (!/(format|格式|mp4|mov)/i.test(csLower)) missing.push('输出格式');
      if (!/(frame rate|帧率|fps|24fps|30fps)/i.test(csLower)) missing.push('帧率');
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'constraint', field_cn: '约束',
          severity: this._severity('FATAL'), issue_type: 'INCOMPLETE',
          description: `约束字段缺少技术参数：${missing.join('、')}`,
          suggestion: '约束须包含画幅+分辨率+格式+帧率',
          current_value: cs.slice(0, 60)
        }));
      }
    }

    // 灯光：主光 + 色温 + 光质
    const lt = shot.lighting || '';
    if (lt) {
      const ltLower = lt.toLowerCase();
      const missing = [];
      if (!/(key light|主光|主光源)/i.test(ltLower)) missing.push('主光描述');
      if (!/\d{3,4}k|色温|color temperature|warm|cool|daylight|tungsten/i.test(ltLower)) missing.push('色温参数');
      if (!/(soft|hard|diffus|柔光|硬光|漫射)/i.test(ltLower)) missing.push('光质定义');
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'lighting', field_cn: '灯光',
          severity: this._severity('FATAL'), issue_type: 'INCOMPLETE',
          description: `灯光字段缺少要素：${missing.join('、')}`,
          suggestion: '灯光须含主光+色温+光质三要素',
          current_value: lt.slice(0, 60)
        }));
      }
    }

    // 运镜：运动方式 + 速度 + 时间分布
    const cm = shot.camera_movement || '';
    if (cm) {
      const cmLower = cm.toLowerCase();
      const missing = [];
      const hasMove = /(push|pull|pan|track|follow|crane|orbit|推|拉|摇|移|跟|升|降|环绕)/i.test(cmLower);
      const hasSpeed = /\d+\.?\d*\s*m\/s|\d+\.?\d*\s*°/s|slow|fast|medium|慢速|快速/i.test(cmLower);
      const hasTime = /duration|秒|second|\d+s|starting|ending/i.test(cmLower);
      if (!hasMove) missing.push('运动方式');
      if (!hasSpeed) missing.push('速度参数');
      if (!hasTime) missing.push('时间分布');
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'camera_movement', field_cn: '运镜',
          severity: this._severity('FATAL'), issue_type: 'INCOMPLETE',
          description: `运镜字段缺少要素：${missing.join('、')}`,
          suggestion: '运镜须含运动方式+速度+时间分布',
          current_value: cm.slice(0, 60)
        }));
      }
    }

    // 负面约束：须含 no text + no watermark
    const ng = shot.negative || '';
    if (ng) {
      const ngLower = ng.toLowerCase();
      if (!ngLower.includes('no text') || !ngLower.includes('no watermark')) {
        issues.push(new Issue({
          field_en: 'negative', field_cn: '负面约束',
          severity: this._severity('FATAL'), issue_type: 'INCOMPLETE',
          description: '负面约束缺少基础排除项：no text 和 no watermark',
          suggestion: '负面约束必须包含 no text, no watermark 两项基础排除',
          current_value: ng.slice(0, 60)
        }));
      }
    }

    // 构图：景别 + 主体位置
    const comp = shot.composition || '';
    if (comp) {
      const compLower = comp.toLowerCase();
      const hasSize = this.SHOT_SIZE_PATTERNS.some(p => p.test(compLower));
      const hasPos = this.POSITION_PATTERNS.some(p => p.test(compLower));
      const missing = [];
      if (!hasSize) missing.push('景别等级');
      if (!hasPos) missing.push('主体位置');
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'composition', field_cn: '构图',
          severity: 'MAJOR', issue_type: 'INCOMPLETE',
          description: `构图字段缺少要素：${missing.join('、')}`,
          suggestion: '构图须含景别（远景/全景/中景/近景/特写）+ 主体位置',
          current_value: comp.slice(0, 60)
        }));
      }
    }

    // 明亮约束：亮度 + 可见性 + 面部明亮
    const bc = shot.bright_constraint || '';
    if (bc) {
      const bcLower = bc.toLowerCase();
      const missing = [];
      if (!/(bright|well-lit|明亮|光线充足)/i.test(bcLower)) missing.push('亮度要求');
      if (!/(visibility|visible|clear|可见|清晰)/i.test(bcLower)) missing.push('可见性');
      if (!/(face|面部|facial|no dark shadow)/i.test(bcLower)) missing.push('面部明亮');
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'bright_constraint', field_cn: '明亮约束',
          severity: 'MAJOR', issue_type: 'INCOMPLETE',
          description: `明亮约束缺少要素：${missing.join('、')}`,
          suggestion: '明亮约束须含亮度+可见性+面部明亮',
          current_value: bc.slice(0, 60)
        }));
      }
    }

    // 角色约束：单角色限制 + 禁止分身
    const cc = shot.character_constraint || '';
    if (cc) {
      const hasSingle = /只出现|仅出现|single character|only.*one/i.test(cc.toLowerCase());
      const hasNoClone = /分身|克隆|duplicate|clone|repeat/i.test(cc.toLowerCase());
      const missing = [];
      if (!hasSingle) missing.push('单角色限制');
      if (!hasNoClone) missing.push('禁止分身声明');
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'character_constraint', field_cn: '角色约束',
          severity: 'MAJOR', issue_type: 'INCOMPLETE',
          description: `角色约束缺少要素：${missing.join('、')}`,
          suggestion: '角色约束须含单角色限制+禁止分身',
          current_value: cc.slice(0, 60)
        }));
      }
    }

    // 定妆照路径格式
    const pt = shot.portraits || '';
    if (pt && !/\/characters\/[\w_]+\/portrait_v\d+\.(png|jpg)/i.test(pt)) {
      issues.push(new Issue({
        field_en: 'portraits', field_cn: '定妆照',
        severity: this._severity('FATAL'), issue_type: 'FORMAT_ERROR',
        description: `定妆照路径格式不规范：${pt.slice(0, 40)}`,
        suggestion: '路径格式应为：/characters/{角色英文名}/portrait_v{版本号}.{png|jpg}',
        current_value: pt.slice(0, 40)
      }));
    }

    // 台词：句末标点 + 禁止标点
    const dl = shot.dialogue || '';
    if (dl) {
      if (!/[。！？…]$/.test(dl)) {
        issues.push(new Issue({
          field_en: 'dialogue', field_cn: '台词',
          severity: this._severity('FATAL'), issue_type: 'FORMAT_ERROR',
          description: '台词缺少句末标点（须以 。！？… 结尾）',
          suggestion: '句末标点是口型闭合的信号标记，不可省略',
          current_value: dl.slice(0, 60)
        }));
      }
      const forbidden = dl.match(/[；;：:""''\[\]【】]/g);
      if (forbidden) {
        issues.push(new Issue({
          field_en: 'dialogue', field_cn: '台词',
          severity: 'MAJOR', issue_type: 'FORMAT_ERROR',
          description: `台词含禁止标点：${[...new Set(forbidden)].join('')}`,
          suggestion: '移除分号、冒号、引号等复杂标点，仅保留 ，。！？…',
          current_value: dl.slice(0, 60)
        }));
      }
    }

    // 转场：须含明确类型
    const tr = shot.transition || '';
    if (tr && !this.TRANSITION_PATTERNS.some(p => p.test(tr.toLowerCase()))) {
      issues.push(new Issue({
        field_en: 'transition', field_cn: '转场',
        severity: 'MINOR', issue_type: 'INCOMPLETE',
        description: '转场字段未指定明确转场类型',
        suggestion: '须指定具体转场类型（hard cut/fade in/fade out/dissolve/wipe）',
        current_value: tr.slice(0, 40)
      }));
    }

    return issues;
  }

  _checkStructure(shot) {
    const issues = [];

    // 时间轴：≥3段
    const tl = shot.timeline || '';
    if (tl) {
      const segments = tl.match(/T\d{2}:\d{2}/g) || [];
      if (segments.length < 3) {
        issues.push(new Issue({
          field_en: 'timeline', field_cn: '时间轴',
          severity: 'MAJOR', issue_type: 'INCOMPLETE',
          description: `时间轴分段数不足：当前 ${segments.length} 段，要求 ≥ 3 段`,
          suggestion: '时间轴须至少分为起始、发展、收尾 3 段',
          current_value: tl.slice(0, 60)
        }));
      }
    }

    // 节奏：五段式
    const pa = shot.pacing || '';
    if (pa) {
      const paLower = pa.toLowerCase();
      const requiredSegs = ['整体', '开头', '中段', '高潮', '结尾'];
      const hasOverall = paLower.includes('overall') || paLower.includes('整体');
      const missing = hasOverall ? [] : requiredSegs.filter(s => !pa.includes(s));
      if (missing.length > 0) {
        issues.push(new Issue({
          field_en: 'pacing', field_cn: '节奏',
          severity: 'MINOR', issue_type: 'INCOMPLETE',
          description: `节奏字段缺少段落：${missing.join('、')}`,
          suggestion: '节奏须采用五段式：整体+开头+中段+高潮+结尾',
          current_value: pa.slice(0, 60)
        }));
      }
    }

    // 服装：至少含外套/内搭/下装/鞋履中3项
    const cos = shot.costume || '';
    if (cos) {
      const cosLower = cos.toLowerCase();
      const categories = {
        '外套/上装': ['coat', 'jacket', 'suit', 'shirt', 'overcoat', '外套', '西装', '上衣'],
        '内搭': ['shirt', 'blouse', '内搭', '衬衫'],
        '下装': ['trousers', 'pants', 'skirt', '裤', '裙'],
        '鞋履': ['shoes', 'footwear', '鞋']
      };
      let found = 0;
      for (const keywords of Object.values(categories)) {
        if (keywords.some(k => cosLower.includes(k))) found++;
      }
      if (found < 3) {
        issues.push(new Issue({
          field_en: 'costume', field_cn: '服装',
          severity: 'MINOR', issue_type: 'INCOMPLETE',
          description: `服装字段层次不足：当前覆盖 ${found}/4 项`,
          suggestion: '服装须采用分层描述，至少覆盖外套/内搭/下装/鞋履中的3项',
          current_value: cos.slice(0, 60)
        }));
      }
    }

    return issues;
  }

  _checkLength(shot) {
    const issues = [];

    // 单字段字符数
    for (const spec of Object.values(SPEC_MAP)) {
      if (spec.char_max >= 9999) continue;
      const value = shot[spec.name_en] || '';
      if (!value) continue;
      const length = value.length;
      if (length > spec.char_max) {
        const sev = spec.priority === 'P0' || spec.priority === 'P1' ? 'MAJOR' : 'MINOR';
        issues.push(new Issue({
          field_en: spec.name_en, field_cn: spec.name_cn,
          severity: sev, issue_type: 'OVER_LENGTH',
          description: `字段超长：${length} 字符，超出预算上限 ${spec.char_max}`,
          suggestion: `请压缩【${spec.name_cn}】字段至 ${spec.char_max} 字符以内`,
          current_value: `${value.slice(0, 40)}...(${length}字符)`
        }));
      }
    }

    // 总字符数
    const total = Object.values(shot).reduce((sum, v) => sum + (typeof v === 'string' ? v.length : 0), 0);
    if (total > MAX_TOTAL_CHARS) {
      issues.push(new Issue({
        field_en: '_total', field_cn: '总长度',
        severity: 'MAJOR', issue_type: 'OVER_LENGTH',
        description: `提示词总字符数超限：${total} 字符，上限 ${MAX_TOTAL_CHARS}`,
        suggestion: '请执行六步截断策略：①去冗余 ②裁P3 ③裁P2 ④压P1局部 ⑤压P0局部 ⑥超限报警'
      }));
    }

    return issues;
  }
}

// ============================================================
// LLMChecker — LLM语义检查层
// ============================================================

const LLM_SYSTEM_PROMPT = `你是一个 AI 视频生成提示词的质量审核专家，精通 HyperrealitySystem 字段规范 v3.0。

你的任务是对镜头提示词进行【语义一致性检查】，重点关注规则引擎无法覆盖的跨字段语义问题：

1. 导演指令与情绪/色彩字段是否风格一致
2. 台词与动作是否语义自洽
3. 场景描述与灯光描述是否冲突
4. 负面约束与正面描述是否矛盾
5. 角色描述与角色一致性是否匹配
6. 时间轴与运镜/动作的时间分布是否对齐

返回JSON格式：
{
  "issues": [
    {
      "field_en": "字段英文名",
      "field_cn": "字段中文名",
      "severity": "fatal|major|minor",
      "issue_type": "inconsistent|conflict",
      "description": "问题描述",
      "suggestion": "具体修改建议"
    }
  ]
}

只报告确实存在的语义问题，如果语义检查全部通过，返回 {"issues": []}。`;

class LLMChecker {
  constructor(options = {}) {
    this.llm = options.llm;
    this.log = options.log || console.log;
  }

  async check(shot) {
    const shotJson = JSON.stringify(shot, null, 2);
    const userPrompt = `请对以下镜头提示词进行语义一致性检查：\n\n${shotJson}`;

    try {
      const response = await this.llm.chat(LLM_SYSTEM_PROMPT, userPrompt, 0.2);
      const data = JSON.parse(response);
      return (data.issues || []).map(item => new Issue({
        field_en: item.field_en || '',
        field_cn: item.field_cn || '',
        severity: item.severity || 'minor',
        issue_type: item.issue_type || 'INCONSISTENT',
        description: item.description || '',
        suggestion: item.suggestion || ''
      }));
    } catch (e) {
      this.log('LLM-CHECKER', `  ⚠️ LLM语义检查失败: ${e.message}`);
      return [];
    }
  }
}

// ============================================================
// FieldCheckAgent — 检查环节编排
// ============================================================

class FieldCheckAgent {
  constructor(options = {}) {
    this.ruleChecker = new RuleChecker(options);
    this.llmChecker = options.llm ? new LLMChecker(options) : null;
  }

  async check(shot, shotId = 'shot_001') {
    const report = new CheckReport(shotId);

    // 第一层：规则检查
    const ruleIssues = this.ruleChecker.check(shot);
    ruleIssues.forEach(i => report.add(i));

    // 第二层：LLM语义检查
    if (this.llmChecker) {
      const llmIssues = await this.llmChecker.check(shot);
      llmIssues.forEach(i => report.add(i));
    }

    // 判定：无fatal且无major则通过
    report.passed = report.fatal_count === 0 && report.major_count === 0;

    return report;
  }
}

module.exports = { FieldCheckAgent, RuleChecker, LLMChecker, CheckReport, Issue };
