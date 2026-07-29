'use strict';

/**
 * 社媒营销包 SocialPack（v2.5.0 · M1）单元测试
 * 覆盖：平台蓝图 / 画面文字设计器 / 合规闸机 / 守卫场景链 / 精炼器画幅分流
 */

const { PROFILES, resolveProfile, constraintTemplateOf, isSocialCommerce } = require('../hyperreality-system/config/platform-profiles.js');
const { OnscreenTextDesigner } = require('../hyperreality-system/engines/production-engine/agents/onscreen-text-designer.js');
const { MarketingComplianceGuard } = require('../hyperreality-system/engines/production-engine/agents/marketing-compliance-guard.js');
const { PromptDeliveryGuard } = require('../hyperreality-system/engines/production-engine/agents/prompt-delivery-guard.js');
const { FieldContentRefiner } = require('../hyperreality-system/engines/production-engine/agents/field-content-refiner.js');

let passed = 0, failed = 0;
function assert(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${detail}`); }
}

console.log('\n📋 P0-2 平台规格蓝图');
const tt = resolveProfile({ platform: 'tiktok' });
assert('TikTok 画幅 9:16', tt.ratio === '9:16');
assert('TikTok 台词速率上调', tt.speechRate.normal === 4.5 && tt.speechRate.limit === 5.5);
assert('TikTok 钩子窗口 2 秒且商品在场', tt.hook.windowSec === 2 && tt.hook.productInHook);
assert('TikTok 识别为社媒营销场景', isSocialCommerce(tt));
const cine = resolveProfile({});
assert('默认回退电影叙事 16:9', cine.ratio === '16:9' && !isSocialCommerce(cine));
assert('约束模板按蓝图生成', constraintTemplateOf(tt).startsWith('9:16画幅'));

console.log('\n📋 P0-3 画面文字设计器（三层体系）');
const designer = new OnscreenTextDesigner();
const brief = { sellingPoints: ['一句话生成全套办公文档', '本地文件直接编辑', '98元/月'], brand: { color: '阿里橙' }, ctaText: 'Follow · Link in bio' };
const shot = {
  shotId: 'T03', duration: 4,
  dialogueBlocks: [{ line: 'Stop typing. Start delegating.', start: 0, end: 4 }],
  sellingPoint: '一句话生成全套办公文档'
};
const d = designer.design(shot, tt, brief);
assert('字幕条跟随台词生成', d.layers.subtitle.length === 1 && d.layers.subtitle[0].text.includes('delegating'));
assert('卖点花字分配且 ≤12 字', d.layers.flower.length === 1 && d.layers.flower[0].text.length <= 12);
assert('非尾镜无 CTA', d.layers.cta.length === 0);
const dFinal = designer.design({ ...shot, isFinal: true }, tt, brief);
assert('尾镜 CTA 强制在场', dFinal.layers.cta.length === 1 && dFinal.layers.cta[0].minHoldSec >= 1.5);
assert('字段文本含安全区声明', /安全区/.test(d.fieldText));
assert('字段文本三层格式', /字幕条\[/.test(d.fieldText) && /卖点花字\[/.test(d.fieldText));

console.log('\n📋 P1-7 营销合规闸机（阻断式）');
const compliance = new MarketingComplianceGuard();
const hitCN = compliance.check('【台词】[00s-04s] 主播 说:"这是全网最低价的神器。"');
assert('中文极限词被阻断', !hitCN.pass && hitCN.hits.some(h => h.level.includes('L1')));
const hitEN = compliance.check('【台词】[00s-04s] Host says:"Guaranteed results, 100% risk-free."');
assert('英文欺骗性宣称被阻断', !hitEN.pass && hitEN.hits.some(h => h.level.includes('L2')));
const clean = compliance.check('【场景】办公桌前，一个人把文档拖进对话框。【台词】[00s-03s] 他 说:"十分钟，做完一天的活。"');
assert('合规内容放行', clean.pass, JSON.stringify(clean.hits));
const noScan = compliance.check('【导演意图】用全网最低级的运镜');
assert('非观众载体字段不扫描（避免误伤创作）', noScan.pass);

console.log('\n📋 交付守卫·社媒营销场景链');
const guard = new PromptDeliveryGuard();
const MKT_FIELDS = [
  '【语言约束】全部字段必须使用中文输出，禁止出现英文单词、英文短语、英文描述。',
  '【导演意图】TikTok 原生钩子：前 2 秒 pattern interrupt，把"加班到深夜"的疲惫直接砸在屏幕上，钩子落在"咖啡还没凉"的反差上',
  '【基础】8K resolution, cinematic quality, film grain, professional color grading, highly detailed, photorealistic, sharp focus, ultra high definition, lifelike textures',
  '【约束】9:16画幅，8K分辨率，24fps，MP4格式，时长4秒，台词唇形同步开启',
  '【场景】深夜写字楼大开间，工位尽头只剩一盏台灯，一个人对着满屏未命名文档揉太阳穴，手机屏忽然亮起，千问办公对话框里一句话生成全套 PPT，封面动画正在渲染',
  '【灯光设计】屏幕冷光为主光源勾勒侧脸轮廓，办公室顶灯压暗只留环境底光，手机屏暖光在脸上跳动，PPT 生成瞬间面部被点亮',
  '【明亮约束】主体面部明亮清晰，阴影保留层次不死黑',
  '【构图】竖屏中心构图，人物居下三分之一，手机屏在黄金分割点',
  '【色彩/色调】冷蓝办公环境与阿里橙手机光对撞，品牌色锚定',
  '【景深】浅景深，手机屏锐利，背景文档墙虚化',
  '【运镜】手持快速推近，0.5 秒从全景怼到手机屏特写',
  '【角色】28 岁白领男性，黑框眼镜，衬衫领口微敞，疲惫但眼神亮',
  '【服装】浅灰衬衫，袖口卷至小臂',
  '【化妆】自然素面，眼下有淡青，禁止精致妆感',
  '【动作】手指在手机上敲下一行字按下发送，PPT 页面在屏上翻飞生成，人物向后靠上椅背长出一口气',
  '【道具】手机、笔记本电脑、咖啡杯（半凉）',
  '【定妆照】绑定白领定妆照 V1：黑框眼镜、浅灰衬衫',
  '【台词】[00s-04s] 白领 盯着屏幕, 惊喜 说:"咖啡没凉，活干完了。"',
  '【时间轴】T00:00 - 疲惫全景 [运镜:手持推近];T00:02 - 敲字;T00:03 - PPT 翻飞生成',
  '【情绪】眼神从疲惫到瞳孔点亮，嘴角不自觉上扬，眉毛挑起一次，肩膀随呼气松开',
  '【节奏】前 1 秒压抑，后 3 秒释放，卡点剪辑',
  '【转场】PPT 页面翻飞叠化至下一镜',
  '【音频】键盘敲击声、消息提示音、卡点鼓点，PPT 生成完成音效上扬',
  '【负面约束】no watermark, no garbled text, no blurry; 禁止系统水印，禁止乱码',
  '【角色约束】本镜仅白领一人',
  '【角色一致性】黑框眼镜、浅灰衬衫跨镜一致',
  '【画面文字设计】字幕条[0s-4s] "咖啡没凉，活干完了"（安全区内底部上方；TikTok 原生字幕样式）；卖点花字[1s-4s] "十分钟做完一天活"（上 1/3 安全区；弹跳入场）；全程遵守安全区：避开右侧 120px 与底部 320px'
].join(' | ');
const MKT_SHOT = { shotId: 'T01', duration: 4, platform: 'tiktok', dialogueBlocks: [{ line: '咖啡没凉，活干完了。', start: 0, end: 4 }] };

const g1 = guard.verify(MKT_FIELDS, MKT_SHOT);
assert('合规营销镜头通过守卫', g1.pass, g1.issues.join(';'));

const noText = MKT_FIELDS.replace(/ \| 【画面文字设计】[^|]*/, '');
assert('缺画面文字设计被拦截', !guard.verify(noText, MKT_SHOT).pass);

// 速率差分用例：14 字 / [00s-03s] = 4.7字/秒，电影档 4.5 拦截、TikTok 档 5.5 放行；
// 时长占比 14/4.5≈3.1s ≤ 4s×80%，不触发总占比守卫
const fastOK = MKT_FIELDS.replace(
  '[00s-04s] 白领 盯着屏幕, 惊喜 说:"咖啡没凉，活干完了。"',
  '[00s-03s] 白领 盯着屏幕, 惊喜 说:"十分钟做完一天的活儿准点下班"'
);
const g3 = guard.verify(fastOK, MKT_SHOT);
assert('营销速率 4.7字/秒 放行（电影档 4.5 会拦）', g3.pass || !g3.issues.some(i => i.includes('超速')), g3.issues.join(';'));
const g3cine = guard.verify(fastOK, { shotId: 'S01', duration: 4 });
assert('同一速率电影档 4.5 拦截（差分反证）', g3cine.issues.some(i => i.includes('超速')));

const extreme = MKT_FIELDS.replace('咖啡没凉，活干完了。', 'The best office tool, guaranteed results.');
const g4 = guard.verify(extreme, MKT_SHOT);
assert('极限词/欺骗宣称被合规阻断', !g4.pass && g4.issues.some(i => i.includes('合规阻断')));

const bigFlower = MKT_FIELDS.replace('十分钟做完一天活', '十分钟做完一天活还能准点下班回家吃饭');
const g5 = guard.verify(bigFlower, MKT_SHOT);
assert('花字超 12 字被拦截', !g5.pass && g5.issues.some(i => i.includes('花字')));

const finalShot = { ...MKT_SHOT, isFinal: true };
const g6 = guard.verify(MKT_FIELDS, finalShot);
assert('尾镜缺 CTA 被拦截', !g6.pass && g6.issues.some(i => i.includes('CTA')));

console.log('\n📋 精炼器·营销画幅分流');
const refiner = new FieldContentRefiner({ constraintTemplate: '16:9画幅，8K分辨率，24fps，MP4格式' });
const specPrompt = '【约束】9:16画幅，8K分辨率，24fps，MP4格式';
const rTiktok = refiner.refinePrompt(specPrompt, { shotId: 'T01', platform: 'tiktok' });
assert('TikTok 镜头约束保持 9:16', rTiktok.includes('9:16'));
const refiner2 = new FieldContentRefiner({ constraintTemplate: '16:9画幅，8K分辨率，24fps，MP4格式' });
const rCine = refiner2.refinePrompt('【约束】16:9画幅，8K分辨率，24fps，MP4格式', { shotId: 'S01' });
assert('电影镜头约束保持 16:9', rCine.includes('16:9'));

console.log(`\n📊 SocialPack M1 测试: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
