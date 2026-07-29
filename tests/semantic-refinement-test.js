'use strict';

/**
 * 三段式混合生产（v2.4.5）单元测试
 * 覆盖：PromptDeliveryGuard 闸机判定 + SemanticRefinementPass 应用/回退结构
 */

const { PromptDeliveryGuard } = require('../hyperreality-system/engines/production-engine/agents/prompt-delivery-guard.js');
const { SemanticRefinementPass } = require('../hyperreality-system/engines/production-engine/agents/semantic-refinement-pass.js');

let passed = 0, failed = 0;
function assert(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${detail}`); }
}

// ---------- 测试夹具：合规提示词（25 字段 + 台词） ----------
const GOOD_PROMPT = [
  '【语言约束】全部字段必须使用中文输出，禁止出现英文单词、英文短语、英文描述。',
  '【导演意图】诺兰式手持主观：观众替主角完成动作，恐惧被压缩成算力而非崩溃，画面随步伐冲击起伏，把几秒拉成一次心跳',
  '【基础】8K resolution, cinematic quality, film grain, professional color grading, highly detailed, photorealistic, sharp focus, ultra high definition, lifelike textures',
  '【约束】16:9画幅，8K分辨率，24fps，MP4格式，时长8秒，台词唇形同步开启',
  '【场景】午后硬光草原，半人高的枯黄草丛，女孩跌坐在草窝里，一头狒狒低吼冲锋，少年从画面右侧斜向切入，草茎被奔跑压出通道',
  '【灯光设计】正午顶光略偏侧，5600K 冷白硬质阳光，人物面部均匀受光，草尖泛白、草下阴影浓重，尘土在光柱中呈金色颗粒',
  '【明亮约束】主体面部明亮清晰，阴影保留层次不死黑',
  '【构图】手持中景跟随少年侧后方，女孩与狒狒在纵深处形成三角对峙，绳索从左下甩向右上的对角线轨迹',
  '【色彩/色调】枯黄草海为主调，尘土金褐，狒狒灰棕毛发，红披风在手持晃动中成为画面唯一跳动的色块',
  '【景深】浅景深跟随少年，纵深狒狒轻微失焦制造信息压迫',
  '【运镜】28mm 手持与少年同视角同节奏奔跑，画面随步频冲击性起伏',
  '【角色】少年，14 岁，瘦高挺拔，深棕色皮肤，极短卷发，琥珀色眼睛，右耳一枚小铜耳环，神情专注而安静',
  '【服装】红色格纹披风单肩斜披，腰系深棕牛皮带，带上挂传统投石索，脚踝彩色串珠脚链，赤足',
  '【化妆】面部带真实草屑与薄汗，膝盖蹭有红土，禁止精致妆感',
  '【动作】少年右手从腰间皮兜抽索、旋绳两圈、出手一气呵成，左手在奔跑中保持平衡，石弹击中狒狒前爪旁的土地炸起土柱',
  '【道具】传统投石索（皮编兜+双股编绳+一枚河卵石）为绝对主角道具，绳索磨损包浆与指痕清晰可见',
  '【定妆照】绑定少年定妆照 V1：红格纹披风、小铜耳环、串珠脚链、投石索四锚点逐镜一致',
  '【台词】[03s-08s] 陈工 蹲身递出平板, 诚恳 说:"我们缺个会读草原的人。"',
  '【时间轴】T00:00 - 车辆碾尘停下 [运镜:低机位弧线];T00:03 - 开箱递出平板，台词开始;T00:07 - 两人隔着设备箱对视',
  '【情绪】少年的眼神是双重表情：表层是陌生人的戒备（眉心收紧、视线压低），底层是藏不住的好奇（瞳孔放大、眨眼频率变快）',
  '【节奏】前 3 秒悬疑蓄势，台词段节奏放缓，结尾 2 秒留给好奇心的萌发',
  '【转场】指尖碰到机臂的特写叠化至下一镜监控屏蓝光——从触摸机器到驾驭机器，三个月被一枚指尖省略',
  '【音频】草原风声、无人机箱卡扣弹开的脆响、车辆引擎熄火后的金属冷却声，台词人声清晰贴脸，远处有牛羊铃',
  '【负面约束】禁止暗黑风格调，禁止金属光泽皮肤，no dark style, no metallic gloss, no cartoon, no anime, no face distortion, no watermark',
  '【角色约束】本镜仅少年与工程师两人，禁止其他人物入画',
  '【角色一致性】披风格纹主色、右耳铜耳环、脚踝串珠脚链、腰间投石索四锚点与前后镜头完全一致，场景地理方向与光线方向跨镜连续'
].join(' | ');

const SHOT = { shotId: 'S03', duration: 8, dialogueBlocks: [{ character: '陈工', line: '我们缺个会读草原的人。' }] };

(async () => {
  console.log('\n📋 PromptDeliveryGuard 闸机判定');
  const guard = new PromptDeliveryGuard();

  const g1 = guard.verify(GOOD_PROMPT, SHOT);
  assert('合规提示词通过闸机', g1.pass, g1.issues.join(';'));

  const noDialogue = GOOD_PROMPT.replace(/ \| 【台词】[^|]*/, '');
  const g2 = guard.verify(noDialogue, SHOT);
  assert('有台词数据但缺台词字段被拦截', !g2.pass && g2.issues.some(i => i.includes('台词')));

  const g3 = guard.verify(GOOD_PROMPT, { shotId: 'S04', duration: 10 });
  assert('无台词镜头出现台词字段被拦截', !g3.pass);

  const fastTalk = GOOD_PROMPT.replace('我们缺个会读草原的人。', '我们缺个会读草原的人而且我们找了很久很久终于找到你了。');
  const g4 = guard.verify(fastTalk, SHOT);
  assert('台词超速被拦截', !g4.pass && g4.issues.some(i => i.includes('超速')));

  const keywordMood = GOOD_PROMPT.replace(/少年的眼神是双重表情[^|]*/, '紧张，神秘，充满悬念');
  const g5 = guard.verify(keywordMood, SHOT);
  assert('情绪关键词式写法被拦截', !g5.pass && g5.issues.some(i => i.includes('情绪')));

  const shortPrompt = '【场景】一片草原。【情绪】平静。【时间轴】T00:00。';
  const g6 = guard.verify(shortPrompt, SHOT);
  assert('缺字段+长度不足被拦截', !g6.pass && g6.issues.length >= 2);

  console.log('\n📋 SemanticRefinementPass 应用/回退结构');

  const p1 = new SemanticRefinementPass({
    callLLM: async () => ({ result: { prompt: GOOD_PROMPT.replace('禁止精致妆感', '零精致妆感'), actions: [{ type: '水分压缩', field: '化妆', description: '同义改写压缩' }] } })
  });
  const r1 = await p1.refine(GOOD_PROMPT, SHOT);
  assert('合规语义输出被应用', r1.applied && r1.prompt.includes('零精致妆感') && r1.actions.length === 1);

  const p2 = new SemanticRefinementPass({
    callLLM: async () => ({ result: { prompt: '【场景】草原。【情绪】平静。【时间轴】T00:00。', actions: [{ type: '水分压缩', field: '全部', description: '过度压缩' }] } })
  });
  const r2 = await p2.refine(GOOD_PROMPT, SHOT);
  assert('语义输出被守卫拦截时回退规则结果', !r2.applied && r2.prompt === GOOD_PROMPT && /守卫拦截/.test(r2.fallbackReason));

  const p3 = new SemanticRefinementPass({
    callLLM: async () => { throw new Error('LLM timeout'); }
  });
  const r3 = await p3.refine(GOOD_PROMPT, SHOT);
  assert('LLM异常时安全回退', !r3.applied && r3.prompt === GOOD_PROMPT);

  const p4 = new SemanticRefinementPass({
    callLLM: async () => ({ result: null })
  });
  const r4 = await p4.refine(GOOD_PROMPT, SHOT);
  assert('LLM返回为空时安全回退', !r4.applied && r4.prompt === GOOD_PROMPT);

  console.log(`\n📊 语义精炼层测试: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });
