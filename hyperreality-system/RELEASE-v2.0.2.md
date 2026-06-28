# Rainbow Bridge v2.0.2 — Security Patch

**发布日期**: 2026-06-20
**版本号**: v2.0.2-security-patch
**前版本**: v2.0.1-parallel

---

## 本次发布内容

### 🔒 安全修复（Critical）

基于外部专家代码审计报告，修复了硬编码API Key泄露风险：

1. **硬编码API Key全面清理**
   - 修复 30+ 个脚本文件中的硬编码 `ark-0e6994f7-...`
   - 全部改为 `process.env.VOLCENGINE_ARK_API_KEY`
   - 启动时自动校验，未设置则报错退出

2. **旧导出文件清理**
   - 删除 14 个包含泄露密钥的历史导出 `.md`/`.txt` 文件
   - 释放 ~2.4MB 存储空间

3. **文档安全**
   - `VOLCENGINE-API-SETUP.md` 示例密钥改为 `YOUR_API_KEY_HERE` 占位符

### 🛡️ 稳定性修复（P0）

1. **`_fetchWithTimeout` 完整超时控制**
   - 原代码只给 `fetch` 加 AbortController
   - 修复后 `fetch + response.text()` 整体包进超时
   - 防止网络半开时 `response.text()` 挂死

2. **`loadModule` 静默失败 → 明确错误**
   - 原代码模块缺失返回 null，后续调 `.process()` 抛 `TypeError`
   - 修复后关键模块缺失时抛出明确错误信息

---

## 影响范围

**修改文件数**: 55+ 个文件
**新增文件**: 0
**删除文件**: 14 个旧导出文件

**受影响的子系统**:
- `scripts/` — 渲染/提交流本（8个文件）
- `generate-*.js` — 肖像生成脚本（11个文件）
- `stories/` — 项目脚本
- `projects/` — 生产脚本
- `zhuoyue-system/` — 肖像生成脚本
- `systems/llm-reasoning-engine.js` — LLM引擎超时修复
- `hyperreality-system/engines/production-engine.js` — 模块加载修复

---

## 验证

- [x] 工作区全量扫描：无残留硬编码密钥
- [x] 语法检查通过（`node --check`）
- [x] 加载验证通过（`verify-parallel-v201.js`）

---

## 部署说明

**环境变量要求**:
```bash
export VOLCENGINE_ARK_API_KEY="your-api-key-here"
```

**启动前校验**:
脚本会自动检查环境变量，未设置时报错并退出。

---

## Git

- **Commit**: `a77aa75`
- **Branch**: master → master
- **变更**: 55 files changed, 63 insertions(+), 2,441,071 deletions(-)

---

## 后续计划

- P1: LLM网关JSON分块合并修复
- P1: 暴力JSON截断 O(n²) 优化
- P1: NaN 安全解析
- P1: HTML 转义 XSS 防护

---

*Stay Hungry, Stay Foolish, Stay Brutally Honest.*
