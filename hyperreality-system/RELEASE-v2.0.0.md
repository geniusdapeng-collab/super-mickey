# 香香彩虹桥 v2.0.0-LLM-Agent 发布说明

**版本**: v2.0.0-LLM-Agent  
**日期**: 2026-06-19  
**基于**: v1.2.8  
**Git Commit**: e017b4c

---

## 🎯 升级概述

将制作引擎（ProductionEngine）从**纯规则驱动**升级为**LLM-Agent 驱动**，根本性解决"Prompt 质量上不去"的瓶颈。

| 维度 | v1.x | v2.0 |
|------|------|------|
| 镜头设计 | 固定7种类型映射 | LLM全局视角动态设计 |
| 运镜时间轴 | 固定4段等分 | LLM按叙事节奏动态切分(2-6段) |
| Prompt工程 | 文本块机械拼接 | LLM创造性融合成导演分镜脚本 |
| 灯光设计 | 6种场景映射 | LLM按时间/天气/情绪设计完整方案 |
| 连续性 | 规则检查角色共享 | LLM审查6维度连续性(新增环节) |
| 容错 | 无降级 | 3次重试+自动降级回规则 |

---

## 📁 新增文件

| 文件 | 说明 |
|------|------|
| `agents/base-agent.js` | Agent基类（封装LLM调用/重试/降级） |
| `agents/scene-design-agent.js` | 场景/情绪/动作设计 |
| `agents/visual-language-agent.js` | 运镜+灯光+时间轴设计 |
| `agents/audio-design-agent.js` | 环境音效设计 |
| `agents/prompt-fusion-agent.js` | **Prompt创造性融合（核心）** |
| `agents/opening-design-agent.js` | 片头S00设计 |
| `agents/continuity-review-agent.js` | 连续性审查（新增环节） |

---

## 🔄 改造文件

| 文件 | 改动 |
|------|------|
| `production-engine.js` | 集成7个Agent，8 Stage流程，llmStats输出 |
| `index.js` | 版本号 v1.2.5 → v2.0.0 |

---

## 🏗️ 架构

### 8 Stage 流程（原7 Stage + 新增连续性审查）

```
produce(adaptedBlueprint)
  │
  ├─ Stage 1: 场景提取（规则）
  ├─ Stage 2: 时长分配（规则）
  ├─ Stage 3: SceneDesignAgent（LLM）
  ├─ Stage 4: VisualLanguageAgent（LLM）
  ├─ Stage 5: AudioDesignAgent（LLM）→ PromptFusionAgent（LLM）
  ├─ Stage 6: 质量门校验（规则）
  ├─ Stage 7: OpeningDesignAgent（LLM）
  └─ Stage 8: ContinuityReviewAgent（LLM）
```

---

## ⚙️ 配置

```javascript
const engine = new ProductionEngine({
  enableLLMAgents: true,  // 是否启用LLM Agent（false则完全回退v1.x）
  llmTimeout: 300000,     // 单次LLM调用超时（ms）
  llmMaxRetries: 3,       // LLM调用重试次数
  llmModel: 'kimi-k2p6'   // 模型名
});
```

---

## 🛡️ 降级机制

每个Agent内置3层容错：
- LLM调用失败 → 重试（最多3次）
- 仍失败 → 自动降级回原规则方法
- 规则也失败 → 抛错（被produce的try/catch兜底）

原规则方法**全部保留**作为fallback。

---

## 📊 LLM统计

produce返回值新增 `llmStats` 字段：

```javascript
result.llmStats = {
  sceneDesign: { degraded, degradeReason },
  visualLanguage: { degraded, degradeReason },
  audioDesign: { degraded, degradeReason },
  promptFusion: { degraded, degradeReason },
  openingDesign: { degraded, degradeReason },
  continuityReview: { degraded, degradeReason }
}
```

---

## 🔙 回滚方案

```javascript
// 方式1: 构造时关闭LLM
const engine = new ProductionEngine({ enableLLMAgents: false });

// 方式2: 恢复原production-engine.js文件
```

---

## ✅ 质量提升对照

### 运镜设计
- **升级前**: 固定4段等分 `[远景缓推, 中景推进, 近景聚焦, 特写定格]`
- **升级后**: LLM根据台词密度动态切分，台词密集处短切+手持

### Prompt工程
- **升级前**: `16:9 cinematic..., hyperrealistic..., 场景, 角色, 动作...`（机械拼接）
- **升级后**: `中景，陈卓站在健身区，阳光从侧面打在她脸上形成伦勃朗光...`（导演分镜脚本）

### 灯光设计
- **升级前**: `key light 3200K, golden hour rim`（关键词堆砌）
- **升级后**: `清晨6点，医院走廊，冷白色荧光灯从天花板均匀洒下...`（场景化描述）

---

*如遇问题，查看控制台 `[AgentName]` 前缀日志。*
