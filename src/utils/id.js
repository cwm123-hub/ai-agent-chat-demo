/** 简易唯一 id：演示项目够用，生产环境用 crypto.randomUUID() */
export function uid(prefix = 'm') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
