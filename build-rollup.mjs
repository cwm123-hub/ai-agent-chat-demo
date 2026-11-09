/**
 * 备用构建：不依赖 Vite（某些环境里 esbuild 无法启动子进程时用它）。
 *   node build-rollup.mjs            -> 常规构建（走 /api/chat 代理）
 *   VITE_DEMO_MODE=1 node build-rollup.mjs -> 纯静态 Demo 构建（无后端、无 Key）
 *
 * 产物同样输出到 dist/，可直接丢到 GitHub Pages / Netlify / 任意静态托管。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { rollup } from 'rollup'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')

// 命令行参数（跨平台，不依赖 shell 的环境变量写法）：
//   --demo        纯前端 Demo 模式，不需要后端和 Key
//   --base=./     资源路径前缀，部署到子路径（如 GitHub Pages）时用
const argv = process.argv.slice(2)
const hasFlag = (name) => argv.includes(`--${name}`)
const argValue = (name, fallback) => {
  const hit = argv.find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const DEMO = hasFlag('demo') || process.env.VITE_DEMO_MODE === '1'
const BASE = argValue('base', process.env.VITE_BASE || '/')

const ENV = {
  VITE_DEMO_MODE: DEMO ? '1' : '',
  VITE_API_URL: process.env.VITE_API_URL || '',
  VITE_MODEL_LABEL: process.env.VITE_MODEL_LABEL || ''
}

/** 把 .vue 编译成普通 ES 模块（模板 + 脚本 + 样式注入） */
function vueSfc() {
  return {
    name: 'vue-sfc',
    transform(code, id) {
      if (!id.endsWith('.vue')) return null
      const filename = id.split('?')[0]
      const { descriptor, errors } = parse(code, { filename })
      if (errors.length) throw new Error(`${filename}: ${errors[0].message}`)

      const hash = createHash('sha256').update(filename).digest('hex').slice(0, 8)
      const scopeId = `data-v-${hash}`
      const hasScoped = descriptor.styles.some((s) => s.scoped)

      let out = ''
      let bindings = null
      if (descriptor.script || descriptor.scriptSetup) {
        const script = compileScript(descriptor, { id: hash })
        bindings = script.bindings
        out += script.content.replace(/export\s+default\s+/, 'const __sfc__ = ')
      } else {
        out += 'const __sfc__ = {}'
      }

      if (descriptor.template) {
        const tpl = compileTemplate({
          source: descriptor.template.content,
          filename,
          id: hash,
          scoped: hasScoped,
          // 关键：把 <script setup> 的绑定信息交给模板编译器，
          // 否则模板里的变量会去 _ctx 上找，运行时报 "reading 'current' of undefined"
          compilerOptions: { ...(hasScoped ? { scopeId } : {}), bindingMetadata: bindings || undefined }
        })
        if (tpl.errors.length) throw new Error(`${filename}: ${tpl.errors[0]}`)
        out += '\n' + tpl.code.replace(/export\s+function\s+render/, 'function render')
        out += '\n__sfc__.render = render'
      }

      const css = descriptor.styles
        .map((s) => compileStyle({ source: s.content, filename, id: hash, scoped: s.scoped }).code)
        .join('\n')
      if (css.trim()) {
        out += `\nconst __css__ = ${JSON.stringify(css)}
if (typeof document !== 'undefined') {
  const el = document.createElement('style')
  el.setAttribute('data-sfc', ${JSON.stringify(filename)})
  el.textContent = __css__
  document.head.appendChild(el)
}`
      }

      if (hasScoped) out += `\n__sfc__.__scopeId = ${JSON.stringify(scopeId)}`
      out += '\n__sfc__.__file = ' + JSON.stringify(filename)
      out += '\nexport default __sfc__\n'
      return { code: out, map: null }
    }
  }
}

/** 全局 CSS 也走运行时注入，产物就只有一个 js，部署最省事 */
function cssInject() {
  return {
    name: 'css-inject',
    transform(code, id) {
      if (!id.endsWith('.css')) return null
      return {
        code: `if (typeof document !== 'undefined') {
  const el = document.createElement('style')
  el.textContent = ${JSON.stringify(code)}
  document.head.appendChild(el)
}`,
        map: null
      }
    }
  }
}

/** 替换 import.meta.env 为构建期常量 */
function envPlugin() {
  const literal = JSON.stringify(ENV)
  return {
    name: 'env-literal',
    transform(code, id) {
      if (!code.includes('import.meta.env') && !code.includes('process.env.NODE_ENV')) return null
      return {
        code: code
          .replace(/import.meta.env/g, `(${literal})`)
          .replace(/process.env.NODE_ENV/g, `"production"`),
        map: null
      }
    }
  }
}

rmSync(DIST, { recursive: true, force: true })
mkdirSync(join(DIST, 'assets'), { recursive: true })

const bundle = await rollup({
  input: join(ROOT, 'src/main.js'),
  plugins: [envPlugin(), cssInject(), vueSfc(), nodeResolve({ browser: true, extensions: ['.js', '.mjs', '.json'] })]
})

const { output } = await bundle.generate({
  format: 'es',
  dir: join(DIST, 'assets'),
  entryFileNames: 'app.[hash].js',
  chunkFileNames: '[name].[hash].js'
})

await bundle.close()

let jsFile = ''
let cssText = ''
for (const chunk of output) {
  if (chunk.type === 'chunk') {
    writeFileSync(join(DIST, 'assets', chunk.fileName), chunk.code)
    if (chunk.isEntry) jsFile = chunk.fileName
  } else if (chunk.type === 'asset' && chunk.fileName.endsWith('.css')) {
    cssText += String(chunk.source)
  }
}

const cssTag = cssText
  ? `<style>${cssText}</style>`
  : ''

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Agent 对话助手 · Vue3 + DeepSeek</title>
    <meta name="description" content="一个会调用工具的 AI Agent 前端演示：SSE 流式输出 + Function Calling 闭环。" />
    ${cssTag}
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${BASE}assets/${jsFile}"></script>
  </body>
</html>
`

writeFileSync(join(DIST, 'index.html'), html)

// GitHub Pages 会忽略下划线开头的目录，放一个 .nojekyll 更保险
writeFileSync(join(DIST, '.nojekyll'), '')

const size = existsSync(join(DIST, 'assets', jsFile)) ? readFileSync(join(DIST, 'assets', jsFile)).length : 0
console.log(`✓ 构建完成 ${DEMO ? '(Demo 模式)' : '(代理模式)'}`)
console.log(`  dist/index.html`)
console.log(`  dist/assets/${jsFile}  ${(size / 1024).toFixed(1)} KB`)
