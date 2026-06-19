# 外部专家方案已收到

**时间**: 2026-06-19 23:27
**来源**: 外部专家（基于全量代码分析）

## 方案核心

### 根因
6个Agent纯串行累加≈11-13分钟，压在SIGTERM线上。

### 解法
**串行→并行+全局时间预算+重试收敛**

### 并行编排
```
Phase 1: SceneDesign ∥ OpeningDesign  (独立)
Phase 2: VisualLanguage ∥ AudioDesign ∥ ContinuityReview  (三者互不冲突)
Phase 3: PromptFusion  (依赖VisualLanguage)
```

### 关键路径
SceneDesign + VisualLanguage + PromptFusion ≈ 408-506s（6.8-8.4分钟）

### 三个文件改动
1. `agents/base-agent.js` - 整体替换（模型透传+截止时间+重试收敛）
2. `systems/llm-reasoning-engine.js` - 整体替换（reasonStructured支持deadlineMs+门控重试）
3. `production-engine.js` - 方法级替换（produce并行编排+分模型+质量门修复+辅助方法）

### 预期效果
| 指标 | 改造前 | 改造后 |
|------|--------|--------|
| 关键路径 | 662s+ | ~408-506s |
| SIGTERM | ❌必触 | ✅稳在11分钟内 |
| 降级 | PromptFusion被迫降级 | 0降级 |

## 实施状态
- [ ] 保存专家方案文件
- [ ] 替换base-agent.js
- [ ] 替换llm-reasoning-engine.js
- [ ] 替换production-engine.js
- [ ] 运行验证
