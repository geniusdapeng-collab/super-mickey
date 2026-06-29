# 神兽档案库系统白皮书 v1.1

## 版本更新
- **v1.0**: 2026-05-23 初版，15维度标准
- **v1.1**: 2026-05-23 v3.0升级，18维度（15基础+3扩展），自动生成内容全面超越手工精修

---

## 一、架构设计：单一数据源原则

**核心铁律**：JSON 是唯一数据源，MD 是自动渲染的视图。

```
┌─────────────────┐
│   JSON 数据源    │  ← 唯一真相来源，所有字段必填
│  beasts/{id}.json│
└────────┬────────┘
         │ 渲染引擎
         ▼
┌─────────────────┐
│   MD 视图文件    │  ← 人-readable，只读不修改
│  beasts/{id}.md  │
└─────────────────┘
```

**禁止操作**：
- ❌ 直接修改 MD 文件（会被下次渲染覆盖）
- ❌ 在飞书/其他平台维护独立副本
- ✅ 所有修改走 JSON → 重新渲染 MD

---

## 三、JSON Schema：18维度标准结构（v3.0）

> **v3.0升级说明**: 在v1.0的15维度基础上，新增3个深度扩展维度（16/17/18），使自动生成内容全面超越手工精修飞书文档。

### v3.0 新增维度速览

| 维度编号 | 维度名称 | 新增内容 | 对应手工精修亮点 |
|----------|----------|----------|------------------|
| 16 | AgentX交互档案 | 友好度/信任等级/任务列表/羁绊/情感弧线 | 九尾狐"友好度55/B级信任/4任务/羁绊真相之舞" |
| 17 | Nirath融合深度解析 | 创新设定/科学依据/视觉指导/叙事功能 | 九尾狐"生物发光体/磁场感知/幻术全息/声波魅惑" |
| 18 | 质量评分体系 | 5维度雷达图/总分/评分理由 | 九尾狐"46/50（优秀）" |

### v3.0 原有维度增强

| 维度 | v1.0 | v3.0增强 |
|------|------|----------|
| 栖息地 | 基础描述 | +地质演化史+温度数据+生态系统+食物链 |
| 身体结构 | 基础描述 | +骨节数+器官结构+材料科学参数 |
| 材质纹理 | 基础描述 | +多尺度工程（宏观/微观/纳米） |
| 配色系统 | 基础列表 | +色温心理学+光谱分析+功能驱动设计 |
| 起源故事 | 基础故事 | +K2文明+三阶段计划+设计冗余+双刃剑分析 |
| 关键传说 | 基础故事 | +叙事价值+情感节拍+镜头脚本+对话草稿 |
| 象征意义 | 基础列表 | +五维体系解读（光明-黑暗-生命-永恒-责任） |

---

### 完整18维度JSON结构

```json
{
  "id": "string",                    // 唯一标识，kebab-case
  "catalogNo": "string",             // 编号，如 "01"
  "name": {
    "chinese": "string",             // 中文名
    "pinyin": "string",              // 拼音
    "aliases": ["string"]            // 别名数组
  },
  "classification": {
    "tier": "神兽|异兽|凶兽|瑞兽",   // 等级
    "category": "Nirath原生|跨界",    // 来源分类
    "originText": "string"            // 山海经原文引用
  },
  "nirathStatus": {
    "isNative": true,                // 是否Nirath原生
    "habitat": "string",              // 栖息地描述（500字+）
    "ecosystemRole": "string"         // 生态系统角色
  },
  "visualIdentity": {
    "coreDescription": "string",      // 核心外貌描述（800字+）
    "bodyPlan": "string",             // 身体结构
    "colorPalette": ["string"],       // 配色方案（4色标准）
    "scale": "string",                // 体型尺度
    "texture": "string",              // 材质纹理
    "signatureFeatures": ["string"],  // 标志性特征（4项标准）
    "promptFragments": {
      "head": "string",               // 头部Prompt片段
      "body": "string",               // 身体Prompt片段
      "eyes": "string",               // 眼部Prompt片段
      "special": "string"             // 特殊部位Prompt片段
    }
  },
  "abilities": [
    {
      "name": "string",
      "description": "string",
      "rarity": "common|rare|epic|legendary"
    }
  ],
  "narrative": {
    "originStory": "string",            // Nirath起源故事（500字+）
    "keyLegends": ["string"],         // 3个关键传说
    "symbolism": ["string"],          // 4个象征意义
    "relationships": [               // 关系网络
      {
        "target": "string",
        "type": "related|encounter|conflict|ally",
        "dynamic": "string"
      }
    ]
  },
  "fpvLens": {
    "recommendedScenarios": ["string"], // FPV推荐场景
    "cameraAngles": ["string"],       // 推荐机位
    "emotionMapping": "string"         // 情绪映射
  },
  "sceneGenerator": {
    "habitatScene": "string",         // 栖息地场景Prompt
    "interactionScene": "string",     // 互动场景Prompt
    "actionScene": "string"           // 动作场景Prompt
  },
  "mdSource": {
    "titlePattern": "string",
    "sectionLength": 0,
    "dimensions": 15,
    "parsedAt": "ISO8601"
  }
}
```

---

## 三、15维度内容规范

### 必填维度（不可为"待设定"）

| 维度 | 字段路径 | 字数要求 | 质量标准 |
|------|----------|----------|----------|
| D1 | `nirathStatus.habitat` | ≥500字 | 完整生态系统描述 |
| D2 | `nirathStatus.ecosystemRole` | ≥50字 | 科学术语定义 |
| D3 | `visualIdentity.coreDescription` | ≥800字 | 逐部位详细描述 |
| D4 | `visualIdentity.bodyPlan` | ≥200字 | 结构+尺寸数据 |
| D5 | `visualIdentity.colorPalette` | 4色 | 每色含物理/科学解释 |
| D6 | `visualIdentity.scale` | ≥100字 | 精确尺寸+类比 |
| D7 | `visualIdentity.texture` | ≥200字 | 材质科学描述 |
| D8 | `visualIdentity.signatureFeatures` | 4项 | 每项≥100字 |
| D9 | `visualIdentity.promptFragments` | 4段 | 每段≥100字 |
| D10 | `abilities` | 3-6项 | 每项含科学原理 |
| D11 | `narrative.originStory` | ≥500字 | Nirath起源改写 |
| D12 | `narrative.keyLegends` | 3个 | 每个≥200字 |
| D13 | `narrative.symbolism` | 4个 | 每项≥50字 |
| D14 | `fpvLens` | 3字段 | 完整运镜方案 |
| D15 | `sceneGenerator` | 3字段 | 完整场景Prompt |

---

## 四、命名规范

### 文件命名
- JSON: `{kebab-id}.json`（如 `tao-tie.json`）
- MD: `{kebab-id}.md`（如 `tao-tie.md`）

### ID命名规则
- 中文名转拼音，kebab-case
- 多音字取最常见读音
- 示例：饕餮 → `tao-tie`，九尾狐 → `jiu-wei-hu`

---

## 五、生成流程（批量操作）

```bash
# 1. 生成JSON（数据源）
node generate-beast-json.js --id=tao-tie --catalog=06

# 2. 渲染MD（视图）
node render-beast-md.js --id=tao-tie

# 3. 验证完整性
node validate-beast.js --id=tao-tie
# 输出：✅ 15/15维度完整 | ❌ 3个"待设定"字段

# 4. 批量渲染全部
node render-all-beasts.js
```

---

## 六、质量检查清单

生成后必须检查：
- [ ] 15个维度全部填充，无"待设定"
- [ ] `visualIdentity.promptFragments` 4段可用
- [ ] `abilities` 至少3项，含科学原理解释
- [ ] `narrative.keyLegends` 恰好3个
- [ ] `visualIdentity.signatureFeatures` 恰好4项
- [ ] 所有尺寸数据有类比（如"相当于波音747翼展"）
- [ ] 颜色有科学解释（如"等离子体自然色，约8000K"）

---

## 七、当前40只神兽状态

| 编号 | 名称 | JSON | MD | 状态 |
|------|------|------|-----|------|
| 01 | 应龙 | ✅ | ✅ | 已完成 |
| 02 | 凤凰 | ✅ | ✅ | 已完成 |
| 03 | 麒麟 | ✅ | ✅ | 已完成 |
| 04 | 烛龙 | ⚠️ | ⚠️ | 需补修 |
| 05 | 白泽 | ✅ | ✅ | 已完成 |
| 06 | 饕餮 | ✅ | ✅ | 已完成 |
| 07 | 穷奇 | ✅ | ✅ | 已完成 |
| 08 | 帝江 | ✅ | ✅ | 已完成 |
| 09 | 梼杌 | ✅ | ✅ | 已完成 |
| 10 | 九尾狐 | ✅ | ✅ | 已完成 |
| 11 | 相柳 | ✅ | ✅ | 已完成 |
| 12 | 毕方 | ✅ | ✅ | 已完成 |
| 13 | 夔 | ✅ | ✅ | 已完成 |
| 14 | 青龙 | ✅ | ✅ | 已完成 |
| 15 | 白虎 | ✅ | ✅ | 已完成 |
| 16 | 朱雀 | ✅ | ✅ | 已完成 |
| 17 | 玄武 | ✅ | ❌ | 待修复 |
| 18 | 蛊雕 | ✅ | ❌ | 待修复 |
| 19 | 天狗 | ✅ | ❌ | 待修复 |
| 20 | 狰 | ✅ | ❌ | 待修复 |
| 21-30 | P2批次 | ✅ | ❌ | 待处理 |
| 31 | 鲲鹏 | ✅ | ✅ | 已完成 |
| 32-40 | P3批次 | ✅ | ❌ | 待处理 |

---

## 八、后续几百只的统一流程

**标准作业程序（SOP）**：

1. **批量生成JSON**：一次生成N只JSON（如10只/批）
2. **自动渲染MD**：批量渲染对应MD视图
3. **队长审阅MD**：打包MD文件发送审阅
4. **修改JSON**：如需修改，只改JSON
5. **重新渲染**：修改后自动重新渲染MD
6. **验证通过**：无"待设定" → 标记完成

**不碰飞书文档**，所有交付物都是本地MD文件，打包发送。

---

## 九、文件交付物清单

### 系统层（代码）
- `beast-database/core-engine.js` — 核心引擎
- `beast-database/schema-validator.js` — Schema校验器
- `beast-database/render-md.js` — MD渲染器
- `beast-database/batch-generator.js` — 批量生成器

### 数据层（JSON）
- `beasts/*.json` — 40只神兽数据

### 视图层（MD）
- `beasts/*.md` — 40只神兽视图（自动渲染）

---

## 十、关键教训

1. **单一数据源**：JSON是唯一真相，MD只是视图
2. **禁止飞书独立维护**：飞书文档是独立副本，必然不同步
3. **生成即完整**：生成时就填满15维度，不留"待设定"
4. **批量生成+批量渲染**：10只一批，效率最高
5. **自动验证**：生成后自动跑校验脚本，暴露问题

---

*文档版本：v1.1*
*更新时间：2026-05-23 19:25*
*适用：Nirath神兽档案库系统 v3.0*

---

## 十一、渲染引擎 v3.0（新增）

### 15维度深度档案渲染器 v3.0
- **路径**：`renderers/15dim-archive-renderer-v3.0.py`
- **输入**：JSON数据源（符合v3.0 schema）
- **输出**：MD档案文件（可直接用于飞书文档创建）
- **维度数**：18个（15基础+3扩展）
- **输出大小**：~29KB/只（含完整深度解析）
- **特色**：自动生成内容全面超越手工精修飞书文档

### v3.0 vs v2.0 对比

| 指标 | v2.0 | v3.0 | 提升 |
|------|------|------|------|
| 维度数 | 15 | 18 | +3 |
| 文件大小 | 15KB | 29KB | +93% |
| 总行数 | 201 | 292 | +45% |
| 完整Prompt | ❌ 无 | ✅ 490字成品 | 新增 |
| AgentX交互 | ❌ 无 | ✅ 友好度/任务/羁绊 | 新增 |
| 质量评分 | ❌ 无 | ✅ 雷达图+总分 | 新增 |
| 镜头脚本 | ❌ 无 | ✅ 景别/运镜/时长/关键帧 | 新增 |
| 对话草稿 | ❌ 无 | ✅ AgentX+神兽对话 | 新增 |

### 新增3大深度维度

**维度16：AgentX交互档案**
- 友好度进度条（0-100）
- 信任等级徽章（S/A/B/C/D）
- 任务列表（任务名/描述/奖励）
- 羁绊名称 + 羁绊故事
- 情感弧线4阶段详解

**维度17：Nirath融合深度解析**
- 创新设定详解（传统→科幻的4大转化逻辑）
- 科学依据（K2级文明/托卡马克/热力学第二定律）
- 视觉表现指导（5条画面执行指令）
- 叙事功能（孤独守护者/双刃剑/传承）

**维度18：质量评分体系**
- 5维度雷达图（视觉/叙事/Nirath/Prompt/交互）
- 总分 + 评分理由
- 在全部40只神兽中的排名参考

### v3.0 发布记录

**v3.0 发布（2026-05-23）**
- **发布人**：AgentX
- **审核人**：项目负责人（队长）
- **审核结论**："已经非常全了，非常赞。就用这个作为后续标准。"
- **发布文档**：`RELEASE-v3.0.md`
- **标杆案例**：烛龙（zhu-long.json + zhu-long-archive-v3.md）
- **核心突破**：自动生成内容全面超越手工精修飞书文档

**固化状态**：✅ 已确认为后续新异兽档案的标准生成方案
