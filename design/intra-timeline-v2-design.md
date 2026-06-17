# 镜头内时间轴系统 v2.0 设计方案

> **问题来源**: 队长反馈v3时间轴系统三大问题
> **设计目标**: 个性化、连贯性、场景适配
> **设计原则**: LLM驱动+规则约束（非纯规则模板）

---

## 一、问题诊断

### 问题1：模板化严重（最严重）

**现状**：
```javascript
// 当前系统：纯规则映射
const sceneTypeToTransition = {
  opening: 'progressive_reveal',      // 永远: 极端远景→远景→中景→特写
  dialogue: 'dialogue_dance',         // 永远: 中景→特写→特写→中景
  closing: 'poetic_wander',           // 永远: 极端特写→中景→极端远景→特写
};
```

**结果**：
- S01 开场介绍(5s): 极端远景→远景→中景→特写 ❌（开场应该是中景/特写直接展示人物）
- S02 病理机制讲解(13s): 极端远景→远景→中景→特写 ❌（讲解场景应该是稳定的中景/近景）
- S05 专家结语(7s): 极端特写→中景→极端远景→特写 ❌（结语应该是稳定的特写）

**根因**：
1. `sceneType→transitionType` 是硬编码映射
2. `transitionType→sequence` 是固定数组（progressive_reveal 永远是4段）
3. 没有考虑镜头具体内容、场景、人物位置

### 问题2：镜头间连续性缺失

**现状**：
```
S01 结束: 特写(面部)          ← 最后一段
S02 开始: 极端远景(环境全貌)    ← 第一段
```

**问题**：特写→极端远景 = 视觉跳跃，观众出戏

**电影语言规则**：
- 特写→中景：平滑（同主体）
- 特写→远景：跳跃（需过渡镜头或匹配剪辑）
- 中景→中景：最平滑（对话标准切换）

### 问题3：场景不适配

**现状**：
- 室内讲解场景 → 极端远景 ❌（室内无法展示极端远景）
- 医院诊室 → 远景 ❌（诊室空间小）
- 人物特写 → 360度环绕 ❌（单人讲解不需要环绕）

---

## 二、设计思路

### 核心原则：内容驱动的个性化时间轴

**旧模式**：`sceneType → transitionType → sequence`（规则链）
**新模式**：`sceneContent → LLM分析 → 个性化时间轴`（内容驱动）

### 架构层级

```
Layer 1: 场景分析（规则+LLM）
  ↓ 输入：场景描述、类型、情绪、人物、空间
  ↓ 输出：空间约束、景别范围、运镜禁忌

Layer 2: 时间轴生成（LLM驱动）
  ↓ 输入：Layer 1分析结果 + 镜头具体内容
  ↓ 输出：个性化时间轴（段数、景别、运镜、时长）

Layer 3: 连续性校验（规则引擎）
  ↓ 输入：当前镜头时间轴 + 上一个镜头结束状态
  ↓ 输出：调整建议/警告

Layer 4: 可选开关（产品决策）
  ↓ 输入：导演/用户偏好
  ↓ 输出：启用/禁用时间轴、简化/复杂模式
```

---

## 三、详细设计

### 3.1 Layer 1: 场景分析器（SceneAnalyzer）

**职责**：分析场景约束条件，为LLM生成提供上下文

**分析维度**：

| 维度 | 规则 | 示例 |
|------|------|------|
| **空间大小** | 从场景描述推断 | "医院诊室"→小空间，限制wide以上 |
| **人物数量** | 从角色列表计算 | 1人→close_up/medium；2人→medium/two-shot |
| **场景类型** | 语义匹配 | "讲解"→stable；"追逐"→dynamic |
| **情绪阶段** | 情绪映射 | establishing→wide→medium；climax→mixed |
| **镜头时长** | 时长决定段数 | <5s→2-3段；5-10s→3-4段；>10s→4-5段 |

**输出格式**：
```json
{
  "spaceConstraint": {
    "maxShotSize": "medium",      // 室内场景限制
    "minShotSize": "close_up",
    "forbiddenSizes": ["extreme_wide", "wide"]
  },
  "recommendedSequence": ["medium", "close_up"],  // 推荐景别范围
  "movementStyle": "stable",      // stable/dynamic/orbit
  "segmentCount": { "min": 2, "max": 3 },
  "lightingType": "spotlight_drama"
}
```

### 3.2 Layer 2: LLM时间轴生成器（LLMTimelineGenerator）

**职责**：基于场景分析+具体内容，生成个性化时间轴

**Prompt设计**：
```
你是一位专业的纪录片摄影师。请为以下镜头设计内部时间轴。

【场景信息】
- 场景: 医院诊室，健康教育讲解
- 人物: 陈卓（女护士，单人出镜）
- 时长: 13秒
- 内容: 讲解横纹肌溶解的病理机制
- 情绪: 专业、清晰、关切

【空间约束】
- 室内小空间，景别限制: 中景到特写
- 禁止: 远景、极端远景

【输出要求】
设计4段式时间轴，每段包含：
1. 时间范围（精确到0.5秒）
2. 景别（从约束范围内选择）
3. 运镜动作（适合讲解场景）
4. 速度（缓慢/稳定为主）

注意：
- 讲解场景以稳定中景/近景为主
- 可适当推进到特写强调重点
- 避免快速运镜分散注意力
```

**LLM输出格式**：
```json
{
  "timeline": {
    "strategy": "稳定讲解式",
    "description": "中景稳定展示人物，配合缓慢推进强调重点",
    "segments": [
      {
        "timeRange": "0-4s",
        "shotSize": "medium",
        "movement": "stable_hold",
        "speed": "slow",
        "description": "中景稳定，展示人物讲解姿态"
      },
      {
        "timeRange": "4-8s",
        "shotSize": "medium_close",
        "movement": "slow_push",
        "speed": "slow",
        "description": "缓慢推进到近景，强调关键信息"
      },
      {
        "timeRange": "8-11s",
        "shotSize": "close_up",
        "movement": "stable_hold",
        "speed": "static",
        "description": "特写面部，传递关切情绪"
      },
      {
        "timeRange": "11-13s",
        "shotSize": "medium_close",
        "movement": "slow_pull",
        "speed": "slow",
        "description": "缓慢拉回到近景，准备过渡"
      }
    ]
  }
}
```

### 3.3 Layer 3: 连续性引擎（ContinuityEngine）

**职责**：检查并修复镜头间的视觉跳跃

**连续性规则库**：

```javascript
const CONTINUITY_RULES = {
  // 景别跳跃限制
  shotSizeJump: {
    'extreme_close': ['close_up', 'extreme_close'],  // 极端特写只能→特写或保持
    'close_up': ['close_up', 'medium', 'extreme_close'],  // 特写→中景/特写
    'medium': ['medium', 'close_up', 'wide', 'full'],  // 中景→多种
    'wide': ['wide', 'medium', 'extreme_wide'],  // 远景→中景/远景
    'extreme_wide': ['extreme_wide', 'wide']  // 极端远景→远景
  },
  
  // 运动方向连续性
  movementDirection: {
    // 如果上一个镜头结束是push_in，下一个避免pull_out（方向冲突）
    'push_in': { avoidStart: ['pull_out', 'pull_back'] },
    'pull_out': { avoidStart: ['push_in', 'push_forward'] },
    'orbit_cw': { avoidStart: ['orbit_ccw'] },  // 避免反向旋转
  },
  
  // 建议的过渡策略
  transitionSuggestion: {
    'close_up→extreme_wide': {
      warning: '视觉跳跃大',
      suggestion: '建议插入过渡镜头或使用匹配剪辑',
      alternatives: ['close_up→medium→wide', '使用遮挡物过渡']
    }
  }
};
```

**修复策略**：
1. **警告**：记录连续性风险，供导演决策
2. **自动修复**：调整下一段的起始景别
3. **插入过渡**：在Prompt中建议过渡效果

### 3.4 Layer 4: 可选开关（FeatureToggle）

**产品决策**：时间轴不是必须，根据场景启用

```javascript
const TIMELINE_TOGGLE = {
  // 强制启用（复杂场景）
  forceEnable: ['action', 'chase', 'climax', 'opening', 'closing'],
  
  // 默认启用（一般场景）
  defaultEnable: ['dialogue', 'interaction', 'environment', 'discovery'],
  
  // 默认禁用（简单场景）
  defaultDisable: ['static_shot', 'single_frame', 'title_card'],
  
  // 用户/导演覆盖
  userOverride: null  // 'always' | 'never' | 'auto'
};
```

**简化模式**：
- **复杂模式**：4-5段，全功能（景别+运镜+灯光+速度+转场）
- **标准模式**：3段，核心功能（景别+运镜+速度）
- **简化模式**：2段，仅景别切换（适合短视频）
- **禁用**：单段，无时间轴（适合简单场景）

---

## 四、与现有系统的集成

### 4.1 修改点

| 文件 | 修改内容 | 影响 |
|------|----------|------|
| `camera-movement-system-v3.js` | 重写`generateTimeline`为LLM驱动 | 核心升级 |
| `nirath-master-pipeline.js` | Stage 9新增Layer 1分析+Layer 3连续性检查 | 链路增强 |
| `orient-primordial-core-v24.js` | Step 4适配新格式 | 渲染兼容 |

### 4.2 向后兼容

- v3旧版`generateTimeline`保留为`generateTimelineLegacy`
- 新增`generateTimelineV2`为LLM驱动版本
- Pipeline配置`timelineVersion: 'v2' | 'legacy'`可选

### 4.3 性能考虑

- LLM调用增加1次/镜头（时间轴生成）
- 可缓存：相同场景类型+情绪+时长的组合可复用
- 降级：LLM失败时回退到规则版本

---

## 五、验证方案

### 5.1 单元测试

| 测试场景 | 预期结果 |
|----------|----------|
| 室内讲解(5s) | 2-3段，中景→特写，稳定运镜 |
| 室外发现(10s) | 4段，渐进揭示，动态运镜 |
| 特写→特写连续 | 连续性引擎通过 |
| 特写→极端远景 | 连续性引擎警告+修复建议 |

### 5.2 集成测试

1. 跑完整预生产（健康科普EP01）
2. 检查每个镜头时间轴是否符合内容
3. 检查相邻镜头连续性
4. 对比v1/v2/v3效果差异

---

## 六、实施计划

### Phase 1: Layer 1（场景分析器）
- 实现空间约束推断
- 实现景别范围推荐
- 集成到Pipeline Stage 9

### Phase 2: Layer 2（LLM驱动生成）
- 设计LLM Prompt模板
- 实现响应解析器
- 添加缓存机制

### Phase 3: Layer 3（连续性引擎）
- 实现规则库
- 实现自动修复
- 添加警告日志

### Phase 4: Layer 4（可选开关）
- 实现Feature Toggle
- 添加简化模式
- 用户/导演控制

### Phase 5: 验证与发布
- 单元测试
- 集成测试
- 生产发布

---

## 七、队长决策点

1. **LLM调用成本**：每镜头增加1次LLM调用，是否接受？
2. **简化模式默认**：短视频（<10s）默认简化模式（2段）？
3. **连续性严格度**：自动修复 vs 仅警告？
4. **实施优先级**：Phase 1→2→3→4 顺序，还是先做关键部分？
