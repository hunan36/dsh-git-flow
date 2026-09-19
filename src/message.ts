/**
 * AI commit messages: one auxiliary model call over the selected diff, riding
 * the route the session's own conversation already used (the same way session
 * titles are produced), with a template fallback so the panel never blocks.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { GitFileView, GitMessageView } from './contract.ts'
import { GitError } from './git.ts'
import type { FinishReason, MessageId, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'

/** Everything the prompt needs, already gathered by the service. */
export interface CommitMessageInput {
  ctx: Context
  /** Live session for this request id; its logged header supplies the route. */
  session: Session | undefined
  language: 'zh' | 'en'
  head: string
  selected: readonly string[]
  files: readonly GitFileView[]
  diff: string
  truncated: boolean
}

/** Bound on the auxiliary call itself, independent of git timeouts. */
const MESSAGE_TIMEOUT_MS = 60000
/** Commit messages longer than this are treated as the model rambling. */
const MAX_MESSAGE_CHARS = 2000

const SYSTEM = {
  zh: [
    '你在为一次 git 提交写提交信息。',
    '只输出提交信息本身：不要 markdown 代码块、不要引号、不要解释、不要提问。',
    '第一行必须是 conventional commit 标题：`<type>: <一句话描述>`，可在 type 后加 `(scope)`。',
    'type 只能取 feat fix refactor perf docs style test build chore revert。',
    '标题不超过 72 个字符，用祈使句，结尾不加句号。',
    '空一行后用一到三条 `- ` 要点说明改动动机与影响。',
    '标题与正文都用简体中文，即使 diff、文件名或分支名是英文；type 前缀、文件路径、标识符、API 名保持原文。',
  ].join('\n'),
  en: [
    'You are writing a git commit message.',
    'Output only the message: no markdown fences, no quotes, no explanation, no questions.',
    'The first line must be a conventional commit subject: `<type>: <summary>`, optionally `<type>(scope): <summary>`.',
    'type must be one of feat fix refactor perf docs style test build chore revert.',
    'Keep the subject at or below 72 characters, imperative mood, no trailing period.',
    'After a blank line add one to three `- ` bullets covering motivation and impact.',
    'Write both the subject and the body in English, even when the diff, file names, or branch name are not English; keep file paths, identifiers, and API names verbatim.',
  ].join('\n'),
}

/**
 * Produce one commit message for the selection.
 * @throws {GitError} `git/no-route` when the session has no logged model route.
 * @returns the message plus whether the template fallback had to be used.
 */
export async function generateCommitMessage(input: CommitMessageInput): Promise<GitMessageView> {
  const config = input.session?.requestHeader()?.config
  if (config === undefined) {
    throw new GitError('git/no-route', 'this session has no recorded model route yet; send one message in the conversation first')
  }
  const fallback = fallbackMessage(input)
  let raw = ''
  try {
    raw = await streamMessage(input, config.provider, config.model)
  } catch (error) {
    input.ctx.logger.warn(`dsh-git-flow: message model failed, using template: ${String(error)}`)
    return { message: fallback, fallback: true, route: `${config.provider}/${config.model}` }
  }
  const message = normalize(raw)
  if (message === undefined) return { message: fallback, fallback: true, route: `${config.provider}/${config.model}` }
  return { message, fallback: false, route: `${config.provider}/${config.model}` }
}

/** One model call, returning its concatenated text blocks. */
async function streamMessage(input: CommitMessageInput, provider: string, model: string): Promise<string> {
  const signal = AbortSignal.timeout(MESSAGE_TIMEOUT_MS)
  const assembler = new TextAssembly()
  for await (const chunk of input.ctx.llm.stream({
    provider,
    model,
    system: SYSTEM[input.language],
    messages: [{
      id: `dsh-git-flow:commit-message` as unknown as MessageId,
      role: 'user',
      content: [{ type: 'text', text: buildUserPrompt(input) }],
      source: { kind: 'plugin', plugin: 'dsh-git-flow' },
    }],
    maxTokens: 512,
    temperature: 0.2,
    sessionId: input.session?.id,
    signal,
  })) {
    if (signal.aborted) break
    assembler.push(chunk)
  }
  if (assembler.toolCall) throw new Error('message model requested a tool')
  const reason = assembler.finishReason?.kind
  if (reason !== undefined && reason !== 'stop') {
    input.ctx.logger.warn(`dsh-git-flow: message stream finished with ${reason}`)
  }
  return assembler.text
}

/** Render the diff packet handed to the model. */
function buildUserPrompt(input: CommitMessageInput): string {
  const rows = input.files
    .filter((file) => input.selected.includes(file.path) || (file.oldPath !== undefined && input.selected.includes(file.oldPath)))
    .map((file) => {
      const state = file.conflicted ? 'U' : file.untracked ? '?' : `${file.indexStatus}${file.worktreeStatus}`
      const path = file.oldPath === undefined ? file.path : `${file.oldPath} -> ${file.path}`
      return `- [${state}] ${path}`
    })
  return [
    `branch: ${input.head}`,
    `files (${input.selected.length}):`,
    ...rows,
    '',
    input.truncated ? 'diff (truncated):' : 'diff:',
    input.diff || '(no textual diff; the change is a rename, mode, or deletion only)',
  ].join('\n')
}

/** Template used when no model answer is usable. */
function fallbackMessage(input: CommitMessageInput): string {
  const count = input.selected.length
  const summary = input.language === 'zh'
    ? `chore: 更新 ${count} 个文件`
    : `chore: update ${count} ${count === 1 ? 'file' : 'files'}`
  const listed = input.selected.slice(0, 6).map((path) => `- ${path}`).join('\n')
  const rest = input.selected.length > 6 ? `\n- …${input.selected.length - 6} more` : ''
  return `${summary}\n\n${listed}${rest}`
}

/** Strip fences and prose wrappers, then require a conventional subject. */
function normalize(raw: string): string | undefined {
  const text = raw
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (text.length === 0 || text.length > MAX_MESSAGE_CHARS) return undefined
  const lines = text.split('\n').map((line) => line.trimEnd())
  const subject = (lines[0] ?? '').replace(/^[-*]\s+/, '')
  if (!/^(feat|fix|refactor|perf|docs|style|test|build|chore|revert)(\([^)]{1,32}\))?!?:\s*\S/.test(subject)) return undefined
  const body = lines.slice(1).join('\n').trim()
  const message = body.length > 0 ? `${subject}\n\n${body}` : subject
  return message.length > MAX_MESSAGE_CHARS ? message.slice(0, MAX_MESSAGE_CHARS) : message
}

/** Minimal fold over a chunk stream: text deltas, tool requests, finish reason. */
class TextAssembly {
  text = ''
  toolCall = false
  finishReason: FinishReason | undefined

  push(chunk: StreamChunk): void {
    if (chunk.type === 'text-delta') this.text += chunk.text
    else if (chunk.type === 'block-start' && chunk.blockType === 'tool-call') this.toolCall = true
    else if (chunk.type === 'finish') this.finishReason = chunk.reason
  }
}
