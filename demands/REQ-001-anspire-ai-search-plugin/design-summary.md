# 设计概要：Anspire AI Search dsh 插件

## 方案概述

单包 dsh bundle：一个 Cordis 函数插件，通过 `ctx.tools.register(defineTool(...))` 注册 `anspire_search` 工具，内部用原生 fetch 调用 Anspire 搜索 API 并将响应解析为模型友好的结构化文本。

## 技术选型

| 项目 | 选择 | 理由 |
|------|------|------|
| 语言 | JavaScript (ESM) | dsh 生态标准；git 安装不需构建链（免 pnpm allowBuilds 放行） |
| HTTP | 原生 fetch + AbortSignal | Node ≥18 内置，零依赖 |
| 校验 | @deepseek-ai/schemastery（peer） | dsh 标准，Config 校验 |
| 测试 | node --test | Node 内置，零依赖 |

## 模块划分

```
anspire-ai-search-dsh-plugin/（仓库根，即 bundle 根）
├── package.json          # dsh.bundle 声明 + peer deps
├── cordis.patch.yml      # 工具插件配置行
├── index.js              # 插件入口：name/inject/Config/apply
├── src/
│   ├── api.js            # API 客户端：buildUrl/搜索请求
│   ├── parse.js          # 响应解析：web/image/video/垂类卡
│   └── tool.js           # defineTool 定义：schema/execute/render
└── test/
    ├── api.test.js       # URL 构建、鉴权头
    └── parse.test.js     # 三类解析 + 垂类卡
```

## 数据流

```
模型调用 anspire_search(query, ...)
  → defineTool 校验 args
  → tool.js: 读 env API KEY → api.js: fetch(GET, Bearer)
  → parse.js: 按响应形态解析（web/image/video/垂类卡 JSON String）
  → render: 结构化文本（编号列表）→ 模型
```

## 关键设计决策

1. **纯 JS 不构建**：git 安装场景（`github:myg133/anspire-ai-search`）不触发 prepare/build，用户免 pnpm allowBuilds 放行，安装体验最顺
2. **垂类卡防御式解析**：results 可能是数组（通用）或 JSON String（垂类卡），垂类卡内部还有一层 kdJsonStr 嵌套字符串，逐层 try-parse，解析失败降级为截断原文
3. **错误规范值化**：参数错误、网络错误、401 等都作为工具的正常返回值（带 isError 语义的文本），符合 dsh 「领域失败不抛异常」契约
4. **多 env key 兼容**：依次探测 ANSPIRE_API_KEY / ANPSIRE_API_KEY（文档常见拼写）/ DSP_ANSPIRE_KEY，取第一个非空
