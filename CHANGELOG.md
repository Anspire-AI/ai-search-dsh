# Changelog

本项目的所有显著变更都记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Added
- 初始化仓库：README、.gitignore、CHANGELOG。
- 建立 Agent Workspace v2 工作区：`code/`（develop）、`BA/`（demand）、`Deploy/`(deploy)。

## [0.1.2] - 2026-08-19

### Fixed
- 修复 `--dump-config` 报 `patch: entry "anspire-ai-search" not found`、插件不出现在 UI 的问题 (REQ-003)：
  - `cordis.patch.yml` 改用 `- insert: [...]` 块（顶层追加 entry 语义）。此前的裸 `- id:` 行是「覆盖已存在 entry」语义——目标不存在时整条 patch 被 loader 跳过并告警，bundle 实际贡献 0 个 entry。
  - `index.js` 移除 `Config` 导出。cordis loader 要求 `Config["~standard"].validate()`（Standard Schema 接口），普通对象缺少该接口，插件一旦加载即 TypeError。配置直接经 patch 行 `config` 键流入 `apply(ctx, config)`，未提供时用内置默认值。

### Added
- `test/patch.test.js` patch 语法守护测试：断言 insert 块语义，防止回归为裸 id 行。

## [0.1.1] - 2026-08-19

### Fixed
- 修复插件安装后不加载的问题 (REQ-002)：
  - `index.js` 移除 TypeScript 语法（`import type`），改为纯 JavaScript —— 此前 Node 解析即崩，dsh 中看不到工具。
  - `src/tool.js` 移除对 `@deepseek-ai/dsh-tools` 的运行时导入 —— pnpm 默认不自动安装 peer 依赖，导入即 `ERR_MODULE_NOT_FOUND`。改为手工构建 `ToolDefinition`（`ctx.tools.register()` 接受普通对象，`defineTool` 仅是编译辅助器），参数使用编译后的 JSON Schema 形态。
  - `package.json` 移除 `peerDependencies` 声明（不再依赖），消除安装警告。
- `apply()` 返回 unregister disposer。

### Added
- 插件加载回归测试（`test/plugin.test.js`）：守护 import → apply → register → execute 全链路，防止语法/依赖问题再次静默回归。

## [0.1.0] - 2026-08-19

### Added
- `anspire_search` 工具：调用 Anspire AI Search API（`/api/ntsearch/search`），供 dsh agent 检索全网信息 (REQ-001)。
- 全参数支持：query / top_k / Insite / FromTime / ToTime / search_type（web/image/video）/ region_mode。
- 垂类卡防御式解析：results 为 JSON String 时逐层解析（含 kdJsonStr 嵌套），提取 title/content/url/date。
- Bearer 鉴权：API KEY 从环境变量读取（ANSPIRE_API_KEY > ANPSIRE_API_KEY > DSP_ANSPIRE_KEY），缺 key 返回配置指引。
- 30s 超时 + exec.signal 取消联动；错误规范值化（参数/网络/401 均为工具正常返回）。
- 单元测试 28 例（node --test，零依赖）：URL 构建、参数校验、三类解析、垂类卡、渲染、健壮性。
- dsh bundle 交付格式：package.json 声明 `dsh.bundle`，cordis.patch.yml 配置行，纯 JS 免构建安装。
