// Anspire AI Search — DeepSeek Harness (dsh) 插件入口
//
// Cordis 函数插件契约：具名导出 name / inject / Config / apply。
// 纯 JavaScript（无构建步骤），零运行时依赖 —— git 安装无需 pnpm allowBuilds 放行。

import { registerAnspireSearchTool } from './src/tool.js'

/** 插件显示名，仅用于诊断 */
export const name = 'anspire-ai-search'

/** 依赖 dsh 的 tools 服务；loader 等服务就绪后再执行 apply */
export const inject = ['tools']

/**
 * 部署期配置（可被上层 patch 覆盖；注意 config 是整体替换，覆盖时需重述全部键）
 */
export const Config = {
  /** API 基地址 */
  baseUrl: 'https://plugin.anspire.cn',
  /** 请求超时（毫秒） */
  timeoutMs: 30_000,
  /** 默认返回条数 */
  defaultTopK: 10,
}

/** 插件主体：注册 anspire_search 工具（返回 unregister disposer） */
export function apply(ctx, config) {
  return registerAnspireSearchTool(ctx, config)
}
