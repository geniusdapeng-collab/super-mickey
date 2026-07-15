English | [中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Português](README.pt.md) | [Français](README.fr.md)

<p align="center">
  <img src="assets/logo.svg" width="128" height="128" alt="Seedance Shot Design Logo">
</p>

<h1 align="center">Seedance2.0 Shot Design</h1>

<p align="center">
  <strong>Cinematic Shot Language Designer</strong>
</p>

<p align="center">
  <a href=""><img src="https://img.shields.io/badge/version-1.9.1-blue.svg" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT--0-green.svg" alt="License"></a>
  <a href=""><img src="https://img.shields.io/badge/platform-Seedance_2.0-purple.svg" alt="Platform"></a>
</p>

<p align="center">
  Turn your vague video ideas into <strong>cinema-grade video prompts</strong> ready for Jimeng Seedance 2.0 — in one shot.
</p>

A Claude Skill built on the [Agent Skills](https://agentskills.io) specification, blending Hollywood-level cinematography aesthetics with Chinese film industry practices. It's designed to help creators break free from the "looks nice but random" AI video trap and achieve **precise, controllable visual storytelling**.

---

## ✨ Core Capabilities

| Capability | Description |
|------------|-------------|
| 🎭 **AI Comic Drama & Short Drama Production** | Full-pipeline support for AI comic strips (漫剧) and AI short dramas — character dialogue / voiceover / actor blocking / exaggerated expression close-ups / narrative-motivated camera / short drama style quick-selector / 4 prompt template variants (CN/EN × dialogue/voiceover), with dedicated scenario templates and complete examples |
| 🎨 **28+ Director & Style Presets** | Nolan / Villeneuve / Fincher / Deakins / Kurosawa / Makoto Shinkai / Wong Kar-wai / Zhang Yimou / Xianxia / Cel-Shaded CG / Anime / Xiaohongshu… |
| 🎬 **Pro Camera Movement Dictionary** | 3-tier camera system + 14 focal lengths + 6 focus controls + 7 physical mounts, with bilingual CN/EN references |
| 💡 **Three-Layer Lighting Structure** | Light Source → Light Behavior → Color Tone — no more vague "add a light" |
| 📐 **Timestamped Storyboarding** | `0-3s / 3-8s / …` precise timeline control to prevent visual bleeding between shots |
| 🎯 **Six-Element Precision Assembly** | Subject / Action / Scene / Lighting / Camera / Sound — a structured, high-conversion formula |
| 🎬 **Smart Multi-Segment Storyboard** | Videos >15s are automatically split into independent prompt segments with unified style, lighting, sound, and seamless transition frames |
| 📦 **20 Scenario Templates** | E-commerce / Xianxia / Short Drama / Food / MV / One-Take / Automotive / Macro / Nature / Game PV / Horror / Travel / Pets / Transformation / Loop / Video Editing / Video Extension / Story Completion / Multiframe Storytelling |
| 🎵 **Sound & ASMR Vocabulary** | Physics-based onomatopoeia library covering ambient / action / vocal / music sounds |
| 🎤 **Voice & Language Control** | Timbre cloning via video reference, dialect/accent control (Sichuan/Cantonese/Northeast/Taiwanese etc.), multilingual dialogue mixing, special voice styles (documentary/stand-up/opera/ASMR) |
| 📹 **Multimodal Reference Guide** | 6 core reference patterns (first frame / camera replication / action replication / camera+action separation / timbre reference / effect replication), multi-asset character control, consistency preservation |
| 🌐 **Bilingual Prompt Output** | Chinese users → Chinese prompts, non-Chinese users → English prompts, auto-detected |
| 🛡️ **Copyright-Safe IP Fallback** | Three-tier progressive IP fallback strategy to prevent platform content blocks |
| 🔍 **Structured Hard Validation** | Word count / camera moves / temporal logic / filler detection / optical physics conflicts / style conflict matrix — 7-rule checklist applied before every delivery |
| 🔗 **CLI Integration** | Jimeng CLI command mapping (`text2video` / `image2video` / `multiframe2video` / `multimodal2video`), async task management, VIP channel routing |
| 🎞️ **Multiframe Storytelling** | Upload 2-9 keyframe images → engine auto-composes coherent story video via `multiframe2video`, with decision matrix for choosing multiframe vs. multi-segment storyboard |

---

## 🚀 Quick Start

### 1. Install the Skill

<details>
<summary><b>Claude Code</b></summary>

Place the `seedance-shot-design/` folder under `.claude/skills/` in your project root:
