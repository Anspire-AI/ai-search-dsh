import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSearchUrl,
  validateParams,
  readApiKey,
  VALID_TOP_K,
} from '../src/api.js'

test('buildSearchUrl: 仅 query 时使用最小参数', () => {
  const url = buildSearchUrl({ query: '你好' })
  assert.equal(url.href, 'https://plugin.anspire.cn/api/ntsearch/search?query=%E4%BD%A0%E5%A5%BD')
})

test('buildSearchUrl: 全参数正确拼接', () => {
  const url = buildSearchUrl({
    query: '北京天气',
    topK: 20,
    insite: 'sohu.com,zhihu.com',
    fromTime: '2025-01-01 00:00:00',
    toTime: '2025-06-30 23:59:59',
    searchType: 'web',
    regionMode: 2,
  })
  assert.equal(url.pathname, '/api/ntsearch/search')
  const p = url.searchParams
  assert.equal(p.get('query'), '北京天气')
  assert.equal(p.get('top_k'), '20')
  assert.equal(p.get('Insite'), 'sohu.com,zhihu.com')
  assert.equal(p.get('FromTime'), '2025-01-01 00:00:00')
  assert.equal(p.get('ToTime'), '2025-06-30 23:59:59')
  assert.equal(p.get('search_type'), 'web')
  assert.equal(p.get('region_mode'), '2')
})

test('buildSearchUrl: 自定义 baseUrl', () => {
  const url = buildSearchUrl({ query: 'x' }, 'https://example.test')
  assert.equal(url.origin, 'https://example.test')
})

test('buildSearchUrl: 参数缺省时不产生空参数', () => {
  const url = buildSearchUrl({ query: 'x', insite: undefined, fromTime: '' })
  const keys = [...url.searchParams.keys()]
  assert.deepEqual(keys.sort(), ['query'])
})

test('validateParams: 合法参数通过', () => {
  const errors = validateParams({
    query: 'test',
    topK: 50,
    insite: 'a.com',
    searchType: 'image',
    regionMode: 1,
    fromTime: '2025-01-01 00:00:00',
    toTime: '2025-12-31 00:00:00',
  })
  assert.deepEqual(errors, [])
})

test('validateParams: 空 query 报错', () => {
  assert.ok(validateParams({ query: '' }).some((e) => e.includes('query')))
  assert.ok(validateParams({ query: '   ' }).some((e) => e.includes('query')))
})

test('validateParams: query 超长报错', () => {
  assert.ok(validateParams({ query: 'a'.repeat(65) }).some((e) => e.includes('64')))
})

test('validateParams: 非法 topK 报错', () => {
  assert.ok(validateParams({ query: 'x', topK: 15 }).some((e) => e.includes('topK')))
})

test('validateParams: 非法 searchType 报错', () => {
  assert.ok(validateParams({ query: 'x', searchType: 'news' }).some((e) => e.includes('searchType')))
})

test('validateParams: 非法 regionMode 报错', () => {
  assert.ok(validateParams({ query: 'x', regionMode: 5 }).some((e) => e.includes('regionMode')))
})

test('validateParams: Insite 超 20 个站点报错', () => {
  const insite = Array.from({ length: 21 }, (_, i) => `s${i}.com`).join(',')
  assert.ok(validateParams({ query: 'x', insite }).some((e) => e.includes('20')))
})

test('validateParams: FromTime 晚于 ToTime 报错', () => {
  const errors = validateParams({
    query: 'x',
    fromTime: '2025-06-01 00:00:00',
    toTime: '2025-01-01 00:00:00',
  })
  assert.ok(errors.some((e) => e.includes('FromTime')))
})

test('validateParams: topK 合法值集合', () => {
  for (const k of VALID_TOP_K) {
    assert.deepEqual(validateParams({ query: 'x', topK: k }), [])
  }
})

test('readApiKey: 按优先级取第一个非空', () => {
  assert.equal(readApiKey({ ANSPIRE_API_KEY: 'k1', ANPSIRE_API_KEY: 'k2' }), 'k1')
  assert.equal(readApiKey({ ANPSIRE_API_KEY: 'k2' }), 'k2')
  assert.equal(readApiKey({ DSP_ANSPIRE_KEY: 'k3' }), 'k3')
  assert.equal(readApiKey({}), undefined)
  assert.equal(readApiKey({ ANSPIRE_API_KEY: '   ' }), undefined)
})
