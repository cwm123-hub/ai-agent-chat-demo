import { reactive, ref } from 'vue'
import { useSessionStore } from '../stores/sessions.js'
import { useSSE } from './useSSE.js'
import { runTool, toolDefinitions } from '../tools/index.js'
import { trimMessages } from '../utils/context.js'
import { MAX_TOOL_STEPS } from '../api/config.js'
import { uid } from '../utils/id.js'

const SYSTEM_PROMPT = [
  '你是「小助手」，一个接了工具的 AI Agent，用简体中文回答。',
  '规则：',
  '1. 涉及实时天气、用户本地笔记、待办时，必须先调用工具，不要凭记忆编造数据。',
  '2. 一次只调用必要的工具；拿到结果后用简洁中文回答，不要复述整段 JSON。',
  '3. 工具返回 error 时，说明失败原因并给出替代方案，不要假装成功。',
  '4. 回答控制在 200 字以内；涉及数字时保留单位。'
].join('\n')

/**
 * Agent 主循环：
 *   用户提问 -> 模型决定调工具 -> 前端执行 -> 结果回填 -> 模型再生成 -> 直到不再调工具
 * 这就是简历里写的「模型决策 → 前端执行 → 二次生成」闭环。
 */
export function useChat() {
  const store = useSessionStore()
  const { chat } = useSSE()

  const streaming = ref(false)
  const error = ref('')
  let controller = null

  function toApiMessages(list) {
    return list.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content }
      }
      if (m.role === 'assistant') {
        const out = { role: 'assistant', content: m.content || '' }
        if (m.toolCalls?.length) {
          out.tool_calls = m.toolCalls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.arguments }
          }))
        }
        return out
      }
      return { role: m.role, content: m.content }
    })
  }

  async function send(rawText) {
    const text = (rawText || '').trim()
    if (!text || streaming.value) return

    const session = store.current
    if (!session) return

    error.value = ''
    if (!session.messages.length) store.renameSession(session.id, text.slice(0, 18))
    session.messages.push({ id: uid(), role: 'user', content: text, createdAt: Date.now() })

    streaming.value = true
    controller = new AbortController()

    try {
      for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
        const assistant = reactive({
          id: uid('a'),
          role: 'assistant',
          content: '',
          toolCalls: [],
          streaming: true,
          createdAt: Date.now()
        })
        session.messages.push(assistant)

        // 组装请求：system + 裁剪后的历史（不含当前这条空的 assistant）
        const history = session.messages.filter((m) => m.id !== assistant.id)
        const { messages, trimmed } = trimMessages(toApiMessages(history))
        const payload = [
          {
            role: 'system',
            content: trimmed ? `${SYSTEM_PROMPT}\n（更早的对话已省略，缺信息就直接问用户）` : SYSTEM_PROMPT
          },
          ...messages
        ]

        const { toolCalls } = await chat({
          messages: payload,
          tools: toolDefinitions,
          signal: controller.signal,
          onDelta: (full) => {
            assistant.content = full
          }
        })

        assistant.streaming = false

        // 没有工具调用 = 这一轮就是最终回答
        if (!toolCalls.length) break

        assistant.toolCalls = toolCalls.map((call) => ({
          id: call.id || uid('call'),
          name: call.function?.name || '',
          arguments: call.function?.arguments || '',
          state: 'running',
          result: '',
          ms: 0
        }))

        for (const call of assistant.toolCalls) {
          const started = performance.now()
          const { ok, content } = await runTool(call.name, call.arguments)
          call.ms = Math.round(performance.now() - started)
          call.result = content
          call.state = ok ? 'done' : 'error'

          // 回填给模型：tool 消息必须带 tool_call_id，否则接口会报错
          session.messages.push({
            id: uid('t'),
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content,
            createdAt: Date.now()
          })
        }

        if (controller.signal.aborted) break
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        error.value = err?.message || '请求失败，请重试'
      }
    } finally {
      session.messages.forEach((m) => {
        if (m.streaming) m.streaming = false
      })
      streaming.value = false
      controller = null
      store.persist()
    }
  }

  function stop() {
    controller?.abort()
  }

  return { streaming, error, send, stop }
}
