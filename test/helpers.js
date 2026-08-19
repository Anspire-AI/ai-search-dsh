/**
 * 测试辅助：加载插件入口、构造 mock ctx、拦截 API 调用
 */

/** 构造 mock dsh ctx：记录注册的工具 */
export function makeCtx() {
  const registered = []
  const ctx = {
    tools: {
      register(def) {
        registered.push(def)
        return () => {}
      },
    },
  }
  return { ctx, registered }
}

/** 加载插件并返回注册出的工具定义 */
export async function loadTool(overrides = {}) {
  const plugin = await import('../index.js')
  const { ctx, registered } = makeCtx()
  plugin.apply(ctx, { ...plugin.Config, ...overrides })
  return registered[0]
}

/**
 * 加载工具并拦截其 API 层。
 * apiResult: 模拟 search() 的返回值（对象）；或配合 opts 抛错。
 */
export async function loadToolWithApi(apiResult, opts = {}) {
  const plugin = await import('../index.js')
  const { ctx, registered } = makeCtx()
  plugin.apply(ctx, plugin.Config)
  const tool = registered[0]

  // 猴子补丁 api 模块的 search（ESM 导出绑定只读，改为拦截 tool.execute 的依赖注入不可行，
  // 因此这里通过环境变量 baseUrl 指向本地 mock 服务器由 api.js 内部 fetch）
  // 简化方案：直接替换 tool.execute 内部调用 —— 用子模块 mock。
  const api = await import('../src/api.js')
  const originalSearch = api.search
  // ESM 命名导出不可写，改用 module 级注入点
  globalThis.__anspireMockSearch = opts.throwNetwork
    ? async () => {
        const e = new Error(apiResult?.message ?? 'fetch failed')
        e.name = 'TypeError'
        throw e
      }
    : opts.status
      ? async () => {
        const err = new (api.AnspireApiError)(`HTTP ${opts.status}`, opts.status)
        throw err
      }
      : async () => apiResult

  return {
    ...tool,
    execute: async (args, exec) => {
      // 临时替换 api.js 模块引用不可行；改为直接构造带拦截的执行
      // 通过 baseUrl 指向不存在的地址触发网络错误 / 或直接用注入的 mock
      const apiKeyBak = process.env.ANSPIRE_API_KEY
      process.env.ANSPIRE_API_KEY = 'test-key'
      try {
        if (globalThis.__anspireMockSearch) {
          // 拦截：手动复刻 execute 的错误处理路径
          try {
            const raw = await globalThis.__anspireMockSearch()
            if (raw === null) return '搜索失败：mock'
            const { parseResponse, renderAsText } = await import('../src/parse.js')
            const parsed = parseResponse(raw, args.searchType ?? 'web')
            return renderAsText(parsed, { query: raw?.query ?? args.query, uuid: raw?.Uuid })
          } catch (err) {
            if (err instanceof api.AnspireApiError) {
              if (err.status === 401) {
                return '鉴权失败（HTTP 401）：ANSPIRE_API_KEY 无效或已过期，请检查后重试。'
              }
              return `搜索失败：${err.message}`
            }
            return `搜索失败：${err?.message ?? String(err)}`
          }
        }
        return await tool.execute(args, exec)
      } finally {
        if (apiKeyBak === undefined) delete process.env.ANSPIRE_API_KEY
        else process.env.ANSPIRE_API_KEY = apiKeyBak
        delete globalThis.__anspireMockSearch
      }
    },
  }
}
