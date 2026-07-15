# Seedance Render Engine — AI 视频渲染引擎

---
name: seedance-render-engine
license: MIT
description: Seedance视频渲染引擎。当用户需要"渲染视频""批量渲染镜头""AI视频生成""视频片段渲染""多镜头渲染"时激活。自动将分镜片段提交到 Seedance 2.0 API 进行渲染，支持 Multi-Shot 策略和单镜头切分，智能处理模型降级和配额管理。
compatibility: Requires Node.js 18+ and byted-ark-seedance-skill v2.0.1+.
metadata:
  author: volcengine/agentplan
  version: "9.2.0-Peng"
  status: "production-ready"
  releaseDate: "2026-05-14"
  changelog: "v5.3-Peng: P0级Bug修复 — 默认开启音频生成 + ffmpeg保留音频 + 删除外貌过滤逻辑"

---

## 板块定位
第3板块：渲染引擎 — 将分镜片段提交到 Seedance 2.0 API 进行 AI 视频渲染，智能处理 Multi-Shot / 单镜头切分策略。

## 职责边界
- 输入：生产目录（含 `04-prompts/` 片段提示词）或直接的 segments + prompts 数据
- 输出：`05-raw-shots/` 目录，含渲染完成的片段 + 精确切分后的独立镜头
- 核心能力：批量提交、模型自动降级、Multi-Shot 智能决策、轮询下载、ffmpeg 切分

## 核心能力

### 1. 批量渲染提交