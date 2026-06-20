# Hyperreality System v2.0.5 Release Notes

## 版本信息
- **版本号**: v2.0.5-LLM-Agent-Standardization
- **发布日期**: 2026-06-20
- **上一版本**: v2.0.4

## 修复内容

### P0 - 架构级修复：LLM-Agent 路径缺失字段标准化

**根因**: v2.0.0 将制作引擎升级为 LLM-Agent 驱动后，默认路径（`enableLLMAgents=true`）完全绕过了 `_engineerPrompts()` 字段标准化流程，导致 v1.2.5-v1.2.8 修好的核心功能全部丢失。

**影响**: 
- 中文字段名缺失
- 字符数统计缺失
- 时间轴缺失
- 定妆照引用缺失
- 人物介绍卡片缺失

### 修复详情

#### 1. `production-engine.js` - LLM融合后追加字段标准化
- **修改**: Phase 3 PromptFusion 之后调用 `_engineerPrompts()`
- **效果**: LLM创意融合 + 规则标准化 = 既有创意又有规范

#### 2. `production-engine.js` - `_buildShotPrompt()` 支持 fusionText
- **修改**: 当 shot 有 fusionText（LLM融合产出）时，用它替代 L3-L7 机械拼接
- **效果**: 保留LLM的叙事化描述，同时叠加 L1/L2/L9 硬约束

#### 3. `production-engine.js` - 注入 characterRef 到 prompt
- **修改**: 在 L4 层添加 `characterRef: xxx` 到 prompt
- **效果**: 定妆照引用直接嵌入提示词

#### 4. `production-engine.js` - 标准输出添加 characterCards
- **修改**: `_engineerPrompts()` 输出增加 `characterCards` 字段
- **效果**: 人物介绍卡片随镜头输出

#### 5. `index.js` - 报告显示字符数统计
- **修改**: `_generatePromptsReport()` 和 `_generateFinalReport()` 使用 `promptCharCount`
- **效果**: 报告中的字符数准确反映中英文混合计数

#### 6. `index.js` - 报告显示时间轴字符串
- **修改**: 报告中增加 `timelineString` 列
- **效果**: 时间轴直接可读

#### 7. `index.js` - 报告显示人物卡片
- **修改**: 完整提示词章节增加人物卡片列表
- **效果**: 每个镜头的角色信息一目了然

## 文件变更

| 文件 | 变更 |
|------|------|
| `engines/production-engine/production-engine.js` | LLM融合后调用 `_engineerPrompts()` + `_buildShotPrompt()` 支持 fusionText + 注入 characterRef |
| `index.js` | 报告使用 `promptCharCount` + 显示 `timelineString` + 显示 `characterCards` |
| `.current-version` | v2.0.4 → v2.0.5 |

## 验证清单

- [ ] Prompt 包含中文字段名（dialogue: / mood: / timeline: 等）
- [ ] 每个 shot 有 promptCharCount 字段
- [ ] 报告中有时间轴字符串列
- [ ] 报告中有字符数统计列
- [ ] 报告中有角色卡片信息
- [ ] 提示词中包含 characterRef 引用

---
*发布者: 小G*
*时间: 2026-06-20*
