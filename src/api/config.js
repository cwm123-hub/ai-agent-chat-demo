/**
 * 统一出口：想换成 OpenAI / 通义 / 豆包，只改这里或 .env 里的 baseURL，
 * 业务代码（useChat）完全不用动。
 */
const env = import.meta.env || {}

export const API_URL = env.VITE_API_URL || '/api/chat'

export const MODEL_LABEL = env.VITE_MODEL_LABEL || 'DeepSeek · deepseek-chat'

/**
 * 纯前端 Demo 模式：不请求后端，由浏览器本地生成流式响应。
 * 部署到 GitHub Pages 这类静态托管时必须开（没有 Node 代理可用）。
 */
export const DEMO_MODE = env.VITE_DEMO_MODE === '1'

/** 单次对话最多执行几轮工具调用，防止模型陷入死循环烧 token */
export const MAX_TOOL_STEPS = 4
