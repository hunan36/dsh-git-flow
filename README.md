# dsh-git-flow

English | [中文](README.zh.md)

**Version 0.1.0-rc.3** (pre-release) — a DeepSeek Harness workspace git plugin: a branch chip in the composer tool row. Open it to browse branches, switch branches, create one, and commit a checked subset of files — the commit message is written by the session's own model from the diff.

```
composer tool row:  [⑂ feature/login  3]  ← click
                      ├ Search branches
                      ├ Local branches · 2   ✓ feature/login
                      │                        main
                      ├ New branch…
                      ├ Commit…                (enabled while the tree is dirty)
                      └ Refresh status
```

## Install

```bash
# 1. Create a dedicated profile (leaves your existing web profile alone)
dsh --profile gitflow-web --from-default-profile web

# 2. Add the plugin — a git URL, or the absolute path of a local checkout
dsh plugin --profile gitflow-web add https://github.com/hunan36/dsh-git-flow.git
# dsh plugin --profile gitflow-web add "$PWD"

# 3. Enable it on the plugin page ("Enable"), or edit the bundle list directly:
#    dsh.profile.bundles += "dsh-git-flow"
#    The package declares dsh.bundle.patch, so enabling it mounts the GitFlow
#    service from the bundle's own cordis.patch.yml.

# 4. Boot
dsh --profile gitflow-web
```

The `headless` profile installs too, but it has no `webServer`: no `/api/dsh-git-flow/*` route is registered, the browser half does not exist there, and boot reports no error.

### Installation fails with ERR_PNPM_ADDING_TO_ROOT

A dsh profile directory is itself a pnpm workspace (`pnpm-workspace.yaml` with `packages: [.]`), and pnpm 8 treats `pnpm add` there as adding to a workspace root — which it refuses. When the profile has no `packageManager` field, Node's Corepack fills one in (commonly `pnpm@8.15.7`), and the install then dies on that check **before it ever resolves this plugin**, so the failure is not about this package.

Any one of these gets you through:

1. **Installing from the plugin page (GUI)**: that path runs `pnpm add <spec>` and cannot pass `-w`, so do step 2 first (write the `.npmrc`) and then press "Retry" in the dialog — the same command then succeeds under pnpm 8.
2. Teach the profile to accept a root dependency, then install exactly as documented:

   ```bash
   echo 'ignore-workspace-root-check=true' >> ~/.dsh/profiles/gitflow-web/.npmrc
   ```

3. From the CLI, pass `-w` through (dsh forwards extra arguments to pnpm):

   ```bash
   dsh plugin --profile gitflow-web add -w https://github.com/hunan36/dsh-git-flow.git
   ```

4. Put the profile on pnpm 10 (the version this plugin is tested with): run `corepack use pnpm@10` in the profile, or set the `packageManager` field Corepack added to `pnpm@10.22.0`.

Note that after the first failure Corepack has already written `packageManager: pnpm@8.15.7+sha512…` into that profile's `package.json`, so every later plugin operation there uses pnpm 8 — step 4 is the durable fix.

Requires Node `^22.19.0 || >=24.0.0` and pnpm 10; this repository pins it with `packageManager: pnpm@10.22.0`.

## Configuration

Set in `cordis.patch.yml`:

| Key | Default | Meaning |
|---|---|---|
| `timeoutMs` | 15000 | Deadline for read-only and local git commands |
| `pushTimeoutMs` | 120000 | Deadline for `git push`, which waits on a remote |
| `messageMaxDiffBytes` | 65536 | Cap on the diff bytes handed to the model (truncated past it) |
| `messageLanguage` | `en` | Default commit-message language, `zh` or `en` |

The commit panel carries an `English | 中文` switch beside "Draft message". It overrides `messageLanguage` for that call and remembers the choice in `localStorage`, so English stays the default until you pick otherwise.

## Security boundaries

- The browser sends only a `sessionId`. The host resolves the repository from that session's workspace, so a page can never name a directory for git to run in.
- Arguments are always an array, never a shell string, with `stdin: 'ignore'` and `GIT_TERMINAL_PROMPT=0`, so a credential prompt can never hang a call.
- `push` never passes `--force` or `--force-with-lease`, and only pushes the current branch's upstream (with `--set-upstream <remote> HEAD:refs/heads/<branch>` when it has none).
- Commits stage only the files checked in the panel. An empty selection answers `git/no-files-selected` and never falls back to an implicit `git add -A`.
- Switching branches on a dirty worktree fails by default (`git/dirty-worktree`). Only the user's second confirmation in the dialog sends `--force`; nothing in the plugin discards changes silently.
- `workspaceRegistry` is read lazily through `ctx.get('workspaceRegistry')` instead of being declared in `static inject`, so a profile without one (the shipped `headless` profile) still activates this entry rather than leaving a permanently pending plugin; every git call there answers `git/not-a-repository`.
- A missing git, a non-repository workspace, a timeout, and every refusal travel as structured codes (`git/not-installed`, `git/not-a-repository`, `git/timeout`, …) that the UI renders as copy. Outside a repository — or without git — the chip renders nothing at all.

## Layout

```
src/
├── index.ts       host entry (default-exports the GitFlow service)
├── service.ts     GitFlow: status / branches / checkout / createBranch / commit / push / generateMessage
├── git.ts         GitRunner: subprocess + scrubbed env + timeout + porcelain v2 parsing
├── routes.ts      /api/dsh-git-flow/* (registered only where a webServer exists)
├── message.ts     commit message: ctx.llm.stream on the session's own provider/model, template fallback
├── contract.ts    host↔browser types only
└── client/
    ├── index.ts        slots.inject('conversation.input.left') + locale registration
    ├── BranchChip.tsx  container: status, menu, dialogs, toast
    ├── BranchMenu.tsx  the chip and its anchored menu
    ├── CommitDialog.tsx commit panel / new branch / forced-switch confirmation
    ├── api.ts          fetch wrapper + error codes to copy
    └── locales.ts      zh/en dictionaries (en is typed against zh, so a missing key is a compile error)
```

## Build

```bash
pnpm install
pnpm build       # tsc -> lib/types/**, tsdown -> lib/index.js + lib/client.js
```

**`lib/` is committed to the repository** (it is not in `.gitignore`) and the package no longer carries a `prepare` script, so installing from the git URL needs no build, no dev dependencies, and no entry in pnpm's `onlyBuiltDependencies` allowlist:

- pnpm 10.34+ blocks a git dependency's `prepare` (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`), and the allowlist entry it demands is `dsh-git-flow@<spec>#<commit sha>` — a string that goes stale on every upstream commit;
- shipping the build instead makes `dsh plugin add <spec>` take `lib/` as-is: measured at 263 ms under pnpm 10.34.5.

After editing `src/`, run **`pnpm build` and commit `lib/` along with it**, or everyone installing from git gets the previous build.

Artifact contract:

- `lib/index.js`: Node ESM, imported directly by the cordis loader.
- `lib/client.js`: a CJS factory wrapped as `window.__ModuleLoader__.load({ id: "dsh-git-flow", factory: (require) => … })`; `react`, `react/jsx-runtime`, and `@deepseek-ai/dsh-client-ui-primitives` stay external and come from the page's static module table.

## Compatibility

Developed and verified against `@deepseek-ai/dsh@0.1.6-alpha.2`, with peer and dev dependencies pinned to it. dsh is still alpha, so contracts such as `conversation.input.left`, `ctx.webServer.register`, and `ctx.slots.inject` may drift between minor versions. After upgrading dsh, rebuild and confirm the first line of `lib/client.js` is still `window.__ModuleLoader__.load({ id: "dsh-git-flow"`.

## Known limits

- An AI commit message needs one turn already sent in the session (the provider/model recorded in `request/header`). Without a route the panel answers `git/no-route` and tells you to send one message first; when the model fails or returns nothing usable, the `chore: update N files` template fills in and says so.
- Messages default to English. The panel's language switch (remembered per browser) and the `messageLanguage` config are the only two inputs; the template fallback follows the same choice.
- Remote branches appear only once `refs/remotes/**` exists locally (the plugin never fetches in the background); "Refresh status" makes no network call.
- Conflicted files cannot be checked; resolve the conflict in the conversation first.
- `git switch --force` discards **all** local changes, not just the conflicting ones — the confirmation copy says exactly that — and the plugin offers no per-file discard.
- Switching to a ref that exists nowhere fails inside git and is reported as `git/failed` with git's own text. Only stale UI state can reach that path, since the menu lists branches that exist.

## Verification (0.1.6-alpha.2)

Measured on an isolated `DSH_HOME` with profile `gitflow-web` (`dsh-git-flow` appended to `dsh.profile.bundles`): the chip text equals `git branch --show-current`; the menu lists every local branch plus each remote-only one; search filters rows; switching moves both the chip and the worktree files; a dirty switch is refused and only confirms `--force` after a second dialog; an invalid branch name errors while a valid one is created and switched to; with a single file checked, the model returned a `feat: …` message and `git log -1 --name-only` showed only that file; commit-and-push made the branch appear in `git ls-remote` with its upstream set; a session whose workspace is not a repository renders no chip; the `headless` profile boots with no warning and no routes.
