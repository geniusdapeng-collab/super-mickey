'use strict';

/**
 * ProductTruthChecker（产品调研与事实校验闸机）
 * ------------------------------------------------------------
 * 【v2.9.0 新增】社媒营销包 · 事实真实性基线
 * 【v2.10.0 改造】调研维度开放化：通用底座+品类扩展包+自定义并集，支持任意商品与服务类型
 *
 * 定位：Brief 确认之后、业务需求洞察之前的阻断式环节。
 * 营销片的头号翻车头风险不是极限词，而是"创意前提与产品真实能力矛盾"
 * （例：把"必须绑定手机使用"的产品拍成"脱离手机独立使用"）。
 * 合规闸机只查极限词，查不出前提级虚构——本环节补齐这一层。
 *
 * 三段式（与商品定妆照分支同构的 spec 模式）：
 *
 *   阶段1 research        调研任务清单（spec），由执行方（LLM Agent）联网调研
 *      - 必须覆盖品类预设维度：3C穿戴类必查 绑定/App依赖/联网/账号生态/离线边界
 *      - 信源优先级：官网/官方社媒/官方旗舰店 > 权威媒体 > 第三方评测
 *      - 产出调研记录 researchNotes 回填
 *
 *   阶段2 fact-baseline   产品事实基线（结构化）
 *      - capabilities    能力清单，每项必须标注前提条件（如"扫码付款·需绑定手机端支付宝"）
 *      - prerequisites   使用前提（绑定手机/App/联网/账号体系）
 *      - boundaries      能力边界与离线可用范围
 *      - officialClaims  官方宣传口径（宣称不得超出官方口径）
 *      - forbiddenClaims 禁用宣称清单（与事实矛盾的说法，如"无需手机独立使用"）
 *
 *   阶段3 creative-gate   创意前提冲突检查（阻断式）
 *      - 把创意核心前提逐条对照事实基线
 *      - 命中禁用宣称/前提矛盾 → conflicts 非空 → 阻断，业务洞察与 PRD 禁止开始
 *
 * PRD 融合点：verify() 输出 factRedLines（事实红线），
 * PRD 生成器必须原样继承进"制作约束"章节，镜头设计层不得突破。
 */

/**
 * 品类调研维度（v2.10.0 开放化改造）
 * ------------------------------------------------------------
 * 三层开放结构，禁止把维度写成单一品类（如 3C 硬件）的硬编码：
 *
 *   层1 UNIVERSAL_DIMENSIONS  通用底座——任何商品/服务必查，与品类无关
 *   层2 CATEGORY_PACKS        品类扩展包——关键词模糊归类（非枚举校验），
 *                              一个品类可命中多个包，维度取并集
 *   层3 brief.customDimensions Brief 自定义维度——执行方/用户按商品特性补充
 *
 * 品类未命中任何扩展包时：用通用底座 + 引导执行方补充自定义维度，
 * 禁止静默降级为弱调研。
 */

/** 通用底座：任何商品或服务的事实校验都绕不开的四个问题 */
const UNIVERSAL_DIMENSIONS = [
  '使用前提与依赖条件',   // 用它之前必须先具备什么（设备/账号/预约/资质/门店……）
  '能力/效果边界',        // 它做不到什么、什么情况下打折扣
  '官方宣传口径',         // 官方怎么说的，宣称上限在哪
  '价格与购买履约方式'    // 怎么买、怎么交付、履约链路是什么
];

/** 品类扩展包：match 为归类正则（模糊匹配，非枚举），dims 为该品类追加的必查维度 */
const CATEGORY_PACKS = {
  hardware: {
    match: /3C|数码|硬件|穿戴|家电|电子|设备|智能|眼镜|耳机|手机|平板|手表/,
    dims: ['绑定/App依赖', '联网依赖', '账号生态依赖', '离线能力边界', '续航与充电方式', '兼容机型/系统']
  },
  software: {
    match: /软件|SaaS|APP|App|应用|平台|系统|工具|办公|云|AI助手/,
    dims: ['平台与终端兼容', '账号体系与数据归属', '数据安全与隐私', '免费/付费功能边界', '更新与服务政策']
  },
  food: {
    match: /食品|零食|饮料|饮品|保健|餐饮|茶|咖啡|酒/,
    dims: ['配料与致敏原', '保质期与储存', '生产资质', '食用方法与禁忌人群']
  },
  beauty: {
    match: /美妆|护肤|化妆|洗护|面膜|精华|防晒/,
    dims: ['肤质适配', '功效依据（备案/临床）', '禁用人群', '使用方法与频次']
  },
  apparel: {
    match: /服饰|服装|鞋|箱包|配饰|家居|家纺|家具|床品/,
    dims: ['尺码与版型', '材质与工艺', '洗护与保养', '售后退换规则']
  },
  service: {
    match: /服务|课程|培训|咨询|旅游|本地生活|到店|家政|维修|金融|保险|医疗|医美|健身|教育/,
    dims: ['履约流程与周期', '资质凭证与从业资格', '效果边界与免责条款', '退款与售后规则', '覆盖范围（门店/城市/线上）']
  }
};

/** 向后兼容：旧扁平表（已废弃，保留导出防外部引用断裂） */
const CATEGORY_DIMENSIONS = {
  '3C': CATEGORY_PACKS.hardware.dims,
  '3C-穿戴': CATEGORY_PACKS.hardware.dims,
  '美妆': CATEGORY_PACKS.beauty.dims,
  '食品': CATEGORY_PACKS.food.dims,
  '其他': ['使用前提', '能力边界', '官方口径']
};

class ProductTruthChecker {
  /**
   * 品类维度解析：通用底座 + 命中的品类扩展包并集 + Brief 自定义维度
   * @param {string} category 品类（任意文本，模糊归类，不做枚举校验）
   * @param {string[]} [customDims] Brief 自定义维度
   * @returns {{dimensions:string[], packs:string[], needCustomSuggest:boolean}}
   */
  resolveDimensions(category = '', customDims = []) {
    const packs = [];
    const dims = [...UNIVERSAL_DIMENSIONS];
    for (const [key, pack] of Object.entries(CATEGORY_PACKS)) {
      if (pack.match.test(category)) {
        packs.push(key);
        for (const d of pack.dims) if (!dims.includes(d)) dims.push(d);
      }
    }
    for (const d of (Array.isArray(customDims) ? customDims : [])) {
      if (d && !dims.includes(d)) dims.push(d);
    }
    // 未命中扩展包且未提供自定义维度：标记需要执行方按商品特性补充
    const needCustomSuggest = packs.length === 0 && (!customDims || customDims.length === 0);
    return { dimensions: dims, packs, needCustomSuggest };
  }

  /**
   * 阶段1：生成调研任务清单（spec 模式，执行方联网调研后回填 researchNotes）
   * @param {object} brief 规范化后的营销 Brief（category 任意值，支持 customDimensions）
   * @returns {object} 调研任务
   */
  buildResearchTask(brief = {}) {
    const { dimensions, packs, needCustomSuggest } = this.resolveDimensions(brief.category || '', brief.customDimensions);
    const product = brief.product || '商品';
    const requirements = [
      '每个维度至少一条可溯源事实，禁止凭印象填写',
      '使用前提与依赖条件为必查项，缺失即视为调研未完成',
      '官方宣传口径原文摘录，宣称不得二次放大',
      '调研记录须标注信源'
    ];
    if (needCustomSuggest) {
      requirements.push(`品类"${brief.category || '未填'}"未命中预设扩展包：执行方必须按商品特性补充 2-4 个自定义调研维度（如资质/履约/兼容/效果边界），禁止只做通用底座调研`);
    }
    return {
      stage: 'research',
      executor: 'llm-agent',
      product,
      matchedPacks: packs.length ? packs : ['universal'],
      dimensions,
      needCustomSuggest,
      queries: [
        `${product} 官方 使用前提 条件`,
        `${product} 功能 效果 官方口径`,
        `${product} 能否独立使用 限制 边界`,
        `${product} 官方社媒 宣传 场景`,
        `${product} 价格 购买 履约 退款`
      ],
      sourcePriority: ['官网/官方社媒', '官方旗舰店/官方客服', '权威媒体实测', '第三方评测'],
      requirements,
      researchNotes: [], // 执行后回填：[{ dimension, fact, source }]
      status: 'pending'
    };
  }

  /**
   * 阶段2+3：事实基线构建与创意冲突检查（阻断式）
   * @param {object} input
   * @param {object} input.brief       规范化 Brief
   * @param {Array}  input.researchNotes 调研记录 [{dimension, fact, source}]
   * @param {object} input.creative    创意前提 {premise, hooks, scenes}（创意主题生成产物）
   * @returns {{pass:boolean, factBaseline:object, conflicts:Array, factRedLines:string[], issues:string[]}}
   */
  verify(input = {}) {
    const { brief = {}, researchNotes = [], creative = {} } = input;
    const issues = [];
    const conflicts = [];

    // ---- 调研完整性闸机（维度来自开放解析，与品类无关） ----
    const { dimensions: requiredDims } = this.resolveDimensions(brief.category || '', brief.customDimensions);
    const coveredDims = new Set(researchNotes.map(n => n.dimension));
    const missingDims = requiredDims.filter(d => !coveredDims.has(d));
    if (!Array.isArray(researchNotes) || researchNotes.length === 0) {
      issues.push('调研记录为空：产品事实校验未执行，禁止进入业务需求洞察');
    }
    for (const d of missingDims) {
      issues.push(`调研维度缺失：${d}`);
    }
    const noSource = researchNotes.filter(n => !n.source);
    if (noSource.length > 0) {
      issues.push(`${noSource.length} 条调研记录缺信源标注`);
    }

    // ---- 事实基线构建 ----
    const factBaseline = this._buildBaseline(brief, researchNotes);

    // ---- 创意前提冲突检查 ----
    if (creative && (creative.premise || creative.hooks || creative.scenes)) {
      conflicts.push(...this._checkCreative(creative, factBaseline));
    }

    // ---- PRD 事实红线（制作约束章节必须原样继承） ----
    const factRedLines = this._buildRedLines(brief, factBaseline);

    const pass = issues.length === 0 && conflicts.length === 0;
    return { pass, factBaseline, conflicts, factRedLines, issues };
  }

  /** 事实基线：能力（带前提）/ 使用前提 / 边界 / 官方口径 / 禁用宣称 */
  _buildBaseline(brief, notes) {
    const pick = (...keys) => notes
      .filter(n => keys.some(k => String(n.dimension || '').includes(k)))
      .map(n => ({ fact: n.fact, source: n.source || '未标注' }));
    return {
      product: brief.product || '商品',
      capabilities: pick('功能', '能力', '场景', '卖点'),
      prerequisites: pick('绑定', 'App', '联网', '账号', '前提', '配对'),
      boundaries: pick('边界', '离线', '独立', '兼容', '适配', '续航'),
      officialClaims: pick('口径', '宣传', '官方'),
      // 禁用宣称：从前提与边界反推——凡与"必须具备的条件"矛盾的说法一律禁用
      forbiddenClaims: this._deriveForbidden(notes)
    };
  }

  /** 从调研记录反推禁用宣称（提取全部前提物，避免只取首个匹配造成语义漏网） */
  _deriveForbidden(notes) {
    const forbidden = [];
    for (const n of notes) {
      const fact = String(n.fact || '');
      if (/必须|需要|依赖|绑定/.test(fact)) {
        const targets = this._extractTargets(fact);
        if (targets.length > 0) {
          forbidden.push(`禁止宣称"脱离${targets.join('/')}独立使用"（事实：${fact.slice(0, 40)}）`);
        }
      }
      if (/不支持|无法|不能|暂未/.test(fact)) {
        forbidden.push(`禁止宣称支持该能力（事实：${fact.slice(0, 40)}）`);
      }
    }
    return forbidden;
  }

  /** 前提物提取：手机/App/联网/账号 等依赖实体，去重保持出现序 */
  _extractTargets(fact) {
    const TERMS = ['手机', 'App', 'APP', '应用', '联网', '网络', '账号'];
    return TERMS.filter(t => fact.includes(t));
  }

  /** 创意前提对照检查 */
  _checkCreative(creative, baseline) {
    const conflicts = [];
    const creativeText = [creative.premise, creative.hooks, creative.scenes].filter(Boolean).join('；');
    for (const rule of baseline.forbiddenClaims) {
      const m = rule.match(/禁止宣称"脱离(.+?)独立使用"/);
      if (!m) continue;
      // 逐个前提物做等价表述命中（含同义家族：App≈应用、手机≈电话/移动端）
      const targets = m[1].split('/');
      for (const target of targets) {
        const family = { App: 'App|APP|应用|程序', 手机: '手机|电话|移动端' }[target] || target;
        const re = new RegExp(`不带(?:${family})|脱离(?:${family})|离开(?:${family})|无需(?:${family})|不用(?:${family})|(?:${family})放假|(?:${family})留在家|(?:${family})扔在家`);
        if (re.test(creativeText)) {
          conflicts.push({
            type: '创意前提与事实矛盾',
            banned: `脱离${target}独立使用`,
            evidence: creativeText.slice(0, 60),
            rule
          });
          break; // 同一规则命中一次即可
        }
      }
    }
    return conflicts;
  }

  /** PRD 事实红线 */
  _buildRedLines(brief, baseline) {
    const lines = [];
    for (const p of baseline.prerequisites) {
      lines.push(`使用前提：${p.fact}（信源：${p.source}）——镜头叙事不得与此前提矛盾`);
    }
    for (const f of baseline.forbiddenClaims) {
      lines.push(`禁用宣称：${f}`);
    }
    if (baseline.officialClaims.length > 0) {
      lines.push(`宣称上限：不得超出官方口径——${baseline.officialClaims.map(c => c.fact).join('；').slice(0, 120)}`);
    }
    return lines;
  }
}

module.exports = { ProductTruthChecker, CATEGORY_DIMENSIONS, UNIVERSAL_DIMENSIONS, CATEGORY_PACKS };
