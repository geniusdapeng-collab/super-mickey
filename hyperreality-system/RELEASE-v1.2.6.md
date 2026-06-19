# Release v1.2.6

**发布日期**: 2026-06-19
**版本**: v1.2.6
**状态**: 生产版本

---

## 修复内容（基于预生产第二集发现的问题）

### 1. 质量门字段检查修复 (P0)
**文件**: `engines/production-engine/production-engine.js`
**问题**: 质量门检查逻辑使用 `p.lighting?.string` 等对象属性访问，但 v6.37 标准将字符串字段独立为 `lightingString`、`timelineString`、`backgroundSoundString`
**修复**: 
- `hasLighting`: `p.lighting?.string` → `p.lightingString`
- `hasTimeline`: `p.timeline?.string` → `p.timelineString`
- `hasBackgroundSound`: `p.backgroundSound?.string` → `p.backgroundSoundString`
- `hasCamera`: `p.camera?.string` → `p.cameraString`
- `timelineFormat`: 同步修复

### 2. 时长显示修复
**文件**: `index.js`
**问题**: `_generateFinalReport` 使用 `shot.timing.duration`，但 v6.37 已移除 `timing` 对象，标准字段为 `duration`
**修复**: `shot.timing.duration` → `shot.duration || shot.timing?.duration || 0`

### 3. FieldGuard 字段清理
**文件**: `engines/field-standardizer.js`, `engines/field-guard.js`
**问题**: CRITICAL_FIELDS 包含已移除字段 `portraits`、`characterCards`；`printShotSummary` 引用已移除字段
**修复**:
- `CRITICAL_FIELDS.common`: 移除 `portraits`、`characterCards`，添加 `characterRef`
- `createEmptyShot`: 标记 `portraits`、`characterCards` 为 deprecated
- `printShotSummary`: 移除 portraitCount/timelineCount/cardCount，改为 timelineType/characterRef

---

## 验证
- 质量门字段检查与 v6.37 标准输出字段对齐 ✅
- 时长显示使用标准字段 `duration` ✅
- FieldGuard 不再检查已移除字段 ✅
