# 视频生成大系统总览

**系统名称**: Seedance视频生成统一平台（SuperMickey 生产执行子系统）
**子系统内部编号**: v6.2-patch100-fix（占位符清理+Prompt截断+全局上下文注入+场景运镜+情绪一致性+双通道分离）

> ⚠️ 版本权威声明：上文 v6.x 为本子系统的历史内部编号，**不是 SuperMickey 系统版本号**。
> SuperMickey 系统版本号唯一权威来源为根目录 `package.json` 的 `"version"` 字段。
> 禁止以本文档的版本字样作为"最新版本"判断依据。

**统一平台**：一套基础设施，同时支持通用视频系列 + 山海经系列，仅在Prompt风格/世界观/角色层做差异化。

---

## 活跃模块清单（精简版）

### 通用基础设施层

| 模块 | 文件 | 功能 |
|------|------|------|
| 渲染引擎 | `render-direct-api.js` | Seedance 2.0 API调用 |
| 角色管理v2 | `character-manager-v2.js` | 7维分析+合规审查+Prompt构建 |
| 运镜控制 | `camera-movement-system.js` | 六大基础运镜+景别+速度+情绪映射 |
| Prompt构建器 | `prompt-builder.js` | 镜头Prompt智能构建 |
| 合规检查器 | `compliance-checker.js` | L1/L2/L3三级审查 |
| 后期合成 | `post-production-pipeline.js` | 字幕烧录+合并+交付 |
| 生产引擎 | `production-engine.js` | 批量渲染任务调度 |
| 定妆照硬拦截 | `portrait-guard.js` | 双系列通用定妆照强制提交闸机 |
| 定妆照工作室 | `hyperreality-system/engines/portrait-studio/` | 定妆照生成环节：角色分级多角度定妆+商品搜图分支链路+定妆照集交付 |

### 山海经专属业务层

| 模块 | 文件 | 功能 |
|------|------|------|
| Nirath主管线 | `hyperreality-system/index.js` | 17 Stage全链路（含占位符清理+全局上下文） |
| 场景增强核心 | `orient-primordial-core-v24.js` | Prompt构建+场景运镜+情绪映射+双通道分离 |
| 镜头内增强 | `intra-shot-prompt-enhancer.js` | 场景差异化运镜组合（epic/intimate/horror/suspense） |
| 山海经导演 | `shanhai-director.js` | 世界观/FPV/节奏/场景集成 |
| FPV经验总库 | `fpv-experience-library.js` | 15标杆案例+检索 |
| 世界观一致性 | `worldview-consistency-engine.js` | 禁用词审查+文化基因注入 |
| 战报复盘官 | `skills/battle-report-archivist/` | 自动生成问题解决复盘文档 |

### 关键系统常量

```javascript
// Prompt 长度标准唯一权威源: hyperreality-system/config/prompt-length.js
// (TARGET 2470-3000 / HARD_MAX 3000, 禁止在本文档登记长度字面数值)
MAX_DURATION = 15              // 最大时长（秒）
DEFAULT_RATIO = '16:9'         // 默认横屏
MAX_CONCURRENT = 3             // 最大并发
MANDATORY_ONE_SHOT = true      // 每个片子必须≥1个一镜到底
```

---

## 快速入口

```javascript
// 通用视频
const { renderEpisode } = require('./systems/render-direct-api.js');

// 山海经系列
const { Director } = require('./shanhaijing-director/director.js');
const director = new Director();
const plan = await director.generateEpisodePlan(episodeConfig);
```

---

> 详细版本历史、预生产流程、开发原则 → 详见 `memory/` 日期文件或 `AGENTS.md` / `SOUL.md`
