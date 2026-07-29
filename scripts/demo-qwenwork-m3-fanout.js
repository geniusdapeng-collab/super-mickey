'use strict';

/**
 * M3 验收演示：千问办公一次 Brief → 四平台变体扇出 + 数据回流反哺钩子
 * ------------------------------------------------------------
 * 实跑模块链：HookPerformanceStore（注入示例数据，tmp 文件不入库）→
 * PlatformVariantFanner → 变体矩阵 → 每平台钩子镜全字段组装 → 交付守卫终验
 * 钩子文案跟随数据回流的策略推荐（TikTok=data-shock 为示例数据驱动）
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { HookPerformanceStore } = require('../hyperreality-system/engines/production-engine/agents/hook-performance-store');
const { PlatformVariantFanner } = require('../hyperreality-system/engines/production-engine/agents/platform-variant-fanner');
const { MarketingSkillRouter } = require('../hyperreality-system/skills/social-marketing/marketing-skill-router');
const { resolveProfile, constraintTemplateOf } = require('../hyperreality-system/config/platform-profiles');
const { OnscreenTextDesigner } = require('../hyperreality-system/engines/production-engine/agents/onscreen-text-designer');
const { ProductHeroDesigner } = require('../hyperreality-system/engines/production-engine/agents/product-hero-designer');
const { BgmStrategyDesigner } = require('../hyperreality-system/engines/production-engine/agents/bgm-strategy-designer');
const { PromptDeliveryGuard } = require('../hyperreality-system/engines/production-engine/agents/prompt-delivery-guard');
const { MarketingBriefParser } = require('../hyperreality-system/skills/marketing-brief');

// ========== 1. 示例投放数据回流（tmp 文件，不入库、不冒充真实数据） ==========
const TMP_STORE = path.join(os.tmpdir(), `hook-perf-demo-${Date.now()}.json`);
const store = new HookPerformanceStore({ file: TMP_STORE });
console.log('===== 1. 数据回流（示例数据注入，仅演示用） =====');
store.record('tiktok', 'data-shock', { completionRate: 0.48, ctr: 0.055, conversionRate: 0.021 });
store.record('tiktok', 'data-shock', { completionRate: 0.44, ctr: 0.049, conversionRate: 0.019 });
store.record('tiktok', 'question', { completionRate: 0.40, ctr: 0.041, conversionRate: 0.012 });
console.log('TikTok 钩子排行:', JSON.stringify(store.rankStyles('tiktok')));

// ========== 2. Brief + 骨架 ==========
const parser = new MarketingBriefParser();
const { brief } = parser.normalize({
  product: '千问办公（QwenWork）', category: '服务',
  sellingPoints: ['一句话生成全套PPT', '任务级交付不止回答', '深度钉钉集成'],
  audience: '25-40 岁职场白领', goal: 'seeding', platform: 'tiktok',
  brand: { color: '阿里橙' },
  ctaText: 'Try QwenWork today · Link in bio',
  ctaTextByPlatform: { douyin: '点下方链接，立即体验', xiaohongshu: '主页有完整教程合集' },
  duration: 30,
  productHero: {
    heroImageId: 'QW-HERO-001',
    materials: ['磨砂玻璃质感UI卡片', '金属边框倒角'],
    logo: { position: '界面左上角', minSizePct: 5 },
    closeups: ['生成按钮按下瞬间', 'PPT 翻页动效', '钉钉同步弹窗']
  }
});

const skeleton = [
  { shotId: 'V01', fn: 'hook', duration: 4, sellingPoint: '一句话生成全套PPT',
    dialogueBlocks: [{ start: 0, end: 4, action: '揉着太阳穴', emo: '自嘲' }],
    lines: { tiktok: 'Ten minutes for a full day of work.', douyin: '还在半夜改PPT吗', xiaohongshu: '十分钟做完一天的活？', 'instagram-reels': 'Slides done before coffee?' } },
  { shotId: 'V02', fn: 'demo', duration: 6, sellingPoint: '任务级交付不止回答',
    dialogueBlocks: [{ start: 0, end: 3, action: '盯着屏幕', emo: '笃定' }],
    lines: { tiktok: 'One sentence. A full deck.', douyin: '一句话，一整套。', xiaohongshu: '一句话就够了', 'instagram-reels': 'One line. Full deck.' } },
  { shotId: 'V03', fn: 'cta', duration: 4, isFinal: true, sellingPoint: '深度钉钉集成',
    dialogueBlocks: [{ start: 0, end: 3, action: '背包起身', emo: '轻快' }],
    lines: { tiktok: 'Your evenings are yours again.', douyin: '夜晚还是你的', xiaohongshu: '下班，走人。', 'instagram-reels': 'Evenings back.' } }
];

// ========== 3. 扇出 + 变体矩阵 ==========
const fanner = new PlatformVariantFanner({ feedbackStore: store });
const PLATFORMS = ['tiktok', 'douyin', 'xiaohongshu', 'instagram-reels'];
const { matrix, variants } = fanner.fanOut(brief, skeleton, PLATFORMS);
console.log('\n===== 2. 变体矩阵 =====');
console.log(fanner.renderMatrixTable(matrix));

// ========== 4. 每平台钩子镜全字段组装 + 技能路由（真实元数据） + 守卫终验 ==========
const textDesigner = new OnscreenTextDesigner();
const heroDesigner = new ProductHeroDesigner();
const bgmDesigner = new BgmStrategyDesigner();
const skillRouter = new MarketingSkillRouter();
const guard = new PromptDeliveryGuard();
const FIELD_ORDER = ['语言约束', '导演意图', '基础', '约束', '场景', '灯光设计', '明亮约束', '构图', '色彩/色调', '景深', '运镜', '角色', '服装', '化妆', '动作', '道具', '定妆照', '商品锚点', '商品一致性', '台词', '时间轴', '情绪', '节奏', '转场', '音频', '配乐', '画面文字设计', '负面约束', '角色约束', '角色一致性'];

// 钩子镜场景文案（LLM 环节，跟随各平台钩子策略与 copyStyle）
const HOOK_COPY = {
  tiktok: { intent: '数据冲击钩子（数据回流第1位：完播46%）：把"十分钟 vs 一整天"的数字对撞砸在前 2 秒，数字花字占视觉重心', emo: '疲惫' },
  douyin: { intent: '疑问式钩子（无数据默认序第1位）：前 3 秒痛点提问"还在半夜改PPT吗"，大字幕强 CTA 风格，信息密度拉满', emo: '扎心' },
  xiaohongshu: { intent: 'aesthetic 首帧钩子（默认序）：审美先行——深夜工位的电影感空镜渐入人物，价值预览"十分钟做完一天的活"轻量浮现', emo: '静谧' },
  'instagram-reels': { intent: 'aesthetic 首帧钩子（默认序）：首帧即海报级构图，英文短句克制，氛围感优先于信息密度', emo: 'moody' }
};

console.log('\n===== 3. 各平台钩子镜（全字段 + 技能命中 + 守卫终验） =====');
const results = [];
for (const key of PLATFORMS) {
  const vshot = variants[key][0];
  const profile = resolveProfile(vshot, vshot.blueprint);
  // 技能路由：真实元数据匹配（fn=hook，风格=数据回流推荐，平台/目标随行）
  const matched = skillRouter.match({ fn: 'hook', style: vshot.hookStrategy.style, platform: key, goal: brief.goal }, 1);
  const skillHit = matched.length ? matched[0].skill.file : null;
  const copy = HOOK_COPY[key];
  const pad = n => String(n).padStart(2, '0');
  const dlg = vshot.dialogueBlocks.map(b => `[${pad(b.start)}s-${pad(Math.min(b.end, vshot.duration))}s] 白领 ${b.action}, ${b.emo} 说:"${b.line}"`).join('\n');
  const fields = {
    语言约束: `全部字段必须使用中文输出（台词与画面文字按平台语言为${profile.subtitleLanguage === 'en' ? '英文' : '中文'}），禁止出现无关外文单词与短语。`,
    导演意图: copy.intent,
    基础: '8K resolution, cinematic quality, film grain, professional color grading, highly detailed, photorealistic, sharp focus, ultra high definition, lifelike textures',
    场景: '深夜写字楼大开间，工位尽头只剩一盏台灯，白板写满改到第五版的方案标题，一个人对着满屏未命名文档揉太阳穴',
    灯光设计: '屏幕冷光为主光源勾勒侧脸轮廓，办公室顶灯压暗只留环境底光，台灯暖光在桌面切出一小块孤岛',
    明亮约束: '主体面部明亮清晰，眼白与瞳孔高光可辨，阴影保留层次不死黑',
    构图: '竖屏中心构图，人物居下三分之一，电脑屏在黄金分割点，头顶留出花字安全区',
    '色彩/色调': '冷蓝办公环境与阿里橙手机光对撞，品牌色锚定，整体低饱和',
    景深: '浅景深，电脑屏与面部锐利，背景文档墙虚化成冷色光斑',
    运镜: '手持快速推近，0.5 秒从全景怼到电脑屏特写，带轻微呼吸晃动',
    角色: '28 岁白领男性，黑框眼镜，衬衫领口微敞，疲惫但眼神亮',
    服装: '浅灰衬衫，袖口卷至小臂，工牌挂在椅背上',
    化妆: '自然素面，眼下有淡青，禁止精致妆感',
    动作: '手指悬在键盘上停住，端起咖啡杯又放下，视线黏在空白的幻灯片封面上',
    道具: '笔记本电脑（空白 PPT 封面）、咖啡杯（半凉）、手机（屏朝下）',
    定妆照: '绑定白领定妆照 V1：黑框眼镜、浅灰衬衫、短发微乱',
    时间轴: 'T00:00 - 疲惫全景 [运镜:手持推近];T00:01 - 手停键盘;T00:02 - 咖啡杯放下;T00:03 - 视线钉住空白封面',
    情绪: '眼睑半垂又强撑睁开，嘴角下撇，眉心拧起，呼气时肩膀下沉',
    节奏: `前 1 秒压抑定格，后 ${vshot.duration - 1} 秒缓慢推近，鼓点卡点进场`,
    转场: '硬切至下一镜手机屏亮起',
    音频: '键盘零星敲击声、空调低频嗡鸣、卡点鼓点由弱渐强',
    角色约束: '本镜仅白领一人',
    角色一致性: '黑框眼镜、浅灰衬衫、短发微乱跨镜一致'
  };
  const bodies = {
    ...fields,
    约束: `${vshot.constraintTemplate}，时长${vshot.duration}秒，台词唇形同步开启`,
    台词: dlg,
    商品锚点: heroDesigner.designAnchor(vshot, brief).fieldText,
    商品一致性: heroDesigner.designConsistency(brief),
    配乐: bgmDesigner.design(vshot, profile, brief).fieldText,
    画面文字设计: textDesigner.design(vshot, profile, brief).fieldText,
    负面约束: 'no watermark, no platform UI, no garbled text, no distorted typography, no blurry, no low quality, no deformed hands; 禁止系统水印，禁止乱码与扭曲文字，禁止平台界面元素入画'
  };
  const prompt = FIELD_ORDER.map(f => `【${f}】${bodies[f]}`).join(' | ');
  const g = guard.verify(prompt, vshot);
  results.push({ key, vshot, prompt, guard: g, skillHit });
  console.log(`\n--- ${profile.name} V01（${vshot.duration}s · 钩子:${vshot.hookStrategy.style}${vshot.hookStrategy.evidence ? ' · ' + vshot.hookStrategy.evidence : ' · 无数据默认序'}）---`);
  console.log(`技能命中: ${skillHit || '（无）'} | 守卫: ${g.pass ? '✅ PASS' : '❌ ' + g.issues.join('; ')} · ${g.charCount}字符 · ${g.fieldCount}字段`);
  console.log(prompt);
}

const allPass = results.every(r => r.guard.pass);
console.log(`\n===== M3 验收结果: ${allPass ? '四平台钩子镜全部通过 ✅' : '存在失败 ❌'} =====`);
try { fs.unlinkSync(TMP_STORE); } catch (_) {}
process.exit(allPass ? 0 : 1);
