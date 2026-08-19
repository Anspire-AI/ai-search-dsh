# Changelog

本项目的所有显著变更都记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Added
- 初始化仓库：README、.gitignore、CHANGELOG。
- 建立 Agent Workspace v2 工作区：`code/`（develop）、`BA/`（demand）、`Deploy/`(deploy)。

## [0.1.0] - 2026-08-19

### Added
- `anspire_search` 工具：调用 Anspire AI Search API（`/api/ntsearch/search`），供 dsh agent 检索全网信息 (REQ-001)。
- 全参数支持：query / top_k / Insite / FromTime / ToTime / search_type（web/image/video）/ region_mode。
- 垂类卡防御式解析：results 为 JSON String 时逐层解析（含 kdJsonStr 嵌套），提取 title/content/url/date。
- Bearer 鉴权：API KEY 从环境变量读取（ANSPIRE_API_KEY > ANPSIRE_API_KEY > DSP_ANSPIRE_KEY），缺 key 返回配置指引。
- 30s 超时 + exec.signal 取消联动；错误规范值化（参数/网络/401 均为工具正常返回）。
- 单元测试 28 例（node --test，零依赖）：URL 构建、参数校验、三类解析、垂类卡、渲染、健壮性。
- dsh bundle 交付格式：package.json 声明 `dsh.bundle`，cordis.patch.yml 配置行，纯 JS 免构建安装。
