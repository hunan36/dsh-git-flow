/**
 * Git process seam: one argument-array runner over `ctx.subprocess` plus the
 * porcelain parsers the plugin needs. Nothing here touches the network or
 * accepts a shell string, so a path from the browser can never become a
 * command line.
 */
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'

/** Structured failure codes; the browser half turns them into copy. */
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

/** A git operation that cannot be represented as a normal exit code. */
export class GitError extends Error {
  constructor(readonly code: GitErrorCode, message: string) {
    super(message)
    this.name = 'GitError'
  }
}

/** Cap on collected stdout, in bytes. */
const MAX_STDOUT_BYTES = 4 * 1024 * 1024
/** Cap on collected stderr, in bytes. */
const MAX_STDERR_BYTES = 64 * 1024

/** One completed git invocation. */
export interface GitResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Turn `git status --porcelain=v2 --branch` into the facts the UI renders. */
export interface GitStatus {
  /** Branch name, `'(detached)'` when detached, `'(unknown)'` in an empty repo. */
  head: string
  oid: string
  /** Upstream ref name, when the branch tracks one. */
  upstream?: string
  /** Commits ahead of / behind the upstream, when it tracks one. */
  ahead: number
  behind: number
  /** Tracked changes plus untracked paths. */
  files: GitFileEntry[]
}

/** One changed path in the worktree or index. */
export interface GitFileEntry {
  /** Repository-relative path; for a rename this is the new path. */
  path: string
  /** Renamed-from path, present only for `R` entries. */
  oldPath?: string
  /** Index-vs-HEAD code (`'.'` when clean there). */
  indexStatus: string
  /** Worktree-vs-index code (`'.'` when clean there). */
  worktreeStatus: string
  /** True when the path already has staged content. */
  staged: boolean
  /** True for `??` records. */
  untracked: boolean
  /** True for `u` records. */
  conflicted: boolean
}

/**
 * Run git without a shell and without ambient credentials leaking in.
 * One instance per service; the executable is resolved lazily and cached.
 */
export class GitRunner {
  private executable: Promise<string> | undefined

  constructor(
    private readonly subprocess: SubprocessRuntime,
    private readonly timeoutMs: number,
  ) {}

  private program(): Promise<string> {
    this.executable ??= this.subprocess.resolveExecutable('git').catch((error: unknown) => {
      throw new GitError('git/not-installed', `git executable is unavailable: ${String(error)}`)
    })
    return this.executable
  }

  /**
   * @param cwd - directory the command runs in.
   * @param args - git subcommand and flags; never interpolated into a shell.
   * @returns exit code and collected streams; a non-zero exit is a result.
   * @throws {GitError} when git is missing, the run times out, or spawn fails.
   */
  async run(cwd: string, args: readonly string[]): Promise<GitResult> {
    const program = await this.program()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('git command timed out')), this.timeoutMs)
    try {
      const handle = this.subprocess.spawn({
        argv: [program, ...args],
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: MAX_STDOUT_BYTES },
          stderr: { maxBytes: MAX_STDERR_BYTES },
        },
        graceMs: 2000,
        signal: controller.signal,
        env: { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', LANG: 'C' },
      })
      let exitCode: number
      try {
        const outcome = await handle.done
        exitCode = outcome.exitCode ?? -1
      } catch (error) {
        if (controller.signal.aborted) throw timeoutError(args)
        throw new GitError('git/failed', `failed to run git ${args.join(' ')}: ${String(error)}`)
      }
      if (controller.signal.aborted) throw timeoutError(args)
      return {
        exitCode,
        stdout: handle.collected.stdout?.readFrom(0).text ?? '',
        stderr: handle.collected.stderr?.readFrom(0).text ?? '',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /** Run git and treat a non-zero exit as a `git/failed` error. */
  async runOk(cwd: string, args: readonly string[]): Promise<GitResult> {
    const result = await this.run(cwd, args)
    if (result.exitCode !== 0) {
      throw new GitError('git/failed', describeFailure(args, result))
    }
    return result
  }
}

function timeoutError(args: readonly string[]): GitError {
  return new GitError('git/timeout', `git ${args.join(' ')} timed out`)
}

/** Trim git's stderr into one line suitable for a UI detail message. */
export function describeFailure(args: readonly string[], result: GitResult): string {
  const detail = (result.stderr || result.stdout).replace(/\s+/g, ' ').trim()
  return `git ${args.join(' ')} failed (${result.exitCode}): ${detail || 'no output'}`
}

/**
 * Parse `git status --porcelain=v2 --branch`.
 * @param stdout - raw porcelain output.
 * @returns branch facts and one entry per changed path.
 */
export function parseStatus(stdout: string): GitStatus {
  const status: GitStatus = { head: '(unknown)', oid: '', ahead: 0, behind: 0, files: [] }
  for (const line of stdout.split('\n')) {
    if (!line) continue
    if (line.startsWith('# branch.oid ')) status.oid = line.slice(13).trim()
    else if (line.startsWith('# branch.head ')) status.head = line.slice(14).trim()
    else if (line.startsWith('# branch.upstream ')) status.upstream = line.slice(18).trim()
    else if (line.startsWith('# branch.ab ')) {
      for (const field of line.slice(12).trim().split(/\s+/)) {
        if (field.startsWith('+')) status.ahead = Number(field.slice(1)) || 0
        else if (field.startsWith('-')) status.behind = Number(field.slice(1)) || 0
      }
    } else if (line.startsWith('? ')) {
      status.files.push({ path: line.slice(2), indexStatus: '?', worktreeStatus: '?', staged: false, untracked: true, conflicted: false })
    } else if (line.startsWith('u ')) {
      // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <score> <path>
      const fields = line.split(' ')
      const path = (fields.slice(11).join(' ') || line).split('\t')[0]
      status.files.push({ path, indexStatus: fields[1][0], worktreeStatus: fields[1][1], staged: false, untracked: false, conflicted: true })
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const fields = line.split(' ')
      const xy = fields[1] ?? '..'
      // Renames carry a score field and `<newPath>\t<oldPath>`; plain records end at the path.
      const tail = fields.slice(line[0] === '2' ? 9 : 8).join(' ')
      const [path, oldPath] = line[0] === '2' ? tail.split('\t') : [tail, undefined]
      status.files.push({
        path,
        oldPath,
        indexStatus: xy[0],
        worktreeStatus: xy[1],
        staged: xy[0] !== '.',
        untracked: false,
        conflicted: false,
      })
    }
  }
  return status
}
