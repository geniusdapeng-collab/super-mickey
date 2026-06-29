# 测试数据清理机制设计 v1.0

## 🎯 核心原则

> **测试数据与生产数据绝对隔离**。Mock测试完成后，所有测试链路产生的临时数据必须100%清理，不留痕迹。

---

## 📁 目录隔离规范

| 目录 | 用途 | 版本控制 | 生命周期 |
|------|------|---------|---------|
| `test-data/` | Mock测试临时数据 | ❌ `.gitignore` 忽略 | 测试后自动清理 |
| `data/` | 生产数据（从硬编码提取） | ✅ Git追踪 | 长期保留 |
| `stories/` | 故事配置与生产输出 | ✅ Git追踪 | 长期保留 |
| `characters/` | 角色档案 | ✅ Git追踪 | 长期保留 |
| `.archive/` | 历史归档（已废弃代码/数据） | ✅ Git追踪 | 永久保留，只读 |
| `temp/` / `tmp/` | 运行时临时文件 | ❌ `.gitignore` 忽略 | 运行后自动清理 |

---

## 🧹 四层清理机制

### 第一层：测试脚本内置清理（自动）

所有Mock测试脚本必须遵循 `setup → test → assert → cleanup` 四阶段：

```javascript
// Mock测试模板
const testLifecycle = {
  async run(mockName, testFn) {
    const tempFiles = [];
    try {
      // 1. Setup：创建临时目录
      const testDir = `test-data/.tmp-${Date.now()}`;
      fs.mkdirSync(testDir, { recursive: true });
      tempFiles.push(testDir);
      
      // 2. Test：执行测试
      await testFn(testDir);
      
      // 3. Assert：验证结果
      
    } finally {
      // 4. Cleanup：无论成功失败都清理
      this.cleanup(tempFiles);
    }
  },
  
  cleanup(paths) {
    for (const p of paths) {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`[TestCleanup] 🗑️ 已清理: ${p}`);
      }
    }
  }
};
```

### 第二层：测试数据文件标记（命名规范）

```
test-data/
  ├── *.mock.js          # Mock数据（测试后删除）
  ├── *.test.json        # 测试配置（测试后删除）
  ├── .tmp-*/            # 临时目录（测试后删除）
  └── README.md          # 说明文件（保留）
```

**强制规则**：
- 所有Mock数据文件必须带 `.mock.` 或 `.test.` 前缀
- 禁止在 `test-data/` 放置生产数据
- 禁止在 `data/` / `stories/` / `characters/` 放置测试数据

### 第三层：Git隔离保护

`.gitignore` 配置：
```gitignore
# 测试临时数据（永不进入版本库）
test-data/*.mock.js
test-data/*.test.json
test-data/.tmp-*/
test-data/temp-*/
*.test.mp4
*.test.png
*.test.log

# 运行时临时文件
temp/
tmp/
*.tmp
*.temp
```

**为什么 `data/` 要进Git，而 `test-data/` 不进？**
- `data/`：从系统代码提取的生产数据，是系统运行的必要依赖
- `test-data/`：纯Mock数据，只服务于验证，不服务生产

### 第四层：命令行清理工具

```bash
# 清理所有测试数据
npm run clean:test

# 清理运行时临时文件
npm run clean:temp

# 全面清理（测试+临时）
npm run clean:all
```

`package.json` 脚本：
```json
{
  "scripts": {
    "clean:test": "node scripts/clean-test-data.js",
    "clean:temp": "rm -rf temp/ tmp/ test-data/.tmp-*",
    "clean:all": "npm run clean:test && npm run clean:temp",
    "test": "npm run clean:test && jest && npm run clean:test"
  }
}
```

---

## 🛡️ 清理验证脚本

`scripts/clean-test-data.js`：

```javascript
const fs = require('fs');
const path = require('path');

function cleanTestData() {
  const testDataDir = path.join(__dirname, '..', 'test-data');
  
  if (!fs.existsSync(testDataDir)) {
    console.log('[CleanTest] test-data/ 目录不存在，跳过');
    return;
  }
  
  const entries = fs.readdirSync(testDataDir);
  let cleaned = 0;
  
  for (const entry of entries) {
    // 只清理标记文件，保留 README.md 和目录结构
    if (entry === 'README.md') continue;
    
    const fullPath = path.join(testDataDir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && entry.startsWith('.tmp-')) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`[CleanTest] 🗑️ 已删除临时目录: ${entry}`);
      cleaned++;
    } else if (stat.isFile() && (entry.includes('.mock.') || entry.includes('.test.'))) {
      fs.unlinkSync(fullPath);
      console.log(`[CleanTest] 🗑️ 已删除测试文件: ${entry}`);
      cleaned++;
    }
  }
  
  console.log(`[CleanTest] ✅ 清理完成，共清理 ${cleaned} 项`);
}

cleanTestData();
```

---

## 🔍 生产安全检查清单

每次发布前执行：

```bash
# 1. 检查 test-data/ 是否残留
ls test-data/ | grep -v README.md

# 2. 检查是否有 .tmp-* 目录残留
find . -name ".tmp-*" -type d

# 3. 检查 stories/ 是否有测试混入
find stories/ -name "*.test.*" -o -name "*.mock.*"

# 4. 检查 data/ 是否有测试混入
find data/ -name "*.test.*" -o -name "*.mock.*"

# 5. 运行全面清理
npm run clean:all
```

---

## ⚠️ 危险操作红线

以下操作 **绝对禁止**：

1. ❌ 将 Mock测试数据放入 `data/` / `stories/` / `characters/`
2. ❌ 将 `test-data/` 目录加入 Git 追踪
3. ❌ 测试后手动删除文件而不检查残留
4. ❌ 将 `.tmp-*` 目录重命名为生产目录
5. ❌ 测试脚本不实现 cleanup 阶段

---

## 📋 当前状态审计

| 目录 | 状态 | 需清理项 |
|------|------|---------|
| `test-data/` | ⚠️ 存在 `story-scorer-mocks.js` | 需标记为 `.mock.js` 或移入 `.tmp-*/` |
| `data/` | ✅ 纯净 | 无 |
| `stories/` | ✅ 纯净 | 无 |
| `characters/` | ✅ 纯净 | 无 |

**立即执行**：
1. 将 `story-scorer-mocks.js` 重命名为 `story-scorer.mock.js`
2. 添加 `test-data/.gitignore`
3. 创建 `scripts/clean-test-data.js`

---

*版本: v1.0 | 设计: AgentX | 日期: 2026-05-20*
