/**
 * 极简静态服务器：预览 dist/ 产物用（不参与生产部署）。
 *   node server/static.mjs 5178
 */
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const ROOT = join(process.cwd(), 'dist')
const PORT = Number(process.argv[2] || 5178)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
}

const server = http.createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    let filePath = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''))

    let info = await stat(filePath).catch(() => null)
    if (!info || info.isDirectory()) filePath = join(ROOT, 'index.html')

    const body = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    res.end(body)
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('404')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dist 预览：http://127.0.0.1:${PORT}`)
})
