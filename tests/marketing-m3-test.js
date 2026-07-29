'use strict';

/**
 * marketing-m3-test.js — SocialPack M3 模块级测试
 * 覆盖：HookPerformanceStore / PlatformVariantFanner / 数据回流反哺钩子策略
 * 运行: node tests/marketing-m3-test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { HookPerformanceStore } = require('../hyperreality-system/engines/production-engine/agents/hook-performance-store');
const { PlatformVariantFanner } = require('../hyperreality-system/engines/production-engine/agents/platform-variant-fanner');

let passed = 0, failed = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${detail}`); failed++; }
}

const TMP_FILE = path.join(os.tmpdir(), `hook-perf-test-${Date.now()}.json`);

console.log('📋 数据回流：钩子表现存储');
const store = new HookPerformanceStore({ file: TMP_FILE });
store.record('tiktok', 'data-shock', { completionRate: 0.48, ctr: 0.055, conversionRate: 0.02 });
store.record('tiktok', 'data-shock', { completionRate: 0.44, ctr: 0.049, conversionRate: 0.02 });
store.record('tiktok', 'question', { completionRate: 0.40, ctr: 0.040, conversionRate: 0.01 });
const ranked = store.rankStyles('tiktok');
assert('滚动平均正确（0.48+0.44)/2=0.46', Math.abs(ranked.find(r => r.style === 'data-shock').avgCompletion - 0.46) < 1e-9);
assert('得分排序 data-shock 第一', ranked[0].style === 'data-shock');
assert('样本计数正确', ranked.find(r => r.style === 'data-shock').samples === 2);
const rec = store.recommend('tiktok', ['pattern-interrupt', 'question', 'data-shock', 'contrast']);
assert('推荐序列数据优先', rec[0].style === 'data-shock' && rec[0].evidence.includes('完播'));
assert('未测风格按默认序补后且证据为空', rec[2].style === 'pattern-interrupt' && rec[2].evidence === null);
// 持久化往返
const store2 = new HookPerformanceStore({ file: TMP_FILE });
assert('持久化往返一致', store2.rankStyles('tiktok')[0].style === 'data-shock');
// 空库回退
const emptyStore = new HookPerformanceStore({ file: path.join(os.tmpdir(), `hook-perf-empty-${Date.now()}.json`) });
const recEmpty = emptyStore.recommend('instagram-reels', ['aesthetic-first-frame', 'pattern-interrupt']);
assert('空库回退 Profile 默认序', recEmpty[0].style === 'aesthetic-first-frame' && recEmpty[0].evidence === null);

console.log('\n📋 平台变体扇出');
const brief = {
  product: '千问办公（QwenWork）', platform: 'tiktok', goal: 'seeding',
  ctaText: 'Try QwenWork today · Link in bio',
  ctaTextByPlatform: { douyin: '点下方链接，立即体验', xiaohongshu: '主页有完整教程合集' },
  sellingPoints: ['一句话生成全套PPT', '任务级交付不止回答', '深度钉钉集成']
};
const skeleton = [
  { shotId: 'V01', fn: 'hook', duration: 4, sellingPoint: '一句话生成全套PPT',
    dialogueBlocks: [{ start: 0, end: 4, action: '揉着太阳穴', emo: '自嘲' }],
    lines: { tiktok: 'Still building slides at midnight?', douyin: '还在半夜改 PPT 吗', xiaohongshu: '十分钟做完一天的活？', 'instagram-reels': 'Slides done before coffee?' } },
  { shotId: 'V02', fn: 'demo', duration: 6, sellingPoint: '任务级交付不止回答',
    dialogueBlocks: [{ start: 0, end: 3, action: '盯着屏幕', emo: '笃定' }],
    lines: { tiktok: 'One sentence. A full deck.', douyin: '一句话，一整套。', xiaohongshu: '一句话就够了', 'instagram-reels': 'One line. Full deck.' } },
  { shotId: 'V03', fn: 'cta', duration: 4, isFinal: true,
    dialogueBlocks: [{ start: 0, end: 3, action: '背包起身', emo: '轻快' }],
    lines: { tiktok: 'Your evenings are yours again.', douyin: '夜晚还是你的', xiaohongshu: '下班，走人。', 'instagram-reels': 'Evenings back.' } }
];
const fanner = new PlatformVariantFanner({ feedbackStore: store });
const { matrix, variants } = fanner.fanOut(brief, skeleton, ['tiktok', 'douyin', 'xiaohongshu', 'instagram-reels']);
assert('四平台变体全产出', Object.keys(variants).length === 4 && matrix.length === 4);
assert('时长钳入平台带（TikTok 6s→5s）', variants.tiktok[1].duration === 5);
assert('小红书时长带 3-6 不钳', variants.xiaohongshu[1].duration === 6);
assert('TikTok 钩子采用数据证明的 data-shock', variants.tiktok[0].hookStrategy.style === 'data-shock' && variants.tiktok[0].hookStrategy.evidence.includes('完播'));
assert('IG 无数据回退默认钩子且无证据', variants['instagram-reels'][0].hookStrategy.style === 'aesthetic-first-frame' && variants['instagram-reels'][0].hookStrategy.evidence === null);
assert('CTA 按平台本地化', matrix.find(m => m.platform === 'douyin').ctaText === '点下方链接，立即体验');
assert('未指定平台用字幕语言默认 CTA', matrix.find(m => m.platform === 'instagram-reels').ctaText === 'Follow for more · Link in bio');
assert('台词本地化注入变体', variants.douyin[0].dialogueBlocks[0].line === '还在半夜改 PPT 吗' && variants.douyin[0].dialogueBlocks[0].localized === true);
assert('约束模板按平台画幅（小红书 3:4）', variants.xiaohongshu[0].constraintTemplate.includes('3:4'));
assert('CTA 镜 isFinal 标记', variants.tiktok[2].isFinal === true);
assert('变体矩阵表可渲染', fanner.renderMatrixTable(matrix).split('\n').length === 6);
// 缺本地化标记
const skel2 = [{ shotId: 'W01', fn: 'hook', duration: 3, dialogueBlocks: [{ start: 0, end: 3, line: 'EN only line' }], lines: {} }];
const v2 = fanner.fanOut(brief, skel2, ['douyin']).variants;
assert('缺本地化平台标"待本地化"（禁冒充成品）', v2.douyin[0]._needsLocalization === true);

console.log(`\n📊 SocialPack M3 模块测试: ${passed} 通过, ${failed} 失败`);
try { fs.unlinkSync(TMP_FILE); } catch (_) {}
process.exit(failed > 0 ? 1 : 0);
