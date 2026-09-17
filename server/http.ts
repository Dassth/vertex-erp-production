/* Node HTTP server: the fetch API handler plus the built client files. */

import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { VertexService } from './service'
import type { ApiOptions } from './api'
import { createApiHandler } from './api'

export { SESSION_COOKIE } from './api'

export interface HttpOptions extends ApiOptions {
  /** Built client to serve; omitted = API only. */
  staticDir?: string
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
}

function toRequest(req: IncomingMessage): Request {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const item of v) headers.append(k, item)
    else if (v !== undefined) headers.set(k, v)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as unknown as BodyInit) : undefined,
    // Required by Node's fetch implementation for streamed request bodies.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit)
}

async function sendResponse(res: ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {}
  response.headers.forEach((value, key) => {
    headers[key] = key === 'set-cookie' ? response.headers.getSetCookie() : value
  })
  res.writeHead(response.status, headers)
  res.end(Buffer.from(await response.arrayBuffer()))
}

export function createHttpServer(service: VertexService, options: HttpOptions = {}): Server {
  const api = createApiHandler(service, options)
  const root = options.staticDir ? resolve(options.staticDir) : null

  const serveStatic = (res: ServerResponse, path: string) => {
    if (!root) {
      res.writeHead(404, { 'content-type': 'application/json' })
      return res.end('{"ok":false,"error":"Not found."}')
    }
    let file = normalize(join(root, decodeURIComponent(path)))
    if (!file.startsWith(root)) {
      res.writeHead(403)
      return res.end()
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html') // SPA route
    const type = MIME[extname(file)] ?? 'application/octet-stream'
    res.writeHead(200, { 'content-type': type, 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
    createReadStream(file).pipe(res)
  }

  return createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname
    try {
      if (path.startsWith('/api/')) await sendResponse(res, await api(toRequest(req)))
      else serveStatic(res, path)
    } catch (err) {
      console.error(err)
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end('{"ok":false,"error":"The server could not complete the request. Nothing was saved."}')
      } else res.end()
    }
  })
}
