/**
 * dsh-git-flow, node half. The bundle patch mounts {@link GitFlow} as
 * `ctx.gitFlow`; it provides the workspace git operations and registers
 * `/api/dsh-git-flow/*` on the web profile. The browser half ships through
 * `exports['./client']` and the package.json `dsh.client` declaration.
 * @module dsh-git-flow
 */
import { GitFlow } from './service.ts';
export { GitFlow };
export default GitFlow;
export type { GitFlowConfig } from './service.ts';
export type * from './contract.ts';
