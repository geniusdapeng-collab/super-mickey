# 超现实系统 LLM 驱动升级需求梳理
**版本**: v1.2.8  
**梳理时间**: 2026-06-19  
**梳理人**: 小G

---

## 一、当前系统架构总览

```
Layer 0: 需求解析 (RequirementListBuilder)
  └─ IntentParser → RuleBased → LLMDeep
  └─ 输出: RequirementList (JSON)

Layer 1: 剧本引擎 (ScriptEngine)
  └─ ScriptGenerator (LLM驱动 ✅)
  └─ ScriptValidator (规则 ✅)
  └─ Adapter (规则 ✅)
  └─ 输出: ScriptBlueprint (JSON)

Layer 2: 制作引擎 (ProductionEngine)
  └─ Scene Extraction (规则 ❌)
  └─ Duration Allocation (规则 ❌)
  └─ Camera Design (纯规则 ❌ 最严重)
  └─ Prompt Engineering (纯规则 ❌ 最严重)
  └─ Quality Gate (规则 ✅)
  └─ Opening Generation (模板 ❌)
  └─ 输出: ProductionResult (Prompts数组)

Layer 3: 渲染引擎 (RenderingEngine)
  └─ 调用 Seedance API (外部服务)
  └─ 输出: 视频文件

Layer 4: 后期引擎 (PostProductionEngine)
  └─ 字幕生成 (模板 ❌)
  └─ 弹幕生成 (规则+模板 ❌)
  └─ 音乐匹配 (规则 ❌)
  └─ HTML导出 (模板 ✅)
  └─ 输出: 后期素材包
```

---

## 二、需要LLM驱动的环节（按优先级排序）

### 🔴 P0: 制作引擎 - Camera Design（镜头设计）

**当前状态**: 纯规则驱动，无LLM
**代码位置**: `engines/production-engine/production-engine.js::_designCameraMovement()`

**现有规则逻辑**:
```javascript
// 1. 基于 sceneType 推断 cameraConfig
_inferCameraConfig(shot) {
  const typeMap = {
    'opening': { size: 'wide', movement: '缓慢推进', angle: '平视' },
    'establishing': { size: 'wide', movement: '稳定机位', angle: '平视' },
    'conflict': { size: 'close_up', movement: '手持晃动', angle: '俯视' },
    ...
  };
  return typeMap[shot.sceneType] || typeMap['dialogue'];
}

// 2. 固定4段式时间轴（每段等长）
_generateCameraTimeline(duration) {
  segments = 4;
  segmentDuration = duration / 4;
  // 固定: [远景缓推, 中景推进, 近景聚焦, 特写定格]
}

// 3. 从固定映射表取运镜词
_buildCameraString() {
  shotSizeMap = { wide: 'wide', medium: 'medium', close_up: 'close-up' };
  movementMap = { '缓慢推进': 'dolly in', '稳定机位': 'static' };
}
```

**问题**:
- 所有镜头都是固定4段式，不会根据情绪变化
- 场景类型到运镜的映射是硬编码的（只有7种类型）
- 时间轴每段等分，没有节奏变化
- 不会根据台词内容调整镜头语言

**期望效果**:
- LLM 根据场景情绪、角色动作、台词内容，设计动态运镜
- 时间轴不再是固定4段，而是根据叙事节奏动态切分
- 输出类似: `0-2s: 稳定全景建立环境 → 2-5s: 缓慢推近到陈卓面部 → 5-8s: 手持晃动强调紧张 → 8-10s: 特写定格核心台词`
- 支持情绪曲线：紧张时快切+ handheld，平静时长镜头+ static

---

### 🔴 P0: 制作引擎 - Prompt Engineering（提示词工程）

**当前状态**: 纯模板拼接，无LLM
**代码位置**: `engines/production-engine/production-engine.js::_buildShotPrompt()`

**现有规则逻辑**:
```javascript
// 按固定优先级顺序拼接文本块（L1-L9）
parts.push(`${ratio} cinematic, no text...`);  // L1: 约束
parts.push('hyperrealistic, ultra-detailed...'); // L2: 基础
parts.push(shot.scene);                          // L3: 场景
parts.push(shot.character);                      // L4: 角色
parts.push(shot.action);                         // L4: 动作
parts.push(`dialogue: ${shot.dialogue}`);        // L4: 台词
parts.push(cameraStr);                           // L5: 运镜
// ...截断到1500字符
```

**问题**:
- 只是机械拼接文本块，没有"创造性融合"
- 各层之间是简单逗号连接，没有叙事连贯性
- lighting、mood 等只是关键词堆砌，没有场景化描述
- 不会根据剧本情绪调整视觉语言风格

**期望效果**:
- LLM 将 scene + character + action + dialogue + camera + lighting 融合成一段流畅的视觉叙事描述
- 输出类似电影导演的分镜脚本："中景，陈卓站在健身区，阳光从侧面打在她脸上（伦勃朗光），她边走边指向跑步机，语气警示但不严厉，镜头缓慢跟随她的步伐..."
- 根据情绪动态调整：紧张场景用短句+强烈动词，平静场景用长句+柔和形容词

---

### 🟡 P1: 需求解析 - IntentParser（意图解析）

**当前状态**: 规则为主，LLM为辅
**代码位置**: `engines/script-engine/core/intent-parser.js`

**现有规则逻辑**:
```javascript
// 1. 关键词匹配分类
if (input.includes('科普') || input.includes('教育')) type = 'EDU';
if (input.includes('广告')) type = 'ADS';
// ...只有7种类型

// 2. 正则提取时长
const durationMatch = input.match(/(\d+)\s*(秒|s)/);

// 3. 规则库推断风格
if (type === 'EDU') style = 'REAL';
```

**问题**:
- 分类只有7种固定类型，无法处理创新需求
- 风格推断是硬编码映射（EDU→REAL）
- 无法识别复杂意图（如"既要专业感又要轻松活泼"）
- 创意指数解析是简单数值映射

**期望效果**:
- LLM 深度解析用户意图，提取隐含需求
- 支持开放式分类（不只7种）
- 理解复合风格需求（"好莱坞质感+科普专业度+亲和力"）
- 自动补全缺失字段（用户没说时长，根据类型推断）

---

### 🟡 P1: 制作引擎 - Lighting Design（灯光设计）

**当前状态**: 规则映射
**代码位置**: `engines/production-engine/production-engine.js::_buildLighting()`

**现有规则逻辑**:
```javascript
const lightingMap = {
  'opening': { key: 'golden hour sunlight', fill: 'natural bounce' },
  'conflict': { key: 'high contrast', fill: 'deep shadows' },
  'dialogue': { key: 'soft key light', fill: 'gentle fill' }
};
```

**问题**:
- 只有6种场景类型的灯光映射
- 不会根据一天中的时间、天气、情绪调整
- 输出只是关键词列表，没有场景化描述

**期望效果**:
- LLM 根据场景时间（清晨/正午/黄昏/夜晚）、天气、情绪设计完整灯光方案
- 输出类似: "清晨6点，医院走廊，冷白色荧光灯从天花板均匀洒下，陈卓的脸部有柔和的顶光，阴影在下巴下方形成轻微的暗部..."

---

### 🟡 P1: 后期引擎 - 字幕/弹幕生成

**当前状态**: 模板+规则
**代码位置**: `engines/post-production-engine/post-production-engine.js`

**现有规则逻辑**:
```javascript
generateIdentitySubtitles() {
  // 硬编码字幕样式
  return [{ text: character.name, style: 'default' }];
}

generateDanmaku() {
  // 从固定弹幕库随机取
  const comments = ['太棒了', '学到了', '666'];
}
```

**问题**:
- 字幕样式单一
- 弹幕内容与视频内容无关（固定库）
- 不会根据台词情绪生成动态字幕效果

**期望效果**:
- LLM 根据台词内容和情绪生成风格化字幕（紧张时红色+抖动，平静时白色+淡入）
- 弹幕内容与场景主题相关（科普视频弹幕是"原来如此""记住了"）

---

### 🟢 P2: 后期引擎 - 音乐匹配

**当前状态**: 规则映射
**代码位置**: `engines/post-production-engine/post-production-engine.js::matchMusicTracks()`

**现有规则逻辑**:
```javascript
const SCENE_MUSIC_MAP = {
  'opening': { genre: 'orchestral', mood: 'epic' },
  'dialogue': { genre: 'ambient', mood: 'calm' }
};
```

**期望效果**:
- LLM 分析整个视频的情绪曲线，推荐音乐节奏变化
- 支持根据台词关键词匹配音乐风格

---

## 三、当前已经是LLM驱动的环节（保持）

| 环节 | 状态 | 说明 |
|------|------|------|
| 剧本生成 (ScriptGenerator) | ✅ LLM | kimi-k2p6，~99秒，产出 scenes/dialogue/characters |
| 角色覆盖 (ScriptGenerator) | ✅ LLM后处理 | 正则替换角色名 |
| 校验 (ScriptValidator) | ✅ 规则 | 纯规则校验，无需LLM |

---

## 四、总结

**需要LLM升级的关键环节**：
1. **Camera Design** (P0) - 运镜设计太机械
2. **Prompt Engineering** (P0) - 提示词只是拼接，没有创造性融合
3. **Intent Parser** (P1) - 意图解析不够智能
4. **Lighting Design** (P1) - 灯光只是关键词堆砌
5. **字幕/弹幕** (P1) - 与内容无关
6. **音乐匹配** (P2) - 情绪曲线分析

**核心问题**：
Layer 2（制作引擎）整个是规则驱动，没有LLM参与。这是Prompt质量上不去的根本原因。
