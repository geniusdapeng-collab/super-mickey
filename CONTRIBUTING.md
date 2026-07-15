# 贡献指南

感谢你对 SuperMickey 感兴趣！本项目欢迎所有形式的贡献。

## 🚀 如何贡献

### 报告 Bug

1. 搜索已有 Issue，确认未被报告
2. 使用 [Bug Report 模板](.github/ISSUE_TEMPLATE/bug_report.md) 创建新 Issue
3. 提供复现步骤、环境信息和错误日志

### 提交功能请求

1. 搜索已有 Issue，确认未被请求
2. 使用 [Feature Request 模板](.github/ISSUE_TEMPLATE/feature_request.md) 创建新 Issue
3. 描述使用场景和预期行为

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

## 📋 代码规范

### JavaScript

- 使用 ES2020+ 语法
- 遵循项目现有代码风格
- 关键函数添加 JSDoc 注释
- 新模块默认 `enabled: false`

### 提交信息规范

```
feat: 新功能
fix: 修复 Bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具链
```

### 测试

提交前请确保：

```bash
npm test
```

通过所有测试。

## 🏗️ 架构原则

1. **分层清晰**：新功能归入对应 Layer（0-4）或增强模块
2. **默认关闭**：新模块默认 `enabled: false`，用户显式启用
3. **降级保护**：所有外部依赖含超时和异常处理，失败不影响主流程
4. **零敏感信息**：绝不提交 API Key、Token、密码等凭证

## 💬 社区

- Issue 讨论：[GitHub Issues](https://github.com/geniusdapeng-collab/super-mickey/issues)
- 一般讨论：在对应 Issue 下留言

## 📝 许可证

提交即表示你同意将代码授权给本项目使用（MIT License）。
