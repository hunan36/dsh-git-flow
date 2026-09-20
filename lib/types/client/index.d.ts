/**
 * dsh-git-flow, browser half. Registers the `gitFlow` dictionary and one
 * `conversation.input.left` entry: the branch chip and everything it opens.
 * Loaded by the harness module loader as `dsh-git-flow/client.js`.
 * @module dsh-git-flow/client
 */
import type { Context } from '@deepseek-ai/cordis';
/** Services this fiber needs before it activates. */
export declare const inject: string[];
/**
 * Mount the branch chip and its copy.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
