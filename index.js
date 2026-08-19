// Anspire AI Search — DeepSeek Harness (dsh) 插件入口
//
// Cordis 函数插件契约：具名导出 name / inject / apply。
// 纯 JavaScript（无构建步骤），零运行时依赖 —— git 安装无需 pnpm allowBuilds 放行。
//
// 注意：不导出 Config。Cordis loader 会调用 Config["~standard"].validate()
// （Standard Schema 接口，需 schemastery/zod 等构造）。普通对象缺少该接口，
// 插件加载即 TypeError。配置经 patch 行的 config 键流入 apply 的第二参数，
// 无 Config 导出时不校验、原样透传，默认值在 src/tool.js 内合并。

import { registerAnspireSearchTool } from './src/tool.js'

/** 插件显示名，仅用于诊断 */
export const name = 'anspire-ai-search'

/** 依赖 dsh 的 tools 服务；loader 等服务就绪后再执行 apply */
export const inject = ['tools']

/**
 * 插件主体：注册 anspire_search 工具
 * @param {import('@deepseek-ai/cordis').Context} ctx 插件上下文
 * @param {{baseUrl?: string, timeoutMs?: number, defaultTopK?: number}} [config]
 *   patch 行配置（可选，缺省用 src/tool.js 内置默认值）
 * @returns {() => void} unregister disposer
 */
export function apply(ctx, config) {
  return registerAnspireSearchTool(ctx, config)
}
