#!/usr/bin/env node
/**
 * 【横纹肌溶解EP01】批量渲染管线 v2（修复角色一致性）
 * 9镜并行提交，自动轮询下载
 * 修复：注入角色mandatoryPrompt + referenceImages + 音色描述
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

// 角色配置：每镜涉及的角色列表
const SHOT_CHARACTERS = {
  'S01': ['chen-nurse'],
  'S02': ['xiaoG'],
  'S03': [], // 纯毕方+医学透视，无人类角色
  'S04': ['chen-nurse'],
  'S05': ['chen-nurse'],
  'S06': ['chen-nurse'],
  'S07': ['chen-nurse'],
  'S08': ['chen-nurse'],
  'S09': ['xiaoG', 'chen-nurse']
};

// 音色描述（注入到每镜prompt开头）
const VOICE_ANCHOR = "温柔女声语速适中吐字清晰健康科普主持人亲和力权威感音量平稳";

// 9镜Prompt数据
const SHOTS = [
  {
    id: 'S01',
    prompt: `中景，健康科普讲堂，Nirath星球风格的未来感医疗空间，淡蓝与暖白渐变墙面，悬浮全息投影屏显示"横纹肌溶解"细胞结构动画，护士陈女士站在讲台中央，浅蓝色护士制服笔挺，白色围裙整洁，左胸白色姓名牌右胸红色十字徽章，护士帽平整，听诊器挂颈，手持银色激光教鞭指向屏幕，黑色短发低马尾，鹅蛋脸杏仁眼淡粉唇膏，表情专业亲和，目光正视镜头，身体微微前倾呈讲解姿态，讲台上有山海经图腾装饰的医学模型，背景隐约可见毕方剪影，环境光为柔和顶光+侧光勾勒轮廓，体积光从顶部天窗洒落形成丁达尔效应，画面色调清新专业，医疗纪录片质感，3D渲染，电影摄影，高清，正面构图，人物占画面中央60%`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S02',
    prompt: `中景切特写，小G坐在听众席第一排，双手托腮，内双棕色大眼睛睁大，黑色短发蓬松额前呆毛翘起，圆脸婴儿肥，嘴角倔强上扬，表情充满好奇与期待，身穿深绿色探险夹克，卡其色工装裤膝盖磨白，棕色皮靴鞋头划痕，腰间黄铜旧指南针，目光投向画面左侧，随后镜头平摇 revealing 毕方优雅站立于讲台旁的展示台上，毕方通体赤红羽毛鲜艳如火焰，单足独立姿态挺拔如鹤，翅膀收拢紧贴身体，长颈微曲呈倾听状，眼中灵光温和呈琥珀色，喙部洁白如玉，尾羽修长下垂，展示台周围有淡蓝色生物扫描光环旋转，全息屏显示"肌肉健康指数：优秀"，环境为柔和漫反射光，粉紫与暖金色调交织，科普课堂氛围温馨轻松，CG渲染，电影摄影，浅景深，焦点在小G面部与毕方之间自然过渡，侧光勾勒毕方红色羽毛层次与光泽，羽毛边缘泛金红色微光，画面细腻柔和，治愈感`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S03',
    prompt: `特写转中景，医学透视画面，毕方身体半透明化处理，内部肌肉组织结构清晰可见，肌纤维呈现鲜红色正常状态，随后部分肌纤维开始断裂溶解，像被腐蚀的丝线般崩解，深色物质从破裂细胞中渗出进入血管系统，镜头跟随血管流向推进，画面半透明效果逐渐消失 revealing 毕方外在变化：红色羽毛根部开始泛出暗紫与褐红色斑块，如同淤血在羽毛间扩散，羽毛光泽逐渐暗淡，单足开始微微颤抖支撑不稳，身体重心晃动，颈部低垂，翅膀略微张开试图平衡，展示台全息数据流从绿色变为黄色"肌细胞损伤检测：异常"，背景色调从淡蓝渐变为暗红，体积光变暗呈病态穿透感，3D渲染，电影摄影，动态模糊表现颤抖，写实医学动画风格，情绪紧张，侧面逆光构图突出身体轮廓变化`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S04',
    prompt: `中景，医学透视画面，毕方站立姿态身体半透明化，内部血管系统高亮显示，深色肌红蛋白物质在血液中流动，镜头跟随血流推进至肾脏区域，肾脏过滤系统超负荷运转闪烁红色警报，随后画面切换至排泄系统特写，透明淡黄色尿液逐渐变深，经过棕褐色最终呈现深茶色与酱油色，液体颜色变化过程清晰渐变，护士陈女士手指从画面左侧伸入指向变化区域，浅蓝色护士制服袖口白色滚边，银色手表可见，身后屏幕同步放大显示"尿液颜色变化对照图"，环境光为冷蓝与暖白交织，科技感医学影像风格，画面底部有半透明信息条显示"肌红蛋白尿：横纹肌溶解的典型信号"，3D渲染，高清，信息图可视化设计，焦点在液体颜色渐变区域，构图左侧人物手势右侧病灶示意图`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S05',
    prompt: `近景，毕方全身肌肉肿胀状态，躯干与腿部肌肉明显膨大，轮廓失去原有优雅线条变得臃肿沉重，羽毛因肿胀而蓬起杂乱，红色被暗红与灰紫色调主导，单足艰难支撑身体摇晃明显，翅膀低垂拖地无法收拢，颈部完全低垂至胸前呈极度疲惫状，喙部闭合但呼吸急促胸部起伏剧烈，眼中灵光消失呈浑浊暗淡，展示台全息屏红色警报"运动功能严重受损"，地面有阴影暗示即将倒下，护士陈女士在画面左侧手持平板记录数据，浅蓝色护士制服，白色围裙腰部系带，黑色短发低马尾，鹅蛋脸表情严肃关切，背景为深灰与暗紫，底光打出不安感，侧光强烈对比突出肿胀轮廓，体积光稀薄如病态黄昏，空气中漂浮微粒暗示代谢废物堆积，3D渲染，电影摄影，写实医学纪录片风格，情绪沉重压抑，低角度仰拍强化脆弱感，构图人物占画面70%`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S06',
    prompt: `中景，毕方状态急剧恶化，身体倾斜即将倒下，单足已经无法支撑，膝盖弯曲触地，翅膀完全展开拍打地面试图起身但无力，羽毛大面积脱落飘散在空中，暗紫色斑块扩散至全身90%区域，眼部半闭瞳孔涣散，喙部微张喘息急促，胸部剧烈起伏，展示台全息屏闪烁深红色"危险：急性肾损伤风险"，地面有液体渗出暗示尿液异常，背景转为暗红与黑色交织，顶部灯光熄灭仅剩底部冷光源，环境充满危机感，护士陈女士从画面右侧快步靠近，浅蓝色护士制服在暗光下轮廓清晰，听诊器挂颈晃动，手持急救箱，黑色短发低马尾，鹅蛋脸表情凝重紧急，体积光呈暗红色如血液般浓稠，空气中弥漫烟雾状粒子，3D渲染，电影摄影，高对比度光影，手持摄影晃动增强紧张感，情绪危急紧迫，侧面构图，人物与异兽占画面中央80%`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S07',
    prompt: `中景，护士陈女士正面站立，浅蓝色护士制服左胸白色姓名牌右胸红色十字徽章，白色围裙腰部系带，黑色短发低马尾刘海向右，鹅蛋脸杏仁眼淡粉唇膏，双手平举掌心向上呈"总结"手势，表情认真清晰，身后全息投影屏分为三个竖栏快速轮播：第一栏显示肌肉损伤画面配红色文字"信号一：肌肉剧痛肿胀"，第二栏显示茶色尿液配深褐色文字"信号二：尿液呈茶色或酱油色"，第三栏显示无力倒下画面配暗紫色文字"信号三：全身无力站不稳"，三个画面以0.5秒间隔快速切换形成快闪效果，环境回到淡蓝暖白专业色调，顶光+双侧补光均匀，背景为Nirath星球医疗讲堂，画面底部有半透明横幅显示"记住这三个信号"，3D渲染，电影摄影，分屏快闪特效，信息可视化风格，正面居中构图，人物占画面下40%，上方60%展示三栏信息`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S08',
    prompt: `中景，护士陈女士面向镜头，浅蓝色护士制服笔挺肩章闪亮，白色围裙整洁，左胸白色姓名牌右胸红色十字徽章，黑色短发低马尾，鹅蛋脸表情严肃转为关切，杏仁眼温柔，手持一张医院急诊科的蓝色指引卡片，卡片上有白色十字标志和"急诊科"字样，左手伸出食指和中指呈"二"的手势，右手托着卡片展示给镜头，听诊器挂颈，身后屏幕显示医院大楼外观与救护车图标，环境为暖白与淡蓝的专业医疗空间，灯光柔和均匀，画面左侧有小字提示"及时就医，避免肾损伤"，右侧有毕方剪影呈健康姿态作为对比，身后有淡金色光环象征专业权威，3D渲染，电影摄影，正面平视构图，人物占画面中央55%，背景清晰展示医疗元素，色调温暖可信，情绪坚定有力但不恐吓，传递专业信赖感`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S09',
    prompt: `特写切中景，小G面部恍然大悟表情，内双棕色大眼睛睁大，黑色短发蓬松额前呆毛翘起，圆脸婴儿肥嘴角上扬露出不齐门牙，右手握拳轻敲左掌呈"明白了"手势，深绿色探险夹克，卡其色工装裤，棕色皮靴，随后镜头拉远 revealing 护士陈女士微笑点头，浅蓝色护士制服白色围裙，黑色短发低马尾，鹅蛋脸杏仁眼淡粉唇膏，毕方完全恢复健康状态站立在展示台上，羽毛鲜艳如新，单足挺拔，长颈高昂呈自信姿态，翅膀优雅收拢尾羽轻摆，三人同框画面温馨，背景是Nirath星球医疗讲堂全景，顶部天窗洒落明亮自然光，暖金与淡蓝交织的治愈色调，全息投影屏显示"下一集：为什么会发生横纹肌溶解？"配问号图标与山海经图腾logo，画面边缘有轻微光晕柔化，底部有字幕条"关注我，健康不迷路"，3D渲染，电影摄影，温暖希望氛围，正面全景构图，人物位于画面下三分之一处，上方留白展示预告标语，尾声定格感，期待感`,
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
      .replace(/，3D渲染/g, '')
      .replace(/，电影摄影/g, '')
      .replace(/，高清/g, '')
      .replace(/，CG渲染/g, '');
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
  
  // 🔑 关键修复：Prompt中必须引用"图片n"，API才知道使用参考图！
  // 官方要求："提示词中必须使用'素材类型+序号'格式引用素材"
  let finalPrompt = enhancedPrompt;
  if (refImages.length > 0) {
    const refs = refImages.map((_, i) => `图片${i+1}`).join('、');
    const refTag = `（人物形象严格参考${refs}）`;
    
    // 检查加入引用后是否超长（不能超过490字）
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
    ratio: shot.ratio,
    duration: shot.duration
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

  return await response.json();
}

// 查询任务状态
async function getTask(taskId) {
  const response = await fetch(`${BASE_URL}/api/v3/contents/generations/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

// 下载视频
async function downloadVideo(url, outputPath) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  fss.writeFileSync(outputPath, Buffer.from(buffer));
  return outputPath;
}

// 主流程
async function main() {
  console.log(`🎬 开始生产: ${STORY_ID} (v2 修复版)`);
  console.log(`📊 总计 ${SHOTS.length} 个镜头`);
  console.log(`🎭 角色系统: ${cm.listCharacters().map(c => c.name).join(', ')}`);
  
  // 检查角色状态
  const requiredChars = ['chen-nurse', 'xiaoG'];
  for (const charId of requiredChars) {
    const char = cm.loadCharacter(charId);
    if (!char) {
      console.warn(`⚠️ 角色 ${charId} 不存在！将使用Prompt自发描述。`);
    } else {
      const portraitCount = char.generatedAssets?.portraits?.length || 0;
      console.log(`✅ 角色 ${char.name} 已加载，${portraitCount} 张定妆照`);
    }
  }
  
  // 确保目录存在
  if (!fss.existsSync(SHOTS_DIR)) {
    fss.mkdirSync(SHOTS_DIR, { recursive: true });
  }
  
  // 1. 并行提交所有镜头
  const tasks = [];
  for (const shot of SHOTS) {
    try {
      console.log(`\n🎥 提交镜头 ${shot.id}...`);
      const enhancedPrompt = buildEnhancedPrompt(shot);
      console.log(`   增强后Prompt: ${enhancedPrompt.length}字`);
      
      const result = await createTask(shot);
      const taskId = result.id;
      
      // 保存任务信息
      const taskFile = path.join(SHOTS_DIR, `${shot.id}-task-v2.json`);
      fss.writeFileSync(taskFile, JSON.stringify({
        shotId: shot.id,
        taskId: taskId,
        originalPrompt: shot.prompt,
        enhancedPrompt: enhancedPrompt,
        characters: SHOT_CHARACTERS[shot.id] || [],
        duration: shot.duration,
        submittedAt: new Date().toISOString()
      }, null, 2));
      
      tasks.push({ shotId: shot.id, taskId, status: 'submitted' });
      console.log(`✅ ${shot.id} → taskId: ${taskId}`);
    } catch (err) {
      console.error(`❌ ${shot.id} 提交失败:`, err.message);
      tasks.push({ shotId: shot.id, taskId: null, status: 'failed', error: err.message });
    }
  }

  // 2. 保存任务清单
  fss.writeFileSync(
    path.join(WORK_DIR, 'production', 'tasks-v2.json'),
    JSON.stringify(tasks, null, 2)
  );

  console.log(`\n📋 已提交 ${tasks.filter(t => t.status === 'submitted').length}/${SHOTS.length} 个镜头`);
  console.log(`⏳ 开始轮询等待渲染完成...`);

  // 3. 轮询等待
  let pending = tasks.filter(t => t.status === 'submitted');
  let attempts = 0;
  const maxAttempts = 120;

  while (pending.length > 0 && attempts < maxAttempts) {
    attempts++;
    console.log(`\n🔄 轮询 #${attempts}，${pending.length} 个任务待完成...`);
    
    for (const task of pending) {
      try {
        const status = await getTask(task.taskId);
        const taskStatus = status.status;
        
        if (taskStatus === 'succeeded') {
          const videoUrl = status.content?.video_url || status.video_url;
          if (videoUrl) {
            const outputPath = path.join(SHOTS_DIR, `${task.shotId}-v2.mp4`);
            await downloadVideo(videoUrl, outputPath);
            task.status = 'done';
            task.videoPath = outputPath;
            console.log(`✅ ${task.shotId} 渲染完成 → ${outputPath}`);
          } else {
            task.status = 'error';
            task.error = 'No video URL in response';
            console.error(`⚠️ ${task.shotId} 成功但无视频URL`);
          }
        } else if (taskStatus === 'failed' || taskStatus === 'expired' || taskStatus === 'cancelled') {
          task.status = 'failed';
          task.error = `Task ${taskStatus}`;
          console.error(`❌ ${task.shotId} 任务${taskStatus}`);
        } else {
          console.log(`⏳ ${task.shotId}: ${taskStatus}`);
        }
      } catch (err) {
        console.error(`⚠️ ${task.shotId} 轮询出错:`, err.message);
      }
    }

    pending = tasks.filter(t => t.status === 'submitted');
    
    if (pending.length > 0) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // 4. 输出生产报告
  const report = {
    storyId: STORY_ID,
    version: 'v2',
    completedAt: new Date().toISOString(),
    totalShots: SHOTS.length,
    completed: tasks.filter(t => t.status === 'done').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    tasks: tasks
  };

  fss.writeFileSync(
    path.join(WORK_DIR, 'production', 'report-v2.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`\n🏁 生产完成！`);
  console.log(`✅ 成功: ${report.completed}/${report.totalShots}`);
  console.log(`❌ 失败: ${report.failed}/${report.totalShots}`);
  
  if (report.failed > 0) {
    console.log('\n⚠️ 以下镜头需要重试：');
    tasks.filter(t => t.status === 'failed').forEach(t => {
      console.log(`  - ${t.shotId}: ${t.error}`);
    });
  }
}

main().catch(err => {
  console.error('💥 生产管线崩溃:', err);
  process.exit(1);
});
