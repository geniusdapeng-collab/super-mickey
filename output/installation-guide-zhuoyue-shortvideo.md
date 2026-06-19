# 卓越视频制作系统 + 作业系统 安装部署指南

> 版本: 2026-06-19  
> 适用系统: zhuoyue-system + short-video-system + systems/  
> 部署目标: OpenClaw 环境

---

## 一、系统概述

本项目包含三套协同工作的视频生成系统：

| 系统 | 代号 | 用途 | 规模 |
|------|------|------|------|
| **卓越视频制作系统** | zhuoyue-system | 长视频/系列剧预生产 | 496文件, ~13MB |
| **作业系统** | short-video-system | 15秒短视频生成 | 33文件, ~5.7MB |
| **共享系统模块** | systems/ | LLM引擎、渲染接口等共享能力 | 269文件, ~4.3MB |

---

## 二、环境要求

### 2.1 基础环境
- **Node.js**: >= v18.0 (推荐 v24+)
- **npm**: >= v8.0
- **OpenClaw**: >= v1.0 (已安装配置)
- **操作系统**: Linux/macOS (推荐 Ubuntu 22.04+)

### 2.2 API 依赖
以下 API 密钥需要提前配置：

| 服务 | 环境变量 | 用途 |
|------|----------|------|
| 火山引擎 Ark | `VOLCENGINE_ARK_API_KEY` | LLM推理 (kimi-k2p6) |
| 火山引擎 Seedance | `SEEDANCE_API_KEY` | 视频渲染 |
| 火山引擎 Seedream | `SEEDREAM_API_KEY` | 图片生成 |

### 2.3 配置文件
创建 `~/.openclaw/config/volcengine.json`：

```json
{
  "apiKey": "YOUR_API_KEY_HERE",
  "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
  "endpoints": {
    "video": "ep-20260518004622-jp46s",
    "video_fast": "ep-20260518003432-n8v8f",
    "image": "ep-20260518004750-lz76f"
  }
}
```

---

## 三、目录结构

安装后的完整目录树：

```
~/.openclaw/workspace/
├── zhuoyue-system/              # 卓越系统主目录
│   ├── config/                  # 配置文件
│   │   ├── llm-policy.js
│   │   ├── stage-map.js
│   │   ├── prompt-length.js
│   │   └── ...
│   ├── core/                    # 核心模块
│   │   ├── immutable-shot.js
│   │   └── ...
│   ├── engines/                 # 引擎层
│   │   ├── production-engine/
│   │   ├── post-production-engine/
│   │   ├── rendering-engine/
│   │   └── script-engine/
│   ├── systems/                 # 子系统 (与共享 systems/ 软链)
│   │   ├── llm-reasoning-engine.js
│   │   └── ...
│   ├── data/                    # 数据文件
│   ├── docs/                    # 文档
│   ├── output/                  # 输出目录
│   ├── scripts/                 # 工具脚本
│   ├── run.js                   # 主入口
│   └── index.js                 # 系统核心
│
├── short-video-system/          # 作业系统/超短裙系统
│   ├── systems/                 # 子系统
│   ├── products/                # 产品配置
│   ├── stories/                 # 故事数据
│   ├── short-video-engine.js    # 主引擎
│   └── run-*.js                 # 各项目运行脚本
│
├── systems/                     # 共享系统模块 (全局)
│   ├── llm-reasoning-engine.js
│   ├── camera-movement-system-v2.js
│   ├── camera-movement-system-v3.js
│   ├── duration-calculator.js
│   ├── shot-duration-allocator.js
│   └── ...
│
└── hyperreality-system/         # 超现实系统 (独立，可选)
    └── ...
```

---

## 四、一键安装步骤

### 4.1 方式一: 直接部署 (推荐)

```bash
# 1. 进入 OpenClaw workspace
cd ~/.openclaw/workspace

# 2. 创建目录结构
mkdir -p zhuoyue-system short-video-system systems

# 3. 解压代码包
# 将本 MD 文件中的代码分别提取到对应目录
# (详见第5节 "代码提取方法")

# 4. 安装依赖
cd zhuoyue-system
npm init -y
npm install node-fetch@2 form-data

cd ../short-video-system
npm init -y
npm install node-fetch@2 form-data

# 5. 配置环境变量
export VOLCENGINE_ARK_API_KEY="your-api-key"
export SEEDANCE_API_KEY="your-api-key"

# 6. 验证安装
node zhuoyue-system/run.js
node short-video-system/short-video-engine.js
```

### 4.2 方式二: OpenClaw 插件安装

将以下配置添加到 `~/.openclaw/config.json`：

```json
{
  "skills": {
    "zhuoyue-system": {
      "enabled": true,
      "path": "./workspace/zhuoyue-system",
      "entry": "run.js"
    },
    "short-video-system": {
      "enabled": true,
      "path": "./workspace/short-video-system",
      "entry": "short-video-engine.js"
    }
  }
}
```

重启 OpenClaw：
```bash
openclaw gateway restart
```

---

## 五、代码提取方法

本安装包将所有代码文件内嵌在 Markdown 中，格式如下：

```markdown
### FILE: 卓越视频制作系统 (zhuoyue-system)/config/llm-policy.js

```javascript
// 代码内容
```
```

### 5.1 自动提取脚本

创建 `extract-code.js`：

```javascript
const fs = require('fs');
const path = require('path');

const mdFile = process.argv[2] || 'zhuoyue-shortvideo-systems-complete.md';
const baseDir = process.argv[3] || './workspace';

const content = fs.readFileSync(mdFile, 'utf-8');

// 解析 FILE: 标记
const fileRegex = /### FILE: ([^\n]+)\n+```(\w+)\n([\s\S]*?)```/g;

let match;
let count = 0;

while ((match = fileRegex.exec(content)) !== null) {
  const fullPath = match[1].trim();
  const lang = match[2];
  const code = match[3];

  // 解析路径: "系统名/相对路径"
  const parts = fullPath.split('/');
  const systemName = parts[0]; // e.g. "卓越视频制作系统 (zhuoyue-system)"

  // 提取目录名
  let dirName = '';
  if (systemName.includes('zhuoyue')) dirName = 'zhuoyue-system';
  else if (systemName.includes('short-video') || systemName.includes('作业')) dirName = 'short-video-system';
  else if (systemName.includes('systems') || systemName.includes('共享')) dirName = 'systems';

  if (!dirName) continue;

  // 构建目标路径
  const relPath = parts.slice(1).join('/');
  const targetPath = path.join(baseDir, dirName, relPath);

  // 创建目录
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  // 写入文件
  fs.writeFileSync(targetPath, code);
  count++;
  console.log(`✅ ${targetPath}`);
}

console.log(`\n共提取 ${count} 个文件`);
```

运行提取：
```bash
node extract-code.js zhuoyue-shortvideo-systems-complete.md ~/.openclaw/workspace
```

### 5.2 手动提取 (备选)

如自动提取失败，可手动复制每个代码块到对应路径：
- `zhuoyue-system/` 下的文件 → `~/.openclaw/workspace/zhuoyue-system/`
- `short-video-system/` 下的文件 → `~/.openclaw/workspace/short-video-system/`
- `systems/` 下的文件 → `~/.openclaw/workspace/systems/`

---

## 六、系统配置

### 6.1 卓越系统配置

编辑 `zhuoyue-system/config/system-manifest.json`：

```json
{
  "name": "卓越视频制作系统",
  "version": "v6.6.4",
  "llm": {
    "model": "kimi-k2p6",
    "temperature": 1,
    "top_p": 0.95,
    "maxTokens": 32000
  },
  "rendering": {
    "engine": "seedance-2.0",
    "maxConcurrent": 3,
    "maxPromptLength": 1500
  }
}
```

### 6.2 作业系统配置

编辑 `short-video-system/config.json`（如存在）或修改引擎文件中的配置项。

### 6.3 共享模块配置

确保 `systems/` 目录可被两个系统正确引用。检查引用路径：

```javascript
// zhuoyue-system 中的引用示例
const SYSTEMS_PATH = path.join(__dirname, '../../../systems');

// 应指向: ~/.openclaw/workspace/systems/
```

---

## 七、运行验证

### 7.1 卓越系统测试

```bash
cd ~/.openclaw/workspace/zhuoyue-system

# 运行预生产 (跳过渲染)
node run.js

# 预期输出:
# 🔥 [HyperrealitySystem v1.2.8] 开始创作
# ✅ 需求清单生成完成
# ✅ 剧本生成完成
# ✅ 制作完成
# 质量门: 通过
```

### 7.2 作业系统测试

```bash
cd ~/.openclaw/workspace/short-video-system

# 运行示例
node run-xiangxiang-maldives.js

# 预期输出:
# ShortVideoEngine 启动
# 预生产完成
```

---

## 八、常见问题

### Q1: `MODULE_NOT_FOUND` 错误
**解决**: 确认 `systems/` 目录与 `zhuoyue-system/` 的相对路径正确。

```bash
# 检查路径
cd ~/.openclaw/workspace/zhuoyue-system
node -e "console.log(require('path').join(__dirname, '../../../systems'))"
# 应输出: /home/xxx/.openclaw/workspace/systems
```

### Q2: API 密钥未找到
**解决**: 设置环境变量或编辑配置文件。

```bash
export VOLCENGINE_ARK_API_KEY="your-key"
# 添加到 ~/.bashrc 使其永久生效
echo 'export VOLCENGINE_ARK_API_KEY="your-key"' >> ~/.bashrc
```

### Q3: LLM 调用超时
**解决**: 检查网络连接和 API 配额。

```bash
# 测试 API 连通性
curl -H "Authorization: Bearer $VOLCENGINE_ARK_API_KEY" \
  https://ark.cn-beijing.volces.com/api/v3/models
```

---

## 九、系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    OpenClaw 环境                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │  卓越系统入口    │    │  作业系统入口    │            │
│  │  zhuoyue-system │    │ short-video-sys │            │
│  │  run.js         │    │ short-video-eng │            │
│  └────────┬────────┘    └────────┬────────┘            │
│           │                      │                      │
│           ▼                      ▼                      │
│  ┌─────────────────────────────────────┐               │
│  │         共享系统模块 systems/         │               │
│  │  • llm-reasoning-engine.js          │               │
│  │  • camera-movement-system-v2.js     │               │
│  │  • duration-calculator.js           │               │
│  │  • ...                              │               │
│  └─────────────────────────────────────┘               │
│           │                      │                      │
│           ▼                      ▼                      │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │  火山引擎 Ark     │    │  Seedance 渲染  │            │
│  │  (LLM推理)       │    │  (视频生成)      │            │
│  └─────────────────┘    └─────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

---

## 十、版本信息

| 组件 | 版本 | 最后更新 |
|------|------|----------|
| 卓越系统 | v6.6.4 | 2026-06-19 |
| 作业系统 | v0.7.3+ | 2026-06-19 |
| 共享模块 | v1.2.8 | 2026-06-19 |
| 超现实系统 | v1.2.8 | 2026-06-19 |

---

## 十一、支持

- **代码仓库**: github.com:geniusdapeng-collab/hyperreal.git
- **文档**: /root/.openclaw/workspace/docs/
- **问题反馈**: 联系 OpenClaw 管理员

---

*本指南生成时间: 2026-06-19*
