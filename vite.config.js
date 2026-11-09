import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import agentProxy from './server/proxy.js'

// 说明：API Key 只在 Node 侧（这个配置文件 + 中间件）读取，
// 不会被注入到浏览器产物里，所以前端拿不到 key。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // 部署到 GitHub Pages 项目页时路径是 /仓库名/，用 VITE_BASE 覆盖
    base: env.VITE_BASE || '/',
    server: {
      port: 5173,
      open: false
    },
    plugins: [
      vue(),
      agentProxy({
        apiKey: env.DEEPSEEK_API_KEY || '',
        baseURL: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        mock: env.MOCK === '1'
      })
    ]
  }
})
