/**
 * 上下文裁剪：长对话不能无限塞给模型，否则又贵又容易"遗忘中间"。
 * 策略：以「用户提问」为轮次边界保留最近 N 轮，再按字符预算兜底。
 * 注意：裁剪必须整轮剪，不能把 assistant 的 tool_calls 和后续 tool 消息拆散，
 * 否则接口会报 "tool message must follow a tool_calls message"。
 */
export function trimMessages(messages, { maxRounds = 6, maxChars = 10000 } = {}) {
  const list = Array.isArray(messages) ? messages : []
  const userPositions = []
  list.forEach((m, i) => {
    if (m.role === 'user') userPositions.push(i)
  })

  let start = 0
  let trimmed = false

  if (userPositions.length > maxRounds) {
    start = userPositions[userPositions.length - maxRounds]
    trimmed = true
  }

  let kept = list.slice(start)

  const size = (arr) => arr.reduce((n, m) => n + (m.content ? m.content.length : 0), 0)

  while (kept.length && size(kept) > maxChars) {
    const nextTurn = kept.findIndex((m, i) => i > 0 && m.role === 'user')
    if (nextTurn === -1) break
    kept = kept.slice(nextTurn)
    trimmed = true
  }

  return { messages: kept, trimmed }
}
