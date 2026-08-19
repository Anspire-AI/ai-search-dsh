# Changelog

本项目的所有显著变更都记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Added
- 初始化仓库：README、.gitignore、CHANGELOG。
- 建立 Agent Workspace v2 工作区：`code/`（develop）、`BA/`（demand）、`Deploy/`(deploy)。

## [0.4.1] - 2026-08-19

### Fixed
- 修复保存 API KEY 后误报「保存失败，请重试」（实际已写入）(REQ-011)：
  - 根因：`role('secret')` 字段经 wire 层 `redactSecrets` 脱敏，`set()` 成功后 user 层回读永远无明文，store() 的「回读值比对」判定必然 false。官方 web-search 卡片写 KEY 用的是 credentials 通道 + 主动重读，不走该比对。
  - 修正：secret 字段（apiKey）的写入按「promise 未 reject 即成功」判定（对齐官方 `writeKey` 语义）；普通字段保留回读比对。`clear()`（unset）同规则。
  - set/unset 被 Host 拒绝（校验失败、只读、网络错误）时仍正确报失败。

## [0.4.0] - 2026-08-19

### Added
- 服务区域选择 (REQ-010)：
  - 新增 `region` 枚举配置（`ai-search-cn` 国内默认 / `ai-search-global` 海外），UI 下拉选择、不可自由输入；不展示底层 URL。
  - 区域下方展示「获取 anspire-ai-search api-key」链接，随所选区域跳转对应申请地址（cn → open.anspire.cn，global → opentoken.anspire.ai）；切换区域即时联动（未保存的选择也生效）。
  - Host 侧 `resolveBaseUrl`：region 优先映射端点；显式 `baseUrl` 降级为部署级 patch 覆盖项（UI 不再展示，region 缺席时回退）。
  - 提示文案注明：国内与海外为独立服务，API KEY 不通用。

## [0.3.4] - 2026-08-19

### Fixed
- 修复卡片渲染时报 `getSnapshot is not a function` (REQ-009)：hooks 值必须是 **store 对象**（`{getSnapshot, subscribe}`，官方经 `createSnapshotStore` 构造），框架用 `useSyncExternalStoreWithSelector` 消费并注入 `props.useAnspireCard(selector)`。原实现传的是自定义 selector 函数，框架对其调 `.getSnapshot()` 即抛错，卡片渲染崩溃、表单不显示。

## [0.3.3] - 2026-08-19

### Fixed
- 修复卡片展开时报 `props.useCard is not a function` (REQ-008)：slot 框架对 `inject()` 返回的 hooks 键做 `use` + 首字母大写 转换（`hooks.anspireCard` → `props.useAnspireCard`，对齐官方 `bashCard`/`useBashCard` 约定）。原键名 `useCard` 被转换为 `useUseCard`，组件读 `props.useCard` 得 undefined。

## [0.3.2] - 2026-08-19

### Fixed
- `dsh.client.inject` 修正 (REQ-007)：原第三个包名 `@deepseek-ai/dsh-client-settings-scope` 不存在（npm 404，编辑时的笔误），坏边导致浏览器端 entry 激活永远等待。改为真实包 `@deepseek-ai/dsh-client-ui-settings`（设置壳，提供 settingsScope 服务）。
- `@deepseek-ai/dsh-client-ui-slots` 从 dependencies 移到 devDependencies：仅契约回归测试使用，运行时 client.js 只 `require('react')`。消除安装时的 missing peer 警告（cordis/dsh-invariants）。

## [0.3.1] - 2026-08-19

### Fixed
- 修复页面报错 `keyed slot "settings.plugin.item" requires options.key` (REQ-006)：
  - 新版 slots（0.1.0-rc.7+）中 `settings.plugin.item` 已从 list slot（`options.id`）改为 keyed slot（`options.key`），且 key 即 settings 命名空间。卡片注册参数由 `id: anspire-ai-search` 改为 `key: anspire-ai-search`。
  - configurable tab 按「Host 服务的命名空间 ∩ 已注册卡片」交集渲染（本插件 Host 侧已注册同名命名空间，正好闭环）。

### Added
- `test/slots-contract.test.js`：用真实 `@deepseek-ai/dsh-client-ui-slots` 的 `SlotCore` 跑注册路径（含旧写法被拒的对照断言），防止 mock 契约与真实运行时再次漂移。
- `@deepseek-ai/dsh-client-ui-slots` 入 dependencies（契约回归测试用）。

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
