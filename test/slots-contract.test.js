import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * REQ-006：用【真实最新版】@deepseek-ai/dsh-client-ui-slots 的 SlotCore 验证卡片注册。
 *
 * 背景：v0.3.0 依据旧版 rc 包写注册参数（options.id），
 * 真实运行时（0.1.0-rc.7+）的 settings.plugin.item 已是 keyed slot，
 * 注册时报 "keyed slot requires options.key"，插件加载失败。
 * 本文件在真实 SlotCore 上跑一遍注册路径，防止 mock 与真实契约再次漂移。
 *
 * 依赖：@deepseek-ai/dsh-client-ui-slots（dependencies，npm install 安装）。
 */

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const mockReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useId: () => 'test-id',
  useState: (v) => [v, () => {}],
  useSyncExternalStore: (sub, get) => get(),
}

/** 执行 client.js bundle，返回 surface（apply/inject） */
function materializeBundle() {
  const factories = new Map()
  globalThis.window = { __ModuleLoader__: { load: ({ id, factory }) => factories.set(id, factory) } }
  globalThis.document ??= {
    createElement: () => ({ style: {}, dataset: {}, textContent: '' }),
    head: { appendChild: () => {} },
    querySelector: () => null,
  }
  const src = readFileSync(join(rootDir, 'client.js'), 'utf8')
  // eslint-disable-next-line no-new-func
  new Function(src)()
  const factory = factories.get('anspire-ai-search-dsh-plugin')
  assert.ok(factory, 'bundle 应注册 factory')
  return factory((name) => {
    if (name === 'react') return mockReact
    throw new Error(`unexpected require: ${name}`)
  })
}

test('真实 SlotCore：settings.plugin.item keyed 注册成功（旧写法在此抛 options.key）', async (t) => {
  let SlotCore
  try {
    ;({ SlotCore } = await import('@deepseek-ai/dsh-client-ui-slots'))
  } catch {
    t.skip('slots 包未安装（devDependency；沙箱 omit=dev 环境跳过，CI/本地 npm install 后运行）')
  }
  const ledger = new SlotCore()

  // root 是内置 single 槽；经它的 children 表声明 settings.plugin.item（keyed）
  ledger.register({
    name: 'root',
    children: { 'settings.plugin.item': { kind: 'keyed', scope: 'root' } },
  }, () => null)

  // 把 client.js 的 slots.inject 调用桥接到真实 SlotCore：
  // client.js 用法是 ctx.slots.inject(slot, generator)，generator yield ctx.slots.register(...)
  // SlotCore 没有 inject 组合辅助（那在运行时壳里）——桥接为逐项 register
  const pending = []
  const ctxSlots = {
    register: (opts, comp) => ledger.register(opts, comp),
    inject: (slot, gen) => {
      for (const item of gen()) {
        // generator yield 的就是 register 的返回值；上面 register 已桥接，直接收集
        pending.push(item)
      }
    },
  }

  const surface = materializeBundle()
  const ctx = {
    effect(fn) { fn(); return () => {} },
    locale: { register: () => () => {} },
    settingsScope: {
      bind() {
        return {
          getSnapshot: () => ({ status: 'ready', writable: true, value: {}, base: {}, user: undefined }),
          subscribe: () => () => {},
          set: async () => {},
          unset: async () => {},
        }
      },
    },
    slots: ctxSlots,
  }

  // 真实 SlotCore.register 在参数不合约时同步抛错 —— v0.3.0 的旧写法在这里就会炸
  surface.apply(ctx)

  const entries = ledger.entries('settings.plugin.item')
  assert.equal(entries.length, 1, '应注册成功 1 张卡片')
  assert.equal(entries[0].options.key, 'anspire-ai-search', 'key 应为 settings 命名空间')
  assert.equal(typeof entries[0].component, 'function')
})

test('真实 SlotCore：对照——旧写法（无 key）确实被拒绝', async (t) => {
  let SlotCore
  try {
    ;({ SlotCore } = await import('@deepseek-ai/dsh-client-ui-slots'))
  } catch {
    t.skip('slots 包未安装（devDependency；沙箱 omit=dev 环境跳过）')
  }
  const ledger = new SlotCore()
  ledger.register({
    name: 'root',
    children: { 'settings.plugin.item': { kind: 'keyed', scope: 'root' } },
  }, () => null)

  assert.throws(
    () => ledger.register({ name: 'settings.plugin.item', id: 'x' }, () => null),
    /requires options\.key/,
    '旧写法应被真实 SlotCore 拒绝（确认测试有效性）',
  )
})
