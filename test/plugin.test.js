import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * 插件加载回归测试（REQ-002）
 *
 * 背景：v0.1.0 中 index.js 含 TS 语法、tool.js 导入缺失的 peer 依赖，
 * 导致 dsh 安装后插件静默加载失败。此文件守护完整加载链路：
 * import 入口 → apply(ctx) → ctx.tools.register(def) → def.execute()
 */

test('插件入口：纯 JS 可被 Node 直接加载（无 TS 语法/缺失依赖）', async () => {
  const plugin = await import('../index.js')
  assert.equal(plugin.name, 'anspire-ai-search')
  assert.deepEqual(plugin.inject, ['tools'])
  // REQ-003：不导出 Config —— cordis loader 要求 Config["~standard"].validate
  // （Standard Schema 接口），普通对象会 TypeError。配置直接经 patch 行流入 apply。
  assert.equal(plugin.Config, undefined)
  assert.equal(typeof plugin.apply, 'function')
})

test('apply()：对 config 为 undefined 的调用容错（loader 对无 config 行的形态）', async () => {
  const plugin = await import('../index.js')
  const registered = []
  const ctx = {
    tools: { register: (def) => { registered.push(def); return () => {} } },
    inject: () => () => {}, // settings 服务缺席：可选注入不回调
  }
  plugin.apply(ctx, undefined)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'anspire_search')
})

test('apply()：向 ctx.tools 注册 anspire_search 工具', async () => {
  const plugin = await import('../index.js')
  const registered = []
  const disposers = []
  const ctx = {
    tools: {
      register(def) {
        registered.push(def)
        return () => disposers.push(def.name)
      },
    },
    inject: () => () => {}, // REQ-004：settings 可选注入缺席时的形态
  }

  const dispose = plugin.apply(ctx, undefined)
  assert.equal(registered.length, 1)
  assert.equal(typeof dispose, 'function')

  const tool = registered[0]
  assert.equal(tool.name, 'anspire_search')
  assert.ok(tool.description.length > 10)
})

test('工具定义：parameters 为编译后的 JSON Schema 形态', async () => {
  const { makeCtx, loadTool } = await import('./helpers.js')
  const tool = await loadTool()
  const p = tool.parameters

  assert.equal(p.type, 'object')
  assert.deepEqual(p.required, ['query'])
  const props = p.properties
  assert.deepEqual(Object.keys(props).sort(), [
    'fromTime', 'insite', 'query', 'regionMode', 'searchType', 'toTime', 'topK',
  ])
  assert.equal(props.query.type, 'string')
  assert.deepEqual(props.topK.enum, [10, 20, 30, 40, 50])
  assert.deepEqual(props.searchType.enum, ['web', 'image', 'video'])
  assert.deepEqual(props.regionMode.enum, [0, 1, 2])
})

test('工具定义：output.render 返回 TextBlock 数组', async () => {
  const { loadTool } = await import('./helpers.js')
  const tool = await loadTool()
  const blocks = tool.output.render({ query: 'x' }, '结果文本')
  assert.ok(Array.isArray(blocks))
  assert.equal(blocks[0].type, 'text')
  assert.equal(blocks[0].text, '结果文本')
})

test('execute：缺 API KEY 返回配置指引（规范值，非异常）', async () => {
  const { loadTool } = await import('./helpers.js')
  const tool = await loadTool()
  const saved = {}
  for (const k of ['ANSPIRE_API_KEY', 'ANPSIRE_API_KEY', 'DSP_ANSPIRE_KEY']) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
  try {
    const out = await tool.execute({ query: '北京天气' }, {})
    assert.ok(out.includes('ANSPIRE_API_KEY'), '应提示设置环境变量')
    assert.ok(!out.includes('Error'), '不应是异常文本')
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v !== undefined) process.env[k] = v
    }
  }
})

test('execute：非法参数返回校验错误列表（规范值，非异常）', async () => {
  const { loadTool } = await import('./helpers.js')
  const tool = await loadTool()
  const out = await tool.execute({ query: '', topK: 15, searchType: 'news' }, {})
  assert.ok(out.startsWith('参数错误'))
  assert.ok(out.includes('query'))
  assert.ok(out.includes('topK'))
  assert.ok(out.includes('searchType'))
})

test('execute：模拟 API 返回后正确渲染（web 类型）', async () => {
  const { loadToolWithApi } = await import('./helpers.js')
  const tool = await loadToolWithApi({
    query: '你好',
    Uuid: 'test-uuid',
    results: [
      {
        title: '你好 - 百科',
        content: '打招呼用语',
        url: 'https://baike.example.com',
        score: 0.87,
        date: '2025-07-23 11:21:12',
      },
    ],
  })
  const out = await tool.execute({ query: '你好' }, {})
  assert.ok(out.includes('[1] 你好 - 百科'))
  assert.ok(out.includes('https://baike.example.com'))
  assert.ok(out.includes('2025-07-23 11:21:12'))
  assert.ok(out.includes('0.870'))
})

test('execute：网络错误返回友好信息（规范值，非异常）', async () => {
  const { loadToolWithApi } = await import('./helpers.js')
  const tool = await loadToolWithApi(new Error('fetch failed'), { throwNetwork: true })
  const out = await tool.execute({ query: 'x' }, {})
  assert.ok(out.startsWith('搜索失败'))
})

test('execute：401 返回鉴权失败指引', async () => {
  const { loadToolWithApi } = await import('./helpers.js')
  const tool = await loadToolWithApi(null, { status: 401 })
  const out = await tool.execute({ query: 'x' }, {})
  assert.ok(out.includes('401'))
  assert.ok(out.includes('ANSPIRE_API_KEY'))
})
