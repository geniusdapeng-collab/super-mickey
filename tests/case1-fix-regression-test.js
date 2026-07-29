'use strict';
/**
 * case1-fix-regression-test.js — v2.10.1 修复回归（用例1发现问题的复现断言）
 * 断言全部通过退出码 0，否则 1。
 */
const assert = require('assert');
const { MarketingDurationBridge, FN_TO_ROLE } = require('../hyperreality-system/engines/production-engine/agents/marketing-duration-bridge.js');
const { ProductTruthChecker } = require('../hyperreality-system/engines/production-engine/agents/product-truth-checker.js');
const { resolveProfile, PROFILES, isSocialCommerce } = require('../hyperreality-system/config/platform-profiles.js');

let passed = 0;
function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { console.error(`  ❌ ${name} ${extra}`); process.exitCode = 1; }
}

console.log('\n[回归1] BUG-01：回退分配职能权重（demo 必须最长，opening 不得独大）');
{
  const bridge = new MarketingDurationBridge();
  // 用例1原始场景：douyin 20s/5镜（allocator L2 超载触发非主路径）
  const out = bridge.allocate({
    shots: [
      { shotId: 'S00', fn: 'opening' },
      { shotId: 'S01', fn: 'hook', lineChars: 14 },
      { shotId: 'S02', fn: 'demo', lineChars: 30 },
      { shotId: 'S03', fn: 'seeding', lineChars: 28 },
      { shotId: 'S04', fn: 'cta', lineChars: 12 }
    ],
    totalDuration: 20, platform: 'douyin'
  });
  const d = Object.fromEntries(out.shots.map(s => [s.fn, s.duration]));
  console.log('  分配结果:', JSON.stringify(d), 'warnings:', out.warnings);
  ok('demo 时长 >= hook', d.demo >= d.hook, JSON.stringify(d));
  ok('demo 时长 >= opening', d.demo >= d.opening, JSON.stringify(d));
  ok('cta 时长 <= demo', d.cta <= d.demo, JSON.stringify(d));
  ok('全部落带 [2,5]', out.shots.every(s => s.duration >= 2 && s.duration <= 5));
  ok('总时长 = 20', out.total === 20, String(out.total));
  ok('镜头非全同长', new Set(out.shots.map(s => s.duration)).size > 1);
  ok('FN_TO_ROLE 已导出', FN_TO_ROLE && FN_TO_ROLE.demo === 'demonstration');
}

console.log('\n[回归2] BUG-04：L2 超载优先压缩态带内等比收缩（warning 语义可辨）');
{
  const bridge = new MarketingDurationBridge();
  const out = bridge.allocate({
    shots: [
      { shotId: 'S00', fn: 'opening' },
      { shotId: 'S01', fn: 'hook', lineChars: 14 },
      { shotId: 'S02', fn: 'demo', lineChars: 30 },
      { shotId: 'S03', fn: 'seeding', lineChars: 28 },
      { shotId: 'S04', fn: 'cta', lineChars: 12 }
    ],
    totalDuration: 20, platform: 'douyin'
  });
  const usedBandFit = out.warnings.some(w => w.includes('带内等比收缩'));
  console.log('  warnings:', out.warnings);
  ok('L2 超载走压缩态带内等比收缩（而非盲权重回退）', usedBandFit);
}

console.log('\n[回归3] BUG-02：领域法定禁用表述派生 + 直白禁用词冲突拦截');
{
  const checker = new ProductTruthChecker();
  const notes = [
    { dimension: '使用前提与依赖条件', fact: '驾驶须持有效驾驶证并上牌', source: '官网' },
    { dimension: '能力/效果边界', fact: 'CLTC续航为工况法测试值，实际受工况影响', source: '官网' },
    { dimension: '官方宣传口径', fact: '长续航后驱版CLTC 830km', source: '官网' },
    { dimension: '价格与购买履约方式', fact: '官网下单，预计2-4周交付', source: '官网' },
    { dimension: '绑定/App依赖', fact: '远程车控需要下载Tesla App并绑定车辆', source: '官网' },
    { dimension: '联网依赖', fact: '远程控制需车辆处于4G/Wi-Fi覆盖区', source: '媒体' },
    { dimension: '账号生态依赖', fact: '车辆绑定Tesla账户体系', source: '媒体' },
    { dimension: '离线能力边界', fact: '无网络区域远程车控不可用', source: '媒体' },
    { dimension: '续航与充电方式', fact: '250kW超充15分钟补能约250km', source: '官方' },
    { dimension: '兼容机型/系统', fact: 'App支持iOS与Android', source: '媒体' },
    { dimension: '智驾功能边界与官方口径', fact: '辅助驾驶为L2级，驾驶员必须全程监控，不得宣称自动驾驶', source: '官网' },
    { dimension: '购车资质与交付履约', fact: '新能源牌照政策因城市而异', source: '官网' },
    { dimension: '充电网络与使用依赖', fact: '全国2600+座超充站', source: '官方' }
  ];
  const base = checker.verify({ brief: { product: '特斯拉Model 3', category: '智能电动车（汽车）', customDimensions: ['智驾功能边界与官方口径', '购车资质与交付履约', '充电网络与使用依赖'] }, researchNotes: notes, creative: { premise: '正常创意' } });
  ok('pass 正常创意', base.pass === true, JSON.stringify(base.issues));
  const hasAutoBan = base.factBaseline.forbiddenClaims.some(f => f.includes('自动驾驶'));
  ok('派生领域禁用表述"自动驾驶"', hasAutoBan, JSON.stringify(base.factBaseline.forbiddenClaims));
  // 恶意创意必须被拦截
  const evil = checker.verify({ brief: { product: '特斯拉Model 3', category: '智能电动车（汽车）', customDimensions: ['智驾功能边界与官方口径', '购车资质与交付履约', '充电网络与使用依赖'] }, researchNotes: notes, creative: { premise: '开上它，自动驾驶通勤，解放双手喝咖啡' } });
  ok('拦截"自动驾驶"冲突创意', evil.pass === false && evil.conflicts.length > 0, JSON.stringify(evil.conflicts));
  // Brief 自定义注入
  const custom = checker.verify({ brief: { product: '特斯拉Model 3', category: '智能电动车（汽车）', forbiddenClaims: ['续航第一'], customDimensions: ['智驾功能边界与官方口径', '购车资质与交付履约', '充电网络与使用依赖'] }, researchNotes: notes, creative: { premise: '续航第一，无人能敌' } });
  ok('Brief 自定义禁用词"续航第一"拦截', custom.pass === false && custom.conflicts.length > 0);
}

console.log('\n[回归4] BUG-03：新平台蓝图可解析 + 未覆盖平台回退警告');
{
  for (const p of ['wechat-channels', 'kuaishou', 'bilibili']) {
    const prof = resolveProfile({ platform: p });
    ok(`${p} 蓝图在场且为营销包`, prof.platformKey === p && isSocialCommerce(prof), prof.platformKey);
  }
  const bili = resolveProfile({ platform: 'bilibili' });
  ok('bilibili 为 16:9 横屏', bili.ratio === '16:9');
  const unknown = resolveProfile({ platform: 'weibo' });
  ok('未覆盖平台输出 fallbackWarning', !!unknown.fallbackWarning, JSON.stringify(unknown));
  ok('未覆盖平台回退 cinematic', unknown.platformKey === 'cinematic');
  // 时长桥透传警告
  const bridge = new MarketingDurationBridge();
  const out = bridge.allocate({ shots: [{ shotId: 'S00', fn: 'opening' }, { shotId: 'S01', fn: 'hook', lineChars: 10 }, { shotId: 'S02', fn: 'demo', lineChars: 20 }], totalDuration: 12, platform: 'weibo' });
  ok('时长桥透传回退警告', out.warnings.some(w => w.includes('未在蓝图库覆盖')), JSON.stringify(out.warnings));
  // B站平台端到端分配可走通
  const biliOut = bridge.allocate({ shots: [{ shotId: 'S00', fn: 'opening' }, { shotId: 'S01', fn: 'hook', lineChars: 12 }, { shotId: 'S02', fn: 'demo', lineChars: 30 }, { shotId: 'S03', fn: 'cta', lineChars: 10 }], totalDuration: 25, platform: 'bilibili' });
  ok('bilibili 分配全落带 [3,10]', biliOut.shots.every(s => s.duration >= 3 && s.duration <= 10), JSON.stringify(biliOut.shots));
}

console.log(`\n========== 回归结果: ${passed} 项通过, 退出码 ${process.exitCode || 0} ==========\n`);
process.exit(process.exitCode || 0);
