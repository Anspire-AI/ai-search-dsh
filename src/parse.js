/**
 * Anspire AI Search 响应解析
 *
 * 响应形态：
 * 1. 通用类：results 为数组，元素含 title/content/url/score/date（web、video）
 * 2. 图片类：results 为数组，元素含 title/image{url,width,height}/date
 * 3. 垂类卡：results 为 JSON String，内部是 [{ vr, vr_category, display:{...} }]，
 *    display 内可能还有 kdJsonStr 二次嵌套 JSON 字符串
 */

const MAX_CONTENT_LEN = 300

/** 解析可能的多层嵌套 JSON 字符串（防御式，失败返回 null） */
function tryParseJson(s) {
  if (typeof s !== 'string' || !s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** 提取垂类卡 display 中对模型最有价值的字段 */
function extractVrFields(item) {
  const display = item?.display ?? item
  const fields = {
    title: display?.title ?? display?.ContentTitle ?? null,
    content: display?.content ?? display?.abstract_info ?? null,
    url: display?.url ?? null,
    date: display?.date ?? null,
    vrCategory: item?.vr_category ?? null,
  }

  // kdJsonStr 深层嵌套：再尝试提取一次摘要
  if (!fields.content) {
    const kd = tryParseJson(display?.kdJsonStr)
    if (kd) {
      const card = kd?.module_list?.[0]?.item_list?.[0]?.data?.card
      if (card) {
        fields.content = card.dynAbstract ?? card.abstract_info ?? null
        fields.title = fields.title ?? card.title ?? null
      }
    }
  }

  return fields
}

/**
 * 将 API 原始响应解析为规整的结果列表
 * @returns {{ type: 'web'|'image'|'video'|'vr', items: object[] }}
 */
export function parseResponse(raw, searchType = 'web') {
  if (!raw || typeof raw !== 'object') {
    return { type: searchType, items: [] }
  }

  const results = raw.results

  // 垂类卡：JSON 字符串形态
  if (typeof results === 'string') {
    const arr = tryParseJson(results)
    if (Array.isArray(arr)) {
      const items = arr.map(extractVrFields).filter((x) => x.title || x.content || x.url)
      if (items.length) return { type: 'vr', items }
    }
    return { type: 'vr', items: [] }
  }

  if (!Array.isArray(results)) {
    return { type: searchType, items: [] }
  }

  if (searchType === 'image') {
    const items = results
      .map((r) => ({
        title: r?.title ?? null,
        url: r?.image?.url ?? null,
        width: r?.image?.width ?? null,
        height: r?.image?.height ?? null,
        date: r?.date ?? null,
      }))
      .filter((x) => x.url)
    return { type: 'image', items }
  }

  // web / video
  const items = results
    .map((r) => ({
      title: r?.title ?? null,
      content: r?.content ?? null,
      url: r?.url ?? null,
      score: typeof r?.score === 'number' ? r.score : null,
      date: r?.date ?? null,
    }))
    .filter((x) => x.url || x.title)
  return { type: searchType, items }
}

/**
 * 渲染为模型友好的结构化文本
 * @param {{ type: string, items: object[] }} parsed
 * @param {{ query: string, uuid?: string }} meta
 */
export function renderAsText(parsed, meta = {}) {
  const { type, items } = parsed
  const header =
    `Anspire AI Search 结果（type=${type}，共 ${items.length} 条）` +
    (meta.query ? ` | query: ${meta.query}` : '') +
    (meta.uuid ? ` | uuid: ${meta.uuid}` : '') +
    '\n'

  if (!items.length) {
    return header + '（无结果。可尝试更换搜索词、放宽时间范围，或切换 searchType/regionMode。）'
  }

  const lines = items.map((it, i) => {
    const idx = `[${i + 1}] `
    if (type === 'image') {
      return (
        `${idx}${it.title ?? '(无标题)'}\n` +
        `    图片: ${it.url}\n` +
        `    尺寸: ${it.width ?? '?'}x${it.height ?? '?'}` +
        (it.date ? `\n    日期: ${it.date}` : '')
      )
    }
    if (type === 'vr') {
      return (
        `${idx}${cleanTitle(it.title)}${it.vrCategory ? ` [${it.vrCategory}]` : ''}\n` +
        (it.content ? `    摘要: ${clip(it.content)}` : '') +
        (it.url ? `\n    链接: ${it.url}` : '') +
        (it.date ? `\n    日期: ${it.date}` : '')
      )
    }
    return (
      `${idx}${cleanTitle(it.title)}\n` +
      (it.url ? `    链接: ${it.url}\n` : '') +
      `    摘要: ${clip(it.content ?? '(无摘要)')}` +
      (it.date ? `\n    日期: ${it.date}` : '') +
      (it.score !== null ? `\n    相关度: ${it.score.toFixed(3)}` : '')
    )
  })

  return header + lines.join('\n\n')
}

/** 去除标题中的飘红控制符（ 开始 /  结束） */
function cleanTitle(t) {
  if (typeof t !== 'string') return '(无标题)'
  return t.replace(/|/g, '').trim() || '(无标题)'
}

function clip(s, n = MAX_CONTENT_LEN) {
  if (typeof s !== 'string') return '(无摘要)'
  const out = s.replace(/\s+/g, ' ').trim()
  return out.length > n ? `${out.slice(0, n)}…` : out
}
