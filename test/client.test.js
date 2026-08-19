import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * REQ-005：客户端 bundle 测试（设置页插件配置卡片）
 *
 * 模拟浏览器环境执行 client.js：
 *   window.__ModuleLoader__.load({id, factory}) 注册 → factory(require) 物化
 *   → surface.apply(ctx) 向 settings.plugin.item 槽注册卡片
 *
 * react 用极简 mock（卡片逻辑测试不需要真实渲染器）。
 */

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))

/** 极简 react mock：组件渲染不在测试范围，只提供 hook 与 createElement */
const mockReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useId: () => 'test-id',
  useState: (v) => [v, () => {}],
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
}

/** 在隔离的浏览器 mock 中执行 bundle 源码，返回 {surface, captured} */
function executeBundle() {
  const captured = {
    localeDicts: new Map(),
    cards: [], // {slot, item: {opts, comp}}
    cssTags: [],
    sets: [],
    unsets: [],
    scopeSnapshots: {
      value: { region: 'ai-search-cn', timeoutMs: 30000, defaultTopK: 10 },
      base: { region: 'ai-search-cn', timeoutMs: 30000, defaultTopK: 10 },
      user: undefined,
      status: 'ready',
      writable: true,
    },
  }

  // 浏览器全局 mock
  const factories = new Map()
  globalThis.window = { __ModuleLoader__: { load: ({ id, factory }) => factories.set(id, factory) } }
  globalThis.document = {
    createElement: () => ({ style: {}, dataset: {}, textContent: '' }),
    head: { appendChild: (el) => captured.cssTags.push(el.dataset.pluginCss) },
    querySelector: () => null,
  }

  // 执行 bundle
  const src = readFileSync(join(rootDir, 'client.js'), 'utf8')
  // eslint-disable-next-line no-new-func
  new Function(src)()

  // 物化 factory
  const factory = factories.get('@anspire-ai/ai-search-dsh-plugin')
  assert.ok(factory, 'bundle 应注册 @anspire-ai/ai-search-dsh-plugin')

  const surface = factory((name) => {
    if (name === 'react') return mockReact
    throw new Error(`unexpected require: ${name}`)
  })
  assert.ok(surface && typeof surface.apply === 'function', 'factory 应返回含 apply 的 surface')

  // 浏览器插件上下文 mock
  const ctx = {
    effect(fn) { fn(); return () => {} },
    locale: {
      register(ns, dicts) {
        captured.localeDicts.set(ns, dicts)
        return () => captured.localeDicts.delete(ns)
      },
    },
    settingsScope: {
      bind({ namespace }) {
        assert.equal(namespace, 'anspire-ai-search', 'scope 应绑定插件命名空间')
        return {
          getSnapshot: () => captured.scopeSnapshots,
          subscribe: () => () => {},
          set: async (f, v) => { captured.sets.push([f, v]) },
          unset: async (f) => { captured.unsets.push(f) },
        }
      },
    },
    slots: {
      inject(slot, gen) {
        for (const item of gen()) captured.cards.push({ slot, item })
      },
      register(opts, comp) { return { opts, comp } },
    },
  }

  surface.apply(ctx)
  return { surface, captured }
}

/** 带 user 覆盖层的执行变体 */
function executeBundleWithUser(user) {
  // 复用 executeBundle 的流程，但先给 snapshot 模板加 user 层：
  // 直接改造 —— executeBundle 内部读取模块级模板，这里包装一层
  const result = executeBundleWithOverride({ user, value: { ...SNAPSHOT_TEMPLATE.value, ...user } })
  return result
}

const SNAPSHOT_TEMPLATE = {
  value: { region: 'ai-search-cn', timeoutMs: 30000, defaultTopK: 10 },
  base: { region: 'ai-search-cn', timeoutMs: 30000, defaultTopK: 10 },
  user: undefined,
  status: 'ready',
  writable: true,
}

function executeBundleWithOverride(snapshotOverride) {
  // 与 executeBundle 相同，只是 snapshot 可定制
  const captured = {
    localeDicts: new Map(),
    cards: [],
    cssTags: [],
    sets: [],
    unsets: [],
    scopeSnapshots: snapshotOverride,
  }
  const factories = new Map()
  globalThis.window = { __ModuleLoader__: { load: ({ id, factory }) => factories.set(id, factory) } }
  globalThis.document = {
    createElement: () => ({ style: {}, dataset: {}, textContent: '' }),
    head: { appendChild: (el) => captured.cssTags.push(el.dataset.pluginCss) },
    querySelector: () => null,
  }
  const src = readFileSync(join(rootDir, 'client.js'), 'utf8')
  // eslint-disable-next-line no-new-func
  new Function(src)()
  const factory = factories.get('@anspire-ai/ai-search-dsh-plugin')
  const surface = factory((name) => {
    if (name === 'react') return mockReact
    throw new Error(`unexpected require: ${name}`)
  })
  const ctx = {
    effect(fn) { fn(); return () => {} },
    locale: { register: (ns, d) => { captured.localeDicts.set(ns, d); return () => {} } },
    settingsScope: {
      bind({ namespace }) {
        return {
          getSnapshot: () => captured.scopeSnapshots,
          subscribe: () => () => {},
          set: async (f, v) => { captured.sets.push([f, v]) },
          unset: async (f) => { captured.unsets.push(f) },
        }
      },
    },
    slots: {
      inject(slot, gen) { for (const item of gen()) captured.cards.push({ slot, item }) },
      register(opts, comp) { return { opts, comp } },
    },
  }
  surface.apply(ctx)
  return { surface, captured }
}

test('bundle：__ModuleLoader__ 注册 + factory 物化 + CSS 注入', () => {
  const { captured } = executeBundle()
  assert.ok(captured.cssTags.includes('@anspire-ai/ai-search-dsh-plugin/card.css'), '应注入卡片样式')
})

test('apply()：注册 zh/en 文案字典', () => {
  const { captured } = executeBundle()
  const dict = captured.localeDicts.get('settings.plugins.anspire')
  assert.ok(dict, '应注册文案字典')
  assert.equal(dict.zh.title, 'Anspire AI 搜索')
  assert.equal(dict.en.title, 'Anspire AI Search')
  for (const key of ['apiKey', 'save', 'reset', 'discard', 'unsaved', 'readOnly', 'saveFailed']) {
    assert.ok(dict.zh[key], `zh 缺 ${key}`)
    assert.ok(dict.en[key], `en 缺 ${key}`)
  }
})

test('apply()：向 settings.plugin.item 槽注册卡片（keyed by 命名空间）', () => {
  const { captured } = executeBundle()
  assert.equal(captured.cards.length, 1)
  const { slot, item } = captured.cards[0]
  assert.equal(slot, 'settings.plugin.item')
  // 新版 slots 契约：keyed slot，options.key = settings 命名空间（REQ-006）
  assert.equal(item.opts.key, 'anspire-ai-search', 'key 应为 settings 命名空间')
  assert.equal(item.opts.id, undefined, 'keyed slot 不用 id（旧版字段）')
  assert.equal(item.opts.locale, 'settings.plugins.anspire')
  assert.equal(typeof item.comp, 'function')
})

test('inject()：声明 slots/locale/settingsScope 客户端依赖', () => {
  const { surface } = executeBundle()
  assert.deepEqual(surface.inject, ['slots', 'locale', 'settingsScope'])
})

test('表单：初始快照（available/writable/非 dirty/字段格式化）', () => {
  const { captured } = executeBundle()
  const face = captured.cards[0].item.opts.inject()
  const snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.available, true)
  assert.equal(snap.writable, true)
  assert.equal(snap.dirty, false)
  assert.equal(snap.apiKey.text, '', 'apiKey 无默认值')
  assert.equal(snap.region.text, 'ai-search-cn')
  assert.equal(snap.timeoutMs.text, '30000')
  assert.equal(snap.defaultTopK.text, '10')
  assert.equal(snap.apiKey.overridden, false)
})

test('表单：staged 编辑 → dirty/overridden；save 逐字段写入', async () => {
  const { captured } = executeBundle()
  const face = captured.cards[0].item.opts.inject()

  face.edit('apiKey', 'new-key-123')
  let snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.dirty, true)
  assert.equal(snap.apiKey.text, 'new-key-123')
  assert.equal(snap.apiKey.overridden, true)

  face.edit('timeoutMs', '15000')
  await face.save()
  assert.deepEqual(
    captured.sets,
    [
      ['apiKey', 'new-key-123'],
      ['timeoutMs', 15000],
    ],
    'save 应按 staged 顺序写入（string/number 类型正确）',
  )
})

test('表单：非法数字阻塞 save（invalid 拒绝写入）', async () => {
  const { captured } = executeBundle()
  const face = captured.cards[0].item.opts.inject()

  face.edit('timeoutMs', 'abc')
  let snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.invalid, true)
  assert.equal(snap.timeoutMs.invalid, true)

  await face.save()
  assert.deepEqual(captured.sets, [], 'invalid 时不写入')

  // 超范围同样阻塞（defaultTopK 合法区间 10-50）
  face.discard()
  face.edit('defaultTopK', '55')
  snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.defaultTopK.invalid, true, '55 超出 max=50')
  // timeoutMs 低于 min=1000
  face.edit('timeoutMs', '100')
  snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.timeoutMs.invalid, true, '100 低于 min=1000')
})

test('表单：resetField 对已有覆盖产生 unset（无覆盖时为 no-op）', async () => {
  // 场景 A：无 user 覆盖 → reset 不产生写入
  const a = executeBundle()
  const faceA = a.captured.cards[0].item.opts.inject()
  faceA.resetField('region')
  await faceA.save()
  assert.deepEqual(a.captured.unsets, [], '无覆盖时 reset 是 no-op（与官方 CardForm 语义一致）')

  // 场景 B：有 user 覆盖 → unset 写入
  // executeBundle 的 scopeSnapshots 是共享引用，注入 user 层再执行
  const b = executeBundleWithUser({ region: 'ai-search-global' })
  const faceB = b.captured.cards[0].item.opts.inject()
  faceB.resetField('region')
  const snap = faceB.hooks.anspireCard.getSnapshot()
  assert.equal(snap.dirty, true)
  await faceB.save()
  assert.deepEqual(b.captured.unsets, ['region'], '有覆盖时 reset 应 unset')
})

test('表单：discard 清空 staged', async () => {
  const { captured } = executeBundle()
  const face = captured.cards[0].item.opts.inject()
  face.edit('apiKey', 'x')
  face.discard()
  const snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.dirty, false)
  await face.save()
  assert.deepEqual(captured.sets, [])
})

test('REQ-009 守护：hooks 值是 store 形状（getSnapshot/subscribe），非函数', () => {
  const { captured } = executeBundle()
  const face = captured.cards[0].item.opts.inject()
  const hook = face.hooks.anspireCard

  assert.equal(typeof hook, 'object', 'hooks 值应为 store 对象')
  assert.equal(typeof hook.getSnapshot, 'function', 'store 应有 getSnapshot')
  assert.equal(typeof hook.subscribe, 'function', 'store 应有 subscribe')
  assert.notEqual(typeof hook, 'function', '不能是 selector 函数（v0.3.3 的故障形态）')

  // getSnapshot 返回完整投影
  const snap = hook.getSnapshot()
  assert.ok(snap.available !== undefined)
  assert.ok(snap.apiKey && snap.region && snap.timeoutMs && snap.defaultTopK)

  // subscribe 通知：编辑后监听器被触发
  let notified = 0
  const off = hook.subscribe(() => { notified++ })
  face.edit('apiKey', 'x')
  assert.ok(notified > 0, '编辑应触发订阅者')
  off()
})

test('REQ-010：region 枚举选择 + KEY 申请链接联动', async () => {
  const { captured } = executeBundle()
  const face = captured.cards[0].item.opts.inject()

  // 初始：默认国内
  let snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.region.text, 'ai-search-cn')
  assert.equal(snap.region.stagedValue, 'ai-search-cn')

  // 切换到 global（staged，未保存）→ stagedValue 即时变化（链接联动数据源）
  face.edit('region', 'ai-search-global')
  snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.region.text, 'ai-search-global')
  assert.equal(snap.region.stagedValue, 'ai-search-global')
  assert.equal(snap.region.overridden, true)

  // 保存 → 写入 region 字段
  await face.save()
  assert.deepEqual(captured.sets, [['region', 'ai-search-global']])

  // 非法区域值被拒绝（invalid 阻塞保存）
  face.edit('region', 'ai-search-unknown')
  snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.region.invalid, true, '未知区域应 invalid')
})

test('REQ-010：文案字典含区域与申请链接文案', () => {
  const { captured } = executeBundle()
  const dict = captured.localeDicts.get('settings.plugins.anspire')
  assert.equal(dict.zh.getKey, '获取 anspire-ai-search api-key')
  assert.equal(dict.en.getKey, 'Get an anspire-ai-search api-key')
  assert.ok(dict.zh.region && dict.zh.regionHint)
})

test('REQ-011 守护：secret 字段写入按未拒绝判定，不比对脱敏回读', async () => {
  // 复刻真实 wire 行为：redactSecrets 剥离 role('secret') 字段 ——
  // set 成功后 user 层回读 apiKey 仍无明文（旧实现在此误判失败）
  const { captured } = executeBundleWithSecretRedaction()
  const face = captured.cards[0].item.opts.inject()

  face.edit('apiKey', 'my-secret-key')
  await face.save()

  // 写入调用应发生且成功
  assert.deepEqual(captured.sets, [['apiKey', 'my-secret-key']])
  const snap = face.hooks.anspireCard.getSnapshot()
  assert.equal(snap.failed, false, 'secret 写入不应因回读无明文而误报失败')
  assert.equal(snap.dirty, false, '保存成功后应清空 staged')

  // 写入被拒（set reject）才是失败
  const b = executeBundleWithSecretRedaction({ rejectSet: true })
  const faceB = b.captured.cards[0].item.opts.inject()
  faceB.edit('apiKey', 'k2')
  await faceB.save()
  assert.equal(faceB.hooks.anspireCard.getSnapshot().failed, true, 'set 被拒应报失败')
})

/** 带 secret 脱敏行为的执行变体：user 层回读不含 apiKey 明文（对齐 redactSecrets） */
function executeBundleWithSecretRedaction(opts = {}) {
  const captured = {
    localeDicts: new Map(),
    cards: [],
    cssTags: [],
    sets: [],
    unsets: [],
    // 模拟：value 有默认值；user 层写入后不含 secret 明文（wire 已脱敏）
    scopeSnapshots: {
      value: { region: 'ai-search-cn', timeoutMs: 30000, defaultTopK: 10 },
      base: { region: 'ai-search-cn', timeoutMs: 30000, defaultTopK: 10 },
      user: undefined,
      status: 'ready',
      writable: true,
    },
  }
  const factories = new Map()
  globalThis.window = { __ModuleLoader__: { load: ({ id, factory }) => factories.set(id, factory) } }
  globalThis.document = {
    createElement: () => ({ style: {}, dataset: {}, textContent: '' }),
    head: { appendChild: (el) => captured.cssTags.push(el.dataset.pluginCss) },
    querySelector: () => null,
  }
  const src = readFileSync(join(rootDir, 'client.js'), 'utf8')
  // eslint-disable-next-line no-new-func
  new Function(src)()
  const factory = factories.get('@anspire-ai/ai-search-dsh-plugin')
  const surface = factory((name) => {
    if (name === 'react') return mockReact
    throw new Error(`unexpected require: ${name}`)
  })
  const ctx = {
    effect(fn) { fn(); return () => {} },
    locale: { register: (ns, d) => { captured.localeDicts.set(ns, d); return () => {} } },
    settingsScope: {
      bind() {
        return {
          // 真实行为：快照 getter 每次重算（user 层脱敏：secret 字段存在但值被剥为标记）
          getSnapshot: () => captured.scopeSnapshots,
          subscribe: () => () => {},
          set: async (f, v) => {
            if (opts.rejectSet) throw new Error('write refused')
            captured.sets.push([f, v])
            // redactSecrets 行为：user 层记录字段存在，但 secret 值不回显
            captured.scopeSnapshots = {
              ...captured.scopeSnapshots,
              user: { ...captured.scopeSnapshots.user, [f]: f === 'apiKey' ? undefined : v },
            }
          },
          unset: async (f) => { captured.unsets.push(f) },
        }
      },
    },
    slots: {
      inject(slot, gen) { for (const item of gen()) captured.cards.push({ slot, item }) },
      register(opts2, comp) { return { opts: opts2, comp } },
    },
  }
  surface.apply(ctx)
  return { surface, captured }
}
