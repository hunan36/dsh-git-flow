import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { GitStatusView } from '../contract.ts';
/** What a dialog reports back to the chip that owns it. */
export interface DialogHost {
    t: TranslateNS<'gitFlow'>;
    sessionId: string;
    /** Transient banner text; `failed` renders the warning glyph. */
    notify: (text: string, failed?: boolean) => void;
    /** Re-read status after the repository changed. */
    refresh: () => void;
}
/** Commit composer: pick paths, draft or write the message, commit, optionally push. */
export declare function CommitDialog(props: CommitDialogProps): import("react").JSX.Element;
/**
 * Confirmation for a destructive discard. Nothing is sent until the user picks
 * the destructive action here.
 */
export declare function DiscardDialog(props: DiscardDialogProps): import("react").JSX.Element;
/** Discard dialog props. */
export interface DiscardDialogProps extends DialogHost {
    files: string[];
    onClose: () => void;
}
/** Commit dialog props. */
export interface CommitDialogProps extends DialogHost {
    status: GitStatusView;
    onClose: () => void;
}
/** Ask for a branch name, create it from the current HEAD, and switch to it. */
export declare function CreateBranchDialog(props: CreateBranchDialogProps): import("react").JSX.Element;
/** New-branch dialog props. */
export interface CreateBranchDialogProps extends DialogHost {
    status: GitStatusView;
    onClose: () => void;
}
/**
 * A switch that git refused because it would overwrite local edits. The first
 * attempt runs without `force`; only this second confirmation sends it.
 */
export declare function ForceCheckoutDialog(props: ForceCheckoutDialogProps): import("react").JSX.Element;
/** Forced-switch dialog props. */
export interface ForceCheckoutDialogProps extends DialogHost {
    branch: string;
    onClose: () => void;
}
