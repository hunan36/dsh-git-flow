import type { GitRemotesView } from '../contract.ts';
import type { DialogHost } from './CommitDialog.tsx';
/** Rebase dialog props. */
export interface RebaseDialogProps extends DialogHost {
    /** Branch the checked-out branch is replayed onto. */
    onto: string;
    /** Checked-out branch, for the warning text. */
    head: string;
    onClose: () => void;
}
/**
 * Confirmation for a rebase. It rewrites the current branch's commits, so the
 * request is only sent from here — never from the menu row itself.
 */
export declare function RebaseDialog(props: RebaseDialogProps): import("react").JSX.Element;
/** Rename dialog props. */
export interface RenameBranchDialogProps extends DialogHost {
    /** Local branch being renamed. */
    branch: string;
    onClose: () => void;
}
/** Rename a local branch in place; the current branch is allowed to move. */
export declare function RenameBranchDialog(props: RenameBranchDialogProps): import("react").JSX.Element;
/** Delete dialog props. */
export interface DeleteBranchDialogProps extends DialogHost {
    /** Local branch being deleted. */
    branch: string;
    onClose: () => void;
}
/**
 * Confirm deleting a local branch. The plain delete is tried first; git's
 * "not fully merged" refusal turns the same dialog into the forced retry, so
 * the lost commits are named before anything is discarded.
 */
export declare function DeleteBranchDialog(props: DeleteBranchDialogProps): import("react").JSX.Element;
/** Push-to dialog props. */
export interface PushToDialogProps extends DialogHost {
    /** Local branch being pushed. */
    branch: string;
    /** Configured remotes; absent until the open-time read lands. */
    remotes: GitRemotesView | undefined;
    onClose: () => void;
}
/**
 * Push one local branch to a chosen remote. The menu only offers this when at
 * least one remote is known, but an empty list still renders an explanation
 * instead of a dead form.
 */
export declare function PushToDialog(props: PushToDialogProps): import("react").JSX.Element;
