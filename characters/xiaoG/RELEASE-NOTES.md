# 小G角色定妆照 生产发布文档
**版本**: v6-fixed-production
**发布时间**: 2026-05-19 18:31 CST
**发布人**: 小G (AI Assistant)
**审批人**: 项目负责人（匿名）

---

## 定妆照清单（5张生产版本）

| 角度 | 文件名 | 大小 | 用途 |
|------|--------|------|------|
| 正面全身 | xiaoG-v6-fixed-front.png | 359,731 bytes | 全身镜头、对话镜头 |
| 3/4侧面 | xiaoG-v6-fixed-threeQuarter.png | 520,969 bytes | 单人镜头、互动镜头 |
| 侧面90度 | xiaoG-v6-fixed-side.png | 315,905 bytes | 行走镜头、过渡镜头 |
| 背面 | xiaoG-v6-fixed-back.png | 370,122 bytes | 远景、跟随镜头 |
| 面部特写 | xiaoG-v6-fixed-closeup.png | 444,337 bytes | 情感镜头、反应镜头 |

**存储路径**: `characters/xiaoG/portraits/`

---

## 版本特性

### 基于队长真人照片
- 使用项目负责人的真实照片作为AI参考源
- 保留成人面部特征，儿童化渲染
- 面部一致性通过级联参考法保障

### 红色"杭州"标识
- 位置：左胸（心脏位置）
- 颜色：红色汉字
- 状态：固定不可变动

### 角色设定
- 8岁中国杭州男孩
- 身高1米3
- 深绿色探险夹克、卡其色工装裤、棕色皮靴
- 无雀斑（根据反馈调整）

---

## 技术参数

| 参数 | 值 |
|------|-----|
| 生成模型 | Doubao-Seedream-5.0 |
| 分辨率 | 2K |
| 风格 | 真实摄影、纪录片质感 |
| 参考照片 | reference-photo.jpg |
| 并发数 | 1（串行生成确保一致性） |

---

## 历史版本归档

旧版本已移至 `portraits/.archive/`:
- v1-v4 (AI生成版本)
- from-leadership (未固定位置版)
- v7 (未完成的橘黄色版本)

---

## 使用规范

1. **后续所有故事必须使用此版本定妆照**
2. **禁止私自修改"杭州"标识位置**
3. **禁止混合使用旧版本**
4. 新故事加载角色时自动引用 `characters/xiaoG/character-card.json` 中的 `generatedAssets.portraits`

---

## 签名

**审批确认**: ✅ 项目负责人已确认v6-fixed版可用
**发布时间**: 2026-05-19 18:31 CST
**状态**: PRODUCTION
