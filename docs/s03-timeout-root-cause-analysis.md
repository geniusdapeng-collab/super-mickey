# S03 LLM 超时问题根因分析报告

## 问题描述

`ScriptGenerator LLM 超时(300000ms)` 在完整预生产流程中反复出现，但隔离测试（直接调用 LLMEngine）能够成功。

## 根因定位

### 1. 代码路径分析

`ScriptGenerator` 加载 LLMEngine 的路径：
```javascript
// engines/script-engine/core/script-generator.js 第 9 行
const LLM_ENGINE_PATH = path.join(__dirname, '../../../../systems/llm-reasoning-engine.js');
```

从 `engines/script-engine/core/` 出发，`../../../../` 解析到 `super-mickey/` 根目录，实际加载的文件是：
- `/root/.openclaw/workspace/github-repos/super-mickey/systems/llm-reasoning-engine.js`

### 2. 版本差异对比

系统中存在 **三个不同版本** 的 `llm-reasoning-engine.js`：

| 路径 | 版本 | 状态 |
|------|------|------|
| `super-mickey/systems/llm-reasoning-engine.js` | **旧版本** | 实际被加载 |
| `super-mickey/hyperreality-system/systems/llm-reasoning-engine.js` | 新版本 | 未被加载 |
| `.openclaw/workspace/systems/llm-reasoning-engine.js` | 新版本 | 隔离测试使用 |

### 3. 关键差异：`_fetchWithTimeout` 实现

**旧版本**（实际被加载的版本）：
```javascript
async _fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      // 【问题】res.text() 没有超时保护！
      const textPromise = res.text();
      const text = await textPromise;  // 可能无限等待
      ...
    } finally {
      clearTimeout(timer);
    }
  }
```

**新版本**（隔离测试使用的版本）：
```javascript
async _fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let textTimer;
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      // 【修复】res.text() 有 Promise.race 超时保护
      const text = await Promise.race([
        res.text(),
        new Promise((_, reject) => {
          textTimer = setTimeout(() => {
            controller.abort();
            res.body?.cancel?.();
            reject(new Error(`res.text() 读取响应体超时`));
          }, textTimeoutMs);
        })
      ]).finally(() => clearTimeout(textTimer));
      ...
    } finally {
      clearTimeout(timer);
      clearTimeout(textTimer);
    }
  }
```

### 4. 超时机制失效链

```
ScriptGenerator._callLLM
  ├── Promise.race([llmPromise, timeoutPromise])  // 300s 外层保护
  │   └── llmPromise = LLMEngine.generate(prompt)
  │       └── LLMEngine.reason()
  │           └── LLMEngine._fetchWithTimeout()
  │               ├── fetch() 有 AbortController 超时保护 ✅
  │               └── res.text() 无超时保护 ❌  ← 【根因】
  │                   └── 如果服务端返回响应头但不发送响应体，
  │                       res.text() 无限等待
  │
  └── timeoutPromise 300s 后触发
      └── reject('ScriptGenerator LLM 超时(300000ms)')
```

**关键问题**：
- 外层 `Promise.race` 的 300s timeout 确实会触发
- 但 `res.text()` 的 Promise 仍然是悬挂的（未 resolved/rejected）
- 导致进程资源泄漏，且外层无法区分是"真的慢"还是"流挂死"

### 5. 为什么隔离测试能成功

隔离测试（`test-llm-full.js`）加载的是新版本的 `LLMEngine`：
```javascript
const LLM_ENGINE_PATH = path.join(__dirname, '../../../systems/llm-reasoning-engine.js');
// 从 hyperreality-system/ 出发，指向 workspace/systems/llm-reasoning-engine.js（新版本）
```

新版本的 `res.text()` 有 `Promise.race` 超时保护，因此不会 hang 住。

## 复现验证

### 日志证据

完整预生产日志（旧版本 LLMEngine）：
```
[ScriptGenerator] 使用LLMEngine调用...
[HealthMonitor] 检查Agent...  // 只有 HealthMonitor 日志，没有 LLMEngine 日志
[ScriptGenerator] LLMEngine调用失败: ScriptGenerator LLM 超时(300000ms)
```

**缺失的日志**：`[LLMEngine._fetchWithTimeout] 发起请求` 和 `[LLMEngine._fetchWithTimeout] fetch 返回`

说明 `fetch()` 在连接阶段被阻塞，或响应头返回后响应体不发送，而旧版本的 `res.text()` 没有超时保护，导致无限等待。

隔离测试日志（新版本 LLMEngine）：
```
[LLMEngine._fetchWithTimeout] 发起请求 | url=... | timeout=300000ms
[LLMEngine._fetchWithTimeout] fetch 开始...
[LLMEngine._fetchWithTimeout] fetch 返回 | status=200 | ok=true
[LLMEngine._fetchWithTimeout] 开始读取响应体 | textTimeout=300000ms
[LLMEngine._fetchWithTimeout] 响应体读取完成 | length=3939
[LLMEngine] API完成 | Tokens: 1802 | content=1592 | reasoning=1593
```

新版本有完整的日志链路，说明 `fetch()` → `res.text()` 都正常完成。

## 解决方案

### 方案 1：替换旧版本（推荐）

将 `super-mickey/systems/llm-reasoning-engine.js` 替换为新版本：

```bash
cp /root/.openclaw/workspace/systems/llm-reasoning-engine.js \
   /root/.openclaw/workspace/github-repos/super-mickey/systems/llm-reasoning-engine.js
```

### 方案 2：修改加载路径

修改 `script-generator.js` 的加载路径，指向 `hyperreality-system/systems/` 下的新版本：

```javascript
// engines/script-engine/core/script-generator.js
const LLM_ENGINE_PATH = path.join(__dirname, '../../../systems/llm-reasoning-engine.js');
// 从 engines/script-engine/core/ 出发
// ../../../ → engines/
// 指向 engines/systems/llm-reasoning-engine.js（不存在）
```

需要改为：
```javascript
const LLM_ENGINE_PATH = path.join(__dirname, '../../../../hyperreality-system/systems/llm-reasoning-engine.js');
```

### 方案 3：统一 systems 目录

将 `hyperreality-system/systems/` 下的文件软链接到 `super-mickey/systems/`：

```bash
ln -sf /root/.openclaw/workspace/github-repos/super-mickey/hyperreality-system/systems/llm-reasoning-engine.js \
       /root/.openclaw/workspace/github-repos/super-mickey/systems/llm-reasoning-engine.js
```

## 建议

**立即执行方案 1**（替换旧版本），然后重跑 S03 验证。

同时检查 `super-mickey/systems/` 下是否有其他文件也是旧版本，需要一并更新。

## 附加发现

`super-mickey/systems/` 目录下缺少 `llm-output-normalizer.js` 文件，但 `llm-reasoning-engine.js` 依赖它：
```javascript
const { normalizeLLMOutput } = require('./llm-output-normalizer');
```

这可能导致模块加载失败或运行时错误。需要确保 `llm-output-normalizer.js` 也存在。

---

**分析时间**: 2026-06-30 16:55
**分析人**: 超级小香宝
