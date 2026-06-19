const fs = require("fs");
const https = require("https");
const { preRenderValidation } = require("../../../systems/pre-render-validation");

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || "";
const MODEL = "ep-20260518004622-jp46s";
const RENDER_DIR = "/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-new/production/render-v6";

// ========== 渲染前置验证 ==========
const STORYBOARD_PATH = "/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-new/storyboard-v6.json";
const SKIP_VALIDATION = process.argv.includes("--skip-validation");

if (!SKIP_VALIDATION) {
  const valid = preRenderValidation(STORYBOARD_PATH, {
    requiredCharacters: ["chen-nurse", "xiaoG", "coach-li"],
    minChars: 450,
    maxChars: 490
  });
  if (!valid) {
    console.log("\n💡 修复建议：");
    console.log("   1. 检查故事板开场镜头是否有动作描述");
    console.log("   2. 确认所有角色在故事板中有出场");
    console.log("   3. 运行 'node systems/storyboard-validator.js <storyboard.json>' 查看详情");
    console.log("\n   如需强制渲染（不推荐），添加 --skip-validation 参数");
    process.exit(1);
  }
} else {
  console.log("⚠️ 跳过验证（--skip-validation），潜在问题可能未被检测");
}

// ========== 渲染核心逻辑 ==========

// 读取参考图和故事板
const refImages = {
  xiaoG: fs.readFileSync(`${RENDER_DIR}/ref-xiaoG.txt`, "utf8"),
  chen: fs.readFileSync(`${RENDER_DIR}/ref-chen.txt`, "utf8"),
  coach: fs.readFileSync(`${RENDER_DIR}/ref-coach.txt`, "utf8")
};

// 读取故事板（获取duration）
const storyboard = JSON.parse(fs.readFileSync(STORYBOARD_PATH, "utf8"));
const durationMap = {};
storyboard.shots.forEach(shot => {
  durationMap[shot.id] = shot.duration || 5; // 默认5秒
});

// 读取任务
const tasks = JSON.parse(fs.readFileSync(`${RENDER_DIR}/render-tasks.json`));

const MAX_CONCURRENT = 3;
let activeCount = 0;
let completedCount = 0;
const results = [];
const actualDurations = {}; // 记录实际时长

function log(msg) {
  const time = new Date().toLocaleTimeString("zh-CN");
  console.log(`[${time}] ${msg}`);
}

async function submitTask(task) {
  activeCount++;
  log(`📤 提交 ${task.id}...`);

  const content = [{ type: "text", text: task.prompt }];

  for (const refName of task.references) {
    const base64 = refImages[refName];
    if (base64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}` },
        role: "reference_image"
      });
    }
  }

  const payload = {
    model: MODEL,
    content: content,
    ratio: "16:9",
    duration: durationMap[task.id] || 5, // 从故事板读取duration，默认5秒
    resolution: "720p",
    seed: 42,
    camera_fixed: false,
    watermark: false
  };

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "ark.cn-beijing.volces.com",
      port: 443,
      path: "/api/v3/contents/generations/tasks",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          log(`✅ ${task.id} 提交成功: ${result.id}`);
          resolve({ taskId: task.id, apiTaskId: result.id, status: "submitted" });
        } catch (e) {
          log(`❌ ${task.id} 解析失败: ${data}`);
          resolve({ taskId: task.id, error: data, status: "failed" });
        }
      });
    });

    req.on("error", (err) => {
      log(`❌ ${task.id} 请求失败: ${err.message}`);
      resolve({ taskId: task.id, error: err.message, status: "failed" });
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function pollTask(task) {
  const maxAttempts = 80;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;

    const result = await checkStatus(task.apiTaskId);
    log(`⏳ ${task.taskId} 轮询 #${attempts}: ${result.status}`);

    if (result.status === "succeeded") {
      log(`🎉 ${task.taskId} 渲染成功！`);
      const videoPath = await downloadVideo(task.taskId, result.videoUrl);

      // 测量实际时长
      if (videoPath) {
        const duration = await measureDuration(videoPath);
        actualDurations[task.taskId] = duration;
        log(`⏱ ${task.taskId} 实际时长: ${duration.toFixed(2)}秒`);
      }

      return { ...task, status: "succeeded", videoPath };
    }

    if (result.status === "failed") {
      log(`❌ ${task.taskId} 渲染失败: ${result.reason}`);
      return { ...task, status: "failed", error: result.reason };
    }
  }

  log(`⏰ ${task.taskId} 超时`);
  return { ...task, status: "timeout" };
}

function checkStatus(apiTaskId) {
  return new Promise((resolve) => {
    https.get({
      hostname: "ark.cn-beijing.volces.com",
      port: 443,
      path: `/api/v3/contents/generations/tasks/${apiTaskId}`,
      headers: { "Authorization": `Bearer ${API_KEY}` }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          resolve({
            status: result.status,
            videoUrl: result.video_url || result.content?.video_url
          });
        } catch (e) {
          resolve({ status: "error", reason: data });
        }
      });
    }).on("error", () => resolve({ status: "error" }));
  });
}

async function downloadVideo(taskId, videoUrl) {
  if (!videoUrl) return null;

  const outputPath = `${RENDER_DIR}/${taskId}.mp4`;

  return new Promise((resolve) => {
    const file = fs.createWriteStream(outputPath);
    https.get(videoUrl, (res) => {
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        log(`💾 ${taskId} 下载完成`);
        resolve(outputPath);
      });
    }).on("error", () => resolve(null));
  });
}

function measureDuration(videoPath) {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`, (err, stdout) => {
      if (err) {
        resolve(5.0); // 默认5秒
      } else {
        resolve(parseFloat(stdout.trim()) || 5.0);
      }
    });
  });
}

function generateSRT(durations) {
  const storyboard = JSON.parse(fs.readFileSync("/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-new/storyboard-v6.json"));
  let currentTime = 0;
  let srt = "";

  for (let i = 0; i < storyboard.shots.length; i++) {
    const shot = storyboard.shots[i];
    const duration = durations[shot.id] || 5.0;
    const start = currentTime;
    const end = currentTime + duration;

    const startStr = formatTime(start);
    const endStr = formatTime(end);

    srt += `${i + 1}\n`;
    srt += `${startStr} --> ${endStr}\n`;
    srt += `${shot.line}\n\n`;

    currentTime = end;
  }

  fs.writeFileSync(`${RENDER_DIR}/subtitles-accurate.srt`, srt);
  log(`📝 精准SRT已生成（基于实际时长）`);
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

async function mergeAndBurnSubtitles() {
  log("🎬 开始合并视频+烧录字幕...");

  // 生成concat列表
  const storyboard = JSON.parse(fs.readFileSync("/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-new/storyboard-v6.json"));
  let concatList = "";
  for (const shot of storyboard.shots) {
    concatList += `file '${shot.id}.mp4'\n`;
  }
  fs.writeFileSync(`${RENDER_DIR}/concat-list.txt`, concatList);

  // 合并
  await new Promise((resolve, reject) => {
    const { exec } = require("child_process");
    exec(`ffmpeg -f concat -safe 0 -i concat-list.txt -c copy -y temp-merged.mp4`, { cwd: RENDER_DIR }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  log(`✅ 视频合并完成`);

  // 烧录字幕（横屏尺寸）
  await new Promise((resolve, reject) => {
    const { exec } = require("child_process");
    const cmd = `ffmpeg -i temp-merged.mp4 -vf "subtitles=subtitles-accurate.srt:force_style='FontSize=32,FontName=Noto Sans CJK SC,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=3,Shadow=1,Alignment=2,MarginV=30'" -c:a copy -y ep01-v6-horizontal-final.mp4`;
    exec(cmd, { cwd: RENDER_DIR }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  log(`✅ 字幕烧录完成`);

  // 清理临时文件
  fs.unlinkSync(`${RENDER_DIR}/temp-merged.mp4`);
}

async function run() {
  log("🎬 EP01-v6 横屏重渲染开始！");
  log(`📊 总任务: ${tasks.length}镜 | 并发: ${MAX_CONCURRENT}`);
  log(`🔧 关键修复: ratio=16:9 已加入API调用`);

  // 渲染阶段
  const queue = [...tasks];
  const submitted = [];

  while (queue.length > 0 || submitted.length > 0) {
    while (activeCount < MAX_CONCURRENT && queue.length > 0) {
      const task = queue.shift();
      const promise = submitTask(task).then(async (result) => {
        if (result.status === "submitted") {
          const finalResult = await pollTask(result);
          results.push(finalResult);
          completedCount++;
          log(`📈 渲染进度: ${completedCount}/${tasks.length}`);
        } else {
          results.push({ ...task, ...result });
          completedCount++;
        }
        activeCount--;
      });
      submitted.push(promise);
    }

    if (submitted.length > 0) {
      await Promise.race(submitted);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // 保存结果
  fs.writeFileSync(`${RENDER_DIR}/render-results-v2.json`, JSON.stringify(results, null, 2));

  const successCount = results.filter(r => r.status === "succeeded").length;
  const failedCount = results.filter(r => r.status === "failed").length;
  const timeoutCount = results.filter(r => r.status === "timeout").length;

  log("\n" + "=".repeat(60));
  log(`🎉 渲染完成！成功: ${successCount} | 失败: ${failedCount} | 超时: ${timeoutCount}`);
  log("=".repeat(60));

  if (successCount === tasks.length) {
    // 全部成功，生成精准字幕
    log("📝 生成基于实际时长的精准SRT...");
    generateSRT(actualDurations);

    // 合并+烧录字幕
    await mergeAndBurnSubtitles();

    // 验证最终文件
    const { exec } = require("child_process");
    exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ep01-v6-horizontal-final.mp4`, { cwd: RENDER_DIR }, (err, stdout) => {
      if (!err) {
        log(`📐 最终视频分辨率: ${stdout.trim()}`);
      }
    });

    log("🎬 全部完成！视频已生成！");
  } else {
    log(`⚠️ 有 ${failedCount + timeoutCount} 镜失败，需重试`);
  }
}

run().catch(err => log(`💥 错误: ${err.message}`));
