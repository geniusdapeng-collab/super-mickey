'use strict';

/**
 * ProductTruthChecker（产品调研与事实校验闸机）
 * ------------------------------------------------------------
 * 【v2.9.0 新增】社媒营销包 · 事实真实性基线
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

/** 品类预设调研维度（可按品类扩展） */
const CATEGORY_DIMENSIONS = {
  '3C': ['绑定手机/App依赖', '联网依赖', '账号生态依赖', '离线能力边界', '续航与充电方式', '兼容机型/系统'],
  '3C-穿戴': ['绑定手机/App依赖', '联网依赖', '账号生态依赖', '离线能力边界', '佩戴与适配（度数/脸型）', '续航与充电方式'],
  '美妆': ['肤质适配', '功效依据（备案/临床）', '禁用人群', '使用方法'],
  '食品': ['配料与致敏原', '保质期', '食用方法', '生产许可'],
  '其他': ['使用前提', '能力边界', '官方口径']
};

class ProductTruthChecker {
  /**
   * 阶段1：生成调研任务清单（spec 模式，执行方联网调研后回填 researchNotes）
   * @param {object} brief 规范化后的营销 Brief
   * @returns {object} 调研任务
   */
  buildResearchTask(brief = {}) {
    const category = brief.category || '其他';
    const dimensions = CATEGORY_DIMENSIONS[category] || CATEGORY_DIMENSIONS['其他'];
    const product = brief.product || '商品';
    return {
      stage: 'research',
      executor: 'llm-agent',
      product,
      dimensions,
      queries: [
        `${product} 官方 使用前提 绑定 配对`,
        `${product} 功能 参数 官方口径`,
        `${product} 离线 能否独立使用`,
        `${product} 官方社媒 宣传 场景`
      ],
      sourcePriority: ['官网/官方社媒', '官方旗舰店', '权威媒体实测', '第三方评测'],
      requirements: [
        '每个维度至少一条可溯源事实，禁止凭印象填写',
        '使用前提（绑定/联网/账号）为必查项，缺失即视为调研未完成',
        '官方宣传口径原文摘录，宣称不得二次放大',
        '调研记录须标注信源'
      ],
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

    // ---- 调研完整性闸机 ----
    const category = brief.category || '其他';
    const requiredDims = CATEGORY_DIMENSIONS[category] || CATEGORY_DIMENSIONS['其他'];
    const coveredDims = new Set(researchNotes.map(n => n.dimension));
    const missingDims = requiredDims.filter(d => !coveredDims.has(d));
    if (!Array.isArray(researchNotes) || researchNotes.length === 0) {
      issues.push('调研记录为空：产品事实校验未执行，禁止进入业务需求洞察');
    }
    for (const d of missingDims) {
      issues.push(`调研维度缺失：${d}（品类 ${category} 必查）`);
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

module.exports = { ProductTruthChecker, CATEGORY_DIMENSIONS };
