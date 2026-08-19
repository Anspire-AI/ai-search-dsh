// Anspire AI Search — DeepSeek Harness (dsh) 插件入口
//
// Cordis 函数插件契约：具名导出 name / inject / apply。
// 纯 JavaScript（无构建步骤）—— git 安装无需 pnpm allowBuilds 放行。
//
// 配置三层结构（REQ-004）：
//   schema 默认值 → patch 行 config（base 层）→ UI 插件设置页（用户层，live 生效）
// API KEY 额外支持环境变量兜底（ANSPIRE_API_KEY 等）。

import z from '@deepseek-ai/schemastery'
import { registerAnspireSearchTool, setConfig } from './src/tool.js'

/** 插件显示名，仅用于诊断 */
export const name = 'anspire-ai-search'

/** 依赖 dsh 的 tools 服务；settings 为可选依赖（经 ctx.inject 挂载，缺席时降级） */
export const inject = ['tools']

/** settings 命名空间（UI 插件设置页按此分组展示） */
const NS = 'anspire-ai-search'

/**
 * 插件配置 schema（schemastery 实例——Settings.resolve 需调用它做校验，
 * UI 表单经 schema.toJSON() 渲染）。
 */
export const SettingsSchema = z.object({
  apiKey: z.string().role('secret').description('Anspire API KEY（获取: https://open.anspire.cn）'),
  baseUrl: z.string().default('https://plugin.anspire.cn').description('API 基地址'),
  timeoutMs: z
    .number()
    .min(1_000)
    .max(120_000)
    .default(30_000)
    .description('请求超时（毫秒）'),
  defaultTopK: z
    .number()
    .step(1)
    .min(10)
    .max(50)
    .default(10)
    .description('默认返回条数'),
})

/** schema 默认值（patch 行未覆盖任何键时的基线） */
const SCHEMA_DEFAULTS = SettingsSchema({})

/**
 * 插件主体：注册工具 + 挂载 UI 设置
 * @param {import('@deepseek-ai/cordis').Context} ctx 插件上下文
 * @param {{baseUrl?: string, timeoutMs?: number, defaultTopK?: number}} [entryConfig]
 *   patch 行 config（base 层，优先于 schema 默认值）
 */
export function apply(ctx, entryConfig = {}) {
  // base 层 = schema 默认值 + patch 行 config
  const base = { ...SCHEMA_DEFAULTS, ...entryConfig }
  setConfig(base)

  // 注册工具（apiKey 在 execute 时经 currentConfig.settingsSection 动态解析）
  const disposeTool = registerAnspireSearchTool(ctx, entryConfig)

  // 挂载 UI 设置（可选依赖：settings 服务缺席时保持 base 配置继续工作）
  const disposers = [disposeTool]
  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, SettingsSchema, {
      base,
      applies: 'live', // UI 修改立即生效，无需重启
    })

    // settings 解析值 → 工具配置快照（apiKey 存在 section 里供 execute 读取）
    const applySnapshot = (section) => {
      setConfig({ ...base, settingsSection: section })
    }
    applySnapshot(scope.get())

    const stopWatch = scope.watch((next) => applySnapshot(next))
    disposers.push(stopWatch)
  })

  return () => {
    for (const d of disposers) {
      try {
        d?.()
      } catch {
        /* 注销竞态下忽略 */
      }
    }
  }
}
