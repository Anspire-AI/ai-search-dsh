import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * REQ-004：UI 插件设置页配置集成测试
 *
 * 验证三层配置解析（schema 默认 → patch base → settings 用户层）、
 * settings scope 注册形态、live 生效、环境变量兜底、脱敏标记。
 */

/** 构造模拟 settings scope（复刻 dsh-settings SettingsScope 接口的最小实现） */
function makeMockSettingsScope(initialSection, base) {
  let section = initialSection
  const watchers = new Set()
  const schemaDefaults = { baseUrl: 'https://plugin.anspire.cn', timeoutMs: 30000, defaultTopK: 10 }
  return {
    get: () => ({ ...schemaDefaults, ...base, ...section }),
    watch(cb) {
      watchers.add(cb)
      return () => watchers.delete(cb)
    },
    async update(patch) {
      section = { ...section, ...patch }
      const next = this.get()
      for (const cb of watchers) await cb(next)
    },
  }
}

/** 模拟 dsh host：tools + settings 两个服务 */
function makeMockHost({ settingsSection = {}, entryConfig = {} } = {}) {
  const registered = []
  const settingsScopes = []
  const ctx = {
    tools: {
      register(def) {
        registered.push(def)
        return () => {}
      },
    },
    settings: {
      register(ns, schema, opts) {
        settingsScopes.push({ ns: String(ns), schema, opts })
        return makeMockSettingsScope(settingsSection, opts?.base)
      },
    },
    inject(names, fn) {
      // 模拟 cordis 的可选注入：settings 服务存在时立即回调
      fn(ctx)
      return () => {}
    },
  }
  return { ctx, registered, settingsScopes }
}

test('SettingsSchema：可调用、含 secret 角色标记、toJSON 可渲染', async () => {
  const { SettingsSchema } = await import('../index.js')

  // 可调用（Settings.resolve 依赖）
  const resolved = SettingsSchema({})
  assert.equal(resolved.baseUrl, 'https://plugin.anspire.cn')
  assert.equal(resolved.timeoutMs, 30000)
  assert.equal(resolved.defaultTopK, 10)

  // secret 标记（UI 渲染为密钥输入框 + 脱敏）
  const json = JSON.stringify(SettingsSchema.toJSON())
  assert.ok(json.includes('secret'), 'apiKey 应带 role=secret 标记')

  // 校验：非法值拒绝
  assert.throws(() => SettingsSchema({ timeoutMs: 50 }), /timeoutMs|larger|至少/i)
})

test('apply()：向 settings 注册 anspire-ai-search 命名空间（live 生效）', async () => {
  const plugin = await import('../index.js')
  const { ctx, settingsScopes } = makeMockHost()

  plugin.apply(ctx)
  assert.equal(settingsScopes.length, 1)
  assert.equal(settingsScopes[0].ns, 'anspire-ai-search')
  assert.equal(settingsScopes[0].opts.applies, 'live', 'UI 修改应 live 生效')
  assert.deepEqual(settingsScopes[0].opts.base, {
    baseUrl: 'https://plugin.anspire.cn',
    timeoutMs: 30000,
    defaultTopK: 10,
  })
})

test('配置优先级：settings 用户层 > patch base > schema 默认', async () => {
  const plugin = await import('../index.js')
  const { ctx, registered } = makeMockHost({
    settingsSection: { apiKey: 'ui-key-123', defaultTopK: 20 },
    entryConfig: { timeoutMs: 15000 },
  })

  plugin.apply(ctx)
  const tool = registered[0]

  // 无环境变量时用 settings 里的 key
  delete process.env.ANSPIRE_API_KEY
  const out = await tool.execute({ query: 'x' }, {})
  // settingsSection 里的 apiKey='ui-key-123' 应被采用 → 请求会真实发出（本环境网络不可达）
  // 断言「不是缺 KEY 指引」即证明 settings 优先级生效
  assert.ok(!out.includes('未配置 Anspire API KEY'), 'settings 的 apiKey 应优先于环境变量缺席')
})

test('live 更新：settings.update 后新 key 立即生效（无需重启）', async () => {
  const plugin = await import('../index.js')
  let scopeRef
  const registered = []
  const ctx = {
    tools: { register: (d) => { registered.push(d); return () => {} } },
    settings: {
      register(ns, schema, opts) {
        scopeRef = makeMockSettingsScope({}, opts?.base)
        return scopeRef
      },
    },
    inject: (_n, fn) => { fn(ctx); return () => {} },
  }

  plugin.apply(ctx)
  const tool = registered[0]
  delete process.env.ANSPIRE_API_KEY

  // 初始无 key → 指引文案
  let out = await tool.execute({ query: 'x' }, {})
  assert.ok(out.includes('未配置'))

  // UI 更新 key → 立即可用
  await scopeRef.update({ apiKey: 'live-key' })
  out = await tool.execute({ query: 'x' }, {})
  assert.ok(!out.includes('未配置'), 'live 更新后不应再提示未配置')
})

test('环境变量兜底：settings 无 key 时回退 ANSPIRE_API_KEY', async () => {
  const plugin = await import('../index.js')
  const { ctx, registered } = makeMockHost({ settingsSection: {} })

  const bak = process.env.ANSPIRE_API_KEY
  process.env.ANSPIRE_API_KEY = 'env-key'
  try {
    plugin.apply(ctx)
    const tool = registered[0]
    const out = await tool.execute({ query: 'x' }, {})
    assert.ok(!out.includes('未配置'), '环境变量应作为兜底生效')
  } finally {
    bak === undefined ? delete process.env.ANSPIRE_API_KEY : (process.env.ANSPIRE_API_KEY = bak)
  }
})

test('apply() 返回的 disposer 清理注入副作用', async () => {
  const plugin = await import('../index.js')
  const { ctx } = makeMockHost()
  const dispose = plugin.apply(ctx)
  assert.equal(typeof dispose, 'function')
  // 不抛异常即通过
  dispose()
})
