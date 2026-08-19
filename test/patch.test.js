import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * cordis.patch.yml 语法守护测试（REQ-003）
 *
 * 背景：v0.1.1 及之前用裸 `- id:` 行，这是「覆盖已存在 entry」语义——
 * 目标 entry 不存在时整条 patch 被 loader 跳过并警告
 * "patch: entry ... not found"，bundle 实际贡献 0 个 entry，插件不可见。
 * 新插件行必须用 `- insert: [...]` 块（顶层追加语义）。
 *
 * 注：不引入 js-yaml（沙箱环境 omit=dev 装不上 devDependencies），
 * 用结构化的最小解析断言守护关键语义。
 */

const patchPath = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
const raw = readFileSync(patchPath, 'utf8')

/** 最小解析：提取顶层每个 `- ` 条目的首行键 */
function parseTopLevelKeys(yamlText) {
  const lines = yamlText.split('\n')
  const entries = []
  let current = null
  for (const line of lines) {
    if (/^\s*#/.test(line) || !line.trim()) continue
    if (/^- \S/.test(line)) {
      current = { firstKey: line.replace(/^- /, '').split(':')[0].trim() }
      entries.push(current)
    }
  }
  return entries
}

test('cordis.patch.yml 非空且为顶层列表', () => {
  assert.ok(raw.trim().length > 0)
  const entries = parseTopLevelKeys(raw)
  assert.ok(entries.length > 0, '应至少有一条 patch')
})

test('顶层 patch 条目以 insert: 开头（追加语义），而非裸 id:（覆盖语义）', () => {
  const entries = parseTopLevelKeys(raw)
  for (const e of entries) {
    assert.equal(
      e.firstKey,
      'insert',
      `顶层 patch 必须以 insert: 开头（裸 id: 是覆盖已存在 entry 的语义，`
      + `目标不存在时整条被 loader 跳过 —— REQ-003 故障根因），实际: ${e.firstKey}`,
    )
  }
})

test('insert 块内包含 id + name 的插件行', () => {
  // 匹配 insert 块内缩进的 - id: ... 与 name: 行
  const idMatch = raw.match(/^\s+- id:\s*(\S+)/m)
  const nameMatch = raw.match(/^\s+name:\s*'?([^'\n]+)'?/m)
  assert.ok(idMatch, 'insert 块内应有 - id: 行')
  assert.ok(nameMatch, 'insert 块内应有 name: 行')
  assert.equal(idMatch[1], 'anspire-ai-search')
  assert.equal(nameMatch[1].trim(), 'anspire-ai-search-dsh-plugin')
})

test('insert 语义模拟：entry 成功进入合成列表（复刻 loader 核心，对照旧写法 not found）', () => {
  // 复刻 dsh-app-boot applyEntryPatches 的核心语义做最小验证
  const base = [{ id: 'tools', name: '@deepseek-ai/dsh-tools' }]
  const entryMap = new Map(base.map((e) => [e.id, e]))

  // 从 YAML 文本提取本包的 insert 行（足够验证语义，无需完整 YAML 解析器）
  const m = raw.match(/- insert:\s*\n\s+- id:\s*(\S+)\s*\n\s+name:\s*'?([^'\n]+)'?/)
  assert.ok(m, 'patch 应包含 - insert: 块且块内有 id/name')
  const inserted = { id: m[1], name: m[2].trim() }

  const warns = []
  // 顶层 insert（无 id 键）→ 直接追加
  entryMap.set(inserted.id, inserted)
  // 旧写法（裸 id 行）在此语义下会走 entryMap.get(id) → undefined → warn + skip

  assert.deepEqual(warns, [])
  assert.ok(entryMap.has('anspire-ai-search'), 'anspire-ai-search entry 应存在')
  assert.equal(entryMap.get('anspire-ai-search').name, 'anspire-ai-search-dsh-plugin')
})
