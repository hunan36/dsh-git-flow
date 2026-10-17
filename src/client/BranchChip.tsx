/**
 * The composer-tool-row entry: owns the session's git status, the branch menu,
 * the three dialog surfaces, and the toast. Everything below it is presentational.
 */
import { useCallback, useEffect, useState } from 'react'
import { IconWarningOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitBranchesView, GitFlowStateView, GitStatusView } from '../contract.ts'
import { BranchMenu } from './BranchMenu.tsx'
import { CommitDialog, CreateBranchDialog, ForceCheckoutDialog } from './CommitDialog.tsx'
import { FinishFlowDialog, InitDevelopDialog, StartFlowDialog } from './GitFlowDialog.tsx'
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
  | { kind: 'start' }
  | { kind: 'finish' }
  | { kind: 'init-develop'; thenStart?: boolean }

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
  const [flow, setFlow] = useState<GitFlowStateView | undefined>(undefined)
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

  // Opening the menu is the step before every action here, and files change
  // between the chip's last read and that click (the agent writes during a
  // turn). One fresh status keeps the badge, the commit row's enablement, and
  // the panel that follows in agreement with the repository.
  useEffect(() => {
    if (!open) return
    void loadStatus()
    void (async () => {
      try {
        setBranches(await gitApi.branches(sessionId))
      } catch (error) {
        notify(errorText(t, error), true)
      }
      try {
        setFlow(await gitApi.gitflowState(sessionId))
      } catch (error) {
        // A flow state is an enhancement: a failed read leaves the chip as it was.
        if (!isSilentError(error)) notify(errorText(t, error), true)
      }
    })()
  }, [open, sessionId, t, notify, loadStatus])

  const refresh = useCallback(() => {
    void loadStatus()
    // A flow action moves the branch, so the flow state is stale too.
    void (async () => {
      try {
        setFlow(await gitApi.gitflowState(sessionId))
      } catch {
        // Same reasoning as the open-time read: never let this block the status.
      }
    })()
  }, [loadStatus, sessionId])

  /** Push the current branch's unpushed commits, straight from the menu. */
  const pushCommits = async () => {
    setBusy(true)
    try {
      await gitApi.push({ sessionId })
      notify(t('push.done', { branch: status?.head ?? '' }))
      refresh()
    } catch (error) {
      notify(errorText(t, error), true)
    } finally {
      setBusy(false)
    }
  }

  /** Pull the current branch's unmerged commits, straight from the menu. */
  const pullRemote = async () => {
    setBusy(true)
    try {
      await gitApi.pull({ sessionId })
      notify(t('pull.done', { branch: status?.head ?? '' }))
      refresh()
    } catch (error) {
      notify(errorText(t, error), true)
    } finally {
      setBusy(false)
    }
  }

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
        onCommit={() => {
          // The panel lists whatever status it was opened with, and files can
          // change between the chip's last read and this click (another commit,
          // or the agent writing in the background). Re-read first.
          refresh()
          setDialog({ kind: 'commit' })
        }}
        onPush={() => { void pushCommits() }}
        onPull={() => { void pullRemote() }}
        onRefresh={() => {
          setBranches(undefined)
          refresh()
        }}
        flow={flow}
        onStartFlow={() => {
          // The dialog offers to create develop first, but only if the state is current.
          refresh()
          setDialog({ kind: 'start' })
        }}
        onFinishFlow={() => { setDialog({ kind: 'finish' }) }}
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
      {dialog?.kind === 'start' && flow !== undefined && (
        <StartFlowDialog
          t={t}
          sessionId={sessionId}
          state={flow}
          status={status}
          notify={notify}
          refresh={refresh}
          onClose={() => { setDialog(undefined) }}
          // A start refused for a missing develop reopens as the guided creation.
          onNeedDevelop={() => { setDialog({ kind: 'init-develop', thenStart: true }) }}
        />
      )}
      {dialog?.kind === 'finish' && flow !== undefined && (
        <FinishFlowDialog
          t={t}
          sessionId={sessionId}
          state={flow}
          status={status}
          notify={notify}
          refresh={refresh}
          onClose={() => { setDialog(undefined) }}
        />
      )}
      {dialog?.kind === 'init-develop' && flow !== undefined && (
        <InitDevelopDialog
          t={t}
          sessionId={sessionId}
          state={flow}
          status={status}
          notify={notify}
          refresh={refresh}
          onClose={() => { setDialog(undefined) }}
          onDone={() => { if (dialog.thenStart === true) setDialog({ kind: 'start' }) }}
        />
      )}
      {banner !== undefined && (
        <Toast
          key={banner.seq}
          text={banner.text}
          icon={banner.failed ? <IconWarningOutlineRegular size={14} /> : undefined}
          onDone={() => { setBanner(undefined) }}
        />
      )}
    </>
  )
}
