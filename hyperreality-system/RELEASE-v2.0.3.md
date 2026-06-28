# Rainbow Bridge v2.0.3 — Audit Fix

**发布日期**: 2026-06-20
**版本号**: v2.0.3-audit-fix
**前版本**: v2.0.2-security-patch

---

## 本次发布内容

基于外部专家代码审计报告，修复P1级问题：

### 🛡️ LLM网关JSON分块合并修复

**问题**: `core/llm-gateway.js` 的 `callWithSplit` 对 JSON 输出使用 `Object.assign` 合并分块结果，同key被覆盖、数组丢失，可能产生非法JSON。

**修复**: JSON/structured 模式禁用自动分块，要求单次完整返回；仅 text 模式允许分块拼接。

**文件**: `core/llm-gateway.js`

### ⚡ 暴力JSON截断 O(n²) 优化

**问题**: `script-generator.js` 的策略2使用多轮步长循环从末尾逐步截断，最坏接近 O(n²)，LLM返回大文本时CPU飙升。

**修复**: 删除暴力截断策略，改用单次栈扫描定位匹配括号（O(n)），失败后再尝试小范围括号补全。

**文件**: `hyperreality-system/engines/script-engine/core/script-generator.js`

### 🔢 NaN安全解析

**问题**: `requirement-list-builder.js` 多处 `parseInt`/`parseFloat` 未校验结果，异常输入导致 `NaN`，后续时长比较全部失效。

**修复**: 添加 `safeParseInt`/`safeParseFloat` 工具函数，失败时回退到默认值。

**文件**: `hyperreality-system/engines/script-engine/core/requirement-list-builder.js`

### 🛡️ HTML拼接XSS防护

**问题**: `post-production-engine.js` 直接把角色名、标题等动态文本拼进HTML字符串，特殊字符破坏HTML结构，存在XSS风险。

**修复**: 添加 `escapeHtml` 工具函数，对所有动态文本进行HTML实体转义。

**文件**: `hyperreality-system/engines/post-production-engine/post-production-engine.js`

---

## 影响范围

**修改文件数**: 4个核心文件
**新增代码**: 安全工具函数（escapeHtml, safeParseInt, safeParseFloat）
**删除代码**: 暴力JSON截断O(n²)策略

**受影响的子系统**:
- `core/llm-gateway.js` — LLM网关
- `hyperreality-system/engines/script-engine/core/script-generator.js` — 剧本生成
- `hyperreality-system/engines/script-engine/core/requirement-list-builder.js` — 需求解析
- `hyperreality-system/engines/post-production-engine/post-production-engine.js` — 后期引擎

---

## 验证

- [x] 语法检查通过（`node --check`）
- [x] 安全工具函数独立测试通过
- [x] JSON提取逻辑优化后功能等价

---

## 部署说明

无特殊部署要求，正常更新即可。

---

## Git

- **Commit**: 待提交
- **Tag**: `v2.0.3-audit-fix`
- **Branch**: master

---

*Stay Hungry, Stay Foolish, Stay Brutally Honest.*
