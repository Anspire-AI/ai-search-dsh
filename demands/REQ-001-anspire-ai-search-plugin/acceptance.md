# 验收标准：Anspire AI Search dsh 插件

### AC-001: 工具注册
- 前置条件: 插件通过 `dsh plugin add` 安装到 profile
- 测试步骤: 1. 启动 dsh 2. 查看工具列表 3. 模型调用搜索类问题
- 预期结果: `anspire_search` 工具可被模型发现并调用
- 类型: 功能

### AC-002: 基础 web 搜索
- 前置条件: 已配置有效 API KEY
- 测试步骤: 1. query=「今天北京天气」 2. 默认参数调用
- 预期结果: 返回编号列表，每条含 title/content/url/score/date，模型可据此回答
- 类型: 功能

### AC-003: 全参数支持
- 前置条件: 同上
- 测试步骤: 1. 分别传 top_k/Insite/FromTime/ToTime/search_type/region_mode 组合调用
- 颢期结果: 参数正确拼入请求 URL，服务端正确响应
- 类型: 功能

### AC-003 补充: 参数校验
- 测试步骤: 1. query 为空 2. top_k 传非法值 3. search_type 传非法值
- 预期结果: 工具层返回明确错误信息（规范错误值，非抛异常崩溃）
- 类型: 功能

### AC-004: 三种检索类型
- 前置条件: 同上
- 測试步骤: 1. search_type=web 2. search_type=image 3. search_type=video
- 预期结果: image 结果正确解析 image.url/width/height；web/video 解析 title/content/url/score/date
- 类型: 功能

### AC-005: 垂类卡解析
- 前置条件: 同上
- 测试步骤: 1. query=「北京天气」（命中垂类卡）2. 检查 results 为 JSON String 的场景
- 预期结果: 嵌套 JSON 被解析，提取 title/content/url/date 等字段，不出现原始转义字符串直接输出
- 类型: 功能

### AC-006: 鉴权与安全
- 副置条件: 环境变量已配置
- 测试步骤: 1. 不设 KEY 调用 2. 设无效 KEY 调用 3. 检查日志
- 预期结果: 缺 KEY 时返回明确指引错误；无效 KEY 时透传服务端 401 信息；日志无 KEY 泄露
- 类型: 安全

### AC-007: 超时与取消
- 前置条件: 同上
- 测试步骤: 1. 模拟慢响应 2. 中途取消
- 预期结果: 30s 超时返回友好错误；exec.signal 触发后请求中止
- 类型: 性能
