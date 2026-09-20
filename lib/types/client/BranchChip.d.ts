import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
/** Props the session-scoped slot delivers to this entry. */
export interface GitFlowChipProps {
    sessionId: string;
    t: TranslateNS<'gitFlow'>;
}
/** Branch chip for the session's workspace; renders nothing outside a repository. */
export declare function GitFlowChip({ sessionId, t }: GitFlowChipProps): import("react").JSX.Element | null;
