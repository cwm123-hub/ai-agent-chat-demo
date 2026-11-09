<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useSessionStore } from './stores/sessions.js'
import { useChat } from './composables/useChat.js'
import { DEMO_MODE, MODEL_LABEL } from './api/config.js'
import SessionSidebar from './components/SessionSidebar.vue'
import MessageItem from './components/MessageItem.vue'
import ChatComposer from './components/ChatComposer.vue'

const store = useSessionStore()
const { streaming, error, send, stop } = useChat()

const scroller = ref(null)

const visibleMessages = computed(() =>
  (store.current?.messages || []).filter((m) => m.role !== 'tool')
)

const suggestions = [
  '成都今天要带伞吗？',
  '帮我找一下 SSE 相关的笔记',
  '记一下：明天 10 点把简历发出去'
]

onMounted(async () => {
  store.init()
  await scrollToBottom()
})

watch(visibleMessages, scrollToBottom, { deep: true, flush: 'post' })

async function scrollToBottom() {
  await nextTick()
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}

function useSuggestion(text) {
  send(text)
}
</script>

<template>
  <div class="app">
    <SessionSidebar />

    <main class="main">
      <header class="topbar">
        <div class="topbar__left">
          <h1>{{ store.current?.title || '新对话' }}</h1>
          <span class="badge">{{ MODEL_LABEL }}</span>
          <span v-if="DEMO_MODE" class="badge badge--demo">Demo · 本地模拟</span>
          <span class="badge badge--ghost">Function Calling</span>
          <span class="badge badge--ghost">SSE 流式</span>
        </div>
        <button class="ghost-btn" @click="store.clearCurrent()">清空对话</button>
      </header>

      <section ref="scroller" class="stream">
        <div v-if="!visibleMessages.length" class="empty">
          <div class="empty__icon">◈</div>
          <h2>一个会调工具的对话助手</h2>
          <p>
            模型自己决定要不要调天气 / 笔记 / 待办三个工具，前端执行后把结果回传给模型，
            再由模型组织成自然语言——这就是 Agent 的最小闭环。
          </p>
          <div class="chips">
            <button v-for="s in suggestions" :key="s" class="chip" @click="useSuggestion(s)">
              {{ s }}
            </button>
          </div>
        </div>

        <MessageItem v-for="m in visibleMessages" :key="m.id" :message="m" />

        <p v-if="error" class="error">⚠ {{ error }}</p>
      </section>

      <ChatComposer :streaming="streaming" @send="send" @stop="stop" />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  height: 100%;
  min-height: 0;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.topbar {
  height: 58px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 22px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.topbar__left h1 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef1f7;
  color: var(--ink-soft);
  white-space: nowrap;
}

.badge--demo {
  background: #fbf3e3;
  color: #8a6d33;
  border: 1px solid #eddfc2;
}

.badge--ghost {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--muted);
}

.ghost-btn {
  font-size: 12px;
  color: var(--muted);
  padding: 6px 10px;
  border-radius: 8px;
  transition: 0.15s;
}

.ghost-btn:hover {
  background: #eef1f7;
  color: var(--ink);
}

.stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 26px 24px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.stream > * {
  width: 100%;
  max-width: 860px;
}

.empty {
  margin: auto;
  text-align: center;
  max-width: 620px;
  padding: 40px 0;
}

.empty__icon {
  font-size: 30px;
  color: var(--gold);
  margin-bottom: 10px;
}

.empty h2 {
  font-size: 20px;
  margin: 0 0 10px;
  letter-spacing: 0.5px;
}

.empty p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.85;
  margin: 0 0 22px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.chip {
  font-size: 12.5px;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink-soft);
  transition: 0.15s;
}

.chip:hover {
  border-color: var(--gold);
  color: var(--ink);
  transform: translateY(-1px);
}

.error {
  font-size: 12.5px;
  color: var(--red);
  background: #fdf1f0;
  border: 1px solid #f6d5d3;
  padding: 10px 14px;
  border-radius: 10px;
  margin: 0;
}
</style>
