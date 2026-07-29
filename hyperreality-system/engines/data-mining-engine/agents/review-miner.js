'use strict';

/**
 * A2 ReviewMiner — 用户评价矿工
 * ------------------------------------------------------------
 * 职责：从真实用户评价里挖出营销弹药与避坑地图。
 * 四层矿脉：
 *   1. 称赞点（praise_points）：用户真实夸什么 —— 卖点校准器
 *   2. 吐槽点（pain_points）：用户真实骂什么 —— 创意避坑 + 反差钩子原料
 *   3. 用户原话（verbatim）：一字不改的高能句子 —— 花字/钩子文案弹药
 *   4. 使用场景（scenarios）：谁在什么时刻怎么用 —— 镜头演示节拍的排布依据
 *
 * 工作方式：
 *   plan(input)   → 产出《挖矿任务书》：分平台查询矩阵 + 回填格式
 *   distill(raw)  → 清洗（去水军/去重复）→ 方面级情感抽取 → 聚合计数 → 场景提炼
 *
 * 反虚构纪律：
 *   - 每条观点必须挂来源；聚合时保留代表性原话，禁止改写用户语义
 *   - 全是好评的样本直接打偏倚警报（真实商品必有差评）
 *   - 水军/广告/刷屏内容清洗出局，并报告清洗量
 */

/** 通用方面词库（方面 → 触发词）。执行方 LLM 可在此基础上按品类扩展 */
const ASPECT_LEXICON = {
  质量: ['质量', '做工', '耐用', '坏了', '裂', '断', '掉漆', '松动'],
  外观: ['颜值', '好看', '外观', '颜色', '高级感', '丑', '廉价感'],
  续航: ['续航', '电池', '充电', '电量', '耐用度'],
  尺寸便携: ['大小', '尺寸', '便携', '轻', '重', 'mini', '迷你', '口袋'],
  性能: ['风力', '力度', '效果', '性能', '速度', '噪音', '静音', '吵'],
  性价比: ['性价比', '值', '便宜', '贵', '价格', '划算', '不值'],
  物流包装: ['物流', '快递', '包装', '发货', '到货'],
  客服售后: ['客服', '售后', '退货', '换货', '维修', '服务态度'],
  易用性: ['操作', '上手', '安装', '使用难度', '说明书', '方便'],
  安全健康: ['安全', '异味', '过敏', '甲醛', '辐射', '材质安全', '孩子']
};

const POSITIVE_WORDS = ['好', '赞', '喜欢', '满意', '推荐', '值', '棒', '给力', '惊艳', '舒服', '不错', '爱了', '回购', '神器', '好用', '划算'];
const NEGATIVE_WORDS = ['差', '失望', '后悔', '退', '垃圾', '坑', '难用', '坏', '翻车', '踩雷', '不值', '鸡肋', '吵', '异味', '别买', '避雷'];

/** 差评根因分类（吐槽点 → 根因桶） */
const ROOT_CAUSE_MAP = {
  质量: 'quality_defect', 安全健康: 'safety_concern', 续航: 'endurance_gap',
  性能: 'performance_gap', 尺寸便携: 'form_factor', 性价比: 'value_mismatch',
  物流包装: 'fulfillment', 客服售后: 'after_sales', 易用性: 'usability', 外观: 'aesthetics'
};

/** 场景提炼模式：人群/时刻/地点线索 */
const SCENE_PATTERNS = [
  { re: /给孩子|给宝宝|给娃|孩子用|婴儿|宝宝/g, persona: '母婴人群' },
  { re: /上班|通勤|办公室|工位|地铁|公交/g, persona: '通勤族', scene: '通勤/办公' },
  { re: /宿舍|学生|寝室|教室|图书馆/g, persona: '学生党', scene: '校园' },
  { re: /户外|露营|爬山|旅行|出差|旅游|海边/g, scene: '户外出行' },
  { re: /健身|跑步|运动|骑行/g, scene: '运动场景' },
  { re: /晚上|夜里|睡觉|床头|睡前/g, moment: '夜间' },
  { re: /夏天|高温|闷热|三伏/g, moment: '高温季' },
  { re: /厨房|做饭|炒菜/g, scene: '厨房' },
  { re: /化妆|补妆|美甲|理发店/g, scene: '美妆护理' }
];

class ReviewMiner {
  constructor(opts = {}) {
    this.agentName = 'ReviewMiner';
    this.minReviews = opts.minReviews || 10; // 样本量软门槛
  }

  /**
   * 产出《挖矿任务书》
   * @param {object} input { name, brand?, category?, sellingPointCandidates? }
   */
  plan(input = {}) {
    if (!input.name) throw new Error('[A2] 缺商品名 name');
    const base = [input.brand, input.name].filter(Boolean).join(' ');
    const points = Array.isArray(input.sellingPointCandidates) ? input.sellingPointCandidates : [];

    const queries = [
      { q: `${base} 真实评价 怎么样`, intent: 'general_reviews', channel: '电商评价/问答' },
      { q: `${base} 差评 缺点`, intent: 'negative_reviews', channel: '电商差评区/问答' },
      { q: `${base} 踩雷 避雷`, intent: 'fail_reports', channel: '社媒' },
      { q: `${base} 值得买吗 知乎`, intent: 'qa_threads', channel: '知乎' },
      { q: `${base} 使用感受 小红书`, intent: 'ugc_notes', channel: '小红书' },
      { q: `${base} 测评 对比`, intent: 'review_articles', channel: '评测媒体/社媒' },
      { q: `${base} 回购 用了 个月`, intent: 'long_term', channel: '电商追评/社媒' }
    ];
    // 每个候选卖点定向验证：官方吹的，用户认不认？
    for (const p of points.slice(0, 5)) {
      queries.push({ q: `${base} ${p} 真的吗`, intent: 'claim_check', channel: '问答/社媒', target_point: p });
    }

    return {
      stage: 'A2_MINE',
      agent: this.agentName,
      queries,
      sample_target: { min_reviews: this.minReviews, negative_share: '差评/中评样本不得低于 15%（防偏倚）' },
      fillback_format: {
        reviews: '[{ text, source(渠道描述), url, rating?(1-5), date?, helpful_votes? }]'
      },
      discipline: [
        '评价必须原文回填，禁止改写/润色用户句子',
        '每条评价必须带来源；刷单嫌疑（模板化/无细节/集中爆发）照样回填但标注 suspect: true',
        '追加评价（用了N个月后的追评）价值最高，优先采集'
      ]
    };
  }

  /**
   * 清洗 + 挖掘回填评价
   * @param {object} raw { reviews: [...] }
   * @param {object} ctx { input, ledger }
   */
  distill(raw = {}, ctx = {}) {
    const { input = {}, ledger } = ctx;
    const reviews = Array.isArray(raw.reviews) ? raw.reviews : [];
    const gaps = [];

    // ===== 清洗：去重 + 水军出局 =====
    const seen = new Set();
    const clean = [];
    let spamCount = 0, dupCount = 0;
    for (const r of reviews) {
      if (!r || !r.text || String(r.text).trim().length < 4) { spamCount += 1; continue; }
      if (r.suspect === true) { spamCount += 1; continue; }
      const fp = String(r.text).replace(/\s+/g, '').slice(0, 40);
      if (seen.has(fp)) { dupCount += 1; continue; }
      seen.add(fp);
      clean.push(r);
    }

    // ===== 方面级情感抽取 =====
    const aspectHits = {}; // aspect -> {pos:[], neg:[]}
    const scenarioHits = new Map(); // key -> {persona?, scene?, moment?, count, quote}
    const verbatimCandidates = [];

    for (const r of clean) {
      const text = String(r.text);
      const rating = Number(r.rating) || null;
      const posScore = POSITIVE_WORDS.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
      const negScore = NEGATIVE_WORDS.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
      const sentiment = rating != null
        ? (rating >= 4 ? 'pos' : rating <= 2 ? 'neg' : (negScore > posScore ? 'neg' : 'pos'))
        : (negScore > posScore ? 'neg' : posScore > 0 ? 'pos' : 'neutral');

      const srcRef = ledger
        ? ledger.register({ claimRef: 'voc.raw_review', sourceUrl: r.url, origin: r.url ? undefined : (r.source || '执行方回填评价'), channel: r.source || '', agent: this.agentName, fetchedAt: r.date })
        : null;

      for (const [aspect, words] of Object.entries(ASPECT_LEXICON)) {
        if (words.some(w => text.includes(w))) {
          aspectHits[aspect] = aspectHits[aspect] || { pos: [], neg: [] };
          const bucket = sentiment === 'neg' ? 'neg' : sentiment === 'pos' ? 'pos' : null;
          if (bucket) aspectHits[aspect][bucket].push({ text, srcRef, rating });
        }
      }

      // 场景提炼
      for (const sp of SCENE_PATTERNS) {
        if (sp.re.test(text)) {
          sp.re.lastIndex = 0;
          const key = `${sp.persona || ''}|${sp.scene || ''}|${sp.moment || ''}`;
          const cur = scenarioHits.get(key) || { persona: sp.persona || '', scene: sp.scene || '', moment: sp.moment || '', count: 0, quotes: [] };
          cur.count += 1;
          if (cur.quotes.length < 2) cur.quotes.push(text.slice(0, 80));
          scenarioHits.set(key, cur);
        }
      }

      // 原话候选：情绪浓度高、长度适中
      const emo = posScore + negScore;
      if (emo >= 1 && text.length >= 8 && text.length <= 80) {
        verbatimCandidates.push({ text, sentiment, emo, srcRef, source: r.source || '' });
      }
    }

    // ===== 聚合观点 =====
    const toPoint = (aspect, items, kind) => ({
      point: this._summarizeAspect(aspect, items, kind),
      aspect,
      mentions: items.length,
      quote: items[0]?.text.slice(0, 100) || '',
      source_refs: [...new Set(items.map(x => x.srcRef).filter(Boolean))],
      root_cause: kind === 'pain' ? (ROOT_CAUSE_MAP[aspect] || 'other') : undefined
    });

    const praise_points = [];
    const pain_points = [];
    for (const [aspect, buckets] of Object.entries(aspectHits)) {
      if (buckets.pos.length >= 1) praise_points.push(toPoint(aspect, buckets.pos, 'praise'));
      if (buckets.neg.length >= 1) pain_points.push(toPoint(aspect, buckets.neg, 'pain'));
    }
    praise_points.sort((a, b) => b.mentions - a.mentions);
    pain_points.sort((a, b) => b.mentions - a.mentions);

    // 原话：情绪浓度优先，正负能量均衡
    verbatimCandidates.sort((a, b) => b.emo - a.emo);
    const verbatim = verbatimCandidates.slice(0, 12).map(v => ({
      text: v.text,
      sentiment: v.sentiment,
      source: v.source,
      source_refs: v.srcRef ? [v.srcRef] : []
    }));

    const scenarios = [...scenarioHits.values()]
      .sort((a, b) => b.count - a.count)
      .map(s => ({ persona: s.persona || '泛人群', scene: s.scene || '', moment: s.moment || '', mentions: s.count, sample_quotes: s.quotes }));

    // ===== 偏倚检查 =====
    const negCount = clean.filter(r => (Number(r.rating) || 5) <= 2).length;
    if (clean.length < this.minReviews) gaps.push(`有效评价样本 ${clean.length} 条，低于门槛 ${this.minReviews} 条，结论置信度受限`);
    if (clean.length >= 3 && negCount === 0) gaps.push('样本零差评，存在严重偏倚嫌疑（真实商品必有差评），pain_points 可信度存疑');
    if (pain_points.length === 0 && clean.length >= 5) gaps.push('未挖到吐槽点：要么样本偏倚，要么挖掘词库需按品类扩展');

    return {
      review_count: clean.length,
      cleaned: { spam_removed: spamCount, duplicate_removed: dupCount },
      praise_points,
      pain_points,
      verbatim,
      scenarios,
      gaps
    };
  }

  /** 方面 → 观点句（保留用户语义骨架，不虚构细节） */
  _summarizeAspect(aspect, items, kind) {
    const verb = kind === 'praise' ? '认可' : '集中吐槽';
    return `用户${verb}「${aspect}」（${items.length} 次提及）`;
  }
}

module.exports = { ReviewMiner, ASPECT_LEXICON, ROOT_CAUSE_MAP };
