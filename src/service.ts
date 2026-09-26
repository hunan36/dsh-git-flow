/**
 * `ctx.gitFlow` — the workspace git surface behind `/api/dsh-git-flow/*`.
 * Every operation is keyed by session id: the repository directory is resolved
 * by the host from the session's workspace, so the browser can never name a
 * path for git to run in.
 */
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import z from '@deepseek-ai/schemastery'
import type { GitBranchesView, GitBranchView, GitCommitView, GitFileView, GitMessageView, GitStatusView, MessageLanguage } from './contract.ts'
import { describeFailure, GitError, GitRunner, parseStatus } from './git.ts'
import { generateCommitMessage } from './message.ts'
import { registerGitFlowRoutes } from './routes.ts'

export type { MessageLanguage }

/** Mountable configuration. */
export interface GitFlowConfig {
  /** Deadline for read-only and local git commands. */
  timeoutMs?: number
  /** Deadline for `git push`, which waits on a remote. */
  pushTimeoutMs?: number
  /** Upper bound on diff bytes handed to the model. */
  messageMaxDiffBytes?: number
  /** Default commit message language; the commit panel can override it per call. */
  messageLanguage?: MessageLanguage
}

/** A branch ref row from `for-each-ref`. */
interface RefRow {
  full: string
  name: string
  upstream: string
}

/**
 * Branch switching, panel-scoped commits, pushes, and AI commit messages for
 * the session's workspace.
 */
export class GitFlow extends Service {
  /**
   * `workspaceRegistry` is read through `ctx.get` rather than declared here: a
   * profile without one (the shipped `headless` profile) must still activate
   * this entry instead of reporting a permanently pending plugin. Every git
   * call in such a profile answers `git/not-a-repository`, since no session can
   * resolve a repository.
   */
  static inject = ['subprocess', 'sessions', 'llm']
  static Config: z<GitFlowConfig> = z.object({
    timeoutMs: z.number().default(15000),
    pushTimeoutMs: z.number().default(120000),
    messageMaxDiffBytes: z.number().default(65536),
    messageLanguage: z.union([z.const('zh'), z.const('en')]).default('en'),
  })

  private readonly config: Required<Pick<GitFlowConfig, 'timeoutMs' | 'pushTimeoutMs' | 'messageMaxDiffBytes' | 'messageLanguage'>>
  private readonly git: GitRunner
  /** Remote-waiting calls (push, pull) outlive the default runner deadline, so the runner is per-call-site. */
  private readonly remoteGit: GitRunner

  constructor(ctx: Context, config: GitFlowConfig = {}) {
    super(ctx, 'gitFlow')
    this.config = {
      timeoutMs: config.timeoutMs ?? 15000,
      pushTimeoutMs: config.pushTimeoutMs ?? 120000,
      messageMaxDiffBytes: config.messageMaxDiffBytes ?? 65536,
      messageLanguage: config.messageLanguage ?? 'en',
    }
    this.git = new GitRunner(ctx.subprocess, this.config.timeoutMs)
    this.remoteGit = new GitRunner(ctx.subprocess, this.config.pushTimeoutMs)

    // Only the web profile has a server to talk to; a headless profile never
    // mounts the routes and the browser half never exists there.
    ctx.inject(['webServer'], (webCtx) => {
      webCtx.effect(() => registerGitFlowRoutes(webCtx, this), 'dsh-git-flow: api routes')
    })
  }

  /**
   * @param sessionId - session whose workspace backs the repository.
   * @returns branch, ahead/behind, and one row per changed path.
   */
  async status(sessionId: string): Promise<GitStatusView> {
    const repo = await this.resolveRepo(sessionId)
    // `-z` is load-bearing: without it git C-quotes paths that hold non-ASCII
    // bytes (a Chinese file name becomes `"docs/00-\350\265\204..."`), and that
    // quoted text would be sent back as a literal pathspec on the next commit.
    const result = await this.git.runOk(repo, ['status', '--porcelain=v2', '--branch', '-z'])
    const parsed = parseStatus(result.stdout)
    const files = dedupeFiles(parsed.files)
    return {
      repo,
      head: parsed.head,
      detached: parsed.head === '(detached)',
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      dirty: files.length > 0,
      files,
    }
  }

  /**
   * @param sessionId - session whose workspace backs the repository.
   * @returns local and remote-tracking branch rows, current one flagged.
   */
  async branches(sessionId: string): Promise<GitBranchesView> {
    const status = await this.status(sessionId)
    const repo = status.repo
    const format = '%(refname)%09%(refname:short)%09%(upstream:short)'
    const result = await this.git.runOk(repo, ['for-each-ref', `--format=${format}`, 'refs/heads', 'refs/remotes'])
    const rows: RefRow[] = result.stdout
      .split('\n')
      .filter((line) => line.includes('\t'))
      .map((line) => {
        const [full, name, upstream] = line.split('\t')
        return { full, name, upstream }
      })
    const localNames = new Set(rows.filter((row) => row.full.startsWith('refs/heads/')).map((row) => row.name))
    const local: GitBranchView[] = rows
      .filter((row) => row.full.startsWith('refs/heads/'))
      .map((row) => ({ name: row.name, current: row.name === status.head, upstream: row.upstream || undefined, remoteOnly: false }))
    for (const row of rows) {
      if (!row.full.startsWith('refs/remotes/')) continue
      const withoutHead = stripRemoteHead(row.name)
      if (withoutHead === undefined || localNames.has(shortRemoteName(withoutHead))) continue
      local.push({ name: withoutHead, current: false, upstream: withoutHead, remoteOnly: true })
    }
    local.sort((a, b) => a.name.localeCompare(b.name))
    const remote = rows
      .filter((row) => row.full.startsWith('refs/remotes/'))
      .map((row) => stripRemoteHead(row.name))
      .filter((name): name is string => name !== undefined)
    return { head: status.head, local, remote }
  }

  /**
   * Switch branches, optionally creating a local branch for a unique remote one.
   * @param sessionId - session whose workspace backs the repository.
   * @param name - branch to check out.
   * @param force - discard conflicting worktree changes; never used silently.
   */
  async checkout(sessionId: string, name: string, force = false): Promise<GitStatusView> {
    const repo = await this.resolveRepo(sessionId)
    assertBranchName(name)
    const args = ['switch']
    if (force) args.push('--force')
    if (await this.hasLocalBranch(repo, name)) {
      args.push(name)
    } else {
      const remotes = await this.remoteBranches(repo, name)
      if (remotes.length > 1) {
        throw new GitError('git/invalid-input', `branch ${name} exists on multiple remotes: ${remotes.join(', ')}`)
      }
      if (remotes.length === 1) args.push('-c', name, '--track', remotes[0])
      else args.push(name)
    }
    await this.runSwitch(repo, args)
    return this.status(sessionId)
  }

  /**
   * Create one branch from `base` (default: current HEAD) and switch to it.
   * @param sessionId - session whose workspace backs the repository.
   * @param name - new branch name.
   * @param base - existing ref to start from.
   */
  async createBranch(sessionId: string, name: string, base?: string): Promise<GitStatusView> {
    const repo = await this.resolveRepo(sessionId)
    assertBranchName(name)
    if (await this.hasLocalBranch(repo, name)) {
      throw new GitError('git/invalid-input', `branch ${name} already exists`)
    }
    if (base !== undefined && base.length > 0) {
      assertBranchName(base)
      const verified = await this.git.run(repo, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`])
      if (verified.exitCode !== 0) throw new GitError('git/invalid-input', `base ${base} does not exist`)
    }
    const args = ['switch', '-c', name]
    if (base !== undefined && base.length > 0) args.push(base)
    await this.runSwitch(repo, args)
    return this.status(sessionId)
  }

  /**
   * Throw away the worktree and index changes for the selected paths: tracked
   * paths go back to HEAD (a staged addition is removed from the index and from
   * disk), and untracked paths are deleted. Destructive by definition, so the
   * caller confirms first; conflicted paths are refused rather than guessed at.
   * @param sessionId - session whose workspace backs the repository.
   * @param files - paths as reported by {@link status}; anything else is rejected.
   */
  async discard(sessionId: string, files: readonly string[]): Promise<GitStatusView> {
    const status = await this.status(sessionId)
    const selected = selectPaths(status.files, files)
    const byPath = new Map(status.files.map((file) => [file.path, file]))
    const conflicted = selected.filter((path) => byPath.get(path)?.conflicted === true)
    if (conflicted.length > 0) {
      throw new GitError('git/invalid-input', `${conflicted[0]} has an unresolved conflict; resolve it first`)
    }
    // Untracked paths have nothing to restore from, and `git restore` refuses
    // them outright; the rest (including a rename's both sides) go to HEAD.
    const untracked = selected.filter((path) => byPath.get(path)?.untracked === true)
    const tracked = selected.filter((path) => byPath.get(path)?.untracked !== true)
    if (tracked.length > 0) {
      await this.git.runOk(status.repo, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...tracked])
    }
    // -d so an untracked directory goes with its contents; ignored files stay.
    if (untracked.length > 0) {
      await this.git.runOk(status.repo, ['clean', '-fd', '--', ...untracked])
    }
    return this.status(sessionId)
  }

  /**
   * Stage exactly the selected paths, commit them, and optionally push.
   * @param sessionId - session whose workspace backs the repository.
   * @param files - paths as reported by {@link status}; anything else is rejected.
   * @param message - commit message text.
   * @param push - push the resulting commit to the branch upstream.
   */
  async commit(sessionId: string, files: readonly string[], message: string, push = false): Promise<GitCommitView> {
    const status = await this.status(sessionId)
    if (status.detached) throw new GitError('git/detached-head', 'committing on a detached HEAD needs an explicit branch')
    if (message.trim().length === 0) throw new GitError('git/invalid-input', 'a commit message is required')
    const selected = selectPaths(status.files, files)
    const args = ['add', '-A', '--', ...selected]
    await this.git.runOk(status.repo, args)
    const result = await this.git.runOk(status.repo, ['commit', '--only', '-m', message, '--', ...selected])
    const hash = (await this.git.runOk(status.repo, ['rev-parse', 'HEAD'])).stdout.trim()
    const view: GitCommitView = {
      hash,
      shortHash: hash.slice(0, 7),
      branch: status.head,
      files: selected.length,
      pushed: false,
      pushNote: trimOutput(result.stdout),
    }
    if (push) {
      const pushed = await this.push(sessionId)
      view.pushed = true
      view.pushNote = pushed
    }
    return view
  }

  /**
   * Push the current branch to its upstream. Never force, and never to a
   * caller-supplied remote or refspec.
   * @param sessionId - session whose workspace backs the repository.
   * @returns git's push summary.
   */
  async push(sessionId: string): Promise<string> {
    const status = await this.status(sessionId)
    if (status.detached) throw new GitError('git/detached-head', 'there is no branch to push')
    if (status.upstream) {
      const result = await this.remoteGit.runOk(status.repo, ['push'])
      return trimOutput(`${result.stdout}\n${result.stderr}`)
    }
    const remote = (await this.git.run(status.repo, ['config', '--get', `branch.${status.head}.remote`])).stdout.trim() || 'origin'
    const result = await this.remoteGit.runOk(status.repo, ['push', '--set-upstream', remote, `HEAD:refs/heads/${status.head}`])
    return trimOutput(`${result.stdout}\n${result.stderr}`)
  }

  /**
   * Pull the current branch's upstream with `--ff-only`: a fast-forward is the
   * only allowed outcome, so a diverged branch fails instead of producing a
   * merge commit or rewriting local commits. This is the plugin's one
   * user-initiated network call outside push; nothing fetches in the background.
   * @param sessionId - session whose workspace backs the repository.
   * @returns git's pull summary.
   */
  async pull(sessionId: string): Promise<string> {
    const status = await this.status(sessionId)
    if (status.detached) throw new GitError('git/detached-head', 'there is no branch to pull')
    if (!status.upstream) throw new GitError('git/invalid-input', 'this branch has no upstream to pull from')
    const result = await this.remoteGit.runOk(status.repo, ['pull', '--ff-only'])
    return trimOutput(`${result.stdout}\n${result.stderr}`)
  }

  /**
   * Ask the session's own model route for a commit message over the selected diff.
   * @param sessionId - session whose workspace and route back the call.
   * @param files - paths as reported by {@link status}.
   * @param language - per-call override for the configured message language.
   */
  async generateMessage(sessionId: string, files: readonly string[], language?: MessageLanguage): Promise<GitMessageView> {
    const status = await this.status(sessionId)
    const selected = selectPaths(status.files, files)
    const diff = await this.collectDiff(status.repo, selected)
    const session = liveSession(this.ctx, sessionId)
    return generateCommitMessage({
      ctx: this.ctx,
      session,
      language: language ?? this.config.messageLanguage,
      head: status.head,
      selected,
      files: status.files.filter((file) => selected.includes(file.path) || selected.includes(file.oldPath ?? '')),
      diff: diff.text,
      truncated: diff.truncated,
    })
  }

  /** Collect the selected diff without staging anything. */
  private async collectDiff(repo: string, selected: readonly string[]): Promise<{ text: string; truncated: boolean }> {
    const parts: string[] = []
    // `core.quotePath=false` is display-only: it keeps a Chinese path readable
    // in the prompt instead of `"docs/\345\274\200..."`. The runner pins
    // LC_ALL=C, where git would otherwise octal-escape every non-ASCII byte.
    const display = ['-c', 'core.quotePath=false']
    const numstat = await this.git.runOk(repo, [...display, 'diff', 'HEAD', '--numstat', '--', ...selected])
    if (numstat.stdout.trim()) parts.push(`# numstat\n${numstat.stdout.trim()}`)
    const tracked = await this.git.runOk(repo, [...display, 'diff', 'HEAD', '--', ...selected])
    if (tracked.stdout.trim()) parts.push(tracked.stdout)
    // Untracked paths are invisible to `diff HEAD`; render them as pure additions.
    for (const path of selected) {
      const known = await this.git.run(repo, ['ls-files', '--error-unmatch', '--', path])
      if (known.exitCode === 0) continue
      const added = await this.git.run(repo, [...display, 'diff', '--no-index', '--', '/dev/null', path])
      if (added.stdout.trim()) parts.push(added.stdout)
    }
    const text = parts.join('\n')
    const limit = this.config.messageMaxDiffBytes
    if (Buffer.byteLength(text, 'utf8') <= limit) return { text, truncated: false }
    const head = Buffer.from(text, 'utf8').subarray(0, limit).toString('utf8')
    return { text: `${head}\n… diff truncated …`, truncated: true }
  }

  /** Repository top level for one session's workspace. */
  private async resolveRepo(sessionId: string): Promise<string> {
    const workspace = this.resolveWorkspace(sessionId)
    const result = await this.git.run(workspace.path, ['rev-parse', '--show-toplevel'])
    if (result.exitCode !== 0) {
      throw new GitError('git/not-a-repository', `${workspace.path} is not inside a git repository`)
    }
    return result.stdout.trim()
  }

  private resolveWorkspace(sessionId: string): Workspace {
    // Deliberately not a declared inject: see the static `inject` note.
    const registry = this.ctx.get('workspaceRegistry')
    if (registry === undefined) {
      throw new GitError('git/not-a-repository', 'this profile registers no workspace, so no repository can be resolved')
    }
    const match = registry.list().find((workspace) => workspaceHasSession(workspace, sessionId))
    if (match === undefined) {
      throw new GitError('git/not-a-repository', 'this session has no registered workspace')
    }
    return match
  }

  private async hasLocalBranch(repo: string, name: string): Promise<boolean> {
    const result = await this.git.run(repo, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`])
    return result.exitCode === 0
  }

  private async remoteBranches(repo: string, name: string): Promise<string[]> {
    const result = await this.git.runOk(repo, ['for-each-ref', '--format=%(refname:short)', `refs/remotes/*/${name}`])
    return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean)
  }

  private async runSwitch(repo: string, args: readonly string[]): Promise<void> {
    const result = await this.git.run(repo, args)
    if (result.exitCode === 0) return
    const detail = (result.stderr || result.stdout).trim()
    if (/local changes|would be overwritten|not clean|Your index contains staged changes/i.test(detail)) {
      throw new GitError('git/dirty-worktree', detail)
    }
    throw new GitError('git/failed', describeFailure(args, result))
  }
}

/** Reject inputs that could read as an option or break out of the repository. */
function assertBranchName(name: string): void {
  if (name.length === 0) throw new GitError('git/invalid-input', 'a branch name is required')
  if (name.startsWith('-')) throw new GitError('git/invalid-input', 'a branch name cannot start with -')
  if (/[\s\u0000-\u001f\u007f~^:?*[\\]/.test(name)) {
    throw new GitError('git/invalid-input', `invalid branch name: ${name}`)
  }
  if (name.includes('..') || name.includes('//') || /[.@{}]$/.test(name) || /^-|-$/.test(name) || name.includes('@{')) {
    throw new GitError('git/invalid-input', `invalid branch name: ${name}`)
  }
}

/** Merge porcelain rows that report one path twice (a staged delete plus an untracked add). */
function dedupeFiles(entries: readonly GitFileView[]): GitFileView[] {
  const byPath = new Map<string, GitFileView>()
  for (const entry of entries) {
    const existing = byPath.get(entry.path)
    if (existing === undefined) {
      byPath.set(entry.path, { ...entry })
      continue
    }
    existing.staged ||= entry.staged
    existing.untracked ||= entry.untracked
    if (existing.indexStatus === '.' || existing.indexStatus === '?') existing.indexStatus = entry.indexStatus
    if (entry.worktreeStatus !== '.' && entry.worktreeStatus !== '?') existing.worktreeStatus = entry.worktreeStatus
  }
  return [...byPath.values()]
}

/**
 * Validate the browser's selection against what `status` just reported.
 * @returns pathspecs to hand to git, renames expanded to both sides.
 */
function selectPaths(files: readonly GitFileView[], requested: readonly string[]): string[] {
  if (requested.length === 0) throw new GitError('git/no-files-selected', 'select at least one file to commit')
  const reported = new Map<string, GitFileView>()
  for (const file of files) {
    reported.set(file.path, file)
    if (file.oldPath !== undefined) reported.set(file.oldPath, file)
  }
  const paths: string[] = []
  for (const raw of requested) {
    const file = reported.get(raw)
    if (file === undefined) throw new GitError('git/invalid-input', `${raw} is not a changed path`)
    if (raw.startsWith('-')) throw new GitError('git/invalid-input', `${raw} is not a valid path`)
    if (file.oldPath !== undefined && !paths.includes(file.oldPath)) paths.push(file.oldPath)
    if (!paths.includes(file.path)) paths.push(file.path)
  }
  return paths
}

/** `origin/main` from `origin/HEAD -> main` style rows; undefined for symbolic pointers. */
function stripRemoteHead(name: string): string | undefined {
  if (name.endsWith('/HEAD')) return undefined
  return name
}

function shortRemoteName(fullRemote: string): string {
  const slash = fullRemote.indexOf('/')
  return slash < 0 ? fullRemote : fullRemote.slice(slash + 1)
}

function workspaceHasSession(workspace: Workspace, sessionId: string): boolean {
  return workspace.sessionIds.some((id) => String(id) === sessionId)
}

function liveSession(ctx: Context, sessionId: string): Session | undefined {
  return ctx.sessions.list().find((session) => String(session.id) === sessionId)
}

/** Keep push output to the last meaningful lines. */
function trimOutput(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.slice(-4).join('\n')
}
