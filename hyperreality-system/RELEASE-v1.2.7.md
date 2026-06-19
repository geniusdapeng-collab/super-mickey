# Release v1.2.7

**发布日期**: 2026-06-19  
**版本**: v1.2.7  
**状态**: 生产版本（基于外部专家完整修复方案）  
**基础**: v1.2.6 + 12项专家修复

---

## 修复内容（全部12项，按优先级排序）

### 批次1：P0 阻断问题（6项）

#### 1. 质量门字段检查 — production-engine.js
**问题**: `_runQualityGate` 访问 `p.lighting?.string` 但标准输出中 lighting 是纯对象，无 `.string` 属性  
**修复**: 改用 `p.lightingString` / `p.timelineString` / `p.backgroundSoundString` / `p.cameraString`  
**状态**: ✅ 修复（v1.2.6部分修复，v1.2.7补全 audioLayerString / titleOverlayString）

#### 2. generateReport 时长统计 TypeError — production-engine.js
**问题**: `result.shots.reduce((sum, s) => sum + s.timing.duration, 0)` 访问已移除字段  
**修复**: `s.duration || s.timing?.duration || 0` + `p.promptCharCount || p.prompt.length`  
**状态**: ✅ 修复

#### 3. _generateFinalReport 访问不存在字段 — index.js
**问题**: 访问 `shot.timing.duration`、`shot.sceneType`、`shot.status`、`p.length`、`p.imageRefs` 等已移除字段  
**修复**: 全面替换为标准输出字段  
**状态**: ✅ 修复

#### 4. 角色覆盖不彻底 — script-generator.js
**问题**: 只处理 `scene.dialogue.lines` 一种结构，LLM 输出其他格式时覆盖失效  
**修复**: 兼容4种 dialogue 结构 + 正则替换场景描述/narration 中残留角色名  
**状态**: ✅ 修复

#### 4b. characters 数组未传递到剧本引擎 — index.js + requirement-list-builder.js
**问题**: `toScriptEngineMetadata` 未返回 `characters`，导致角色覆盖前置条件缺失  
**修复**: `toScriptEngineMetadata` 新增 `characters` + `enhancedMetadata` 显式保留  
**状态**: ✅ 修复

#### 5. 最终导出标准化覆盖破坏 prompts — index.js
**问题**: `productionResult.prompts = normalized.shots` 用标准化后的 shots 覆盖 prompts  
**修复**: 删除此行，prompts 保持原样（已是标准输出对象）  
**状态**: ✅ 修复

### 批次2：P1 质量提升（2项）

#### 6. FieldGuard 关键字段含已废弃字段 — field-standardizer.js
**问题**: `CRITICAL_FIELDS.common` 包含 `portraits`/`characterCards`/`timeline`  
**修复**: 移除已废弃字段，新增 `character`/`characterRef`  
**状态**: ✅ 修复

#### 7. printShotSummary 检查已移除字段 — field-guard.js
**问题**: 检查 `shot.portraits`/`shot.timeline`（数组）/`shot.characterCards`  
**修复**: 改用 `characterRefCount`/`hasTimeline`/`hasLighting`/`hasBackgroundSound`  
**状态**: ✅ 修复

### 批次3：P2 稳定性（3项）

#### 8. LLM 调用未强制 JSON 模式 — script-generator.js
**问题**: 未传 `forceJson: true`，reasoning_content 顶替 content 导致解析失败  
**修复**: `forceJson: true` + `allowReasoningFallback: false`  
**状态**: ✅ 修复

#### 9. temperature 参数链路不统一 — script-generator.js
**问题**: fallback HTTP 调用使用 `this.config.temperature` 可能非1  
**修复**: 硬编码 `temperature: 1` + `top_p: 0.95`  
**状态**: ✅ 修复

#### 10. _buildShotPrompt 音频层缺失 — production-engine.js
**问题**: `_buildShotPrompt` 被调用时 `shot` 无 `backgroundSound` 字段  
**修复**: 预先生成 backgroundSound 注入 shot  
**状态**: ✅ 修复

### 批次4：P3 健壮性（1项）

#### 11. JSON 截断解析加固 — script-generator.js
**问题**: 两种策略都依赖 `braceCount === 0`，截断时括号永不闭合  
**修复**: 新增策略4：自动补全缺失闭合括号  
**状态**: ✅ 修复

#### 12. 山海经 IP 硬编码清理 — llm-reasoning-engine.js
**问题**: `_extractFromReasoning` indicators 硬编码 Nirath/小G/白泽等  
**修复**: 改为通用 JSON 结构特征 + 通用影视术语  
**状态**: ✅ 修复（主系统）

---

## 验证清单

- [ ] 质量门 `passedCount` 等于 `totalPrompts`（所有镜头通过）
- [ ] 生成报告中"镜头总览"表格时长不为 `undefined`
- [ ] 生成报告中"完整 Prompts"显示正确字符数和定妆照
- [ ] 控制台无 `Empty critical array: portraits` 警告
- [ ] 第二集预生产角色为"陈卓"而非"小G/小R"
- [ ] LLM 调用日志显示 `content=非0`（forceJson 生效）
- [ ] 无 `Invalid request Error`（temperature=1 生效）
- [ ] prompt 中包含 `audio: AMBIENT:` 字样（音频层补全）

---

## 文件变更

| 文件 | 变更行数 | 修复编号 |
|------|----------|----------|
| `engines/production-engine/production-engine.js` | +35/-? | 1, 2, 10 |
| `engines/script-engine/core/script-generator.js` | +247/-? | 4, 8, 9, 11 |
| `engines/script-engine/core/requirement-list-builder.js` | +104/-? | 4b |
| `engines/field-guard.js` | +35/-? | 7 |
| `engines/field-standardizer.js` | +4/-? | 6 |
| `index.js` | +24/-? | 3, 4b, 5 |
| `systems/llm-reasoning-engine.js` | +16/-? | 12 |

---

> 本版本基于外部专家完整修复方案（12项），覆盖诊断报告全部 P0-P3 问题。
