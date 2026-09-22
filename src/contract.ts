/**
 * Wire contract shared by the node half (implementations) and the browser half
 * (fetch calls). Types only — importing this module never pulls runtime code
 * into either bundle.
 * @module dsh-git-flow/contract
 */

/** Structured failure codes, mirrored by the browser dictionary. */
export type GitErrorCode =
  | 'git/not-installed'
  | 'git/not-a-repository'
  | 'git/timeout'
  | 'git/failed'
  | 'git/dirty-worktree'
  | 'git/detached-head'
  | 'git/invalid-input'
  | 'git/no-files-selected'
  | 'git/no-route'

/** One changed path, as rendered in the commit panel. */
export interface GitFileView {
  /** Repository-relative path; the new name for a rename. */
  path: string
  /** Previous name, present only for a rename. */
  oldPath?: string
  /** Index-vs-HEAD status code, `'.'` when clean there. */
  indexStatus: string
  /** Worktree-vs-index status code, `'.'` when clean there. */
  worktreeStatus: string
  /** True when the path already has staged content. */
  staged: boolean
  /** True for untracked paths. */
  untracked: boolean
  /** True for unresolved conflicts. */
  conflicted: boolean
}

/** `GET /api/dsh-git-flow/status`. */
export interface GitStatusView {
  /** Repository top level, display only. */
  repo: string
  /** Branch name, or `'(detached)'` / `'(unknown)'`. */
  head: string
  detached: boolean
  upstream?: string
  ahead: number
  behind: number
  dirty: boolean
  files: GitFileView[]
}

/** One local branch row. */
export interface GitBranchView {
  name: string
  current: boolean
  upstream?: string
  /** True when only a remote-tracking ref carries this name. */
  remoteOnly: boolean
}

/** `GET /api/dsh-git-flow/branches`. */
export interface GitBranchesView {
  head: string
  local: GitBranchView[]
  /** Remote-tracking branches, minus the symbolic `HEAD` pointers. */
  remote: string[]
}

/** `POST /api/dsh-git-flow/commit`. */
export interface GitCommitView {
  hash: string
  shortHash: string
  branch: string
  files: number
  pushed: boolean
  pushNote?: string
}

/** `POST /api/dsh-git-flow/push`. */
export interface GitPushView {
  pushed: boolean
  /** git's own summary, trimmed to its last lines. */
  pushNote: string
}

/** `POST /api/dsh-git-flow/pull`. */
export interface GitPullView {
  pulled: boolean
  /** git's own summary, trimmed to its last lines. */
  pullNote: string
}

/** `POST /api/dsh-git-flow/generate-message`. */
export interface GitMessageView {
  message: string
  /** True when the model produced nothing usable and the template was used. */
  fallback: boolean
  /** Why the model answer was unusable: its failure, or a rejected shape. */
  reason?: string
  /**
   * Language the message was actually written in. Absent on a host older than
   * the language option, which is how the panel notices a stale host process.
   */
  language?: MessageLanguage
  /** Route used, so a stale model choice is diagnosable. */
  route?: string
}

/** Language of an AI-written commit message. */
export type MessageLanguage = 'zh' | 'en'

/** Envelope every route answers with. */
export type GitResponse<T> =
  | { ok: true; data: T }
  | { ok: false; code: GitErrorCode; message: string }

/** Request bodies. */
export interface CheckoutRequest {
  sessionId: string
  name: string
  force?: boolean
}
export interface CreateBranchRequest {
  sessionId: string
  name: string
  base?: string
}
export interface CommitRequest {
  sessionId: string
  files: string[]
  message: string
  push?: boolean
}

/** `POST /api/dsh-git-flow/discard`: throw the selected paths back to HEAD. */
export interface DiscardRequest {
  sessionId: string
  files: string[]
}
export interface GenerateMessageRequest {
  sessionId: string
  files: string[]
  /** Overrides the configured `messageLanguage` for this call. */
  language?: MessageLanguage
}
export interface PushRequest {
  sessionId: string
}
