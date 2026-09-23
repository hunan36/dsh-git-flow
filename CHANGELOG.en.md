# Changelog

## v0.3.0-rc.2 (2026-09-23)

### New Features

- Discard individual files from the commit panel: tracked files are restored to HEAD, untracked files are deleted, and conflicted files are refused.
- Resize the commit panel by dragging its handle; the width is remembered per browser and double-clicking the handle restores the default.
- Added "Pull from remote" to the branch menu, fast-forward only: a diverged branch reports an error instead of merging automatically.
- The branch chip shows unpushed, behind-remote, and uncommitted counts as colored badges, each with its own icon.

### Improvements

- Row hover color in the branch menu and the commit panel now follows the theme's interactive color.

### Bug Fixes

- Fixed the branch chip not showing after upgrading to DeepSeek Harness 0.1.7-alpha.2.
- Fixed the branch menu popover letting the page show through, restoring the design system's frosted background.

### Other Changes

- Plugin dependencies moved to DeepSeek Harness 0.1.7-alpha.2; DSH 0.1.7-alpha.2 or newer is now required, and older DSH builds no longer work.
