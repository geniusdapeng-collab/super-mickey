# 专家审计报告剩余问题修复清单

## 修复进度

| 级别 | 总数 | 已修复 | 待修复 |
|------|------|--------|--------|
| P0 | 21 | 21 | 0 ✅ |
| P1 | 35 | 17 | 18 |
| P2 | 10 | 0 | 10 |
| P3 | 6 | 0 | 6 (建议级) |
| **合计** | **72** | **38** | **34** |

## 待修复P1问题（14个）

### 架构层（4个）
- [ ] P1-ARCH-05: updateAgentConfig并发不安全 — 需原子操作或Config锁
- [ ] P1-ARCH-06: 降级丢失上游内容 — 保留原始fields，仅补齐缺失
- [ ] P1-ARCH-07: shot._blueprint内存泄漏 — 使用WeakRef或finalize清理
- [ ] P1-ARCH-09: 检查点恢复状态编号不一致 — phase名称与stage索引严格映射

### 数据流层（4个）
- [ ] P1-DATA-01: timeline格式不一致 — 统一为对象数组格式
- [ ] P1-DATA-02: 数据冗余fields+顶层字段重复 — 统一使用fields对象
- [ ] P1-DATA-03: maxTokens固定32000不足 — 动态计算
- [ ] P1-DATA-04: 身份匹配硬编码截断 — token-aware截断替代固定字符数

### 性能层（2个）
- [ ] P1-PERF-03: Logger阻塞事件循环 — 改为异步批量写入
- [ ] P1-PERF-05: deadline过长40分钟 — 并行化后可降至20分钟

### 数据流层（4个）
- [ ] P1-DATA-01: timeline格式不一致 — 统一为对象数组格式
- [ ] P1-DATA-02: 数据冗余fields+顶层字段重复 — 统一使用fields对象
- [ ] P1-DATA-03: maxTokens固定32000不足 — 动态计算
- [ ] P1-DATA-04: 身份匹配硬编码截断 — token-aware截断替代固定字符数

### 性能层（4个）
- [ ] P1-PERF-01: VL∥AD未并行 — Promise.all并行执行
- [ ] P1-PERF-02: 动态预算缺陷 — 剩余<5s直接降级，不尝试LLM
- [ ] P1-PERF-03: Logger阻塞事件循环 — 改为异步批量写入
- [ ] P1-PERF-05: deadline过长40分钟 — 并行化后可降至20分钟

## 已修复P1问题（21个）
✅ P1-ARCH-01, P1-ARCH-03, P1-ARCH-04, P1-ARCH-10, P1-QUAL-01, P1-QUAL-02, P1-QUAL-03, P1-QUAL-04, P1-QUAL-05, P1-QUAL-06, P1-DATA-05, P1-DATA-06, P1-PERF-04, P1-PROMPT-01~08

## 待修复P2问题（10个）

### 提示词引擎（4个）
- [ ] P2-PROMPT-01: promptBase字符数未校验 — 生成后校验，超长触发压缩
- [ ] P2-PROMPT-02: fallback场景模板选择简单轮询 — 基于场景类型选择最匹配模板
- [ ] P2-PROMPT-03: 语言检查只做警告不做修正 — 自动将英文关键词翻译为中文
- [ ] P2-PROMPT-04: 字段最小长度校验过于严格 — 空景镜头允许makeup为空字符串

### 质量保障（3个）
- [ ] P2-QUAL-01: ShotQualityEnhancer阈值固定 — 根据场景类型动态调整
- [ ] P2-QUAL-02: ErrorCodes缺少上下文错误码 — 增加AGENT_SPECIFIC错误码段
- [ ] P2-QUAL-03: 错误码与HTTP状态码映射不完整 — 补充401→AUTH, 429→RATE_LIMIT等

### 性能层（2个）
- [ ] P2-PERF-01: timeout缓存未清理 — 添加TTL缓存清理机制
- [ ] P2-PERF-02: truncate批量处理可优化 — 按字段重要性加权压缩

---

## 修复计划

按模块分组，每修复一组立即提交并推送：

1. **批次1**: P1-ARCH-10 + P1-QUAL-04 (错误分类/ProcessGuard) → commit v2.1.8-fix21
2. **批次2**: P1-DATA-01~05 (数据流5个) → commit v2.1.8-fix22
3. **批次3**: P1-ARCH-02 + P1-PERF-01 + P1-PERF-02 (并行化+预算) → commit v2.1.8-fix23
4. **批次4**: P1-ARCH-04~09 (架构6个) → commit v2.1.8-fix24
5. **批次5**: P1-PERF-03 + P1-PERF-05 (Logger+deadline) → commit v2.1.8-fix25
6. **批次6**: P2全部10个问题 → commit v2.1.8-fix26

