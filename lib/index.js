import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
//#region src/git.ts
/** A git operation that cannot be represented as a normal exit code. */
var GitError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "GitError";
	}
};
/** Cap on collected stdout, in bytes. */
const MAX_STDOUT_BYTES = 4194304;
/** Cap on collected stderr, in bytes. */
const MAX_STDERR_BYTES = 65536;
/**
* Run git without a shell and without ambient credentials leaking in.
* One instance per service; the executable is resolved lazily and cached.
*/
var GitRunner = class {
	subprocess;
	timeoutMs;
	executable;
	constructor(subprocess, timeoutMs) {
		this.subprocess = subprocess;
		this.timeoutMs = timeoutMs;
	}
	program() {
		this.executable ??= this.subprocess.resolveExecutable("git").catch((error) => {
			throw new GitError("git/not-installed", `git executable is unavailable: ${String(error)}`);
		});
		return this.executable;
	}
	/**
	* @param cwd - directory the command runs in.
	* @param args - git subcommand and flags; never interpolated into a shell.
	* @returns exit code and collected streams; a non-zero exit is a result.
	* @throws {GitError} when git is missing, the run times out, or spawn fails.
	*/
	async run(cwd, args) {
		const program = await this.program();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("git command timed out")), this.timeoutMs);
		try {
			const handle = this.subprocess.spawn({
				argv: [program, ...args],
				cwd,
				stdio: {
					stdin: "ignore",
					stdout: { maxBytes: MAX_STDOUT_BYTES },
					stderr: { maxBytes: MAX_STDERR_BYTES }
				},
				graceMs: 2e3,
				signal: controller.signal,
				env: {
					GIT_TERMINAL_PROMPT: "0",
					LC_ALL: "C",
					LANG: "C"
				}
			});
			let exitCode;
			try {
				exitCode = (await handle.done).exitCode ?? -1;
			} catch (error) {
				if (controller.signal.aborted) throw timeoutError(args);
				throw new GitError("git/failed", `failed to run git ${args.join(" ")}: ${String(error)}`);
			}
			if (controller.signal.aborted) throw timeoutError(args);
			return {
				exitCode,
				stdout: handle.collected.stdout?.readFrom(0).text ?? "",
				stderr: handle.collected.stderr?.readFrom(0).text ?? ""
			};
		} finally {
			clearTimeout(timer);
		}
	}
	/** Run git and treat a non-zero exit as a `git/failed` error. */
	async runOk(cwd, args) {
		const result = await this.run(cwd, args);
		if (result.exitCode !== 0) throw new GitError("git/failed", describeFailure(args, result));
		return result;
	}
};
function timeoutError(args) {
	return new GitError("git/timeout", `git ${args.join(" ")} timed out`);
}
/** Trim git's stderr into one line suitable for a UI detail message. */
function describeFailure(args, result) {
	const detail = (result.stderr || result.stdout).replace(/\s+/g, " ").trim();
	return `git ${args.join(" ")} failed (${result.exitCode}): ${detail || "no output"}`;
}
/**
* Parse `git status --porcelain=v2 --branch`.
* @param stdout - raw porcelain output.
* @returns branch facts and one entry per changed path.
*/
function parseStatus(stdout) {
	const status = {
		head: "(unknown)",
		oid: "",
		ahead: 0,
		behind: 0,
		files: []
	};
	for (const line of stdout.split("\n")) {
		if (!line) continue;
		if (line.startsWith("# branch.oid ")) status.oid = line.slice(13).trim();
		else if (line.startsWith("# branch.head ")) status.head = line.slice(14).trim();
		else if (line.startsWith("# branch.upstream ")) status.upstream = line.slice(18).trim();
		else if (line.startsWith("# branch.ab ")) {
			for (const field of line.slice(12).trim().split(/\s+/)) if (field.startsWith("+")) status.ahead = Number(field.slice(1)) || 0;
			else if (field.startsWith("-")) status.behind = Number(field.slice(1)) || 0;
		} else if (line.startsWith("? ")) status.files.push({
			path: line.slice(2),
			indexStatus: "?",
			worktreeStatus: "?",
			staged: false,
			untracked: true,
			conflicted: false
		});
		else if (line.startsWith("u ")) {
			const fields = line.split(" ");
			const path = (fields.slice(11).join(" ") || line).split("	")[0];
			status.files.push({
				path,
				indexStatus: fields[1][0],
				worktreeStatus: fields[1][1],
				staged: false,
				untracked: false,
				conflicted: true
			});
		} else if (line.startsWith("1 ") || line.startsWith("2 ")) {
			const fields = line.split(" ");
			const xy = fields[1] ?? "..";
			const tail = fields.slice(line[0] === "2" ? 9 : 8).join(" ");
			const [path, oldPath] = line[0] === "2" ? tail.split("	") : [tail, void 0];
			status.files.push({
				path,
				oldPath,
				indexStatus: xy[0],
				worktreeStatus: xy[1],
				staged: xy[0] !== ".",
				untracked: false,
				conflicted: false
			});
		}
	}
	return status;
}
//#endregion
//#region src/message.ts
/** Bound on the auxiliary call itself, independent of git timeouts. */
const MESSAGE_TIMEOUT_MS = 6e4;
/**
* Output budget for the auxiliary call. A reasoning model counts its thinking
* against this, and with a wide selection (many files, a truncated diff) the
* thinking alone can exhaust a small budget: the stream then ends with no text
* at all and the answer is unusable. 4096 leaves room for both.
*/
const MESSAGE_MAX_TOKENS = 4096;
/** Commit messages longer than this are treated as the model rambling. */
const MAX_MESSAGE_CHARS = 2e3;
const SYSTEM = {
	zh: [
		"你在为一次 git 提交写提交信息。",
		"只输出提交信息本身：不要 markdown 代码块、不要引号、不要解释、不要提问。",
		"第一行必须是 conventional commit 标题：`<type>: <一句话描述>`，可在 type 后加 `(scope)`。",
		"type 只能取 feat fix refactor perf docs style test build chore revert。",
		"标题不超过 72 个字符，用祈使句，结尾不加句号。",
		"空一行后用一到三条 `- ` 要点说明改动动机与影响。",
		"标题与正文都用简体中文，即使 diff、文件名或分支名是英文；type 前缀、文件路径、标识符、API 名保持原文。"
	].join("\n"),
	en: [
		"You are writing a git commit message.",
		"Output only the message: no markdown fences, no quotes, no explanation, no questions.",
		"The first line must be a conventional commit subject: `<type>: <summary>`, optionally `<type>(scope): <summary>`.",
		"type must be one of feat fix refactor perf docs style test build chore revert.",
		"Keep the subject at or below 72 characters, imperative mood, no trailing period.",
		"After a blank line add one to three `- ` bullets covering motivation and impact.",
		"Write both the subject and the body in English, even when the diff, file names, or branch name are not English; keep file paths, identifiers, and API names verbatim."
	].join("\n")
};
/**
* Produce one commit message for the selection.
* @throws {GitError} `git/no-route` when the session has no logged model route.
* @returns the message plus whether the template fallback had to be used, and
* why it was, so the panel can report a broken route instead of a vague notice.
*/
async function generateCommitMessage(input) {
	const config = input.session?.requestHeader()?.config;
	if (config === void 0) throw new GitError("git/no-route", "this session has no recorded model route yet; send one message in the conversation first");
	const route = `${config.provider}/${config.model}`;
	const fallback = fallbackMessage(input);
	let raw = "";
	try {
		raw = await streamMessage(input, config.provider, config.model);
	} catch (error) {
		input.ctx.logger.warn(`dsh-git-flow: message model failed, using template: ${String(error)}`);
		return {
			message: fallback,
			fallback: true,
			reason: describeModelFailure(error),
			language: input.language,
			route
		};
	}
	const message = normalize(raw);
	if (message === void 0) {
		input.ctx.logger.warn(`dsh-git-flow: message model answer rejected, using template: ${JSON.stringify(raw.slice(0, 200))}`);
		return {
			message: fallback,
			fallback: true,
			reason: raw.trim().length === 0 ? "the model returned no text (its output budget may have gone to reasoning)" : "the model answer was not a conventional commit message",
			language: input.language,
			route
		};
	}
	return {
		message,
		fallback: false,
		language: input.language,
		route
	};
}
/** One line of failure text for the panel, without a stack or multi-line dump. */
function describeModelFailure(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").trim().slice(0, 300) || "unknown model failure";
}
/** One model call, returning its concatenated text blocks. */
async function streamMessage(input, provider, model) {
	const signal = AbortSignal.timeout(MESSAGE_TIMEOUT_MS);
	const assembler = new TextAssembly();
	for await (const chunk of input.ctx.llm.stream({
		provider,
		model,
		system: SYSTEM[input.language],
		messages: [{
			id: `dsh-git-flow:commit-message`,
			role: "user",
			content: [{
				type: "text",
				text: buildUserPrompt(input)
			}],
			source: {
				kind: "plugin",
				plugin: "dsh-git-flow"
			}
		}],
		maxTokens: MESSAGE_MAX_TOKENS,
		temperature: .2,
		sessionId: input.session?.id,
		signal
	})) {
		if (signal.aborted) break;
		assembler.push(chunk);
	}
	if (assembler.toolCall) throw new Error("message model requested a tool");
	const reason = assembler.finishReason?.kind;
	if (reason !== void 0 && reason !== "stop") input.ctx.logger.warn(`dsh-git-flow: message stream finished with ${reason}`);
	return assembler.text;
}
/** Render the diff packet handed to the model. */
function buildUserPrompt(input) {
	const rows = input.files.filter((file) => input.selected.includes(file.path) || file.oldPath !== void 0 && input.selected.includes(file.oldPath)).map((file) => {
		return `- [${file.conflicted ? "U" : file.untracked ? "?" : `${file.indexStatus}${file.worktreeStatus}`}] ${file.oldPath === void 0 ? file.path : `${file.oldPath} -> ${file.path}`}`;
	});
	return [
		`branch: ${input.head}`,
		`files (${input.selected.length}):`,
		...rows,
		"",
		input.truncated ? "diff (truncated):" : "diff:",
		input.diff || "(no textual diff; the change is a rename, mode, or deletion only)"
	].join("\n");
}
/** Template used when no model answer is usable. */
function fallbackMessage(input) {
	const count = input.selected.length;
	return `${input.language === "zh" ? `chore: 更新 ${count} 个文件` : `chore: update ${count} ${count === 1 ? "file" : "files"}`}\n\n${input.selected.slice(0, 6).map((path) => `- ${path}`).join("\n")}${input.selected.length > 6 ? `\n- …${input.selected.length - 6} more` : ""}`;
}
/** Strip fences and prose wrappers, then require a conventional subject. */
function normalize(raw) {
	const text = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
	if (text.length === 0 || text.length > MAX_MESSAGE_CHARS) return void 0;
	const lines = text.split("\n").map((line) => line.trimEnd());
	const subject = (lines[0] ?? "").replace(/^[-*]\s+/, "");
	if (!/^(feat|fix|refactor|perf|docs|style|test|build|chore|revert)(\([^)]{1,32}\))?!?:\s*\S/.test(subject)) return void 0;
	const body = lines.slice(1).join("\n").trim();
	const message = body.length > 0 ? `${subject}\n\n${body}` : subject;
	return message.length > MAX_MESSAGE_CHARS ? message.slice(0, MAX_MESSAGE_CHARS) : message;
}
/** Minimal fold over a chunk stream: text deltas, tool requests, finish reason. */
var TextAssembly = class {
	text = "";
	toolCall = false;
	finishReason;
	push(chunk) {
		if (chunk.type === "text-delta") this.text += chunk.text;
		else if (chunk.type === "block-start" && chunk.blockType === "tool-call") this.toolCall = true;
		else if (chunk.type === "finish") this.finishReason = chunk.reason;
	}
};
//#endregion
//#region src/routes.ts
const BASE = "/api/dsh-git-flow";
/** Commit panels send path lists, not content; anything larger is a client bug. */
const MAX_BODY_BYTES = 262144;
/**
* Register every route on the mounted context.
* @param ctx - context that already sees `webServer`.
* @param service - the git surface to expose.
* @returns a disposer removing all routes.
*/
function registerGitFlowRoutes(ctx, service) {
	const routes = [
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/status`,
			handler: (req, res) => handle(req, res, () => {
				requireMethod(req, "GET");
				return service.status(sessionIdFromQuery(req));
			})
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/branches`,
			handler: (req, res) => handle(req, res, () => {
				requireMethod(req, "GET");
				return service.branches(sessionIdFromQuery(req));
			})
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/checkout`,
			handler: (req, res) => handle(req, res, async (body) => {
				requireMethod(req, "POST");
				const { sessionId, name, force } = readBody(body);
				if (typeof name !== "string") throw new GitError("git/invalid-input", "name is required");
				return service.checkout(sessionId, name, force === true);
			})
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/branch`,
			handler: (req, res) => handle(req, res, async (body) => {
				requireMethod(req, "POST");
				const { sessionId, name, base } = readBody(body);
				if (typeof name !== "string") throw new GitError("git/invalid-input", "name is required");
				if (base !== void 0 && typeof base !== "string") throw new GitError("git/invalid-input", "base must be a string");
				return service.createBranch(sessionId, name, base);
			})
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/commit`,
			handler: (req, res) => handle(req, res, async (body) => {
				requireMethod(req, "POST");
				const { sessionId, files, message, push } = readBody(body);
				return service.commit(sessionId, stringArray(files, "files"), requireString(message, "message"), push === true);
			})
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/push`,
			handler: (req, res) => handle(req, res, async (body) => {
				requireMethod(req, "POST");
				const { sessionId } = readBody(body);
				return {
					pushed: true,
					pushNote: await service.push(sessionId)
				};
			})
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/generate-message`,
			handler: (req, res) => handle(req, res, async (body) => {
				requireMethod(req, "POST");
				const { sessionId, files, language } = readBody(body);
				if (language !== void 0 && language !== "zh" && language !== "en") throw new GitError("git/invalid-input", "language must be \"zh\" or \"en\"");
				return service.generateMessage(sessionId, stringArray(files, "files"), language);
			})
		})
	];
	return () => {
		for (const remove of routes.reverse()) remove();
	};
}
/** Run one handler, translating thrown values into the shared envelope. */
async function handle(req, res, work) {
	try {
		json(res, 200, {
			ok: true,
			data: await work(req.method === "GET" || req.method === "HEAD" ? {} : await readJson(req))
		});
	} catch (error) {
		const code = error instanceof GitError ? error.code : error instanceof MethodError ? "git/invalid-input" : "git/failed";
		json(res, statusFor(code), {
			ok: false,
			code,
			message: error instanceof Error ? error.message : String(error)
		});
	}
}
/** A wrong HTTP verb is a client bug, reported as an invalid request. */
var MethodError = class extends Error {};
function requireMethod(req, method) {
	if (req.method === method) return;
	throw new MethodError(`expected a ${method} request, got ${req.method ?? "unknown"}`);
}
function statusFor(code) {
	if (code === "git/invalid-input" || code === "git/no-files-selected" || code === "git/detached-head" || code === "git/dirty-worktree") return 400;
	if (code === "git/not-a-repository" || code === "git/not-installed" || code === "git/no-route") return 404;
	if (code === "git/timeout") return 504;
	return 500;
}
function json(res, status, payload) {
	const text = JSON.stringify(payload);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(text),
		"cache-control": "no-store"
	});
	res.end(text);
}
/** Read and parse a bounded JSON body. */
async function readJson(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > MAX_BODY_BYTES) throw new GitError("git/invalid-input", "request body is too large");
		chunks.push(buffer);
	}
	if (size === 0) return {};
	const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new GitError("git/invalid-input", "expected a JSON object body");
	return parsed;
}
function readBody(body) {
	return {
		...body,
		sessionId: requireString(body.sessionId, "sessionId")
	};
}
function requireString(value, field) {
	if (typeof value !== "string" || value.length === 0) throw new GitError("git/invalid-input", `${field} must be a non-empty string`);
	return value;
}
function stringArray(value, field) {
	if (!Array.isArray(value)) throw new GitError("git/invalid-input", `${field} must be an array of paths`);
	return value.map((item) => requireString(item, field));
}
function sessionIdFromQuery(req) {
	return requireString(new URL(req.url ?? "/", "http://dsh.invalid").searchParams.get("sessionId"), "sessionId");
}
//#endregion
//#region src/service.ts
/**
* `ctx.gitFlow` — the workspace git surface behind `/api/dsh-git-flow/*`.
* Every operation is keyed by session id: the repository directory is resolved
* by the host from the session's workspace, so the browser can never name a
* path for git to run in.
*/
/**
* Branch switching, panel-scoped commits, pushes, and AI commit messages for
* the session's workspace.
*/
var GitFlow = class extends Service {
	/**
	* `workspaceRegistry` is read through `ctx.get` rather than declared here: a
	* profile without one (the shipped `headless` profile) must still activate
	* this entry instead of reporting a permanently pending plugin. Every git
	* call in such a profile answers `git/not-a-repository`, since no session can
	* resolve a repository.
	*/
	static inject = [
		"subprocess",
		"sessions",
		"llm"
	];
	static Config = z.object({
		timeoutMs: z.number().default(15e3),
		pushTimeoutMs: z.number().default(12e4),
		messageMaxDiffBytes: z.number().default(65536),
		messageLanguage: z.union([z.const("zh"), z.const("en")]).default("en")
	});
	config;
	git;
	/** Push timeouts outlive the default runner deadline, so the runner is per-call-site. */
	pushGit;
	constructor(ctx, config = {}) {
		super(ctx, "gitFlow");
		this.config = {
			timeoutMs: config.timeoutMs ?? 15e3,
			pushTimeoutMs: config.pushTimeoutMs ?? 12e4,
			messageMaxDiffBytes: config.messageMaxDiffBytes ?? 65536,
			messageLanguage: config.messageLanguage ?? "en"
		};
		this.git = new GitRunner(ctx.subprocess, this.config.timeoutMs);
		this.pushGit = new GitRunner(ctx.subprocess, this.config.pushTimeoutMs);
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => registerGitFlowRoutes(webCtx, this), "dsh-git-flow: api routes");
		});
	}
	/**
	* @param sessionId - session whose workspace backs the repository.
	* @returns branch, ahead/behind, and one row per changed path.
	*/
	async status(sessionId) {
		const repo = await this.resolveRepo(sessionId);
		const parsed = parseStatus((await this.git.runOk(repo, [
			"status",
			"--porcelain=v2",
			"--branch"
		])).stdout);
		const files = dedupeFiles(parsed.files);
		return {
			repo,
			head: parsed.head,
			detached: parsed.head === "(detached)",
			upstream: parsed.upstream,
			ahead: parsed.ahead,
			behind: parsed.behind,
			dirty: files.length > 0,
			files
		};
	}
	/**
	* @param sessionId - session whose workspace backs the repository.
	* @returns local and remote-tracking branch rows, current one flagged.
	*/
	async branches(sessionId) {
		const status = await this.status(sessionId);
		const repo = status.repo;
		const rows = (await this.git.runOk(repo, [
			"for-each-ref",
			`--format=%(refname)%09%(refname:short)%09%(upstream:short)`,
			"refs/heads",
			"refs/remotes"
		])).stdout.split("\n").filter((line) => line.includes("	")).map((line) => {
			const [full, name, upstream] = line.split("	");
			return {
				full,
				name,
				upstream
			};
		});
		const localNames = new Set(rows.filter((row) => row.full.startsWith("refs/heads/")).map((row) => row.name));
		const local = rows.filter((row) => row.full.startsWith("refs/heads/")).map((row) => ({
			name: row.name,
			current: row.name === status.head,
			upstream: row.upstream || void 0,
			remoteOnly: false
		}));
		for (const row of rows) {
			if (!row.full.startsWith("refs/remotes/")) continue;
			const withoutHead = stripRemoteHead(row.name);
			if (withoutHead === void 0 || localNames.has(shortRemoteName(withoutHead))) continue;
			local.push({
				name: withoutHead,
				current: false,
				upstream: withoutHead,
				remoteOnly: true
			});
		}
		local.sort((a, b) => a.name.localeCompare(b.name));
		const remote = rows.filter((row) => row.full.startsWith("refs/remotes/")).map((row) => stripRemoteHead(row.name)).filter((name) => name !== void 0);
		return {
			head: status.head,
			local,
			remote
		};
	}
	/**
	* Switch branches, optionally creating a local branch for a unique remote one.
	* @param sessionId - session whose workspace backs the repository.
	* @param name - branch to check out.
	* @param force - discard conflicting worktree changes; never used silently.
	*/
	async checkout(sessionId, name, force = false) {
		const repo = await this.resolveRepo(sessionId);
		assertBranchName(name);
		const args = ["switch"];
		if (force) args.push("--force");
		if (await this.hasLocalBranch(repo, name)) args.push(name);
		else {
			const remotes = await this.remoteBranches(repo, name);
			if (remotes.length > 1) throw new GitError("git/invalid-input", `branch ${name} exists on multiple remotes: ${remotes.join(", ")}`);
			if (remotes.length === 1) args.push("-c", name, "--track", remotes[0]);
			else args.push(name);
		}
		await this.runSwitch(repo, args);
		return this.status(sessionId);
	}
	/**
	* Create one branch from `base` (default: current HEAD) and switch to it.
	* @param sessionId - session whose workspace backs the repository.
	* @param name - new branch name.
	* @param base - existing ref to start from.
	*/
	async createBranch(sessionId, name, base) {
		const repo = await this.resolveRepo(sessionId);
		assertBranchName(name);
		if (await this.hasLocalBranch(repo, name)) throw new GitError("git/invalid-input", `branch ${name} already exists`);
		if (base !== void 0 && base.length > 0) {
			assertBranchName(base);
			if ((await this.git.run(repo, [
				"rev-parse",
				"--verify",
				"--quiet",
				`${base}^{commit}`
			])).exitCode !== 0) throw new GitError("git/invalid-input", `base ${base} does not exist`);
		}
		const args = [
			"switch",
			"-c",
			name
		];
		if (base !== void 0 && base.length > 0) args.push(base);
		await this.runSwitch(repo, args);
		return this.status(sessionId);
	}
	/**
	* Stage exactly the selected paths, commit them, and optionally push.
	* @param sessionId - session whose workspace backs the repository.
	* @param files - paths as reported by {@link status}; anything else is rejected.
	* @param message - commit message text.
	* @param push - push the resulting commit to the branch upstream.
	*/
	async commit(sessionId, files, message, push = false) {
		const status = await this.status(sessionId);
		if (status.detached) throw new GitError("git/detached-head", "committing on a detached HEAD needs an explicit branch");
		if (message.trim().length === 0) throw new GitError("git/invalid-input", "a commit message is required");
		const selected = selectPaths(status.files, files);
		const args = [
			"add",
			"-A",
			"--",
			...selected
		];
		await this.git.runOk(status.repo, args);
		const result = await this.git.runOk(status.repo, [
			"commit",
			"--only",
			"-m",
			message,
			"--",
			...selected
		]);
		const hash = (await this.git.runOk(status.repo, ["rev-parse", "HEAD"])).stdout.trim();
		const view = {
			hash,
			shortHash: hash.slice(0, 7),
			branch: status.head,
			files: selected.length,
			pushed: false,
			pushNote: trimOutput(result.stdout)
		};
		if (push) {
			const pushed = await this.push(sessionId);
			view.pushed = true;
			view.pushNote = pushed;
		}
		return view;
	}
	/**
	* Push the current branch to its upstream. Never force, and never to a
	* caller-supplied remote or refspec.
	* @param sessionId - session whose workspace backs the repository.
	* @returns git's push summary.
	*/
	async push(sessionId) {
		const status = await this.status(sessionId);
		if (status.detached) throw new GitError("git/detached-head", "there is no branch to push");
		if (status.upstream) {
			const result = await this.pushGit.runOk(status.repo, ["push"]);
			return trimOutput(`${result.stdout}\n${result.stderr}`);
		}
		const remote = (await this.git.run(status.repo, [
			"config",
			"--get",
			`branch.${status.head}.remote`
		])).stdout.trim() || "origin";
		const result = await this.pushGit.runOk(status.repo, [
			"push",
			"--set-upstream",
			remote,
			`HEAD:refs/heads/${status.head}`
		]);
		return trimOutput(`${result.stdout}\n${result.stderr}`);
	}
	/**
	* Ask the session's own model route for a commit message over the selected diff.
	* @param sessionId - session whose workspace and route back the call.
	* @param files - paths as reported by {@link status}.
	* @param language - per-call override for the configured message language.
	*/
	async generateMessage(sessionId, files, language) {
		const status = await this.status(sessionId);
		const selected = selectPaths(status.files, files);
		const diff = await this.collectDiff(status.repo, selected);
		const session = liveSession(this.ctx, sessionId);
		return generateCommitMessage({
			ctx: this.ctx,
			session,
			language: language ?? this.config.messageLanguage,
			head: status.head,
			selected,
			files: status.files.filter((file) => selected.includes(file.path) || selected.includes(file.oldPath ?? "")),
			diff: diff.text,
			truncated: diff.truncated
		});
	}
	/** Collect the selected diff without staging anything. */
	async collectDiff(repo, selected) {
		const parts = [];
		const numstat = await this.git.runOk(repo, [
			"diff",
			"HEAD",
			"--numstat",
			"--",
			...selected
		]);
		if (numstat.stdout.trim()) parts.push(`# numstat\n${numstat.stdout.trim()}`);
		const tracked = await this.git.runOk(repo, [
			"diff",
			"HEAD",
			"--",
			...selected
		]);
		if (tracked.stdout.trim()) parts.push(tracked.stdout);
		for (const path of selected) {
			if ((await this.git.run(repo, [
				"ls-files",
				"--error-unmatch",
				"--",
				path
			])).exitCode === 0) continue;
			const added = await this.git.run(repo, [
				"diff",
				"--no-index",
				"--",
				"/dev/null",
				path
			]);
			if (added.stdout.trim()) parts.push(added.stdout);
		}
		const text = parts.join("\n");
		const limit = this.config.messageMaxDiffBytes;
		if (Buffer.byteLength(text, "utf8") <= limit) return {
			text,
			truncated: false
		};
		return {
			text: `${Buffer.from(text, "utf8").subarray(0, limit).toString("utf8")}\n… diff truncated …`,
			truncated: true
		};
	}
	/** Repository top level for one session's workspace. */
	async resolveRepo(sessionId) {
		const workspace = this.resolveWorkspace(sessionId);
		const result = await this.git.run(workspace.path, ["rev-parse", "--show-toplevel"]);
		if (result.exitCode !== 0) throw new GitError("git/not-a-repository", `${workspace.path} is not inside a git repository`);
		return result.stdout.trim();
	}
	resolveWorkspace(sessionId) {
		const registry = this.ctx.get("workspaceRegistry");
		if (registry === void 0) throw new GitError("git/not-a-repository", "this profile registers no workspace, so no repository can be resolved");
		const match = registry.list().find((workspace) => workspaceHasSession(workspace, sessionId));
		if (match === void 0) throw new GitError("git/not-a-repository", "this session has no registered workspace");
		return match;
	}
	async hasLocalBranch(repo, name) {
		return (await this.git.run(repo, [
			"show-ref",
			"--verify",
			"--quiet",
			`refs/heads/${name}`
		])).exitCode === 0;
	}
	async remoteBranches(repo, name) {
		return (await this.git.runOk(repo, [
			"for-each-ref",
			"--format=%(refname:short)",
			`refs/remotes/*/${name}`
		])).stdout.split("\n").map((line) => line.trim()).filter(Boolean);
	}
	async runSwitch(repo, args) {
		const result = await this.git.run(repo, args);
		if (result.exitCode === 0) return;
		const detail = (result.stderr || result.stdout).trim();
		if (/local changes|would be overwritten|not clean|Your index contains staged changes/i.test(detail)) throw new GitError("git/dirty-worktree", detail);
		throw new GitError("git/failed", describeFailure(args, result));
	}
};
/** Reject inputs that could read as an option or break out of the repository. */
function assertBranchName(name) {
	if (name.length === 0) throw new GitError("git/invalid-input", "a branch name is required");
	if (name.startsWith("-")) throw new GitError("git/invalid-input", "a branch name cannot start with -");
	if (/[\s\u0000-\u001f\u007f~^:?*[\\]/.test(name)) throw new GitError("git/invalid-input", `invalid branch name: ${name}`);
	if (name.includes("..") || name.includes("//") || /[.@{}]$/.test(name) || /^-|-$/.test(name) || name.includes("@{")) throw new GitError("git/invalid-input", `invalid branch name: ${name}`);
}
/** Merge porcelain rows that report one path twice (a staged delete plus an untracked add). */
function dedupeFiles(entries) {
	const byPath = /* @__PURE__ */ new Map();
	for (const entry of entries) {
		const existing = byPath.get(entry.path);
		if (existing === void 0) {
			byPath.set(entry.path, { ...entry });
			continue;
		}
		existing.staged ||= entry.staged;
		existing.untracked ||= entry.untracked;
		if (existing.indexStatus === "." || existing.indexStatus === "?") existing.indexStatus = entry.indexStatus;
		if (entry.worktreeStatus !== "." && entry.worktreeStatus !== "?") existing.worktreeStatus = entry.worktreeStatus;
	}
	return [...byPath.values()];
}
/**
* Validate the browser's selection against what `status` just reported.
* @returns pathspecs to hand to git, renames expanded to both sides.
*/
function selectPaths(files, requested) {
	if (requested.length === 0) throw new GitError("git/no-files-selected", "select at least one file to commit");
	const reported = /* @__PURE__ */ new Map();
	for (const file of files) {
		reported.set(file.path, file);
		if (file.oldPath !== void 0) reported.set(file.oldPath, file);
	}
	const paths = [];
	for (const raw of requested) {
		const file = reported.get(raw);
		if (file === void 0) throw new GitError("git/invalid-input", `${raw} is not a changed path`);
		if (raw.startsWith("-")) throw new GitError("git/invalid-input", `${raw} is not a valid path`);
		if (file.oldPath !== void 0 && !paths.includes(file.oldPath)) paths.push(file.oldPath);
		if (!paths.includes(file.path)) paths.push(file.path);
	}
	return paths;
}
/** `origin/main` from `origin/HEAD -> main` style rows; undefined for symbolic pointers. */
function stripRemoteHead(name) {
	if (name.endsWith("/HEAD")) return void 0;
	return name;
}
function shortRemoteName(fullRemote) {
	const slash = fullRemote.indexOf("/");
	return slash < 0 ? fullRemote : fullRemote.slice(slash + 1);
}
function workspaceHasSession(workspace, sessionId) {
	return workspace.sessionIds.some((id) => String(id) === sessionId);
}
function liveSession(ctx, sessionId) {
	return ctx.sessions.list().find((session) => String(session.id) === sessionId);
}
/** Keep push output to the last meaningful lines. */
function trimOutput(text) {
	return text.split("\n").map((line) => line.trim()).filter(Boolean).slice(-4).join("\n");
}
//#endregion
//#region src/index.ts
/**
* dsh-git-flow, node half. The bundle patch mounts {@link GitFlow} as
* `ctx.gitFlow`; it provides the workspace git operations and registers
* `/api/dsh-git-flow/*` on the web profile. The browser half ships through
* `exports['./client']` and the package.json `dsh.client` declaration.
* @module dsh-git-flow
*/
var src_default = GitFlow;
//#endregion
export { GitFlow, src_default as default };
