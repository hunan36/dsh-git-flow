/**
 * AI commit messages: one auxiliary model call over the selected diff, riding
 * the route the session's own conversation already used (the same way session
 * titles are produced), with a template fallback so the panel never blocks.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { GitFileView, GitMessageView } from './contract.ts';
import type { Session } from '@deepseek-ai/dsh-session';
/** Everything the prompt needs, already gathered by the service. */
export interface CommitMessageInput {
    ctx: Context;
    /** Live session for this request id; its logged header supplies the route. */
    session: Session | undefined;
    language: 'zh' | 'en';
    head: string;
    selected: readonly string[];
    files: readonly GitFileView[];
    diff: string;
    truncated: boolean;
}
/**
 * Produce one commit message for the selection.
 * @throws {GitError} `git/no-route` when the session has no logged model route.
 * @returns the message plus whether the template fallback had to be used, and
 * why it was, so the panel can report a broken route instead of a vague notice.
 */
export declare function generateCommitMessage(input: CommitMessageInput): Promise<GitMessageView>;
