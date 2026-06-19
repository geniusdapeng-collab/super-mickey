# 需求清单质量稳定化方案
> 目标：确保每次输出的《视频需求要点清单》都达到 v2 详细版水准
> 系统：超现实系统 v2.0.0+

---

## 一、问题根因分析

### 为什么会出现"质量滑坡"？

| 问题 | 根因 | 影响 |
|------|------|------|
| 清单内容简略 | 无标准化模板，凭感觉输出 | 质量不稳定 |
| 字段缺失 | 无检查清单，容易遗漏 | 下游返工 |
| 格式不统一 | 无规范约束，每次格式不同 | 阅读体验差 |
| 内容边界不清 | 无明确的内容边界定义 | 集与集之间重复或遗漏 |

### 高质量清单的关键要素（v2 详细版）

1. **完整性**：9大模块全覆盖（基础信息/内容结构/视觉风格/角色设定/情绪曲线/技术要求/质量审核/风险提示/确认事项）
2. **具体性**：每个字段都有明确值，不模糊
3. **可操作性**：下游能直接拿来用，无需二次确认
4. **边界清晰**：明确什么包含、什么不包含
5. **视觉化**：表格、曲线图、结构化呈现

---

## 二、系统化解决方案

### 方案核心："模板+校验+记忆"三位一体

```
用户输入 → 解析提取 → 模板填充 → 自动校验 → 输出清单 → 记忆归档
                ↑___________________________________________|
                        （反馈循环，持续优化模板）
```

---

### 2.1 第一层：标准化模板（Template System）

**目标**：将高质量清单的结构固化为强制模板

**实施方式**：

#### A. 创建需求清单模板文件

```
hyperreality-system/
└── templates/
    └── requirement-list-template.md    # 需求清单标准模板
```

**模板结构（强制）**：

```markdown
# 📋 视频需求要点清单

## 一、基础信息（必填）
| 字段 | 值 | 说明 |

## 二、内容边界（必填）
### 2.1 内容范围表
| 范围 | 包含 | 不包含 |
### 2.2 预计镜头结构
| 镜头 | 时长 | 内容 | 情绪 | 景别 |

## 三、视觉风格规范（必填）
### 3.1 整体视觉方向
### 3.2 分镜视觉参考

## 四、角色设定（如有人物）
### 4.1 角色卡片
### 4.2 角色一致性要求

## 五、情绪曲线设计（必填）
```ASCII曲线图```

## 六、制作技术要求（必填）
### 6.1 Prompt规范（L1-L9）
### 6.2 输出标准

## 七、质量审核标准（必填）
### 7.1 必须检查项
### 7.2 质量门阈值

## 八、风险提示（必填）
| 风险 | 影响 | 应对措施 |

## 九、确认事项（必填）
| # | 事项 | 状态 |
```

#### B. 模板引擎自动填充

创建 `scripts/generate-requirement-list.js`：

```javascript
// 根据用户输入自动填充模板
// 1. 解析用户输入（主题/时长/风格/角色等）
// 2. 基于专业经验推断补全字段
// 3. 按模板结构输出
// 4. 自动校验完整性
```

**核心逻辑**：
- **提取**：从用户输入中提取所有明确信息
- **推断**：基于专业经验补全缺失字段（如：提到"科普视频"→推断目标受众为"普通居民"）
- **结构化**：按模板强制结构输出
- **自检**：输出前检查每个必填模块是否存在

---

### 2.2 第二层：自动校验机制（Validation System）

**目标**：输出前自动检查清单质量，不通过不放行

**校验规则**：

| 校验项 | 规则 | 失败处理 |
|--------|------|---------|
| **模块完整性** | 9大模块必须全部存在 | 自动补全缺失模块 |
| **字段非空** | 基础信息表每个字段必须有值 | 标记为"待确认" |
| **时长合规** | 总时长在目标范围内 | 标红提示 |
| **内容边界** | 必须明确"包含/不包含" | 自动添加边界表 |
| **情绪曲线** | 必须有情绪起伏，不能单调 | 提示优化 |
| **角色一致性** | 如有角色，必须有角色卡片 | 自动创建默认卡片 |
| **质量审核项** | 至少5项必检 | 自动补全标准检查项 |
| **风险提示** | 至少3项风险 | 自动添加常见风险 |

**校验脚本**：`scripts/validate-requirement-list.js`

```javascript
function validateRequirementList(content) {
  const issues = [];
  
  // 检查9大模块
  const requiredSections = ['基础信息', '内容边界', '视觉风格', '角色设定', '情绪曲线', '技术要求', '质量审核', '风险提示', '确认事项'];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      issues.push({ type: 'MISSING_SECTION', section });
    }
  }
  
  // 检查内容边界表
  if (!content.includes('包含') || !content.includes('不包含')) {
    issues.push({ type: 'MISSING_BOUNDARY', message: '缺少内容边界定义' });
  }
  
  // 检查镜头结构
  if (!content.match(/S\d{2}/)) {
    issues.push({ type: 'MISSING_SHOT_STRUCTURE', message: '缺少镜头结构' });
  }
  
  // ... 其他检查
  
  return {
    valid: issues.length === 0,
    issues,
    grade: issues.length === 0 ? 'A' : issues.length <= 2 ? 'B' : 'C'
  };
}
```

---

### 2.3 第三层：记忆与反馈循环（Memory System）

**目标**：记住每次清单的好坏，持续优化

**实施方式**：

#### A. 清单质量档案

```
memory/
└── requirement-list-history/
    ├── 2026-06-19-ep02-v1.md     # 潦草版（差评）
    ├── 2026-06-19-ep02-v2.md     # 详细版（好评）
    └── quality-log.json           # 质量评分记录
```

**quality-log.json**：
```json
{
  "entries": [
    {
      "date": "2026-06-19",
      "project": "横纹肌溶解-ep02",
      "version": "v1",
      "grade": "C",
      "feedback": "潦草，寥寥几行",
      "improvements": ["补充完整9大模块", "添加镜头结构表", "添加情绪曲线", "添加内容边界"]
    },
    {
      "date": "2026-06-19",
      "project": "横纹肌溶解-ep02",
      "version": "v2",
      "grade": "A",
      "feedback": "质量不错",
      "strengths": ["9大模块完整", "镜头结构清晰", "情绪曲线直观", "内容边界明确"]
    }
  ]
}
```

#### B. 正向强化机制

每次输出清单时：
1. 读取 `quality-log.json` 中高分案例（A级）
2. 提取高分案例的"优点特征"
3. 在当前输出中强制应用这些特征

#### C. 负向规避机制

每次输出清单时：
1. 读取 `quality-log.json` 中低分案例（C级）
2. 提取低分案例的"问题特征"
3. 在当前输出中主动检查并规避

---

## 三、流程改造

### 改造后的需求清单生成流程

```
用户输入（一句话/简单描述）
    ↓
[Step 1] 解析提取（提取所有明确信息）
    ↓
[Step 2] 推断补全（基于专业经验补全所有字段）
    ↓
[Step 3] 模板填充（按标准模板结构化输出）
    ↓
[Step 4] 自动校验（校验完整性/合规性/质量）
    ↓
[Step 5] 质量评级（A/B/C级）
    ↓
  ├─ A级 → 直接输出给用户确认
  ├─ B级 → 自动修复问题后输出
  └─ C级 → 拒绝输出，重新生成
    ↓
[Step 6] 用户确认/反馈
    ↓
[Step 7] 归档记忆（记录质量评分和反馈）
    ↓
锁定需求，进入预生产
```

---

## 四、技术实现

### 4.1 新增文件

| 文件 | 说明 |
|------|------|
| `templates/requirement-list-template.md` | 需求清单标准模板 |
| `scripts/generate-requirement-list.js` | 清单生成引擎 |
| `scripts/validate-requirement-list.js` | 清单校验引擎 |
| `memory/requirement-list-history/` | 质量档案目录 |

### 4.2 改造文件

| 文件 | 改动 |
|------|------|
| `SOUL.md` | 添加"需求清单质量规范"到系统规则 |
| `AGENTS.md` | 添加清单生成流程到工作规范 |

### 4.3 关键代码

**清单生成引擎核心逻辑**：

```javascript
// scripts/generate-requirement-list.js

class RequirementListGenerator {
  constructor() {
    this.template = loadTemplate('requirement-list-template.md');
    this.qualityLog = loadQualityLog();
  }

  async generate(userInput) {
    // Step 1: 解析提取
    const extracted = this.extractFromInput(userInput);
    
    // Step 2: 推断补全
    const inferred = this.inferMissingFields(extracted);
    
    // Step 3: 模板填充
    let content = this.fillTemplate(this.template, inferred);
    
    // Step 4: 自动校验
    const validation = validateRequirementList(content);
    
    // Step 5: 质量修复
    if (validation.grade !== 'A') {
      content = this.autoFix(content, validation.issues);
    }
    
    return {
      content,
      grade: validation.grade,
      issues: validation.issues
    };
  }

  inferMissingFields(extracted) {
    // 基于专业经验推断
    const inferences = {
      // 如果用户说"科普视频"，推断受众为普通居民
      targetAudience: extracted.type === '科普视频' ? '普通居民' : '待定',
      
      // 如果用户说"全写实"，推断风格参数
      styleParams: extracted.style === '全写实' ? { realism: 1.0, cartoon: 0 } : null,
      
      // 如果用户说"59-65秒"，推断镜头数为5-7个
      estimatedShots: this.inferShotCount(extracted.duration),
      
      // 推断情绪曲线（基于内容类型）
      emotionalCurve: this.inferEmotionalCurve(extracted.topic),
      
      // 更多推断...
    };
    
    return { ...extracted, ...inferences };
  }
  
  autoFix(content, issues) {
    // 自动修复常见问题
    for (const issue of issues) {
      switch (issue.type) {
        case 'MISSING_SECTION':
          content += this.generateSection(issue.section);
          break;
        case 'MISSING_BOUNDARY':
          content += this.generateBoundaryTable();
          break;
        case 'MISSING_SHOT_STRUCTURE':
          content += this.generateShotStructure();
          break;
      }
    }
    return content;
  }
}
```

---

## 五、质量等级定义

| 等级 | 标准 | 处理 |
|------|------|------|
| **A** | 9大模块完整，字段具体，边界清晰，有镜头结构，有情绪曲线 | 直接输出 |
| **B** | 7-8个模块，少量字段模糊，缺1-2个辅助项 | 自动修复后输出 |
| **C** | 模块缺失严重，字段大量模糊，缺核心内容 | 拒绝输出，重新生成 |

---

## 六、预期效果

### 实施前（人工输出）
- 质量不稳定：有时详细，有时潦草
- 依赖个人状态：疲劳时质量下降
- 容易遗漏：忘记检查某些字段

### 实施后（系统化输出）
- 质量稳定：每次都达到A级标准
- 不受状态影响：模板+校验强制质量
- 零遗漏：9大模块强制覆盖

---

## 七、实施计划

| 阶段 | 任务 | 预计时间 | 优先级 |
|------|------|---------|--------|
| **P0** | 创建标准模板文件 | 30分钟 | 🔥 |
| **P0** | 实现清单校验脚本 | 1小时 | 🔥 |
| **P1** | 实现清单生成引擎（基础版） | 2小时 | |
| **P1** | 创建质量档案系统 | 30分钟 | |
| **P2** | 集成到预生产入口（run.js） | 1小时 | |
| **P2** | 添加历史案例学习 | 1小时 | |

**总计**：约6小时，可分2-3次完成。

---

## 八、即时措施（今晚可用）

在系统实现前，采取以下**人工检查清单**确保质量：

```markdown
## 需求清单自检表（输出前必做）

- [ ] 基础信息表完整（类型/时长/画幅/风格/角色/创意指数）
- [ ] 内容边界明确（包含/不包含表）
- [ ] 镜头结构预估（至少5镜，含时长/内容/情绪）
- [ ] 情绪曲线设计（ASCII图或文字描述起伏）
- [ ] 视觉风格规范（场景/光线/运镜）
- [ ] 角色设定（如有角色，含卡片和一致性要求）
- [ ] Prompt规范（L1-L9说明）
- [ ] 质量审核标准（至少5项必检）
- [ ] 风险提示（至少3项）
- [ ] 确认事项（待队长确认项）

如果以上任何一项缺失，**不允许输出**。
```

---

**方案版本**：v1.0  
**提出时间**：2026-06-19  
**预期效果**：需求清单质量稳定在A级，零潦草输出  

---

> 队长，这是系统级解决方案。建议：
> 1. 今晚先启用"人工自检表"，确保下次输出不滑坡
> 2. 明天开始实施技术方案（模板+校验+记忆），一劳永逸
> 
> 您看如何？🫡
