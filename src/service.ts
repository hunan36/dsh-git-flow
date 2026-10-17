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
import { readFile, writeFile } from 'node:fs/promises'
import * as nodePath from 'node:path'
import type { GitBranchesView, GitBranchView, GitCommitView, GitFileView, GitFlowConfigView, GitFlowFinishView, GitFlowKind, GitFlowStateView, GitMessageView, GitStatusView, MessageLanguage } from './contract.ts'
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
  /** Branch every release and hotfix is merged back into. */
  productionBranch?: string
  /** Integration branch features start from and merge back into. */
  developBranch?: string
  featurePrefix?: string
  releasePrefix?: string
  hotfixPrefix?: string
  /** Prefix of the tag a finished release or hotfix creates. */
  tagPrefix?: string
}

/** The branch layout a git-flow run works with, resolved from config. */
interface FlowLayout {
  production: string
  develop: string
  featurePrefix: string
  releasePrefix: string
  hotfixPrefix: string
  tagPrefix: string
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
    productionBranch: z.string().default('main'),
    developBranch: z.string().default('develop'),
    featurePrefix: z.string().default('feature/'),
    releasePrefix: z.string().default('release/'),
    hotfixPrefix: z.string().default('hotfix/'),
    tagPrefix: z.string().default('v'),
  })

  private readonly config: Required<GitFlowConfig>
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
      productionBranch: config.productionBranch ?? 'main',
      developBranch: config.developBranch ?? 'develop',
      featurePrefix: config.featurePrefix ?? 'feature/',
      releasePrefix: config.releasePrefix ?? 'release/',
      hotfixPrefix: config.hotfixPrefix ?? 'hotfix/',
      tagPrefix: config.tagPrefix ?? 'v',
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
    // `status` is a snapshot taken when this call started; an agent or editor
    // may have touched a selected path since. `--only` aborts the whole commit
    // with "nothing to commit" when *any* pathspec has no net change, so drop
    // the paths that already match HEAD before committing the rest.
    const staged = await this.changedInIndex(status.repo, selected)
    if (staged.length === 0) {
      throw new GitError('git/invalid-input', 'the selected files have no changes left to commit; refresh the list and try again')
    }
    const result = await this.git.runOk(status.repo, ['commit', '--only', '-m', message, '--', ...staged])
    const hash = (await this.git.runOk(status.repo, ['rev-parse', 'HEAD'])).stdout.trim()
    const view: GitCommitView = {
      hash,
      shortHash: hash.slice(0, 7),
      branch: status.head,
      files: staged.length,
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

  /** The resolved branch layout, as the panel renders it. */
  private layout(): FlowLayout {
    return {
      production: this.config.productionBranch,
      develop: this.config.developBranch,
      featurePrefix: this.config.featurePrefix,
      releasePrefix: this.config.releasePrefix,
      hotfixPrefix: this.config.hotfixPrefix,
      tagPrefix: this.config.tagPrefix,
    }
  }

  /**
   * Describe the flow state of the current branch: which family it belongs to,
   * the version its name carries, whether the branches a run needs exist, and
   * whether the tag a finish would create is already taken.
   * @param sessionId - session whose workspace backs the repository.
   */
  async gitflowState(sessionId: string): Promise<GitFlowStateView> {
    const status = await this.status(sessionId)
    const layout = this.layout()
    const repo = status.repo
    const parsed = splitFlowBranch(status.head, layout)
    const hasDevelop = await this.hasLocalBranch(repo, layout.develop) || (await this.remoteBranches(repo, layout.develop)).length > 0
    const hasProduction = await this.hasLocalBranch(repo, layout.production) || (await this.remoteBranches(repo, layout.production)).length > 0
    const target = parsed?.kind === 'feature' ? layout.develop : layout.production
    const ahead = parsed === undefined ? 0 : await this.countAhead(repo, status.head, target)
    // Only release and hotfix carry a tag; a feature finishes with a merge alone.
    const tagName = parsed?.version === undefined || parsed.kind === 'feature' ? undefined : `${layout.tagPrefix}${parsed.version}`
    const tagExists = tagName !== undefined && (await this.tagExists(repo, tagName))
    return {
      head: status.head,
      detached: status.detached,
      kind: parsed?.kind,
      slug: parsed?.slug,
      version: parsed?.version,
      hasDevelop,
      hasProduction,
      ahead,
      tagName,
      tagExists,
      branches: layoutView(layout),
    }
  }

  /**
   * Create a flow branch from the branch its family starts at and switch to it.
   * A missing develop is reported as `git/develop-missing` so the panel can
   * offer to create it rather than dead-ending on a raw git failure.
   * @param sessionId - session whose workspace backs the repository.
   * @param kind - branch family to start.
   * @param name - name inside the family, without the prefix.
   */
  async startFlow(sessionId: string, kind: GitFlowKind, name: string): Promise<GitStatusView> {
    const status = await this.status(sessionId)
    if (status.detached) throw new GitError('git/detached-head', 'start a flow branch from a real branch, not a detached HEAD')
    const layout = this.layout()
    const slug = name.trim()
    assertFlowSlug(slug)
    const branch = `${prefixOf(kind, layout)}${slug}`
    if (await this.hasLocalBranch(status.repo, branch)) {
      throw new GitError('git/invalid-input', `branch ${branch} already exists`)
    }
    // Features and releases are cut from develop; a hotfix is cut from production.
    const base = kind === 'hotfix' ? layout.production : layout.develop
    if (!(await this.hasLocalBranch(status.repo, base))) {
      if (kind !== 'hotfix') {
        throw new GitError('git/develop-missing', `branch ${base} does not exist yet; create it first`)
      }
      throw new GitError('git/invalid-input', `branch ${base} does not exist; a hotfix starts from it`)
    }
    await this.runSwitch(status.repo, ['switch', '-c', branch, base])
    return this.status(sessionId)
  }

  /**
   * Create the develop branch from the production branch and switch to it.
   * Only offered when develop is missing; an existing one is left untouched.
   * @param sessionId - session whose workspace backs the repository.
   */
  async initDevelop(sessionId: string): Promise<GitStatusView> {
    const status = await this.status(sessionId)
    const layout = this.layout()
    if (await this.hasLocalBranch(status.repo, layout.develop)) return status
    const from = (await this.hasLocalBranch(status.repo, layout.production)) ? layout.production : status.head
    if (status.detached) throw new GitError('git/detached-head', 'cannot create a develop branch from a detached HEAD')
    await this.runSwitch(status.repo, ['switch', '-c', layout.develop, from])
    return this.status(sessionId)
  }

  /**
   * Finish the current flow branch: merge it back (`--no-ff`), tag a release or
   * hotfix, write its version, push, and delete the branch.
   *
   * Every check that can fail without side effects runs first: the worktree is
   * clean, the merge would not conflict, and the tag is free. Past that point
   * steps are not rolled back, because each one is a committed fact; a failure
   * reports which step stopped the run and leaves the repository as it stands.
   * @param sessionId - session whose workspace backs the repository.
   * @param version - `package.json` version to write, release and hotfix only.
   */
  async finishFlow(sessionId: string, version?: string): Promise<GitFlowFinishView> {
    const status = await this.status(sessionId)
    if (status.detached) throw new GitError('git/detached-head', 'finish a flow branch, not a detached HEAD')
    const layout = this.layout()
    const parsed = splitFlowBranch(status.head, layout)
    if (parsed === undefined) {
      throw new GitError('git/gitflow-branch-required', `${status.head} is not a feature, release, or hotfix branch`)
    }
    const repo = status.repo
    const branch = status.head
    const { kind } = parsed
    if (status.files.length > 0) {
      throw new GitError('git/dirty-worktree', 'commit or discard the working tree changes before finishing')
    }
    // Release and hotfix land on production and develop; a feature lands on develop.
    const targets = kind === 'feature' ? [layout.develop] : [layout.production, layout.develop]
    for (const target of targets) {
      if (!(await this.hasLocalBranch(repo, target))) {
        throw new GitError('git/invalid-input', `branch ${target} does not exist, so ${branch} cannot be merged back into it`)
      }
    }
    const tagName = kind === 'feature' ? undefined : `${layout.tagPrefix}${parsed.version ?? (await this.currentVersion(repo)) ?? ''}`
    if (tagName === `${layout.tagPrefix}`) {
      throw new GitError('git/invalid-input', 'a version is required to tag this branch')
    }
    // Preflight: a taken tag must stop the run before anything is merged.
    if (tagName !== undefined && (await this.tagExists(repo, tagName))) {
      throw new GitError('git/tag-exists', `tag ${tagName} already exists`)
    }
    const nextVersion = kind === 'feature' ? undefined : (version ?? parsed.version)
    if (nextVersion !== undefined) assertVersion(nextVersion)

    const mergedInto: string[] = []
    for (const target of targets) {
      await this.mergeInto(repo, target, branch)
      mergedInto.push(target)
    }
    if (tagName !== undefined) {
      await this.git.runOk(repo, ['tag', '-a', tagName, '-m', `${tagName}`])
    }
    let wroteVersion: string | undefined
    if (nextVersion !== undefined) wroteVersion = await this.writeVersion(repo, nextVersion)

    // Push is the one step that talks to the network; a failure here keeps every
    // local fact the run already produced.
    const pushed: string[] = []
    const failure = await this.pushFinished(repo, targets, tagName, pushed)

    // The branch is only deleted with `-d`, so an unmerged branch is refused by git.
    let deleted = false
    if (failure === undefined) {
      const removed = await this.git.run(repo, ['branch', '-d', branch])
      deleted = removed.exitCode === 0
    }
    return {
      kind,
      branch,
      mergedInto,
      tag: tagName,
      version: wroteVersion,
      pushed,
      deleted,
      failure,
    }
  }

  /** Merge one branch into a target with a merge commit, refusing on conflict. */
  private async mergeInto(repo: string, target: string, branch: string): Promise<void> {
    await this.runSwitch(repo, ['switch', target])
    const result = await this.git.run(repo, ['merge', '--no-ff', branch, '-m', `Merge branch '${branch}' into ${target}`])
    if (result.exitCode === 0) return
    // A conflict leaves markers in the worktree; report it as such and stop,
    // rather than aborting a merge the user may want to resolve by hand.
    const after = parseStatus((await this.git.runOk(repo, ['status', '--porcelain=v2', '--branch', '-z'])).stdout)
    if (after.files.some((file) => file.conflicted)) {
      throw new GitError('git/merge-conflict', `merging ${branch} into ${target} conflicted; resolve the conflicts, then finish again`)
    }
    throw new GitError('git/failed', describeFailure(['merge', '--no-ff', branch], result))
  }

  /** Push each merged target and the new tag; the first failure is reported, not thrown. */
  private async pushFinished(repo: string, targets: readonly string[], tag: string | undefined, pushed: string[]): Promise<{ id: string; detail: string; ok: boolean } | undefined> {
    for (const target of targets) {
      const result = await this.remoteGit.run(repo, ['push', '-u', 'origin', target])
      if (result.exitCode !== 0) return { id: 'push', detail: describeFailure(['push', '-u', 'origin', target], result), ok: false }
      pushed.push(target)
    }
    if (tag !== undefined) {
      const result = await this.remoteGit.run(repo, ['push', 'origin', tag])
      if (result.exitCode !== 0) return { id: 'push', detail: describeFailure(['push', 'origin', tag], result), ok: false }
      pushed.push(tag)
    }
    return undefined
  }

  /** Write `version` into the root `package.json`; a non-Node repo skips it. */
  private async writeVersion(repo: string, version: string): Promise<string | undefined> {
    const path = nodePath.join(repo, 'package.json')
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch {
      // No package.json at the root: nothing to version, and that is not an error.
      return undefined
    }
    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new GitError('git/invalid-input', 'package.json is not valid JSON, so its version cannot be updated')
    }
    const previous = typeof manifest.version === 'string' ? manifest.version : undefined
    if (previous === version) return version
    manifest.version = version
    await writeFile(path, `${JSON.stringify(manifest, undefined, 2)}\n`, 'utf8')
    await this.git.runOk(repo, ['add', '--', 'package.json'])
    await this.git.runOk(repo, ['commit', '-m', `chore(release): ${version}`, '--', 'package.json'])
    return version
  }

  /** Version currently declared by the root package.json, when there is one. */
  private async currentVersion(repo: string): Promise<string | undefined> {
    try {
      const manifest = JSON.parse(await readFile(nodePath.join(repo, 'package.json'), 'utf8')) as { version?: unknown }
      return typeof manifest.version === 'string' ? manifest.version : undefined
    } catch {
      return undefined
    }
  }

  private async countAhead(repo: string, branch: string, target: string): Promise<number> {
    const result = await this.git.run(repo, ['rev-list', '--count', `${target}..${branch}`])
    return result.exitCode === 0 ? Number(result.stdout.trim()) || 0 : 0
  }

  private async tagExists(repo: string, tag: string): Promise<boolean> {
    const result = await this.git.run(repo, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
    return result.exitCode === 0
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

  /**
   * Keep only the selected paths whose staged content differs from HEAD.
   * `add -A` has just run, so the index is the truth; a path that resolves to
   * the HEAD blob (reverted, or touched between the status snapshot and now)
   * would make `commit --only` reject the entire commit.
   * @returns pathspecs in the same order git reported them, `-z` so a non-ASCII
   * name is never C-quoted.
   */
  private async changedInIndex(repo: string, selected: readonly string[]): Promise<string[]> {
    const result = await this.git.runOk(repo, ['diff', '--cached', '--name-only', '-z', '--', ...selected])
    return result.stdout.split('\0').filter(Boolean)
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

/** Publishable view of the branch layout. */
function layoutView(layout: FlowLayout): GitFlowConfigView {
  return {
    production: layout.production,
    develop: layout.develop,
    featurePrefix: layout.featurePrefix,
    releasePrefix: layout.releasePrefix,
    hotfixPrefix: layout.hotfixPrefix,
    tagPrefix: layout.tagPrefix,
  }
}

function prefixOf(kind: GitFlowKind, layout: FlowLayout): string {
  // Validated rather than defaulted: an unknown kind silently becoming a hotfix
  // is a bug the caller would only notice after an odd branch name appeared.
  if (kind === 'feature') return layout.featurePrefix
  if (kind === 'release') return layout.releasePrefix
  if (kind === 'hotfix') return layout.hotfixPrefix
  throw new GitError('git/invalid-input', `unknown flow kind: ${String(kind)}`)
}

/**
 * Read a branch name as a flow branch. A hotfix prefix is tested before the
 * release one only because the two are distinct names, never nesting prefixes.
 * @returns the family, the name inside it, and the version when it carries one.
 */
function splitFlowBranch(branch: string, layout: FlowLayout): { kind: GitFlowKind; slug: string; version?: string } | undefined {
  const families: Array<[GitFlowKind, string]> = [
    ['feature', layout.featurePrefix],
    ['release', layout.releasePrefix],
    ['hotfix', layout.hotfixPrefix],
  ]
  for (const [kind, prefix] of families) {
    if (!branch.startsWith(prefix) || branch.length === prefix.length) continue
    const slug = branch.slice(prefix.length)
    return { kind, slug, version: kind === 'feature' ? undefined : parseVersion(slug) }
  }
  return undefined
}

/** Leading semver in a branch slug (`1.2.0`, `v1.2.0-rc.1`), if it has one. */
function parseVersion(slug: string): string | undefined {
  return /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(slug)?.[1]
}

/** A flow slug must be safe as both a branch segment and a tag fragment. */
function assertFlowSlug(slug: string): void {
  if (slug.length === 0) throw new GitError('git/invalid-input', 'a branch name is required')
  if (slug.startsWith('-')) throw new GitError('git/invalid-input', 'a branch name cannot start with -')
  if (/[\s\u0000-\u001f\u007f~^:?*[\\]/.test(slug) || slug.includes('..') || slug.includes('//')) {
    throw new GitError('git/invalid-input', `invalid branch name: ${slug}`)
  }
  if (/[.@{}]$/.test(slug) || slug.endsWith('.lock')) {
    throw new GitError('git/invalid-input', `invalid branch name: ${slug}`)
  }
}

/** A version destined for `package.json` and a tag: digits and dots, optional prerelease. */
function assertVersion(version: string): void {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new GitError('git/invalid-input', `invalid version: ${version}`)
  }
}
