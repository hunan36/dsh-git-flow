/**
 * Git process seam: one argument-array runner over `ctx.subprocess` plus the
 * porcelain parsers the plugin needs. Nothing here touches the network or
 * accepts a shell string, so a path from the browser can never become a
 * command line.
 */
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
/** Structured failure codes; the browser half turns them into copy. */
export type GitErrorCode = 'git/not-installed' | 'git/not-a-repository' | 'git/timeout' | 'git/failed' | 'git/dirty-worktree' | 'git/detached-head' | 'git/invalid-input' | 'git/no-files-selected' | 'git/no-route';
/** A git operation that cannot be represented as a normal exit code. */
export declare class GitError extends Error {
    readonly code: GitErrorCode;
    constructor(code: GitErrorCode, message: string);
}
/** One completed git invocation. */
export interface GitResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
/** Turn `git status --porcelain=v2 --branch -z` into the facts the UI renders. */
export interface GitStatus {
    /** Branch name, `'(detached)'` when detached, `'(unknown)'` in an empty repo. */
    head: string;
    oid: string;
    /** Upstream ref name, when the branch tracks one. */
    upstream?: string;
    /** Commits ahead of / behind the upstream, when it tracks one. */
    ahead: number;
    behind: number;
    /** Tracked changes plus untracked paths. */
    files: GitFileEntry[];
}
/** One changed path in the worktree or index. */
export interface GitFileEntry {
    /** Repository-relative path; for a rename this is the new path. */
    path: string;
    /** Renamed-from path, present only for `R` entries. */
    oldPath?: string;
    /** Index-vs-HEAD code (`'.'` when clean there). */
    indexStatus: string;
    /** Worktree-vs-index code (`'.'` when clean there). */
    worktreeStatus: string;
    /** True when the path already has staged content. */
    staged: boolean;
    /** True for `??` records. */
    untracked: boolean;
    /** True for `u` records. */
    conflicted: boolean;
}
/**
 * Run git without a shell and without ambient credentials leaking in.
 * One instance per service; the executable is resolved lazily and cached.
 */
export declare class GitRunner {
    private readonly subprocess;
    private readonly timeoutMs;
    private executable;
    constructor(subprocess: SubprocessRuntime, timeoutMs: number);
    private program;
    /**
     * @param cwd - directory the command runs in.
     * @param args - git subcommand and flags; never interpolated into a shell.
     * @returns exit code and collected streams; a non-zero exit is a result.
     * @throws {GitError} when git is missing, the run times out, or spawn fails.
     */
    run(cwd: string, args: readonly string[]): Promise<GitResult>;
    /** Run git and treat a non-zero exit as a `git/failed` error. */
    runOk(cwd: string, args: readonly string[]): Promise<GitResult>;
}
/** Trim git's stderr into one line suitable for a UI detail message. */
export declare function describeFailure(args: readonly string[], result: GitResult): string;
/**
 * Parse `git status --porcelain=v2 --branch -z`.
 *
 * The `-z` form is the only one whose paths can be trusted: in the line-based
 * form git C-quotes any path holding a non-ASCII byte, a double quote, or a
 * backslash, so a Chinese file name arrives as `"docs/00-\350\265\204..."`
 * with the quotes and escapes intact. Handing that text back to git as a
 * pathspec fails with `pathspec ... did not match any files`, which is why
 * committing a Chinese-named file used to break. `-z` terminates every record
 * (headers included) with NUL and never quotes a path.
 * @param stdout - raw porcelain output.
 * @returns branch facts and one entry per changed path.
 */
export declare function parseStatus(stdout: string): GitStatus;
