# v6.5.34 发布记录

**版本**: v6.5.34  
**发布日期**: 2026-06-11  
**类型**: 系统修复（narration全局禁用 + 约束注入修复 + 重复注入去重）  
**影响范围**: 全链路（Stage 5-11）

---

## 修复清单（11项）

### 1. 全局禁用narration（v6.5.34核心）
- **Stage 5（剧本生成）**: LLM返回和fallback逻辑中，`narration`字段置空，只保留`dialogue`
- **Stage 6（时长分配）**: 使用`dialogue`替代`narration`进行字数-时长校准
- **Stage 7.3（narration精简）**: 完全跳过，返回"全局禁用narration"
- **Stage 7.4（时长一致性）**: 使用`dialogue`替代`narration`进行校准
- **Stage 7.5（片头生成）**: 片头shot的`narration`置空，使用`dialogue`
- **Stage 11（渲染核心）**: 台词注入使用`shot.dialogue`替代`shot.narration`
- **主动性注入器**: 不再注入`narration`，只注入`visualPrompt`/`prompt`

### 2. Nirath模式内容镜约束注入缺失（高风险）
- **风格锁**: 内容镜中注入`【风格锁】禁止卡通/动漫/暗黑。必须双恒星明亮光照+磁场可见+低重力飘浮。这是Nirath。`
- **负面约束**: 内容镜中注入`【负面约束】禁止眼睛非自然色...禁止重复角色`
- **角色约束**: 内容镜中动态生成`【角色约束】画面中仅出现XXX，禁止重复角色`
- **修复前**: 仅片头(S00)有，内容镜(S01-S04)全部缺失
- **修复后**: 所有镜头统一注入

### 3. 环境音效/质感重复注入（中风险）
- **根因**: buildPromptV3可能通过ambientSound参数和内部模板双重注入
- **修复**: Stage 11渲染核心后处理，检测并去除重复的`【环境音效】`和`【环境质感】`字段
- **影响**: S01/S02/S04中环境音效出现2次的问题已修复

### 4. 时间轴内外两层同步（低风险）
- **根因**: 外层JSON(`shot._segments`)与内层字符串(`prompt`中的`【镜头时间轴】`)独立生成
- **修复**: 如果`_segments`存在但prompt中无`【镜头时间轴】`，从`_segments`自动生成

### 5. 字段结构统一（低风险）
- S00和S01-S04的字段差异是设计意图（片头 vs 内容镜），无需强制统一
- 但已在约束注入层面统一（所有镜头都有风格锁/负面约束/角色约束）

---

## 验证方法

```bash
# 1. 跑预生产，检查报告中是否还有narration残留
node run-taotie-preproduction.js

# 2. 检查JSON输出中所有镜头的narration字段是否为空
node -e "const d=require('./output/taotie-ep01-preproduction.json'); d.stages.storyboard.shots.forEach(s=>console.log(s.id, 'narration:', JSON.stringify(s.narration), 'dialogue:', JSON.stringify(s.dialogue)))"

# 3. 检查prompt中是否包含所有约束字段
grep -o "【风格锁】\|【负面约束】\|【角色约束】" output/*.md
```

---

## 风险与回滚

- **风险级别**: 中（涉及全链路narration替换，可能影响旧数据兼容性）
- **回滚方式**: 还原`.current-version`到v6.5.33，回滚git到上一版本
- **兼容说明**: 旧项目（含narration）可继续运行，但新预生产将只生成dialogue

---

## 提交记录

```
v6.5.34 - 系统修复：全局禁用narration，内容镜约束注入，重复注入去重
- 修复主动性注入器不再污染narration
- 修复Stage 5/6/7/11全链路narration→dialogue
- 修复Nirath内容镜缺失风格锁/负面约束/角色约束
- 修复环境音效/质感重复注入
- 修复时间轴内外两层同步
```
