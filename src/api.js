/**
 * Anspire AI Search API 客户端
 * 文档: https://open.anspire.cn/document/docs/searchApi/
 */

const DEFAULT_BASE_URL = 'https://plugin.anspire.cn'
const SEARCH_PATH = '/api/ntsearch/search'

/** 兼容环境变量多种拼写（历史文档/客户配置常见） */
const ENV_KEYS = ['ANSPIRE_API_KEY', 'ANPSIRE_API_KEY', 'DSP_ANSPIRE_KEY']

export const VALID_SEARCH_TYPES = ['web', 'image', 'video']
export const VALID_TOP_K = [10, 20, 30, 40, 50]
export const VALID_REGION_MODES = [0, 1, 2]

export function readApiKey(env = process.env) {
  for (const key of ENV_KEYS) {
    const v = env[key]
    if (v && typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/**
 * 构建搜索请求 URL（GET 查询串）
 * @returns {URL} URL 对象（含全部查询参数）
 */
export function buildSearchUrl(params, baseUrl = DEFAULT_BASE_URL) {
  const { query, topK, insite, fromTime, toTime, searchType, regionMode } = params
  const url = new URL(SEARCH_PATH, baseUrl)
  url.searchParams.set('query', query)
  if (topK !== undefined) url.searchParams.set('top_k', String(topK))
  if (insite) url.searchParams.set('Insite', insite)
  if (fromTime) url.searchParams.set('FromTime', fromTime)
  if (toTime) url.searchParams.set('ToTime', toTime)
  if (searchType) url.searchParams.set('search_type', searchType)
  if (regionMode !== undefined) url.searchParams.set('region_mode', String(regionMode))
  return url
}

/**
 * 校验搜索参数，返回错误消息数组（空数组 = 通过）
 */
export function validateParams(params) {
  const errors = []
  const { query, topK, insite, fromTime, toTime, searchType, regionMode } = params

  if (!query || typeof query !== 'string' || !query.trim()) {
    errors.push('query 不能为空')
  } else if (query.length > 64) {
    errors.push(`query 长度不能超过 64 个字符（当前 ${query.length}）`)
  }

  if (topK !== undefined) {
    if (!VALID_TOP_K.includes(topK)) {
      errors.push(`topK 只能是 ${VALID_TOP_K.join('/')}（当前 ${topK}）`)
    }
  }

  if (insite !== undefined && insite !== '') {
    const sites = insite.split(',').map((s) => s.trim()).filter(Boolean)
    if (sites.length === 0) {
      errors.push('Insite 格式：站点域名用英文逗号分隔，如 sohu.com,zhihu.com')
    } else if (sites.length > 20) {
      errors.push(`Insite 最多指定 20 个站点（当前 ${sites.length} 个）`)
    }
  }

  if (searchType !== undefined && !VALID_SEARCH_TYPES.includes(searchType)) {
    errors.push(`searchType 只能是 ${VALID_SEARCH_TYPES.join('/')}（当前 ${searchType}）`)
  }

  if (regionMode !== undefined && !VALID_REGION_MODES.includes(regionMode)) {
    errors.push(`regionMode 只能是 0/1/2（当前 ${regionMode}）`)
  }

  if (fromTime && toTime && fromTime > toTime) {
    errors.push('FromTime 不能晚于 ToTime')
  }

  return errors
}

/**
 * 发起搜索请求
 * @param {object} options
 * @returns {Promise<object>} 解析后的响应 JSON
 * @throws {AnspireApiError} 网络/HTTP/业务错误
 */
export async function search(params, { baseUrl, apiKey, timeoutMs = 30_000, signal } = {}) {
  const url = buildSearchUrl(params, baseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)

  // 外部取消信号联动（exec.signal）
  let outerAbort
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    outerAbort = () => controller.abort(signal.reason)
    signal.addEventListener('abort', outerAbort, { once: true })
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: '*/*',
        Connection: 'keep-alive',
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new AnspireApiError(
        `HTTP ${res.status}${body ? `: ${truncate(body, 200)}` : ''}`,
        res.status,
      )
    }

    return await res.json()
  } catch (err) {
    if (err instanceof AnspireApiError) throw err
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new AnspireApiError(`请求超时或被取消（${timeoutMs}ms）`, 'TIMEOUT')
    }
    throw new AnspireApiError(`网络错误: ${err.message}`, 'NETWORK')
  } finally {
    clearTimeout(timer)
    if (signal && outerAbort) signal.removeEventListener('abort', outerAbort)
  }
}

export class AnspireApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'AnspireApiError'
    this.status = status
  }
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
