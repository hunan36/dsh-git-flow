/**
 * The one stylesheet this plugin needs. Inline styles cannot reach inside the
 * primitive components (the checkbox labels its own text, the modal card owns
 * its width), so the few rules that must cross that boundary live here and are
 * installed once per client fiber.
 * @module dsh-git-flow/client/styles
 */

const STYLE_ID = 'dsh-git-flow-styles'

/**
 * Card width comes from a custom property so the drag handle can change it at
 * runtime; unset, it falls back to the modal primitive's own width.
 */
const CSS = `
.dsh-git-flow-dialog {
  position: relative;
  width: var(--dsh-git-flow-dialog-width, min(380px, 100%));
}
.dsh-git-flow-resize {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 14px;
  cursor: ew-resize;
  touch-action: none;
  z-index: 2;
}
.dsh-git-flow-resize::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 4px;
  width: 3px;
  height: 32px;
  margin-top: -16px;
  border-radius: 2px;
  background: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.45));
  opacity: 0;
  transition: opacity 0.12s ease;
}
.dsh-git-flow-resize:hover::after,
.dsh-git-flow-resize[data-dragging='true']::after {
  opacity: 1;
}
.dsh-git-flow-file-label {
  flex: 1 1 auto;
  min-width: 0;
}
.dsh-git-flow-file-label > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-git-flow-file-action {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.dsh-git-flow-file-row:hover .dsh-git-flow-file-action,
.dsh-git-flow-file-action:focus-visible {
  opacity: 1;
}
`

/**
 * Install the stylesheet for this fiber.
 * @returns a disposer removing the style element.
 */
export function installStyles(): () => void {
  const existing = document.getElementById(STYLE_ID)
  if (existing !== null) return () => {}
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.appendChild(element)
  return () => { element.remove() }
}
