# Changelog

本项目的所有显著变更都记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Added
- 初始化仓库：README、.gitignore、CHANGELOG。
- 建立 Agent Workspace v2 工作区：`code/`（develop）、`BA/`（demand）、`Deploy/`(deploy)。

## [0.3.0] - 2026-08-19

### Added
- 设置页「插件配置」tab 显示本插件的配置卡片 (REQ-005)：
  - 新增浏览器端 bundle（`client.js`）：package.json 声明 `dsh.client: {platform: 'web'}` + `exports['./client']`，由 dsh-client-modules 扫描并 serve 到 `/plugins/<id>/client.js`。
  - 卡片注册进 `settings.plugin.item` 槽，与终端/agent 循环/网页搜索并列；staged 编辑 + 统一保存（对齐官方 CardForm 语义：已覆盖标记、恢复默认、非法值阻塞保存、保存失败保留草稿）。
  - API KEY 输入框为密钥形态（type=password，不回显）。
  - 客户端依赖（slots/locale/settingsScope）经 `dsh.client.inject` 声明，factory 内 `require()` 由 shell 提供，零打包零构建。

## [0.2.0] - 2026-08-19

### Added
- API KEY 及插件配置支持 **UI 插件设置页**（Settings → Plugins → anspire-ai-search）(REQ-004)：
  - 注册 `anspire-ai-search` settings 命名空间（`ctx.settings.register`），apiKey 用 `role('secret')` 标记（密钥框输入、wire 层自动脱敏）。
  - `applies: 'live'`：UI 修改即时生效，无需重启 dsh。配置持久化在 dsh 的 settings.yaml。
  - 配置优先级：UI 设置页（用户层）> patch 行 config（base 层）> schema 默认值；API KEY 额外保留环境变量兜底（`ANSPIRE_API_KEY` > `ANPSIRE_API_KEY` > `DSP_ANSPIRE_KEY`）。
  - settings 为可选依赖（`ctx.inject(['settings'], ...)`）：服务缺席时（如 headless 极简 profile）自动降级为 base + 环境变量，插件照常工作。
- 新增 `@deepseek-ai/schemastery` 运行时依赖（settings schema 构造必需；dsh 生态公共基础件，与 dsh-tools 共享同一实例）。

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
