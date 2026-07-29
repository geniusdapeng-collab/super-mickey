'use strict';

/**
 * M1 验收演示：千问办公（QwenWork）× TikTok 种草短视频
 * ------------------------------------------------------------
 * 全链路实跑 SocialPack 模块（非手写模拟）：
 *   Brief 规范化 → 确认单 → 平台蓝图解析 → 画面文字三层设计 →
 *   25+1 字段组装（LLM 环节由 Agent 承担）→ 交付守卫终验
 */

const { MarketingBriefParser } = require('../hyperreality-system/skills/marketing-brief');
const { resolveProfile, constraintTemplateOf } = require('../hyperreality-system/config/platform-profiles');
const { OnscreenTextDesigner } = require('../hyperreality-system/engines/production-engine/agents/onscreen-text-designer');
const { PromptDeliveryGuard } = require('../hyperreality-system/engines/production-engine/agents/prompt-delivery-guard');

// ========== 1. Brief 输入（基于千问办公公开产品信息整理） ==========
const rawBrief = {
  product: '千问办公（QwenWork）',
  category: '服务',
  sellingPoints: '一句话生成全套PPT；任务级交付不止回答；深度钉钉集成',
  audience: '25-40 岁职场白领、远程办公人群、PPT/文档重度用户',
  goal: 'seeding',
  platform: 'tiktok',
  brand: { color: '阿里橙' },
  ctaText: 'Try QwenWork today · Link in bio',
  duration: 30
};

const parser = new MarketingBriefParser();
const { brief, issues: briefIssues } = parser.normalize(rawBrief);
console.log('===== 1. Brief 规范化 =====');
console.log(JSON.stringify(brief, null, 2));
console.log('规范化提示:', briefIssues.length ? briefIssues : '（无）');
console.log('\n===== 2. Brief 确认单 =====');
console.log(parser.generateConfirmationSheet(brief));

// ========== 2. 三个样例镜头（钩子/演示/CTA 尾镜） ==========
const designer = new OnscreenTextDesigner();
const guard = new PromptDeliveryGuard();
const blueprint = { platform: 'tiktok' };

const shots = [
  {
    shotId: 'T01', duration: 4, isFinal: false, platform: 'tiktok',
    sellingPoint: '一句话生成全套PPT',
    dialogueBlocks: [{ line: 'Still building slides at midnight?', start: 0, end: 4, action: '揉着太阳穴', emo: '自嘲' }],
    fields: {
      语言约束: '全部字段必须使用中文输出（台词与画面文字按平台语言为英文），禁止出现无关英文单词、英文短语、英文描述。',
      导演意图: 'TikTok 原生钩子：前 2 秒 pattern interrupt，把"午夜还在做幻灯片"的疲惫直接砸在屏幕上，商品以手机屏形态在钩子窗口在场',
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
      节奏: '前 1 秒压抑定格，后 3 秒缓慢推近，鼓点卡点进场',
      转场: '硬切至下一镜手机屏亮起',
      音频: '键盘零星敲击声、空调低频嗡鸣、卡点鼓点由弱渐强',
      角色约束: '本镜仅白领一人',
      角色一致性: '黑框眼镜、浅灰衬衫、短发微乱跨镜一致'
    }
  },
  {
    shotId: 'T02', duration: 5, isFinal: false, platform: 'tiktok',
    sellingPoint: '任务级交付，不止回答',
    dialogueBlocks: [
      { line: 'One sentence. A full deck.', start: 0, end: 3, action: '盯着屏幕', emo: '笃定' },
      { line: 'Done.', start: 3, end: 4, action: '靠上椅背', emo: '释然' }
    ],
    fields: {
      语言约束: '全部字段必须使用中文输出（台词与画面文字按平台语言为英文），禁止出现无关英文单词、英文短语、英文描述。',
      导演意图: '产品演示镜：一句话指令到整套 PPT 翻页生成的爽感释放，UI 用实拍绑定保证真实可信',
      基础: '8K resolution, cinematic quality, film grain, professional color grading, highly detailed, photorealistic, sharp focus, ultra high definition, lifelike textures',
      场景: '同一工位，手机屏亮起，千问办公对话框里一行字发送出去，PPT 页面在屏上连续翻飞生成',
      灯光设计: '手机屏阿里橙暖光在脸上跳动成为主光源，屏幕生成瞬间面部被点亮，背景保持冷蓝',
      明亮约束: '手机屏内容清晰可读不过曝，面部受光均匀，高光不溢出',
      构图: '竖屏过肩构图，手机屏居中偏上，人物侧脸在左下三分之一',
      '色彩/色调': '阿里橙 UI 与冷蓝环境强对比，生成完成瞬间整体色温转暖',
      景深: '焦点锁在手机屏 UI，人物侧脸微虚，背景全虚',
      运镜: '固定机位微推，随页面翻飞做轻微手持呼吸感',
      角色: '28 岁白领男性，黑框眼镜，浅灰衬衫，表情从紧绷到松开',
      服装: '浅灰衬衫，袖口卷至小臂',
      化妆: '自然素面，眼下有淡青',
      动作: '拇指敲下一行字按下发送，PPT 页面在屏上翻飞生成，人物向后靠上椅背',
      道具: '手机（千问办公 App 界面）、笔记本电脑、咖啡杯',
      定妆照: '绑定白领定妆照 V1；千问办公 App 界面实拍截图绑定（QW-UI-001），禁止虚构 UI 元素',
      时间轴: 'T00:00 - 敲字发送;T00:01 - 首页封面生成;T00:02 - 内页连续翻飞;T00:03 - 靠上椅背;T00:04 - 生成完成提示',
      情绪: '瞳孔随翻页点亮，嘴角不自觉上扬，眉毛挑起一次，呼气时肩膀松开',
      节奏: '前半拍点紧凑随翻页加速，完成音效处停顿半秒释放',
      转场: 'PPT 末页定格叠化至下一镜',
      音频: '消息发送提示音、翻页嗖声连击、生成完成音效上扬、鼓点收束',
      角色约束: '本镜仅白领一人，手机屏幕为第一主体',
      角色一致性: '黑框眼镜、浅灰衬衫、短发微乱跨镜一致'
    }
  },
  {
    shotId: 'T03', duration: 4, isFinal: true, platform: 'tiktok',
    sellingPoint: '深度钉钉集成',
    dialogueBlocks: [{ line: 'Your evenings are yours again.', start: 0, end: 3, action: '背包起身', emo: '轻快' }],
    fields: {
      语言约束: '全部字段必须使用中文输出（台词与画面文字按平台语言为英文），禁止出现无关英文单词、英文短语、英文描述。',
      导演意图: 'CTA 收尾镜：关灯下班的爽感定格，CTA 收尾字强制在场停留不少于 1.5 秒，钉钉集成消息一闪而过强化协同卖点',
      基础: '8K resolution, cinematic quality, film grain, professional color grading, highly detailed, photorealistic, sharp focus, ultra high definition, lifelike textures',
      场景: '工位台灯熄灭，人物背包起身，手机屏上钉钉协作消息弹出"文档已同步"，办公室沉入暖夜色',
      灯光设计: '台灯熄灭瞬间暖光消失，只剩手机屏橙光与城市窗景远光，轮廓光勾出人物剪影',
      明亮约束: '人物剪影轮廓清晰，手机屏消息可读，窗外城市光斑保留层次',
      构图: '竖屏全景构图，人物居中走向画面深处，CTA 收尾字预留画面中央安全区',
      '色彩/色调': '暖夜色主调，阿里橙手机光收束视觉焦点，整体松弛',
      景深: '中景深，人物与手机锐利，窗景光斑柔化',
      运镜: '固定机位，人物纵深走远，轻微手持呼吸感',
      角色: '28 岁白领男性，黑框眼镜，背包甩上单肩，步伐轻快',
      服装: '浅灰衬衫，外套搭在小臂，背包单肩',
      化妆: '自然素面',
      动作: '合上笔记本电脑，台灯按灭，背包甩上单肩，看一眼手机笑一下转身走人',
      道具: '笔记本电脑、台灯、手机（钉钉消息弹窗）、背包',
      定妆照: '绑定白领定妆照 V1；钉钉消息弹窗实拍截图绑定（DD-MSG-002）',
      时间轴: 'T00:00 - 合电脑;T00:01 - 台灯熄灭;T00:02 - 钉钉消息弹出;T00:03 - 转身走人，CTA 定格',
      情绪: '眼角放松带笑纹，嘴角上扬，步伐有弹性，背影挺拔',
      节奏: '前 2 秒收束放缓，CTA 出现处定格静止',
      转场: '定格结束，CTA 收尾字呼吸灯式停留',
      音频: '合盖声、开关轻响、脚步声渐远、Lo-fi 收尾旋律',
      角色约束: '本镜仅白领一人',
      角色一致性: '黑框眼镜、浅灰衬衫跨镜一致'
    }
  }
];

// ========== 3. 组装 + 守卫终验 ==========
const FIELD_ORDER = ['语言约束', '导演意图', '基础', '约束', '场景', '灯光设计', '明亮约束', '构图', '色彩/色调', '景深', '运镜', '角色', '服装', '化妆', '动作', '道具', '定妆照', '台词', '时间轴', '情绪', '节奏', '转场', '音频', '画面文字设计', '负面约束', '角色约束', '角色一致性'];

console.log('\n===== 3. 镜头提示词（模块实跑组装 + 守卫终验） =====');
const results = [];
for (const shot of shots) {
  const profile = resolveProfile(shot, blueprint);
  // 【约束】由蓝图模板生成（constraintTemplateOf 是唯一来源）
  const constraint = `${constraintTemplateOf(profile)}，时长${shot.duration}秒，台词唇形同步开启`;
  // 【台词】由数据层 dialogueBlocks 渲染（含多台词块换行）
  const dlg = shot.dialogueBlocks.map(b => {
    const pad = n => String(n).padStart(2, '0');
    return `[${pad(b.start)}s-${pad(b.end)}s] 白领 ${b.action || ''}, ${b.emo || '平静'} 说:"${b.line}"`;
  }).join('\n');
  // 【画面文字设计】由 OnscreenTextDesigner 实跑生成
  const textDesign = designer.design(shot, profile, brief).fieldText;
  // 【负面约束】营销分支（与 prompt-fusion-agent 同款）
  const negative = 'no watermark, no platform UI, no garbled text, no distorted typography, no blurry, no low quality, no deformed hands; 禁止系统水印，禁止乱码与扭曲文字，禁止平台界面元素入画';

  const bodies = { ...shot.fields, 约束: constraint, 台词: dlg, 画面文字设计: textDesign, 负面约束: negative };
  const prompt = FIELD_ORDER.map(f => `【${f}】${bodies[f]}`).join(' | ');
  const g = guard.verify(prompt, shot);
  results.push({ shot, prompt, guard: g });
  console.log(`\n--- ${shot.shotId}（${shot.duration}s${shot.isFinal ? ' · 尾镜' : ''}）守卫: ${g.pass ? '✅ PASS' : '❌ ' + g.issues.join('; ')} · ${g.charCount}字符 · ${g.fieldCount}字段 ---`);
  console.log(prompt);
}

const allPass = results.every(r => r.guard.pass);
console.log(`\n===== 验收结果: ${allPass ? '全部通过 ✅' : '存在失败 ❌'} =====`);
process.exit(allPass ? 0 : 1);
