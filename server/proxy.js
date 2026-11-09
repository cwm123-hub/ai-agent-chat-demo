import { mockStream, SSE_HEADERS } from './mock.js'

/**
 * 极简代理中间件：
 * 浏览器 -> /api/chat -> 这里 -> DeepSeek(或兼容 OpenAI 的厂商)
 *
 * 为什么要代理：
 * 1. API Key 不能出现在前端产物里；
 * 2. 真实项目里鉴权、限流、日志、重试都在这一层；
 * 3. 流式响应原样透传，前端自己解析 SSE，方便做打字机效果。
 */
export default function agentProxy(options = {}) {
  const cfg = {
    apiKey: '',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    mock: false,
    ...options
  }

  return {
    name: 'agent-chat-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/chat')) return next()

        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          })
          return res.end()
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: '只接受 POST' }))
        }

        try {
          const payload = await readJSON(req)
          const messages = payload.messages || []
          const tools = payload.tools || []

          // 没有 key 或显式打开 MOCK 时走本地模拟，保证 clone 下来就能跑
          if (cfg.mock || !cfg.apiKey) {
            await mockStream(res, messages)
            return
          }

          await proxyStream(res, { messages, tools }, cfg)
        } catch (err) {
          const message = err?.message || String(err)
          console.error('[agent-proxy]', message)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: { message } }))
          } else {
            res.end()
          }
        }
      })
    }
  }
}

async function proxyStream(res, { messages, tools }, cfg) {
  const body = {
    model: cfg.model,
    messages,
    stream: true,
    temperature: 0.7
  }
  if (tools.length) body.tools = tools

  const upstream = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: { message: text.slice(0, 800) } }))
    return
  }

  res.writeHead(200, SSE_HEADERS)
  // 逐块透传，不做缓冲，前端才能真的“边生成边显示”
  for await (const chunk of upstream.body) {
    res.write(chunk)
  }
  res.end()
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}
