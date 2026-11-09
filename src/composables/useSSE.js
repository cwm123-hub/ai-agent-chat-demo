import { API_URL, DEMO_MODE } from '../api/config.js'
import { createDemoStream } from '../api/demoProvider.js'

/**
 * SSE 读取 + 增量拼装。
 * 这里只关心"协议怎么解析"，不关心业务，所以 useChat 可以复用任意兼容 OpenAI 的厂商。
 */
export function useSSE() {
  async function chat({ messages, tools = [], signal, onDelta }) {
    const stream = await openStream({ messages, tools, signal })
    return readSSE(stream, { onDelta })
  }

  return { chat }
}

/**
 * 打开一条 SSE 字节流，三种来源：
 *   1. Demo 模式（VITE_DEMO_MODE=1）：纯前端生成，用于静态托管演示；
 *   2. 本地/自建代理：POST /api/chat，Key 留在服务端；
 *   3. 部署到纯静态站点时 /api/chat 不存在（404/405），自动降级成 Demo，页面不会白屏报错。
 */
async function openStream({ messages, tools, signal }) {
  if (DEMO_MODE) return createDemoStream({ messages, signal })

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, tools }),
    signal
  })

  if (resp.ok) {
    // 静态托管常把不存在的 /api/chat 回退成 index.html（返回 200 + text/html），
    // 这种"假成功"要识别出来，否则会拿 HTML 去解析 SSE
    const type = resp.headers.get('content-type') || ''
    if (type.includes('text/html')) return createDemoStream({ messages, signal })

    if (!resp.body) throw new Error('当前浏览器或环境不支持流式响应')
    return resp.body
  }

  if (resp.status === 404 || resp.status === 405 || resp.status === 501) {
    return createDemoStream({ messages, signal })
  }

  const text = await resp.text()
  throw new Error(`请求失败（${resp.status}）：${text.slice(0, 200)}`)
}

/**
 * 从 ReadableStream 里按 SSE 协议切帧。
 * 真实网络里一帧可能被切成两半，所以必须自己维护 buffer，不能按 chunk 直接 JSON.parse。
 */
export async function readSSE(stream, { onDelta } = {}) {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''
  let content = ''
  const toolCalls = []

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        // 一帧里可能有多行 data:，按规范用 \n 拼接
        const data = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')

        if (!data) continue
        if (data === '[DONE]') return { content, toolCalls }

        let json
        try {
          json = JSON.parse(data)
        } catch {
          continue // 心跳/异常帧，跳过即可
        }

        if (json.error) throw new Error(json.error.message || '模型返回错误')

        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        if (delta.content) {
          content += delta.content
          onDelta?.(content, delta.content)
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const piece of delta.tool_calls) {
            const index = piece.index ?? 0
            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: '',
                type: 'function',
                function: { name: '', arguments: '' }
              }
            }
            const slot = toolCalls[index]
            if (piece.id) slot.id = piece.id
            if (piece.function?.name) slot.function.name += piece.function.name
            if (piece.function?.arguments) slot.function.arguments += piece.function.arguments
          }
        }
      }
    }

    return { content, toolCalls: toolCalls.filter(Boolean) }
  } finally {
    reader.releaseLock()
  }
}
