/**
 * anspire_search 工具定义（dsh defineTool 契约）
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readApiKey, validateParams, search, AnspireApiError } from './api.js'
import { parseResponse, renderAsText } from './parse.js'

const DEFAULTS = {
  baseUrl: 'https://plugin.anspire.cn',
  timeoutMs: 30_000,
  defaultTopK: 10,
}

export function registerAnspireSearchTool(ctx, userConfig = {}) {
  const config = { ...DEFAULTS, ...userConfig }

  ctx.tools.register(
    defineTool({
      name: 'anspire_search',
      description:
        '搜索全网信息（Anspire AI Search）。返回编号列表：标题/摘要/链接/日期/相关度。' +
        '适用于需要实时信息的提问（新闻、天气、股价、汇率、油价等）；' +
        '垂类词（如"北京天气"）会返回结构化垂域数据。',

      parameters: {
        query: {
          type: 'string',
          required: true,
          description: '搜索词，不超过 64 个中英文字符',
        },
        topK: {
          type: 'number',
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
          description: '检索类型：web（网页，默认）/ image（图片）/ video（视频）',
        },
        regionMode: {
          type: 'number',
          description: '检索区域：0 国内（默认）/ 1 海外 / 2 国内海外混合',
        },
      },

      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },

      async execute(args, exec) {
        // 1. 参数校验（领域失败作为规范值返回，不抛异常）
        const errors = validateParams(args)
        if (errors.length) {
          return `参数错误：\n${errors.map((e) => `- ${e}`).join('\n')}`
        }

        // 2. 读取 API KEY
        const apiKey = readApiKey()
        if (!apiKey) {
          return (
            '未配置 Anspire API KEY。请在环境变量中设置 ANSPIRE_API_KEY（重启 dsh 生效）。\n' +
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
              baseUrl: config.baseUrl,
              apiKey,
              timeoutMs: config.timeoutMs,
              signal: exec?.signal,
            },
          )
        } catch (err) {
          if (err instanceof AnspireApiError) {
            if (err.status === 401) {
              return '鉴权失败（HTTP 401）：ANSPIRE_API_KEY 无效或已过期，请检查后重试。'
            }
            return `搜索失败：${err.message}`
          }
          return `搜索失败：${err?.message ?? String(err)}`
        }

        // 4. 解析并渲染
        const searchType = args.searchType ?? 'web'
        const parsed = parseResponse(raw, searchType)
        return renderAsText(parsed, { query: raw?.query ?? args.query, uuid: raw?.Uuid })
      },
    }),
  )
}
