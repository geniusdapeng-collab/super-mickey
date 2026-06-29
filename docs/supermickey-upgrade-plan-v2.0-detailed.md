# SuperMickey v2.0 融合升级详细方案

> 状态：分析完成，待执行
> 日期：2026-06-28
> 分析范围：SuperMickey + 暴风战斧 + 超短裙 + 卓越系统（全部源码已读）

---

## 一、SuperMickey 当前架构全景

```
Layer 0: RequirementListBuilder → 需求清单生成确认（人工确认点①）
  ↓
Layer 1: ScriptEngine → 剧本引擎（生成 structured blueprint）
  ↓
Adapter: 适配层（blueprint → adapted shots）
  ↓
Layer 2: ProductionEngine → 制作引擎（25字段 + 导演技能注入）
  ├── FieldGuard（字段标准化与校验）
  ├── Hollywood Director Skills（技能路由注入）
  └── 提示词审核（人工确认点②）
  ↓
Layer 3: RenderingEngine → 渲染引擎（Seedance API）
  ↓
Layer 4: PostProductionEngine → 后期引擎（字幕/音乐/弹幕/多版本）
```

**核心数据流格式：**
- Layer 0 输出：`requirementList`（含 videoType, style, characters, targetDuration）
- Layer 1 输出：`scriptResult`（含 blueprint, adapted scenes, validation report）
- Adapter 输出：`adapted`（shots 数组，含 25 字段）
- Layer 2 输出：`productionResult`（含 shots, prompts, quality gate）
- Layer 3 输出：`renderResult`（含 submitted, failed, results）
- Layer 4 输出：`postResult`（含 versions, subtitles, music, danmaku）

---

## 二、四系统能力矩阵（已逐一源码确认）

### 2.1 SuperMickey 独有（保留并放大）

| 模块 | 位置 | 核心能力 | 状态 |
|------|------|----------|------|
| 四层解耦架构 | `index.js` | Layer0→Layer1→Adapter→Layer2→Layer3→Layer4 | ✅ 保留 |
| 创意指数引擎 | `creative-intensity-engine.js` | 0.0-1.0 强度解析，自动配置各层 | ✅ 保留 |
| 风格编码器 | `style-encoder.js` | 电影级质感编码 | ✅ 保留 |
| 需求清单确认 | `requirement-list-builder.js` | 人工确认点①，不可跳过 | ✅ 保留 |
| 基线热启动 | `baseline-template-registry.js` | 命中模板则走热启动 | ✅ 保留 |
| 稳定性护盾 | `stability-shield.js` | 三层护盾（基线/LLM网关/健康监控） | ✅ 保留 |
| FieldGuard 25字段 | `field-guard.js` | 强制标准化 25 字段 | ✅ 保留 |
| 好莱坞技能注入 | `cinematography-skill-router.js` | 按镜头类型路由导演技能 | ✅ 保留 |
| 片头优化器 | `opening-title-optimizer.js` | 片头黄金3秒专属优化 | ✅ 保留 |

### 2.2 暴风战斧（10项待融入）

| 模块 | 源码位置 | 核心能力 | 融入点 | 优先级 |
|------|----------|----------|--------|--------|
| MicroMotion 微动作 | `micromotion-adapter.js` | 角色微表情/动作增强 | Layer 2 后、FieldGuard 前 | P2 |
| 多方案比稿 | `requirement-alignment-gate.js` | 生成3套方案评分比稿 | Layer 0 后 | P2 |
| 导演优化 Agent | `director-optimize-agent.js` | 四维评估（故事/连贯/视觉/风格） | Layer 2 后 | P2 |
| 叙事节奏引擎 | `narrative-rhythm-engine.js` | 三幕式/情绪曲线/节拍设计 | Layer 1→Adapter 之间 | P2 |
| 全局文字禁止 | `global-text-ban.js` | 禁止生成文字/水印 | Layer 3 渲染参数 | P3 |
| 需求对齐闸机 | `requirement-alignment-gate.js` | 需求-剧本对齐度评分 | Layer 1 后 | P2 |
| 镜头质量增强 | `shot-quality-enhancer.js` | 视觉冲击力评分+增强 | Layer 2 后 | P2 |
| 台词一致性 | `dialogue-consistency-engine.js` | 跨镜头台词连贯性检查 | Layer 2 后 | P3 |
| 商业广告模式 | `commercial-mode-enhancer.js` | 产品卖点/行动号召/品牌露出 | Layer 2 后（可选模式） | P4 |
| Nirath 世界观 | `nirath-extension.js` | 异世界设定（双恒星/荧光/低重力） | Layer 1 剧本生成 | P3 |

### 2.3 超短裙（6项待融入）

| 模块 | 源码位置 | 核心能力 | 融入点 | 优先级 |
|------|----------|----------|--------|--------|
| Saga Orchestrator | `saga-orchestrator.js` | 阶段编排/补偿/重试/降级 | 全局 Pipeline 编排 | P1（骨架已搭） |
| EventBus | `event-bus.js` | 全链路事件追踪与回放 | 全局事件总线 | P1（骨架已搭） |
| PromptForge | `promptforge-lite.js` | LLM 压缩生成优化 Prompt | Layer 2 后 | P2 |
| 垂直内容库 | `fpv-cinematic-prompt-library-full.md` | FPV/极限运动预设 Prompt | Layer 2 后（可选模式） | P4 |
| 商业广告链路 | `commercial-saga-chain.js` | 9 Stage 商业广告专用链路 | Layer 2 后（可选模式） | P4 |
| 社媒情绪钩子 | `social-emotion-hooks.js` | 前3秒情绪钩设计 | Layer 1 剧本结构 | P3 |

### 2.4 卓越系统（10项待融入）

| 模块 | 源码位置 | 核心能力 | 融入点 | 优先级 |
|------|----------|----------|--------|--------|
| Prompt Guardian | `prompt-guardian.js` | 敏感词/服装锁定/台词净化 | Layer 2 后、FieldGuard 前 | P1（骨架已搭） |
| Pipeline Guard | `render-pipeline-guard.js` | 11项强制检查，不通过阻塞 | Layer 3 渲染前 | P1（骨架已搭） |
| 双层检查修复 | `double-check-repair.js` | Guardian+Guard 双层防护 | Layer 2→Layer 3 之间 | P1 |
| 美术布景 Agent | `art-director-agent.js` | 场景美学设计/色彩方案 | Layer 2 场景设计阶段 | P2 |
| 开场白 Agent | `opening-agent.js` | 开场白台词设计 | Layer 1 剧本生成 | P2 |
| 镜头时长三维度 | `duration-allocator.js` | 叙事/情绪/技术三维分配 | Layer 1 剧本生成 | P2 |
| 全局明亮约束 | `bright-constraint.js` | 强制明亮/去灰/去暗 | Layer 2 Prompt 构建 | P2 |
| 角色形象库 | `character-image-lib.js` | 定妆照管理/引用/锚定 | Layer 2 角色描述 | P2 |
| 神兽声音强化 | `beast-voice-enhancer.js` | 神兽声音特征设计 | Layer 2 音频设计 | P3 |
| 导演审片 | `director-review.js` | 人工审片评分反馈 | Layer 4 后 | P3 |

---

## 三、详细实施计划（精确到函数级别）

### Phase 1: 基础设施层（P1 模块）

#### P1-1 Prompt Guardian（已创建骨架，需注入主链路）

**当前状态：** 文件已创建 `engines/prompt-guardian.js`，但 `HyperrealitySystem.create()` 中未调用

**注入点：** `index.js` 中 Layer 2 输出后、FieldGuard 前

```javascript
// index.js 中，在 Layer 2 制作完成后、FieldGuard 前插入：

// ========== P1-1: Prompt Guardian 自动修复 ==========
console.log('\n🔍 [PromptGuardian] 启动自动修复...');
try {
  const guardianResult = this.promptGuardian.guard(productionResult.prompts, {
    characters: metadata.characters || []
  });
  
  if (guardianResult.fixes.length > 0) {
    console.log(`   ✅ 自动修复 ${guardianResult.fixes.length} 处问题`);
    productionResult.prompts = guardianResult.prompts;
    result.stages.promptGuardian = {
      fixes: guardianResult.fixes,
      safe: guardianResult.safe
    };
  }
} catch (err) {
  console.warn(`   ⚠️ PromptGuardian 失败: ${err.message}`);
  result.errors.push({ stage: 'PromptGuardian', message: err.message });
}
```

**配置开关：**
```javascript
// HyperrealitySystem constructor 中已初始化：
this.promptGuardian = new PromptGuardian({
  strictMode: options.promptGuardian?.strictMode || false,  // false = 只修复不阻塞
  enabled: options.promptGuardian?.enabled !== false         // true = 默认启用
});
```

**验证清单：**
- [ ] 功能验证：输入含敏感词的 prompt，输出应被自动替换
- [ ] 集成验证：运行完整流程，PromptGuardian 应在 Layer 2 后执行
- [ ] 配置验证：`enabled: false` 时应跳过
- [ ] 日志验证：`output/prompt-guardian-log.json` 应记录修复日志

---

#### P1-2 Render Pipeline Guard（已创建骨架，需注入主链路）

**当前状态：** 文件已创建 `engines/render-pipeline-guard.js`，但 `HyperrealitySystem.create()` 中未调用

**注入点：** `index.js` 中 Layer 3 渲染前

```javascript
// index.js 中，在 Layer 3 渲染前插入：

// ========== P1-2: Render Pipeline Guard 强制检查 ==========
console.log('\n🛡️ [PipelineGuard] 启动渲染管线检查...');
try {
  const guardResult = this.pipelineGuard.check(productionResult.prompts, {
    strictMode: options.pipelineGuard?.strictMode !== false
  });
  
  if (!guardResult.pass) {
    console.error(`   ❌ 检查失败: ${guardResult.errors.length} 错误, ${guardResult.warnings.length} 警告`);
    result.stages.pipelineGuard = {
      pass: false,
      errors: guardResult.errors,
      warnings: guardResult.warnings
    };
    
    if (this.pipelineGuard.strictMode) {
      result.success = false;
      result.errors.push({ stage: 'PipelineGuard', message: '渲染管线检查未通过' });
      return result;
    }
  } else {
    console.log('   ✅ 检查通过');
    result.stages.pipelineGuard = { pass: true };
  }
} catch (err) {
  console.warn(`   ⚠️ PipelineGuard 失败: ${err.message}`);
  result.errors.push({ stage: 'PipelineGuard', message: err.message });
}
```

**配置开关：**
```javascript
// HyperrealitySystem constructor 中已初始化：
this.pipelineGuard = new RenderPipelineGuard({
  strictMode: options.pipelineGuard?.strictMode !== false,  // true = 默认严格
  enabled: options.pipelineGuard?.enabled !== false           // true = 默认启用
});
```

**验证清单：**
- [ ] 功能验证：输入缺少 `role: "reference_image"` 的 prompt，应报错
- [ ] 集成验证：运行完整流程，PipelineGuard 应在 Layer 3 前执行
- [ ] 配置验证：`strictMode: false` 时警告不阻塞
- [ ] 日志验证：`output/pipeline-guard-log.json` 应记录检查结果

---

#### P1-3 Saga Orchestrator（已创建骨架，需替换现有流程控制）

**当前状态：** 文件已创建 `infrastructure/saga-orchestrator.js`，但 `HyperrealitySystem.create()` 仍使用传统 try-catch 流程

**重构方案：** 将 `create()` 方法重构为 Saga 编排模式

```javascript
// index.js 中，create() 方法重构：

async create(intent, metadata = {}, options = {}) {
  // ... 初始化代码不变 ...
  
  // ===== P1-3: Saga 编排执行 =====
  const { SagaOrchestrator } = require('./infrastructure/saga-orchestrator');
  const saga = new SagaOrchestrator({
    eventBus: this.eventBus,  // 集成 EventBus
    strictMode: options.saga?.strictMode !== false
  });
  
  const handlers = {
    'STAGE-SM-0': async (ctx) => {
      // Layer 0: 需求清单
      if (options.skipRequirementList) return { skipped: true };
      const requirementList = await this.requirementListBuilder.build(intent, metadata);
      // ... 确认逻辑 ...
      ctx.requirementList = requirementList;
      return requirementList;
    },
    'STAGE-SM-1': async (ctx) => {
      // Layer 1: 剧本引擎
      const scriptResult = await this.scriptEngine.process(intent, metadata);
      ctx.scriptResult = scriptResult;
      return scriptResult;
    },
    'STAGE-SM-2': async (ctx) => {
      // Layer 2: 制作引擎
      const productionResult = await this.productionEngine.produce(ctx.scriptResult.adapted);
      
      // P1-1: Prompt Guardian
      const guardianResult = this.promptGuardian.guard(productionResult.prompts);
      productionResult.prompts = guardianResult.prompts;
      
      ctx.productionResult = productionResult;
      return productionResult;
    },
    'STAGE-SM-3': async (ctx) => {
      // Layer 3: 渲染引擎
      // P1-2: Pipeline Guard
      const guardResult = this.pipelineGuard.check(ctx.productionResult.prompts);
      if (!guardResult.pass && this.pipelineGuard.strictMode) {
        throw new Error('Pipeline Guard 检查未通过');
      }
      
      const renderResult = await this.renderingEngine.render(ctx.productionResult.prompts);
      ctx.renderResult = renderResult;
      return renderResult;
    },
    'STAGE-SM-4': async (ctx) => {
      // Layer 4: 后期引擎
      const postResult = await this.postProductionEngine.postProduce(
        ctx.productionResult, ctx.scriptResult, ctx.renderResult
      );
      return postResult;
    }
  };
  
  const sagaResult = await saga.execute(handlers, { intent, metadata });
  
  // 组装最终结果
  return this._assembleResult(sagaResult, result);
}
```

**验证清单：**
- [ ] 功能验证：Saga 应正确编排 5 个 Stage
- [ ] 容错验证：Stage 失败时应触发补偿事务
- [ ] 集成验证：EventBus 应记录所有 Stage 事件
- [ ] 配置验证：`strictMode: false` 时非阻塞 Stage 失败不终止流程

---

#### P1-4 EventBus（已创建骨架，需接入各层）

**当前状态：** 文件已创建 `infrastructure/event-bus.js`，但 `HyperrealitySystem.create()` 中未使用

**接入方案：** 在各 Layer 关键节点 emit 事件

```javascript
// index.js 中，在各 Layer 完成后 emit 事件：

// Layer 0 完成后
this.eventBus.emit('layer.completed', {
  layerId: 'layer-0',
  layerName: 'RequirementList',
  timing: result.stages.requirementList.timing
});

// Layer 1 完成后
this.eventBus.emit('layer.completed', {
  layerId: 'layer-1',
  layerName: 'ScriptEngine',
  timing: result.stages.scriptEngine.timing
});

// 数据变更时
this.eventBus.mutate('layer-2', 'prompts', oldPrompts, productionResult.prompts);
```

**验证清单：**
- [ ] 功能验证：EventBus 应记录所有 layer 事件
- [ ] 集成验证：Saga Orchestrator 应通过 EventBus 通信
- [ ] 回放验证：应能回放事件到任意时间点
- [ ] 报告验证：`generateReport()` 应输出正确统计

---

#### P1-5 Pipeline Logger（已创建骨架，需接入主链路）

**当前状态：** 文件已创建 `engines/pipeline-logger.js`，但 `HyperrealitySystem.create()` 中未调用

**接入点：** `create()` 方法返回前

```javascript
// index.js 中，在返回 result 前插入：

// ========== P1-5: Pipeline Logger 留档 ==========
try {
  const sessionDir = await this.pipelineLogger.save(result, {
    title: metadata.title || 'untitled',
    version: this.version,
    intent
  });
  console.log(`\n💾 [PipelineLogger] 结果已保存: ${sessionDir}`);
} catch (err) {
  console.warn(`   ⚠️ PipelineLogger 失败: ${err.message}`);
}
```

**验证清单：**
- [ ] 功能验证：应生成独立目录，含 result.json + report.md + prompts.md
- [ ] 集成验证：每次调用 create() 应生成新目录
- [ ] 配置验证：`enabled: false` 时应跳过
- [ ] 报告验证：report.md 应包含执行摘要和各阶段耗时

---

### Phase 2: 增强引擎层（P2 模块）

#### P2-1 MicroMotion 微动作系统

**来源：** 暴风战斧 `micromotion-adapter.js`

**融入点：** Layer 2 后、Prompt Guardian 前

**实现方案：**
1. 复制 `micromotion-adapter.js` 到 `engines/enhancers/micromotion-adapter.js`
2. 适配输入格式：SuperMickey 的 `productionResult.prompts` → MicroMotion 输入格式
3. 在主链路中插入：

```javascript
// index.js 中，Layer 2 后插入：

// ========== P2-1: MicroMotion 微动作增强 ==========
if (options.microMotion?.enabled !== false) {
  console.log('\n🎭 [MicroMotion] 微动作增强...');
  try {
    const { MicroMotionAdapter } = require('./engines/enhancers/micromotion-adapter');
    const mmAdapter = new MicroMotionAdapter();
    
    const enhanced = await mmAdapter.enhance(productionResult.prompts, {
      characters: metadata.characters,
      style: requirementList.style
    });
    
    productionResult.prompts = enhanced.prompts;
    result.stages.microMotion = {
      enhancedShots: enhanced.enhancedCount,
      details: enhanced.details
    };
    console.log(`   ✅ 微动作增强完成: ${enhanced.enhancedCount} 个镜头`);
  } catch (err) {
    console.warn(`   ⚠️ MicroMotion 失败: ${err.message}`);
    result.errors.push({ stage: 'MicroMotion', message: err.message });
  }
}
```

**配置开关：**
```javascript
// HyperrealitySystem constructor 中：
this.microMotion = {
  enabled: options.microMotion?.enabled !== false,
  intensity: options.microMotion?.intensity || 0.5  // 增强强度
};
```

---

#### P2-2 叙事节奏引擎

**来源：** 暴风战斧 `narrative-rhythm-engine.js`

**融入点：** Layer 1 后、Adapter 前

**实现方案：**
1. 复制 `narrative-rhythm-engine.js` 到 `engines/enhancers/narrative-rhythm-engine.js`
2. 在 `ScriptEngine` 输出后、适配前插入：

```javascript
// index.js 中，Layer 1 后插入：

// ========== P2-2: 叙事节奏引擎 ==========
if (options.narrativeRhythm?.enabled !== false) {
  console.log('\n🎵 [NarrativeRhythm] 叙事节奏设计...');
  try {
    const { NarrativeRhythmEngine } = require('./engines/enhancers/narrative-rhythm-engine');
    const rhythm = new NarrativeRhythmEngine();
    
    const rhythmPlan = rhythm.design(scriptResult.blueprint, {
      curve: options.narrativeRhythm?.curve || 'build',  // build/release/wave/collapse
      duration: requirementList.targetDuration
    });
    
    // 将节奏计划注入到 adapted shots
    for (const shot of adapted.shots) {
      const shotRhythm = rhythmPlan.getRhythmForShot(shot.shotId);
      if (shotRhythm) {
        shot._rhythm = shotRhythm;
        shot.emotionStart = shotRhythm.emotionStart;
        shot.emotionEnd = shotRhythm.emotionEnd;
        shot.tension = shotRhythm.tension;
      }
    }
    
    result.stages.narrativeRhythm = {
      curve: rhythmPlan.curve,
      beats: rhythmPlan.beats.length
    };
    console.log(`   ✅ 叙事节奏设计完成: ${rhythmPlan.beats.length} 个节拍`);
  } catch (err) {
    console.warn(`   ⚠️ 叙事节奏引擎失败: ${err.message}`);
    result.errors.push({ stage: 'NarrativeRhythm', message: err.message });
  }
}
```

**配置开关：**
```javascript
// HyperrealitySystem constructor 中：
this.narrativeRhythm = {
  enabled: options.narrativeRhythm?.enabled !== false,
  curve: options.narrativeRhythm?.curve || 'build'  // build/release/wave/collapse
};
```

---

#### P2-3 Shot Quality Enhancer

**来源：** 暴风战斧 `shot-quality-enhancer.js`

**融入点：** Layer 2 后、MicroMotion 前

**实现方案：**
1. 复制 `shot-quality-enhancer.js` 到 `engines/enhancers/shot-quality-enhancer.js`
2. 在 ProductionEngine 输出后插入：

```javascript
// index.js 中，Layer 2 后插入：

// ========== P2-3: 镜头质量增强 ==========
if (options.qualityEnhancer?.enabled !== false) {
  console.log('\n✨ [QualityEnhancer] 镜头质量增强...');
  try {
    const { ShotQualityEnhancer } = require('./engines/enhancers/shot-quality-enhancer');
    const enhancer = new ShotQualityEnhancer();
    
    const enhanced = await enhancer.enhance(productionResult.prompts, {
      targetScore: options.qualityEnhancer?.targetScore || 85,
      maxIterations: options.qualityEnhancer?.maxIterations || 2
    });
    
    productionResult.prompts = enhanced.prompts;
    result.stages.qualityEnhancer = {
      enhancedCount: enhanced.enhancedCount,
      avgScoreBefore: enhanced.avgScoreBefore,
      avgScoreAfter: enhanced.avgScoreAfter
    };
    console.log(`   ✅ 质量增强完成: ${enhanced.avgScoreBefore} → ${enhanced.avgScoreAfter}`);
  } catch (err) {
    console.warn(`   ⚠️ 质量增强失败: ${err.message}`);
    result.errors.push({ stage: 'QualityEnhancer', message: err.message });
  }
}
```

---

#### P2-4 需求对齐闸机

**来源：** 暴风战斧 `requirement-alignment-gate.js`

**融入点：** Layer 1 后、Layer 2 前

**实现方案：**
1. 复制 `requirement-alignment-gate.js` 到 `engines/enhancers/requirement-alignment-gate.js`
2. 在 ScriptEngine 输出后插入：

```javascript
// index.js 中，Layer 1 后插入：

// ========== P2-4: 需求对齐闸机 ==========
if (options.alignmentGate?.enabled !== false) {
  console.log('\n🎯 [AlignmentGate] 需求-剧本对齐检查...');
  try {
    const { RequirementAlignmentGate } = require('./engines/enhancers/requirement-alignment-gate');
    const gate = new RequirementAlignmentGate();
    
    const alignment = gate.check({
      requirement: requirementList,
      script: scriptResult.blueprint
    });
    
    result.stages.alignmentGate = {
      score: alignment.score,
      passed: alignment.passed,
      issues: alignment.issues
    };
    
    if (!alignment.passed && options.alignmentGate?.strictMode) {
      console.error(`   ❌ 对齐检查未通过: ${alignment.score}/100`);
      result.success = false;
      return result;
    }
    
    console.log(`   ✅ 对齐检查通过: ${alignment.score}/100`);
  } catch (err) {
    console.warn(`   ⚠️ 对齐检查失败: ${err.message}`);
    result.errors.push({ stage: 'AlignmentGate', message: err.message });
  }
}
```

---

#### P2-5 导演优化 Agent

**来源：** 暴风战斧 `director-optimize-agent.js`

**融入点：** Layer 2 后、Prompt Guardian 前

**实现方案：**
1. 复制 `director-optimize-agent.js` 到 `engines/enhancers/director-optimize-agent.js`
2. 在 ProductionEngine 输出后插入：

```javascript
// index.js 中，Layer 2 后插入：

// ========== P2-5: 导演优化 Agent ==========
if (options.directorOptimize?.enabled !== false) {
  console.log('\n🎬 [DirectorOptimize] 导演优化审片...');
  try {
    const { DirectorOptimizeAgent } = require('./engines/enhancers/director-optimize-agent');
    const director = new DirectorOptimizeAgent({
      directorStyle: options.directorOptimize?.style || 'cameron'
    });
    
    const review = await director.review({
      storyPlan: scriptResult.blueprint,
      shots: productionResult.shots,
      prompts: productionResult.prompts
    });
    
    result.stages.directorOptimize = {
      score: review.overallScore,
      issues: review.issues,
      suggestions: review.suggestions
    };
    
    if (review.overallScore < 4.0 && options.directorOptimize?.strictMode) {
      console.error(`   ❌ 导演评分过低: ${review.overallScore}/5.0`);
      // 可选：自动修复或人工确认
    }
    
    console.log(`   ✅ 导演审片完成: ${review.overallScore}/5.0`);
  } catch (err) {
    console.warn(`   ⚠️ 导演优化失败: ${err.message}`);
    result.errors.push({ stage: 'DirectorOptimize', message: err.message });
  }
}
```

---

### Phase 3: 情绪价值全链路

#### P3-1 情绪意图解析器

**融入点：** Layer 0（需求清单生成时）

**实现方案：**
1. 新建 `engines/emotion/emotion-intent-parser.js`
2. 在 RequirementListBuilder 中集成：

```javascript
// requirement-list-builder.js 中，在解析意图时：

const { EmotionIntentParser } = require('../emotion/emotion-intent-parser');

class RequirementListBuilder {
  build(intent, metadata) {
    // ... 现有解析逻辑 ...
    
    // P3-1: 情绪意图解析
    const emotionParser = new EmotionIntentParser();
    const emotionProfile = emotionParser.parse(intent);
    
    requirementList.emotionProfile = emotionProfile;
    // emotionProfile: { primary: 'nostalgia', intensity: 0.7, triggers: ['rain', 'old_photo'] }
    
    return requirementList;
  }
}
```

---

#### P3-2 情绪弧线设计器

**融入点：** Layer 1（剧本生成时）

**实现方案：**
1. 新建 `engines/emotion/emotion-arc-designer.js`
2. 在 ScriptEngine 中集成：

```javascript
// script-engine/index.js 中，在生成剧本时：

const { EmotionArcDesigner } = require('../emotion/emotion-arc-designer');

class ScriptEngine {
  process(intent, metadata) {
    // ... 现有剧本生成逻辑 ...
    
    // P3-2: 情绪弧线设计
    if (metadata._creativeIntensity?.intensity > 0.3) {
      const arcDesigner = new EmotionArcDesigner();
      const emotionArc = arcDesigner.design({
        profile: metadata.requirementList?.emotionProfile,
        duration: metadata.targetDuration,
        scenes: blueprint.scenes
      });
      
      // 将情绪弧线注入到场景
      for (let i = 0; i < blueprint.scenes.length; i++) {
        blueprint.scenes[i].emotionTarget = emotionArc.getTargetForScene(i);
      }
    }
    
    return scriptResult;
  }
}
```

---

#### P3-3 情绪镜头语法注入

**融入点：** Layer 2（制作引擎）

**实现方案：**
1. 新建 `engines/emotion/emotion-shot-syntax.js`
2. 在 ProductionEngine 的 PromptBuilder 中集成：

```javascript
// production-engine/utils/prompt-builder.js 中：

const { EmotionShotSyntax } = require('../../emotion/emotion-shot-syntax');

class PromptBuilder {
  build(shot, options) {
    // ... 现有构建逻辑 ...
    
    // P3-3: 情绪镜头语法注入
    if (shot.emotionTarget) {
      const syntax = new EmotionShotSyntax();
      const emotionPrompt = syntax.generate(shot.emotionTarget, {
        camera: shot.camera,
        lighting: shot.lighting
      });
      
      prompt += `\n${emotionPrompt}`;
    }
    
    return prompt;
  }
}
```

---

#### P3-4 情绪密度注入器

**融入点：** Layer 2（制作引擎后）

**实现方案：**
1. 新建 `engines/emotion/emotion-density-injector.js`
2. 在 ProductionEngine 输出后插入：

```javascript
// index.js 中，Layer 2 后插入：

// ========== P3-4: 情绪密度注入 ==========
if (options.emotionDensity?.enabled !== false) {
  console.log('\n💫 [EmotionDensity] 情绪密度注入...');
  try {
    const { EmotionDensityInjector } = require('./engines/emotion/emotion-density-injector');
    const injector = new EmotionDensityInjector();
    
    const injected = injector.inject(productionResult.prompts, {
      arc: scriptResult.blueprint?.emotionArc,
      density: options.emotionDensity?.level || 'medium'  // low/medium/high
    });
    
    productionResult.prompts = injected.prompts;
    result.stages.emotionDensity = {
      injectedCount: injected.count,
      densityLevel: options.emotionDensity?.level || 'medium'
    };
    console.log(`   ✅ 情绪密度注入完成: ${injected.count} 个镜头`);
  } catch (err) {
    console.warn(`   ⚠️ 情绪密度注入失败: ${err.message}`);
    result.errors.push({ stage: 'EmotionDensity', message: err.message });
  }
}
```

---

#### P3-5 情绪色彩调色

**融入点：** Layer 2（Prompt 构建时）

**实现方案：**
1. 新建 `engines/emotion/emotion-color-grading.js`
2. 在 PromptBuilder 中集成：

```javascript
// prompt-builder.js 中：

const { EmotionColorGrading } = require('../../emotion/emotion-color-grading');

class PromptBuilder {
  build(shot, options) {
    // ... 现有构建逻辑 ...
    
    // P3-5: 情绪色彩调色
    if (shot.emotionTarget) {
      const colorGrading = new EmotionColorGrading();
      const colorScheme = colorGrading.getColorScheme(shot.emotionTarget);
      
      prompt += `\n色彩方案：${colorScheme.description}`;
    }
    
    return prompt;
  }
}
```

---

#### P3-6 情绪后期套件

**融入点：** Layer 4（后期引擎）

**实现方案：**
1. 新建 `engines/emotion/emotion-post-kit.js`
2. 在 PostProductionEngine 中集成：

```javascript
// post-production-engine.js 中：

const { EmotionPostKit } = require('../emotion/emotion-post-kit');

class PostProductionEngine {
  postProduce(productionResult, scriptResult, renderResult) {
    // ... 现有后期逻辑 ...
    
    // P3-6: 情绪后期套件
    const emotionPost = new EmotionPostKit();
    const emotionEdits = emotionPost.generate({
      arc: scriptResult.blueprint?.emotionArc,
      shots: productionResult.shots
    });
    
    postResult.emotionEdits = emotionEdits;
    // emotionEdits: { colorGrading, musicMood, subtitleStyle, pacing }
    
    return postResult;
  }
}
```

---

#### P3-7 情绪价值报告

**融入点：** 最终报告生成时

**实现方案：**
1. 新建 `engines/emotion/emotion-value-report.js`
2. 在最终报告生成时调用：

```javascript
// index.js 中，最终报告生成时：

// ========== P3-7: 情绪价值报告 ==========
try {
  const { EmotionValueReport } = require('./engines/emotion/emotion-value-report');
  const report = new EmotionValueReport();
  
  result.emotionReport = report.generate({
    intent,
    requirementList: result.stages.requirementList?.data,
    script: scriptResult,
    production: productionResult,
    stages: result.stages
  });
  
  console.log('\n📊 [EmotionReport] 情绪价值报告:');
  console.log(`   情绪强度: ${result.emotionReport.intensity}/1.0`);
  console.log(`   弧线类型: ${result.emotionReport.arcType}`);
  console.log(`   关键节点: ${result.emotionReport.keyMoments.length} 个`);
} catch (err) {
  console.warn(`   ⚠️ 情绪报告生成失败: ${err.message}`);
}
```

---

### Phase 4: 垂直场景层（可选模式）

#### P4-1 商业广告模式

**来源：** 暴风战斧 `commercial-mode-enhancer.js` + 超短裙 `commercial-saga-chain.js`

**融入点：** Layer 2 后（可选模式）

**实现方案：**
1. 复制 `commercial-mode-enhancer.js` 到 `engines/modes/commercial-mode-enhancer.js`
2. 通过配置开关启用：

```javascript
// HyperrealitySystem constructor 中：
this.commercialMode = {
  enabled: options.commercialMode?.enabled || false,
  productName: options.commercialMode?.productName,
  sellingPoints: options.commercialMode?.sellingPoints || [],
  targetAudience: options.commercialMode?.targetAudience,
  brandElements: options.commercialMode?.brandElements || {}
};

// index.js 中，Layer 2 后插入：

// ========== P4-1: 商业广告模式 ==========
if (this.commercialMode.enabled) {
  console.log('\n📢 [CommercialMode] 商业广告增强...');
  try {
    const { CommercialModeEnhancer } = require('./engines/modes/commercial-mode-enhancer');
    const enhancer = new CommercialModeEnhancer(this.commercialMode);
    
    const enhanced = enhancer.enhance(productionResult.prompts);
    productionResult.prompts = enhanced.prompts;
    
    result.stages.commercialMode = {
      productName: this.commercialMode.productName,
      sellingPoints: this.commercialMode.sellingPoints,
      enhancedCount: enhanced.count
    };
    console.log(`   ✅ 商业广告增强完成: ${enhanced.count} 个镜头`);
  } catch (err) {
    console.warn(`   ⚠️ 商业广告增强失败: ${err.message}`);
    result.errors.push({ stage: 'CommercialMode', message: err.message });
  }
}
```

---

#### P4-2 极限运动/FPV 模式

**来源：** 超短裙 `fpv-cinematic-prompt-library-full.md`

**融入点：** Layer 2 后（可选模式）

**实现方案：**
1. 复制 FPV 预设库到 `engines/modes/fpv-mode.js`
2. 通过配置开关启用：

```javascript
// HyperrealitySystem constructor 中：
this.fpvMode = {
  enabled: options.fpvMode?.enabled || false,
  subMode: options.fpvMode?.subMode || 'cinematic',  // cinematic/racing/freestyle
  droneType: options.fpvMode?.droneType || '5inch'
};
```

---

## 四、配置总览

```javascript
const system = new HyperrealitySystem({
  // ===== Phase 1: 基础设施（默认启用）=====
  promptGuardian: {
    enabled: true,
    strictMode: false  // false=只修复不阻塞
  },
  pipelineGuard: {
    enabled: true,
    strictMode: true   // true=不通过则阻塞
  },
  saga: {
    enabled: true,
    strictMode: true
  },
  eventBus: {
    enabled: true,
    maxEvents: 10000
  },
  pipelineLogger: {
    enabled: true,
    outputDir: './output',
    format: 'markdown'  // markdown/json/both
  },
  
  // ===== Phase 2: 增强引擎（默认启用）=====
  microMotion: {
    enabled: true,
    intensity: 0.5
  },
  narrativeRhythm: {
    enabled: true,
    curve: 'build'  // build/release/wave/collapse
  },
  qualityEnhancer: {
    enabled: true,
    targetScore: 85,
    maxIterations: 2
  },
  alignmentGate: {
    enabled: true,
    strictMode: false
  },
  directorOptimize: {
    enabled: true,
    style: 'cameron',  // cameron/nolan/wong
    strictMode: false
  },
  
  // ===== Phase 3: 情绪价值（默认启用）=====
  emotionDensity: {
    enabled: true,
    level: 'medium'  // low/medium/high
  },
  
  // ===== Phase 4: 垂直场景（默认关闭）=====
  commercialMode: {
    enabled: false,
    productName: '',
    sellingPoints: [],
    targetAudience: ''
  },
  fpvMode: {
    enabled: false,
    subMode: 'cinematic'
  }
});
```

---

## 五、验证策略

每个模块完成后，执行四级验证：

1. **功能验证**：单元测试，验证核心功能正确
2. **集成验证**：运行完整流程，验证模块在链路中正确执行
3. **配置验证**：测试 `enabled: false` 时模块被跳过
4. **日志验证**：检查日志文件正确记录

回滚策略：
- 通过 Git 保留历史
- 通过 `options.xxx.enabled` 开关随时关闭单个模块
- 所有新模块默认 `enabled: false`，确认稳定后再默认开启

---

## 六、执行优先级

| 优先级 | 模块 | 预计工作量 | 依赖 |
|--------|------|------------|------|
| P1-1 | Prompt Guardian 注入 | 2h | 无 |
| P1-2 | Pipeline Guard 注入 | 2h | 无 |
| P1-3 | Saga Orchestrator 替换 | 4h | P1-1, P1-2 |
| P1-4 | EventBus 接入 | 3h | P1-3 |
| P1-5 | Pipeline Logger 接入 | 2h | 无 |
| P2-1 | MicroMotion | 4h | P1-1 |
| P2-2 | 叙事节奏引擎 | 4h | 无 |
| P2-3 | Shot Quality Enhancer | 3h | 无 |
| P2-4 | 需求对齐闸机 | 3h | 无 |
| P2-5 | 导演优化 Agent | 4h | 无 |
| P3-1~7 | 情绪价值全链路 | 8h | P2-2 |
| P4-1 | 商业广告模式 | 3h | P2-3 |
| P4-2 | FPV 模式 | 2h | P2-3 |

**总计：约 44 小时**

---

## 七、已确认的系统边界

✅ **保留 SuperMickey 现有四层解耦架构不动**  
✅ **所有增强以独立模块 + 配置开关方式叠加**  
✅ **新模块默认关闭（`enabled: false`），按需启用**  
✅ **失败不阻塞主流程（`strictMode` 除外）**  
✅ **情绪价值不是单独模块，而是贯穿全链路**  
✅ **商业广告、极限运动等垂直场景作为可选模式，不污染通用链路**
