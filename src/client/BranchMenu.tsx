/**
 * The composer-tool-row branch chip and its anchored popover. Data and
 * mutations belong to the parent; this component renders rows and reports intent.
 *
 * The popover is assembled from the overlay primitives rather than the `Menu`
 * component: a menu renders every entry into its scrolling viewport, so a
 * search box there would scroll away with the rows — and would sit inside a
 * `role="menuitem"` button, where a click selects the row instead of typing.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import {
  IconBranchOutlineRegular,
  IconCheckOutlineRegular,
  IconDownloadOutlineRegular,
  IconEditOutlineRegular,
  IconPlusOutlineRegular,
  IconRefreshOutlineRegular,
  IconRightUpOutlineRegular,
  IconSearchOutlineRegular,
  IconSparkleRegular,
  Input,
  Pill,
  Tooltip,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitBranchesView, GitFlowStateView, GitStatusView } from '../contract.ts'

/** One rendered row: a group heading or a branch. */
interface Row {
  kind: 'group' | 'branch'
  key: string
  label: string
  /** Present on branch rows; remote-only rows carry their `origin/…` name. */
  name?: string
}

/** Branch popover props. */
export interface BranchMenuProps {
  t: TranslateNS<'gitFlow'>
  status: GitStatusView
  /** Branch table, loaded on first open. */
  branches: GitBranchesView | undefined
  /** True while a load or switch is in flight; the chip shows a busy state. */
  busy: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectBranch: (name: string) => void
  /** Merge a branch into the current one, offered from a row's context menu. */
  onMergeBranch: (name: string) => void
  onNewBranch: () => void
  onCommit: () => void
  /** Push what is already committed, without opening the commit panel. */
  onPush: () => void
  /** Pull the current branch's upstream (`--ff-only`). */
  onPull: () => void
  onRefresh: () => void
  /** Flow state of the current branch; absent until it has been read. */
  flow: GitFlowStateView | undefined
  onStartFlow: () => void
  onFinishFlow: () => void
}

/** Pill plus anchored branch picker: pinned search, scrolling rows, pinned actions. */
export function BranchMenu(props: BranchMenuProps) {
  const { t, status, branches, busy, open } = props
  const anchorRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState('')
  // The branch row a context menu was opened for, plus the viewport point it
  // should be anchored at. Kept apart from `open` on purpose: opening the
  // context menu closes the popover, and an effect watching `open` would wipe
  // the menu in the same commit.
  const [context, setContext] = useState<{ name: string; x: number; y: number } | undefined>(undefined)

  // Anchored by its BOTTOM edge, a gap above the chip. `useAnchoredPosition`
  // places by `top`, which cannot work for a panel that opens upward and is
  // capped by the viewport: the clamp then drags it back down over its own
  // anchor. With a fixed bottom, the height cap below is the only thing that
  // decides how far up it reaches, so it can never cover the chip.
  const [placement, setPlacement] = useState<{ left: number; bottom: number; maxHeight: number } | undefined>(undefined)
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(undefined)
      return
    }
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const width = panelRef.current?.offsetWidth ?? PANEL_WIDTH
      const left = Math.min(Math.max(rect.left, MARGIN), Math.max(MARGIN, window.innerWidth - width - MARGIN))
      // Space between the chip's top edge and the viewport top, minus the gap
      // and a margin: the panel scrolls inside whatever is left.
      const room = rect.top - GAP - MARGIN
      setPlacement({
        left,
        bottom: window.innerHeight - rect.top + GAP,
        maxHeight: Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, room)),
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    if (panelRef.current !== null) observer?.observe(panelRef.current)
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])
  useDismissOnOutsidePointer(anchorRef, open, (next) => { props.onOpenChange(next) }, panelRef)

  // A fresh filter on every open; the input takes focus itself (`autoFocus`).
  useEffect(() => {
    if (open) setFilter('')
  }, [open])

  // Opening the context menu gives up the popover; the menu state is a sibling
  // overlay, so it survives the close.
  const openContextMenu = (name: string, point: { x: number; y: number }) => {
    props.onOpenChange(false)
    setContext({ name, x: point.x, y: point.y })
  }

  const rows = useMemo(() => buildRows(t, branches, filter), [t, branches, filter])
  const firstBranch = rows.find((row) => row.kind === 'branch' && row.name !== status.head)

  const tooltip = status.files.length === 0
    ? t('chip.tooltip.clean', { branch: status.head })
    : t('chip.tooltip', { branch: status.head, count: status.files.length })
  // "Not pushed" is two different facts: commits waiting on a tracked branch,
  // and a branch no remote knows about yet. Both are worth showing, since the
  // chip is where the user looks to decide whether a push is still owed.
  const unpushed = status.ahead > 0 ? t('chip.unpushed', { count: status.ahead }) : undefined
  const noUpstream = status.upstream === undefined ? t('commit.noUpstream') : undefined
  const aheadBehind = status.upstream !== undefined && status.behind > 0
    ? t('chip.aheadBehind', { ahead: status.ahead, behind: status.behind })
    : undefined
  const hints = [aheadBehind, unpushed, noUpstream].filter((part): part is string => part !== undefined)

  return (
    <>
      <span ref={anchorRef} style={anchorStyle}>
        <Tooltip label={[tooltip, ...hints].join(' · ')}>
          <Pill
            onClick={() => { props.onOpenChange(!open) }}
            aria-label={[tooltip, ...hints].join(' · ')}
            aria-expanded={open}
            style={pillStyle}
          >
            <IconBranchOutlineRegular size={14} />
            <span style={nameStyle}>{status.head}</span>
            {props.flow?.kind !== undefined && (
              <span style={flowBadgeStyle}>{t(`flow.${props.flow.kind}` as const)}</span>
            )}
            {status.behind > 0 && (
              <span style={{ ...badgeBase, background: 'var(--dsw-alias-state-business-primary, #4176e6)' }}>
                <IconDownloadOutlineRegular size={10} />
                {status.behind}
              </span>
            )}
            {status.ahead > 0 && (
              <span style={{ ...badgeBase, background: 'var(--dsw-alias-state-success-primary, #22c55e)' }}>
                <IconRightUpOutlineRegular size={10} />
                {status.ahead}
              </span>
            )}
            {status.upstream === undefined && <span style={aheadStyle}><IconRightUpOutlineRegular size={11} /></span>}
            {status.files.length > 0 && (
              <span style={{ ...badgeBase, background: 'var(--dsw-alias-state-warn-primary, #f59e0b)' }}>
                <IconEditOutlineRegular size={10} />
                {status.files.length}
              </span>
            )}
          </Pill>
        </Tooltip>
      </span>
      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={tooltip}
          style={{ ...(placement ?? hidingStyle), ...panelStyle }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            props.onOpenChange(false)
          }}
        >
          <div style={searchRowStyle}>
            <Input
              icon={<IconSearchOutlineRegular size={14} />}
              value={filter}
              placeholder={t('menu.search')}
              autoFocus
              style={searchInputStyle}
              onChange={(event) => { setFilter(event.target.value) }}
              onKeyDown={(event) => {
                // Enter takes the first row that is not already checked out.
                if (event.key === 'Enter' && firstBranch !== undefined) {
                  props.onOpenChange(false)
                  props.onSelectBranch(firstBranch.name ?? '')
                }
              }}
            />
          </div>
          <div style={listStyle} role="menu">
            {rows.length === 0 && <div style={emptyStyle}>{t('menu.empty')}</div>}
            {rows.map((row) => (row.kind === 'group'
              ? <div key={row.key} role="presentation" style={groupStyle}>{row.label}</div>
              : (
                <BranchRow
                  key={row.key}
                  label={row.label}
                  title={`${row.name ?? ''} · ${t('menu.contextHint')}`}
                  current={row.name === status.head}
                  disabled={busy}
                  onContextMenu={(point) => { openContextMenu(row.name ?? '', point) }}
                  onSelect={() => {
                    props.onOpenChange(false)
                    props.onSelectBranch(row.name ?? '')
                  }}
                />
              )))}
          </div>
          <div style={actionsStyle}>
            <ActionRow icon={<IconPlusOutlineRegular size={14} />} label={t('menu.newBranch')} onClick={() => {
              props.onOpenChange(false)
              props.onNewBranch()
            }} />
            <ActionRow
              icon={<IconSparkleRegular size={14} />}
              label={t('menu.commit')}
              disabled={status.files.length === 0}
              onClick={() => {
                props.onOpenChange(false)
                props.onCommit()
              }}
            />
            <ActionRow
              icon={<IconRightUpOutlineRegular size={14} />}
              label={t('menu.push')}
              disabled={status.ahead === 0 && status.upstream !== undefined}
              onClick={() => {
                props.onOpenChange(false)
                props.onPush()
              }}
            />
            <ActionRow
              icon={<IconDownloadOutlineRegular size={14} />}
              label={t('menu.pull')}
              disabled={status.upstream === undefined}
              onClick={() => {
                props.onOpenChange(false)
                props.onPull()
              }}
            />
            <ActionRow icon={<IconRefreshOutlineRegular size={14} />} label={t('menu.refresh')} onClick={() => {
              props.onOpenChange(false)
              props.onRefresh()
            }} />
            <ActionRow
              icon={<IconBranchOutlineRegular size={14} />}
              label={t('menu.startFlow')}
              disabled={status.detached}
              onClick={() => {
                props.onOpenChange(false)
                props.onStartFlow()
              }}
            />
            <ActionRow
              icon={<IconCheckOutlineRegular size={14} />}
              label={t('menu.finishFlow')}
              // Finish needs a flow branch and a clean tree; the dialog re-checks both.
              disabled={props.flow?.kind === undefined || status.files.length > 0}
              onClick={() => {
                props.onOpenChange(false)
                props.onFinishFlow()
              }}
            />
          </div>
        </div>,
        document.body,
      )}
      {context !== undefined && createPortal(
        <BranchContextMenu
          key={`${context.name}:${context.x}:${context.y}`}
          t={t}
          name={context.name}
          current={context.name === status.head}
          currentBranch={status.head}
          detached={status.detached}
          busy={busy}
          x={context.x}
          y={context.y}
          onCheckout={() => {
            setContext(undefined)
            props.onSelectBranch(context.name)
          }}
          onMerge={() => {
            setContext(undefined)
            props.onMergeBranch(context.name)
          }}
          onDismiss={() => { setContext(undefined) }}
        />,
        document.body,
      )}
    </>
  )
}

/** One branch row: the name, a check for the current branch, hover fill. */
function BranchRow(props: {
  label: string
  title: string
  current: boolean
  disabled: boolean
  onSelect: () => void
  /** Reports where a right-click asked for a context menu, in viewport coordinates. */
  onContextMenu: (point: { x: number; y: number }) => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      role="menuitem"
      disabled={props.disabled}
      title={props.title}
      onClick={props.onSelect}
      onContextMenu={(event) => {
        event.preventDefault()
        // A keyboard-invoked context menu (the ContextMenu key, or Shift+F10)
        // carries no pointer point; anchor it under the row itself.
        if (event.clientX === 0 && event.clientY === 0) {
          const rect = event.currentTarget.getBoundingClientRect()
          props.onContextMenu({ x: rect.left, y: rect.bottom })
          return
        }
        props.onContextMenu({ x: event.clientX, y: event.clientY })
      }}
      onPointerEnter={() => { setHover(true) }}
      onPointerLeave={() => { setHover(false) }}
      style={{ ...rowStyle, ...(hover && !props.disabled ? rowHoverStyle : null) }}
    >
      <span style={rowNameStyle}>{props.label}</span>
      {props.current && <IconCheckOutlineRegular size={14} />}
    </button>
  )
}

/** One pinned action below the scrolling list. */
function ActionRow(props: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      onPointerEnter={() => { setHover(true) }}
      onPointerLeave={() => { setHover(false) }}
      style={{
        ...actionStyle,
        ...(hover && props.disabled !== true ? rowHoverStyle : null),
        ...(props.disabled === true ? disabledStyle : null),
      }}
    >
      <span style={actionIconStyle}>{props.icon}</span>
      {props.label}
    </button>
  )
}

/** Props for the branch-row context menu. */
interface BranchContextMenuProps {
  t: TranslateNS<'gitFlow'>
  /** Branch the menu acts on. */
  name: string
  /** True when that branch is already checked out. */
  current: boolean
  /** Name of the checked-out branch, so a merge can say what it lands in. */
  currentBranch: string
  /** True when HEAD is detached, so a merge has no current branch to name. */
  detached: boolean
  busy: boolean
  /** Viewport coordinates the menu was asked for. */
  x: number
  y: number
  onCheckout: () => void
  onMerge: () => void
  onDismiss: () => void
}

/**
 * Right-click menu for one branch row: checkout, or merge into the current
 * branch. Rendered as a sibling overlay of the popover (the popover is closed
 * to reveal it), fixed-positioned at the pointer and clamped into the viewport.
 */
function BranchContextMenu(props: BranchContextMenuProps) {
  const { t, name, current, currentBranch, detached, busy } = props
  const menuRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<{ left: number; top: number } | undefined>(undefined)

  // A fixed-position card can only be clamped once it has a size, so the first
  // frame is laid out but invisible; resize re-clamps it while it is open.
  useLayoutEffect(() => {
    const place = () => {
      const card = menuRef.current
      if (card === null) return
      setPlacement({
        left: Math.min(Math.max(props.x, MARGIN), Math.max(MARGIN, window.innerWidth - card.offsetWidth - MARGIN)),
        top: Math.min(Math.max(props.y, MARGIN), Math.max(MARGIN, window.innerHeight - card.offsetHeight - MARGIN)),
      })
    }
    place()
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place) }
  }, [props.x, props.y])

  // Keyboard users land on the first row that can act; when every row is
  // disabled the card itself takes focus, so Escape still reaches the handler.
  useLayoutEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
    if (first !== null && first !== undefined) first.focus()
    else menuRef.current?.focus()
  }, [])

  // The popover's dismiss hook left with it; the menu needs its own listener.
  useDismissOnOutsidePointer(menuRef, true, (next) => {
    if (!next) props.onDismiss()
  })

  /** Rows that can act, in visual order, for arrow-key navigation. */
  const enabledRows = () => Array.from(
    menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [],
  )

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={name}
      tabIndex={-1}
      style={{ ...contextMenuStyle, ...(placement ?? contextMenuHidingStyle) }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          props.onDismiss()
          return
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const rows = enabledRows()
        if (rows.length === 0) return
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        const active = document.activeElement
        const at = active instanceof HTMLButtonElement ? rows.indexOf(active) : -1
        const next = at === -1
          ? (step === 1 ? rows[0] : rows[rows.length - 1])
          : rows[(at + step + rows.length) % rows.length]
        next.focus()
      }}
    >
      <MenuItemRow
        icon={<IconBranchOutlineRegular size={14} />}
        label={t('menu.contextCheckout', { branch: name })}
        // The current branch cannot be checked out onto itself.
        disabled={current || busy}
        onClick={props.onCheckout}
      />
      <MenuItemRow
        icon={<IconRightUpOutlineRegular size={14} />}
        label={detached
          ? t('menu.contextMergeCurrent', { branch: name })
          : t('menu.contextMerge', { branch: name, into: currentBranch })}
        // A merge needs a branch to land in (HEAD attached) and a source.
        disabled={current || detached || busy}
        onClick={props.onMerge}
      />
    </div>
  )
}

/** One row of the context menu: the popover's action look, label ellipsized. */
function MenuItemRow(props: { icon: ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      role="menuitem"
      disabled={props.disabled}
      onClick={props.onClick}
      onPointerEnter={() => { setHover(true) }}
      onPointerLeave={() => { setHover(false) }}
      style={{
        ...actionStyle,
        ...(hover && !props.disabled ? rowHoverStyle : null),
        ...(props.disabled ? disabledStyle : null),
      }}
    >
      <span style={actionIconStyle}>{props.icon}</span>
      <span style={contextLabelStyle}>{props.label}</span>
    </button>
  )
}

/** Local rows, then the remote-only ones, filtered by the search text. */
function buildRows(t: TranslateNS<'gitFlow'>, branches: GitBranchesView | undefined, filter: string): Row[] {
  if (branches === undefined) return [{ kind: 'group', key: 'loading', label: t('menu.loading') }]
  const needle = filter.trim().toLowerCase()
  const named = (name: string) => name.toLowerCase().includes(needle)
  const rows: Row[] = []
  const group = (label: string, list: readonly Row[]) => {
    if (list.length === 0) return
    rows.push({ kind: 'group', key: `group:${label}`, label: `${label} · ${list.length}` })
    rows.push(...list)
  }
  group(t('menu.local'), branches.local
    .filter((branch) => !branch.remoteOnly && named(branch.name))
    .map((branch) => ({ kind: 'branch' as const, key: `local:${branch.name}`, label: branch.name, name: branch.name })))
  group(t('menu.remote'), branches.local
    .filter((branch) => branch.remoteOnly && named(branch.name))
    .map((branch) => ({ kind: 'branch' as const, key: `remote:${branch.name}`, label: branch.name, name: branch.name })))
  return rows
}

/** Fixed-position placeholder for the frame before the anchor is measured. */
const hidingStyle: CSSProperties = { position: 'fixed', left: 0, bottom: 0, visibility: 'hidden' }
/** Design width of the popover card. */
const PANEL_WIDTH = 268
/** Distance kept between the chip's top edge and the popover. */
const GAP = 8
/** Distance kept between the popover and each viewport edge. */
const MARGIN = 12
/** Height cap on a tall window, and the floor that keeps the card usable. */
const PANEL_MAX_HEIGHT = 420
const PANEL_MIN_HEIGHT = 180
const anchorStyle: CSSProperties = { display: 'inline-flex' }
const pillStyle: CSSProperties = { gap: 6, maxWidth: 240 }
const nameStyle: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
/**
 * Frosted menu surface shared by the anchored popover and the branch context
 * menu, so the two overlays read as the same layer of chrome.
 */
const surfaceStyle: CSSProperties = {
  background: 'var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1, #ffffff))',
  // The menu surface token is intentionally translucent (#f8f9fa94 in 0.1.7), and
  // the design pairs it with the shell's frosted blur — the same recipe as the
  // primitives Menu card. Without it the page shows straight through the popover.
  backdropFilter: 'var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%))',
  WebkitBackdropFilter: 'var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%))',
  border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.25))',
  boxShadow: 'var(--dsw-elevation-prominent, 0 12px 32px rgba(0,0,0,0.16))',
}
const panelStyle: CSSProperties = {
  // `useAnchoredPosition` returns coordinates only — the fixed positioning that
  // makes them mean anything is the caller's job (the Menu primitive gets it
  // from its own stylesheet). Without this the portaled card lands in normal
  // flow at the end of <body>.
  position: 'fixed',
  // Above modal overlays (z 1000), like a portaled Menu: an anchor can sit
  // inside a dialog and still expect its popover on top.
  zIndex: 1100,
  display: 'flex',
  flexDirection: 'column',
  width: PANEL_WIDTH,
  borderRadius: 16,
  overflow: 'hidden',
  ...surfaceStyle,
}
/** Right-click card: same surface as the popover, sized around its copy. */
const contextMenuStyle: CSSProperties = {
  position: 'fixed',
  // Above the popover (1100), which itself clears modal overlays (1000).
  zIndex: 1200,
  display: 'flex',
  flexDirection: 'column',
  padding: 4,
  // A menu-like width: wide enough for a branch name, capped so the label
  // ellipsizes instead of stretching the card past the viewport.
  minWidth: 220,
  maxWidth: 340,
  borderRadius: 12,
  // The card itself can take focus when every row is disabled; the browser's
  // focus ring belongs on the rows, not on the surface.
  outline: 'none',
  ...surfaceStyle,
}
/** Fixed-position placeholder for the frame before the menu is measured. */
const contextMenuHidingStyle: CSSProperties = { left: 0, top: 0, visibility: 'hidden' }
const searchRowStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '8px 8px 6px',
  borderBottom: '1px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.16))',
}
const searchInputStyle: CSSProperties = { width: '100%' }
const listStyle: CSSProperties = { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: 4 }
const actionsStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: 4,
  borderTop: '1px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.16))',
}
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  width: '100%',
  padding: '6px 8px',
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary, inherit)',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
}
const rowHoverStyle: CSSProperties = { background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.10))' }
const rowNameStyle: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const groupStyle: CSSProperties = {
  padding: '6px 8px 2px',
  fontSize: 11,
  color: 'var(--dsw-alias-label-tertiary, currentColor)',
}
const emptyStyle: CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  color: 'var(--dsw-alias-label-tertiary, currentColor)',
}
const actionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 8px',
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary, inherit)',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
}
const actionIconStyle: CSSProperties = { display: 'inline-flex', flex: '0 0 auto' }
/** Context-menu copy: one line, ellipsized when the branch name is long. */
const contextLabelStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const disabledStyle: CSSProperties = { opacity: 0.45, cursor: 'default' }
const aheadStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  flex: '0 0 auto',
  fontSize: 11,
  color: 'var(--dsw-alias-label-secondary, currentColor)',
}
/** Chip count pill: white glyphs on a state color; the color names the fact. */
const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  minWidth: 16,
  padding: '0 5px',
  borderRadius: 8,
  fontSize: 11,
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-primary-inverted, #ffffff)',
}
/** Flow-family tag next to the chip name; neutral so it never competes with the counts. */
const flowBadgeStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '0 5px',
  borderRadius: 6,
  fontSize: 10,
  lineHeight: '15px',
  color: 'var(--dsw-alias-label-secondary, currentColor)',
  background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.14))',
}
