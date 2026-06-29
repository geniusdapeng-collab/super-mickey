# v6.5.35 发布说明

## 修复内容

### 1. toStandardPrompt 约束字段保留（v6.5.34-fix 补充）
**问题**：toStandardPrompt 将【】格式转换为 CHARACTER:... 格式，导致约束字段丢失。
**修复**：在 toStandardPrompt 返回前追加保留【风格锁】【负面约束】【角色约束】【镜头时间轴】【明亮约束】。
**文件**：`systems/nirath-master-pipeline.js`

### 2. RENDER 字段中文超写实描述
**问题**：toStandardPrompt 默认 RENDER 字段为英文，缺少中文"超写实"风格词。
**修复**：Nirath 模式下使用中文渲染描述："超写实数字渲染，影视级画面构图..."。
**文件**：`systems/nirath-master-pipeline.js`

### 3. 验证器适配 narration 禁用策略
**问题**：完整性验证器仍检查 narration 为空，与全局禁用策略冲突。
**修复**：STAGE-5 改为检查 narration/dialogue；STAGE-12 waste 状态从错误降为警告。
**文件**：`systems/pipeline-integrity-validator.js`

### 4. 时长校验基于 dialogue
**问题**：pre-render-validation 基于 narration 计算时长，与禁用策略冲突。
**修复**：检查 narration 或 dialogue 字数与 duration 匹配。
**文件**：`systems/pre-render-validation.js`

## 版本历史
- v6.5.34: 全局禁用 narration，约束注入，重复去重，时间轴同步
- v6.5.35: 修复 toStandardPrompt 丢失约束字段，验证器适配 narration 禁用
