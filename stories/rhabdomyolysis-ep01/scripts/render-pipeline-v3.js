#!/usr/bin/env node
/**
 * 【横纹肌溶解EP01】批量渲染管线 v3（真人模特版）
 * 去掉神兽毕方，换成真人模特李明教练
 * 9镜并行提交，自动轮询下载
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// 引入角色管理系统
const { CharacterManager } = require('../../../systems/character-manager.js');

const STORY_ID = 'rhabdomyolysis-ep01';
const WORK_DIR = path.join(__dirname, '..');
const SHOTS_DIR = path.join(WORK_DIR, 'production', 'shots');

// 火山引擎配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}
const MODEL_ID = 'ep-20260518004622-jp46s'; // Seedance 2.0 自定义接入点
const BASE_URL = 'https://ark.cn-beijing.volces.com';

// 初始化角色管理器
const cm = new CharacterManager();

// 角色配置：每镜涉及的角色列表（v3：去掉毕方，加入coach-li）
const SHOT_CHARACTERS = {
  'S01': ['chen-nurse'],
  'S02': ['xiaoG', 'coach-li'],
  'S03': ['coach-li'],
  'S04': ['coach-li', 'chen-nurse'],
  'S05': ['coach-li', 'chen-nurse'],
  'S06': ['coach-li', 'chen-nurse'],
  'S07': ['chen-nurse'],
  'S08': ['coach-li', 'chen-nurse'],
  'S09': ['xiaoG', 'coach-li', 'chen-nurse']
};

// 音色描述（注入到每镜prompt开头）
const VOICE_ANCHOR = "温柔女声语速适中";

// === 9镜Prompt数据（v3：真人模特版，去掉毕方）===
const SHOTS = [
  {
    id: 'S01',
    prompt: `中景，健康科普讲堂，现代简约风格的医疗教育空间，淡蓝与暖白渐变墙面，悬浮全息投影屏显示"横纹肌溶解"细胞结构动画，陈女士站在讲台中央，蓝色警服外套笔挺肩章银色警衔标识，左胸警号金属牌右胸警徽，内搭白色衬衫深色领带，深蓝色警帽银色帽徽平整，黑色短发低马尾，鹅蛋脸杏仁眼淡粉唇膏，表情专业亲和，目光正视镜头，身体微微前倾呈讲解姿态，左手腕黑色战术手表，右手持激光教鞭指向屏幕，讲台上有运动健康主题装饰，背景隐约可见健身房剪影，环境光为柔和顶光加侧光勾勒轮廓，体积光从顶部天窗洒落形成丁达尔效应，画面色调清新专业，纪录片质感，电影摄影，高清，正面构图，人物占画面中央60%`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S02',
    prompt: `中景切特写，小G坐在听众席第一排，双手托腮，内双棕色大眼睛睁大，黑色短发蓬松额前呆毛翘起，圆脸婴儿肥，嘴角倔强上扬，表情充满好奇与期待，身穿深绿色探险夹克，卡其色工装裤膝盖磨白，棕色皮靴鞋头划痕，腰间黄铜旧指南针，目光投向画面左侧，随后镜头平摇 revealing 李明教练在健身房区域做深蹲示范动作，李明教练深灰色运动polo衫左胸白色运动康复汉字标识，袖子卷至肘部露出结实小臂，黑色运动长裤侧边灰色条纹，白色运动鞋，左手腕黑色运动手表，右手灰色护腕，方圆脸小麦色单眼皮眼神专注，站姿标准背部挺直，双手持杠铃做下蹲动作，动作流畅专业，健身房背景有镜面墙壁和器械架，环境为柔和漫反射光，暖白与淡蓝色调交织，科普课堂氛围温馨轻松，纪录片质感，电影摄影，浅景深，焦点在小G面部与李明教练动作之间自然过渡，侧光勾勒人物轮廓层次`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S03',
    prompt: `特写转中景，医学透视画面，李明教练身体半透明化处理，内部肌肉组织结构清晰可见，肌纤维呈现鲜红色正常状态，随后部分肌纤维开始断裂溶解，像被腐蚀的丝线般崩解，深色物质从破裂细胞中渗出进入血管系统，镜头跟随血管流向推进，画面半透明效果逐渐消失 revealing 李明教练外在变化：面部开始显露疲惫表情，眉头微皱嘴角下拉，深灰色polo衫被汗水浸湿，手臂肌肉出现轻微颤抖，站姿从标准变为重心不稳，全息数据屏显示"肌细胞损伤检测：异常"，背景色调从淡蓝渐变为暗红，体积光变暗呈病态穿透感，纪录片质感，电影摄影，动态模糊表现颤抖，写实医学动画风格，情绪紧张，侧面逆光构图突出身体轮廓变化`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S04',
    prompt: `中景，医学透视画面，李明教练站立姿态身体半透明化，内部血管系统高亮显示，深色肌红蛋白物质在血液中流动，镜头跟随血流推进至肾脏区域，肾脏过滤系统超负荷运转闪烁红色警报，随后画面切换至排泄系统特写，透明淡黄色尿液逐渐变深，经过棕褐色最终呈现深茶色与酱油色，液体颜色变化过程清晰渐变，陈女士手指从画面左侧伸入指向变化区域，蓝色警服外套袖口可见，黑色战术手表，身后屏幕同步放大显示"尿液颜色变化对照图"，环境光为冷蓝与暖白交织，科技感医学影像风格，画面底部有半透明信息条显示"肌红蛋白尿：横纹肌溶解的典型信号"，纪录片质感，高清，信息图可视化设计，焦点在液体颜色渐变区域，构图左侧人物手势右侧病灶示意图`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S05',
    prompt: `近景，李明教练全身肌肉肿胀状态，躯干与手臂肌肉明显膨大，轮廓失去原有线条变得臃肿沉重，深灰色polo衫被绷紧显出肌肉轮廓变形，黑色运动长裤紧绷，面部表情痛苦眉头紧锁，单腿艰难支撑身体摇晃明显，另一只手扶墙试图保持平衡，全息屏红色警报"运动功能严重受损"，地面有阴影暗示即将倒下，陈女士在画面左侧手持平板记录数据，蓝色警服外套白色衬衫深色领带，黑色短发低马尾，鹅蛋脸表情严肃关切，背景为深灰与暗紫，底光打出不安感，侧光强烈对比突出肿胀轮廓，体积光稀薄如病态黄昏，空气中漂浮微粒暗示代谢废物堆积，纪录片质感，电影摄影，写实医学纪录片风格，情绪沉重压抑，低角度仰拍强化脆弱感，构图人物占画面70%`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S06',
    prompt: `中景，李明教练状态急剧恶化，身体倾斜即将倒下，双腿已经无法支撑，膝盖弯曲触地，双手撑地试图起身但无力，面部痛苦扭曲额头冒汗，深灰色polo衫完全湿透，呼吸急促胸部起伏剧烈，全息屏闪烁深红色"危险：急性肾损伤风险"，地面有液体渗出暗示尿液异常，背景转为暗红与黑色交织，顶部灯光熄灭仅剩底部冷光源，环境充满危机感，陈女士从画面右侧快步靠近，蓝色警服外套在暗光下轮廓清晰，警用对讲机晃动，手持急救箱，黑色短发低马尾，鹅蛋脸表情凝重紧急，体积光呈暗红色如血液般浓稠，空气中弥漫烟雾状粒子，纪录片质感，电影摄影，高对比度光影，手持摄影晃动增强紧张感，情绪危急紧迫，侧面构图，人物占画面中央80%`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S07',
    prompt: `中景，陈女士正面站立，蓝色警服外套左胸警号金属牌右胸警徽，白色衬衫深色领带，深蓝色警帽银色帽徽，黑色短发低马尾刘海向右，鹅蛋脸杏仁眼淡粉唇膏，双手平举掌心向上呈"总结"手势，表情认真清晰，左手腕黑色战术手表，身后全息投影屏分为三个竖栏快速轮播：第一栏显示李明教练肌肉肿胀画面配红色文字"信号一：肌肉剧痛肿胀"，第二栏显示茶色尿液配深褐色文字"信号二：尿液呈茶色或酱油色"，第三栏显示李明教练无力倒下画面配暗紫色文字"信号三：全身无力站不稳"，三个画面以0.5秒间隔快速切换形成快闪效果，环境回到淡蓝暖白专业色调，顶光加双侧补光均匀，背景为现代医疗讲堂，画面底部有半透明横幅显示"记住这三个信号"，纪录片质感，电影摄影，分屏快闪特效，信息可视化风格，正面居中构图，人物占画面下40%，上方60%展示三栏信息`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S08',
    prompt: `中景，李明教练面向镜头，深灰色运动polo衫左胸运动康复标识，袖子卷至肘部露出结实健康的小臂，黑色运动长裤灰色条纹，白色运动鞋，左手腕黑色运动手表，右手灰色护腕，方圆脸小麦色单眼皮嘴角自信微笑，做正确拉伸动作姿态标准背部挺直，陈女士站在左侧手持一张医院急诊科的蓝色指引卡片，蓝色警服外套白色衬衫深色领带，黑色短发低马尾，鹅蛋脸表情关切温柔，身后屏幕显示医院大楼外观与救护车图标，环境为暖白与淡蓝的专业医疗空间，灯光柔和均匀，画面左侧有小字提示"及时就医，避免肾损伤"，李明教练健康阳光的身影作为正面示范，身后有淡金色光环象征健康活力，纪录片质感，电影摄影，正面平视构图，人物占画面中央55%，背景清晰展示医疗元素，色调温暖可信，情绪坚定有力但不恐吓，传递专业信赖感`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S09',
    prompt: `特写切中景，小G面部恍然大悟表情，内双棕色大眼睛睁大，黑色短发蓬松额前呆毛翘起，圆脸婴儿肥嘴角上扬露出不齐门牙，右手握拳轻敲左掌呈"明白了"手势，深绿色探险夹克，卡其色工装裤，棕色皮靴，随后镜头拉远 revealing 李明教练微笑站立，深灰色运动polo衫，黑色运动长裤，白色运动鞋，右手竖起大拇指，表情阳光自信，陈女士站在右侧微笑点头，蓝色警服外套白色衬衫深色领带，深蓝色警帽银色帽徽，黑色短发低马尾，鹅蛋脸杏仁眼淡粉唇膏，三人同框画面温馨，背景是现代医疗讲堂全景，顶部天窗洒落明亮自然光，暖金与淡蓝交织的治愈色调，全息投影屏显示"下一集：为什么会发生横纹肌溶解？"配问号图标，画面边缘有轻微光晕柔化，底部有字幕条"关注我，健康不迷路"，纪录片质感，电影摄影，温暖希望氛围，正面全景构图，人物位于画面下三分之一处，上方留白展示预告标语，尾声定格感，期待感`,
    duration: 8,
    ratio: '16:9'
  }
];

/**
 * 构建增强Prompt：注入角色一致性约束 + 音色描述
 */
function buildEnhancedPrompt(shot) {
  let prompt = shot.prompt;
  
  // 1. 注入音色描述（前置）- 简短版
  const voicePrefix = `【音色】温柔女声语速适中，`;
  
  // 2. 组装最终prompt（不额外注入mandatoryPrompt，避免超长）
  // 角色视觉特征已在每个Prompt中明确描述
  let enhancedPrompt = `${voicePrefix}${prompt}`;
  
  // 3. 字数检查（不能超过490字）
  if (enhancedPrompt.length > 490) {
    console.warn(`⚠️ ${shot.id} 增强后Prompt超长: ${enhancedPrompt.length} > 490，尝试压缩...`);
    enhancedPrompt = optimizePromptLength(enhancedPrompt, 490, voicePrefix, prompt);
  }
  
  return enhancedPrompt;
}

/**
 * 智能压缩Prompt
 */
function optimizePromptLength(fullPrompt, maxLength, voicePrefix, originalPrompt) {
  // 策略1：删除音色前缀（最小影响）
  let optimized = originalPrompt;
  
  // 策略2：如果还有空间，加回前缀
  if (optimized.length + voicePrefix.length <= maxLength) {
    optimized = voicePrefix + optimized;
  }
  
  // 策略3：删除次要修饰词
  if (optimized.length > maxLength) {
    optimized = optimized
      .replace(/，画面细腻柔和/g, '')
      .replace(/，治愈感/g, '')
      .replace(/，温馨轻松/g, '')
      .replace(/，情绪沉重压抑/g, '')
      .replace(/，情绪危急紧迫/g, '')
      .replace(/，情绪坚定有力但不恐吓/g, '')
      .replace(/，温暖希望氛围/g, '')
      .replace(/，正面全景构图/g, '，正面构图')
      .replace(/，纪录片质感/g, '')
      .replace(/，电影摄影/g, '')
      .replace(/，高清/g, '')
      .replace(/，写实医学动画风格/g, '');
  }
  
  if (optimized.length > maxLength) {
    // 策略4：删除更多修饰
    optimized = optimized
      .replace(/，体积光[^，]+/g, '')
      .replace(/，丁达尔效应/g, '')
      .replace(/，环境光[^，]+/g, '');
  }
  
  // 最后手段：截断
  if (optimized.length > maxLength) {
    console.warn(`⚠️ 强制截断: ${optimized.length} → ${maxLength}`);
    optimized = optimized.substring(0, maxLength);
  }
  
  return optimized;
}

/**
 * 获取角色的referenceImages
 */
function getReferenceImagesForShot(shot) {
  const characterIds = SHOT_CHARACTERS[shot.id] || [];
  const images = [];
  
  for (const charId of characterIds) {
    try {
      const refs = cm.getReferenceImages(charId, ['front', 'threeQuarter']);
      if (Array.isArray(refs)) {
        for (const ref of refs) {
          if (ref && typeof ref === 'string') {
            images.push(ref);
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ 获取角色 ${charId} 定妆照失败:`, e.message);
    }
  }
  
  // 去重并过滤无效路径
  const validImages = [...new Set(images)].filter(img => img && typeof img === 'string' && img.length > 0);
  
  // 转换为绝对路径并检查存在性
  const existing = [];
  for (const img of validImages) {
    const absPath = path.isAbsolute(img) ? img : path.join(WORK_DIR, '..', '..', img);
    if (fss.existsSync(absPath)) {
      existing.push(absPath);
    }
  }
  
  // 限制数量（Seedance最多支持3张参考图）
  return existing.slice(0, 3);
}

// 创建任务
async function createTask(shot) {
  // 构建增强Prompt
  const enhancedPrompt = buildEnhancedPrompt(shot);
  
  // 获取参考图（定妆照）
  const refImages = getReferenceImagesForShot(shot);
  
  // 🔑 关键：Prompt中必须引用"图片n"
  let finalPrompt = enhancedPrompt;
  if (refImages.length > 0) {
    const refs = refImages.map((_, i) => `图片${i+1}`).join('、');
    const refTag = `（人物形象严格参考${refs}）`;
    
    if ((enhancedPrompt + refTag).length <= 490) {
      finalPrompt = enhancedPrompt + refTag;
      console.log(`   📎 已加入${refImages.length}张参考图引用: ${refs}`);
    } else {
      console.warn(`⚠️ ${shot.id} 加入引用后超长，仅传图不引用`);
    }
  }
  
  // 构建content数组（text必须在images之前）
  const content = [
    {
      type: "text",
      text: finalPrompt
    }
  ];
  
  // 添加referenceImages（转换为base64 data URL）
  for (const imgPath of refImages) {
    if (fss.existsSync(imgPath)) {
      const base64 = fss.readFileSync(imgPath).toString('base64');
      const ext = path.extname(imgPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
        role: "reference_image"
      });
    }
  }
  
  const payload = {
    model: MODEL_ID,
    content: content,
    width: 1280,
    height: 720,
    duration: shot.duration,
    ratio: shot.ratio,
    fps: 30
  };
  
  const response = await fetch(`${BASE_URL}/api/v3/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  const result = await response.json();
  return result;
}

// 轮询任务状态
async function pollTask(taskId, timeout = 1200000) {
  const startTime = Date.now();
  const pollInterval = 30000;
  
  while (Date.now() - startTime < timeout) {
    const response = await fetch(`${BASE_URL}/api/v3/contents/generations/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    if (!response.ok) {
      throw new Error(`Poll failed: HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const status = result.status || result.data?.status;
    
    if (status === 'succeeded') {
      return result;
    } else if (status === 'failed') {
      throw new Error(`Task failed: ${JSON.stringify(result)}`);
    }
    
    await new Promise(r => setTimeout(r, pollInterval));
  }
  
  throw new Error(`Poll timeout after ${timeout}ms`);
}

// 下载视频
async function downloadVideo(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  
  const buffer = await response.arrayBuffer();
  fss.writeFileSync(outputPath, Buffer.from(buffer));
  
  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(1);
  console.log(`   ✅ 下载完成: ${outputPath} (${sizeMB}MB)`);
  return outputPath;
}

// 主流程
async function main() {
  // 确保输出目录存在
  if (!fss.existsSync(SHOTS_DIR)) {
    fss.mkdirSync(SHOTS_DIR, { recursive: true });
  }
  
  console.log('🎬 【横纹肌溶解EP01】v3 真人模特版 批量渲染启动');
  console.log(`📊 共 ${SHOTS.length} 个镜头，${SHOTS.reduce((a, s) => a + s.duration, 0)} 秒总时长\n`);
  
  // 并行提交所有任务
  const tasks = [];
  for (const shot of SHOTS) {
    try {
      console.log(`🚀 提交 ${shot.id} (${shot.duration}秒)...`);
      const result = await createTask(shot);
      
      if (result.data && result.data.id) {
        tasks.push({ shot, taskId: result.data.id });
        console.log(`   ✅ ${shot.id} 任务ID: ${result.data.id}`);
      } else if (result.id) {
        // 兼容直接返回id的格式
        tasks.push({ shot, taskId: result.id });
        console.log(`   ✅ ${shot.id} 任务ID: ${result.id}`);
      } else {
        console.error(`   ❌ ${shot.id} 提交失败:`, result);
      }
    } catch (e) {
      console.error(`   ❌ ${shot.id} 提交异常:`, e.message);
    }
    
    // 小延迟避免并发限制
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n📋 已提交 ${tasks.length}/${SHOTS.length} 个任务`);
  
  // 轮询所有任务
  const results = [];
  for (const { shot, taskId } of tasks) {
    try {
      console.log(`\n⏳ 轮询 ${shot.id} (${taskId})...`);
      const result = await pollTask(taskId);
      
      if (result.data && result.data.video_url) {
        const outputPath = path.join(SHOTS_DIR, `${shot.id}-v3.mp4`);
        await downloadVideo(result.data.video_url, outputPath);
        results.push({ shot, outputPath, status: 'success' });
      } else {
        console.error(`   ❌ ${shot.id} 无视频URL`);
        results.push({ shot, status: 'failed', reason: 'no_video_url' });
      }
    } catch (e) {
      console.error(`   ❌ ${shot.id} 轮询失败:`, e.message);
      results.push({ shot, status: 'failed', reason: e.message });
    }
  }
  
  // 输出报告
  console.log('\n' + '='.repeat(50));
  console.log('📊 渲染报告');
  console.log('='.repeat(50));
  
  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(`✅ 成功: ${success.length}/${results.length}`);
  console.log(`❌ 失败: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ 失败镜头:');
    for (const r of failed) {
      console.log(`   ${r.shot.id}: ${r.reason}`);
    }
  }
  
  if (success.length > 0) {
    console.log('\n✅ 成功文件:');
    for (const r of success) {
      const sizeMB = (fss.statSync(r.outputPath).size / 1024 / 1024).toFixed(1);
      console.log(`   ${r.shot.id}: ${r.outputPath} (${sizeMB}MB)`);
    }
  }
  
  // 生成任务ID记录
  const taskLog = tasks.map(t => `${t.shot.id}: ${t.taskId}`).join('\n');
  fss.writeFileSync(path.join(WORK_DIR, 'production', 'render-tasks-v3.log'), taskLog);
  console.log('\n📝 任务ID已保存到 render-tasks-v3.log');
}

main().catch(console.error);
