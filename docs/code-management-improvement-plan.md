# 超级小香宝代码版本管理改进方案

## 背景

本次 S03 超时问题的根因表面是 LLMEngine 版本不一致，本质是**代码管理机制缺失**。

### 问题现象
- `super-mickey/systems/`（旧版本，实际被加载）
- `hyperreality-system/systems/`（新版本，未被加载）
- `workspace/systems/`（最新版本，隔离测试使用）

三个目录共存，导致运行时加载了错误的代码版本。

---

## 改进方案

### 1. 单一真源（Single Source of Truth）

**原则**：所有系统模块必须从唯一路径加载。

```
workspace/                          # 开发工作区（唯一真源）
└── systems/                        # 核心系统模块
    ├── llm-reasoning-engine.js
    ├── llm-output-normalizer.js
    └── ...

super-mickey/                       # 项目仓库
├── hyperreality-system/            # 引擎代码
│   └── engines/                    # 只放引擎专属代码
│       └── script-engine/
│           └── core/
│               └── script-generator.js  # 从 ../../systems/ 加载
└── systems/                        # 生产环境部署（同步自 workspace/systems/）
```

**禁止**：任何子目录维护独立的 `systems/` 副本。

### 2. 加载路径规范

所有模块统一使用环境变量或相对路径从项目根目录加载：

```javascript
// ✅ 正确：从项目根目录的 systems/ 加载
const SYSTEMS_PATH = process.env.SUPER_MICKEY_SYSTEMS_PATH 
  || path.join(__dirname, '../../../../systems');
const { LLMEngine } = require(path.join(SYSTEMS_PATH, 'llm-reasoning-engine.js'));

// ❌ 错误：从不同层级硬编码路径
const LLM_ENGINE_PATH = path.join(__dirname, '../../../../systems/llm-reasoning-engine.js');
// 如果文件被移动或复制到其他位置，路径会失效
```

### 3. 自动化同步机制

#### 方案 A：Git 子模块（推荐用于多仓库）

```bash
# 将 systems/ 提取为独立仓库
git submodule add https://github.com/geniusdapeng-collab/supermickey-systems.git systems/

# 所有项目引用同一子模块
```

#### 方案 B：构建时同步（推荐用于单仓库）

```json
// package.json
{
  "scripts": {
    "prebuild": "node scripts/sync-systems.js",
    "build": "...",
    "check-consistency": "bash scripts/check-code-consistency.sh"
  }
}
```

```javascript
// scripts/sync-systems.js
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../workspace/systems');
const TARGETS = [
  path.resolve(__dirname, '../super-mickey/systems'),
  path.resolve(__dirname, '../hyperreality-system/systems')  // 如需保留
];

function sync() {
  for (const target of TARGETS) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(SOURCE, target, { recursive: true });
    console.log(`Synced: ${target}`);
  }
}

sync();
```

#### 方案 C：软链接（开发环境快速方案）

```bash
# 删除物理目录，建立软链接
rm -rf super-mickey/systems
ln -s ../../workspace/systems super-mickey/systems
```

### 4. 一致性检查 CI/CD

```yaml
# .github/workflows/consistency-check.yml
name: Code Consistency Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check Systems Consistency
        run: |
          ./scripts/check-code-consistency.sh
      
      - name: Verify No Duplicate Systems
        run: |
          # 确保只有一个 systems/ 目录
          COUNT=$(find . -name "llm-reasoning-engine.js" -not -path "*/node_modules/*" -not -path "*/backup*" | wc -l)
          if [ "$COUNT" -gt 1 ]; then
            echo "❌ 发现多个 llm-reasoning-engine.js 副本!"
            find . -name "llm-reasoning-engine.js" -not -path "*/node_modules/*"
            exit 1
          fi
          echo "✅ 系统模块唯一性检查通过"
```

### 5. 版本标记与追踪

每个核心模块增加版本头部注释：

```javascript
// llm-reasoning-engine.js v6.5.28-parallel
// 最后修改: 2026-06-30
// 修改人: 超级小香宝
// 修改内容: 
//   - 增加 res.text() 超时保护
//   - 修复 Promise.race 死锁问题
// 依赖: llm-output-normalizer.js v2.1.0+
```

运行时日志输出版本信息：
```javascript
console.log(`[LLMEngine] 版本: ${this.version} | 模型: ${this.model}`);
```

### 6. 文档化加载路径

在 `ARCHITECTURE.md` 中明确记录：

```markdown
## 模块加载规范

### 核心系统模块
- **位置**: `workspace/systems/`
- **加载方式**: 通过 `process.env.SUPER_MICKEY_SYSTEMS_PATH` 或相对路径
- **禁止**: 任何子目录维护独立的 systems/ 副本

### 引擎模块
- **位置**: `hyperreality-system/engines/`
- **加载方式**: 只加载引擎专属代码，系统模块统一从 systems/ 加载
```

---

## 立即执行项

1. ✅ 已修复：统一 systems/ 目录至 `super-mickey/systems/`
2. ✅ 已创建：一致性检查脚本 `scripts/check-code-consistency.sh`
3. ⏳ 待执行：删除所有旧版本备份（确认无误后）
4. ⏳ 待执行：在 CI/CD 中集成一致性检查
5. ⏳ 待执行：为所有核心模块添加版本头部注释

---

## 验证修复

修复后立即重跑 S03 测试验证：

```bash
cd hyperreality-system
node run-preproduction-test-wukong.js
```

预期：Layer 1 剧本生成正常完成，总时长 < 10 分钟。

---

## 附录：目录结构规范

```
super-mickey/                          # 项目根目录
├── ARCHITECTURE.md                    # 架构文档（含加载规范）
├── README.md
├── scripts/
│   ├── check-code-consistency.sh     # 一致性检查
│   ├── sync-systems.js               # 自动同步
│   └── fix-code-consistency.sh       # 修复脚本
├── systems/                           # 核心系统模块（唯一真源）
│   ├── llm-reasoning-engine.js
│   ├── llm-output-normalizer.js
│   └── ...
├── hyperreality-system/               # 引擎代码
│   ├── engines/
│   │   ├── script-engine/
│   │   │   └── core/
│   │   │       └── script-generator.js   # 从 ../../systems/ 加载
│   │   └── production-engine/
│   │       └── agents/
│   │           └── base-agent.js         # 从 ../../../../systems/ 加载
│   └── index.js
└── docs/
    └── code-management/               # 代码管理文档
        └── version-management-guide.md
```

---

**制定时间**: 2026-06-30  
**制定人**: 超级小香宝
