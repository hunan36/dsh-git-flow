/**
 * `/api/dsh-git-flow/*` — the browser half's only door into git. Requests carry
 * a session id and nothing else; the service derives the repository from the
 * session's registered workspace, so a page can never name a directory.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { GitFlow } from './service.ts';
/**
 * Register every route on the mounted context.
 * @param ctx - context that already sees `webServer`.
 * @param service - the git surface to expose.
 * @returns a disposer removing all routes.
 */
export declare function registerGitFlowRoutes(ctx: Context, service: GitFlow): () => void;
