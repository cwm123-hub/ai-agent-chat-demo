<script setup>
import { useSessionStore } from '../stores/sessions.js'

const store = useSessionStore()
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand__mark">◈</span>
      <div class="brand__text">
        <strong>AI Agent 助手</strong>
        <small>Vue3 · DeepSeek · Agent</small>
      </div>
    </div>

    <button class="new-btn" @click="store.createSession()">
      <span>＋</span> 新建对话
    </button>

    <div class="list">
      <button
        v-for="s in store.sessions"
        :key="s.id"
        class="item"
        :class="{ 'item--active': s.id === store.currentId }"
        @click="store.selectSession(s.id)"
      >
        <span class="item__body">
          <span class="item__title">{{ s.title }}</span>
          <span class="item__meta">{{ s.messages.length }} 条消息</span>
        </span>
        <span class="item__del" title="删除会话" @click.stop="store.removeSession(s.id)">✕</span>
      </button>
    </div>

    <footer class="foot">
      <p>会话存在浏览器本地</p>
      <p class="foot__tags">SSE · Function Calling · Pinia</p>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 258px;
  flex: 0 0 258px;
  background: var(--navy);
  color: #e7eaf2;
  display: flex;
  flex-direction: column;
  padding: 18px 14px 12px;
  gap: 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 6px 6px;
}

.brand__mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: linear-gradient(140deg, #c8a15a, #8f6f36);
  color: #1b2030;
  font-size: 15px;
  font-weight: 700;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.brand__text strong {
  font-size: 13.5px;
  letter-spacing: 0.4px;
}

.brand__text small {
  font-size: 10.5px;
  color: #99a1b5;
}

.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #eef1f8;
  font-size: 13px;
  transition: 0.15s;
}

.new-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 10px;
  text-align: left;
  color: #cfd5e3;
  transition: 0.15s;
}

.item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.item--active {
  background: rgba(200, 161, 90, 0.16);
  color: #fff;
}

.item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item__title {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__meta {
  font-size: 10.5px;
  color: #8c94a8;
}

.item__del {
  font-size: 11px;
  color: #7a8298;
  opacity: 0;
  padding: 2px 4px;
  border-radius: 6px;
  transition: 0.15s;
}

.item:hover .item__del {
  opacity: 1;
}

.item__del:hover {
  color: #ff8b86;
  background: rgba(255, 139, 134, 0.12);
}

.foot {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
  color: #7f879b;
}

.foot p {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.7;
}

.foot__tags {
  color: #99a1b5;
}
</style>
