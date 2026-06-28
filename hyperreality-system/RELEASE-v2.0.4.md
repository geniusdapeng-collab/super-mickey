# Rainbow Bridge v2.0.4 Release Notes

## 版本信息
- **版本号**: v2.0.4
- **发布日期**: 2026-06-20
- **上一版本**: v2.0.3-audit-fix

## 修复内容

### P0 - 紧急修复
**[LLM引擎] `_fetchWithTimeout` Response属性丢失**
- **问题**: v2.0.2安全修复中，`{...res}`展开运算符未复制Response对象的getter属性（ok, status, statusText等），导致LLM调用被误判为"HTTP undefined"错误
- **影响**: 剧本引擎、制作引擎所有LLM调用均失败
- **修复**: 显式复制`ok`、`status`、`statusText`、`headers`、`url`等关键属性
- **文件**: `systems/llm-reasoning-engine.js`

## 变更文件
- `systems/llm-reasoning-engine.js` - _fetchWithTimeout方法修复

## 测试验证
- [x] 剧本引擎LLM调用正常
- [x] 制作引擎Phase-1/Phase-2 LLM调用正常
- [ ] PromptFusion阶段待验证（超时问题需进一步处理）

## 已知问题
- PromptFusion阶段可能因LLM调用时间较长导致超时，将在v2.0.5中优化

---
*发布者: 小G*
*时间: 2026-06-20 01:04*
