# RELEASE-v7.0.md — 角色特征提炼Agent模块发布

## 发布概要
- **版本**: v7.0
- **模块**: 角色特征提炼Agent + 帝江(暖暖)定妆照v7-production
- **发布时间**: 2026-05-22
- **类型**: 局部模块升级（非全量发布）

---

## 新增/升级模块

### 1. 角色特征提炼Agent v1.0
**文件**: `systems/character-feature-extractor.js`

**核心能力**:
- 输入角色素材文本 → 自动提取特征（颜色/形态/数量/面部/大小/质感）
- 识别陷阱词（AI容易误解的词汇）
- 生成三层Prompt（禁止清单→形态定义→数量确认）
- 输出标准化character-card.json

**工作流程**:
```
素材文本 → Step1特征提取 → Step2陷阱识别 → Step3生成Prompt → Step4输出档案
```

**Prompt三层结构**:
- **Layer1**: 禁止清单（8项绝对禁止，含"禁止标数字编号"）
- **Layer2**: 形态定义（中空+赤红+平坦面部+否定锚定）
- **Layer3**: 数量确认（空间分布描述，不写编号，翼在两侧足在底部）

### 2. 帝江(暖暖)角色档案 v7-production
**文件**: `characters/nuanNuan/character-card.json`

**升级内容**:
- 版本号: v4-production → v7-production
- 生成方式: manual → agent-driven
- Prompt引擎: 无 → character-feature-extractor-v1.0
- 定妆照: 4张全部更新为v7-agent版本
- 新增visualIdentity结构化字段（count/texture/face/color/size）
- 新增promptEngineering字段（三层结构说明）

---

## 经验固化

### Prompt工程规范升级
从v6的"编号1-2-3-4-5-6" → v7的"均匀分布6条足，呈放射状对称排列"

**关键教训**:
1. AI会将"编号"理解为画面标数字
2. 数量描述用空间分布替代编号列举
3. 翼和足的位置必须明确（翼在两侧，足在底部）
4. 陷阱词必须前置识别并规避

### 错误模式库更新
新增到 `systems/portrait-error-patterns.json`:
```json
{
  "patternId": "P005",
  "issue": "画面标数字",
  "trigger": "Prompt写'编号1-2-3'",
  "fix": "改为'均匀分布，清晰可见'",
  "status": "resolved-in-v7"
}
```

---

## 与大系统的关系

**架构说明**:
- v7是**局部模块发布**（角色系统子模块）
- 大系统在构建时自动集成各模块最新production版本
- 不需要发布全量17万行代码
- 类比：App单独更新，不用重装整个操作系统

**集成方式**:
```
大系统构建时 → 读取各模块character-card.json → 拉取最新production版本
```

---

## 文件清单

### 新增文件
- `systems/character-feature-extractor.js` — 特征提炼Agent

### 更新文件
- `characters/nuanNuan/character-card.json` — v7-production
- `systems/portrait-error-patterns.json` — 新增P005错误模式

### 生成文件（资产）
- `characters/nuanNuan/portraits/nuanNuan-v7-agent-front.png`
- `characters/nuanNuan/portraits/nuanNuan-v7-agent-threeQuarter.png`
- `characters/nuanNuan/portraits/nuanNuan-v7-agent-topDown.png`
- `characters/nuanNuan/portraits/nuanNuan-v7-agent-side.png`

---

## 验证结果
- Agent测试：帝江素材输入 → Prompt输出 ✅
- 4角度定妆照生成：全部成功 ✅
- 队长验收：通过 ✅

---

*Released: 2026-05-22 | Module: character-feature-extractor-v1.0*
