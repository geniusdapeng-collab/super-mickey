# 镜头时长分配Agent 设计文档

## 核心理念

**不是拆分镜头，是"额度分配"：**
- 总时长预算固定（如60秒）
- 内容总量固定（narration列表）
- 系统智能决定：切多少镜 + 每镜多少秒

---

## 链路位置

```
【上游】剧本创作 Agent
  ↓ 输出：script.json
     { narrations: [{id, text, type, priority}] }
     
【新增】镜头时长分配 Agent ⭐
  ↓ 输入：script.json + 总时长预算
  ↓ 处理：内容→镜头→时长分配
  ↓ 输出：storyboard-draft.json
     { shots: [{id, narration, duration, type}] }
     
【下游】故事板设计
  ↓ 输入：storyboard-draft.json
  ↓ 补充：prompt、characters、mouth_action等
  ↓ 输出：storyboard-v7.json
     
【下游】验证器 + 渲染
```

**位置说明：**
- 在剧本创作之后，故事板设计之前
- 负责把"内容"翻译成"镜头+时长"
- 故事板设计只需要关注画面内容，不用操心时长分配

---

## Agent 架构

### 模块名：`shot-duration-allocator.js`

### 输入
```json
{
  "totalDuration": 60,
  "narrations": [
    {
      "id": "N01",
      "text": "大家好，今天讲解横纹肌溶解。",
      "type": "host",
      "priority": 1,
      "minDuration": 3,
      "mustAlone": false
    }
  ],
  "constraints": {
    "minDuration": 3,
    "maxDuration": 5,
    "maxShots": 15,
    "speedMap": {
      "host": 4.0,
      "explanation": 4.5,
      "interaction": 5.0
    }
  }
}
```

### 输出
```json
{
  "shots": [
    {
      "id": "S01",
      "narrationIds": ["N01"],
      "narration": "大家好，今天讲解横纹肌溶解。",
      "type": "host",
      "duration": 4,
      "charCount": 12,
      "speed": 4.0
    }
  ],
  "summary": {
    "totalShots": 12,
    "totalAllocated": 58,
    "remaining": 2,
    "averageDuration": 4.8
  }
}
```

---

## 核心算法

### 阶段1：计算基础时长
```
每句narration的基础时长 = ceil(字数 / 语速 + 0.5秒缓冲)
总基础时长 = sum(每句基础时长)
```

### 阶段2：检查预算
```
if 总基础时长 > 总时长预算:
  ⚠️ 内容超载！
  策略：
  1. 精简低优先级内容
  2. 提高语速（减少缓冲时间）
  3. 建议增加总时长
  
if 总基础时长 < 总时长预算:
  ✅ 有剩余额度
  策略：分配余量给高优先级镜头
```

### 阶段3：智能分组（相邻内容合并）
```
分组规则：
1. 同类型内容优先合并（讲解+讲解）
2. 互动内容必须独立（AgentX提问=单独一镜）
3. 开场白和结尾必须独立
4. 一个镜头最多合并3句narration
5. 合并后时长不超过maxDuration

合并算法：
- 遍历narrations
- 如果当前句与上一句同类型，且合并后时长≤maxDuration → 合并
- 否则 → 新开一镜
```

### 阶段4：时长分配
```
分配策略：
1. 基础时长：字数/语速（刚性需求）
2. 余量分配：
   - 开场白 +1秒（吸引注意力）
   - 重点内容 +1秒（需要强调）
   - 互动镜头 +0.5秒（反应时间）
3. 约束检查：
   - 每镜 ≥ minDuration
   - 每镜 ≤ maxDuration
   - 总镜数 ≤ maxShots
```

### 阶段5：优化调整
```
调整规则：
1. 如果总时长 > 预算：从低优先级镜头减1秒
2. 如果总时长 < 预算：给高优先级镜头加1秒
3. 确保所有时长为整数秒（API要求）
```

---

## 与上下游的数据交互

### 上游（剧本创作）→ 分配Agent
```json
// script.json
{
  "title": "横纹肌溶解科普EP01",
  "totalDuration": 60,
  "narrations": [
    {
      "id": "N01",
      "text": "AI主播小陈，继续给大家讲解健康科普知识。今天我们来聊聊一个和运动密切相关的健康问题——横纹肌溶解。",
      "type": "host",
      "priority": 1,
      "notes": "开场白，必须完整"
    },
    {
      "id": "N02",
      "text": "横纹肌溶解，简单来说，就是我们的肌肉细胞发生了破裂。",
      "type": "explanation",
      "priority": 2
    },
    {
      "id": "N03",
      "text": "肌肉里的蛋白质和有害物质，漏到了血液里。",
      "type": "explanation",
      "priority": 2
    }
  ]
}
```

### 分配Agent → 下游（故事板设计）
```json
// storyboard-draft.json
{
  "project": "rhabdomyolysis-ep01-new",
  "version": "v7",
  "totalDuration": 60,
  "shots": [
    {
      "id": "S01",
      "narrationIds": ["N01"],
      "narration": "AI主播小陈，继续给大家讲解健康科普知识。今天我们来聊聊一个和运动密切相关的健康问题——横纹肌溶解。",
      "type": "host",
      "duration": 5,
      "notes": "开场白，高优先级，分配5秒"
    },
    {
      "id": "S02",
      "narrationIds": ["N02", "N03"],
      "narration": "横纹肌溶解，简单来说，就是我们的肌肉细胞发生了破裂。肌肉里的蛋白质和有害物质，漏到了血液里。",
      "type": "explanation",
      "duration": 5,
      "notes": "两句解释合并，共5秒"
    }
  ]
}
```

---

## 异常处理

### 情况1：内容超载（总基础时长 > 预算）
```
错误：内容超载！需要120秒，但只有60秒预算

策略1：精简内容
- 删减低优先级narration
- 缩短每句字数

策略2：加速语速  
- 将语速从4.5提高到5.5字/秒
- 减少缓冲时间从0.5到0.2秒

策略3：增加总时长
- 建议用户：需要120秒内容，建议总时长调整为120秒
```

### 情况2：镜头过多（分组后 > maxShots）
```
错误：需要20镜，但maxShots=15

策略：合并更多内容
- 放宽合并规则：允许不同类型合并
- 增加每镜最大合并数：从3句到5句
```

### 情况3：某镜时长超限（合并后 > maxDuration）
```
错误：S03合并后需要7秒，但maxDuration=5

策略：拆分该镜
- 将超长的合并组拆分成2镜
- 确保每镜 ≤ maxDuration
```

---

## API设计

### 类定义
```javascript
class ShotDurationAllocator {
  constructor(config = {}) {
    this.config = {
      minDuration: 3,
      maxDuration: 5,
      maxShots: 15,
      bufferSeconds: 0.5,
      speedMap: {
        'host': 4.0,
        'explanation': 4.5,
        'interaction': 5.0,
        'symptom': 4.5,
        'lab': 4.5,
        'summary': 4.0
      }
    };
  }

  /**
   * 主入口：分配镜头时长
   * @param {Object} script - 剧本数据
   * @returns {Object} 故事板草案
   */
  allocate(script) {}

  /**
   * 计算基础时长
   */
  calculateBaseDuration(narration, type) {}

  /**
   * 智能分组
   */
  groupNarrations(narrations) {}

  /**
   * 分配余量
   */
  allocateRemaining(shots, totalDuration) {}

  /**
   * 验证结果
   */
  validate(shots, constraints) {}
}
```

---

## 使用示例

```javascript
const { ShotDurationAllocator } = require('./systems/shot-duration-allocator');

// 读取剧本
const script = JSON.parse(fs.readFileSync('script.json'));

// 分配时长
const allocator = new ShotDurationAllocator();
const storyboardDraft = allocator.allocate(script);

// 保存故事板草案
fs.writeFileSync('storyboard-draft.json', JSON.stringify(storyboardDraft, null, 2));

// 输出报告
console.log(`总镜头: ${storyboardDraft.summary.totalShots}`);
console.log(`总时长: ${storyboardDraft.summary.totalAllocated}秒`);
console.log(`平均每镜: ${storyboardDraft.summary.averageDuration}秒`);
```

---

## 集成到现有链路

### 修改 storyboard-generator.js
```javascript
const { ShotDurationAllocator } = require('../systems/shot-duration-allocator');

async function generateStoryboard(script) {
  // 1. 分配镜头时长
  const allocator = new ShotDurationAllocator();
  const draft = allocator.allocate(script);
  
  // 2. 生成完整故事板
  const storyboard = {
    project: script.title,
    version: 'v7',
    shots: draft.shots.map(shot => ({
      ...shot,
      prompt: '', // 待设计师补充
      characters: [], // 待设计师补充
      mouth_action: '' // 待设计师补充
    }))
  };
  
  return storyboard;
}
```

---

## 下一步工作

1. **实现 shot-duration-allocator.js**（核心算法）
2. **修改 render-v2.js** - 读取 storyboard 中的 duration 字段
3. **更新 storyboard-validator.js** - 验证 narration 与 duration 匹配
4. **编写测试用例** - 测试各种边界情况
5. **集成到 Mock测试** - 确保链路完整

---

**设计完成！等待队长确认后实现！** 🚀
