import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseResponse, renderAsText } from '../src/parse.js'

const WEB_RESP = {
  query: '你好',
  Uuid: 'bf4c8123-eda9-449a-bbf1-307f2e0d0d67',
  results: [
    {
      title: '你好 - 搜狗百科',
      content: '你好(英文:hello),读音为nǐ hǎo,汉语词语。',
      url: 'http://baike.sogou.com/v61690479.htm',
      score: 0.86890346,
      date: '2025-07-23 11:21:12',
    },
    {
      title: '《你好》 - 汽水音乐',
      content: '相关歌曲...',
      url: 'https://www.douyin.com/qishui/playlist/1',
      score: 0.7470434,
      date: '2025-07-23 11:21:14',
    },
  ],
}

const IMAGE_RESP = {
  query: '风景',
  Uuid: 'img-uuid',
  results: [
    {
      id: 1,
      title: '山水风景图',
      image: { url: 'https://img.example.com/1.jpg', width: 1920, height: 1080 },
      date: '2025-07-11T13:00:08+08:00',
    },
    { id: 2, title: '无图结果', image: null, date: null },
  ],
}

describe('parseResponse', () => {
  test('web：解析 title/content/url/score/date', () => {
    const { type, items } = parseResponse(WEB_RESP, 'web')
    assert.equal(type, 'web')
    assert.equal(items.length, 2)
    assert.equal(items[0].title, '你好 - 搜狗百科')
    assert.equal(items[0].url, 'http://baike.sogou.com/v61690479.htm')
    assert.equal(items[0].score, 0.86890346)
    assert.equal(items[0].date, '2025-07-23 11:21:12')
  })

  test('image：解析 image.url/width/height，过滤无图项', () => {
    const { type, items } = parseResponse(IMAGE_RESP, 'image')
    assert.equal(type, 'image')
    assert.equal(items.length, 1)
    assert.equal(items[0].url, 'https://img.example.com/1.jpg')
    assert.equal(items[0].width, 1920)
    assert.equal(items[0].height, 1080)
  })

  test('video：与 web 同构', () => {
    const { type, items } = parseResponse(WEB_RESP, 'video')
    assert.equal(type, 'video')
    assert.ok(items[0].url)
  })

  test('垂类卡：results 为 JSON String 时解析嵌套结构', () => {
    const vrArr = [
      {
        vr: true,
        vr_category: 'baike',
        display: {
          url: 'https://baike.sogou.com/v107486.htm',
          title: '天气 - 搜狗百科',
          content: null,
          date: '2025-04-13',
          abstract_info: '天气是指一定区域一定时间内大气中发生的各种气象变化。',
        },
      },
    ]
    const resp = { query: '天气', Uuid: 'vr-uuid', results: JSON.stringify(vrArr) }
    const { type, items } = parseResponse(resp, 'web')
    assert.equal(type, 'vr')
    assert.equal(items.length, 1)
    assert.equal(items[0].title, '天气 - 搜狗百科')
    assert.equal(items[0].vrCategory, 'baike')
    assert.equal(items[0].content.includes('气象变化'), true)
    assert.equal(items[0].url, 'https://baike.sogou.com/v107486.htm')
  })

  test('垂类卡：kdJsonStr 深层嵌套时提取 card 摘要', () => {
    const card = { title: '黄金价格', dynAbstract: '今日金价 615 元/克。' }
    const kd = { module_list: [{ item_list: [{ data: { card } }] }] }
    const vrArr = [
      {
        vr: true,
        vr_category: 'gold',
        display: {
          url: 'https://gold.example.com',
          title: null,
          content: null,
          kdJsonStr: JSON.stringify(kd),
        },
      },
    ]
    const resp = { query: '金价', results: JSON.stringify(vrArr) }
    const { type, items } = parseResponse(resp, 'web')
    assert.equal(type, 'vr')
    assert.equal(items[0].title, '黄金价格')
    assert.ok(items[0].content.includes('615'))
  })

  test('垂类卡：JSON String 解析失败时降级为空结果', () => {
    const resp = { query: 'x', results: 'not-json{{{' }
    const { type, items } = parseResponse(resp, 'web')
    assert.equal(type, 'vr')
    assert.deepEqual(items, [])
  })

  test('健壮性：null/非对象输入不抛异常', () => {
    assert.deepEqual(parseResponse(null, 'web'), { type: 'web', items: [] })
    assert.deepEqual(parseResponse(undefined, 'web'), { type: 'web', items: [] })
    assert.deepEqual(parseResponse('string', 'web'), { type: 'web', items: [] })
  })

  test('健壮性：results 非数组非字符串时不抛异常', () => {
    const resp = { query: 'x', results: 42 }
    assert.deepEqual(parseResponse(resp, 'web'), { type: 'web', items: [] })
  })
})

describe('renderAsText', () => {
  test('web：输出编号列表含全部字段', () => {
    const parsed = parseResponse(WEB_RESP, 'web')
    const text = renderAsText(parsed, { query: '你好', uuid: 'bf4c8123' })
    assert.ok(text.includes('[1] 你好 - 搜狗百科'))
    assert.ok(text.includes('http://baike.sogou.com/v61690479.htm'))
    assert.ok(text.includes('相关度: 0.869'))
    assert.ok(text.includes('2025-07-23 11:21:12'))
    assert.ok(text.includes('共 2 条'))
  })

  test('image：输出图片 URL 和尺寸', () => {
    const parsed = parseResponse(IMAGE_RESP, 'image')
    const text = renderAsText(parsed, { query: '风景' })
    assert.ok(text.includes('https://img.example.com/1.jpg'))
    assert.ok(text.includes('1920x1080'))
  })

  test('vr：输出垂类标记', () => {
    const vrArr = [
      { vr: true, vr_category: 'weather', display: { title: '北京天气', content: '晴 25℃', url: 'https://w.example.com' } },
    ]
    const parsed = parseResponse({ results: JSON.stringify(vrArr) }, 'web')
    const text = renderAsText(parsed, { query: '北京天气' })
    assert.ok(text.includes('[weather]'))
    assert.ok(text.includes('晴 25℃'))
  })

  test('空结果：给出换词建议', () => {
    const text = renderAsText({ type: 'web', items: [] }, { query: 'x' })
    assert.ok(text.includes('无结果'))
  })

  test('长摘要被截断', () => {
    const resp = {
      results: [{ title: 't', content: 'a'.repeat(500), url: 'https://x.com', score: 0.5 }],
    }
    const text = renderAsText(parseResponse(resp, 'web'), {})
    assert.ok(text.length < 600)
    assert.ok(text.includes('…'))
  })

  test('标题中的飘红控制符被清除', () => {
    const resp = {
      results: [{ title: '天气 - 百科', content: 'c', url: 'https://x.com' }],
    }
    const text = renderAsText(parseResponse(resp, 'web'), {})
    // U+E40A/U+E40B（飘红起止符）不应出现在输出中
    assert.ok(!text.includes('') && !text.includes(''))
    assert.ok(text.includes('天气 - 百科'))
  })
})
