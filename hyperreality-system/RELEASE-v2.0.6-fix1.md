# Release v2.0.6-fix1

## 修复内容

### 1. 时间轴太简单（2段）→ 已修复 ✅
- **根因**: VisualLanguageAgent system prompt 中允许 `动态切分2-4段`
- **修复**: 改为 `动态切分4-6段，根据情绪起伏设计，每段包含时间范围、运镜动作、画面目的，必须详细具体`
- **验证**: SC00-05 时间轴分别为 4、5、5、5、4、3 段

### 2. 定妆照路径为描述文本（"陈卓: main character"）→ 已修复 ✅
- **根因1**: ScriptGenerator._overrideCharacters 中使用 `c.id || c.name`，但用户传入的是 `character_id` 而非 `id`
- **根因2**: ProductionEngine._buildCharacterRef 搜索时未正确处理中文名映射
- **修复**: 
  - ScriptGenerator: `c.id || c.name` → `c.character_id || c.id || c.name`
  - ProductionEngine: 使用 `char.character_id` 作为目录名，支持中文名回退查找
  - Adapter: 增强 _resolvePortraitPaths，支持 portraits/ 子目录和带前缀文件名
- **验证**: 定妆照显示 `image://characters/chen-zhuo/front.png`

### 3. dialogueStr.split is not a function → 已修复 ✅
- **根因**: FieldGuard.printShotSummary 中 `shot.dialogue` 可能为对象而非字符串
- **修复**: 强制类型转换 `typeof shot.dialogue === 'string' ? shot.dialogue : String(shot.dialogue || '')`

### 4. 中文字段名 → 已在 v2.0.6 完成
- 全部 11+ 字段使用【】格式

## 文件变更
- `engines/production-engine/agents/visual-language-agent.js` - 时间轴 prompt 收紧
- `engines/script-engine/core/script-generator.js` - character_id 支持
- `engines/script-engine/core/adapter.js` - 定妆照路径解析增强
- `engines/production-engine/production-engine.js` - 定妆照查找增强
- `engines/field-guard.js` - dialogue 字段类型安全
