/**
 * 产物级 UI 冒烟测试：用 jsdom 跑 dist/ 里的真实产物，
 * 验证「点开页面 -> 输入问题 -> 流式回答 -> 工具卡片 -> 最终文本」整条链路。
 *
 * 前提：先构建 Demo 版
 *   VITE_DEMO_MODE=1 node build-rollup.mjs
 * 运行：
 *   node test/ui.smoke.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { pathToFileURL } from 'node:url'

const DIST = join(process.cwd(), 'dist')
const assets = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'))
assert.ok(assets.length > 0, 'dist/assets 里没有 js，请先执行构建')

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
})

const { window } = dom

// 把 jsdom 的浏览器对象挂到全局，产物才认得出"这是浏览器"
for (const key of [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
  'Text',
  'Comment',
  'DocumentFragment',
  'SVGElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLDivElement',
  'HTMLButtonElement',
  'HTMLSpanElement',
  'HTMLPreElement',
  'Document',
  'EventTarget',
  'NodeList',
  'XPathResult',
  'DOMParser'
]) {
  try {
    globalThis[key] = window[key]
  } catch {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
  }
}
globalThis.window = window

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await import(pathToFileURL(join(DIST, 'assets', assets[0])).href)
await sleep(300)

const text = () => window.document.body.textContent || ''
const $ = (sel) => window.document.querySelector(sel)
const $$ = (sel) => [...window.document.querySelectorAll(sel)]

// ---------- 1. 首屏渲染 ----------
assert.ok(text().includes('AI Agent 助手'), '侧边栏标题应渲染')
assert.ok(text().includes('一个会调工具的对话助手'), '空状态提示应渲染')
assert.ok($$('.chip').length >= 3, '应有 3 个快捷提问')

// ---------- 2. 输入 + 发送（走 Demo 流） ----------
const box = $('textarea')
assert.ok(box, '输入框应存在')

const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
setter.call(box, '成都今天要带伞吗？')
box.dispatchEvent(new window.Event('input', { bubbles: true }))
await sleep(60)

const sendBtn = $$('button').find((b) => b.textContent.trim() === '发送')
assert.ok(sendBtn, '发送按钮应存在')
sendBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

// 等流式 + 工具执行 + 二次生成跑完
for (let i = 0; i < 80; i += 1) {
  await sleep(100)
  if (text().includes('薄外套')) break
}

// ---------- 3. 断言渲染结果 ----------
assert.ok(text().includes('成都今天要带伞吗？'), '用户消息应上屏')
assert.ok(text().includes('查询天气'), '工具卡片标题应出现')
assert.ok(text().includes('get_weather'), '工具函数名应显示')
assert.ok(text().includes('已完成'), `工具状态应为已完成，实际片段：${text().slice(-120)}`)
assert.ok(text().includes('薄外套'), 'Agent 最终回答应流式渲染完成')

const cards = $$('.card')
assert.equal(cards.length, 1, '应只有一个工具调用卡片')

console.log('✓ 首屏渲染、快捷提问、输入框均正常')
console.log('✓ 工具卡片：', cards[0].textContent.replace(/\s+/g, ' ').slice(0, 46))
console.log('✓ 最终回答已流式渲染，页面文本长度', text().length)
console.log('\nUI 冒烟测试通过 ✅')
