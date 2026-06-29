# SuperMickey（超级小香宝）(限时内测版)

> **AI 驱动的电影级视频生成系统** — 从一句话到完整成片，全流程自动化

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/python-%3E%3D3.9-blue.svg)](https://python.org/)

---

## 🎯 一句话描述

SuperMickey 是一个**端到端 AI 视频创作平台**，通过分层架构将 LLM 智能注入剧本、制作、渲染、后期全流程，实现从自然语言意图到专业级视频的自动化生产。

## 🚀 核心能力

| 能力 | 描述 | 技术亮点 |
|------|------|----------|
| **智能剧本引擎** | 从一句话意图生成结构化剧本（场景、镜头、对话） | 三层叙事结构 + 情绪弧线设计 |
| **电影级制作引擎** | 自动设计运镜、构图、光影、角色动作 | 导演优化 Agent + 微动作增强 |
| **多平台渲染** | 一键生成适配 Seedance 等平台的渲染 Prompt | 智能 Prompt 工程 + 字段标准化 |
| **后期自动处理** | 字幕、音乐、弹幕、多版本自动生成 | 情绪匹配 + 平台合规 |
| **影视技能库** | 集成 PandaCineForge 专业影视知识引擎 | 7 个融合点覆盖全流程 |

## 💰 商业价值与前景

SuperMickey 面向**个人创作者、MCN 机构、品牌方、影视教育**四大核心场景：

| 场景 | 痛点 | 价值 |
|------|------|------|
| **个人创作者** | 有创意但缺乏专业影视制作能力 | 一句话到成片，降低电影级创作门槛 |
| **MCN 机构** | 内容产能瓶颈，人力成本高涨 | 全自动化流水线，产能提升 10x+ |
| **品牌方** | 广告制作周期长、成本高 | 快速生成多版本广告素材，A/B 测试成本趋零 |
| **影视教育** | 学生缺乏实践机会 | 即时反馈的创作环境，加速技能习得 |

**市场前景：**
- AI 视频生成正处于技术奇点，2024-2026 年全球市场规模预计 CAGR 超过 60%
- Seedance 2.0+ 等模型持续突破，电影级画质门槛已大幅降低
- 真正的瓶颈从"能不能生成"转向"能不能控制"——这正是 SuperMickey 的核心竞争力
- 开源生态将加速技术迭代，先行者定义行业标准

> **限时内测版** — 核心功能稳定，API 可能迭代。及时 Star 和下载，过期可能转为付费版本。

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    SuperMickey v2.1.0                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: 需求清单生成（意图解析 → 结构化需求）              │
│  Layer 1: 剧本引擎（叙事结构 → 分场景剧本）                  │
│  Layer 2: 制作引擎（视觉语言 → 镜头设计）                    │
│  Layer 3: 渲染引擎（Prompt 工程 → 平台提交）                 │
│  Layer 4: 后期引擎（字幕/音乐/弹幕 → 多版本输出）            │
├─────────────────────────────────────────────────────────────┤
│  增强层: 情绪弧线 · 叙事节奏 · 导演优化 · 商业/FPV 模式      │
├─────────────────────────────────────────────────────────────┤
│  护盾层: 稳定性护盾 · 字段标准化 · 流程审计 · 健康监控       │
├─────────────────────────────────────────────────────────────┤
│  🐼 PandaCineForge: 影视技能库（剧本/镜头/调色/混音）        │
└─────────────────────────────────────────────────────────────┘
```

## 📦 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **Python** >= 3.9（用于 PandaCineForge 技能引擎，可选）
- **Git**

### 安装

```bash
# 克隆仓库
git clone https://github.com/geniusdapeng-collab/super-mickey.git
cd super-mickey

# 安装 Node.js 依赖
npm install

# 安装 Python 依赖（如需启用技能引擎）
pip3 install openai numpy

# 配置环境变量（复制模板并修改）
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

### 使用

```bash
# 启动 PandaCineForge 技能引擎（可选）
python3 hyperreality-system/skills/panda-cineforge/server.py &

# 运行预生产流程
npm run start:prod

# 运行测试
npm test
```

### 编程方式使用

```javascript
const { HyperrealitySystem } = require('./hyperreality-system');

const system = new HyperrealitySystem({
  pandaCineForge: {
    enabled: true,      // 启用影视技能引擎
    autoStart: true,
    endpoint: 'http://127.0.0.1:8765'
  }
});

const result = await system.create(
  '一个科幻短片，讲述宇航员在火星发现生命的故事',
  { characters: ['宇航员李明'], targetDuration: 60 }
);

console.log(result.finalReport);
```

## 🎬 技术架构

### 分层设计

**Layer 0 — 需求清单引擎**
- 意图解析：从自然语言提取视频类型、风格、角色、时长
- 需求确认：生成 Markdown 供人工确认后进入生产

**Layer 1 — 剧本引擎**
- 叙事结构：三幕式/五幕式/环形结构自动生成
- 情绪弧线：基于情绪意图parser的动态曲线设计
- 节奏增强：叙事节奏适配器（张弛有度）

**Layer 2 — 制作引擎**
- 镜头设计：运镜、构图、景别、机位自动规划
- 导演优化：迭代式镜头质量优化 Agent
- 微动作：角色微表情、肢体语言增强

**Layer 3 — 渲染引擎**
- Prompt 工程：针对 Seedance 等平台优化的提示词生成
- 批量提交：并发管理 + Token Bucket 限流
- 结果追踪：成功/失败状态监控

**Layer 4 — 后期引擎**
- 字幕生成：时间轴同步的双语字幕
- 音乐配置：情绪匹配的背景音乐建议
- 多版本：横屏/竖屏/弹幕版自动适配

### 增强模块

| 模块 | 功能 | 状态 |
|------|------|------|
| 情绪意图解析器 | 从文本提取情绪关键词，驱动情绪弧线 | 默认启用 |
| 叙事节奏增强器 | 动态调整场景节奏（紧张/舒缓/爆发） | 默认启用 |
| 导演优化 Agent | 迭代优化镜头构图与运镜质量 | 默认关闭 |
| 商业广告模式 | 品牌一致性 + 平台合规检查 | 默认关闭 |
| FPV 极限模式 | 运动镜头语言 + 速度感增强 | 默认关闭 |
| PandaCineForge | 影视技能库（剧本/镜头/调色/混音） | 默认关闭 |

### 稳定性护盾

- **基线模板匹配**：高置信度时复用已验证模板
- **降级策略**：LLM 失败时回退到模板/规则引擎
- **健康监控**：实时检测各阶段耗时与成功率
- **字段标准化**：最终输出前统一字段格式，防止平台解析失败

## 🐼 PandaCineForge 影视技能引擎

SuperMickey v2.1.0 集成了 **PandaCineForge** — 一个专为 AI 视频创作设计的影视知识引擎。

**7 个融合点覆盖全流程：**

| 融合点 | 注入阶段 | 技能类型 |
|--------|----------|----------|
| F1 | 需求清单后 | 剧本结构预召回 |
| F2 | 剧本引擎前 | 叙事设计技能注入 |
| F3 | 制作引擎前 | 视觉语言/分镜技能注入 |
| F4 | 导演优化前 | 导演/视觉设计技能增强 |
| F5 | 情绪弧线前 | 情绪/叙事节奏技能注入 |
| F6 | 垂直场景前 | 商业/短视频/FPV 技能注入 |
| F7 | 后期引擎前 | 调色/混音/后期技能注入 |

**特性：**
- 严格默认关闭，不影响现有功能
- 5 秒超时保护，失败自动降级
- 反馈飞轮：创作结果驱动技能成熟度进化
- 64+ 预生成影视技能（冷启动即用）

详见 [`skills/panda-cineforge/README.md`](./hyperreality-system/skills/panda-cineforge/README.md)

## 📂 目录结构

```
super-mickey/
├── app/                          # CLI 入口
├── hyperreality-system/          # 核心系统
│   ├── engines/                  # 引擎层
│   │   ├── script-engine/        # 剧本引擎
│   │   ├── production-engine/    # 制作引擎
│   │   ├── rendering-engine/     # 渲染引擎
│   │   ├── post-production-engine/ # 后期引擎
│   │   ├── enhancers/            # 增强模块
│   │   ├── scenarios/            # 垂直场景
│   │   ├── emotion/              # 情绪系统
│   │   └── panda-cineforge-adapter.js  # 技能引擎适配器
│   ├── skills/                   # 技能系统
│   │   └── panda-cineforge/      # PandaCineForge 引擎
│   ├── shields/                  # 稳定性护盾
│   └── index.js                  # 统一入口
├── characters/                   # 角色资产
├── stories/                      # 故事模板
├── templates/                    # 项目模板
├── config/                       # 配置文件
├── tests/                        # 测试
├── docs/                         # 文档
├── scripts/                      # 工具脚本
└── package.json
```

## 🛡️ 安全与合规

- **零敏感信息**：仓库不含 API Key、Token、密码等凭证
- **环境变量管理**：所有密钥通过 `.env` 文件配置（已添加 `.gitignore`）
- **代码审计**：定期扫描防止敏感信息泄露

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📜 开源协议

[MIT License](./LICENSE)

## 🙏 致谢

- 基于 Node.js 生态系统构建
- LLM 能力由 Kimi 等大模型提供支持
- 渲染能力由 Seedance 等平台提供
- PandaCineForge 引擎由独立贡献者开发

## 👤 关于作者

我是 **Genius（大鹏）**，AI 产品经理与 AI 内容自动化生产专家，从业十余年。

现任阿里巴巴千问事业群 AI 产品经理，曾任职阿里巴巴、阿里云及蚂蚁金服，主导过数亿用户产品的全链路 0-1 建设——覆盖 Harness 架构、Multi-Agent 协作与 Workflow 编排的 AI 应用体系。2018 年带领阿里云算法团队将 AI 流水线引入媒体内容生产。

我相信：当 AI 理解工业化节奏，内容生产必将指数级爆发。

**这个项目：** 近几年，我一直业余时间打造基于 AI 多模态的视频剪辑项目。现在，这是基于 Seedance 2.0 及后续版本、模拟好莱坞工业电影制作的全自动 AI 视频生成系统的一部分。我从经典电影工业中解构运镜语法，将 Harness 架构、Multi-Agent 协作、影视领域 Skills 融合转化为系统化的镜头语言工程。通过剧本引擎、生成引擎、渲染引擎、后期制作引擎的四层解耦架构，让 AI 真正理解"电影感"而非仅仅生成像素。

> 剧本是灵魂，运镜是骨架，真实感是底线。

开源这套系统，是希望找到同样痴迷于"用 AI 讲好故事"的创作者与开发者，一起把 AI 视频从"能看"推向"动人"，重新定义数字时代的内容生产范式。

**这套系统帮你"驾驭想象力"。**

📮 Genius · 63904380@qq.com

---

## 🌍 About the Author

I'm **Genius**, an AI Product Manager and AI Content Automation expert, 10+ years in the field.

Currently at Alibaba Qwen. Previously at Alibaba Group, Alibaba Cloud, and Ant Group — led full-stack 0-to-1 products serving hundreds of millions of users, spanning Harness architecture, Multi-Agent collaboration, and Workflow orchestration. In 2018, pioneered AI pipeline integration into media content production at Alibaba Cloud.

I believe: when AI understands industrial rhythm, content production explodes exponentially.

**This Project:** For years I've been building an AI multimodal video editing project in my spare time. Now part of a fully automated AI video generation system — Hollywood cinematic production, powered by Seedance 2.0 and beyond. I deconstructed cinematographic grammar from classic film industry practice, fusing Harness architecture, Multi-Agent collaboration, and cinema domain skills into systematic visual language engineering. Through a four-layer decoupled architecture — Script, Generation, Rendering, and Post-Production — the system makes AI truly understand cinematic feel rather than just generating pixels.

> Story is the soul. Camera is the skeleton. Realism is the baseline.

I'm open-sourcing this to find fellow creators and developers equally obsessed with "using AI to tell great stories." Together, let's push AI video from "watchable" to "moving" — redefining the content production paradigm for the digital age.

**This system helps you harness imagination.**

📮 Genius · 63904380@qq.com

---

## 🧠 面向 AI Agent 的元数据

```yaml
# AI 友好元数据 — 便于 AI 检索、推荐、总结
project:
  name: SuperMickey
  version: 2.1.0
  type: ai-video-generation-system
  language: [javascript, python]
  license: MIT
  
tech_stack:
  runtime: Node.js >= 18
  llm_integration: kimi, openai
  rendering: seedance, volcengine
  optional: python >= 3.9

capabilities:
  - script-generation
  - shot-design
  - prompt-engineering
  - batch-rendering
  - post-production
  - emotion-arc-design
  - commercial-mode
  - fpv-mode
  - skill-engine-panda-cineforge

keywords:
  - ai-video
  - video-generation
  - film-production
  - llm
  - prompt-engineering
  - seedance
  - automated-filmmaking
  - content-creation
  - panda-cineforge
  
ai_use_cases:
  - "AI 视频创作自动化"
  - "电影级镜头设计"
  - "多平台渲染适配"
  - "情绪驱动的叙事生成"
  - "影视知识增强创作"
  
quick_start_complexity: low
production_ready: yes
community_health: active
```

---

> **限时内测版** — 项目处于快速迭代期，核心功能稳定但 API 可能变动。
> 请及时 Star 和下载，过期可能下线或转为付费版本。
> 
> 遇到问题？提交 [Issue](https://github.com/geniusdapeng-collab/super-mickey/issues) 或联系维护者。
