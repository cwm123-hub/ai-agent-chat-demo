/**
 * 浏览器内的模拟模型（纯前端 Demo 模式）。
 *
 * 用途：把项目部署到 GitHub Pages / Netlify 这类纯静态托管时，没有 Node 代理，
 * 也没有 API Key，但访客依然能看到完整链路——流式输出 + 工具调用 + 二次生成。
 *
 * 输出的是标准 SSE 字节流，和真实接口完全一致，
 * 所以 readSSE 的解析逻辑会被真刀真枪地走一遍（包括 arguments 分片）。
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function frame(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function delta(d) {
  return frame({ id: 'demo', object: 'chat.completion.chunk', choices: [{ index: 0, delta: d }] })
}

function ensureNotAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('已停止')
    err.name = 'AbortError'
    throw err
  }
}

/**
 * @returns {ReadableStream<Uint8Array>} 与真实响应体同构的字节流
 */
export function createDemoStream({ messages = [], signal } = {}) {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const push = (text) => controller.enqueue(encoder.encode(text))
      const close = () => {
        try {
          controller.close()
        } catch {
          /* 已关闭 */
        }
      }

      try {
        const toolTurns = messages.filter((m) => m.role === 'tool').length

        // ---- 第一轮：模型决定调用工具（arguments 故意拆成 4 片）----
        if (toolTurns === 0) {
          push(delta({ role: 'assistant' }))
          await sleep(220)
          ensureNotAborted(signal)

          const callId = `call_demo_${Date.now()}`
          push(
            delta({
              tool_calls: [
                { index: 0, id: callId, type: 'function', function: { name: 'get_weather', arguments: '' } }
              ]
            })
          )

          for (const piece of ['{"city"', ':"', '成都', '"}']) {
            await sleep(110)
            ensureNotAborted(signal)
            push(delta({ tool_calls: [{ index: 0, function: { arguments: piece } }] }))
          }

          push(frame({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }))
          push('data: [DONE]\n\n')
          close()
          return
        }

        // ---- 第二轮：读到工具结果后组织回答 ----
        const lastTool = [...messages].reverse().find((m) => m.role === 'tool')
        let weather = '成都 24℃，多云'
        try {
          const parsed = JSON.parse(lastTool?.content || '{}')
          if (parsed.city) weather = `${parsed.city} ${parsed.temp}℃，${parsed.text}`
        } catch {
          /* 工具结果不是 JSON，用默认文案 */
        }

        const answer =
          `我调用了 \`get_weather\` 查了一下：${weather}，湿度 68%，东南风 2 级。\n\n` +
          '建议：现在出门不用带伞，傍晚降温约 5℃，可以带一件薄外套。\n\n' +
          '（当前是纯前端 Demo 模式：数据由浏览器本地模拟，不消耗 token。' +
          '本地运行时配置 DEEPSEEK_API_KEY，这句回答就由真实模型生成。）'

        push(delta({ role: 'assistant' }))
        for (const char of answer) {
          await sleep(16)
          ensureNotAborted(signal)
          push(delta({ content: char }))
        }
        push(frame({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }))
        push('data: [DONE]\n\n')
        close()
      } catch (err) {
        if (err?.name === 'AbortError') {
          close()
          return
        }
        try {
          controller.enqueue(
            encoder.encode(frame({ error: { message: err?.message || '模拟流异常' } }))
          )
        } catch {
          /* 忽略 */
        }
        close()
      }
    }
  })
}
