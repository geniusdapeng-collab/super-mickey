# Release v1.2.1-alpha2

**发布日期**: 2026-06-18  
**系统**: 超级小香宝 (SuperXiangBao)  
**版本**: v1.2.1-alpha2  
**升级类型**: 功能增强（新增 Layer 0 需求清单模块）

---

## 新增功能

### 🆕 Layer 0: 需求清单生成确认模块 (RequirementListBuilder)

**文件**: `engines/script-engine/core/requirement-list-builder.js`

**功能**：
- 将用户自然语言输入解析为结构化《视频需求要点清单》
- 支持规则库快速解析 + LLM 深度解析双模式
- 自动推断补全缺失字段（类型、时长、风格、平台、受众等）
- 生成 Markdown 格式清单供人工确认
- 输出 ScriptEngine 兼容的 metadata 格式

**核心能力**：
- 视频类型识别（EDU/DRAMA/ADV/DOC/VLOG等10种）
- 风格编码展开（10种主风格 + 8种辅助风格）
- 时长/画幅/平台推断
- 角色信息提取
- 结构规划（开场/场景/结尾）
- 创意指数解析（支持"天花板级"等描述）
- 系列信息识别（集数/当前集/片头规则）

**集成点**：
- 已集成到 `index.js` 的 `create()` 主流程
- 在 Layer 1 (剧本引擎) 之前执行
- 支持 `skipRequirementList` / `skipRequirementConfirmation` 调试开关

---

## 修改文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `.current-version` | 修改 | 版本号: v1.2.0-alpha1 → v1.2.1-alpha2 |
| `index.js` | 修改 | 集成 RequirementListBuilder 到 Layer 0 流程 |
| `engines/script-engine/core/requirement-list-builder.js` | 新增 | 需求清单生成确认模块 |
| `test-requirement-list.js` | 新增 | 模块测试脚本 |
| `diagnosis-report-2026-06-18.md` | 新增 | 系统诊断报告 |

---

## 测试验证

**测试用例**: 健康科普视频（陈卓警官 - 横纹肌溶解第一集）

**测试结果**:
- ✅ 规则库解析: 3ms 完成
- ✅ 类型识别: 教育科普 (EDU) | 置信度: 83%
- ✅ 时长提取: 62秒（范围: 59～65秒）
- ✅ 风格识别: REAL (写实纪实) + NAT (自然感)
- ✅ 创意指数: 1.0 (天花板级)
- ✅ 角色提取: 穿警服的陈卓（ protagonist ）
- ✅ 结构规划: 3段（开场引入/核心知识点/总结收尾）
- ✅ Markdown 输出: 完整需求清单
- ✅ ScriptEngine 适配: metadata 格式正确

---

## 架构更新

```
┌─────────────────────────────────────────────────┐
│  🆕 Layer 0: 需求清单生成确认 (RequirementListBuilder) │
│     - 意图解析 → 规则库/LLM → 清单生成 → 确认锁定    │
├─────────────────────────────────────────────────┤
│  Layer 1: 剧本引擎 (ScriptEngine)                │
│     - 基于确认后的需求清单生成剧本                   │
├─────────────────────────────────────────────────┤
│  Layer 2: 制作引擎 (ProductionEngine)            │
├─────────────────────────────────────────────────┤
│  Layer 3: 渲染引擎 (RenderingEngine)             │
├─────────────────────────────────────────────────┤
│  Layer 4: 后期引擎 (PostProductionEngine)         │
└─────────────────────────────────────────────────┘
```

---

## 已知问题（未修复）

- P0: `renderResult` 作用域错误（跳过渲染时后期引擎崩溃）
- P1: `promptEnhancer` 模块加载失败
- P1: 镜头 `sceneType` 字段未定义
- P2: 强耦合 v6.x 系统模块（依赖 `../../../systems` 路径）
- P2: 后期引擎 Layer 4 待开发完成

---

## 下一步计划

1. **v1.2.2-alpha3**: 修复 P0 `renderResult` 作用域 bug，打通全链路
2. **v1.3.0-beta1**: 解耦 v6.x 依赖，核心模块内嵌，补全后期引擎
3. **v1.4.0-rc1**: 完整测试覆盖，独立部署验证

---

**提交**: `v1.2.1-alpha2: 新增需求清单生成确认模块 (Layer 0)`  
**提交人**: 小G  
**时间**: 2026-06-18 23:11 CST
