/**
 * The three git-flow modal surfaces: start a flow branch, guide the first
 * `develop` into existence, and finish a flow branch.
 *
 * The finish dialog is the one destructive surface here, so it lists every step
 * of the run before the user confirms: merging, tagging, versioning, pushing,
 * and deleting the branch all happen without a second prompt afterwards.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, IconWarningOutlineRegular, Input, Modal, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GitFlowKind, GitFlowStateView, GitStatusView } from '../contract.ts'
import { errorText, GitApiError, gitApi } from './api.ts'
import type { DialogHost } from './CommitDialog.tsx'

/** Flow families in the order the start dialog offers them. */
const KINDS: readonly GitFlowKind[] = ['feature', 'release', 'hotfix']

/** Copy key naming one family. */
function kindKey(kind: GitFlowKind) {
  return `flow.${kind}` as const
}


/** Start dialog props. */
export interface StartFlowDialogProps extends DialogHost {
  state: GitFlowStateView
  status: GitStatusView
  onClose: () => void
  /** A start refused for a missing develop hands off to the init dialog. */
  onNeedDevelop: () => void
}

/**
 * Name a flow branch and create it from the branch its family starts at.
 * A missing develop is not an error the user can fix in this dialog, so it
 * closes and hands off to the guided creation instead.
 */
export function StartFlowDialog(props: StartFlowDialogProps) {
  const { t, sessionId, state, status, onClose } = props
  const [kind, setKind] = useState<GitFlowKind>('feature')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const prefix = kind === 'feature' ? state.branches.featurePrefix : kind === 'release' ? state.branches.releasePrefix : state.branches.hotfixPrefix
  const base = kind === 'hotfix' ? state.branches.production : state.branches.develop
  const blank = name.trim().length === 0
  const start = async () => {
    if (blank) {
      props.notify(t('start.needName'), true)
      return
    }
    setBusy(true)
    try {
      const next = await gitApi.startFlow({ sessionId, kind, name: name.trim() })
      props.notify(t('start.done', { branch: next.head }))
      props.refresh()
      onClose()
    } catch (error) {
      // The guided-develop flow owns this case; everything else is a plain report.
      if (error instanceof GitApiError && error.code === 'git/develop-missing') {
        onClose()
        props.onNeedDevelop()
        return
      }
      props.notify(errorText(t, error), true)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('start.title')}
      description={t('start.description', { develop: state.branches.develop, production: state.branches.production })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button size="sm" variant="primary" onClick={() => { void start() }} disabled={busy || blank}>
            {t('start.submit')}
          </Button>
        </div>
      )}
    >
      <section style={sectionStyle}>
        <span style={headingStyle}>{t('start.kind')}</span>
        <div style={pillRowStyle}>
          {KINDS.map((id) => (
            <Pill key={id} active={kind === id} disabled={busy} onClick={() => { setKind(id) }}>
              {t(kindKey(id))}
            </Pill>
          ))}
        </div>
      </section>
      <section style={sectionStyle}>
        <span style={headingStyle}>{t('start.name')}</span>
        <Input
          value={name}
          placeholder={t('start.placeholder', { prefix })}
          autoFocus
          style={inputStyle}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void start()
          }}
        />
        <div style={hintStyle}>
          <code style={codeStyle}>{prefix}{name.trim() || '…'}</code>
          <span>{t('start.base', { base })}</span>
        </div>
        <div style={hintStyle}>
          <span>{t('start.versionHint')}</span>
          {status.detached && <span>· {t('error.detached')}</span>}
        </div>
      </section>
    </Modal>
  )
}

/** Init-develop dialog props. */
export interface InitDevelopDialogProps extends DialogHost {
  state: GitFlowStateView
  status: GitStatusView
  onClose: () => void
  /** Continue whatever asked for develop in the first place. */
  onDone: () => void
}

/** Create the integration branch from production (or HEAD when there is none). */
export function InitDevelopDialog(props: InitDevelopDialogProps) {
  const { t, sessionId, state, status, onClose } = props
  const [busy, setBusy] = useState(false)
  const from = state.hasProduction ? state.branches.production : status.head

  const create = async () => {
    setBusy(true)
    try {
      await gitApi.initDevelop({ sessionId })
      props.notify(t('initDevelop.done', { develop: state.branches.develop }))
      props.refresh()
      onClose()
      props.onDone()
    } catch (error) {
      props.notify(errorText(t, error), true)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('initDevelop.title', { develop: state.branches.develop })}
      description={t('initDevelop.description', { develop: state.branches.develop, from })}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button size="sm" variant="primary" onClick={() => { void create() }} disabled={busy}>
            {t('initDevelop.submit', { develop: state.branches.develop })}
          </Button>
        </div>
      )}
    />
  )
}

/** Finish dialog props. */
export interface FinishFlowDialogProps extends DialogHost {
  state: GitFlowStateView
  status: GitStatusView
  onClose: () => void
}

/**
 * Confirm and run the finish sequence. The step list is generated from the same
 * facts the host will act on, so what the user reads is what will happen.
 */
export function FinishFlowDialog(props: FinishFlowDialogProps) {
  const { t, sessionId, state, status, onClose } = props
  const kind = state.kind ?? 'feature'
  const isRelease = kind !== 'feature'
  const targets = isRelease ? [state.branches.production, state.branches.develop] : [state.branches.develop]
  const [version, setVersion] = useState(() => state.version ?? '')
  const [busy, setBusy] = useState(false)
  const tag = isRelease && version.trim().length > 0 ? `${state.branches.tagPrefix}${version.trim()}` : state.tagName

  const finish = async () => {
    setBusy(true)
    try {
      const done = await gitApi.finishFlow({ sessionId, version: isRelease && version.trim().length > 0 ? version.trim() : undefined })
      if (done.failure !== undefined) {
        // Local facts survive a failed push, so say so rather than reporting a clean failure.
        props.notify(t('finish.partial', { branch: done.branch, detail: done.failure.detail }), true)
      } else {
        const parts = [t('finish.merged', { targets: done.mergedInto.join(', ') })]
        if (done.tag !== undefined) parts.push(t('finish.tagCreated', { tag: done.tag }))
        if (done.deleted) parts.push(t('finish.deleted'))
        props.notify(`${t('finish.done', { branch: done.branch })} · ${parts.join(' · ')}`)
      }
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
      title={t('finish.title', { branch: state.head })}
      description={t('finish.description')}
      closeLabel={t('commit.cancel')}
      footer={(
        <div style={actionsStyle}>
          <Button size="sm" onClick={onClose} disabled={busy}>{t('commit.cancel')}</Button>
          <Button
            size="sm"
            variant="primary"
            icon={<IconWarningOutlineRegular size={14} />}
            onClick={() => { void finish() }}
            disabled={busy || status.files.length > 0 || state.tagExists}
          >
            {t('finish.submit')}
          </Button>
        </div>
      )}
    >
      <section style={sectionStyle}>
        <ol style={stepsStyle}>
          <li>{t('finish.mergeInto', { targets: targets.join(', ') })}</li>
          {isRelease && tag !== undefined && <li>{t('finish.tag', { tag })}</li>}
          {isRelease && version.trim().length > 0 && <li>{t('finish.version', { version: version.trim() })}</li>}
          <li>{t('finish.push')}</li>
          <li>{t('finish.delete')}</li>
        </ol>
      </section>
      {isRelease && (
        <section style={sectionStyle}>
          <span style={headingStyle}>{t('finish.versionLabel')}</span>
          <Input
            value={version}
            placeholder="0.4.0"
            style={inputStyle}
            disabled={busy}
            onChange={(event) => setVersion(event.target.value)}
          />
          {state.tagExists && tag !== undefined && (
            <div style={{ ...warnStyle }}>{t('finish.tagExists', { tag })}</div>
          )}
        </section>
      )}
      {status.files.length > 0 && (
        <div style={warnStyle}>{t('checkout.dirtyTitle')}</div>
      )}
    </Modal>
  )
}

const sectionStyle: CSSProperties = { display: 'grid', gap: 8, minWidth: 0 }
const headingStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-secondary, currentColor)' }
const pillRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }
const inputStyle: CSSProperties = { width: '100%' }
const hintStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: 'var(--dsw-alias-label-tertiary, currentColor)',
}
const codeStyle: CSSProperties = {
  padding: '0 4px',
  borderRadius: 4,
  fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)',
  background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12))',
}
const stepsStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  margin: 0,
  paddingLeft: 18,
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
}
const warnStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--dsw-alias-state-warn-primary, #b45309)',
  background: 'var(--dsw-alias-state-warn-bg, rgba(245,158,11,0.12))',
}
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }
