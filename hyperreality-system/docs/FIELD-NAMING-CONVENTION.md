# SuperMickey 字段命名规范（待实施）

## 当前状态

系统存在多种命名风格混用的问题：
- Phase 1/2 输出字段使用驼峰命名（`cameraString`, `lightingString`）
- PromptFusion 期望下划线命名（`camera_movement`, `lighting`）
- 部分字段有多个别名（`emotionalTarget`/`emotional_target`）

## 短期方案（已实施）

通过 `_resolveField()` 多名字段映射实现向后兼容：
```javascript
// PromptFusionAgent 中支持多名字段读取
const cameraMovement = this._resolveField(shot, 
  'cameraString', 'cameraMovement', 'camera', 'camera_movement'
);
```

## 长期规范建议

### 统一使用下划线命名（snake_case）

| 标准字段名 | 废弃别名 | 说明 |
|-----------|---------|------|
| `camera_movement` | `cameraString`, `cameraMovement`, `camera` | 运镜描述 |
| `lighting` | `lightingString` | 灯光设计 |
| `audio` | `backgroundSoundString`, `backgroundSound` | 音频设计 |
| `mood` | `emotionalTarget`, `emotional_target` | 情绪基调 |
| `character` | - | 角色描述 |
| `action` | - | 动作描述 |
| `scene` | - | 场景描述 |

### 实施路径

1. **Phase 1**: 所有 Agent 统一输出下划线命名字段
2. **Phase 2**: 移除 `_resolveField` 中的别名支持
3. **Phase 3**: 清理所有遗留的驼峰命名字段

### 优先级

- **低优先级**：不影响功能，已有兼容层
- **建议时机**：大版本重构时统一处理

## 相关文件

- `engines/production-engine/agents/prompt-fusion-agent.js` - `_resolveField()` 实现
- `engines/production-engine/phases/phase-2-visual-audio.js` - Phase 2 字段输出
- `engines/production-engine/phases/phase-1-scene-design.js` - Phase 1 字段输出
