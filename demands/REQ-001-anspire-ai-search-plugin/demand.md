# 需求：Anspire AI Search dsh 插件

## 基本信息
- 需求编号: REQ-001
- 优先级: P0
- 状态: 进行中
- 创建日期: 2026-08-19

## 需求描述

将自有的 ai_search 服务封装为 DeepSeek Harness（dsh）插件，供 dsh 用户安装使用，作为产品引流入口。

ai_search 服务提供全网搜索 + 垂域结构化数据（天气、股票、汇率等），接口文档见
`https://open.anspire.cn/document/docs/searchApi/`（本地参考 `/workspace/Anspire AI Search API文档.md`）。

## 用户故事

作为一个 dsh 用户，我想要在 agent 会话中直接调用 Anspire AI 搜索，以便于：
- 检索全网信息作为回答的实时依据（web/image/video 三种检索类型）
- 获取垂域结构化数据（天气、股票、汇率、油价等）

## 功能要求

1. 提供一个 `anspire_search` 工具，模型可按参数调用 Anspire 搜索 API
2. 支持全部请求参数：query、top_k、Insite（站点过滤）、FromTime/ToTime（时间范围）、search_type（web/image/video）、region_mode（国内/海外/混合）
3. Bearer API KEY 鉴权，key 从环境变量 `ANPSIRE_API_KEY`（兼容 `ANPSIRE_API_KEY`/`ANSPIRE_API_KEY` 多种写法）读取，不硬编码
4. 响应解析：
   - web/video 结果：title、content、url、score、date
   - image 结果：title、image.url、image.width/height、date
   - 垂类卡（results 为 JSON String）：解析嵌套 JSON，提取 title/content/url 等通用字段
5. 以 dsh bundle 标准格式交付（package.json 声明 `dsh.bundle` + cordis.patch.yml），支持 `dsh plugin add` 安装
6. 工具输出对模型友好：结构化文本（编号列表 + 标题/摘要/链接/日期/相关度）

## 非功能要求

- 性能：单次搜索请求超时 30s，可被取消（响应 exec.signal）
- 安全：API KEY 仅从环境变量读取；不记录 KEY 到日志
- 兼容：Node.js ≥ 18（使用原生 fetch）；无运行时依赖（除 dsh peer deps）
- 质量：单元测试覆盖 URL 构建、鉴权头、三类响应解析、错误路径
