# RELEASE v2.0.5 - LLM Agent 输出彻底修复

## 修复日期
2026-06-20

## 修复概述
彻底修复 v2.0.0 LLM-Agent 重构引入的数据格式不兼容问题，确保 LLM 输出与规则引擎输出完全兼容。

## 核心问题
v2.0.0 LLM-Agent 引入的数组/对象格式（timeline[]、camera{}、lighting{}）与 v1.x 的字符串格式不兼容，导致：
1. 中文字段名部分缺失（timeline、characterRef）
2. 时间轴丢失（数组无法转为字符串）
3. 定妆照字段缺失（characterRef 为 NONE）
4. 人物卡片显示"未知角色"
5. Prompt 中出现 [object Object] 污染

## 修复方案
### 1. 新增 `_normalizeLLMOutput()` 标准化层
- 在 PromptFusion 后、_engineerPrompts 前调用
- 将 LLM 的各种输出格式统一转换为字符串：
  - `timeline: Array` → `timelineString: "0s-3s: 缓推全景 | 3s-7s: 匀速前移"`
  - `camera: Object` → `cameraString: "shotSize, movement, lens"`
  - `lighting: Object` → `lightingString: "key: direction colorTempK effect"`
  - `backgroundSound: Object` → `backgroundSoundString: "AMBIENT: ... | SPATIAL: ..."`
- 角色信息补全：如果 shot 没有 characters，从 blueprint 补
- 定妆照兜底：如果 characterRef 为 NONE，用角色描述生成

### 2. 修改 `_engineerPrompts()` 防御式适配
- 优先使用标准化后的字段（cameraString / lightingString / timelineString）
- 多重兜底：标准化字段 → .string → typeof string → 数组转换 → 空字符串
- 确保 backgroundSound 有 string 版本

### 3. 新增 `_runQualityGateAdapted()` 适配质量门
- LLM 融合模式下放宽检查：有 fusionText 时，timeline/camera/lighting 可不在独立字段
- 避免误报"失败"

### 4. 修改 `_buildCharacterCards()` 健壮性
- 优先从 blueprint.characters 获取（更完整）
- 支持 character_id 和 id 两种字段名
- 支持 description / persona / personality 多种描述字段
- 空数组时从 blueprint.config/meta 兜底

## 验证结果
- 6 镜，65秒，全写实
- 中文字段名：全部存在（dialogue / mood / timeline / characterRef / audio）
- 时间轴：每镜都有完整字符串
- 定妆照："陈卓: main character"
- 人物卡片："陈卓 (protagonist)"
- 无 [object Object] 污染
- LLM Agent：全量模式，未降级

## 影响范围
- `engines/production-engine/production-engine.js`
  - 新增 `_normalizeLLMOutput()`
  - 新增 `_runQualityGateAdapted()`
  - 修改 `_engineerPrompts()`
  - 修改 `_buildCharacterCards()`
  - 修改 `produce()` 调用链

## 后续预防
- 任何新增 Agent 输出字段必须经过 `_normalizeLLMOutput()` 标准化
- 禁止绕过标准化层直接调用 `_engineerPrompts()`
- 质量门检查必须使用适配版本 `_runQualityGateAdapted()`
