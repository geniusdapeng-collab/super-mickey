# Release v2.0.6-fix2

## 修复内容

### 需求清单确认流程强制化（系统级修复）

**问题**：`skipRequirementConfirmation` 选项允许绕过需求清单确认，违反 P0 级规则。

**修复**：
1. 移除 `index.js` 中的 `skipRequirementConfirmation` 选项支持
2. 需求清单确认变为强制阻塞环节，不可跳过
3. 更新 SOUL.md、AGENTS.md 文档，强化规则

**文件变更**：
- `index.js` - 移除 `skipRequirementConfirmation` 分支
- `SOUL.md` - 更新 v6.6.4 需求清单确认流程为"焊死，不可跳过，系统强制阻塞"
- `AGENTS.md` - 新增"视频预生产 - 需求清单确认（强制规则）"章节

## 规则摘要

每次预生产任务必须：
1. 生成完整《视频需求要点清单》
2. 等待用户确认（或提出修改意见）
3. 确认后锁定需求，进入预生产链路

禁止：
- 使用 `skipRequirementConfirmation` 等选项跳过确认
- 在用户未确认前擅自进入预生产
- 将需求清单确认标记为"调试模式跳过"
