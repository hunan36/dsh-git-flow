/**
 * The composer-tool-row entry: owns the session's git status, the branch menu,
 * the three dialog surfaces, and the toast. Everything below it is presentational.
 */
import { useCallback, useEffect, useState } from 'react'
import { IconWarningOutline16, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitBranchesView, GitStatusView } from '../contract.ts'
import { BranchMenu } from './BranchMenu.tsx'
import { CommitDialog, CreateBranchDialog, ForceCheckoutDialog } from './CommitDialog.tsx'
import { errorText, GitApiError, gitApi, isSilentError } from './api.ts'

/** Props the session-scoped slot delivers to this entry. */
export interface GitFlowChipProps {
  sessionId: string
  t: TranslateNS<'gitFlow'>
}

/** At most one modal surface is open at a time. */
type Dialog =
  | { kind: 'commit' }
  | { kind: 'new' }
  | { kind: 'force'; branch: string }

/** One transient banner; `seq` keys the Toast so a repeat restarts its cycle. */
interface Banner {
  seq: number
  text: string
  failed: boolean
}

/** Branch chip for the session's workspace; renders nothing outside a repository. */
export function GitFlowChip({ sessionId, t }: GitFlowChipProps) {
  const [status, setStatus] = useState<GitStatusView | undefined>(undefined)
  const [hidden, setHidden] = useState(false)
  const [branches, setBranches] = useState<GitBranchesView | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog | undefined>(undefined)
  const [banner, setBanner] = useState<Banner | undefined>(undefined)

  const notify = useCallback((text: string, failed = false) => {
    setBanner({ seq: Date.now() + Math.random(), text, failed })
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await gitApi.status(sessionId))
      setHidden(false)
    } catch (error) {
      if (isSilentError(error)) {
        setStatus(undefined)
        setHidden(true)
        return
      }
      setHidden(false)
      notify(errorText(t, error), true)
    }
  }, [sessionId, t, notify])

  // The entry is session-scoped, but a session switch may reuse the component
  // instance, so the id is an explicit dependency rather than a mount assumption.
  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        setBranches(await gitApi.branches(sessionId))
      } catch (error) {
        notify(errorText(t, error), true)
      }
    })()
  }, [open, sessionId, t, notify])

  const refresh = useCallback(() => {
    void loadStatus()
  }, [loadStatus])

  const checkout = async (name: string) => {
    if (name === status?.head) return
    setBusy(true)
    try {
      const next = await gitApi.checkout({ sessionId, name })
      setStatus(next)
      notify(t('checkout.done', { branch: next.head }))
    } catch (error) {
      // A refused switch is the one case with a follow-up question instead of a report.
      if (error instanceof GitApiError && error.code === 'git/dirty-worktree') setDialog({ kind: 'force', branch: name })
      else notify(errorText(t, error), true)
    } finally {
      setBusy(false)
    }
  }

  if (hidden || status === undefined) return null

  return (
    <>
      <BranchMenu
        t={t}
        status={status}
        branches={branches}
        busy={busy}
        open={open}
        onOpenChange={setOpen}
        onSelectBranch={(name) => { void checkout(name) }}
        onNewBranch={() => { setDialog({ kind: 'new' }) }}
        onCommit={() => { setDialog({ kind: 'commit' }) }}
        onRefresh={() => {
          setBranches(undefined)
          refresh()
        }}
      />
      {dialog?.kind === 'commit' && (
        <CommitDialog
          t={t}
          sessionId={sessionId}
          status={status}
          notify={notify}
          refresh={refresh}
          onClose={() => { setDialog(undefined) }}
        />
      )}
      {dialog?.kind === 'new' && (
        <CreateBranchDialog
          t={t}
          sessionId={sessionId}
          status={status}
          notify={notify}
          refresh={refresh}
          onClose={() => { setDialog(undefined) }}
        />
      )}
      {dialog?.kind === 'force' && (
        <ForceCheckoutDialog
          t={t}
          sessionId={sessionId}
          branch={dialog.branch}
          notify={notify}
          refresh={refresh}
          onClose={() => { setDialog(undefined) }}
        />
      )}
      {banner !== undefined && (
        <Toast
          key={banner.seq}
          text={banner.text}
          icon={banner.failed ? <IconWarningOutline16 size={14} /> : undefined}
          onDone={() => { setBanner(undefined) }}
        />
      )}
    </>
  )
}
