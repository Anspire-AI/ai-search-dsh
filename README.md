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

### 方式一：UI 插件设置页（推荐）

启动 dsh 后打开 **Settings → Plugins → anspire-ai-search**，直接在页面配置：

| 配置项 | 说明 |
|--------|------|
| `apiKey` | Anspire API KEY（获取: https://open.anspire.cn），密钥框输入、自动脱敏 |
| `baseUrl` | API 基地址，默认 `https://plugin.anspire.cn` |
| `timeoutMs` | 请求超时（毫秒），默认 30000 |
| `defaultTopK` | 默认返回条数，默认 10 |

**修改即时生效**（live），无需重启 dsh。配置持久化在 dsh 的 `settings.yaml`，由 dsh 统一管理。

### 方式二：环境变量（兜底/CI 场景）

```bash
export ANSPIRE_API_KEY="你的 key"   # 获取: https://open.anspire.cn
```

兼容的环境变量名：`ANSPIRE_API_KEY` > `ANPSIRE_API_KEY` > `DSP_ANSPIRE_KEY`（按此顺序取第一个非空）。

优先级：**UI 设置页 > 环境变量**。

### 进阶：patch 行覆盖（部署级默认值）

默认配置（`index.js` schema 默认值）：

```js
{
  baseUrl: 'https://plugin.anspire.cn',
  timeoutMs: 30_000,
  defaultTopK: 10,
}
```

在 profile 级 `cordis.patch.yml` 中覆盖（按 id 定位本插件插入的行；`config` 是整体替换，需重述全部键）：

```yaml
# profile 的 cordis.patch.yml（~/.dsh/profiles/<name>/cordis.patch.yml）
- id: anspire-ai-search
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
cd anspire-ai-search/code        # develop 分支即 bundle 根
node --test 'test/*.test.js'     # 运行测试（Node ≥18，零依赖）
```

### bundle 结构说明

- `cordis.patch.yml` 用 `- insert: [...]` 块向 entry 列表**追加**插件行。不要写成裸 `- id:` 行——那是「覆盖已存在 entry」语义，目标不存在时整条 patch 会被 loader 静默跳过（`patch: entry not found`），插件不加载。
- `index.js` 不导出 `Config`。cordis loader 要求 `Config["~standard"].validate`（Standard Schema 接口），普通对象会 TypeError。配置直接经 patch 行的 `config` 键流入 `apply(ctx, config)`，未提供时用内置默认值。

## License

MIT
