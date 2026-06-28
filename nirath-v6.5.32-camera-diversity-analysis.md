# Nirath 视频系统 v6.5.32 运镜多样性问题深度分析

> 提交日期：2026-06-09
> 系统版本：v6.5.32-fix4
> 分析人：小G（AI Assistant）
> 用途：提交外部专家诊断

---

## 一、问题概述

**现象**：健康科普视频（generic 模式）预生产完成后，5 个镜头全部被判定为「0 段运镜」，导致质量评分仅 30-38.5 分（满分 100），QualityGate 总评 63 分（C 级，WARN）。

**矛盾点**：
- Stage 9 运镜系统日志显示：`v3多段式: 0 | FPV: 1 | 传统: 4`（有 4 个传统运镜）
- Stage 11 镜头内增强却显示：`镜头内增强: S01 | 0段运镜 | 质量评分:34.5分 [运镜0+...]`
- PromptForge 后 QualityGate 又显示：`S01: 结构3/3 长度900 运镜✅ 总分75`

**三个阶段的判断不一致**，说明 Stage 11 的检测逻辑存在 false negative（有运镜但检测不到）。

---

## 二、期望结果

1. **运镜多样性**：5 个镜头、总时长 60 秒，至少应有 2-3 种不同运镜类型（推近、环绕、横移等），不能全是「平滑跟拍」
2. **质量评分**：per-shot 质量分从 34-38.5 提升到 65+（专家方案 P0 目标）
3. **运镜段数**：每个镜头至少 2-3 段运镜（对应时长 8-15 秒），段数越多 cameraVariety 越高（最高 15 分）

---

## 三、根因分析（已定位）

### 根因 1：字段名不匹配（`segments` vs `_segments`）

**位置**：`systems/nirath-master-pipeline.js` line ~4392

```javascript
// v6.2-patch107-fix: cameraVariety必须定义,否则评分代码崩溃
// 基于运镜段数计算运镜多样性评分(最高15分)
let cameraVariety = 0;
let segCount = 0;
if (enhanced && enhanced.segments) {
  segCount = enhanced.segments.length;  // ❌ 检查的是 enhanced.segments
} else if (shot.cameraMovement && typeof shot.cameraMovement === 'string') {
  segCount = (shot.cameraMovement.match(/→|->|,/g) || []).length + 1;
} else if (shot.cameraMovement && Array.isArray(shot.cameraMovement.timeline)) {
  segCount = shot.cameraMovement.timeline.length;
} // ... 其他 fallback
```

**但 `enhanceShotPrompt` 返回的是 `_segments`（带下划线）**：

```javascript
// systems/intra-shot-prompt-enhancer.js line ~633
return {
  ...shot,
  prompt: enhancedPrompt,
  _intraShotEnhanced: true,
  _enhancementVersion: INTRA_SHOT_VERSION,
  _segments: segments,        // ✅ 返回的是 _segments
  _comboType: detectedCombo,
  _originalPrompt: originalPrompt
};
```

**结论**：`enhanced.segments` 永远为 `undefined`，所以 `segCount` 永远为 0，`cameraVariety` 永远为 0。

### 根因 2：运镜类型单一（全是 smooth_track）

**位置**：`systems/camera-movement-system-v2.js` line ~763

```javascript
generateMovement(shot, options = {}) {
  const { 
    shotSize = "medium",
    position = "center",
    movement = "smooth_track",  // ❌ 默认全是 smooth_track
    speed = "smooth",
    // ...
  } = options;
  // ...
  return {
    description: movementDesc,    // "平滑平滑跟拍，中景居中构图..."
    movement: "smooth_track",      // ❌ 全是 smooth_track
    movementType: "smooth_track",  // v6.5.32-fix 已添加
    // ...
  };
}
```

**输出验证**（5 个镜头全部相同）：

```json
"cameraMovement": {
  "description": "平滑平滑跟拍，中景居中构图，纪录片场景...",
  "movement": "smooth_track"
}
```

**问题**：即使修复了 `segments` 字段名，如果所有镜头都是 `smooth_track`，运镜多样性评分仍然低。

### 根因 3：generic 模式没有专属运镜组合

**位置**：`systems/intra-shot-prompt-enhancer.js` line ~680

```javascript
// detectComboType 对于健康科普场景：
if (type === 'explanation') return 'intimate';      // 讲解镜头
if (type === 'demonstration') return 'suspense';    // 演示镜头
if (type === 'opening') return 'opening';           // 开场镜头
if (type === 'closing') return 'epic';               // 结尾镜头
```

**CAMERA_COMBOS 定义**（`intimate` 组合）：

```javascript
'intimate': {
  name: '亲密对话',
  segments: [
    { camera: 'static', duration: 2, lighting: 'LIT-N02', emotion: '宁静' },
    { camera: 'push_in', duration: 3, lighting: 'LIT-D03', emotion: '聚焦' },
    { camera: 'orbit_right', duration: 2, lighting: 'LIT-D08', emotion: '升华' }
  ],
  description: '固定建立 → 推近聚焦 → 环绕升华'
}
```

**问题**：`intimate` 组合有 3 个 segments，但 `enhanced._segments` 返回了正确的段数，只是 `nirath-master-pipeline.js` 检测不到。

---

## 四、相关代码片段

### 1. enhanceShotPrompt 返回结构（`intra-shot-prompt-enhancer.js`）

```javascript
function enhanceShotPrompt(shot, options = {}) {
  const {
    forceMultiSegment = true,   // 强制多段（禁止单一运镜超过4秒）
    comboType = 'auto',
    maxSegmentDuration = 5,
    lightingFollowEmotion = true,
    mergeStrategy = 'append_constraints',
    maxLength = 980
  } = options;

  const duration = shot.duration || 10;
  const originalPrompt = shot.prompt || '';

  // 1. 判断运镜组合类型
  const detectedCombo = detectComboType(shot, comboType);
  const combo = CAMERA_COMBOS[detectedCombo] || CAMERA_COMBOS['opening'];

  // 2. 根据时长调整段数
  const segments = distributeSegments(combo.segments, duration, maxSegmentDuration);
  // 预期：3 segments（intimate 组合）

  // 3. 为每段分配光影
  if (lightingFollowEmotion) {
    assignLightingToSegments(segments, shot.emotionTags || shot.emotion || ['宁静']);
  }

  // 4. 构建时间轴Prompt
  const timelinePrompt = buildTimelinePrompt(segments, shot);

  // 5. 合并原始Prompt + 时间轴
  const enhancedPrompt = mergePrompts(originalPrompt, timelinePrompt);

  // 6. 记录增强信息
  return {
    ...shot,
    prompt: enhancedPrompt,
    _intraShotEnhanced: true,
    _enhancementVersion: INTRA_SHOT_VERSION,
    _segments: segments,        // ✅ 3 segments
    _comboType: detectedCombo,
    _originalPrompt: originalPrompt
  };
}
```

### 2. 质量评分逻辑（`nirath-master-pipeline.js` line ~4392）

```javascript
// v6.2-patch107-fix: cameraVariety必须定义,否则评分代码崩溃
// 基于运镜段数计算运镜多样性评分(最高15分)
let cameraVariety = 0;
let segCount = 0;
if (enhanced && enhanced.segments) {              // ❌ enhanced.segments 永远 undefined
  segCount = enhanced.segments.length;
} else if (shot.cameraMovement && typeof shot.cameraMovement === 'string') {
  segCount = (shot.cameraMovement.match(/→|->|,/g) || []).length + 1;
} else if (shot.cameraMovement && Array.isArray(shot.cameraMovement.timeline)) {
  segCount = shot.cameraMovement.timeline.length;
} else if (shot.cameraMovement && shot.cameraMovement.timeline && Array.isArray(shot.cameraMovement.timeline.segments)) {
  segCount = shot.cameraMovement.timeline.segments.length;
} else if (shot.cameraMovement && shot.cameraMovement.segments && Array.isArray(shot.cameraMovement.segments)) {
  segCount = shot.cameraMovement.segments.length;
}

if (segCount >= 4) cameraVariety = 15;
else if (segCount >= 3) cameraVariety = 11;
else if (segCount >= 2) cameraVariety = 7;
else if (segCount >= 1) cameraVariety = 3;
else cameraVariety = 0;                           // ❌ 永远走到这里

const totalScore = Math.min(100, cameraVariety + lightingProgression + emotionalDepth + promptUtilization + narrativeAlignment);
// cameraVariety=0 → totalScore 最高 85（但其他维度也不高，实际 30-38）
```

### 3. cameraMovement 生成（`camera-movement-system-v2.js`）

```javascript
// v1 API：通用运镜（向后兼容）
generateMovement(shot, options = {}) {
  const { 
    shotSize = "medium",
    position = "center",
    movement = "smooth_track",  // ❌ 默认单一
    speed = "smooth",
    physics = false,
    timeRange = [0, 5]
  } = options;
  // ...
  return {
    description: movementDesc,    // "平滑平滑跟拍..."
    movement: movement,           // "smooth_track"
    movementType: movement,       // v6.5.32-fix 添加
    speed: speed,
    shotSize: shotSize,
    position: position,
    timeRange: timeRange,
    physics: physics
  };
}
```

### 4. 当前输出示例（`output/rhabdomyolysis-ep01-preproduction.json`）

```json
{
  "cameraMovement": {
    "description": "平滑平滑跟拍，中景居中构图，纪录片场景。5秒内完成景别过渡，保持画面稳定流畅。通过精准的镜头运动引导观众视线，强化叙事节奏。",
    "movement": "smooth_track"
  },
  "qualityScore": {
    "cameraVariety": 0,
    "totalScore": 34.5
  }
}
```

---

## 五、当前系统修复状态

### 已修复（v6.5.32-fix4）

| 问题 | 状态 | 版本 |
|------|------|------|
| `[object Object]` 残留 | ✅ 已根治 | v6.5.31 |
| 角色差异化（年龄/性别/服装） | ✅ 已生效 | v6.5.32-fix |
| 角色约束动态生成 | ✅ 已生效 | v6.5.32-fix |
| 环境布景 mode 守卫 | ✅ 已生效 | v6.5.32-fix |
| 角色属性推断（_inferRoleAttributes） | ✅ 已生效 | v6.5.32-fix2 |
| 环境布景 Nirath 关键词过滤 | ✅ 已生效 | v6.5.32-fix2 |
| 角色约束显示中文名 | ✅ 已生效 | v6.5.32-fix4 |

### 未修复（核心瓶颈）

| 问题 | 优先级 | 影响 |
|------|--------|------|
| 运镜多样性 0 分 | **P0** | 质量分 34→65+ 的关键 |
| 运镜类型单一（全是 smooth_track） | **P0** | 5 镜头无变化 |
| 字段名不匹配（segments vs _segments） | **P0** | 检测不到段数 |
| 合规检查标准符合度低（40%） | P1 | 缺失 CHARACTER/ACTION 等字段 |

---

## 六、测试数据

### 预生产 Session 日志

```
[2026-06-08T15:46:23.443Z] [STAGE-9] INFO: ✅ 运镜完成 | 镜头数: 5 | v3多段式: 0 | FPV: 1 | 传统: 4
[2026-06-08T15:46:23.458Z] [STAGE-11] INFO:   🎬 镜头内增强: S01 | 0段运镜 | 质量评分:38.5分 [运镜0+光影8+情绪7.5+空间15+对齐8]
[2026-06-08T15:46:23.475Z] [PIPELINE] INFO:   S01: 结构3/3 长度900 运镜✅ 总分75
[2026-06-08T15:46:23.482Z] [INFO] [quality-gate] 质量总评完成 {"totalScore":63,"grade":"C","status":"WARN"}
```

### 质量评分详情

| 镜头 | 运镜 | 光影 | 情绪 | 空间 | 对齐 | 总分 |
|------|------|------|------|------|------|------|
| S01 | 0 | 8 | 7.5 | 15 | 8 | 38.5 |
| S02 | 0 | 8 | 7.5 | 15 | 8 | 38.5 |
| S03 | 0 | 8 | 5.5 | 15 | 9.5 | 38 |
| S04 | 0 | 8 | 6.5 | 15 | 6 | 35.5 |
| S05 | 0 | 2 | 5 | 15 | 5 | 27 |

---

## 七、请求外部专家解答的问题

1. **字段名不匹配**：`enhanced._segments` vs `enhanced.segments`，应该统一为哪个？或者检测逻辑应该同时支持两者？
2. **运镜类型单一**：`camera-movement-system-v2.js` 的 `generateMovement` 默认 `movement = "smooth_track"`，对于健康科普场景是否应该增加多样性（如推近、横移、升降等）？
3. **generic 模式运镜组合**：`intra-shot-prompt-enhancer.js` 的 `CAMERA_COMBOS` 主要是为 Nirath 场景设计的（火山、森林、沼泽等），是否需要为 generic 模式（纪录片/医疗/教育）新增专用组合？
4. **质量评分计算**：当前 `cameraVariety` 最高 15 分，但即使修复段数检测，如果所有镜头都是同一种运镜， diversity 仍然不足。是否需要增加「运镜类型多样性」维度（不同镜头使用不同运镜）？
5. **PromptForge 后主进程优化**：PromptForge 后质量分 75，但原始 per-shot 质量分 34-38。这个差距是否正常？主进程优化是否覆盖了原始缺陷？

---

## 八、附件清单

- 本文件：`nirath-v6.5.32-camera-diversity-analysis.md`
- 参考文件：`/root/.openclaw/media/inbound/nirath-v6.5.31-fix-guide.md`（外部专家上次的修复方案）
- 输出文件：`/root/.openclaw/workspace/output/rhabdomyolysis-ep01-preproduction.json`

---

> **备注**：本次分析基于 v6.5.32-fix4 版本的实际运行日志和输出文件。所有代码片段均来自当前工作目录，非历史版本。
