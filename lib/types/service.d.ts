/**
 * `ctx.gitFlow` — the workspace git surface behind `/api/dsh-git-flow/*`.
 * Every operation is keyed by session id: the repository directory is resolved
 * by the host from the session's workspace, so the browser can never name a
 * path for git to run in.
 */
import { Service } from '@deepseek-ai/cordis';
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { GitBranchesView, GitCommitView, GitMessageView, GitStatusView, MessageLanguage } from './contract.ts';
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
    /** Push timeouts outlive the default runner deadline, so the runner is per-call-site. */
    private readonly pushGit;
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
    private hasLocalBranch;
    private remoteBranches;
    private runSwitch;
}
