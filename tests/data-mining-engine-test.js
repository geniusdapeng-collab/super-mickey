'use strict';

/**
 * 珍妮纺织机·数据挖掘引擎 端到端测试
 * ------------------------------------------------------------
 * 覆盖：
 *   T1  Schema 校验（空档骨架合法性 / 非法条目拦截）
 *   T2  数据管道（信封完整性 / 交接闸机硬失败与软缺口）
 *   T3  A1 采集员（任务书完整性 / AI图出局 / 无源卖点剔除 / 价格带归一）
 *   T4  A2 矿工（水军清洗 / 去重 / 方面级情感 / 场景提炼 / 偏倚警报）
 *   T5  A3 侦察员（无源竞品出局 / 相关性排序 / 空位计算 / 数量封顶）
 *   T6  A4 验证官（置信度定级 / 无源清洗 / 官方与用户共识分离）
 *   T7  A5 装订员（钩子预制 / 档案落盘 / 六张摘要卡齐全）
 *   T8  引擎全链路（plan → assemble → consume 复用 / 缺站降级）
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DossierSchema = require('../hyperreality-system/engines/data-mining-engine/contracts/dossier-schema');
const SummaryCards = require('../hyperreality-system/engines/data-mining-engine/contracts/summary-cards');
const Envelope = require('../hyperreality-system/engines/data-mining-engine/pipeline/message-envelope');
const { EvidenceLedger } = require('../hyperreality-system/engines/data-mining-engine/pipeline/evidence-ledger');
const { validateHandoff } = require('../hyperreality-system/engines/data-mining-engine/pipeline/handoff-validator');
const { DossierStore } = require('../hyperreality-system/engines/data-mining-engine/pipeline/dossier-store');
const { ProductInfoCollector } = require('../hyperreality-system/engines/data-mining-engine/agents/product-info-collector');
const { ReviewMiner } = require('../hyperreality-system/engines/data-mining-engine/agents/review-miner');
const { CompetitorScout } = require('../hyperreality-system/engines/data-mining-engine/agents/competitor-scout');
const { CrossVerifier } = require('../hyperreality-system/engines/data-mining-engine/agents/cross-verifier');
const { DossierBinder } = require('../hyperreality-system/engines/data-mining-engine/agents/dossier-binder');
const { JennyLoomEngine } = require('../hyperreality-system/engines/data-mining-engine');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------- T1 Schema ----------
test('T1-1: 空档骨架通过 Schema 校验', () => {
  const d = DossierSchema.emptyDossier('T-001');
  d.identity.name = '测试商品';
  const r = DossierSchema.validate(d);
  assert.strictEqual(r.ok, true, r.issues.join('；'));
});

test('T1-2: 无源条目与非法置信度被拦截', () => {
  const d = DossierSchema.emptyDossier('T-002');
  d.identity.name = '测试';
  d.pros_cons.pros.push({ point: '无源优点' });
  const r = DossierSchema.validate(d);
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some(i => i.includes('confidence')));
  assert.ok(r.issues.some(i => i.includes('无来源引用')));
});

// ---------- T2 管道 ----------
test('T2-1: 信封创建与完整性校验', () => {
  const env = Envelope.create({ traceId: Envelope.newTraceId('T'), stage: 'A1_COLLECT', agent: 'A1', payload: { x: 1 } });
  assert.strictEqual(Envelope.verify(env).ok, true);
  env.payload.x = 2; // 篡改
  assert.strictEqual(Envelope.verify(env).ok, false, '篡改后校验和必须失败');
});

test('T2-2: 交接闸机硬失败与软缺口', () => {
  const hard = validateHandoff('A1_COLLECT', { identity: { name: '', specs: {} }, image_candidates: [] });
  assert.strictEqual(hard.ok, false, '商品名为空必须硬失败');
  const soft = validateHandoff('A1_COLLECT', { identity: { name: '风扇', specs: {} }, image_candidates: [], official_selling_points: [] });
  assert.strictEqual(soft.ok, true);
  assert.ok(soft.gaps.length >= 2, '图片/卖点不足应产生软缺口');
});

test('T2-3: 证据账本渠道分级与独立来源计数', () => {
  const l = new EvidenceLedger();
  l.register({ claimRef: 'c1', sourceUrl: 'https://detail.tmall.com/a', channel: '天猫旗舰店', agent: 'A1' });
  l.register({ claimRef: 'c1', sourceUrl: 'https://item.jd.com/b', channel: '京东', agent: 'A1' });
  l.register({ claimRef: 'c1', sourceUrl: 'https://detail.tmall.com/c', channel: '天猫', agent: 'A1' });
  assert.strictEqual(l.independentSourceCount('c1'), 2, '同域名不算独立来源');
  assert.strictEqual(l.hasOfficialSource('c1'), true);
  assert.throws(() => l.register({ claimRef: 'x' }), /sourceUrl|origin/, '无来源登记必须抛错');
});

// ---------- T3 A1 ----------
test('T3-1: 采集任务书结构完整', () => {
  const a = new ProductInfoCollector();
  const plan = a.plan({ name: '风扇', brand: 'QW', category: '3C', model: 'F9' });
  assert.ok(plan.queries.length >= 7);
  assert.ok(plan.fillback_format.identity && plan.fillback_format.images);
  assert.ok(plan.queries.some(q => q.intent === 'model_verify'), '带型号必须有型号甄别查询');
  assert.strictEqual(a.plan({ name: '收纳课', category: '教育培训' }).product_kind, 'service');
});

test('T3-2: AI图出局 / 无源卖点剔除 / 价格带归一', () => {
  const a = new ProductInfoCollector();
  const ledger = new EvidenceLedger();
  const out = a.distill({
    identity: {
      name: '风扇', brand: 'QW',
      prices: [{ amount: 100, currency: 'CNY', source_url: 'https://a.com' }, { amount: 150, currency: 'CNY', source_url: 'https://b.com' }],
      official_selling_points: [{ point: '有源卖点', source_url: 'https://a.com' }, { point: '无源卖点' }]
    },
    images: [
      { url: 'https://a.com/1.jpg', source: '天猫旗舰店商品页', angle: '正面', width: 1000, height: 1000 },
      { url: 'https://b.com/2.jpg', source: 'AI生成概念图', angle: '侧面' }
    ]
  }, { input: { name: '风扇', brand: 'QW' }, ledger });
  assert.strictEqual(out.identity.price_band, 'CNY 100-150');
  assert.deepStrictEqual(out.identity.official_selling_points, ['有源卖点']);
  assert.strictEqual(out.image_candidates.length, 1, 'AI嫌疑图必须出局');
  assert.ok(out.gaps.some(g => g.includes('无来源')));
});

// ---------- T4 A2 ----------
test('T4-1: 清洗（水军+重复）与偏倚警报', () => {
  const a = new ReviewMiner({ minReviews: 5 });
  const ledger = new EvidenceLedger();
  const out = a.distill({ reviews: [
    { text: '好评好评好评好评', source: 'x', suspect: true },
    { text: '风力很大很好用推荐', source: '京东', url: 'https://a.com/1', rating: 5 },
    { text: '风力很大很好用推荐', source: '天猫', url: 'https://b.com/2', rating: 5 },
    { text: '颜值高质量好性价比高', source: '天猫', url: 'https://c.com/3', rating: 5 },
    { text: '办公室用很静音，满意', source: '京东', url: 'https://d.com/4', rating: 5 }
  ] }, { input: { name: '风扇' }, ledger });
  assert.strictEqual(out.cleaned.spam_removed, 1);
  assert.strictEqual(out.cleaned.duplicate_removed, 1);
  assert.strictEqual(out.review_count, 3);
  assert.ok(out.gaps.some(g => g.includes('偏倚')), '全好评样本必须报警');
  assert.ok(out.gaps.some(g => g.includes('样本')));
});

test('T4-2: 方面级情感抽取与场景提炼', () => {
  const a = new ReviewMiner();
  const ledger = new EvidenceLedger();
  const out = a.distill({ reviews: [
    { text: '续航虚标，标12小时实际5小时，失望退货', source: '小红书', url: 'https://a.com/1', rating: 1 },
    { text: '办公室用一档就够，静音效果棒', source: '知乎', url: 'https://b.com/2', rating: 5 },
    { text: '给孩子宿舍用，很轻便', source: '京东', url: 'https://c.com/3', rating: 4 }
  ] }, { input: { name: '风扇' }, ledger });
  assert.ok(out.pain_points.some(p => p.aspect === '续航' && p.root_cause === 'endurance_gap'));
  assert.ok(out.scenarios.some(s => s.persona === '学生党' || s.persona === '母婴人群'));
  assert.ok(out.verbatim.length > 0);
  assert.ok(out.praise_points.every(p => p.source_refs.length > 0), '观点必须挂证据');
});

// ---------- T5 A3 ----------
test('T5-1: 无源竞品出局 / 空位计算 / 封顶', () => {
  const a = new CompetitorScout({ cap: 2 });
  const ledger = new EvidenceLedger();
  const out = a.distill({ competitors: [
    { name: '竞品A', category: '便携风扇', price_band: 'CNY 100-140', price_source_url: 'https://a.com',
      selling_points: [{ point: '静音', source_url: 'https://a.com' }], weakness_notes: '续航短' },
    { name: '竞品B', selling_points: [{ point: '无源卖点' }] },
    { name: '竞品C', category: '便携风扇', price_band: 'CNY 120',
      selling_points: [{ point: '大风力', source_url: 'https://c.com' }] },
    { name: '竞品D', category: '便携风扇', price_band: 'CNY 130',
      selling_points: [{ point: '长续航', source_url: 'https://d.com' }] }
  ] }, { input: { price_band: 'CNY 130', sellingPointCandidates: ['静音', '12小时长续航'] }, ledger });
  assert.strictEqual(out.competitors.length, 2, '封顶 2 个');
  assert.ok(!out.competitors.some(c => c.name === '竞品B'), '无源卖点竞品必须出局');
  assert.deepStrictEqual(out.differentiation.our_opening, ['12小时长续航']);
  assert.deepStrictEqual(out.differentiation.crowded_points, ['静音']);
  assert.strictEqual(out.differentiation.weakness_openings.length, 1);
});

// ---------- T6 A4 ----------
test('T6-1: 置信度定级与无源清洗', () => {
  const ledger = new EvidenceLedger();
  const r1 = ledger.register({ claimRef: 'voc.praise:性能', sourceUrl: 'https://a.com/1', agent: 'A2' });
  const r2 = ledger.register({ claimRef: 'voc.praise:性能', sourceUrl: 'https://b.com/2', agent: 'A2' });
  const r3 = ledger.register({ claimRef: 'voc.pain:续航', sourceUrl: 'https://c.com/3', agent: 'A2' });
  const v = new CrossVerifier();
  const out = v.verify({
    a1: { identity: { name: '风扇', price_band: '', official_selling_points: [], specs: {} }, gaps: [] },
    a2: {
      praise_points: [
        { point: '双源认可性能', aspect: '性能', mentions: 2, quote: 'q', source_refs: [r1, r2] },
        { point: '无源观点', aspect: '外观', mentions: 1, quote: 'q', source_refs: [] }
      ],
      pain_points: [{ point: '吐槽续航', aspect: '续航', mentions: 1, quote: 'q', source_refs: [r3], root_cause: 'endurance_gap' }],
      verbatim: [], scenarios: [], gaps: []
    },
    a3: { competitors: [], differentiation: {}, gaps: [] }
  }, { ledger });
  assert.strictEqual(out.verified.praise_points.length, 1, '无源观点必须清除');
  assert.strictEqual(out.verified.praise_points[0].confidence, 'confirmed');
  assert.strictEqual(out.cons[0].confidence, 'reported');
  assert.ok(out.verification_report.purged.length === 1);
});

test('T6-2: 价格冲突检测与官方优先裁决', () => {
  const ledger = new EvidenceLedger();
  ledger.register({ claimRef: 'identity.price_band', sourceUrl: 'https://detail.tmall.com/x', channel: '天猫旗舰店', agent: 'A1' });
  ledger.register({ claimRef: 'identity.price_band', sourceUrl: 'https://some-blog.com/y', agent: 'A1' });
  const v = new CrossVerifier({ conflictPriceRatio: 0.3 });
  const out = v.verify({
    a1: { identity: { name: '风扇', price_band: 'CNY 100-200', official_selling_points: [], specs: {} }, gaps: [] },
    a2: { praise_points: [], pain_points: [], verbatim: [], scenarios: [], gaps: [] },
    a3: { competitors: [], differentiation: {}, gaps: [] }
  }, { ledger });
  assert.strictEqual(out.verification_report.conflicts.length, 1, '价差 100% 必须记冲突');
  assert.ok(out.verification_report.conflicts[0].resolution.includes('官方'));
});

// ---------- T7 A5 ----------
test('T7-1: 钩子预制 / 落盘 / 六卡齐全', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
  const store = new DossierStore({ root: tmp });
  const ledger = new EvidenceLedger();
  const r1 = ledger.register({ claimRef: 'identity.price_band', sourceUrl: 'https://a.com', agent: 'A1' });
  const binder = new DossierBinder({ store });
  const { dossier, cards, saved, validation } = binder.bind({
    productId: 'T-FAN-001',
    verified: {
      identity: { name: '风扇', category: '3C', specs: { 续航: '12小时' }, price_band: 'CNY 129', official_selling_points: [] },
      praise_points: [{ point: '认可性能', aspect: '性能', mentions: 3, quote: '猛', confidence: 'confirmed', source_refs: [r1] }],
      pain_points: [{ point: '吐槽续航', aspect: '续航', mentions: 2, quote: '虚标', confidence: 'reported', source_refs: [r1], root_cause: 'endurance_gap' }],
      verbatim: [{ text: '风力真的猛', sentiment: 'pos', source_refs: [r1] }],
      scenarios: [{ persona: '通勤族', scene: '办公室', moment: '', mentions: 3 }],
      competitors: [{ name: 'JISU', price_band: 'CNY 99', selling_points: ['静音'], weakness_notes: '续航短', confidence: 'reported', source_refs: [r1] }],
      differentiation: { our_opening: ['长续航'], crowded_points: ['静音'], weakness_openings: [{ competitor: 'JISU', weakness: '续航短' }] }
    },
    pros: [{ point: '官方主打「12小时长续航」', claim_nature: 'official', confidence: 'confirmed', source_refs: [r1] },
           { point: '认可性能', aspect: '性能', mentions: 3, quote: '猛', confidence: 'confirmed', source_refs: [r1] }],
    cons: [{ point: '吐槽续航', aspect: '续航', root_cause: 'endurance_gap', mentions: 2, quote: '虚标', confidence: 'reported', source_refs: [r1] }],
    visual: { hero_image_id: 'QW-HERO-001', image_candidates: [{ id: 'QW-HERO-001', url: 'https://a.com/1.jpg', source: '旗舰店', angle: '正面', license_risk: 'low', fetched_at: new Date().toISOString() }], needs_more_reference: false },
    ledger,
    reviewMeta: { review_count: 20, cleaned: { spam_removed: 1, duplicate_removed: 2 } },
    gaps: []
  });
  assert.strictEqual(validation.ok, true, validation.issues.join('；'));
  assert.ok(saved && fs.existsSync(saved.dossierPath) && fs.existsSync(saved.manifestPath));
  for (const k of ['brief_card', 'theme_card', 'insight_card', 'prd_card', 'portrait_manifest', 'router_material']) {
    assert.ok(cards[k], `缺摘要卡 ${k}`);
  }
  // 钩子：官方宣称 vs 用户吐槽同方面 → 冲突钩子
  assert.ok(dossier.hook_material.conflicts.some(c => c.includes('12小时长续航') && c.includes('续航')), '官方vs吐槽反差钩子缺失');
  assert.ok(dossier.hook_material.data_points.some(d => d.includes('12小时')));
  assert.ok(dossier.hook_material.questions.length > 0);
  // Brief 卡卖点提取
  assert.ok(cards.brief_card.sellingPoints.length >= 1 && cards.brief_card.sellingPoints.length <= 3);
  assert.strictEqual(cards.brief_card.productHero.heroImageId, 'QW-HERO-001');
  // manifest 交接
  assert.strictEqual(cards.portrait_manifest.reference_images.length, 1);
  assert.strictEqual(cards.portrait_manifest.needs_more_reference, false);
});

// ---------- T8 引擎全链路 ----------
test('T8-1: plan → assemble → consume 全程', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-e2e-'));
  const engine = new JennyLoomEngine({ storeRoot: tmp });
  const input = { name: '涡轮便携风扇', brand: 'QW', category: '3C数码', model: 'F9 Pro', sellingPointCandidates: ['12小时长续航', '静音'] };

  const plan = engine.plan(input);
  assert.ok(plan.trace_id && plan.plans.A1 && plan.plans.A2 && plan.plans.A3);

  const result = engine.assemble(plan.trace_id, input, {
    A1: {
      identity: {
        name: '涡轮便携风扇', brand: 'QW', category: '3C数码',
        specs: { 续航: { value: '12小时', source_url: 'https://detail.tmall.com/x' } },
        prices: [{ amount: 129, currency: 'CNY', source_url: 'https://detail.tmall.com/x', channel: '天猫旗舰店' }],
        official_selling_points: [{ point: '12小时长续航', source_url: 'https://detail.tmall.com/x', channel: '天猫旗舰店' }]
      },
      images: [
        { url: 'https://img.com/a.jpg', source: '天猫旗舰店商品页', page_url: 'https://detail.tmall.com/x', angle: '正面', width: 1200, height: 1200 },
        { url: 'https://img.com/b.jpg', source: '开箱实拍', page_url: 'https://xhs.com/n', angle: '手持', width: 900, height: 900 }
      ]
    },
    A2: { reviews: [
      { text: '风力猛，办公室一档够用，推荐', source: '天猫评价', url: 'https://tmall.com/r1', rating: 5 },
      { text: '通勤路上挂脖子，解放双手，值', source: '知乎', url: 'https://zhihu.com/r2', rating: 5 },
      { text: '续航有点虚标，实际大概8小时', source: '小红书', url: 'https://xhs.com/r3', rating: 2 }
    ] },
    A3: { competitors: [
      { name: 'JISU风棒', category: '便携风扇', price_band: 'CNY 99-139', price_source_url: 'https://jd.com/c1',
        selling_points: [{ point: '静音', source_url: 'https://jd.com/c1' }], weakness_notes: '续航短' }
    ] }
  });

  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.envelopes.length, 5, '五站信封一个不少');
  assert.ok(result.dossier.product_id);
  assert.ok(result.dossier.provenance.length > 0, '溯源账本必须非空');
  assert.ok(result.saved && fs.existsSync(result.saved.dossierPath));
  // 六卡
  for (const k of ['brief_card', 'theme_card', 'insight_card', 'prd_card', 'portrait_manifest', 'router_material']) {
    assert.ok(result.cards[k], `缺 ${k}`);
  }
  // consume 复用
  const reused = engine.consume(input);
  assert.ok(reused && reused.reused === true && reused.stale === false);
  assert.ok(reused.cards.brief_card.sellingPoints.length > 0);
  // reusable 判定
  assert.strictEqual(engine.reusable(result.product_id), true);
  assert.strictEqual(engine.reusable(result.product_id, true), false, 'forceRefresh 必须判不可用');
});

test('T8-2: 缺站降级（只有 A1 数据）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-degrade-'));
  const engine = new JennyLoomEngine({ storeRoot: tmp });
  const input = { name: '极简台灯', category: '家居' };
  const plan = engine.plan(input);
  const result = engine.assemble(plan.trace_id, input, {
    A1: {
      identity: { name: '极简台灯', category: '家居', prices: [{ amount: 89, currency: 'CNY', source_url: 'https://a.com' }], official_selling_points: [] },
      images: [{ url: 'https://a.com/l.jpg', source: '官网', angle: '正面', width: 1000, height: 1000 }]
    }
    // A2/A3 缺站
  });
  assert.strictEqual(result.ok, true);
  assert.ok(result.dossier.gaps.some(g => g.includes('A2')));
  assert.ok(result.dossier.gaps.some(g => g.includes('A3')));
  assert.strictEqual(result.dossier.voice_of_customer.praise_points.length, 0);
  assert.ok(result.cards.brief_card, '缺站也要能出卡');
});

test('T8-3: A1 身份事实缺失 → 全线停摆（硬依赖）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-fatal-'));
  const engine = new JennyLoomEngine({ storeRoot: tmp });
  const input = { name: '' };
  assert.throws(() => engine.plan(input), /缺商品名/);
});

// ---------- 运行 ----------
(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      failed += 1;
      console.error(`  ❌ ${t.name}`);
      console.error(`     ${e.message}`);
    }
  }
  console.log(`\n珍妮纺织机测试: ${passed} 通过 / ${failed} 失败 / 共 ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
