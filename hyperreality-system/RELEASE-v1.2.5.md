# Release v1.2.5

**发布日期**: 2026-06-19
**版本**: v1.2.5
**状态**: 生产版本

---

## 主要修复

### 1. 字段标准化（P0）
- **问题**: `_engineerPrompts` 输出包含大量非标准字段，与 v6.37 标准不一致
- **修复**: 
  - `production-engine.js`: 重写 `standardOutput` 构建逻辑，严格输出 18 个标准字段
  - `index.js`: 修改 `_generatePromptsReport` 去除 `portraits` 依赖
- **标准字段清单**:
  - 正片 S01+: shotId, duration, scene, mood, camera, cameraString, lighting, lightingString, characterRef, character, action, dialogue, timeline, timelineString, backgroundSound, backgroundSoundString, prompt, promptCharCount
  - 片头 S00+: audioLayer, audioLayerString, titleOverlay, titleOverlayString

### 2. 删除剧本确认环节（v1.2.5-fix5）
- **问题**: 用户要求标准流程为需求确认 → 完整预生产 → 提示词审核 → 渲染
- **修复**: 从 `index.js` 删除 `_confirmScript` 和 `_generateScriptReport` 方法

### 3. FieldGuard 片头验证（v1.2.5-fix4/fix3/fix2/fix）
- **问题**: 非第一集视频不应要求 title/subtitle 字段
- **修复**: `field-standardizer.js` 和 `field-guard.js` 增加 series 元数据判断

### 4. 剧本引擎超时（v1.2.5-fix4）
- **问题**: LLM API 调用经常超过 180s
- **修复**: timeout 从 180000ms → 300000ms，maxTokens 扩至 32000

### 5. 角色覆盖问题（v1.2.5-fix3）
- **问题**: LLM 生成剧本时会把陈卓变成小G/小P
- **修复**: `_parseLLMResponse` 注入 metadata characters 覆盖 LLM 生成的角色

---

## 新增文件
- `config/error-codes.js`
- `config/prompt-length.js`
- `config/quality-dimensions.js`
- `core/immutable-shot.js`
- `data/creative-intensity-feedback.json`
- `examples/standard-usage.js`
- `examples/test-full-flow.js`

## 修改文件
- `.current-version`: v1.2.4-alpha5-alpha4 → v1.2.5
- `engines/production-engine/production-engine.js`: 字段标准化
- `index.js`: 删除剧本确认环节 + 提示词审核报告修复

## 验证结果
- 标准字段 18 个全部存在 ✅
- 非标准字段 0 个 ✅
- timeline 类型: 对象 ✅
- camera/lighting/backgroundSound 类型: 对象 ✅
