/**
 * anspire_search 工具定义（dsh ToolDefinition 契约）
 *
 * 零依赖实现：ctx.tools.register() 接受普通 ToolDefinition 对象，
 * defineTool() 仅是官方的编译辅助器（参数 spec → JSON Schema）。
 * 此处手工提供编译后的 JSON Schema 形态，避免对 @deepseek-ai/dsh-tools
 * 的运行时依赖（pnpm 默认不自动安装 peer 依赖，导入即 ERR_MODULE_NOT_FOUND）。
 *
 * 配置来源优先级（REQ-004 / REQ-010）：
 *   1. UI 插件设置页（ctx.settings 的 anspire-ai-search 命名空间，live 生效）
 *   2. 环境变量 ANSPIRE_API_KEY / ANPSIRE_API_KEY / DSP_ANSPIRE_KEY（向后兼容）
 *
 * 服务端点（REQ-010）：region（ai-search-cn / ai-search-global）优先；
 * 显式 baseUrl（部署级 patch 覆盖）仅在 region 缺席时回退。
 */
import { readApiKey, validateParams, search, AnspireApiError } from './api.js'
import { parseResponse, renderAsText } from './parse.js'

/** 区域 → API 端点映射（与 index.js REGIONS 保持一致；此处独立声明避免循环依赖） */
const REGION_BASE_URLS = {
  'ai-search-cn': 'https://plugin.anspire.cn',
  'ai-search-global': 'https://plugin.anspire.ai',
}

const DEFAULTS = {
  baseUrl: 'https://plugin.anspire.cn',
  timeoutMs: 30_000,
  defaultTopK: 10,
}

/** 当前生效的配置快照（settings 层覆盖时被替换） */
let currentConfig = { ...DEFAULTS }

/** 读取当前生效配置（测试注入点） */
export function getConfig() {
  return currentConfig
}

/** 覆盖当前生效配置（settings 层与测试使用） */
export function setConfig(next) {
  currentConfig = { ...DEFAULTS, ...next }
}

/** 解析 API KEY：settings 优先，环境变量兜底 */
function resolveApiKey(settingsSection) {
  const fromSettings = settingsSection?.apiKey
  if (typeof fromSettings === 'string' && fromSettings.trim()) return fromSettings.trim()
  return readApiKey()
}

/**
 * 解析请求基地址：region 优先；显式 baseUrl 仅在 region 缺席时使用。
 * @param {{region?: string, baseUrl?: string, settingsSection?: object}} config
 */
export function resolveBaseUrl(config) {
  const region = config.settingsSection?.region ?? config.region
  if (region && REGION_BASE_URLS[region]) return REGION_BASE_URLS[region]
  return config.baseUrl || DEFAULTS.baseUrl
}

export function registerAnspireSearchTool(ctx, userConfig = {}) {
  currentConfig = { ...DEFAULTS, ...userConfig }

  /** dsh ToolDefinition：name/description/parameters/output/execute */
  const definition = {
    name: 'anspire_search',
    description:
      '搜索全网信息（Anspire AI Search）。返回编号列表：标题/摘要/链接/日期/相关度。' +
      '适用于需要实时信息的提问（新闻、天气、股价、汇率、油价等）；' +
      '垂类词（如"北京天气"）会返回结构化垂域数据。',

    // 编译后的 JSON Schema 形态（与 defineTool 的 parameterSchemaSpecToJsonSchema 输出一致）
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索词，不超过 64 个中英文字符',
        },
        topK: {
          type: 'number',
          enum: [10, 20, 30, 40, 50],
          description: '返回条数，可选 10/20/30/40/50，默认 10',
        },
        insite: {
          type: 'string',
          description: '限定站点域名，多个用英文逗号分隔（最多 20 个），如 "sohu.com,zhihu.com"',
        },
        fromTime: {
          type: 'string',
          description: '时间范围起始，格式 2025-01-01 00:00:00',
        },
        toTime: {
          type: 'string',
          description: '时间范围结束，格式 2025-01-01 00:00:00',
        },
        searchType: {
          type: 'string',
          enum: ['web', 'image', 'video'],
          description: '检索类型：web（网页，默认）/ image（图片）/ video（视频）',
        },
        regionMode: {
          type: 'number',
          enum: [0, 1, 2],
          description: '检索区域：0 国内（默认）/ 1 海外 / 2 国内海外混合',
        },
      },
      required: ['query'],
    },

    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },

    async execute(args, exec) {
      const config = currentConfig

      // 1. 参数校验（领域失败作为规范值返回，不抛异常）
      const errors = validateParams(args)
      if (errors.length) {
        return `参数错误：\n${errors.map((e) => `- ${e}`).join('\n')}`
      }

      // 2. 解析 API KEY（settings → 环境变量）
      const apiKey = resolveApiKey(config.settingsSection)
      if (!apiKey) {
        return (
          '未配置 Anspire API KEY。两种方式（任选其一）：\n' +
          '1. 在 dsh 的插件设置页（Settings → Plugins → anspire-ai-search）填写 API KEY\n' +
          '2. 设置环境变量 ANSPIRE_API_KEY 后重启 dsh\n' +
          '获取 API KEY：https://open.anspire.cn'
        )
      }

      // 3. 调用 API
      let raw
      try {
        raw = await search(
          {
            query: args.query.trim(),
            topK: args.topK ?? config.defaultTopK,
            insite: args.insite,
            fromTime: args.fromTime,
            toTime: args.toTime,
            searchType: args.searchType ?? 'web',
            regionMode: args.regionMode ?? 0,
          },
          {
            baseUrl: resolveBaseUrl(config),
            apiKey,
            timeoutMs: config.timeoutMs,
            signal: exec?.signal,
          },
        )
      } catch (err) {
        if (err instanceof AnspireApiError) {
          if (err.status === 401) {
            return '鉴权失败（HTTP 401）：API KEY 无效或已过期（检查插件设置页或环境变量），请修正后重试。'
          }
          return `搜索失败：${err.message}`
        }
        return `搜索失败：${err?.message ?? String(err)}`
      }

      // 4. 解析并渲染为模型友好文本
      const searchType = args.searchType ?? 'web'
      const parsed = parseResponse(raw, searchType)
      return renderAsText(parsed, { query: raw?.query ?? args.query, uuid: raw?.Uuid })
    },
  }

  return ctx.tools.register(definition)
}
