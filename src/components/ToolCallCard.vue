<script setup>
import { computed } from 'vue'
import { toolLabels } from '../tools/index.js'

const props = defineProps({
  call: { type: Object, required: true }
})

const label = computed(() => toolLabels[props.call.name] || props.call.name)

const prettyArgs = computed(() => {
  const raw = props.call.arguments
  if (!raw) return '{}'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})

const prettyResult = computed(() => {
  const raw = props.call.result
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})
</script>

<template>
  <details class="card" :class="`card--${call.state}`" :open="call.state === 'running'">
    <summary class="head">
      <span class="dot"></span>
      <span class="label">{{ label }}</span>
      <code class="fn">{{ call.name }}</code>
      <span class="state">{{ call.state === 'running' ? '执行中' : call.state === 'error' ? '失败' : '已完成' }}</span>
      <span v-if="call.ms" class="ms">{{ call.ms }}ms</span>
    </summary>

    <div class="body">
      <div class="block">
        <div class="k">参数</div>
        <pre>{{ prettyArgs }}</pre>
      </div>
      <div v-if="prettyResult" class="block">
        <div class="k">结果</div>
        <pre>{{ prettyResult }}</pre>
      </div>
    </div>
  </details>
</template>

<style scoped>
.card {
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fbfcfe;
  overflow: hidden;
  font-size: 12px;
}

.card--running {
  border-color: #e3d3b3;
  background: #fdfaf3;
}

.card--error {
  border-color: #f2cfcd;
  background: #fdf5f4;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.head::-webkit-details-marker {
  display: none;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  flex: 0 0 7px;
}

.card--running .dot {
  background: var(--gold);
  animation: pulse 1.1s ease-in-out infinite;
}

.card--error .dot {
  background: var(--red);
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

.label {
  font-weight: 600;
  color: var(--ink);
}

.fn {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
  background: #eef1f7;
  padding: 1px 6px;
  border-radius: 5px;
}

.state {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
}

.ms {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--muted);
  border-left: 1px solid var(--line);
  padding-left: 8px;
}

.body {
  border-top: 1px dashed var(--line);
  padding: 6px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.k {
  font-size: 10.5px;
  color: var(--muted);
  margin: 6px 0 4px;
}

pre {
  margin: 0;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.65;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  max-height: 190px;
  overflow: auto;
  color: #39415a;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
