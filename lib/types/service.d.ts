/**
 * `ctx.gitFlow` — the workspace git surface behind `/api/dsh-git-flow/*`.
 * Every operation is keyed by session id: the repository directory is resolved
 * by the host from the session's workspace, so the browser can never name a
 * path for git to run in.
 */
import { Service } from '@deepseek-ai/cordis';
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { GitBranchesView, GitCommitView, GitFlowFinishView, GitFlowKind, GitFlowStateView, GitMessageView, GitStatusView, MessageLanguage } from './contract.ts';
export type { MessageLanguage };
/** Mountable configuration. */
export interface GitFlowConfig {
    /** Deadline for read-only and local git commands. */
    timeoutMs?: number;
    /** Deadline for `git push`, which waits on a remote. */
    pushTimeoutMs?: number;
    /** Upper bound on diff bytes handed to the model. */
    messageMaxDiffBytes?: number;
    /** Default commit message language; the commit panel can override it per call. */
    messageLanguage?: MessageLanguage;
    /** Branch every release and hotfix is merged back into. */
    productionBranch?: string;
    /** Integration branch features start from and merge back into. */
    developBranch?: string;
    featurePrefix?: string;
    releasePrefix?: string;
    hotfixPrefix?: string;
    /** Prefix of the tag a finished release or hotfix creates. */
    tagPrefix?: string;
}
/**
 * Branch switching, panel-scoped commits, pushes, and AI commit messages for
 * the session's workspace.
 */
export declare class GitFlow extends Service {
    /**
     * `workspaceRegistry` is read through `ctx.get` rather than declared here: a
     * profile without one (the shipped `headless` profile) must still activate
     * this entry instead of reporting a permanently pending plugin. Every git
     * call in such a profile answers `git/not-a-repository`, since no session can
     * resolve a repository.
     */
    static inject: string[];
    static Config: z<GitFlowConfig>;
    private readonly config;
    private readonly git;
    /** Remote-waiting calls (push, pull) outlive the default runner deadline, so the runner is per-call-site. */
    private readonly remoteGit;
    constructor(ctx: Context, config?: GitFlowConfig);
    /**
     * @param sessionId - session whose workspace backs the repository.
     * @returns branch, ahead/behind, and one row per changed path.
     */
    status(sessionId: string): Promise<GitStatusView>;
    /**
     * @param sessionId - session whose workspace backs the repository.
     * @returns local and remote-tracking branch rows, current one flagged.
     */
    branches(sessionId: string): Promise<GitBranchesView>;
    /**
     * Switch branches, optionally creating a local branch for a unique remote one.
     * @param sessionId - session whose workspace backs the repository.
     * @param name - branch to check out.
     * @param force - discard conflicting worktree changes; never used silently.
     */
    checkout(sessionId: string, name: string, force?: boolean): Promise<GitStatusView>;
    /**
     * Create one branch from `base` (default: current HEAD) and switch to it.
     * @param sessionId - session whose workspace backs the repository.
     * @param name - new branch name.
     * @param base - existing ref to start from.
     */
    createBranch(sessionId: string, name: string, base?: string): Promise<GitStatusView>;
    /**
     * Throw away the worktree and index changes for the selected paths: tracked
     * paths go back to HEAD (a staged addition is removed from the index and from
     * disk), and untracked paths are deleted. Destructive by definition, so the
     * caller confirms first; conflicted paths are refused rather than guessed at.
     * @param sessionId - session whose workspace backs the repository.
     * @param files - paths as reported by {@link status}; anything else is rejected.
     */
    discard(sessionId: string, files: readonly string[]): Promise<GitStatusView>;
    /**
     * Stage exactly the selected paths, commit them, and optionally push.
     * @param sessionId - session whose workspace backs the repository.
     * @param files - paths as reported by {@link status}; anything else is rejected.
     * @param message - commit message text.
     * @param push - push the resulting commit to the branch upstream.
     */
    commit(sessionId: string, files: readonly string[], message: string, push?: boolean): Promise<GitCommitView>;
    /**
     * Push the current branch to its upstream. Never force, and never to a
     * caller-supplied remote or refspec.
     * @param sessionId - session whose workspace backs the repository.
     * @returns git's push summary.
     */
    push(sessionId: string): Promise<string>;
    /**
     * Pull the current branch's upstream with `--ff-only`: a fast-forward is the
     * only allowed outcome, so a diverged branch fails instead of producing a
     * merge commit or rewriting local commits. This is the plugin's one
     * user-initiated network call outside push; nothing fetches in the background.
     * @param sessionId - session whose workspace backs the repository.
     * @returns git's pull summary.
     */
    pull(sessionId: string): Promise<string>;
    /** The resolved branch layout, as the panel renders it. */
    private layout;
    /**
     * Describe the flow state of the current branch: which family it belongs to,
     * the version its name carries, whether the branches a run needs exist, and
     * whether the tag a finish would create is already taken.
     * @param sessionId - session whose workspace backs the repository.
     */
    gitflowState(sessionId: string): Promise<GitFlowStateView>;
    /**
     * Create a flow branch from the branch its family starts at and switch to it.
     * A missing develop is reported as `git/develop-missing` so the panel can
     * offer to create it rather than dead-ending on a raw git failure.
     * @param sessionId - session whose workspace backs the repository.
     * @param kind - branch family to start.
     * @param name - name inside the family, without the prefix.
     */
    startFlow(sessionId: string, kind: GitFlowKind, name: string): Promise<GitStatusView>;
    /**
     * Create the develop branch from the production branch and switch to it.
     * Only offered when develop is missing; an existing one is left untouched.
     * @param sessionId - session whose workspace backs the repository.
     */
    initDevelop(sessionId: string): Promise<GitStatusView>;
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
    finishFlow(sessionId: string, version?: string): Promise<GitFlowFinishView>;
    /** Merge one branch into a target with a merge commit, refusing on conflict. */
    private mergeInto;
    /** Push each merged target and the new tag; the first failure is reported, not thrown. */
    private pushFinished;
    /** Write `version` into the root `package.json`; a non-Node repo skips it. */
    private writeVersion;
    /** Version currently declared by the root package.json, when there is one. */
    private currentVersion;
    private countAhead;
    private tagExists;
    /**
     * Ask the session's own model route for a commit message over the selected diff.
     * @param sessionId - session whose workspace and route back the call.
     * @param files - paths as reported by {@link status}.
     * @param language - per-call override for the configured message language.
     */
    generateMessage(sessionId: string, files: readonly string[], language?: MessageLanguage): Promise<GitMessageView>;
    /** Collect the selected diff without staging anything. */
    private collectDiff;
    /** Repository top level for one session's workspace. */
    private resolveRepo;
    private resolveWorkspace;
    /**
     * Keep only the selected paths whose staged content differs from HEAD.
     * `add -A` has just run, so the index is the truth; a path that resolves to
     * the HEAD blob (reverted, or touched between the status snapshot and now)
     * would make `commit --only` reject the entire commit.
     * @returns pathspecs in the same order git reported them, `-z` so a non-ASCII
     * name is never C-quoted.
     */
    private changedInIndex;
    private hasLocalBranch;
    /**
     * Turn a branch row's name into something `git switch` accepts. Remote-only
     * rows are labelled `<remote>/<branch>` because that is their short refname,
     * but git refuses to switch to a remote ref directly; stripping the prefix
     * lets {@link checkout} create the local tracking branch instead. Only a
     * known remote is peeled off, and only when no real local branch has that
     * exact name.
     */
    private unqualifiedName;
    private remoteBranches;
    private runSwitch;
}
