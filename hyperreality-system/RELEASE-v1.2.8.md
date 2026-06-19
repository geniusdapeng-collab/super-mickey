# 超现实系统 v1.2.8 发布说明

## 修复内容

### 第二轮审计（A1-A10）
| 编号 | 优先级 | 问题 | 文件 | 状态 |
|------|--------|------|------|------|
| A1 | P0 | 渲染绑定清单读不存在的 imageRefs | rendering-engine.js | ✅ 从 characterRef 解析 |
| A2 | P0 | 定妆照路径凭空生成 | production-engine.js | ✅ 优先真实路径+检查文件存在 |
| A3 | P0 | 截断破坏 L1-L9 融合顺序 | production-engine.js | ✅ 原位最小化，保持顺序 |
| A4 | P1 | ImmutableShot REQUIRED_FIELDS 与 v6.37 不兼容 | immutable-shot.js | ✅ 仅 shotId 必填 |
| A5 | P1 | 渲染状态查询完全失效 | rendering-engine.js | ✅ 修复端点和 taskId 传递 |
| A6 | P1 | _minimizePart 用中文逗号分割英文 | production-engine.js | ✅ 正则 /[,，]/ 兼容 |
| A7 | P1 | maxPromptLength 三处不一致 | intent-parser.js, adapter.js | ✅ 统一 1500 |
| A8 | P2 | IntentParser 硬编码 xiaoG/山海经 | intent-parser.js | ✅ 通用化 |
| A9 | P2 | ScriptEngine 模板降级硬编码 Nirath | script-engine/index.js | ✅ 通用化 |
| A10 | P2 | adapter 硬编码 xiaoG/taotie | adapter.js | ✅ 移除硬编码 |

### 第三轮审计（B1-B10）
| 编号 | 优先级 | 问题 | 文件 | 状态 |
|------|--------|------|------|------|
| B1 | P0 | 后期引擎角色获取路径错误 | post-production-engine.js | ✅ character_system.characters |
| B2 | P0 | 后期引擎硬编码山海经身份 | post-production-engine.js | ✅ 从 visual_anchor 动态推断 |
| B3 | P1 | 校验器单场景时长≤15s矛盾 | script-validator.js | ✅ 改为≤60s |
| B4 | P1 | 校验器台词长度30字矛盾 | script-validator.js | ✅ 改为50字 |
| B5 | P1 | 后期引擎 timing 字段名错误 | post-production-engine.js | ✅ start_time→start |
| B6 | P1 | 片头要求 featured_beast_id | production-engine.js | ✅ 默认所有项目有片头 |
| B7 | P1 | 片头 backgroundSound 格式不一致 | production-engine.js | ✅ 复用 _buildBackgroundSound |
| B8 | P2 | _buildMood/_buildAction 硬编码 | production-engine.js | ✅ 优先动态提取 |
| B9 | P2 | 弹幕硬编码山海经 | post-production-engine.js | ✅ 通用化 |
| B10 | P2 | HTML时间轴用 timing.duration | post-production-engine.js | ✅ 优先 duration 字段 |

## 版本信息
- 版本: v1.2.8
- 基于: v1.2.7 + 外部专家三轮审计修复
- 累计修复: 33个问题（修复1-12 + A1-A10 + B1-B10）
