/**
 * Small modal surfaces: the commit composer, the new-branch prompt, and the
 * second confirmation a dirty worktree needs before a forced switch.
 * Every mutation goes through `/api/dsh-git-flow/*`, which names only the session.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Button, Checkbox, IconRefreshOutline14, IconSparkle16, IconTrashOutline16, IconWarningOutline16, Input, Modal, Pill, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitFileView, GitStatusView, MessageLanguage } from '../contract.ts'
import { errorText, gitApi, isStaleSelection } from './api.ts'

/** Custom property and storage key behind the drag-to-resize width. */
const DIALOG_WIDTH_VAR = '--dsh-git-flow-dialog-width'
const DIALOG_WIDTH_KEY = 'dsh-git-flow:dialog-width'
/** Bounds for the dragged width, in px. */
const WIDTH_MIN = 380
const WIDTH_MAX = 1100

/** Languages the panel offers, in display order. */
const LANGUAGES: readonly MessageLanguage[] = ['en', 'zh']
/** Endonyms: each option reads correctly in either UI language. */
const LANGUAGE_LABEL: Record<MessageLanguage, string> = { en: 'English', zh: '中文' }
/** Where the panel remembers the choice; the host config remains the default. */
const LANGUAGE_KEY = 'dsh-git-flow:message-language'

/** Stored preference, falling back to the configured default (English). */
function readLanguage(): MessageLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    // Storage can be unavailable (sandboxed frame); the default still works.
  }
  return 'en'
}

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
  const [language, setLanguage] = useState<MessageLanguage>(readLanguage)
  /** Paths awaiting the destructive-action confirmation. */
  const [discard, setDiscard] = useState<string[] | undefined>(undefined)
  const paths = stageable.filter((file) => chosen.has(file.path)).map((file) => file.path)
  const allSelected = stageable.length > 0 && paths.length === stageable.length
  const signature = stageable.map((file) => file.path).join('\n')

  // A refresh can replace the whole list while the panel is open (a commit
  // landed, or the agent wrote files). Re-seed from it so every current file is
  // checked and a vanished path drops out instead of failing the next request.
  useEffect(() => {
    setChosen(new Set(stageable.map((file) => file.path)))
  }, [signature])

  const chooseLanguage = (next: MessageLanguage) => {
    setLanguage(next)
    try {
      window.localStorage.setItem(LANGUAGE_KEY, next)
    } catch {
      // A failed write only costs the preference, never the request.
    }
  }

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
      const draft = await gitApi.generateMessage({ sessionId, files: paths, language })
      setMessage(draft.message)
      // A host older than this page accepts the request but drops `language`,
      // so the choice silently does nothing until the process is restarted.
      if (draft.language !== language) props.notify(t('commit.staleHost'), true)
      else if (draft.fallback) {
        // A route-level failure (bad model, rejected effort, revoked key) is
        // worth naming: the user can fix it instead of shipping the template.
        props.notify(
          draft.reason === undefined ? t('commit.fallback') : t('commit.fallbackReason', { detail: draft.reason }),
          true,
        )
      }
    } catch (error) {
      props.notify(errorText(t, error), true)
      if (isStaleSelection(error)) props.refresh()
    } finally {
      setGenerating(false)
    }
  }

  /** Push what is already committed, without making a new commit. */
  const pushOnly = async () => {
    setBusy(true)
    try {
      await gitApi.push({ sessionId })
      props.notify(t('push.done', { branch: status.head }))
      props.refresh()
      onClose()
    } catch (error) {
      props.notify(errorText(t, error), true)
    } finally {
      setBusy(false)
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
      if (isStaleSelection(error)) props.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <Modal
      open
      onClose={onClose}
      className="dsh-git-flow-dialog"
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
            <Button size="sm" variant="ghost" onClick={() => { void pushOnly() }} disabled={busy || generating}>
              {t('commit.push')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { void submit(true) }} disabled={busy || generating}>
              {t('commit.commitPush')}
            </Button>
            <Button size="sm" variant="primary" onClick={() => { void submit(false) }} disabled={busy || generating}>
              {t('commit.commit')}
            </Button>
          </div>
        </div>
      )}
    >
      <ResizeHandle label={t('commit.resize')} />
      <section style={sectionStyle}>
        <header style={rowHeaderStyle}>
          <span style={headingStyle}>{t('commit.message')}</span>
          <Tooltip label={t('commit.messageLanguage')}>
            <span style={languageStyle}>
              {LANGUAGES.map((id) => (
                <Pill
                  key={id}
                  active={language === id}
                  disabled={generating || busy}
                  onClick={() => { chooseLanguage(id) }}
                >
                  {LANGUAGE_LABEL[id]}
                </Pill>
              ))}
            </span>
          </Tooltip>
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
          rows={5}
          spellCheck={false}
          onChange={(event) => setMessage(event.target.value)}
        />
      </section>

      <section style={sectionStyle}>
        <header style={rowHeaderStyle}>
          <span style={headingStyle}>{t('commit.files')}</span>
          <span style={metaStyle}>{t('commit.selected', { count: paths.length })}</span>
          <Checkbox
            checked={allSelected}
            onChange={(next) => setChosen(next ? new Set(stageable.map((file) => file.path)) : new Set())}
            label={t('commit.selectAll', { count: stageable.length })}
            disabled={busy || stageable.length === 0}
          />
        </header>
        <div style={listStyle}>
          {rows.length === 0 && <div style={emptyListStyle}>{t('commit.none')}</div>}
          {rows.map((file) => (
            <FileRow
              key={file.path}
              path={filePath(file)}
              code={fileCode(file)}
              tone={fileTone(file)}
              title={file.conflicted ? t('status.conflict') : file.path}
              checked={chosen.has(file.path)}
              disabled={file.conflicted || busy}
              discardLabel={t('commit.discardOne', { path: file.path })}
              onToggle={() => { toggle(file.path) }}
              onDiscard={() => { setDiscard([file.path]) }}
            />
          ))}
        </div>
      </section>
    </Modal>
    {discard !== undefined && (
      <DiscardDialog
        t={t}
        sessionId={sessionId}
        files={discard}
        notify={props.notify}
        refresh={props.refresh}
        onClose={() => { setDiscard(undefined) }}
      />
    )}
    </>
  )
}

/** One changed path: checkbox, single-line path, status badge, discard action. */
function FileRow(props: {
  path: string
  code: string
  tone: string
  title: string
  checked: boolean
  disabled: boolean
  discardLabel: string
  onToggle: () => void
  onDiscard: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="dsh-git-flow-file-row"
      style={{ ...fileRowStyle, ...(hover && !props.disabled ? rowHoverStyle : null) }}
      onPointerEnter={() => { setHover(true) }}
      onPointerLeave={() => { setHover(false) }}
    >
      <Checkbox
        className="dsh-git-flow-file-label"
        checked={props.checked}
        onChange={props.onToggle}
        label={props.path}
        title={props.title}
        disabled={props.disabled}
      />
      <span style={{ ...badgeStyle, color: props.tone }}>{props.code}</span>
      {!props.disabled && (
        <Tooltip label={props.discardLabel}>
          <button
            type="button"
            className="dsh-git-flow-file-action"
            style={iconButtonStyle}
            aria-label={props.discardLabel}
            onClick={props.onDiscard}
          >
            <IconTrashOutline16 size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

/**
 * Right-edge gripper for the dialog card. The card owns its width through the
 * `--dsh-git-flow-dialog-width` custom property (see styles.ts), so the drag
 * only has to write that property; the chosen width is remembered per browser.
 */
function ResizeHandle(props: { label: string }) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(DIALOG_WIDTH_KEY)
    if (stored !== null) document.documentElement.style.setProperty(DIALOG_WIDTH_VAR, stored)
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const handle = event.currentTarget
    const card = handle.closest('.dsh-git-flow-dialog')
    if (!(card instanceof HTMLElement)) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = card.offsetWidth
    const target = handle as HTMLElement
    target.setPointerCapture(event.pointerId)
    setDragging(true)
    let width = startWidth
    const move = (moveEvent: PointerEvent) => {
      const limit = Math.min(WIDTH_MAX, window.innerWidth - 48)
      width = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), WIDTH_MIN), Math.max(WIDTH_MIN, limit))
      document.documentElement.style.setProperty(DIALOG_WIDTH_VAR, `${width}px`)
    }
    const up = () => {
      target.releasePointerCapture(event.pointerId)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      setDragging(false)
      window.localStorage.setItem(DIALOG_WIDTH_KEY, `${width}px`)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  return (
    <Tooltip label={props.label}>
      <span
        className="dsh-git-flow-resize"
        role="separator"
        aria-label={props.label}
        aria-orientation="vertical"
        data-dragging={dragging ? 'true' : undefined}
        onPointerDown={onPointerDown}
        onDoubleClick={() => {
          // Doubling up resets to the default width.
          document.documentElement.style.removeProperty(DIALOG_WIDTH_VAR)
          window.localStorage.removeItem(DIALOG_WIDTH_KEY)
        }}
      />
    </Tooltip>
  )
}

/**
 * Confirmation for a destructive discard. Nothing is sent until the user picks
 * the destructive action here.
 */
export function DiscardDialog(props: DiscardDialogProps) {
  const { t, sessionId, files, onClose } = props
  const [busy, setBusy] = useState(false)

  const discard = async () => {
    setBusy(true)
    try {
      await gitApi.discard({ sessionId, files })
      props.notify(t('commit.discardDone', { count: files.length }))
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
      title={t('commit.discardTitle')}
      description={t('commit.discardBody', { count: files.length })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button size="sm" variant="primary" icon={<IconWarningOutline16 size={14} />} onClick={() => { void discard() }} disabled={busy}>
            {t('commit.discard')}
          </Button>
        </div>
      )}
    />
  )
}

/** Discard dialog props. */
export interface DiscardDialogProps extends DialogHost {
  files: string[]
  onClose: () => void
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
const languageStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }
const headingStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-secondary, currentColor)', flex: '0 0 auto' }
const metaStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, currentColor)', flex: '0 0 auto' }
const listStyle: CSSProperties = {
  display: 'grid',
  gap: 1,
  maxHeight: 216,
  overflowY: 'auto',
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.25))',
  borderRadius: 10,
  padding: 4,
}
const emptyListStyle: CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  color: 'var(--dsw-alias-label-tertiary, currentColor)',
}
const fileRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
  padding: '3px 6px',
  borderRadius: 6,
}
const rowHoverStyle: CSSProperties = { background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.10))' }
const iconButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  width: 22,
  height: 22,
  padding: 0,
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary, currentColor)',
  cursor: 'pointer',
}
const badgeStyle: CSSProperties = {
  flex: '0 0 auto',
  minWidth: 22,
  padding: '0 5px',
  border: '1px solid currentColor',
  borderRadius: 6,
  fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)',
  fontSize: 10,
  lineHeight: '16px',
  textAlign: 'center',
  opacity: 0.9,
}
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
function fileTone(file: GitFileView): string {
  const code = fileCode(file)
  if (code === 'U') return 'var(--dsw-alias-state-error-primary, currentColor)'
  if (code === '?' || code[1] === 'A' || code === 'AM') return 'var(--dsw-alias-state-success-primary, currentColor)'
  if (code === 'D' || code[1] === 'D') return 'var(--dsw-alias-state-warn-primary, currentColor)'
  return 'var(--dsw-alias-label-tertiary, currentColor)'
}
