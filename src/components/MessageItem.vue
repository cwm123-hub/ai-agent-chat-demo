<script setup>
import ToolCallCard from './ToolCallCard.vue'

const props = defineProps({
  message: { type: Object, required: true }
})

const isUser = props.message.role === 'user'
const hasText = () => Boolean(props.message.content && props.message.content.trim())
</script>

<template>
  <div class="msg" :class="isUser ? 'msg--user' : 'msg--bot'">
    <div class="avatar" :class="isUser ? 'avatar--user' : 'avatar--bot'">
      {{ isUser ? '我' : 'AI' }}
    </div>

    <div class="body">
      <div v-if="isUser" class="bubble bubble--user">{{ message.content }}</div>

      <template v-else>
        <div v-if="message.toolCalls?.length" class="tools">
          <ToolCallCard v-for="call in message.toolCalls" :key="call.id" :call="call" />
        </div>

        <div v-if="hasText() || message.streaming" class="bubble bubble--bot">
          <span class="text">{{ message.content }}</span>
          <span v-if="message.streaming && hasText()" class="caret"></span>
          <span v-if="message.streaming && !hasText()" class="thinking">正在思考…</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.msg {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.msg--user {
  flex-direction: row-reverse;
}

.avatar {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 11.5px;
  font-weight: 600;
  margin-top: 2px;
}

.avatar--user {
  background: #e9edf6;
  color: #4a5468;
}

.avatar--bot {
  background: linear-gradient(140deg, #2c3446, #1f2533);
  color: #d9c08d;
}

.body {
  min-width: 0;
  max-width: min(100%, 720px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg--user .body {
  align-items: flex-end;
}

.bubble {
  padding: 11px 15px;
  border-radius: 14px;
  font-size: 13.5px;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble--user {
  background: var(--navy-2);
  color: #f2f4f9;
  border-top-right-radius: 5px;
}

.bubble--bot {
  background: #fff;
  border: 1px solid var(--line);
  color: var(--ink);
  border-top-left-radius: 5px;
  box-shadow: 0 1px 2px rgba(20, 30, 50, 0.03);
}

.caret {
  display: inline-block;
  width: 7px;
  height: 14px;
  margin-left: 2px;
  background: var(--gold);
  vertical-align: -2px;
  animation: blink 1s steps(2, start) infinite;
}

.thinking {
  color: var(--muted);
}

@keyframes blink {
  to {
    opacity: 0;
  }
}

.tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
