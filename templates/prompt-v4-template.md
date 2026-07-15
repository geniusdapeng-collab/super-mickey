// templates/prompt-v4-template.md
// Prompt v4.1 Template / 8步结构模板
// 不追求字符填满，追求信息完整、质量优先

# 精简渲染Prompt

## 8步结构（按重要性排序）

### 1. 主体与绑定（不可删除）
{character_anchor}

### 2. 主动作（不可删除）
{primary_action}

### 3. 表演或反应重点
{performance_focus}

### 4. 空间环境
{spatial_environment}

### 5. 镜头语言
{camera_language}

### 6. 光线与材质
{lighting_material}

### 7. 声音/对白（如有）
{sound_dialogue}

### 8. 收束锚点（不可删除）
{closing_anchor}

---

## 构建原则

1. **关键信息前置**：前80-120字必须包含主体+动作+核心意图
2. **一镜一主旨**：不允许一个镜头承载多个竞争事件
3. **正向表达优先**：描述想要什么，不堆叠不想要什么
4. **具象优先**：可执行词汇 > 形容词
5. **可见差异优先**：每一句对应可见变化
6. **少而准优于多而散**：聚焦 > 覆盖
7. **忠于场次策略**：单镜不得偏离Scene Card的光线/色彩/方向

---

## 长度控制

- **上限**：990字符（API硬性限制）
- **目标**：写清楚就停，不追求填满
- **简单动作镜**：300-500字符
- **标准叙事镜**：400-700字符
- **复杂Hero Shot**：600-900字符
- **超长时按优先级保留**：主体→动作→表演→空间→运镜→落幅→光线→声音

---

## 压缩优先级（当超长时）

```
1. 主体与绑定（不可删除）
2. 主动作（不可删除）
3. 表演目标（删除前需导演批准）
4. 空间关系（可简化但不可删除）
5. 运镜（可简化）
6. 落幅锚点（不可删除）
7. 光线/材质（可压缩为Light Tier代码）
8. 声音（可删除，由后期补充）
```

---

## 系统约束注入（自动）

- Nirath特征：{nirath_traits}
- 禁用元素：{forbidden_elements}
- 角色锚点：{character_bindings}
- 环境约束：{environment_constraints}

---

## 最终输出

```
{render_prompt}
```

**字符数**: {char_count} / 990
**质量评估**: {quality_assessment}
**压缩记录**: {compression_log}

---

*Prompt构建时间: {generation_time}*
*Scene Card: {scene_card_id}*
*Shot Card: {shot_card_id}*
