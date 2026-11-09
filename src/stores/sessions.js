import { defineStore } from 'pinia'
import { uid } from '../utils/id.js'

const STORAGE_KEY = 'agent-chat:sessions:v1'

/** 持久化时只存必要字段，避免把响应式代理/大字段写进 localStorage */
function serialize(sessions) {
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    messages: s.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls || [],
      tool_call_id: m.tool_call_id || '',
      name: m.name || '',
      createdAt: m.createdAt || Date.now()
    }))
  }))
}

function freshSession(title = '新对话') {
  return { id: uid('s'), title, createdAt: Date.now(), messages: [] }
}

export const useSessionStore = defineStore('sessions', {
  state: () => ({
    sessions: [],
    currentId: '',
    ready: false
  }),

  getters: {
    current: (state) => state.sessions.find((s) => s.id === state.currentId) || state.sessions[0] || null,
    totalMessages: (state) => state.sessions.reduce((n, s) => n + s.messages.length, 0)
  },

  actions: {
    init() {
      if (this.ready) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        this.sessions = Array.isArray(parsed) && parsed.length ? parsed : [freshSession()]
      } catch {
        this.sessions = [freshSession()]
      }
      this.currentId = this.sessions[0].id
      this.ready = true
    },

    createSession() {
      const session = freshSession()
      this.sessions.unshift(session)
      this.currentId = session.id
      this.persist()
      return session
    },

    selectSession(id) {
      if (this.sessions.some((s) => s.id === id)) this.currentId = id
    },

    removeSession(id) {
      const index = this.sessions.findIndex((s) => s.id === id)
      if (index === -1) return
      this.sessions.splice(index, 1)
      if (!this.sessions.length) this.sessions.push(freshSession())
      if (this.currentId === id) this.currentId = this.sessions[0].id
      this.persist()
    },

    renameSession(id, title) {
      const session = this.sessions.find((s) => s.id === id)
      if (session && title) session.title = title.slice(0, 20)
    },

    clearCurrent() {
      const session = this.current
      if (!session) return
      session.messages = []
      session.title = '新对话'
      this.persist()
    },

    /** 写盘做 200ms 防抖：流式输出时每个字都写 localStorage 会卡 */
    persist: debounce(function persistNow() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(this.sessions)))
      } catch (err) {
        console.warn('[sessions] 本地存储写入失败：', err)
      }
    }, 200)
  }
})

function debounce(fn, wait) {
  let timer = null
  return function debounced(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(this, args)
    }, wait)
  }
}
