import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { GitBranchesView, GitStatusView } from '../contract.ts';
/** Branch popover props. */
export interface BranchMenuProps {
    t: TranslateNS<'gitFlow'>;
    status: GitStatusView;
    /** Branch table, loaded on first open. */
    branches: GitBranchesView | undefined;
    /** True while a load or switch is in flight; the chip shows a busy state. */
    busy: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectBranch: (name: string) => void;
    onNewBranch: () => void;
    onCommit: () => void;
    /** Push what is already committed, without opening the commit panel. */
    onPush: () => void;
    onRefresh: () => void;
}
/** Pill plus anchored branch picker: pinned search, scrolling rows, pinned actions. */
export declare function BranchMenu(props: BranchMenuProps): import("react").JSX.Element;
