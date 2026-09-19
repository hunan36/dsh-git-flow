/**
 * Small modal surfaces: the commit composer, the new-branch prompt, and the
 * second confirmation a dirty worktree needs before a forced switch.
 * Every mutation goes through `/api/dsh-git-flow/*`, which names only the session.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, Checkbox, IconBranchOutline16, IconRefreshOutline14, IconSparkle16, IconWarningOutline16, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitFileView, GitStatusView } from '../contract.ts'
import { errorText, gitApi } from './api.ts'

/** What a dialog reports back to the chip that owns it. */
export interface DialogHost {
  t: TranslateNS<'gitFlow'>
  sessionId: string
  /** Transient banner text; `failed` renders the warning glyph. */
  notify: (text: string, failed?: boolean) => void
  /** Re-read status after the repository changed. */
  refresh: () => void
}

/** Commit composer: pick paths, draft or write the message, commit, optionally push. */
export function CommitDialog(props: CommitDialogProps) {
  const { t, sessionId, status, onClose } = props
  const rows = status.files
  const stageable = rows.filter((file) => !file.conflicted)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(stageable.map((file) => file.path)))
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState(false)
  const paths = stageable.filter((file) => chosen.has(file.path)).map((file) => file.path)
  const allSelected = stageable.length > 0 && paths.length === stageable.length

  const toggle = (path: string) => {
    setChosen((current) => {
      const next = new Set(current)
      if (next.delete(path)) return next
      next.add(path)
      return next
    })
  }

  const generate = async () => {
    if (paths.length === 0) {
      props.notify(t('error.noFiles'), true)
      return
    }
    setGenerating(true)
    try {
      const draft = await gitApi.generateMessage({ sessionId, files: paths })
      setMessage(draft.message)
      if (draft.fallback) props.notify(t('commit.fallback'), true)
    } catch (error) {
      props.notify(errorText(t, error), true)
    } finally {
      setGenerating(false)
    }
  }

  const submit = async (push: boolean) => {
    if (paths.length === 0) {
      props.notify(t('error.noFiles'), true)
      return
    }
    if (message.trim().length === 0) {
      props.notify(t('commit.needMessage'), true)
      return
    }
    setBusy(true)
    try {
      const committed = await gitApi.commit({ sessionId, files: paths, message: message.trim() })
      if (!push) {
        props.notify(t('commit.done', { hash: committed.shortHash }))
        props.refresh()
        onClose()
        return
      }
      // Push separately so a rejected push cannot read as a failed commit.
      try {
        await gitApi.push({ sessionId })
        props.notify(t('commit.pushDone', { hash: committed.shortHash }))
      } catch (error) {
        props.notify(`${t('commit.pushFail', { hash: committed.shortHash })} · ${errorText(t, error)}`, true)
      }
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
      title={t('commit.title')}
      description={t('commit.description')}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={footerStyle}>
          <div style={metaStyle}>
            {t('commit.selected', { count: paths.length })}
            {status.upstream === undefined && ` · ${t('commit.noUpstream')}`}
          </div>
          <div style={actionsStyle}>
            <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
            <Button size="sm" variant="outline" onClick={() => { void submit(false) }} disabled={busy || generating}>{t('commit.commit')}</Button>
            <Button size="sm" variant="primary" icon={<IconBranchOutline16 size={14} />} onClick={() => { void submit(true) }} disabled={busy || generating}>{t('commit.commitPush')}</Button>
          </div>
        </div>
      )}
    >
      <section style={sectionStyle}>
        <header style={rowHeaderStyle}>
          <Checkbox
            checked={allSelected}
            onChange={(next) => setChosen(next ? new Set(stageable.map((file) => file.path)) : new Set())}
            label={t('commit.selectAll', { count: stageable.length })}
            disabled={busy || stageable.length === 0}
          />
          <span style={headingStyle}>{t('commit.files')}</span>
        </header>
        <div style={listStyle}>
          {rows.map((file) => (
            <div key={file.path} style={fileRowStyle}>
              <Checkbox
                checked={chosen.has(file.path)}
                onChange={() => toggle(file.path)}
                label={filePath(file)}
                disabled={file.conflicted || busy}
              />
              <span style={fileCodeStyle(file)} title={file.conflicted ? t('status.conflict') : undefined}>{fileCode(file)}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <header style={rowHeaderStyle}>
          <span style={headingStyle}>{t('commit.message')}</span>
          <Button
            size="sm"
            variant="ghost"
            icon={message.length === 0 ? <IconSparkle16 size={14} /> : <IconRefreshOutline14 size={14} />}
            onClick={() => { void generate() }}
            disabled={generating || busy}
          >
            {message.length === 0 ? t('commit.generate') : t('commit.regenerate')}
          </Button>
          {generating && <span style={metaStyle}>{t('commit.generating')}</span>}
        </header>
        <textarea
          style={textareaStyle}
          value={message}
          placeholder={t('commit.messagePlaceholder')}
          rows={6}
          spellCheck={false}
          onChange={(event) => setMessage(event.target.value)}
        />
      </section>
    </Modal>
  )
}

/** Commit dialog props. */
export interface CommitDialogProps extends DialogHost {
  status: GitStatusView
  onClose: () => void
}

/** Ask for a branch name, create it from the current HEAD, and switch to it. */
export function CreateBranchDialog(props: CreateBranchDialogProps) {
  const { t, sessionId, status, onClose } = props
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      await gitApi.createBranch({ sessionId, name: name.trim() })
      props.notify(t('create.done', { branch: name.trim() }))
      props.refresh()
      onClose()
    } catch (error) {
      props.notify(errorText(t, error), true)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('create.title')}
      description={t('create.description', { branch: status.head })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button size="sm" variant="primary" onClick={() => { void create() }} disabled={busy || name.trim().length === 0}>
            {t('create.submit')}
          </Button>
        </div>
      )}
    >
      <section style={sectionStyle}>
        <span style={headingStyle}>{t('create.name')}</span>
        <Input
          value={name}
          placeholder={t('create.placeholder')}
          autoFocus
          style={branchInputStyle}
          onChange={(event) => setName(event.target.value)}
        />
      </section>
    </Modal>
  )
}

/** New-branch dialog props. */
export interface CreateBranchDialogProps extends DialogHost {
  status: GitStatusView
  onClose: () => void
}

/**
 * A switch that git refused because it would overwrite local edits. The first
 * attempt runs without `force`; only this second confirmation sends it.
 */
export function ForceCheckoutDialog(props: ForceCheckoutDialogProps) {
  const { t, sessionId, branch, onClose } = props
  const [busy, setBusy] = useState(false)

  const force = async () => {
    setBusy(true)
    try {
      await gitApi.checkout({ sessionId, name: branch, force: true })
      props.notify(t('checkout.done', { branch }))
      props.refresh()
      onClose()
    } catch (error) {
      props.notify(errorText(t, error), true)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('checkout.dirtyTitle')}
      description={t('checkout.dirtyBody', { branch })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button size="sm" variant="primary" icon={<IconWarningOutline16 size={14} />} onClick={() => { void force() }} disabled={busy}>
            {t('checkout.force')}
          </Button>
        </div>
      )}
    />
  )
}

/** Forced-switch dialog props. */
export interface ForceCheckoutDialogProps extends DialogHost {
  branch: string
  onClose: () => void
}

/** Display path, showing both sides of a rename. */
function filePath(file: GitFileView): string {
  return file.oldPath === undefined ? file.path : `${file.oldPath} → ${file.path}`
}

/** Two-letter porcelain code, collapsed for display. */
function fileCode(file: GitFileView): string {
  if (file.conflicted) return 'U'
  if (file.untracked) return '?'
  const code = `${file.indexStatus}${file.worktreeStatus}`
  return code === '..' ? '·' : code
}

const sectionStyle: CSSProperties = { display: 'grid', gap: 8, minWidth: 0 }
const rowHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }
const headingStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-secondary, currentColor)', flex: '0 0 auto' }
const metaStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, currentColor)', flex: '0 0 auto' }
const listStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  maxHeight: 220,
  overflowY: 'auto',
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.25))',
  borderRadius: 8,
  padding: '6px 8px',
}
const fileRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }
const footerStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }
const branchInputStyle: CSSProperties = { width: '100%' }
const textareaStyle: CSSProperties = {
  width: '100%',
  resize: 'vertical',
  minHeight: 96,
  fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
  background: 'var(--dsw-alias-bg-layer-1, transparent)',
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.25))',
  borderRadius: 8,
  padding: '8px 10px',
  outline: 'none',
}

/** Codes that add content read as success, removals as warning, the rest neutral. */
function fileCodeStyle(file: GitFileView): CSSProperties {
  const code = fileCode(file)
  const tone = code === 'U'
    ? 'var(--dsw-alias-state-error-primary, currentColor)'
    : code === '?' || code[1] === 'A' || code === 'AM'
      ? 'var(--dsw-alias-state-success-primary, currentColor)'
      : code === 'D' || code[1] === 'D'
        ? 'var(--dsw-alias-state-warn-primary, currentColor)'
        : 'var(--dsw-alias-label-tertiary, currentColor)'
  return { flex: '0 0 auto', fontSize: 11, fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)', color: tone }
}
