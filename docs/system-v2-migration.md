# 系统 v2.0 架构重构 — 迁移文档

**日期**: 2026-06-04
**状态**: 第一类三件事 ✅ 完成
**验证结果**: 29/29 通过

---

## 一、已完成模块

### 1. Config Center v2.0 (`systems/config-center-v2.js`)

**核心功能**:
- 统一配置管理，消除所有硬编码值
- 分层加载：默认值 → 项目配置 → 环境变量
- 点路径读取：`get('prompt.maxLength')`
- 快捷方法：`getPromptMaxLength()`, `getFieldDef()`, `getEmotionPhases()`
- 向后兼容：`getConfig()`, `getConfigPath()` 旧接口

**收敛的硬编码值**:
| 常量 | 原位置 | 新位置 |
|------|--------|--------|
| `MAX_PROMPT_LENGTH=980` | buildPromptV3, MicroMotion, screenwriter | `config.prompt.maxLength` |
| `MAX_DURATION=15` | duration-calculator (Math.max bug) | `config.duration.maxShotDuration` |
| `EMOTION_PHASES=6` | 情绪映射器 | `config.emotion.phases` |
| `LLM_TIMEOUT=120000` | 各模块不一致 | `config.llm.timeoutMs` |
| `NEGATIVE_TEMPLATES` | prompt-standard-v2 | `config.prompt.negativeTemplates` |

**环境变量覆盖**:
- `NIRATH_PROMPT_MAXLENGTH` — 覆盖 Prompt 最大长度
- `NIRATH_MAX_DURATION` — 覆盖最大时长
- `NIRATH_LLM_TIMEOUT` — 覆盖 LLM 超时
- `NIRATH_SCHEMA_MODE` — 切换 Schema 验证模式
- `NIRATH_STRICT_MODE` — 启用严格模式

---

### 2. Pipeline Schema Validator (`systems/schemas/pipeline-schemas.js`)

**核心功能**:
- 纯 JS 实现，零外部依赖
- 6种 Schema 定义：PRD, CharacterProfile, Shot, Storyboard, RenderPromptInput, Beast
- 阶段边界验证：`validateStageInput()`
- Shot 数组验证：序列连续性、ID唯一性、口播完整性
- 渐进模式：`warn` → `strict`

**Schema 覆盖**:
| Schema | 验证阶段 | 关键约束 |
|--------|----------|----------|
| PRDSchema | Stage 1→2 | title, duration, characters必填 |
| CharacterProfileSchema | Stage 4→5 | id, name, role必填；role枚举值 |
| ShotSchema | Stage 5→6→7 | id, scene, narration, characters, emotionPhase必填 |
| StoryboardSchema | Stage 7→8 | totalShots, shots数组必填 |
| RenderPromptInputSchema | Stage 11 | prompt长度 [10, 1200], duration [1, 15] |
| BeastSchema | Beast Repository | id正则, category枚举, visualSignature必填 |

**当前模式**: `warn`（不阻断链路，记录日志）

---

### 3. Beast Domain Model (`systems/domain/beast-domain-model.js`)

**核心功能**:
- 6只神兽已注册：taotie, xuangui, dijiang, baize, jiuweihu, zhulong
- 统一命名规范：canonical ID（小写下划线）
- 多维度索引：byId, byName, byCategory, byAlias
- 模糊搜索：支持别名、中文名、拼音、英文名的任意输入
- 视觉签名统一：`getVisualSignaturePrompt()` — 所有模块注入神兽描述的**唯一入口**
- 向后兼容：提供 `Bestiary` 类兼容旧接口

**神兽数据标准**:
```
├── id: canonical ID（小写下划线）
├── canonicalName: { pinyin, chinese, english }
├── aliases: [所有历史别名]
├── category: 6种分类枚举
├── visualSignature: { description, keyFeatures, colorPalette, negativePrompt }
├── promptTemplate: 统一Prompt模板（带{scene}占位符）
├── negativePrompt: 神兽专用负面提示词
├── lore: { summary, abilities, temperament, symbolism }
├── habitat: { primary, secondary[] }
└── version + approved: 版本控制
```

---

## 二、验证结果

**验证脚本**: `scripts/verify-system-v2-migration.js`

| 类别 | 检查项 | 通过 | 失败 | 警告 |
|------|--------|------|------|------|
| Config Center | 7项 | 7 | 0 | 0 |
| Pipeline Schema | 8项 | 8 | 0 | 0 |
| Beast Domain | 11项 | 11 | 0 | 0 |
| 交叉验证 | 3项 | 3 | 0 | 0 |
| **总计** | **29项** | **29** | **0** | **0** |

---

## 三、下一步行动计划

### 立即执行（本周）

- [ ] **在饕餮预生产中测试 Config Center v2**
  - 修改 `preproduction-launcher-v6.2-patch103.js` 读取 `config-center-v2.js`
  - 验证 `maxPromptLength`, `maxDuration` 从配置中心读取
  - 跑1次完整预生产确认无异常

- [ ] **在阶段边界添加 Schema 验证（警告模式）**
  - Stage 5→6: `validateShots()` 在 storyboard 生成后调用
  - Stage 7→8: 验证 visualPrompt 存在
  - Stage 11→12: 验证 Render Prompt 输入
  - 记录验证日志，收集2轮数据

- [ ] **将现有 Bestiary 迁移到 Beast Domain Model**
  - 替换 `shanhaijing-bestiary/bestiary.js` 中的 `require` 指向新模块
  - 验证 `getBeast('taotie')` 返回统一数据
  - 确认 `promptTemplate` 格式一致

### 验证后实施（第2-3周）

- [ ] **事件总线试点**（2个非核心阶段）
  - 选择：Stage 7.2（主角注入）+ Stage 7.3（旁白修剪）
  - 创建事件订阅者包装器
  - 跑1次完整预生产验证无异常

- [ ] **LLM统一网关试点**
  - 包装 `buildPromptV3` 的 LLM 调用
  - 验证熔断器 + 重试在真实超时场景下的行为

- [ ] **smartTrim 重构验证**
  - 验证 `incrementalTrim` 在 490 汉字极限下保留所有必要区块

### 长期方向（第2个月）

- [ ] 视觉连续性引擎（需 CLIP 基础设施）
- [ ] 质量反馈循环（需渲染后自动分析）
- [ ] 资产管理系统 AMS（规范化目录结构 → 数据库）
- [ ] 声画绑定（等 Seedance 2.0 API 支持）

---

## 四、文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| Config Center v2 | `systems/config-center-v2.js` | 统一配置中心 |
| Pipeline Schemas | `systems/schemas/pipeline-schemas.js` | 数据契约验证 |
| Beast Domain Model | `systems/domain/beast-domain-model.js` | 神兽统一模型 |
| 验证脚本 | `scripts/verify-system-v2-migration.js` | 自动化验证 |
| 验证报告 | `output/system-v2-migration-report-*.json` | 验证结果 |
| 迁移文档 | `docs/system-v2-migration.md` | 本文档 |

---

## 五、关键约束（P0级）

1. **490 汉字 = 980 字符上限不可突破** — 任何配置修改必须保持此约束
2. **Schema 验证先 warn 后 strict** — 必须收集 2 轮数据后切换
3. **神兽 visualSignature 不可变** — 一旦确认，任何模块不得修改
4. **向后兼容** — 所有旧接口（`getConfig`, `Bestiary.getBeast`）继续工作
5. **预生产验证** — 任何改动必须跑完整链路验证

---

*文档结束*
