import type { GitFlowStateView, GitStatusView } from '../contract.ts';
import type { DialogHost } from './CommitDialog.tsx';
/** Start dialog props. */
export interface StartFlowDialogProps extends DialogHost {
    state: GitFlowStateView;
    status: GitStatusView;
    onClose: () => void;
    /** A start refused for a missing develop hands off to the init dialog. */
    onNeedDevelop: () => void;
}
/**
 * Name a flow branch and create it from the branch its family starts at.
 * A missing develop is not an error the user can fix in this dialog, so it
 * closes and hands off to the guided creation instead.
 */
export declare function StartFlowDialog(props: StartFlowDialogProps): import("react").JSX.Element;
/** Init-develop dialog props. */
export interface InitDevelopDialogProps extends DialogHost {
    state: GitFlowStateView;
    status: GitStatusView;
    onClose: () => void;
    /** Continue whatever asked for develop in the first place. */
    onDone: () => void;
}
/** Create the integration branch from production (or HEAD when there is none). */
export declare function InitDevelopDialog(props: InitDevelopDialogProps): import("react").JSX.Element;
/** Finish dialog props. */
export interface FinishFlowDialogProps extends DialogHost {
    state: GitFlowStateView;
    status: GitStatusView;
    onClose: () => void;
}
/**
 * Confirm and run the finish sequence. The step list is generated from the same
 * facts the host will act on, so what the user reads is what will happen.
 */
export declare function FinishFlowDialog(props: FinishFlowDialogProps): import("react").JSX.Element;
