/**
 * Typed fetch wrapper for `/api/dsh-git-flow/*`. Every call names only the
 * session; the host resolves the repository.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  CheckoutRequest,
  DiscardRequest,
  CreateBranchRequest,
  CommitRequest,
  GenerateMessageRequest,
  GitBranchesView,
  GitCommitView,
  GitErrorCode,
  GitMessageView,
  GitPullView,
  GitPushView,
  GitResponse,
  GitStatusView,
} from '../contract.ts'
import type { GitFlowKey } from './locales.ts'

const BASE = '/api/dsh-git-flow'

/** A git operation refused by the host, carrying its structured code. */
export class GitApiError extends Error {
  constructor(readonly code: GitErrorCode, message: string) {
    super(message)
    this.name = 'GitApiError'
  }
}

/** Codes that mean "this session has no git surface"; the chip stays hidden. */
const SILENT: readonly GitErrorCode[] = ['git/not-a-repository', 'git/not-installed']

/** Whether an error should hide the branch chip instead of reporting itself. */
export function isSilentError(error: unknown): boolean {
  return error instanceof GitApiError && SILENT.includes(error.code)
}

/**
 * Codes that mean the panel's selection no longer matches the repository: a
 * commit landed, or files were written while the panel was open. The owner
 * re-reads status so the list catches up instead of failing the same way again.
 */
const STALE_SELECTION: readonly GitErrorCode[] = ['git/invalid-input', 'git/no-files-selected']

/** Whether an error means the checked paths are out of date. */
export function isStaleSelection(error: unknown): boolean {
  return error instanceof GitApiError && STALE_SELECTION.includes(error.code)
}

/** Structured codes with dedicated copy; anything else falls back to git's message. */
const CODED: Partial<Record<GitErrorCode, GitFlowKey>> = {
  'git/not-a-repository': 'error.notRepository',
  'git/not-installed': 'error.notInstalled',
  'git/timeout': 'error.timeout',
  'git/dirty-worktree': 'checkout.dirtyTitle',
  'git/detached-head': 'error.detached',
  'git/invalid-input': 'error.invalid',
  'git/no-files-selected': 'error.noFiles',
  'git/no-route': 'error.noRoute',
}

/** Human-readable failure text for any thrown value. */
export function errorText(t: TranslateNS<'gitFlow'>, error: unknown): string {
  if (!(error instanceof GitApiError)) return t('error.failed', { detail: String(error) })
  const key = CODED[error.code]
  // `detail` is ignored by the keys that carry no placeholder, and it is the
  // only diagnostic the user gets for the codes whose copy is generic.
  return key === undefined ? t('error.failed', { detail: error.message }) : t(key, { detail: error.message })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch (error) {
    throw new GitApiError('git/failed', String(error))
  }
  let payload: GitResponse<T>
  try {
    payload = (await response.json()) as GitResponse<T>
  } catch {
    throw new GitApiError('git/failed', `${response.status} ${response.statusText}`)
  }
  if (!payload.ok) throw new GitApiError(payload.code, payload.message)
  return payload.data
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** One session-scoped query string. */
function query(sessionId: string): string {
  return `sessionId=${encodeURIComponent(sessionId)}`
}

/** The browser-side git API. */
export const gitApi = {
  status: (sessionId: string) => request<GitStatusView>(`/status?${query(sessionId)}`),
  branches: (sessionId: string) => request<GitBranchesView>(`/branches?${query(sessionId)}`),
  checkout: (body: CheckoutRequest) => post<GitStatusView>('/checkout', body),
  createBranch: (body: CreateBranchRequest) => post<GitStatusView>('/branch', body),
  commit: (body: CommitRequest) => post<GitCommitView>('/commit', body),
  discard: (body: DiscardRequest) => post<GitStatusView>('/discard', body),
  push: (body: { sessionId: string }) => post<GitPushView>('/push', body),
  pull: (body: { sessionId: string }) => post<GitPullView>('/pull', body),
  generateMessage: (body: GenerateMessageRequest) => post<GitMessageView>('/generate-message', body),
}
