# 问题根因分析报告

## 问题1：时长分配死锁（所有镜头12秒）

### 之前为什么没问题？
- 之前的链路**没有调用** `ShotDurationAllocatorV2`
- 时长是 `run-taotie-pre-production.js` 里 scenes 数组**直接硬编码**的：`duration: 12`（或者没设，用默认值）
- 之前的九尾狐EP01等也是类似：脚本里直接写死时长，不走分配器

### 问题怎么来的？
- v6.0-patch31 发布时，我把 `ShotDurationAllocatorV2` **接入到了链路里**
- 但 V2 模块里有 `maxDuration: 12` 硬编码上限（设计文档里写的，没验证过）
- 接入后，所有镜头被分配器截断到12秒，差异化失效
- **这是新Bug，由新模块引入**

### 修复
- `maxDuration` 从 12 改为 **15**（Seedance API 真实上限）
- 去掉死锁逻辑，让 importance 差异化生效

---

## 问题2：饕餮定妆照路径错误

### 之前为什么没问题？
- 之前的提交脚本 `submit-taotie-render.js` **没有** `scanCharacterPortraits()` 功能
- 也没有从 Prompt 里自动提取角色的功能
- taotie 的定妆照是之前用 `generate-taotie-portraits.js` 生成的，**故意存在 `memorized_media/`**（视觉记忆系统）
- 之前的脚本可能只传了小G的定妆照，或者 taotie 当时根本不在 `characters/` 下也没被检查

### 问题怎么来的？
- v6.0-patch31 发布时，我加了**多角色全角度闸机 v1.1**
- 闸机要求：Prompt 里提到谁，就必须传谁的定妆照
- 代码通过 `scanCharacterPortraits()` 动态扫描 `characters/` 目录找定妆照
- 但 taotie 的定妆照**不在** `characters/`，在 `memorized_media/`
- 所以扫描不到 → 闸机拦截
- **这是新Bug，由新闸机模块引入**

### 修复
- 把 `memorized_media/taotie-portraits/*` **搬到** `characters/tao-tie/portraits/`
- 标准化所有角色定妆照保存路径

---

## 总结

两个问题都是 **v6.0-patch31 系统升级引入的新缺陷**，不是之前就有的。

根本原因：
1. **新模块未充分验证**：V2 分配器、多角色闸机都是新写的，没有在实际项目中跑过端到端验证
2. **路径不一致**：视觉记忆系统（`memorized_media/`）和角色系统（`characters/`）是两个独立路径，没有统一
3. **常量硬编码**：`maxDuration: 12` 是设计文档里的值，没验证过是否匹配 Seedance API 真实能力

## 修复方案

1. 改 `shot-duration-allocator.js`：`maxDuration: 12 → 15`
2. 搬定妆照：`cp memorized_media/taotie-portraits/* → characters/tao-tie/portraits/`
3. 重新跑完整链路
4. 验证时长是否有差异化
