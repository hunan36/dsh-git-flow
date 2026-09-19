/**
 * The composer-tool-row branch chip and its anchored branch menu. Data and
 * mutations belong to the parent; this component renders rows and reports intent.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { IconBranchOutline16, IconPlusOutline16, IconRefreshOutline14, IconSearchOutline16, Input, Menu, Pill, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitBranchesView, GitStatusView } from '../contract.ts'

/** Reserved row ids; branch rows are prefixed so names cannot collide. */
const SEARCH_ID = 'search'
const NEW_ID = 'new'
const COMMIT_ID = 'commit'
const REFRESH_ID = 'refresh'
/** Row id prefix. */
export const BRANCH_ID_PREFIX = 'branch:'

/** Branch menu props. */
export interface BranchMenuProps {
  t: TranslateNS<'gitFlow'>
  status: GitStatusView
  /** Branch table, loaded on first open. */
  branches: GitBranchesView | undefined
  /** True while a load or switch is in flight; the chip shows a spinner-free busy state. */
  busy: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectBranch: (name: string) => void
  onNewBranch: () => void
  onCommit: () => void
  onRefresh: () => void
}

/** Pill plus anchored branch picker, one row per branch. */
export function BranchMenu(props: BranchMenuProps) {
  const { t, status, branches, busy, open } = props
  const [filter, setFilter] = useState('')
  const tooltip = status.files.length === 0
    ? t('chip.tooltip.clean', { branch: status.head })
    : t('chip.tooltip', { branch: status.head, count: status.files.length })
  const aheadBehind = status.upstream !== undefined && (status.ahead > 0 || status.behind > 0)
    ? t('chip.aheadBehind', { ahead: status.ahead, behind: status.behind })
    : undefined

  const items: MenuEntry[] = [
    {
      id: SEARCH_ID,
      label: (
        <Input
          icon={<IconSearchOutline16 size={14} />}
          value={filter}
          placeholder={t('menu.search')}
          style={searchStyle}
          onChange={(event) => setFilter(event.target.value)}
        />
      ),
    },
    ...branchRows(t, branches, filter),
  ]
  const footer: MenuEntry[] = [
    { id: NEW_ID, label: t('menu.newBranch'), icon: <IconPlusOutline16 size={14} /> },
    { id: COMMIT_ID, label: t('menu.commit'), icon: <IconBranchOutline16 size={14} />, disabled: status.files.length === 0 },
    { id: REFRESH_ID, label: t('menu.refresh'), icon: <IconRefreshOutline14 size={14} /> },
  ]

  return (
    <Menu
      open={open}
      anchor={(
        <Tooltip label={aheadBehind === undefined ? tooltip : `${tooltip} · ${aheadBehind}`}>
          <span style={anchorStyle}>
            <Pill onClick={() => { props.onOpenChange(!open) }} aria-label={tooltip} style={pillStyle}>
              <IconBranchOutline16 size={14} />
              <span style={nameStyle}>{status.head}</span>
              {status.files.length > 0 && <span style={countStyle}>{status.files.length}</span>}
            </Pill>
          </span>
        </Tooltip>
      )}
      items={items}
      footer={footer}
      selectedId={`${BRANCH_ID_PREFIX}${status.head}`}
      selection="check"
      onSelect={(id) => {
        setFilter('')
        props.onOpenChange(false)
        if (id.startsWith(BRANCH_ID_PREFIX)) props.onSelectBranch(id.slice(BRANCH_ID_PREFIX.length))
        else if (id === NEW_ID) props.onNewBranch()
        else if (id === COMMIT_ID) props.onCommit()
        else if (id === REFRESH_ID) props.onRefresh()
      }}
      onClose={() => { props.onOpenChange(false) }}
      autoFocus={false}
      portal
      side="top"
      dense
    />
  )
}

/** Local rows, then the remote-only ones, filtered by the search text. */
function branchRows(
  t: TranslateNS<'gitFlow'>,
  branches: GitBranchesView | undefined,
  filter: string,
): MenuEntry[] {
  if (branches === undefined) return [{ id: 'loading', label: t('menu.loading'), disabled: true }]
  const needle = filter.trim().toLowerCase()
  const named = (name: string) => name.toLowerCase().includes(needle)
  const rows: MenuEntry[] = []
  const group = (label: string, list: readonly string[]) => {
    if (list.length === 0) return
    rows.push({ type: 'label', id: label, text: `${label} · ${list.length}` })
    for (const name of list) rows.push({ id: `${BRANCH_ID_PREFIX}${name}`, label: <span style={rowStyle}>{name}</span> })
  }
  group(t('menu.local'), branches.local.filter((branch) => !branch.remoteOnly && named(branch.name)).map((branch) => branch.name))
  group(t('menu.remote'), branches.local.filter((branch) => branch.remoteOnly && named(branch.name)).map((branch) => branch.name))
  if (rows.length === 0) rows.push({ id: 'empty', label: t('menu.empty'), disabled: true })
  return rows
}

const anchorStyle: CSSProperties = { display: 'inline-flex' }
const pillStyle: CSSProperties = { gap: 6, maxWidth: 240 }
const nameStyle: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%' }
const searchStyle: CSSProperties = { width: '100%' }
const countStyle: CSSProperties = {
  minWidth: 16,
  padding: '0 4px',
  borderRadius: 8,
  textAlign: 'center',
  fontSize: 11,
  lineHeight: '16px',
  background: 'var(--dsw-alias-state-warn-primary, currentColor)',
  color: 'var(--dsw-alias-label-primary-inverted, #fff)',
}
