import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { GitBranchesView, GitFlowStateView, GitRemotesView, GitStatusView } from '../contract.ts';
/** Branch popover props. */
export interface BranchMenuProps {
    t: TranslateNS<'gitFlow'>;
    status: GitStatusView;
    /** Branch table, loaded on first open. */
    branches: GitBranchesView | undefined;
    /** Configured remotes, loaded on first open; absent when the read failed. */
    remotes: GitRemotesView | undefined;
    /** True while a load or switch is in flight; the chip shows a busy state. */
    busy: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectBranch: (name: string) => void;
    /** Merge a branch into the current one, offered from a row's context menu. */
    onMergeBranch: (name: string) => void;
    /** Open the rebase confirmation that replays the current branch onto `name`. */
    onRebaseBranch: (name: string) => void;
    /** Fetch the remote that tracks `name`, straight from the row menu. */
    onFetchBranch: (name: string) => void;
    /** Push `name` to its configured upstream, straight from the row menu. */
    onPushTracked: (name: string, upstream: string) => void;
    /** Open the push-to dialog that chooses a remote and destination branch. */
    onPushBranchTo: (name: string) => void;
    /** Open the rename prompt for a local branch. */
    onRenameBranch: (name: string) => void;
    /** Open the delete confirmation for a local branch. */
    onDeleteBranch: (name: string) => void;
    /** Copy a branch name to the clipboard. */
    onCopyBranchName: (name: string) => void;
    onNewBranch: () => void;
    onCommit: () => void;
    /** Push what is already committed, without opening the commit panel. */
    onPush: () => void;
    /** Pull the current branch's upstream (`--ff-only`). */
    onPull: () => void;
    onRefresh: () => void;
    /** Flow state of the current branch; absent until it has been read. */
    flow: GitFlowStateView | undefined;
    onStartFlow: () => void;
    onFinishFlow: () => void;
}
/** Pill plus anchored branch picker: pinned search, scrolling rows, pinned actions. */
export declare function BranchMenu(props: BranchMenuProps): import("react").JSX.Element;
