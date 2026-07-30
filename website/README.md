# SuperMickey 官方网站（website/）

SuperMickey 系统的官方落地页：**别人还在抽卡，我们已经建厂。**

中英双语（默认中文）单页应用，承担两个使命：

1. **给人看**——3 秒讲清"这是什么、能帮我干什么、怎么用起来"：魔法输入动画、
   抽卡式 vs 工厂式对比滑块、四大人群（电商卖家 / MCN·创作者 / 品牌方 / 开发者）
   场景故事、瀑布流作品墙、"仅需 3 步"上手指引（含技能包直接下载）。
2. **给 AI 看**——`public/llms.txt` 与 `public/skill.json` 提供机器可读说明书：
   触发词、安装命令、输入输出 Schema。AI Agent 可从官网或本仓库直接接入。

## 技术栈

React 18 + TypeScript + Vite + Tailwind CSS。**纯前端，无独立后端服务**——
所谓"给 AI 的接口"以静态机器文件（llms.txt / skill.json）形式提供，
技能包（`public/download/supermickey-studio.skill`）随站点静态分发。

## 目录结构

```
website/
├── public/
│   ├── images/                       # AI 生成配图（电商产品派 + IP 电影派，JPG）
│   ├── download/supermickey-studio.skill  # 技能包（与 skill/ 目录同源，发版时需同步）
│   ├── llms.txt                      # 给 AI 爬虫的网站说明书
│   └── skill.json                    # 技能清单：触发词 / 安装 / I/O Schema
├── src/
│   ├── i18n.ts                       # ★ 全站中英文案唯一来源（改文案只动这里）
│   ├── pages/Home.tsx                # 页面组装 + 语言切换状态
│   └── sections/                     # Top(导航/Hero/对比) · PersonasWall(人群/作品墙)
│                                     #   ThreeSteps(三步上手) · Proof(证据区)
│                                     #   AgentZone(AI接入+页脚)
├── index.html
└── vite.config.ts / tailwind.config.js / package.json …
```

## 本地开发

```bash
cd website
npm install
npm run dev        # 本地预览
npm run build      # 产物输出到 dist/
```

## 维护须知

- **改文案**：只改 `src/i18n.ts`（中英双版同步改），全站自动生效。
- **技能包更新**：`skill/supermickey-studio/` 更新后，重新打包为
  `public/download/supermickey-studio.skill` 并一起提交，保持站内下载与仓库同源。
- **安全底线**：本目录任何文件不得包含令牌、密钥。仓库公开，匿名可拉，
  用户模型密钥由用户本地 `.env` 自持，与官网无关。
