'use strict';

/**
 * product-truth-checker-test.js — v2.9.0 新增模块测试
 * 覆盖：ProductTruthChecker / MarketingDurationBridge / verifyPackage / 定妆照风格化闸机
 * 运行: node tests/product-truth-checker-test.js
 */

const { ProductTruthChecker } = require('../hyperreality-system/engines/production-engine/agents/product-truth-checker');
const { MarketingDurationBridge } = require('../hyperreality-system/engines/production-engine/agents/marketing-duration-bridge');
const { PromptDeliveryGuard } = require('../hyperreality-system/engines/production-engine/agents/prompt-delivery-guard');
const { ProductPortraitBranch } = require('../hyperreality-system/engines/portrait-studio/product-branch');

let passed = 0, failed = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${detail}`); failed++; }
}

console.log('📋 产品事实校验闸机');
const checker = new ProductTruthChecker();
const brief = { product: '千问AI眼镜S1', category: '3C', platform: 'xiaohongshu' };
const task = checker.buildResearchTask(brief);
assert('调研任务含绑定/App必查维度', task.dimensions.includes('绑定/App依赖'));
assert('调研任务含通用底座维度', task.dimensions.includes('使用前提与依赖条件') && task.dimensions.includes('官方宣传口径'));

const empty = checker.verify({ brief, researchNotes: [], creative: {} });
assert('调研记录为空即阻断', !empty.pass && empty.issues.some(i => i.includes('调研记录为空')));

const notes = [
  { dimension: '使用前提与依赖条件', fact: '必须蓝牙绑定千问App并联网，AI办事依赖手机端账号生态', source: '官网' },
  { dimension: '能力/效果边界', fact: '拍摄与本地存储可离线，AI能力需在线且绑定手机', source: '媒体实测' },
  { dimension: '官方宣传口径', fact: '官方口径为"无需掏出手机"', source: '官方发布会' },
  { dimension: '价格与购买履约方式', fact: '官方价4299元起，叠加补贴到手3499元', source: '旗舰店' },
  { dimension: '绑定/App依赖', fact: '必须蓝牙绑定千问App使用，AI办事依赖手机端账号生态', source: '官网' },
  { dimension: '联网依赖', fact: 'AI对话与AI办事需联网', source: '官方社媒' },
  { dimension: '账号生态依赖', fact: '支付/导航调用支付宝与高德账号', source: '官网' },
  { dimension: '离线能力边界', fact: '拍摄与本地存储可离线，AI能力需在线', source: '媒体实测' },
  { dimension: '续航与充电方式', fact: '双电池热插拔换电，可不关机更换', source: '官网' },
  { dimension: '兼容机型/系统', fact: '支持主流安卓与iOS', source: '旗舰店' }
];
const good = checker.verify({ brief, researchNotes: notes, creative: { premise: '手机在包里全程在线，但一天没掏出来' } });
assert('事实自洽创意通过', good.pass, JSON.stringify(good.issues.concat(good.conflicts)));
assert('事实基线含使用前提', good.factBaseline.prerequisites.length > 0);
assert('禁用宣称自动反推', good.factBaseline.forbiddenClaims.some(f => f.includes('独立使用')));
assert('PRD事实红线产出', good.factRedLines.length > 0);

const bad = checker.verify({ brief, researchNotes: notes, creative: { premise: '把手机留在家里，脱离手机独立使用一天' } });
assert('脱离手机创意被阻断', !bad.pass && bad.conflicts.some(c => c.type === '创意前提与事实矛盾'));

console.log('\n📋 营销镜头时长分配桥');
const bridge = new MarketingDurationBridge();
const skeleton = [
  { shotId: 'S00', fn: 'opening', lineChars: 0 },
  { shotId: 'V01', fn: 'hook', lineChars: 12 },
  { shotId: 'V02', fn: 'demo', lineChars: 12 },
  { shotId: 'V03', fn: 'demo', lineChars: 12 },
  { shotId: 'V04', fn: 'seeding', lineChars: 10 },
  { shotId: 'V05', fn: 'seeding', lineChars: 10 },
  { shotId: 'V06', fn: 'cta', lineChars: 14 }
];
const alloc = bridge.allocate({ shots: skeleton, totalDuration: 30, platform: 'xiaohongshu' });
console.log('  分配结果:', alloc.shots.map(s => `${s.shotId}:${s.duration}s`).join(' '), `总${alloc.total}s`);
assert('镜头时长长短不一', new Set(alloc.shots.map(s => s.duration)).size > 1);
assert('全部落在蓝图时长带3-6', alloc.shots.every(s => s.duration >= 3 && s.duration <= 6));
assert('总和贴近目标30s', Math.abs(alloc.total - 30) <= 2);
assert('无均分告警', !alloc.warnings.some(w => w.includes('全部相同')));

console.log('\n📋 作品级交付校验 verifyPackage');
const guard = new PromptDeliveryGuard();
const noOpening = guard.verifyPackage(
  [{ shotId: 'V01', duration: 4 }, { shotId: 'V02', duration: 5 }],
  { platform: 'xiaohongshu', targetDuration: 9 });
assert('缺片头镜头被拦截', !noOpening.pass && noOpening.issues.some(i => i.includes('片头')));
const sameDur = guard.verifyPackage(
  [{ shotId: 'S00', sceneType: 'opening', duration: 5 }, { shotId: 'V01', duration: 5 }, { shotId: 'V02', duration: 5 }],
  { platform: 'xiaohongshu', targetDuration: 15 });
assert('全部同长被拦截', !sameDur.pass && sameDur.issues.some(i => i.includes('时长相同')));
const okPkg = guard.verifyPackage(
  [{ shotId: 'S00', sceneType: 'opening', duration: 3 }, { shotId: 'V01', duration: 4 }, { shotId: 'V02', duration: 6 }],
  { platform: 'xiaohongshu', targetDuration: 13 });
assert('合规作品结构通过', okPkg.pass, okPkg.issues.join(';'));

console.log('\n📋 商品定妆照风格化闸机');
const branch = new ProductPortraitBranch();
const tasks = branch.plan({ products: [{ id: 'QS1', name: '千问AI眼镜S1', category: '3C' }] });
const t0 = tasks[0];
assert('闸机拦截未回填参考图', branch.checkStylizationReady(t0).blocked);
t0.stages.referenceSearch.referenceImages = [
  { url: 'https://example.com/a.jpg', source: '天猫旗舰店' },
  { url: 'https://example.com/b.jpg', source: '官网' }
];
assert('缺基准图仍拦截', branch.checkStylizationReady(t0).blocked);
t0.stages.processing.outputBaseImage = '/tmp/base.png';
assert('参考图+基准图齐备放行', branch.checkStylizationReady(t0).ready);
t0.stages.referenceSearch.referenceImages[0].aiGenerated = true;
assert('AI生成图冒充被拦截', branch.checkStylizationReady(t0).blocked);

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
