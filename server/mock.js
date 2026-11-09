/**
 * 本地模拟流：没有 API Key 时也能演示完整链路
 *   第一轮 -> 返回 tool_calls（get_weather）
 *   第二轮 -> 模型"看到"工具结果后，输出自然语言回答
 * 帧格式与 DeepSeek / OpenAI 的流式响应一致，前端解析逻辑完全不用改。
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function frame(data) {
  return `data: ${JSON.stringify(data)}\n\n`
}

function delta(d) {
  return frame({ id: 'mock', object: 'chat.completion.chunk', choices: [{ index: 0, delta: d }] })
}

export async function mockStream(res, messages) {
  res.writeHead(200, SSE_HEADERS)

  const toolTurns = messages.filter((m) => m.role === 'tool').length

  // ---- 第一轮：模型决定调用工具 ----
  if (toolTurns === 0) {
    const callId = `call_mock_${Date.now()}`
    res.write(delta({ role: 'assistant' }))
    await sleep(120)
    res.write(
      delta({
        tool_calls: [
          { index: 0, id: callId, type: 'function', function: { name: 'get_weather', arguments: '' } }
        ]
      })
    )
    // 参数分片下发，复现真实环境中 arguments 被切开的情况
    for (const piece of ['{"city"', ':"', '成都', '"}']) {
      await sleep(90)
      res.write(delta({ tool_calls: [{ index: 0, function: { arguments: piece } }] }))
    }
    res.write(frame({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }))
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  // ---- 第二轮：拿到工具结果后组织回答 ----
  const lastTool = [...messages].reverse().find((m) => m.role === 'tool')
  let weather = '成都 24℃，多云'
  try {
    const parsed = JSON.parse(lastTool?.content || '{}')
    if (parsed.city) {
      weather = `${parsed.city} ${parsed.temp}℃，${parsed.text}`
    }
  } catch {
    /* 工具结果不是 JSON 就用默认文案 */
  }

  const answer =
    `我调用了 \`get_weather\` 查了一下：${weather}，湿度 68%，东南风 2 级。\n\n` +
    '建议：现在出门不用带伞，傍晚降温约 5℃，可以带一件薄外套。\n\n' +
    '（当前是 Mock 模式，没有消耗真实 token。配置 DEEPSEEK_API_KEY 后，这句回答由模型实时生成。）'

  res.write(delta({ role: 'assistant' }))
  for (const char of answer) {
    res.write(delta({ content: char }))
    await sleep(18)
  }
  res.write(frame({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }))
  res.write('data: [DONE]\n\n')
  res.end()
}
