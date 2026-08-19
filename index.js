import type { Context } from '@deepseek-ai/cordis'
import { registerAnspireSearchTool } from './src/tool.js'

export const name = 'anspire-ai-search'

/** 依赖 dsh 的 tools 服务，loader 等服务就绪后再执行 apply */
export const inject = ['tools']

/**
 * 部署期配置（可被上层 patch 覆盖，覆盖时整体替换）
 */
export const Config = {
  /** API 基地址，默认公网地址 */
  baseUrl: 'https://plugin.anspire.cn',
  /** 请求超时（毫秒） */
  timeoutMs: 30_000,
  /** 默认返回条数 */
  defaultTopK: 10,
}

export function apply(ctx, config) {
  registerAnspireSearchTool(ctx, config)
}
