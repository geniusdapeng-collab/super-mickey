# ModuleRouterV1 设计草稿

## 问题背景
队长提出：链路上模块较多，经常发生调用错模块版本的情况。需要一个机制让各环节路由到正确的模块版本。

## 当前已做的隔离层
1. **物理隔离**：Nirath模块 → `systems/nirath/` 目录
2. **懒加载**：FinalPromptBuilderV3、SubsystemOrchestratorV2 用 null+getter
3. **模式判断**：部分模块通过 `this.mode === 'generic'` 跳过Nirath调用

## 问题
- 模块require分散在各文件中，没有统一入口
- 新增模块时容易忘记加模式判断
- 运行时才发现调错模块，不是启动时

## 设计方案

### 核心思路
统一模块注册中心 + 模式感知路由

```javascript
// core/module-router-v1.js
class ModuleRouterV1 {
  constructor(mode = 'generic') {
    this.mode = mode;
    this.registry = new Map();
    this.loadRegistry();
  }

  // 注册所有模块版本
  loadRegistry() {
    // 通用模块（所有模式都可用）
    this.register('OpeningSystem', {
      generic: '../systems/opening-system-v3.js',
      nirath: '../systems/nirath/opening-system-v3-nirath.js'
    });

    this.register('AmbientSoundDesigner', {
      generic: '../systems/ambient-sound-designer.js',
      nirath: '../systems/ambient-sound-designer.js' // 同一模块，内部按mode处理
    });

    // Nirath专属模块（generic模式禁用）
    this.register('CreativeLLMRouter', {
      nirath: '../systems/nirath/creative-llm-router-v1.js',
      generic: null // generic模式返回null或抛错
    });

    this.register('BeastEntranceAgent', {
      nirath: '../systems/nirath/beast-entrance-agent.js',
      generic: null
    });
  }

  register(name, paths) {
    this.registry.set(name, paths);
  }

  // 获取模块
  require(moduleName) {
    const paths = this.registry.get(moduleName);
    if (!paths) {
      throw new Error(`[ModuleRouter] 未注册模块: ${moduleName}`);
    }

    const path = paths[this.mode];
    if (path === null) {
      throw new Error(`[ModuleRouter] 模块"${moduleName}"在"${this.mode}"模式下不可用`);
    }

    if (!path) {
      throw new Error(`[ModuleRouter] 模块"${moduleName}"未定义"${this.mode}"模式路径`);
    }

    return require(path);
  }

  // 检查模块是否可用（不抛错）
  isAvailable(moduleName) {
    const paths = this.registry.get(moduleName);
    return paths && paths[this.mode] !== null;
  }
}

module.exports = ModuleRouterV1;
```

### 使用方式

```javascript
// nirath-master-pipeline.js
const ModuleRouter = require('./module-router-v1');

class NirathMasterPipeline {
  constructor(options) {
    this.mode = options.mode || 'generic';
    this.router = new ModuleRouter(this.mode);
    
    // 所有模块require都走路由
    this.OpeningSystem = this.router.require('OpeningSystem');
    this.AmbientSoundDesigner = this.router.require('AmbientSoundDesigner');
    
    // Nirath专属模块：generic模式会抛错，提前发现问题
    if (this.mode === 'nirath') {
      this.CreativeLLMRouter = this.router.require('CreativeLLMRouter');
    }
  }
}
```

### 安全机制

1. **启动时验证**：pipeline构造时验证所有模块路径存在
2. **模式错配拦截**：generic模式require Nirath模块 → 立即抛错
3. **缺失模块检测**：未注册的模块 → 抛错
4. **日志追踪**：记录每次模块加载的来源路径

### 迁移计划

1. **Phase 1**：创建ModuleRouterV1，注册当前所有模块
2. **Phase 2**：修改nirath-master-pipeline.js，使用router.require替代直接require
3. **Phase 3**：逐步迁移各子系统，统一使用router
4. **Phase 4**：添加启动时全链路验证

## 预期收益

- ✅ 统一入口：所有模块require走ModuleRouter
- ✅ 模式安全：generic模式无法加载Nirath模块
- ✅ 启动即知错：构造阶段就发现调错模块
- ✅ 新增模块标准化：新模块必须注册到router

## 待队长确认

1. 是否按此方案实施？
2. 优先级：ModuleRouter vs 剩余山海经残留清理？
3. 是否需要支持模块版本号（如OpeningSystem-v3 vs v4）？
