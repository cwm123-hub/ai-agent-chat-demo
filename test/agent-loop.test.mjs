/**
 * 端到端冒烟测试（不需要打包器、不需要 API Key）：
 *   1. 起一个真实 HTTP 服务，挂上 server/proxy.js 中间件（Mock 模式）
 *   2. 用真实的 useChat + Pinia store 发一轮消息
 *   3. 断言：工具被调用并执行 → role:tool 回填 → 模型二次生成回答
 *
 * 运行：node test/agent-loop.test.mjs
 */
import http from 'node:http'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'

// ---------- 1. 浏览器环境补齐 ----------
const memory = new Map()
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear()
}

// ---------- 2. 起服务：真实的 Vite 插件中间件 ----------
const { default: agentProxy } = await import('../server/proxy.js')
const stack = []
const plugin = agentProxy({ mock: true })
plugin.configureServer({ middlewares: { use: (fn) => stack.push(fn) } })

const server = http.createServer((req, res) => stack[0](req, res, () => {
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found')
}))

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

// Node 里没有相对路径 fetch，这里把 /api/chat 补成完整地址（不污染业务代码）
const realFetch = globalThis.fetch
globalThis.fetch = (input, init) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? base + input : input, init)

// ---------- 3. 跑一轮完整 Agent 循环 ----------
const { useSessionStore } = await import('../src/stores/sessions.js')
const { useChat } = await import('../src/composables/useChat.js')

setActivePinia(createPinia())
const store = useSessionStore()
store.init()
store.createSession()

const { streaming, error, send } = useChat()
await send('成都今天要带伞吗？')

const messages = store.current.messages
const byRole = (role) => messages.filter((m) => m.role === role)

assert.equal(error.value, '', '不应有错误')
assert.equal(streaming.value, false, '结束后 streaming 应为 false')

const userMsg = byRole('user')[0]
assert.equal(userMsg.content, '成都今天要带伞吗？')

const assistants = byRole('assistant')
assert.ok(assistants.length >= 2, `至少两条 assistant 消息（工具调用 + 最终回答），实际 ${assistants.length}`)

const caller = assistants[0]
assert.equal(caller.toolCalls.length, 1, '第一轮应产生 1 个工具调用')
assert.equal(caller.toolCalls[0].name, 'get_weather')
assert.equal(caller.toolCalls[0].state, 'done', '工具应执行成功')
assert.ok(caller.toolCalls[0].ms >= 0, '应记录工具耗时')

const args = JSON.parse(caller.toolCalls[0].arguments)
assert.equal(args.city, '成都', `分片下发的 arguments 应被完整拼起来，实际 ${caller.toolCalls[0].arguments}`)

const toolMsg = byRole('tool')[0]
assert.ok(toolMsg, '应回填 role:tool 消息')
assert.equal(toolMsg.tool_call_id, caller.toolCalls[0].id, 'tool_call_id 必须与调用一致')

const final = assistants[assistants.length - 1]
assert.ok(final.content.includes('成都'), `最终回答应包含城市，实际：${final.content.slice(0, 60)}`)
assert.ok(final.toolCalls.length === 0, '最后一轮不应再有工具调用')

console.log('✓ 工具调用链路正常：', caller.toolCalls[0].name, '→', toolMsg.content.slice(0, 62) + '…')
console.log('✓ 最终回答：', final.content.slice(0, 48).replace(/\n/g, ' ') + '…')

// ---------- 4. 单元断言：裁剪 / 工具容错 ----------
const { trimMessages } = await import('../src/utils/context.js')
const fake = []
for (let i = 0; i < 10; i += 1) {
  fake.push({ role: 'user', content: `问题 ${i}` })
  fake.push({ role: 'assistant', content: '', toolCalls: [{ id: `c${i}` }] })
  fake.push({ role: 'tool', tool_call_id: `c${i}`, content: '{}' })
}
const { messages: kept, trimmed } = trimMessages(fake, { maxRounds: 3 })
assert.equal(trimmed, true)
assert.equal(kept[0].role, 'user', '裁剪后必须从 user 消息开始')
assert.ok(kept.length <= 9, `最多保留 3 轮，实际 ${kept.length} 条`)
assert.ok(kept.some((m) => m.role === 'tool'), '工具消息要跟着 assistant 一起保留，不能被拆散')

const { runTool } = await import('../src/tools/index.js')
const bad = await runTool('get_weather', '{"city":')
assert.equal(bad.ok, false, '半截 JSON 应返回错误而不是抛异常')
const unknown = await runTool('no_such_tool', '{}')
assert.equal(unknown.ok, false)
const saved = await runTool('save_todo', JSON.stringify({ title: '明天交简历' }))
assert.equal(saved.ok, true)
assert.ok(String(localStorage.getItem('agent-chat:todos')).includes('明天交简历'))

console.log('✓ 上下文裁剪 / 工具容错 / 待办落盘 均正常')

server.close()
console.log('\n全部通过 ✅')
