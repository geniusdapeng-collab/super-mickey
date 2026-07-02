# 代码审计修复工作流

## 工作约定

### 修复-提交-推送机制（强制）

**原则：每修复一个关键问题，立即提交并推送云端，不允许堆积。**

#### 1. 单修复提交流程
```
修复完成 → git add <文件> → git commit -m "v{版本}-fix{序号}: {问题编号} {问题简述}" → git push origin master
```

- 提交信息格式：`v2.1.8-fix21: {P1-XXX-NN} {问题简述}`
- 每次修复独立一个 commit，不混合多个修复
- 修复完成后立即推送，不等待其他修复

#### 2. 批量修复提交流程（仅同一文件内多个微修复）
```
多个微修复完成 → git add <文件> → git commit -m "v{版本}-fix{序号}-batch: {问题编号1} {简述1}, {问题编号2} {简述2}" → git push origin master
```

#### 3. 推送前检查
```bash
# 提交前

git diff --cached --stat  # 确认修改范围

# 推送后

git log --oneline --graph --decorate --all -5  # 确认云端同步
```

#### 4. 当前分支约定
- 本地分支：`master`
- 远程分支：`origin/master`
- 远程仓库：`https://github.com/geniusdapeng-collab/super-mickey.git`

### 安全规则

- **所有提交前必须检查**：确认没有包含 API keys、tokens、passwords
- 脱敏规则：发现 `ghp_`, `sk-`, `AKID`, `Bearer` 等字符串立即替换为 `<REDACTED>`
- 生产配置与本地配置分离，不提交敏感配置文件

### 版本号规则

当前基线版本：`v2.1.8`
- fix 序号递增：fix20 → fix21 → fix22...
- 每轮审计完成后，整理所有修复到新版本号

---

## 执行记录

| 日期 | 修复版本 | 问题数 | 状态 |
|------|---------|--------|------|
| 2026-07-02 | v2.1.8-fix20 | 2个未提交文件 | 已推送 |

