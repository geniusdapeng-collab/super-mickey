# 饕餮EP01 PromptForge OOM 问题根因分析

## 问题现象
- 运行 `run-taotie-preproduction.js` 时，PromptForge 子进程阶段触发 OOM Killer
- 被杀进程：主进程（MainThread，RSS 5.1GB）
- 错误信号：SIGTERM（由 OOM Killer 触发）

## 根因分析

### 1. 主进程内存泄漏（核心问题）
主进程执行 STAGE-0~12 后，累积大量内存：
- `result.stages.render`：6个镜头的完整 Prompt 数据（~20KB）
- `result.stages.prd`：PRD 文档（~50KB）
- `result.stages.script`：剧本数据（~100KB）
- `result.stages.storyboard`：故事板数据（~50KB）
- `result.stages.opening`：片头数据（~30KB）
- 日志数据：`result.stages.logs`（~500KB+）

总内存累积到 5.1GB，远超系统限制。

### 2. 子进程内存限制错误（加剧问题）
下午将子进程内存限制从 `8192` 改为 `2048`（错误！）
- 上午成功配置：`--max-old-space-size=8192`（8GB）
- 下午失败配置：`--max-old-space-size=2048`（2GB）

### 3. 数据量差异（触发问题）
- 上午测试：2镜头（数据量小）
- 下午运行：6镜头（数据量大，累积内存更多）

## 修复方案

### 修复1：恢复子进程内存限制
```javascript
// 恢复为 8192（与上午成功配置一致）
const child = spawn(process.execPath, [
  '--expose-gc', 
  '--max-old-space-size=8192',  // 恢复为 8192
  workerPath, 
  inputPath, 
  outputPath
]);
```

### 修复2：主进程内存释放
在启动子进程前，释放已完成 Stage 的大对象：
```javascript
// 释放渲染结果（已写入文件）
result.stages.render = null;

// 释放原始LLM输出
if (result.stages.script && result.stages.script.raw) {
  result.stages.script.raw = null;
}

// 释放其他已完成Stage的大对象
result.stages.prd = null;
result.stages.storyboard = null;
result.stages.opening = null;
result.stages.alignment = null;
result.stages.schema = null;
result.stages.characters = null;

// 强制GC确保释放生效
if (global.gc) {
  global.gc();
}
```

### 修复3：主进程强制 GC
在启动子进程前执行两次 `global.gc()`：
1. 释放大对象前执行一次
2. 释放大对象后执行一次

## 验证方法

重新运行 `run-taotie-preproduction.js`，观察：
1. **主进程内存峰值**：应 < 3GB（释放后）
2. **子进程启动**：应成功启动，不触发 OOM
3. **子进程完成**：应成功完成，输出优化结果
4. **总耗时**：应 < 15分钟（子进程超时）

## 预期结果
- 主进程内存峰值：2-3GB（释放大对象后）
- 子进程内存峰值：2-4GB（8192 限制内）
- 总内存使用：4-7GB（系统 7.5GB 内）
- PromptForge 完成：输出优化后的 6 镜头 Prompt

## 文件修改
- `systems/nirath-master-pipeline.js`：添加内存释放逻辑和恢复子进程限制
