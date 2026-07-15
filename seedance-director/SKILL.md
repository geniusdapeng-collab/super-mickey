---
name: seedance-director
license: MIT
description: Seedance视频生产总指挥。当用户需要"生成短片""一键生成视频""从大纲到成片""批量生产镜头""导演模式""自动生产视频""视频pipeline""短片工作流"时激活。自动编排seedance-story-engine、seedance-character-manager、seedance-shot-design、byted-ark-seedance-skill完成从故事大纲到视频片段的完整生产流水线。支持StoryForge Pro上游剧本输入，支持MicroMotion微动作增强渲染系统，实现创意→剧本→渲染→成片的完整闭环。支持3-5分钟多镜头短片的全自动生产。
compatibility: Requires Node.js 18+ and all dependent skills (seedance-story-engine v1.0.0+, seedance-character-manager v1.0.0+, seedance-shot-design v1.9.3-Peng+, byted-ark-seedance-skill v2.0.1+, seedance-micromotion v1.0-Peng+).
metadata:
  author: volcengine/agentplan
  version: "9.2.0-Peng"
  status: "production-ready"
  releaseDate: "2026-05-14"
  changelog: "v5.4-Peng: 新增原始需求对齐闸机(Requirement Alignment Gate v1.0-Peng)，三阶段对齐验证(story-plan/pitch-winner/pre-render)+自动阻断机制，清理9个废旧脚本。v5.3-Peng: 修复3个P0级Bug(外貌过滤误删战斗描述/IP硬编码/渲染引擎版本号不匹配)，5轮Mock测试全部通过(58/58)。v5.2-Peng: 4板块架构全面发布(方案制作+比稿评测+渲染引擎+交付引擎)，Mock测试全覆盖(57/57通过)。v5.1-Peng: 比稿-渲染闭环+Skip-character修复。v5.0-Peng: 4板块架构+多方案比稿。v4.2-Peng-fix: 外貌过滤Bug紧急修复。v4.2-Peng: 分镜引擎+配音+后期制作。v4.0-Peng: MicroMotion微动作增强+上游剧本输入，6 Agent架构，55/55测试通过"
  category: ai/video-production
---

# Seedance Director — 视频生产总指挥 v1.2.1-Peng

## 概述

**一句话：用户说"我要短片"，系统1小时后把25个视频片段送到飞书。**

`seedance-director` 是 Seedance 视频生产体系的**顶层编排器**，自动串联7个下游技能完成完整pipeline：
