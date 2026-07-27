# legacy/ — 退役资产隔离区（v2.2.8 审计设立）

本目录收纳**不再是系统组成部分**的历史文件。规则：

- 本目录内任何文件**都不是规范、不是入口、不被活体链路加载**；
- 禁止从这里 `require` 任何模块；禁止把本目录文件当作现行格式依据；
- 保留目的仅为历史可追溯。要复活某个模块，先修复再把文件移回原位并接入测试。

## 隔离清单与原因

### systems/ —— 加载即崩或同名诱饵（原仓库根 systems/）

| 文件 | 隔离原因 |
|---|---|
| `field-guard.js` | 同名诱饵：与活体 `hyperreality-system/engines/field-guard.js` 同导出一个 `FieldGuard` 类，但内容停留在 v6.7.0 旧实现，无任何活体引用 |
| `pipeline-integrity-validator.js` | 仅一行 re-export 指向曾崩坏的同名模块（加载即 `MODULE_NOT_FOUND`），无活体引用 |
| `field-quality-pipeline.js` | 同名诱饵：引用不存在的 `./field-check/`、`./field-repair/` 目录，加载即崩；活体在 `hyperreality-system/engines/field-quality/` |
| `async-director-agent.js` | 引用不存在的 `director-final-review.js`、`director-screenwriter-loop.js`，加载即崩 |
| `final-prompt-pipeline-example.js` | 示例文件，引用不存在的 `final-prompt-builder-v1`、`prompt-validator-v1` |
| `main-pipeline-hook-example.js` | 示例文件，引用不存在的 `pipeline-integration-patch-v1`、`system-health-check-v1` |
| `pre-render-validation.js` | 引用不存在的 `fpv-experience-integration.js` |
| `prompt-pipeline-bridge.js` | 引用不存在的 `prompt-standardizer`、`prompt-standard-v3` |
| `quality-reporter.js` | 引用不存在的根级 `config/quality-dimensions`（config 只在 hyperreality-system 下） |
| `render-request-builder.js` / `render-submitter.js` | 引用不存在的根级 `config/render-policy`；二者互为引用但与主链路无连接 |
| `shanhai-one-shot-templates.js` | 引用不存在的 `fpv-experience-library.js` |
| `storyboard-validator.js` | 引用不存在的 `camera-movement-system-v2.js`、`five-element-inspector` |
| `render-engines/render-pipeline-universal.js` | 引用不存在的 `../character-manager.js` |
| `debug-director.js` | 依赖已隔离的 `async-director-agent.js`，自身无任何引用，随依赖一并隔离 |
| `production-render-cli.js` | 依赖已隔离的 `render-submitter.js`，自身无任何引用，随依赖一并隔离 |
| `field-guard-checks/`（2 文件） | 原 `systems/field-guard/` 目录，可加载但无任何引用，随同名诱饵一并隔离 |

### scripts/ —— 加载即崩或外部工作区残留（原仓库根 scripts/）

| 文件 | 隔离原因 |
|---|---|
| `check-portraits.js` | 引用不存在的 `systems/character-portrait-enforcer-v2.js` |
| `check-project-health.js` | 引用不存在的 `systems/release-manifest` |
| `submit-astralis-ep02-opening-stable.js` | 引用不存在的 `systems/opening-system-v3` 等，一次性投片脚本 |
| `bundle-short-video-system.sh` | 面向外部工作区路径（`/root/.openclaw/workspace/short-video-system`）的打包残留 |

### engines/theme-diversity-test-engine/ —— 残缺引擎（原 hyperreality-system/engines/ 下）

入口 `index.js` 引用从未提交的 `./test-suite-generator`，加载即崩；仅被
`THEME-DIVERSITY-IMPLEMENTATION-LOG.md` 提及。8 个 validators 可独立加载但无活体引用，随引擎一并隔离。

### seedance-micromotion-test/ —— 缺核心 Agent 的测试（原 seedance-micromotion/test/）

5 个测试文件全部引用从未提交的 `../agents/world-breath`（世界呼吸 Agent），无法运行。
`seedance-micromotion/agents/` 现存 5 个 Agent 不受影响。

### backups/ —— 生产备份快照（原散落各引擎目录）

5 个 `*.js.production-v1.0.6 / .production-v1.0.8` 备份文件。Node 不会解析这些扩展名，
无运行时影响，但长期与活体文件同名同目录共存是误导源，统一收编于此。

### 已删除（未入隔离区）

`scripts/download-all-videos.sh`、`scripts/download-s04-s05-v3.sh`：一次性下载脚本，
内嵌火山引擎 TOS 预签名 URL（含访问密钥 ID，2026-05 底已过期失效）。凭证类残留不应入库，直接删除；
git 历史中仍可追溯，如需彻底抹除须重写历史（本次未做）。
