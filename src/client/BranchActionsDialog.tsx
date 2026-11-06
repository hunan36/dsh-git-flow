/**
 * The branch-row action dialogs: the rebase confirmation, the rename prompt,
 * the delete confirmation that can escalate to a forced delete, and the
 * push-to remote picker. Every mutation goes through `/api/dsh-git-flow/*`,
 * which names only the session.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Button,
  IconCheckOutlineRegular,
  IconRightUpOutlineRegular,
  IconWarningOutlineRegular,
  Input,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { GitRemotesView } from '../contract.ts'
import { errorText, GitApiError, gitApi } from './api.ts'
import type { DialogHost } from './CommitDialog.tsx'

/** Rebase dialog props. */
export interface RebaseDialogProps extends DialogHost {
  /** Branch the checked-out branch is replayed onto. */
  onto: string
  /** Checked-out branch, for the warning text. */
  head: string
  onClose: () => void
}

/**
 * Confirmation for a rebase. It rewrites the current branch's commits, so the
 * request is only sent from here — never from the menu row itself.
 */
export function RebaseDialog(props: RebaseDialogProps) {
  const { t, sessionId, head, onto, onClose } = props
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const next = await gitApi.rebase({ sessionId, onto })
      props.notify(t('rebase.done', { head: next.head, onto }))
      props.refresh()
      onClose()
    } catch (error) {
      props.notify(errorText(t, error), true)
      // A conflicted rebase stopped with the conflict left in the worktree; the
      // chip should show it, and the dialog's job is done.
      if (error instanceof GitApiError && error.code === 'git/rebase-conflict') {
        props.refresh()
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('rebase.title', { onto })}
      description={t('rebase.description', { head, onto })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button
            size="sm"
            variant="primary"
            icon={<IconWarningOutlineRegular size={14} />}
            onClick={() => { void submit() }}
            disabled={busy}
          >
            {t('rebase.submit')}
          </Button>
        </div>
      )}
    />
  )
}

/** Rename dialog props. */
export interface RenameBranchDialogProps extends DialogHost {
  /** Local branch being renamed. */
  branch: string
  onClose: () => void
}

/** Rename a local branch in place; the current branch is allowed to move. */
export function RenameBranchDialog(props: RenameBranchDialogProps) {
  const { t, sessionId, branch, onClose } = props
  const [name, setName] = useState(branch)
  const [busy, setBusy] = useState(false)
  const next = name.trim()
  const invalid = next.length === 0 || next === branch

  const submit = async () => {
    setBusy(true)
    try {
      await gitApi.renameBranch({ sessionId, from: branch, to: next })
      props.notify(t('rename.done', { from: branch, to: next }))
      props.refresh()
      onClose()
    } catch (error) {
      props.notify(errorText(t, error), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('rename.title')}
      description={t('rename.description', { from: branch })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button size="sm" variant="primary" onClick={() => { void submit() }} disabled={busy || invalid}>
            {t('rename.submit')}
          </Button>
        </div>
      )}
    >
      <section style={sectionStyle}>
        <span style={headingStyle}>{t('rename.name')}</span>
        <Input
          value={name}
          placeholder={t('rename.placeholder')}
          autoFocus
          style={inputStyle}
          onChange={(event) => setName(event.target.value)}
        />
      </section>
    </Modal>
  )
}

/** Delete dialog props. */
export interface DeleteBranchDialogProps extends DialogHost {
  /** Local branch being deleted. */
  branch: string
  onClose: () => void
}

/**
 * Confirm deleting a local branch. The plain delete is tried first; git's
 * "not fully merged" refusal turns the same dialog into the forced retry, so
 * the lost commits are named before anything is discarded.
 */
export function DeleteBranchDialog(props: DeleteBranchDialogProps) {
  const { t, sessionId, branch, onClose } = props
  const [busy, setBusy] = useState(false)
  /** True once git refused the plain delete; the primary action becomes `-D`. */
  const [force, setForce] = useState(false)

  const remove = async (hard: boolean) => {
    setBusy(true)
    try {
      await gitApi.deleteBranch({ sessionId, name: branch, force: hard })
      props.notify(t('delete.done', { branch }))
      props.refresh()
      onClose()
    } catch (error) {
      if (!hard && error instanceof GitApiError && error.code === 'git/branch-not-merged') {
        setForce(true)
      } else {
        props.notify(errorText(t, error), true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={force ? t('delete.forceTitle') : t('delete.title', { branch })}
      description={force ? t('delete.forceDescription', { branch }) : t('delete.description', { branch })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button
            size="sm"
            variant="primary"
            icon={<IconWarningOutlineRegular size={14} />}
            onClick={() => { void remove(force) }}
            disabled={busy}
          >
            {force ? t('delete.force') : t('delete.submit')}
          </Button>
        </div>
      )}
    />
  )
}

/** Push-to dialog props. */
export interface PushToDialogProps extends DialogHost {
  /** Local branch being pushed. */
  branch: string
  /** Configured remotes; absent until the open-time read lands. */
  remotes: GitRemotesView | undefined
  onClose: () => void
}

/**
 * Push one local branch to a chosen remote. The menu only offers this when at
 * least one remote is known, but an empty list still renders an explanation
 * instead of a dead form.
 */
export function PushToDialog(props: PushToDialogProps) {
  const { t, sessionId, branch, remotes, onClose } = props
  const options = remotes?.remotes ?? []
  // `origin` is the conventional destination; otherwise git's own order decides.
  const [remote, setRemote] = useState(() => options.find((option) => option.name === 'origin')?.name ?? options[0]?.name ?? '')
  const [destination, setDestination] = useState(branch)
  const [busy, setBusy] = useState(false)
  const dest = destination.trim()
  const invalid = remote.length === 0 || dest.length === 0

  const submit = async () => {
    setBusy(true)
    try {
      await gitApi.pushBranch({ sessionId, name: branch, remote, branch: dest })
      props.notify(t('pushTo.done', { branch: dest, remote }))
      props.refresh()
      onClose()
    } catch (error) {
      props.notify(errorText(t, error), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('pushTo.title', { branch })}
      description={t('pushTo.description')}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button
            size="sm"
            variant="primary"
            icon={<IconRightUpOutlineRegular size={14} />}
            onClick={() => { void submit() }}
            disabled={busy || invalid}
          >
            {t('pushTo.submit')}
          </Button>
        </div>
      )}
    >
      <section style={sectionStyle}>
        <span style={headingStyle}>{t('pushTo.remote')}</span>
        {options.length === 0
          ? <div style={emptyStyle}>{t('pushTo.empty')}</div>
          : (
            <div role="radiogroup" aria-label={t('pushTo.remote')} style={remoteListStyle}>
              {options.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  role="radio"
                  aria-checked={option.name === remote}
                  disabled={busy}
                  onClick={() => { setRemote(option.name) }}
                  style={{ ...remoteRowStyle, ...(option.name === remote ? remoteRowActiveStyle : null) }}
                >
                  <span style={remoteNameStyle}>{option.name}</span>
                  <span style={remoteUrlStyle}>{option.url}</span>
                  {option.name === remote && <IconCheckOutlineRegular size={14} />}
                </button>
              ))}
            </div>
          )}
      </section>
      <section style={sectionStyle}>
        <span style={headingStyle}>{t('pushTo.branch')}</span>
        <Input
          value={destination}
          placeholder={t('pushTo.placeholder')}
          disabled={busy || options.length === 0}
          style={inputStyle}
          onChange={(event) => setDestination(event.target.value)}
        />
      </section>
    </Modal>
  )
}

const sectionStyle: CSSProperties = { display: 'grid', gap: 8, minWidth: 0 }
const headingStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-secondary, currentColor)' }
const inputStyle: CSSProperties = { width: '100%' }
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }
const remoteListStyle: CSSProperties = {
  display: 'grid',
  gap: 1,
  maxHeight: 168,
  overflowY: 'auto',
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.25))',
  borderRadius: 10,
  padding: 4,
}
const remoteRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minWidth: 0,
  padding: '6px 8px',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary, inherit)',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
}
const remoteRowActiveStyle: CSSProperties = { background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.10))' }
const remoteNameStyle: CSSProperties = { flex: '0 0 auto', fontWeight: 500 }
const remoteUrlStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  color: 'var(--dsw-alias-label-tertiary, currentColor)',
}
const emptyStyle: CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  color: 'var(--dsw-alias-label-tertiary, currentColor)',
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.25))',
  borderRadius: 10,
}
