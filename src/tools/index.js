/**
 * 工具（Function Calling）
 * 这里演示三件事：查外部数据（天气）、查本地知识（笔记）、产生副作用（写待办）。
 * 换成真实接口时，只要保持 handler 的入参/返回结构不变，Agent 逻辑不用动。
 */

const NOTES = [
  { id: 'n1', title: 'Vue3 响应式原理', content: 'reactive 基于 Proxy 拦截 get/set，依赖收集在 track，派发更新在 trigger；ref 用 RefImpl 包一层 value。' },
  { id: 'n2', title: 'SSE 与 WebSocket 的区别', content: 'SSE 是单向服务端推送、基于 HTTP 文本流、自动重连；WebSocket 双向、独立协议。大模型流式输出通常用 SSE。' },
  { id: 'n3', title: 'Agent 的三个核心', content: '规划（把任务拆成步骤）、工具（能查能写）、记忆（上下文与长期存储）。' },
  { id: 'n4', title: 'Pinia 与 Vuex 对比', content: 'Pinia 没有 mutation，action 可同步可异步，天然支持组合式写法，TS 类型推断更好。' },
  { id: 'n5', title: 'Java 集合要点', content: 'ArrayList 扩容 1.5 倍；HashMap 数组+链表+红黑树，默认容量 16、负载因子 0.75。' }
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) % 100000
  }
  return h
}

async function getWeather({ city = '成都' }) {
  await sleep(420) // 模拟网络耗时，让 UI 上的"工具执行中"能被看到
  const seed = hash(city)
  const temps = [21, 23, 24, 26, 28]
  const texts = ['晴', '多云', '阴', '小雨']
  return {
    city,
    temp: temps[seed % temps.length],
    text: texts[seed % texts.length],
    humidity: 55 + (seed % 30),
    wind: `${['东南', '东北', '西南', '西北'][seed % 4]}风 2 级`,
    source: 'demo-mock',
    updatedAt: new Date().toISOString()
  }
}

async function searchNotes({ keyword = '' }) {
  await sleep(180)
  const key = String(keyword).trim().toLowerCase()
  const hits = NOTES.filter(
    (n) => !key || n.title.toLowerCase().includes(key) || n.content.toLowerCase().includes(key)
  )
  return {
    keyword,
    total: hits.length,
    items: hits.slice(0, 3).map((n) => ({ title: n.title, content: n.content }))
  }
}

async function saveTodo({ title, due = '' }) {
  await sleep(120)
  const KEY = 'agent-chat:todos'
  const list = JSON.parse(localStorage.getItem(KEY) || '[]')
  const item = { id: `t_${Date.now()}`, title, due, done: false, createdAt: Date.now() }
  list.unshift(item)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)))
  return { saved: true, item, total: list.length }
}

const handlers = { get_weather: getWeather, search_notes: searchNotes, save_todo: saveTodo }

/** 传给模型的工具声明，description 写得越清楚，模型选工具越准 */
export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询某个城市的当前天气，返回温度、天气、湿度、风力。用户问天气、穿衣、要不要带伞时使用。',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称，例如 成都、北京' }
        },
        required: ['city']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_notes',
      description: '在用户本地笔记中按关键词检索技术笔记，返回最相关的 3 条。用户问"我之前记过…""帮我找笔记"时使用。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '检索关键词，例如 SSE、Pinia、HashMap' }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_todo',
      description: '把一条待办事项写入用户的本地清单。用户说"记一下""提醒我"时使用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '待办内容' },
          due: { type: 'string', description: '截止时间，可为空字符串' }
        },
        required: ['title']
      }
    }
  }
]

export const toolLabels = {
  get_weather: '查询天气',
  search_notes: '检索笔记',
  save_todo: '写入待办'
}

/**
 * 执行工具。arguments 是模型生成的 JSON 字符串，可能不完整/不合法，
 * 所以这里必须防御性解析，并把失败信息回传给模型而不是直接抛给用户。
 */
export async function runTool(name, rawArguments) {
  const handler = handlers[name]
  if (!handler) {
    return { ok: false, content: JSON.stringify({ error: `未知工具：${name}` }) }
  }

  let args = {}
  if (rawArguments && rawArguments.trim()) {
    try {
      args = JSON.parse(rawArguments)
    } catch {
      return { ok: false, content: JSON.stringify({ error: '参数不是合法 JSON，请重新生成' }) }
    }
  }

  try {
    const data = await handler(args)
    return { ok: true, data, content: JSON.stringify(data) }
  } catch (err) {
    return { ok: false, content: JSON.stringify({ error: err?.message || '工具执行失败' }) }
  }
}
