/**
 * dsh-git-flow, browser half. Registers the `gitFlow` dictionary and one
 * `conversation.input.left` entry: the branch chip and everything it opens.
 * Loaded by the harness module loader as `dsh-git-flow/client.js`.
 * @module dsh-git-flow/client
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only imports: they pull the cordis Context augmentations (`ctx.slots`,
// `ctx.locale`), the `conversation.input.left` slot contract, and the session
// standard kit into this program. No runtime module is requested by them.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { GitFlowChip } from './BranchChip.tsx'
import { GIT_FLOW_NS, gitFlowLocale } from './locales.ts'

/** Services this fiber needs before it activates. */
export const inject = ['slots', 'locale']

/**
 * Mount the branch chip and its copy.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(GIT_FLOW_NS, gitFlowLocale), 'dsh-git-flow: locale dictionary')
  // `inject` waits for the slot's declaration and re-runs after a collapse,
  // so registration order against the conversation shell does not matter.
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'dsh-git-flow',
    order: 20,
    locale: GIT_FLOW_NS,
  }, GitFlowChip))
}
