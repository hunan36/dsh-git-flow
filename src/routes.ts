/**
 * `/api/dsh-git-flow/*` — the browser half's only door into git. Requests carry
 * a session id and nothing else; the service derives the repository from the
 * session's registered workspace, so a page can never name a directory.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { GitErrorCode, GitPullView, GitPushView, GitResponse } from './contract.ts'
import { GitError } from './git.ts'
import type { GitFlow } from './service.ts'

const BASE = '/api/dsh-git-flow'
/** Commit panels send path lists, not content; anything larger is a client bug. */
const MAX_BODY_BYTES = 256 * 1024

/**
 * Register every route on the mounted context.
 * @param ctx - context that already sees `webServer`.
 * @param service - the git surface to expose.
 * @returns a disposer removing all routes.
 */
export function registerGitFlowRoutes(ctx: Context, service: GitFlow): () => void {
  const routes: Array<() => void> = [
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/status`, handler: (req, res) => handle(req, res, () => {
      requireMethod(req, 'GET')
      return service.status(sessionIdFromQuery(req))
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/branches`, handler: (req, res) => handle(req, res, () => {
      requireMethod(req, 'GET')
      return service.branches(sessionIdFromQuery(req))
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/checkout`, handler: (req, res) => handle(req, res, async (body) => {
      requireMethod(req, 'POST')
      const { sessionId, name, force } = readBody(body)
      if (typeof name !== 'string') throw new GitError('git/invalid-input', 'name is required')
      return service.checkout(sessionId, name, force === true)
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/branch`, handler: (req, res) => handle(req, res, async (body) => {
      requireMethod(req, 'POST')
      const { sessionId, name, base } = readBody(body)
      if (typeof name !== 'string') throw new GitError('git/invalid-input', 'name is required')
      if (base !== undefined && typeof base !== 'string') throw new GitError('git/invalid-input', 'base must be a string')
      return service.createBranch(sessionId, name, base)
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/commit`, handler: (req, res) => handle(req, res, async (body) => {
      requireMethod(req, 'POST')
      const { sessionId, files, message, push } = readBody(body)
      return service.commit(sessionId, stringArray(files, 'files'), requireString(message, 'message'), push === true)
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/discard`, handler: (req, res) => handle(req, res, async (body) => {
      requireMethod(req, 'POST')
      const { sessionId, files } = readBody(body)
      return service.discard(sessionId, stringArray(files, 'files'))
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/push`, handler: (req, res) => handle(req, res, async (body) => {
      requireMethod(req, 'POST')
      const { sessionId } = readBody(body)
      const pushNote = await service.push(sessionId)
      const view: GitPushView = { pushed: true, pushNote }
      return view
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/pull`, handler: (req, res) => handle(req, res, async (body) => {
      requireMethod(req, 'POST')
      const { sessionId } = readBody(body)
      const pullNote = await service.pull(sessionId)
      const view: GitPullView = { pulled: true, pullNote }
      return view
    }) }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/generate-message`, handler: (req, res) => handle(req, res, async (body) => {
      requireMethod(req, 'POST')
      const { sessionId, files, language } = readBody(body)
      if (language !== undefined && language !== 'zh' && language !== 'en') {
        throw new GitError('git/invalid-input', 'language must be "zh" or "en"')
      }
      return service.generateMessage(sessionId, stringArray(files, 'files'), language)
    }) }),
  ]
  return () => {
    for (const remove of routes.reverse()) remove()
  }
}

/** Run one handler, translating thrown values into the shared envelope. */
async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  work: (body: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readJson(req)
    const data = await work(body)
    json(res, 200, { ok: true, data } satisfies GitResponse<unknown>)
  } catch (error) {
    const code: GitErrorCode = error instanceof GitError ? error.code
      : error instanceof MethodError ? 'git/invalid-input'
      : 'git/failed'
    json(res, statusFor(code), { ok: false, code, message: error instanceof Error ? error.message : String(error) })
  }
}

/** A wrong HTTP verb is a client bug, reported as an invalid request. */
class MethodError extends Error {}

function requireMethod(req: IncomingMessage, method: 'GET' | 'POST'): void {
  if (req.method === method) return
  throw new MethodError(`expected a ${method} request, got ${req.method ?? 'unknown'}`)
}

function statusFor(code: GitErrorCode): number {
  if (code === 'git/invalid-input' || code === 'git/no-files-selected' || code === 'git/detached-head' || code === 'git/dirty-worktree') return 400
  if (code === 'git/not-a-repository' || code === 'git/not-installed' || code === 'git/no-route') return 404
  if (code === 'git/timeout') return 504
  return 500
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  const text = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  res.end(text)
}

/** Read and parse a bounded JSON body. */
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new GitError('git/invalid-input', 'request body is too large')
    chunks.push(buffer)
  }
  if (size === 0) return {}
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new GitError('git/invalid-input', 'expected a JSON object body')
  }
  return parsed as Record<string, unknown>
}

function readBody(body: Record<string, unknown>): { sessionId: string; [key: string]: unknown } {
  return { ...body, sessionId: requireString(body.sessionId, 'sessionId') }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new GitError('git/invalid-input', `${field} must be a non-empty string`)
  return value
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new GitError('git/invalid-input', `${field} must be an array of paths`)
  return value.map((item) => requireString(item, field))
}

function sessionIdFromQuery(req: IncomingMessage): string {
  const url = new URL(req.url ?? '/', 'http://dsh.invalid')
  return requireString(url.searchParams.get('sessionId'), 'sessionId')
}
