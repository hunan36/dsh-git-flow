/**
 * Typed fetch wrapper for `/api/dsh-git-flow/*`. Every call names only the
 * session; the host resolves the repository.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { CheckoutRequest, DiscardRequest, CreateBranchRequest, CommitRequest, DeleteBranchRequest, FetchRequest, GenerateMessageRequest, GitBranchesView, GitCommitView, GitErrorCode, GitFetchView, GitFlowFinishView, GitFlowStartRequest, GitFlowStateView, GitMergeView, GitMessageView, GitPullView, GitPushView, GitRemotesView, GitStatusView, MergeRequest, PushBranchRequest, RebaseRequest, RenameBranchRequest } from '../contract.ts';
/** A git operation refused by the host, carrying its structured code. */
export declare class GitApiError extends Error {
    readonly code: GitErrorCode;
    constructor(code: GitErrorCode, message: string);
}
/** Whether an error should hide the branch chip instead of reporting itself. */
export declare function isSilentError(error: unknown): boolean;
/** Whether an error means the checked paths are out of date. */
export declare function isStaleSelection(error: unknown): boolean;
/** Human-readable failure text for any thrown value. */
export declare function errorText(t: TranslateNS<'gitFlow'>, error: unknown): string;
/** The browser-side git API. */
export declare const gitApi: {
    status: (sessionId: string) => Promise<GitStatusView>;
    branches: (sessionId: string) => Promise<GitBranchesView>;
    remotes: (sessionId: string) => Promise<GitRemotesView>;
    checkout: (body: CheckoutRequest) => Promise<GitStatusView>;
    createBranch: (body: CreateBranchRequest) => Promise<GitStatusView>;
    merge: (body: MergeRequest) => Promise<GitMergeView>;
    /** Replay the current branch onto `onto`; the status comes back after the run. */
    rebase: (body: RebaseRequest) => Promise<GitStatusView>;
    fetch: (body: FetchRequest) => Promise<GitFetchView>;
    commit: (body: CommitRequest) => Promise<GitCommitView>;
    discard: (body: DiscardRequest) => Promise<GitStatusView>;
    push: (body: {
        sessionId: string;
    }) => Promise<GitPushView>;
    pull: (body: {
        sessionId: string;
    }) => Promise<GitPullView>;
    pushBranch: (body: PushBranchRequest) => Promise<GitPushView>;
    renameBranch: (body: RenameBranchRequest) => Promise<GitStatusView>;
    deleteBranch: (body: DeleteBranchRequest) => Promise<GitStatusView>;
    generateMessage: (body: GenerateMessageRequest) => Promise<GitMessageView>;
    gitflowState: (sessionId: string) => Promise<GitFlowStateView>;
    startFlow: (body: GitFlowStartRequest) => Promise<GitStatusView>;
    initDevelop: (body: {
        sessionId: string;
    }) => Promise<GitStatusView>;
    finishFlow: (body: {
        sessionId: string;
        version?: string;
    }) => Promise<GitFlowFinishView>;
};
