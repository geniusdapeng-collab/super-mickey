# PromptForge Stage 13 崩溃 & S00 片头遗漏 - 技术问题详细分析报告

> 报告生成时间: 2026-06-18 17:25 CST
> 系统版本: v6.6.9.4-patch20
> 相关会话: tender-claw (SIGTERM 中断)

---

## 问题一: PromptForge Stage 13 反复崩溃（第6次）

### 1.1 问题现象

| 次数 | Session | 时间 | 信号 | 状态 |
|------|---------|------|------|------|
| 1 | crisp-wharf | ~14:45 | SIGTERM | 中断 |
| 2 | ember-forest | ~14:48 | SIGTERM | 中断 |
| 3 | kind-kelp | ~14:54 | SIGKILL | 中断 |
| 4 | mild-sable | ~15:00 | SIGKILL | 中断 |
| 5 | 未命名 | ~15:11 | SIGTERM | 中断 |
| 6 | tender-claw | 17:08 | SIGTERM | 中断 |

**共同特征**:
- 全部发生在 Stage 13 PromptForge 导演编排启动后
- 子进程 (`promptforge-director-worker.js`) 启动后不久，主进程收到 SIGTERM
- 子进程状态: CPU 0%, 进程状态 `Sl` (可中断睡眠), 正在等待 I/O
- 日志最后记录: `🎬 PromptForge 子进程启动 | 内存限制: 1536MB | 输入: /tmp/promptforge-input-xxx.json`

### 1.2 期望结果

PromptForge 导演编排应完成以下流程：
1. **Stage 1 (Director)**: 总导演输出整体编排建议（风格统一、情绪推进、镜头重点）
2. **Stage 2a (Screenwriter)**: 编剧优化器逐镜头优化台词（5个镜头 × 1次LLM调用）
3. **Stage 2b (Cinematographer)**: 摄影指导逐镜头优化运镜/光影（5个镜头 × 1次LLM调用）
4. **Stage 3 (Composer)**: 合成师融合所有信息为最终 Prompt（5个镜头 × 1次LLM调用）
5. **Quality Report**: 输出质量评分（目标 70分 → 90分）

**预期耗时**: 5-10 分钟（15个子进程调用，每个 30-60 秒）

### 1.3 实际结果

子进程启动后，**无任何输出**，CPU 0%，进程被外部 SIGTERM/SIGKILL 终止。

**关键观察**:
- 子进程日志输出停留在 `PromptForge 子进程启动` 这一行
- 没有记录 `Stage 1 Director start`（子进程内的第一条日志）
- 说明子进程在启动后，**尚未执行到 main() 函数内的第一条 log**，就已经挂死

### 1.4 根因分析（多层叠加）

#### 第一层: 子进程启动阶段阻塞

**关键证据**:
```
[2026-06-18T09:00:44.143Z] [PIPELINE] INFO: 🎬 PromptForge 子进程启动 | 内存限制: 1536MB | 输入: /tmp/promptforge-input-1781773244143.json
```

这条日志是**父进程**（`nirath-master-pipeline.js`）在 `spawn()` 后立即打印的。
子进程内的第一条日志 `[PromptForgeWorker] Worker start` **从未出现**。

**推断**: 子进程在 `require()` 阶段或 `readJson()` 阶段就已经阻塞。

#### 第二层: 输入文件过大导致 JSON 解析阻塞

PromptForge 输入文件大小：
```bash
-rw-r--r-- 1 root root 14847 Jun 18 17:00 /tmp/promptforge-input-1781773244143.json
```

**14.8KB 的 JSON 文件**包含:
- 6 个镜头的完整数据（含双重嵌套的 `cameraMovement.timeline.timeline`）
- 每个镜头包含完整的 `prompt` 字段（1500 字符 × 6 = ~9000 字符）
- 额外的 `visualPrompt`, `narration`, `dialogue` 等字段

**Node.js `JSON.parse()` 对 14.8KB 的嵌套对象**应该瞬间完成，但如果文件系统 I/O 被阻塞（如 `/tmp` 目录压力、磁盘 I/O 竞争），`readFileSync` 可能挂起。

#### 第三层: LLM 子进程调用链的级联阻塞

PromptForge 内部使用 `llm-call-isolated-worker.js` 进行 LLM 调用。每次调用：
1. 写入输入 JSON 文件到 `/tmp`
2. `spawn()` 子进程
3. 等待子进程完成
4. 读取输出 JSON 文件

如果 `/tmp` 目录存在竞争（多个 session 同时运行），文件写入/读取可能阻塞。

#### 第四层: 主进程与子进程的竞争关系

**关键发现**: 主进程收到 SIGTERM 的同时，子进程也被杀死。

**推测原因**:
1. OpenClaw 的 `exec` 工具有全局超时机制（1200秒 = 20分钟）
2. 但 SIGTERM 发生在启动后 **10-15 分钟**，不是超时
3. 更可能的原因: **系统 OOM Killer** 或 **资源竞争** 导致进程被强制终止

**内存限制分析**:
- PromptForge Worker: `--max-old-space-size=1536` (1536MB)
- LLM Isolated Worker: `--max-old-space-size=512` (512MB)
- 同时可能运行多个 LLM 子进程
- 6 镜头 × 3 个 Stage = 最多 18 个并发子进程（实际串行，但内存峰值叠加）

**1536MB 对于处理 14.8KB 输入 + LLM 上下文来说偏低**，但不应导致崩溃。

#### 第五层: 外部专家方案验证失败

外部专家给出的方案（patch17/patch18）:
1. 每次 LLM 调用使用**独立子进程隔离**
2. 父进程用 `setTimeout` 超时后 `child.kill('SIGKILL')`
3. 内存限制 512MB 用于 LLM 子进程

**验证结果**:
- ✅ 子进程隔离机制工作（能看到独立的 node 进程）
- ❌ 但**子进程本身启动时就挂死**，超时保护无法触发（因为超时尚未开始计时）
- ❌ 512MB 内存对于 LLM 推理可能不足，但主问题不是 OOM

### 1.5 关键代码片段

#### promptforge-director-worker.js (主入口)

```javascript
const WORKER_TIMEOUT_MS = 15 * 60 * 1000; // 15分钟
const DEFAULT_CALL_TIMEOUT_MS = 120 * 1000; // 单次LLM调用 2分钟

async function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];

  const workerTimer = setTimeout(() => {
    logError(`⏱️ Worker全局超时(${WORKER_TIMEOUT_MS}ms)，强制退出`);
    safeWriteJson(outputFile, { success: false, error: 'Worker global timeout' });
    process.exit(1);
  }, WORKER_TIMEOUT_MS);

  const input = readJson(inputFile);  // ← 可能在这里阻塞
  const rawReport = input.rawReport || { shots: [] };
  
  log(`Worker start | mode=${mode} | input=${inputFile}`);  // ← 这条日志从未出现
  
  // 过滤 S00
  const shots = allShots.filter(s => {
    const id = s.id || s.shotId;
    return id !== 'S00' && s.type !== 'opening' && !s.isOpening;
  });
  
  // Stage 1 Director
  const directorResult = await runDirectorStage({ shots }, projectConfig, mode);
  // ... 后续 Stage 2a, 2b, 3
}
```

#### llm-call-isolated-worker.js (LLM 子进程)

```javascript
async function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];
  
  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const { LLMEngine } = require('../systems/llm-reasoning-engine');
  
  const engine = new LLMEngine({
    model: options.model || 'kimi-k2p6',
    maxTokens: options.maxTokens || 2048,
    timeoutMs: options.timeoutMs || 120000
  });
  
  const result = await engine.generate(prompt, {
    maxTokens: options.maxTokens || 2048,
    timeoutMs: options.timeoutMs || 120000
  });
  
  fs.writeFileSync(outputFile, JSON.stringify({ success: true, result }, null, 2), 'utf8');
}
```

#### 父进程调用 PromptForge 的代码 (nirath-master-pipeline.js)

```javascript
// STAGE-13 PromptForge 导演编排
async stagePromptForge(rawReport, projectConfig, mode) {
  const workerPath = path.join(__dirname, 'promptforge-director-worker.js');
  const inputFile = `/tmp/promptforge-input-${Date.now()}.json`;
  const outputFile = `/tmp/promptforge-output-${Date.now()}.json`;
  
  // 写入输入
  fs.writeFileSync(inputFile, JSON.stringify({
    rawReport: { shots: rawReport.shots },
    projectConfig,
    mode
  }, null, 2), 'utf8');
  
  // 启动子进程
  const child = spawn('node', [
    '--max-old-space-size=1536',
    workerPath,
    inputFile,
    outputFile
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // 等待输出... 但子进程从未完成
}
```

### 1.6 日志证据

**父进程日志** (最后几条):
```
[2026-06-18T09:00:44.142Z] [PIPELINE] INFO: [创意指数] STAGE-12 注入 1 个模块指令
[2026-06-18T09:00:44.142Z] [PIPELINE] INFO: 🎬 PromptForge 导演编排启动 | 子进程隔离 | 70分 → 90分
[2026-06-18T09:00:44.143Z] [PIPELINE] INFO: 🎬 PromptForge 子进程启动 | 内存限制: 1536MB | 输入: /tmp/promptforge-input-1781773244143.json
```

**子进程日志**: 无输出文件，无日志记录，进程被 SIGTERM 终止。

**系统日志** (OpenClaw):
```
Exec failed (tender-c, signal SIGTERM)
```

### 1.7 可能原因列表（待验证）

| 优先级 | 原因 | 验证方法 | 可能性 |
|--------|------|----------|--------|
| 1 | 输入 JSON 文件过大 (14.8KB) 导致 `readFileSync`/`JSON.parse` 在内存受限模式下阻塞 | 单独测试读取该文件 | 中 |
| 2 | `require('../systems/llm-reasoning-engine')` 在子进程中初始化成本过高 | 单独测试 require 时间 | 高 |
| 3 | `/tmp` 目录竞争或磁盘 I/O 阻塞 | 检查 `/tmp` 挂载点和 I/O 状态 | 中 |
| 4 | 系统 OOM Killer 因内存不足杀死进程 | 检查 `/var/log/syslog` | 中 |
| 5 | LLM API 连接在子进程中建立后挂死 | 检查网络连接和 API 状态 | 高 |
| 6 | Node.js spawn 的 stdio 配置导致缓冲区满阻塞 | 测试 `stdio: 'ignore'` 配置 | 低 |
| 7 | 全局超时保护（OpenClaw exec timeout）触发 | 对比超时时间 | 低（10-15分钟 ≠ 20分钟） |

### 1.8 已尝试的修复方案

| 方案 | 内容 | 结果 |
|------|------|------|
| patch14 | 双层超时保护 (Promise.race + setTimeout) | ❌ 失败 |
| patch15 | 缩短 callLLM 超时至 3 分钟 | ❌ 失败 |
| patch17 | 外部专家方案: 子进程隔离 + 独立 LLM Worker | ❌ 失败（子进程启动即挂死） |
| patch18 | 缩短内存限制 1536MB，LLM Worker 512MB | ❌ 失败 |
| patch19 | 同 patch17/patch18，完整验证 | ❌ 失败 |
| patch20 | 未修改 PromptForge 代码 | ❌ 失败 |

---

## 问题二: S00 片头提示词在最终输出中遗漏

### 2.1 问题现象

队长反馈：最终发送的提示词 MD 文件中**缺少 S00 片头**的内容。

### 2.2 期望结果

S00 片头应包含在最终提示词输出中，因为：
1. 片头是视频的重要组成部分（9秒，主标题+副标题）
2. `preproduction-result.json` 中**已包含 S00**
3. 队长需要完整的 6 镜头提示词用于提交渲染

### 2.3 实际结果

发送的 `完整提示词-v20.md` 文件中只包含 S01-S05（5个镜头），**缺少 S00**。

### 2.4 根因分析

**直接原因**: 生成 MD 文件时使用了错误的输入源。

**详细链路**:

1. **PromptForge 过滤 S00（设计意图）**:
   ```javascript
   // promptforge-director-worker.js
   const shots = allShots.filter(s => {
     const id = s.id || s.shotId;
     return id !== 'S00' && s.type !== 'opening' && !s.isOpening;
   });
   ```
   PromptForge 是导演优化环节，**故意跳过片头**（片头由 `opening-system-v3.js` 生成，不需要导演优化）。

2. **PromptForge 输出文件**:
   - 目录: `/root/.openclaw/workspace/output/health-edu-ep01-v669/`
   - 文件: `S01.json`, `S02.json`, `S03.json`, `S04.json`, `S05.json`
   - **无 S00.json**（因为被过滤了）

3. **生成 MD 时的错误**:
   生成脚本读取了 `S01.json` 到 `S05.json`（PromptForge 的工作文件），而不是 `preproduction-result.json`（最终输出文件）。

4. **preproduction-result.json 包含 S00**:
   ```javascript
   shots count: 6
   shot IDs: [ 'S00', 'S01', 'S02', 'S03', 'S04', 'S05' ]
   S00 prompt length: 1102
   ```

### 2.5 正确数据来源

**最终输出文件** (包含全部 6 镜头):
- `/root/.openclaw/workspace/output/health-edu-ep01-v669/preproduction-result.json`
- 格式: `meta + shots` (v6.6.9.4-patch17+ 新格式)

**PromptForge 中间文件** (仅包含 5 个内容镜头):
- `/root/.openclaw/workspace/output/health-edu-ep01-v669/S01.json` ~ `S05.json`
- 用途: PromptForge 导演优化后的中间结果
- 注意: **不包含 S00**，也不包含最终版 Prompt（因为 Stage 13 未完成）

### 2.6 修复方案

生成最终提示词 MD 时，应从 `preproduction-result.json` 读取，而非 PromptForge 中间文件。

```javascript
// 正确做法
const data = JSON.parse(fs.readFileSync('preproduction-result.json', 'utf8'));
const shots = data.shots; // 包含 S00-S05

// 错误做法（当前）
const files = ['S01.json', 'S02.json', 'S03.json', 'S04.json', 'S05.json'];
// 缺少 S00，且使用的是 PromptForge 中间输出（未完成的 Stage 13）
```

---

## 附录: 相关文件清单

| 文件 | 路径 | 用途 | 大小 |
|------|------|------|------|
| PromptForge Worker | `zhuoyue-system/core/promptforge-director-worker.js` | 导演编排子进程 | ~15KB |
| LLM Isolated Worker | `zhuoyue-system/core/llm-call-isolated-worker.js` | LLM 调用子进程 | ~2KB |
| 主 Pipeline | `zhuoyue-system/core/nirath-master-pipeline.js` | 调用 PromptForge | ~800KB |
| 最终输出 | `output/health-edu-ep01-v669/preproduction-result.json` | meta+shots 格式 | 360KB |
| PromptForge 输入 | `/tmp/promptforge-input-1781773244143.json` | 子进程输入 | 14.8KB |
| PromptForge 中间输出 | `output/health-edu-ep01-v669/S01.json` ~ `S05.json` | 导演优化中间结果 | 30-40KB each |

---

## 附录: 环境信息

| 项目 | 值 |
|------|-----|
| 系统版本 | v6.6.9.4-patch20 |
| Node.js 版本 | v24.15.0 |
| 运行环境 | Linux VM-38-151-ubuntu, 6.8.0-71-generic |
| 内存配置 | 主进程: 默认 / PromptForge: 1536MB / LLM Worker: 512MB |
| API 模型 | kimi-k2p6 |
| 超时设置 | PromptForge Worker: 15分钟 / LLM 调用: 2分钟 |

---

*报告生成时间: 2026-06-18 17:25 CST*
*版本: v6.6.9.4-patch20*
