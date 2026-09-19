# dsh-git-flow

DeepSeek Harness 工作区 Git 插件：在输入框工具行放一个分支胶囊，点开能看分支、切分支、新建分支，并在面板里勾选文件提交 —— 提交信息由当前会话的模型根据改动自动生成。

```
输入框工具行:  [⑂ feature/login  3]  ← 点击
                 ├ 搜索分支
                 ├ 本地分支 · 2      ✓ feature/login
                 │                   main
                 ├ 新建分支…
                 ├ 提交…                （有改动时可用）
                 └ 刷新状态
```

## 安装

```bash
# 1. 克隆并构建（lib/ 是构建产物，不进仓库）
git clone https://github.com/hunan36/dsh-git-flow.git
cd dsh-git-flow && pnpm install && pnpm build

# 2. 用一个独立 profile，别动现有 web profile
dsh --profile gitflow-web --from-default-profile web

# 3. 装本插件（本地绝对路径）
dsh plugin --profile gitflow-web add "$PWD"

# 4. 插件页「立即启用」，或直接在 profile 的 package.json 里加 bundle
#    dsh.profile.bundles += "dsh-git-flow"
#    由于本包声明了 dsh.bundle.patch，启用后它的 cordis.patch.yml 会自动挂载 GitFlow 服务

# 5. 起服务
dsh --profile gitflow-web
```

headless profile 也能装，但没有 `webServer`，`/api/dsh-git-flow/*` 不会注册，浏览器半也不存在 —— 不会报错。

## 配置

`cordis.patch.yml` 里可改：

| 键 | 默认 | 说明 |
|---|---|---|
| `timeoutMs` | 15000 | 只读/本地 git 命令超时 |
| `pushTimeoutMs` | 120000 | `git push` 超时（等远端） |
| `messageMaxDiffBytes` | 65536 | 喂给模型的 diff 字节上限，超出截断 |
| `messageLanguage` | `zh` | 提交信息语言，`zh` / `en` |

## 安全边界

- 浏览器只发 `sessionId`，仓库目录由宿主从会话的工作区解析，页面无法指定任意路径执行 git。
- 参数永远是数组，从不拼 shell 字符串；`stdin: 'ignore'`，`GIT_TERMINAL_PROMPT=0`，不会卡在凭据提示上。
- `push` 永不带 `--force` / `--force-with-lease`，只推当前分支的上游（无上游时 `--set-upstream <remote> HEAD:refs/heads/<branch>`）。
- `workspaceRegistry` 用 `ctx.get('workspaceRegistry')` 惰性读取，而不是写进 `static inject`：headless 之类的 profile 没有它，
  插件仍然激活（不会留下 "entry did not activate" 警告），此时任何 git 调用返回 `git/not-a-repository`。
- 提交只 `git add` 面板里勾选的文件；一个都没勾返回 `git/no-files-selected`，绝不隐式 `git add -A`。
- 脏工作区切分支默认失败（`git/dirty-worktree`），只有用户在二次确认框里点「强制切换」才带 `--force`；插件不提供丢弃改动的入口。
- 非 `dsh web`、没有 git、不是仓库、超时都走结构化错误码（`git/not-installed` / `git/not-a-repository` / `git/timeout` / …），UI 显示对应文案；非仓库/无 git 时胶囊直接不渲染。

## 结构

```
src/
├── index.ts       宿主半入口（默认导出 GitFlow 服务）
├── service.ts     GitFlow：status / branches / checkout / createBranch / commit / push / generateMessage
├── git.ts         GitRunner：subprocess + 净化 env + 超时 + porcelain v2 解析
├── routes.ts      /api/dsh-git-flow/*（仅挂载在有 webServer 的 profile）
├── message.ts     提交信息：ctx.llm.stream 走会话自己的 provider/model，失败退模板
├── contract.ts    宿主↔浏览器共享的纯类型
└── client/
    ├── index.ts       slots.inject('conversation.input.left') + locale 注册
    ├── BranchChip.tsx 状态、菜单、弹窗、toast 的容器
    ├── BranchMenu.tsx 分支胶囊 + 锚定菜单
    ├── CommitDialog.tsx 提交面板 / 新建分支 / 强制切换确认
    ├── api.ts         fetch 包装 + 错误码到文案
    └── locales.ts     zh/en 字典（en 按 zh 收窄，缺键即编译错误）
```

## 构建

```bash
pnpm install
pnpm build      # tsc -> lib/types/**，tsdown -> lib/index.js + lib/client.js
```

产物契约：

- `lib/index.js`：Node ESM，被 cordis loader 直接 import。
- `lib/client.js`：CJS 工厂包成 `window.__ModuleLoader__.load({ id: "dsh-git-flow", factory: (require) => … })`；
  `react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives` 保持 external，由页面静态模块表提供。

## 兼容性

针对 `@deepseek-ai/dsh@0.1.6-alpha.2` 实测开发，peer/devDependencies 锁在该版本。dsh 尚在 alpha，
`conversation.input.left`、`ctx.webServer.register`、`ctx.slots.inject` 等契约可能在小版本间漂移；
升级 dsh 后请重跑构建并确认 `lib/client.js` 首行仍是 `window.__ModuleLoader__.load({ id: "dsh-git-flow"`。

## 已知边界

- AI 提交信息要求会话已经有过一轮对话（`request/header` 里记了 provider/model）。没有路由时返回 `git/no-route`，面板提示先发一轮消息；模型失败或输出不合规时用 `chore: 更新 N 个文件` 模板兜底，且会明确告知。
- 远端分支只在本地已有 `refs/remotes/**` 时才可见（插件不做后台 fetch）；「刷新状态」不触发网络。
- 冲突文件不可勾选，需要先在对话里解决冲突。
- `git switch --force` 会丢弃**全部**本地改动（不只是冲突的那些），确认框里的文案就是这么写的；插件不提供单独丢弃某个改动的入口。
- 切到一个不存在且无同名远端的引用时，git 自己会失败，条目按 `git/failed` 上报 git 原文（这种情况只能来自过期的 UI 状态，正常菜单里列的都是真实存在的分支）。

## 验证记录（0.1.6-alpha.2）

独立 `DSH_HOME` + profile `gitflow-web`（bundles 追加 `dsh-git-flow`）实测：胶囊文本 == `git branch --show-current`；
弹层行数 == 本地分支 + 仅在远端；搜索过滤；切分支后胶囊与工作区文件同步；脏工作区切换被拦下并弹二次确认（`--force` 才丢弃改动）；
非法分支名报错、合法名创建并切换；勾选单个文件生成 AI 信息（`feat: …`）并只提交该文件（`git log -1 --name-only` 验证）；
提交并推送后 `git ls-remote` 出现该分支且建立 upstream；非 git 工作区会话里胶囊不渲染；`headless` profile 启动无警告、无路由。

