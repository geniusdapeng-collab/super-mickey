'use strict';

/**
 * generalization-test.js — 商品/服务类型通用化回归测试（v2.10.0）
 * 覆盖：任意品类维度解析 / 锚点双形态 / 定妆照双链路 / 技能路由品类过滤
 * 运行: node tests/generalization-test.js
 */

const { ProductTruthChecker, UNIVERSAL_DIMENSIONS, CATEGORY_PACKS } = require('../hyperreality-system/engines/production-engine/agents/product-truth-checker');
const { ProductHeroDesigner } = require('../hyperreality-system/engines/production-engine/agents/product-hero-designer');
const { ProductPortraitBranch } = require('../hyperreality-system/engines/portrait-studio/product-branch');
const { MarketingSkillRouter } = require('../hyperreality-system/skills/social-marketing/marketing-skill-router');

let passed = 0, failed = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${detail}`); failed++; }
}

console.log('📋 事实校验维度开放化（任意品类）');
const checker = new ProductTruthChecker();

const hw = checker.resolveDimensions('3C');
assert('硬件品类：通用底座+硬件扩展包', hw.packs.includes('hardware') && hw.dimensions.includes('绑定/App依赖') && hw.dimensions.includes('官方宣传口径'));

const sw = checker.resolveDimensions('软件/SaaS');
assert('软件品类：命中software扩展包', sw.packs.includes('software') && sw.dimensions.includes('数据安全与隐私'));

const sv = checker.resolveDimensions('本地生活服务');
assert('服务品类：命中service扩展包', sv.packs.includes('service') && sv.dimensions.includes('履约流程与周期') && sv.dimensions.includes('退款与售后规则'));

const fd = checker.resolveDimensions('保健食品');
assert('食品品类：命中food扩展包（复合词模糊归类）', fd.packs.includes('food') && fd.dimensions.includes('配料与致敏原'));

const multi = checker.resolveDimensions('智能手表');
assert('跨品类词命中多包取并集', multi.dimensions.length >= UNIVERSAL_DIMENSIONS.length + 4);

const unknown = checker.resolveDimensions('文创盲盒');
assert('未知品类：通用底座+补充引导，不静默降级', unknown.dimensions.length === UNIVERSAL_DIMENSIONS.length && unknown.needCustomSuggest === true);

const custom = checker.resolveDimensions('文创盲盒', ['IP版权授权', '隐藏款概率公示']);
assert('自定义维度并入', custom.dimensions.includes('IP版权授权') && custom.needCustomSuggest === false);

const task = checker.buildResearchTask({ product: '收纳整理服务', category: '本地生活服务' });
assert('服务类调研任务含履约与退款维度', task.dimensions.includes('履约流程与周期') && task.dimensions.includes('退款与售后规则'));

const svcNotes = task.dimensions.map(d => ({ dimension: d, fact: `${d}的核实事实`, source: '官网' }));
const svcVerify = checker.verify({ brief: { product: '收纳整理服务', category: '本地生活服务' }, researchNotes: svcNotes, creative: { premise: '全程线上预约，阿姨上门收纳' } });
assert('服务类事实校验全维度通过', svcVerify.pass, svcVerify.issues.join(';'));

console.log('\n📋 商品锚点双形态');
const hero = new ProductHeroDesigner();
const physBrief = { product: '千问AI眼镜S1', category: '3C', productHero: { heroImageId: 'QS1-HERO-001', materials: ['黑色亮面镜架'], logo: { position: '镜腿外侧' } } };
const svcBrief = { product: '千问办公', category: '软件/SaaS', productHero: { heroImageId: 'QW-HERO-001', materials: ['磨砂玻璃质感UI卡片'], logo: { position: '界面左上角' } } };
const physAnchor = hero.designAnchor({ shotId: 'V01' }, physBrief);
const svcAnchor = hero.designAnchor({ shotId: 'V01' }, svcBrief);
assert('实物锚点：英雄照实拍+材质', physAnchor.fieldText.includes('英雄照实拍绑定') && physAnchor.fieldText.includes('材质锚点'));
assert('服务锚点：品牌视觉资产+视觉识别', svcAnchor.fieldText.includes('品牌视觉资产绑定') && svcAnchor.fieldText.includes('视觉识别锚点'));
assert('两类LOGO占比纪律通用', physAnchor.fieldText.includes('不小于 5%') && svcAnchor.fieldText.includes('不小于 5%'));
const svcConsist = hero.designConsistency(svcBrief);
assert('服务一致性字段变形', svcConsist.includes('品牌视觉一致性') && svcConsist.includes('QW-HERO-001'));

console.log('\n📋 定妆照双链路');
const branch = new ProductPortraitBranch();
const physTask = branch.plan({ products: [{ id: 'QS1', name: '千问AI眼镜S1', category: '3C' }] })[0];
const svcTask = branch.plan({ products: [{ id: 'QW', name: '千问办公', category: '软件/SaaS' }] })[0];
assert('实物任务：physical链路+商业摄影视角', physTask.productKind === 'physical' && physTask.stages.stylization.portraits.some(p => p.view === 'hero_45'));
assert('实物处理：强制抠图白底', physTask.stages.processing.pipeline.some(s => s.step === 'matting'));
assert('服务任务：service链路+品牌履约视角', svcTask.productKind === 'service' && svcTask.stages.stylization.portraits.some(p => p.view === 'brand_hero'));
assert('服务处理：裁切规范化不抠图', svcTask.stages.processing.pipeline.some(s => s.step === 'crop_normalize') && !svcTask.stages.processing.pipeline.some(s => s.step === 'matting'));
assert('服务视角包含界面特写与履约场景', svcTask.stages.stylization.portraits.some(p => p.view === 'ui_closeup') && svcTask.stages.stylization.portraits.some(p => p.view === 'service_scene'));
svcTask.stages.referenceSearch.referenceImages = [
  { url: 'https://example.com/a.jpg', source: '官网' },
  { url: 'https://example.com/b.jpg', source: '官方社媒' }
];
svcTask.stages.processing.outputBaseImage = '/tmp/base.png';
assert('服务类闸机通用放行', branch.checkStylizationReady(svcTask).ready);

console.log('\n📋 技能路由品类过滤');
const router = new MarketingSkillRouter();
const physHit = router.match({ fn: 'seeding', platform: 'xiaohongshu', goal: 'seeding', category: '3C' }, 5);
const svcHit = router.match({ fn: 'seeding', platform: 'xiaohongshu', goal: 'seeding', category: '软件/SaaS' }, 5);
assert('实物Brief可命中开箱/材质特写', physHit.some(h => h.skill.skill_id === 'marketing_seeding_unboxing' || h.skill.skill_id === 'marketing_seeding_macro'));
assert('服务Brief不命中实物专属技能', !svcHit.some(h => h.skill.skill_id === 'marketing_seeding_unboxing' || h.skill.skill_id === 'marketing_seeding_macro'));
assert('服务Brief仍命中通用技能', svcHit.length > 0);

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
