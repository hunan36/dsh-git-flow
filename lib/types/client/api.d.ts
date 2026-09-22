/**
 * Typed fetch wrapper for `/api/dsh-git-flow/*`. Every call names only the
 * session; the host resolves the repository.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { CheckoutRequest, DiscardRequest, CreateBranchRequest, CommitRequest, GenerateMessageRequest, GitBranchesView, GitCommitView, GitErrorCode, GitMessageView, GitPullView, GitPushView, GitStatusView } from '../contract.ts';
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
    checkout: (body: CheckoutRequest) => Promise<GitStatusView>;
    createBranch: (body: CreateBranchRequest) => Promise<GitStatusView>;
    commit: (body: CommitRequest) => Promise<GitCommitView>;
    discard: (body: DiscardRequest) => Promise<GitStatusView>;
    push: (body: {
        sessionId: string;
    }) => Promise<GitPushView>;
    pull: (body: {
        sessionId: string;
    }) => Promise<GitPullView>;
    generateMessage: (body: GenerateMessageRequest) => Promise<GitMessageView>;
};
