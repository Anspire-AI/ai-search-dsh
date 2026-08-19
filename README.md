# anspire-ai-search-dsh-plugin

[Anspire AI Search](https://open.anspire.cn) 的 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 插件。

为 agent 提供全网搜索能力：网页 / 图片 / 视频检索 + 垂域结构化数据（天气、股票、汇率、油价、万年历等），作为回答实时性问题的依据。

## 安装

```bash
# 从 GitHub 安装（推荐固定 commit）
dsh plugin --profile <name> add github:myg133/anspire-ai-search#<sha>

# 或从 npm（发布后）
dsh plugin --profile <name> add anspire-ai-search-dsh-plugin
```

> 本插件为纯 JavaScript（无构建步骤），通过 GitHub 安装无需在 `pnpm-workspace.yaml` 中放行构建。

## 配置

### API KEY（必需）

```bash
export ANSPIRE_API_KEY="你的 key"   # 获取: https://open.anspire.cn
```

兼容的环境变量名：`ANSPIRE_API_KEY` > `ANPSIRE_API_KEY` > `DSP_ANSPIRE_KEY`（按此顺序取第一个非空）。

### 插件配置（可选，通过 patch 覆盖）

默认配置（`index.js`）：

```js
{
  baseUrl: 'https://plugin.anspire.cn',
  timeoutMs: 30_000,
  defaultTopK: 10,
}
```

在 profile 级 `cordis.patch.yml` 中覆盖（注意 `config` 是整体替换，需重述全部键）：

```yaml
- id: anspire-ai-search
  name: 'anspire-ai-search-dsh-plugin'
  config:
    baseUrl: 'https://plugin.anspire.cn'
    timeoutMs: 20000
    defaultTopK: 20
```

## 提供的工具

### `anspire_search`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | ✅ | 搜索词，≤64 字符 |
| `topK` | number | | 返回条数 10/20/30/40/50，默认 10 |
| `insite` | string | | 限定站点，逗号分隔，最多 20 个 |
| `fromTime` | string | | 起始时间 `2025-01-01 00:00:00` |
| `toTime` | string | | 结束时间 |
| `searchType` | string | | `web`（默认）/ `image` / `video` |
| `regionMode` | number | | `0` 国内（默认）/ `1` 海外 / `2` 混合 |

输出为编号列表文本：标题 / 摘要 / 链接 / 日期 / 相关度。垂类词（如「北京天气」）自动返回结构化垂域数据。

## 开发

```bash
git clone git@github.com:myg133/anspire-ai-search.git
cd anspire-ai-search/feature-REQ-001   # 或直接在 bundle 目录
node --test test/                      # 运行测试（Node ≥18，零依赖）
```

## License

MIT
