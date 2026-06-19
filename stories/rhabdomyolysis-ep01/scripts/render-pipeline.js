#!/usr/bin/env node
/**
 * 【横纹肌溶解EP01】批量渲染管线
 * 9镜并行提交，自动轮询下载
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

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

// 9镜Prompt数据
const SHOTS = [
  {
    id: 'S01',
    prompt: `中景，健康科普讲堂，Nirath星球风格的未来感医疗空间，淡蓝与暖白渐变墙面，悬浮全息投影屏显示"横纹肌溶解"细胞结构动画，穿警服的护士陈女士站在讲台中央，警服笔挺肩章闪亮，护士帽整洁，手持激光教鞭指向屏幕，表情专业亲和，目光正视镜头，身体微微前倾呈讲解姿态，讲台上有山海经图腾装饰的医学模型，背景隐约可见毕方剪影，环境光为柔和顶光+侧光勾勒轮廓，体积光从顶部天窗洒落形成丁达尔效应，画面色调清新专业，医疗纪录片质感，3D渲染，电影摄影，高清，正面构图，人物占画面中央60%`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S02',
    prompt: `中景切特写，小G坐在听众席第一排，双手托腮，眼睛睁大，表情充满好奇与期待，目光投向画面左侧，随后镜头平摇 revealing 毕方优雅站立于讲台旁的展示台上，毕方通体赤红羽毛鲜艳如火焰，单足独立姿态挺拔如鹤，翅膀收拢紧贴身体，长颈微曲呈倾听状，眼中灵光温和呈琥珀色，喙部洁白如玉，尾羽修长下垂，展示台周围有淡蓝色生物扫描光环旋转，全息屏显示"肌肉健康指数：优秀"，环境为柔和漫反射光，粉紫与暖金色调交织，科普课堂氛围温馨轻松，CG渲染，电影摄影，浅景深，焦点在小G面部与毕方之间自然过渡，侧光勾勒毕方红色羽毛层次与光泽，羽毛边缘泛金红色微光，画面细腻柔和，治愈感`,
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
    prompt: `中景，医学透视画面，毕方站立姿态身体半透明化，内部血管系统高亮显示，深色肌红蛋白物质在血液中流动，镜头跟随血流推进至肾脏区域，肾脏过滤系统超负荷运转闪烁红色警报，随后画面切换至排泄系统特写，透明淡黄色尿液逐渐变深，经过棕褐色最终呈现深茶色与酱油色，液体颜色变化过程清晰渐变，陈女士手指从画面左侧伸入指向变化区域，身后屏幕同步放大显示"尿液颜色变化对照图"，环境光为冷蓝与暖白交织，科技感医学影像风格，画面底部有半透明信息条显示"肌红蛋白尿：横纹肌溶解的典型信号"，3D渲染，高清，信息图可视化设计，焦点在液体颜色渐变区域，构图左侧人物手势右侧病灶示意图`,
    duration: 7,
    ratio: '16:9'
  },
  {
    id: 'S05',
    prompt: `近景，毕方全身肌肉肿胀状态，躯干与腿部肌肉明显膨大，轮廓失去原有优雅线条变得臃肿沉重，羽毛因肿胀而蓬起杂乱，红色被暗红与灰紫色调主导，单足艰难支撑身体摇晃明显，翅膀低垂拖地无法收拢，颈部完全低垂至胸前呈极度疲惫状，喙部闭合但呼吸急促胸部起伏剧烈，眼中灵光消失呈浑浊暗淡，展示台全息屏红色警报"运动功能严重受损"，地面有阴影暗示即将倒下，陈女士在画面左侧手持平板记录数据，表情严肃关切，背景为深灰与暗紫，底光打出不安感，侧光强烈对比突出肿胀轮廓，体积光稀薄如病态黄昏，空气中漂浮微粒暗示代谢废物堆积，3D渲染，电影摄影，写实医学纪录片风格，情绪沉重压抑，低角度仰拍强化脆弱感，构图人物占画面70%`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S06',
    prompt: `中景，毕方状态急剧恶化，身体倾斜即将倒下，单足已经无法支撑，膝盖弯曲触地，翅膀完全展开拍打地面试图起身但无力，羽毛大面积脱落飘散在空中，暗紫色斑块扩散至全身90%区域，眼部半闭瞳孔涣散，喙部微张喘息急促，胸部剧烈起伏，展示台全息屏闪烁深红色"危险：急性肾损伤风险"，地面有液体渗出暗示尿液异常，背景转为暗红与黑色交织，顶部灯光熄灭仅剩底部冷光源，环境充满危机感，陈女士从画面右侧快步靠近，手持急救箱，表情凝重紧急，警服在暗光下轮廓清晰，体积光呈暗红色如血液般浓稠，空气中弥漫烟雾状粒子，3D渲染，电影摄影，高对比度光影，手持摄影晃动增强紧张感，情绪危急紧迫，侧面构图，人物与异兽占画面中央80%`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S07',
    prompt: `中景，陈女士正面站立，身后全息投影屏分为三个竖栏快速轮播：第一栏显示肌肉损伤画面配红色文字"信号一：肌肉剧痛肿胀"，第二栏显示茶色尿液配深褐色文字"信号二：尿液呈茶色或酱油色"，第三栏显示无力倒下画面配暗紫色文字"信号三：全身无力站不稳"，三个画面以0.5秒间隔快速切换形成快闪效果，陈女士双手平举掌心向上呈"总结"手势，表情认真清晰，警服在灯光下显得权威可靠，环境回到淡蓝暖白专业色调，顶光+双侧补光均匀，背景为Nirath星球医疗讲堂，画面底部有半透明横幅显示"记住这三个信号"，3D渲染，电影摄影，分屏快闪特效，信息可视化风格，正面居中构图，人物占画面下40%，上方60%展示三栏信息`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S08',
    prompt: `中景，陈女士面向镜头，表情严肃转为关切，警服笔挺肩章闪亮，手持一张医院急诊科的蓝色指引卡片，卡片上有白色十字标志和"急诊科"字样，陈女士左手伸出食指和中指呈"二"的手势，右手托着卡片展示给镜头，身后屏幕显示医院大楼外观与救护车图标，环境为暖白与淡蓝的专业医疗空间，灯光柔和均匀，画面左侧有小字提示"及时就医，避免肾损伤"，右侧有毕方剪影呈健康姿态作为对比，陈女士身后有淡金色光环象征专业权威，3D渲染，电影摄影，正面平视构图，人物占画面中央55%，背景清晰展示医疗元素，色调温暖可信，情绪坚定有力但不恐吓，传递专业信赖感`,
    duration: 6,
    ratio: '16:9'
  },
  {
    id: 'S09',
    prompt: `特写切中景，小G面部恍然大悟表情，眼睛睁大嘴角上扬，右手握拳轻敲左掌呈"明白了"手势，随后镜头拉远 revealing 陈女士微笑点头，毕方完全恢复健康状态站立在展示台上，羽毛鲜艳如新，单足挺拔，长颈高昂呈自信姿态，翅膀优雅收拢尾羽轻摆，三人同框画面温馨，背景是Nirath星球医疗讲堂全景，顶部天窗洒落明亮自然光，暖金与淡蓝交织的治愈色调，全息投影屏显示"下一集：为什么会发生横纹肌溶解？"配问号图标与山海经图腾logo，画面边缘有轻微光晕柔化，底部有字幕条"关注我，健康不迷路"，3D渲染，电影摄影，温暖希望氛围，正面全景构图，人物位于画面下三分之一处，上方留白展示预告标语，尾声定格感，期待感`,
    duration: 8,
    ratio: '16:9'
  }
];

// 创建任务
async function createTask(shot) {
  const payload = {
    model: MODEL_ID,
    content: [
      {
        type: "text",
        text: shot.prompt
      }
    ],
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
  console.log(`🎬 开始生产: ${STORY_ID}`);
  console.log(`📊 总计 ${SHOTS.length} 个镜头`);
  
  // 确保目录存在
  if (!fss.existsSync(SHOTS_DIR)) {
    fss.mkdirSync(SHOTS_DIR, { recursive: true });
  }
  
  // 1. 并行提交所有镜头
  const tasks = [];
  for (const shot of SHOTS) {
    try {
      console.log(`\n🎥 提交镜头 ${shot.id}...`);
      const result = await createTask(shot);
      const taskId = result.id;
      
      // 保存任务信息
      const taskFile = path.join(SHOTS_DIR, `${shot.id}-task.json`);
      fss.writeFileSync(taskFile, JSON.stringify({
        shotId: shot.id,
        taskId: taskId,
        prompt: shot.prompt,
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
    path.join(WORK_DIR, 'production', 'tasks.json'),
    JSON.stringify(tasks, null, 2)
  );

  console.log(`\n📋 已提交 ${tasks.filter(t => t.status === 'submitted').length}/${SHOTS.length} 个镜头`);
  console.log(`⏳ 开始轮询等待渲染完成...`);

  // 3. 轮询等待
  let pending = tasks.filter(t => t.status === 'submitted');
  let attempts = 0;
  const maxAttempts = 120; // 最多轮询120次（约10分钟）

  while (pending.length > 0 && attempts < maxAttempts) {
    attempts++;
    console.log(`\n🔄 轮询 #${attempts}，${pending.length} 个任务待完成...`);
    
    for (const task of pending) {
      try {
        const status = await getTask(task.taskId);
        const taskStatus = status.status;
        
        if (taskStatus === 'succeeded') {
          // 下载视频
          const videoUrl = status.content?.video_url || status.video_url;
          if (videoUrl) {
            const outputPath = path.join(SHOTS_DIR, `${task.shotId}.mp4`);
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
          // running, queued, pending 等
          console.log(`⏳ ${task.shotId}: ${taskStatus}`);
        }
      } catch (err) {
        console.error(`⚠️ ${task.shotId} 轮询出错:`, err.message);
      }
    }

    // 更新pending列表
    pending = tasks.filter(t => t.status === 'submitted');
    
    if (pending.length > 0) {
      // 等待5秒再轮询
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // 4. 输出生产报告
  const report = {
    storyId: STORY_ID,
    completedAt: new Date().toISOString(),
    totalShots: SHOTS.length,
    completed: tasks.filter(t => t.status === 'done').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    tasks: tasks
  };

  fss.writeFileSync(
    path.join(WORK_DIR, 'production', 'report.json'),
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
