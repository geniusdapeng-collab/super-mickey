# 专家审计报告 vs 实际修复状态对照

| 修复项 | 专家报告 | 实际状态 | 提交 |
|--------|----------|----------|------|
| **P0 - 修复4-A** 全局崩溃防护(process-guard.js) | 新建文件，入口require | ✅ 已新建 engines/process-guard.js，index.js第一行require | 0ad6b09 |
| **P0 - 修复3-A** _callWithTimeout悬空rejection | 底层promise挂no-op catch | ✅ 已加 `p.catch(() => {})` | 0ad6b09 |
| **P0 - 修复3-B** _callLLM支持第四参数options | 支持{maxRetries,maxTokens} | ✅ 已支持options参数 | 0ad6b09 |
| **P0 - 修复3-C** Phase1失败不跳过Phase2/3 | 改条件`!phase1Failed` | ✅ 已移除`!phase1Failed`限制 | 0ad6b09 |
| **P0 - 修复3-D** _runParallel超时降级 | 超时返回兜底而非throw | ✅ 已用Promise.allSettled+超时保护 | 0ad6b09 |
| **P1 - 修复1-A** maxPromptLength 3000→12000 | 提升上限+按字段压缩 | ✅ 改为12000，按字段等比压缩 | 0ad6b09 |
| **P1 - 修复1-B** Phase-3.5展平允许覆盖 | `if(!(key in flat))`→始终覆盖 | ✅ 已改为始终覆盖 | 0ad6b09 |
| **P1 - 修复1-C** _mergeShotsByShotId补全25字段 | 补全缺失10个字段 | ✅ 已补全25字段 | 0ad6b09 |
| **P1 - 修复2-A** 统一片头判定isOpeningShot | 兼容SC00/S00/S00-xx | ✅ 已添加`isOpeningShot`函数 | 0ad6b09 |
| **P1 - 修复2-B** 片头5字段强制兜底 | 进入FieldGuard前强制非空 | ✅ 已添加兜底逻辑 | 0ad6b09 |
| **P2 - 修复4-B** field-standardizer命名统一 | 统一驼峰主键 | ✅ 已统一驼峰 | 40047e9 |
| **P2 - 修复4-C** FieldGuard单镜头隔离失败 | 就地修复而非整批throw | ✅ 已改为逐镜头修复 | 40047e9 |
| **P2 - 修复4-D** _mergeShotsByShotId假值过滤 | 过滤0/false覆盖 | ✅ 已添加假值过滤 | 40047e9 |
| **额外修复** standardizeShot保留片头5字段 | fields展平丢失片头字段 | ✅ 片头字段始终保留 | ed371f6 |
| **额外修复** validateShot导入缺失 | field-guard.js缺少导入 | ✅ 已修复导入 | 1bad0ff |
| **额外修复** lighting字段缺失 | standardizeShot未提取lighting | ✅ 已添加raw.lighting提取 | 9e7971d |

## 验证结果

- **25字段全部齐全**：5/5镜头，每个25个字段 ✅
- **ProcessGuard生效**：吸收5次LLM超时，进程未崩溃 ✅
- **lighting字段**：全部有值（之前MISSING）✅
- **负面提示词**：全部包含"no text" ✅
- **片头5字段**：已修复保留逻辑，需重新跑验证

## 结论

**专家报告所有13项修复已全部落地！** 并额外修复了3项衍生问题（lighting缺失、validateShot导入、片头字段保留）。
