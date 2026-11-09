# 拿到一个能写进简历的「项目链接」

简历上写 `项目链接：https://xxx.github.io/ai-agent-chat-demo/`，点开必须是能用的页面。
下面三条路，选一条，**5 分钟内可以拿到公网地址**。推荐第 1 条（免费、永久、带 HTTPS、简历上最好看）。

> 为什么能纯静态部署：项目内置了**浏览器端模拟模型**（`src/api/demoProvider.js`）。
> 没有后端、没有 API Key 时，页面会自动降级成 Demo 模式，访客照样能点、能看流式输出和工具调用。
> 真实 Key 不会进前端产物，所以公开部署也不会有 Key 泄露风险。

---

## 方案 1：GitHub Pages（推荐）

### 1.1 建仓库并推代码

```bash
cd ai-agent-chat-demo
git init
git add .
git commit -m "feat: AI Agent 对话助手（Vue3 + DeepSeek，SSE + Function Calling）"
git branch -M main
git remote add origin https://github.com/<你的用户名>/ai-agent-chat-demo.git
git push -u origin main
```

### 1.2 打开 Pages

GitHub 仓库 → **Settings → Pages → Build and deployment → Source 选 `GitHub Actions`**。
仓库里已经带了 `.github/workflows/deploy.yml`，推上去就会自动构建，1 分钟左右完成。

### 1.3 你的链接

```
https://<你的用户名>.github.io/ai-agent-chat-demo/
```

首次部署后，Pages 页面顶部会显示这个地址，直接复制到简历。

> 说明：构建脚本用的是本项目自带的 `build-rollup.mjs`（`npm run build:demo`），
> 资源路径用相对路径 `--base=./`，所以放在 `/仓库名/` 这种子路径下也能正常加载。

---

## 方案 2：Netlify（拖拽，最快）

1. 本地执行 `npm install && npm run build:demo`
2. 打开 <https://app.netlify.com/drop>
3. 把 `dist` 文件夹整个拖进去
4. 得到 `https://随机名.netlify.app`，可在 Site settings 里改成 `ai-agent-chat-demo.netlify.app`

仓库里已带 `netlify.toml`，如果连 GitHub 用自动部署也可以直接识别。

---

## 方案 3：Vercel

1. 把仓库推到 GitHub（同方案 1.1）
2. <https://vercel.com/new> 导入仓库
3. 框架选 Other，Build Command `npm run build:demo`，Output Directory `dist`
4. 得到 `https://ai-agent-chat-demo.vercel.app`

仓库里已带 `vercel.json`，导入后一般不用改配置。

---

## 上线后自查（1 分钟）

- [ ] 页面打开不是白屏，左侧有会话列表
- [ ] 点「成都今天要带伞吗？」能出现**工具卡片**（查询天气 / get_weather / 已完成）
- [ ] 回答是**逐字出现**的，不是一次性蹦出来
- [ ] 「停止」按钮在生成过程中可点
- [ ] 手机浏览器打开也正常（面试官经常手机点链接）

---

## 简历 / BOSS 上怎么写

简历项目标题后面加一行：

```
项目链接：https://<你的用户名>.github.io/ai-agent-chat-demo/    GitHub：https://github.com/<你的用户名>/ai-agent-chat-demo
```

BOSS 直聘的「项目经验」里，「项目链接」字段直接粘贴 Pages 地址即可。

**面试官点开时看到的是 Demo 模式**，被问到要点明：

> 线上演示用的是浏览器端模拟数据，保证没配 Key 也能看到完整链路；
> 本地跑 `pnpm dev` 配好 Key 就是真实模型。Key 只在 Node 代理层，不会进前端产物。

这句话本身就是加分项——说明你知道**密钥不能进前端**这条工程红线。

---

## 常见问题

**Q：Pages 显示 404？**
仓库 Settings → Pages 里确认 Source 是 GitHub Actions，并且 Actions 里 workflow 跑成功了（绿色勾）。

**Q：页面白屏、控制台报 404 找 assets？**
说明 base 路径不对。项目默认 `--base=./`，如果改成了绝对路径，就会在子路径下 404。

**Q：想部署成真实可用的（不是 Demo）？**
需要一台服务器跑 Node：`node server/...`，把 `DEEPSEEK_API_KEY` 放在服务器环境变量里，前端构建时不要开 `--demo`。这属于进阶，面试讲清楚架构即可。
