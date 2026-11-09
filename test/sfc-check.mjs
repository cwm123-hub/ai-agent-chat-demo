// -*- coding: utf-8 -*-
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc'

const root = 'C:/Users/23688/Documents/deepseek-harness/default-workspace/ai-agent-chat-demo/src'

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

let failed = 0
for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8')
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length) {
    failed++
    console.error('PARSE FAIL', file, errors.map((e) => e.message))
    continue
  }
  const id = 'test'
  try {
    const script = compileScript(descriptor, { id })
    for (const style of descriptor.styles) {
      const res = compileStyle({ source: style.content, filename: file, id, scoped: style.scoped })
      if (res.errors.length) throw new Error(res.errors.map(String).join('; '))
    }
    if (descriptor.template) {
      const res = compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id,
        scoped: descriptor.styles.some((s) => s.scoped)
      })
      if (res.errors.length) throw new Error(res.errors.map(String).join('; '))
    }
    console.log('OK  ', file.split('src')[1], '| script+template+style 均编译通过', script.content ? '' : '')
  } catch (err) {
    failed++
    console.error('FAIL', file, err.message)
  }
}

if (failed) {
  console.error(`\n${failed} 个组件未通过`)
  process.exit(1)
}
console.log('\n所有 SFC 编译通过 ✅')
