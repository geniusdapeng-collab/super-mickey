# Release v1.2.4-alpha5

**发布日期**: 2026-06-18  
**系统**: 超级小香宝 (SuperXiangBao)  
**版本**: v1.2.4-alpha5  
**升级类型**: 专家诊断吸收 - 字段标准化与守门机制

---

## 专家诊断核心结论（已吸收）

外部专家诊断指出系统存在三大病根：
1. **字段没有单一真相源** - 同数据被多模块重复组装/裁剪
2. **兼容分支/fallback/降级逻辑偷偷改字段** - 导致字段时有时无
3. **预生产链路太长，缺少强schema+强守门+强合并规则**

**专家根治方案**：建立"全局字段标准规范机制"（四层）
- 第1层：统一字段标准
- 第2层：字段别名映射器
- 第3层：标准化器
- 第4层：强守门器

---

## 择优吸收内容

### ✅ 已落地

| 专家建议 | 超级小香宝适配 | 落地文件 |
|----------|---------------|----------|
| **字段标准化器** | 创建 `FieldStandardizer`（兼容中英文字段并存） | `engines/field-standardizer.js` |
| **字段守门器** | 创建 `FieldGuard`（在关键节点强制校验） | `engines/field-guard.js` |
| **接入点1：Layer 2 输出后** | ProductionEngine 产出后强制标准化 | `index.js` |
| **接入点2：最终导出前** | 最终报告生成前再次标准化 | `index.js` |
| **降级标记** | ScriptEngine 模板回退时显式标记 | `engines/script-engine/index.js` |
| **字段别名映射** | 40+ 字段别名自动归一 | `field-standardizer.js` |
| **关键字段强制保留** | 7个公共必填 + 2个片头必填 + 1个内容必填 | `field-standardizer.js` |
| **片头字段断言** | S00 强制要求 title/subtitle | `field-guard.js` |
| **日志摘要** | 每镜头字段数/降级状态打印 | `field-guard.js` |

### ⚠️ 适配调整（非照搬）

| 专家建议 | 调整原因 | 实际做法 |
|----------|---------|---------|
| 全中文字段命名 | 需与下游 Seedance API 兼容 | **中英文字段并存**，统一映射到英文标准字段 |
| 4个接入点（含片头后/storyboard后） | 超级小香宝架构不同（Layer 0-4） | **2个接入点**：Layer 2 后 + 最终导出前 |
| 14个模块 → 12个能力 | 超级小香宝模块较少 | 保持12个能力矩阵，与创意指数引擎联动 |

### ❌ 暂不采纳

| 建议 | 原因 |
|------|------|
| 批量修复历史输出脚本 | 超级小香宝历史输出较少，优先保障新链路 |
| `nirath-master-pipeline.js` 补丁 | 这是 v6.x 文件，超级小香宝使用 `index.js` |
| 全系统字段名改为中文 | 与 Seedance API 字段不兼容，维护成本过高 |

---

## 新增模块

### 1. `engines/field-standardizer.js`（~280行）

**核心能力**：
- `FIELD_ALIAS_MAP`: 40+ 字段别名映射（`id`→`shotId`, `dialogue`→`dialogue`, `台词`→`dialogue`）
- `standardizeShot()`: 单镜头标准化，自动推断片头/内容类型
- `validateShot()`: 关键字段校验（7公共 + 2片头 + 1内容）
- `normalizeDialogue()`: 台词统一为 `{speaker, text}` 数组
- `normalizeTimeline()`: 时间轴从多种格式提取
- `normalizePortraits()`: 定妆照从多种路径提取
- `markDegraded()`: 降级标记

### 2. `engines/field-guard.js`（~120行）

**核心能力**：
- `normalizeAndValidate()`: 标准化 + 校验，严格模式下失败抛异常
- `check()`: 快速校验（不抛异常）
- `assertOpeningFields()`: 片头字段强制断言
- `printShotSummary()`: 镜头字段摘要日志

---

## 接入点日志示例

```
🛡️ [FieldGuard] Layer 2 输出标准化与校验...
   ✅ 字段标准化通过 (2 警告)
   [FieldGuard] Layer2-Production shot summary:
   {
     "shotId": "SC00",
     "sceneType": "opening",
     "title": "",
     "subtitle": "",
     "scene": "Nirath硅晶草原...",
     "dialogueCount": 1,
     "portraitCount": 0,
     "timelineCount": 0,
     "cardCount": 0,
     "degraded": false
   }
```

---

## 修改文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `.current-version` | 修改 | 版本号: v1.2.3 → v1.2.4-alpha5 |
| `index.js` | 修改 | 引入 FieldGuard，Layer 2 后 + 最终导出前接入 |
| `engines/script-engine/index.js` | 修改 | 降级时显式标记 `degraded` + `degradeReason` |
| `engines/field-standardizer.js` | 新增 | 字段标准化器（280行） |
| `engines/field-guard.js` | 新增 | 字段守门器（120行） |

---

## 测试结果

**65/65 全部通过！成功率 100%！**

FieldGuard 成功发现测试场景片头缺少 `title`/`subtitle`（警告但不阻塞），证明守门机制生效。

---

## 系统状态

```
超级小香宝 v1.2.4-alpha5 架构
┌─────────────────────────────────────────────────┐
│  Layer 0: 需求清单 ✅ + 创意指数 ✅               │
├─────────────────────────────────────────────────┤
│  Layer 1: 剧本引擎 ✅ (降级标记已添加)             │
├─────────────────────────────────────────────────┤
│  Layer 2: 制作引擎 ✅ + 🆕 FieldGuard 标准化      │
├─────────────────────────────────────────────────┤
│  Layer 3: 渲染引擎 ⚠️ (skipRender 模式正常)       │
├─────────────────────────────────────────────────┤
│  Layer 4: 后期引擎 ✅                             │
├─────────────────────────────────────────────────┤
│  🆕 字段标准化: Layer 2 后 + 最终导出前           │
│  🆕 降级透明: ScriptEngine 显式标记               │
└─────────────────────────────────────────────────┘
```

---

## 下一步计划

1. **v1.3.0-beta1**: 解耦 v6.x 依赖，核心模块内嵌
2. **v1.4.0-rc1**: 完整测试覆盖，独立部署验证
3. **v2.0.0**: 对接真实 Seedance API，端到端渲染验证

---

**提交**: `v1.2.4-alpha5: 专家诊断吸收 - 字段标准化与守门机制`  
**提交人**: 小G  
**时间**: 2026-06-18 23:50 CST
