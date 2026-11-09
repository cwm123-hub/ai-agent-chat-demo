<script setup>
import { nextTick, ref } from 'vue'

const props = defineProps({
  streaming: { type: Boolean, default: false }
})

const emit = defineEmits(['send', 'stop'])

const draft = ref('')
const box = ref(null)

function submit() {
  const text = draft.value.trim()
  if (!text || props.streaming) return
  draft.value = ''
  resize()
  emit('send', text)
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

async function resize() {
  await nextTick()
  const el = box.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}
</script>

<template>
  <div class="composer">
    <div class="composer__box">
      <textarea
        ref="box"
        v-model="draft"
        rows="1"
        placeholder="问点什么，比如：成都今天要带伞吗？（Enter 发送 / Shift+Enter 换行）"
        @input="resize"
        @keydown="onKeydown"
      ></textarea>

      <button v-if="!streaming" class="send" :disabled="!draft.trim()" @click="submit">
        发送
      </button>
      <button v-else class="stop" @click="emit('stop')">
        停止
      </button>
    </div>
    <p class="hint">
      回答由 {{ streaming ? '模型实时生成，' : '' }}大模型产生，工具返回的是演示数据，请勿当作真实天气/日程。
    </p>
  </div>
</template>

<style scoped>
.composer {
  flex: 0 0 auto;
  padding: 10px 24px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: linear-gradient(180deg, rgba(246, 247, 251, 0), var(--bg) 30%);
}

.composer__box {
  width: 100%;
  max-width: 860px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 10px 10px 10px 16px;
  box-shadow: 0 6px 24px rgba(25, 35, 60, 0.06);
  transition: 0.15s;
}

.composer__box:focus-within {
  border-color: #cfd7e6;
  box-shadow: 0 8px 28px rgba(25, 35, 60, 0.09);
}

textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 13.5px;
  line-height: 1.7;
  max-height: 160px;
  color: var(--ink);
  background: transparent;
  padding: 4px 0;
}

textarea::placeholder {
  color: #a6adbd;
}

.send,
.stop {
  flex: 0 0 auto;
  height: 36px;
  padding: 0 18px;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: var(--navy);
  transition: 0.15s;
}

.send:hover:not(:disabled) {
  background: #2c3446;
}

.send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stop {
  background: #f2eee6;
  color: #8a6d33;
}

.stop:hover {
  background: #ebe4d6;
}

.hint {
  margin: 0;
  font-size: 11px;
  color: #a0a7b7;
}
</style>
