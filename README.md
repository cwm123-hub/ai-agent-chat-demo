# AI Agent 对话助手（Vue3 + DeepSeek）

一个**不依赖于后端框架**的前端 Agent 演示：模型自己决定调用工具，前端执行工具、回填结果，再让模型生成最终回答。

> 写这份代码的目的：让简历上「SSE 流式」「Function Calling」「上下文管理」「兼容 OpenAI 协议」这几条，都能被面试官打开浏览器验证。

---

## 1. 快速开始

**Windows 双击 `start.bat` 即可**（自动装依赖、起服务、开浏览器）。

手动跑：

```bash
cd ai-agent-chat-demo
npm install             # 或 pnpm install
cp .env.example .env    # Windows: copy .env.example .env
npm run dev             # 打开 http://localhost:5173
```

`.env` 里 `DEEPSEEK_API_KEY` 留空也能跑——会自动进入 **Mock 模式**：本地模拟流式输出，而且第一轮会真的返回一个 `get_weather` 工具调用，让你看到完整 Agent 闭环（不花一分钱 token）。

配好 key 后就是真实模型：

```env
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 想直接看上线效果（不需要 Key）

```bash
npm run build:demo   # 构建纯前端 Demo 版
npm run serve:dist   # http://127.0.0.1:5178
```

Demo 版把"模型"搬进了浏览器（`src/api/demoProvider.js`），所以**可以部署到纯静态托管**，
拿到一个能写进简历的公开链接 —— 见 [DEPLOY.md](./DEPLOY.md)。

## 2. 目录结构

```
ai-agent-chat-demo/
├─ server/
│  ├─ proxy.js        # Node 中间件：注入 key、透传 SSE（key 不进前端产物）
│  ├─ mock.js         # 无 key 时的模拟流：先返回 tool_calls，再返回自然语言
│  └─ static.mjs      # 预览 dist/ 的极简静态服务器
├─ src/
│  ├─ api/config.js          # 接口地址、模型标识、Demo 开关、最大工具轮数
│  ├─ api/demoProvider.js    # 浏览器端模拟模型（静态部署时用）
│  ├─ composables/useSSE.js  # fetch + ReadableStream 解析 SSE，组装 tool_calls 分片
│  ├─ composables/useChat.js # Agent 主循环：请求 → 执行工具 → 回填 → 再请求
│  ├─ stores/sessions.js     # Pinia 多会话 + localStorage 持久化（防抖写盘）
│  ├─ tools/index.js         # 三个工具 + JSON Schema 声明 + 防御式解析
│  ├─ utils/context.js       # 上下文裁剪（按轮次 + 字符预算，整轮裁剪）
│  └─ components/            # 侧边栏 / 消息 / 工具卡片 / 输入框
├─ build-rollup.mjs          # 备用构建（不依赖 esbuild），用于 npm run build:demo
├─ start.bat / start-demo.bat  # Windows 一键运行（开发版 / 纯静态 Demo 版）
└─ .github/workflows/deploy.yml  # 推 main 自动发布 GitHub Pages
```

## 3. 一次请求到底发生了什么

```
用户输入
  └─ useChat.send()
       ├─ 组装 messages：system + trimMessages(历史)
       ├─ useSSE.chat()  ──POST /api/chat──▶  proxy.js  ──▶  DeepSeek(stream)
       │                                          ◀── SSE 分片 ──┘
       ├─ readSSE()：按 \n\n 切帧 → JSON.parse → 拼 content / tool_calls
       │
       ├─ 有 tool_calls？
       │    ├─ 是 → 渲染「工具卡片 → 执行中」
       │    │       runTool() 执行 → 得到结果
       │    │       写入 role:'tool' 消息（带 tool_call_id）
       │    │       回到循环顶部，让模型「看着工具结果」再生成
       │    └─ 否 → 这一轮就是最终回答，结束
       └─ 全程 streaming=true：光标闪烁、可点「停止」中断
```

三个容易踩的坑，代码里都处理了：

| 坑 | 现象 | 处理 |
| --- | --- | --- |
| SSE 帧被 TCP 切断 | 偶发 `JSON.parse` 报错 / 丢字 | 维护 buffer，按 `\n\n` 切帧，`\r\n` 归一化 |
| `tool_calls.arguments` 分片下发 | 参数永远是半截 JSON | 按 `index` 累加 `function.arguments` 字符串 |
| 上下文裁剪切断工具链 | 接口报 `tool message must follow a tool_calls message` | 以 user 消息为边界整轮裁剪 |

## 4. 面试怎么讲（对应简历四条）

**① 流式对话**
> 没用 EventSource，因为需要 POST + 自定义 header；改用 `fetch` 拿到 `response.body`，`getReader()` 逐块读，`TextDecoder({stream:true})` 解码，再按 `\n\n` 切帧。首字延迟从等整包变成首帧即渲染。

**② 工具调用**
> 工具声明写在 `tools/index.js`，是标准 JSON Schema。模型返回 `tool_calls` 后我不在后端执行，而是前端执行再回填——好处是能调用浏览器能力（localStorage、剪贴板、地图 SDK），代价是要把 `tool_call_id` 原样带回，否则接口报错。

**③ 上下文管理**
> 两道闸：轮次闸（保留最近 6 轮）+ 字符闸（1 万字）。裁剪按 user 消息切，保证 assistant 的 `tool_calls` 和它对应的 `tool` 消息不被拆开。被裁剪时会在 system 里追加一句「更早对话已省略」，避免模型误以为没聊过。

**④ 工程封装**
> `useSSE` 只负责协议，`useChat` 只负责编排，`api/config.js` 一个文件就能切厂商。因为 DeepSeek 兼容 OpenAI 协议，换成 `https://api.openai.com/v1` 只改 `.env`，业务代码零改动。

## 5. 可以继续加的（有余力再加，别一次做太多）

- **RAG**：把笔记做成向量库（`text-embedding` + 余弦相似度），`search_notes` 从关键词匹配换成语义召回；
- **MCP**：把三个工具抽成独立 MCP Server，Agent 侧只维护「工具描述 + 调用通道」；
- **后端化**：把工具执行搬到 Node/Java（Spring Boot + SSE），前端只负责渲染——更接近真实生产架构；
- **可观测**：给每轮记 token 数、工具耗时、失败率，做一个简单面板。

## 6. 自测

```bash
npm test          # 端到端：起真实 HTTP 服务 + 真实 useChat，跑完一整轮 Agent
npm run test:ui   # 产物级：jsdom 里跑 dist/ 的真包，点按钮 -> 工具卡片 -> 流式回答
npm run check:sfc # 编译检查：5 个 .vue 的 script / template / style
```

`agent-loop.test.mjs` 断言的正是简历里那几条：

- 第一轮拿到 `tool_calls`，且分片下发的 `arguments` 被完整拼接（`{"city":"成都"}`）；
- 工具执行成功、记录了耗时，并写入 `role: 'tool'` 且 `tool_call_id` 与调用一致；
- 第二轮模型基于工具结果生成回答（不含工具调用）；
- `trimMessages` 裁剪后仍从 user 消息开始，工具消息不与 assistant 拆散；
- 半截 JSON 参数不会抛异常，而是把错误回传给模型。

`ui.smoke.mjs` 更进一步：直接加载构建产物，模拟"输入问题 → 点发送"，断言工具卡片渲染出「已完成」、
最终回答逐字上屏。**这条测试过了，说明打包出来的东西真的能跑**。

## 7. 说明

工具数据全部是演示数据（天气是哈希生成的、笔记是内置的、待办存 localStorage）。真实项目里把 `tools/index.js` 的 handler 换成后端接口即可，Agent 逻辑不用动。
