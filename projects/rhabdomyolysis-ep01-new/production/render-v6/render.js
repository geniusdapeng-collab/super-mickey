const fs = require("fs");
const https = require("https");

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || "";
const MODEL = "ep-20260518004622-jp46s"; // 自定义接入点支持参考图
const RENDER_DIR = "/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-new/production/render-v6";

// 读取参考图
const refImages = {
  xiaoG: fs.readFileSync(`${RENDER_DIR}/ref-xiaoG.txt`, "utf8"),
  chen: fs.readFileSync(`${RENDER_DIR}/ref-chen.txt`, "utf8"),
  coach: fs.readFileSync(`${RENDER_DIR}/ref-coach.txt`, "utf8")
};

// 读取任务
const tasks = JSON.parse(fs.readFileSync(`${RENDER_DIR}/render-tasks.json`));

// 并发控制
const MAX_CONCURRENT = 3;
let activeCount = 0;
let completedCount = 0;
const results = [];

function log(msg) {
  const time = new Date().toLocaleTimeString("zh-CN");
  console.log(`[${time}] ${msg}`);
}

async function submitTask(task) {
  activeCount++;
  log(`📤 提交 ${task.id}...`);
  
  // 构建content数组
  const content = [{ type: "text", text: task.prompt }];
  
  // 添加参考图
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
    ratio: "16:9"  // ← 强制横屏输出
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
  const maxAttempts = 60;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000)); // 5秒轮询
    attempts++;
    
    const result = await checkStatus(task.apiTaskId);
    log(`⏳ ${task.taskId} 轮询 #${attempts}: ${result.status}`);
    
    if (result.status === "succeeded") {
      log(`🎉 ${task.taskId} 渲染成功！`);
      // 下载视频
      await downloadVideo(task.taskId, result.videoUrl);
      return { ...task, status: "succeeded", videoPath: `${RENDER_DIR}/${task.taskId}.mp4` };
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
    const req = https.get({
      hostname: "ark.cn-beijing.volces.com",
      port: 443,
      path: `/api/v3/contents/generations/tasks/${apiTaskId}`,
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      }
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
    });
    
    req.on("error", () => resolve({ status: "error" }));
  });
}

async function downloadVideo(taskId, videoUrl) {
  if (!videoUrl) return;
  
  const outputPath = `${RENDER_DIR}/${taskId}.mp4`;
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outputPath);
    https.get(videoUrl, (res) => {
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        log(`💾 ${taskId} 下载完成: ${outputPath}`);
        resolve(outputPath);
      });
    }).on("error", () => resolve(null));
  });
}

async function run() {
  log("🎬 EP01-v6 渲染开始！");
  log(`📊 总任务: ${tasks.length}镜 | 并发: ${MAX_CONCURRENT}`);
  
  // 分批提交
  const queue = [...tasks];
  const submitted = [];
  
  while (queue.length > 0 || submitted.length > 0) {
    // 提交新任务
    while (activeCount < MAX_CONCURRENT && queue.length > 0) {
      const task = queue.shift();
      const promise = submitTask(task).then(async (result) => {
        if (result.status === "submitted") {
          const finalResult = await pollTask(result);
          results.push(finalResult);
          completedCount++;
          log(`📈 进度: ${completedCount}/${tasks.length}`);
        } else {
          results.push({ ...task, ...result });
          completedCount++;
        }
        activeCount--;
      });
      submitted.push(promise);
    }
    
    // 等待至少一个任务完成
    if (submitted.length > 0) {
      await Promise.race(submitted);
      submitted.splice(0, submitted.length, ...submitted.filter(p => {
        // 过滤已完成的promise
        return true; // 简化处理
      }));
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // 保存结果
  fs.writeFileSync(`${RENDER_DIR}/render-results.json`, JSON.stringify(results, null, 2));
  
  log("\n" + "=".repeat(60));
  log("🎉 渲染完成！");
  log(`✅ 成功: ${results.filter(r => r.status === "succeeded").length}`);
  log(`❌ 失败: ${results.filter(r => r.status === "failed").length}`);
  log(`⏰ 超时: ${results.filter(r => r.status === "timeout").length}`);
  log("=".repeat(60));
}

run().catch(err => log(`💥 错误: ${err.message}`));
