window.__ModuleLoader__.load({
	id: "dsh-git-flow",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/BranchMenu.tsx
		/**
		* The composer-tool-row branch chip and its anchored popover. Data and
		* mutations belong to the parent; this component renders rows and reports intent.
		*
		* The popover is assembled from the overlay primitives rather than the `Menu`
		* component: a menu renders every entry into its scrolling viewport, so a
		* search box there would scroll away with the rows — and would sit inside a
		* `role="menuitem"` button, where a click selects the row instead of typing.
		*/
		/** Pill plus anchored branch picker: pinned search, scrolling rows, pinned actions. */
		function BranchMenu(props) {
			const { t, status, branches, busy, open } = props;
			const anchorRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const [filter, setFilter] = (0, react.useState)("");
			const [placement, setPlacement] = (0, react.useState)(void 0);
			(0, react.useLayoutEffect)(() => {
				if (!open) {
					setPlacement(void 0);
					return;
				}
				const place = () => {
					const rect = anchorRef.current?.getBoundingClientRect();
					if (rect === void 0) return;
					const width = panelRef.current?.offsetWidth ?? PANEL_WIDTH;
					const left = Math.min(Math.max(rect.left, MARGIN), Math.max(MARGIN, window.innerWidth - width - MARGIN));
					const room = rect.top - GAP - MARGIN;
					setPlacement({
						left,
						bottom: window.innerHeight - rect.top + GAP,
						maxHeight: Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, room))
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				const observer = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(place);
				if (panelRef.current !== null) observer?.observe(panelRef.current);
				return () => {
					observer?.disconnect();
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [open]);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(anchorRef, open, (next) => {
				props.onOpenChange(next);
			}, panelRef);
			(0, react.useEffect)(() => {
				if (open) setFilter("");
			}, [open]);
			const rows = (0, react.useMemo)(() => buildRows(t, branches, filter), [
				t,
				branches,
				filter
			]);
			const firstBranch = rows.find((row) => row.kind === "branch" && row.name !== status.head);
			const tooltip = status.files.length === 0 ? t("chip.tooltip.clean", { branch: status.head }) : t("chip.tooltip", {
				branch: status.head,
				count: status.files.length
			});
			const unpushed = status.ahead > 0 ? t("chip.unpushed", { count: status.ahead }) : void 0;
			const noUpstream = status.upstream === void 0 ? t("commit.noUpstream") : void 0;
			const hints = [
				status.upstream !== void 0 && status.behind > 0 ? t("chip.aheadBehind", {
					ahead: status.ahead,
					behind: status.behind
				}) : void 0,
				unpushed,
				noUpstream
			].filter((part) => part !== void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				ref: anchorRef,
				style: anchorStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: [tooltip, ...hints].join(" · "),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
						onClick: () => {
							props.onOpenChange(!open);
						},
						"aria-label": [tooltip, ...hints].join(" · "),
						"aria-expanded": open,
						style: pillStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, { size: 14 }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: nameStyle,
								children: status.head
							}),
							status.ahead > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: aheadStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutline16, { size: 11 }), status.ahead]
							}),
							status.upstream === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: aheadStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutline16, { size: 11 })
							}),
							status.files.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: countStyle,
								children: status.files.length
							})
						]
					})
				})
			}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				role: "dialog",
				"aria-label": tooltip,
				style: {
					...placement ?? hidingStyle,
					...panelStyle
				},
				onKeyDown: (event) => {
					if (event.key !== "Escape") return;
					event.stopPropagation();
					props.onOpenChange(false);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: searchRowStyle,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 14 }),
							value: filter,
							placeholder: t("menu.search"),
							autoFocus: true,
							style: searchInputStyle,
							onChange: (event) => {
								setFilter(event.target.value);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter" && firstBranch !== void 0) {
									props.onOpenChange(false);
									props.onSelectBranch(firstBranch.name ?? "");
								}
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: listStyle$1,
						role: "menu",
						children: [rows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: emptyStyle,
							children: t("menu.empty")
						}), rows.map((row) => row.kind === "group" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "presentation",
							style: groupStyle,
							children: row.label
						}, row.key) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchRow, {
							label: row.label,
							title: row.name ?? "",
							current: row.name === status.head,
							disabled: busy,
							onSelect: () => {
								props.onOpenChange(false);
								props.onSelectBranch(row.name ?? "");
							}
						}, row.key))]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: actionsStyle$1,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }),
								label: t("menu.newBranch"),
								onClick: () => {
									props.onOpenChange(false);
									props.onNewBranch();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 14 }),
								label: t("menu.commit"),
								disabled: status.files.length === 0,
								onClick: () => {
									props.onOpenChange(false);
									props.onCommit();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutline16, { size: 14 }),
								label: t("menu.push"),
								disabled: status.ahead === 0 && status.upstream !== void 0,
								onClick: () => {
									props.onOpenChange(false);
									props.onPush();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, { size: 14 }),
								label: t("menu.refresh"),
								onClick: () => {
									props.onOpenChange(false);
									props.onRefresh();
								}
							})
						]
					})
				]
			}), document.body)] });
		}
		/** One branch row: the name, a check for the current branch, hover fill. */
		function BranchRow(props) {
			const [hover, setHover] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "menuitem",
				disabled: props.disabled,
				title: props.title,
				onClick: props.onSelect,
				onPointerEnter: () => {
					setHover(true);
				},
				onPointerLeave: () => {
					setHover(false);
				},
				style: {
					...rowStyle,
					...hover && !props.disabled ? rowHoverStyle$1 : null
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: rowNameStyle,
					children: props.label
				}), props.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 14 })]
			});
		}
		/** One pinned action below the scrolling list. */
		function ActionRow(props) {
			const [hover, setHover] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				disabled: props.disabled,
				onClick: props.onClick,
				onPointerEnter: () => {
					setHover(true);
				},
				onPointerLeave: () => {
					setHover(false);
				},
				style: {
					...actionStyle,
					...hover && props.disabled !== true ? rowHoverStyle$1 : null,
					...props.disabled === true ? disabledStyle : null
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: actionIconStyle,
					children: props.icon
				}), props.label]
			});
		}
		/** Local rows, then the remote-only ones, filtered by the search text. */
		function buildRows(t, branches, filter) {
			if (branches === void 0) return [{
				kind: "group",
				key: "loading",
				label: t("menu.loading")
			}];
			const needle = filter.trim().toLowerCase();
			const named = (name) => name.toLowerCase().includes(needle);
			const rows = [];
			const group = (label, list) => {
				if (list.length === 0) return;
				rows.push({
					kind: "group",
					key: `group:${label}`,
					label: `${label} · ${list.length}`
				});
				rows.push(...list);
			};
			group(t("menu.local"), branches.local.filter((branch) => !branch.remoteOnly && named(branch.name)).map((branch) => ({
				kind: "branch",
				key: `local:${branch.name}`,
				label: branch.name,
				name: branch.name
			})));
			group(t("menu.remote"), branches.local.filter((branch) => branch.remoteOnly && named(branch.name)).map((branch) => ({
				kind: "branch",
				key: `remote:${branch.name}`,
				label: branch.name,
				name: branch.name
			})));
			return rows;
		}
		/** Fixed-position placeholder for the frame before the anchor is measured. */
		const hidingStyle = {
			position: "fixed",
			left: 0,
			bottom: 0,
			visibility: "hidden"
		};
		/** Design width of the popover card. */
		const PANEL_WIDTH = 268;
		/** Distance kept between the chip's top edge and the popover. */
		const GAP = 8;
		/** Distance kept between the popover and each viewport edge. */
		const MARGIN = 12;
		/** Height cap on a tall window, and the floor that keeps the card usable. */
		const PANEL_MAX_HEIGHT = 420;
		const PANEL_MIN_HEIGHT = 180;
		const anchorStyle = { display: "inline-flex" };
		const pillStyle = {
			gap: 6,
			maxWidth: 240
		};
		const nameStyle = {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const panelStyle = {
			position: "fixed",
			zIndex: 1100,
			display: "flex",
			flexDirection: "column",
			width: PANEL_WIDTH,
			background: "var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1, #ffffff))",
			border: "1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.25))",
			borderRadius: 16,
			boxShadow: "var(--dsw-elevation-prominent, 0 12px 32px rgba(0,0,0,0.16))",
			overflow: "hidden"
		};
		const searchRowStyle = {
			flex: "0 0 auto",
			padding: "8px 8px 6px",
			borderBottom: "1px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.16))"
		};
		const searchInputStyle = { width: "100%" };
		const listStyle$1 = {
			flex: "1 1 auto",
			minHeight: 0,
			overflowY: "auto",
			padding: 4
		};
		const actionsStyle$1 = {
			flex: "0 0 auto",
			padding: 4,
			borderTop: "1px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.16))"
		};
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			width: "100%",
			padding: "6px 8px",
			border: "none",
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-primary, inherit)",
			font: "inherit",
			fontSize: 13,
			textAlign: "left",
			cursor: "pointer"
		};
		const rowHoverStyle$1 = { background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.10))" };
		const rowNameStyle = {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const groupStyle = {
			padding: "6px 8px 2px",
			fontSize: 11,
			color: "var(--dsw-alias-label-tertiary, currentColor)"
		};
		const emptyStyle = {
			padding: "10px 8px",
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary, currentColor)"
		};
		const actionStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			width: "100%",
			padding: "6px 8px",
			border: "none",
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-primary, inherit)",
			font: "inherit",
			fontSize: 13,
			textAlign: "left",
			cursor: "pointer"
		};
		const actionIconStyle = {
			display: "inline-flex",
			flex: "0 0 auto"
		};
		const disabledStyle = {
			opacity: .45,
			cursor: "default"
		};
		const aheadStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 1,
			flex: "0 0 auto",
			fontSize: 11,
			color: "var(--dsw-alias-label-secondary, currentColor)"
		};
		const countStyle = {
			minWidth: 16,
			padding: "0 4px",
			borderRadius: 8,
			textAlign: "center",
			fontSize: 11,
			lineHeight: "16px",
			background: "var(--dsw-alias-state-warn-primary, currentColor)",
			color: "var(--dsw-alias-label-primary-inverted, #ffffff)"
		};
		//#endregion
		//#region src/client/api.ts
		const BASE = "/api/dsh-git-flow";
		/** A git operation refused by the host, carrying its structured code. */
		var GitApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "GitApiError";
			}
		};
		/** Codes that mean "this session has no git surface"; the chip stays hidden. */
		const SILENT = ["git/not-a-repository", "git/not-installed"];
		/** Whether an error should hide the branch chip instead of reporting itself. */
		function isSilentError(error) {
			return error instanceof GitApiError && SILENT.includes(error.code);
		}
		/**
		* Codes that mean the panel's selection no longer matches the repository: a
		* commit landed, or files were written while the panel was open. The owner
		* re-reads status so the list catches up instead of failing the same way again.
		*/
		const STALE_SELECTION = ["git/invalid-input", "git/no-files-selected"];
		/** Whether an error means the checked paths are out of date. */
		function isStaleSelection(error) {
			return error instanceof GitApiError && STALE_SELECTION.includes(error.code);
		}
		/** Structured codes with dedicated copy; anything else falls back to git's message. */
		const CODED = {
			"git/not-a-repository": "error.notRepository",
			"git/not-installed": "error.notInstalled",
			"git/timeout": "error.timeout",
			"git/dirty-worktree": "checkout.dirtyTitle",
			"git/detached-head": "error.detached",
			"git/invalid-input": "error.invalid",
			"git/no-files-selected": "error.noFiles",
			"git/no-route": "error.noRoute"
		};
		/** Human-readable failure text for any thrown value. */
		function errorText(t, error) {
			if (!(error instanceof GitApiError)) return t("error.failed", { detail: String(error) });
			const key = CODED[error.code];
			return key === void 0 ? t("error.failed", { detail: error.message }) : t(key, { detail: error.message });
		}
		async function request(path, init) {
			let response;
			try {
				response = await fetch(`${BASE}${path}`, init);
			} catch (error) {
				throw new GitApiError("git/failed", String(error));
			}
			let payload;
			try {
				payload = await response.json();
			} catch {
				throw new GitApiError("git/failed", `${response.status} ${response.statusText}`);
			}
			if (!payload.ok) throw new GitApiError(payload.code, payload.message);
			return payload.data;
		}
		function post(path, body) {
			return request(path, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
		}
		/** One session-scoped query string. */
		function query(sessionId) {
			return `sessionId=${encodeURIComponent(sessionId)}`;
		}
		/** The browser-side git API. */
		const gitApi = {
			status: (sessionId) => request(`/status?${query(sessionId)}`),
			branches: (sessionId) => request(`/branches?${query(sessionId)}`),
			checkout: (body) => post("/checkout", body),
			createBranch: (body) => post("/branch", body),
			commit: (body) => post("/commit", body),
			push: (body) => post("/push", body),
			generateMessage: (body) => post("/generate-message", body)
		};
		//#endregion
		//#region src/client/CommitDialog.tsx
		/**
		* Small modal surfaces: the commit composer, the new-branch prompt, and the
		* second confirmation a dirty worktree needs before a forced switch.
		* Every mutation goes through `/api/dsh-git-flow/*`, which names only the session.
		*/
		/** Languages the panel offers, in display order. */
		const LANGUAGES = ["en", "zh"];
		/** Endonyms: each option reads correctly in either UI language. */
		const LANGUAGE_LABEL = {
			en: "English",
			zh: "中文"
		};
		/** Where the panel remembers the choice; the host config remains the default. */
		const LANGUAGE_KEY = "dsh-git-flow:message-language";
		/** Stored preference, falling back to the configured default (English). */
		function readLanguage() {
			try {
				const stored = window.localStorage.getItem(LANGUAGE_KEY);
				if (stored === "zh" || stored === "en") return stored;
			} catch {}
			return "en";
		}
		/** Commit composer: pick paths, draft or write the message, commit, optionally push. */
		function CommitDialog(props) {
			const { t, sessionId, status, onClose } = props;
			const rows = status.files;
			const stageable = rows.filter((file) => !file.conflicted);
			const [chosen, setChosen] = (0, react.useState)(() => new Set(stageable.map((file) => file.path)));
			const [message, setMessage] = (0, react.useState)("");
			const [generating, setGenerating] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [language, setLanguage] = (0, react.useState)(readLanguage);
			const paths = stageable.filter((file) => chosen.has(file.path)).map((file) => file.path);
			const allSelected = stageable.length > 0 && paths.length === stageable.length;
			const signature = stageable.map((file) => file.path).join("\n");
			(0, react.useEffect)(() => {
				setChosen(new Set(stageable.map((file) => file.path)));
			}, [signature]);
			const chooseLanguage = (next) => {
				setLanguage(next);
				try {
					window.localStorage.setItem(LANGUAGE_KEY, next);
				} catch {}
			};
			const toggle = (path) => {
				setChosen((current) => {
					const next = new Set(current);
					if (next.delete(path)) return next;
					next.add(path);
					return next;
				});
			};
			const generate = async () => {
				if (paths.length === 0) {
					props.notify(t("error.noFiles"), true);
					return;
				}
				setGenerating(true);
				try {
					const draft = await gitApi.generateMessage({
						sessionId,
						files: paths,
						language
					});
					setMessage(draft.message);
					if (draft.language !== language) props.notify(t("commit.staleHost"), true);
					else if (draft.fallback) props.notify(draft.reason === void 0 ? t("commit.fallback") : t("commit.fallbackReason", { detail: draft.reason }), true);
				} catch (error) {
					props.notify(errorText(t, error), true);
					if (isStaleSelection(error)) props.refresh();
				} finally {
					setGenerating(false);
				}
			};
			/** Push what is already committed, without making a new commit. */
			const pushOnly = async () => {
				setBusy(true);
				try {
					await gitApi.push({ sessionId });
					props.notify(t("push.done", { branch: status.head }));
					props.refresh();
					onClose();
				} catch (error) {
					props.notify(errorText(t, error), true);
				} finally {
					setBusy(false);
				}
			};
			const submit = async (push) => {
				if (paths.length === 0) {
					props.notify(t("error.noFiles"), true);
					return;
				}
				if (message.trim().length === 0) {
					props.notify(t("commit.needMessage"), true);
					return;
				}
				setBusy(true);
				try {
					const committed = await gitApi.commit({
						sessionId,
						files: paths,
						message: message.trim()
					});
					if (!push) {
						props.notify(t("commit.done", { hash: committed.shortHash }));
						props.refresh();
						onClose();
						return;
					}
					try {
						await gitApi.push({ sessionId });
						props.notify(t("commit.pushDone", { hash: committed.shortHash }));
					} catch (error) {
						props.notify(`${t("commit.pushFail", { hash: committed.shortHash })} · ${errorText(t, error)}`, true);
					}
					props.refresh();
					onClose();
				} catch (error) {
					props.notify(errorText(t, error), true);
					if (isStaleSelection(error)) props.refresh();
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				title: t("commit.title"),
				description: t("commit.description"),
				closeLabel: t("commit.cancel"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: footerStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: metaStyle,
						children: [t("commit.selected", { count: paths.length }), status.upstream === void 0 && ` · ${t("commit.noUpstream")}`]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: actionsStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "ghost",
								onClick: () => {
									pushOnly();
								},
								disabled: busy || generating,
								children: t("commit.push")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "outline",
								onClick: () => {
									submit(true);
								},
								disabled: busy || generating,
								children: t("commit.commitPush")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "primary",
								onClick: () => {
									submit(false);
								},
								disabled: busy || generating,
								children: t("commit.commit")
							})
						]
					})]
				}),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: sectionStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						style: rowHeaderStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: headingStyle,
								children: t("commit.message")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("commit.messageLanguage"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: languageStyle,
									children: LANGUAGES.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
										active: language === id,
										disabled: generating || busy,
										onClick: () => {
											chooseLanguage(id);
										},
										children: LANGUAGE_LABEL[id]
									}, id))
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "ghost",
								icon: message.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, { size: 14 }),
								onClick: () => {
									generate();
								},
								disabled: generating || busy,
								children: message.length === 0 ? t("commit.generate") : t("commit.regenerate")
							}),
							generating && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: metaStyle,
								children: t("commit.generating")
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						style: textareaStyle,
						value: message,
						placeholder: t("commit.messagePlaceholder"),
						rows: 5,
						spellCheck: false,
						onChange: (event) => setMessage(event.target.value)
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: sectionStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						style: rowHeaderStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: headingStyle,
								children: t("commit.files")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: metaStyle,
								children: t("commit.selected", { count: paths.length })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
								checked: allSelected,
								onChange: (next) => setChosen(next ? new Set(stageable.map((file) => file.path)) : /* @__PURE__ */ new Set()),
								label: t("commit.selectAll", { count: stageable.length }),
								disabled: busy || stageable.length === 0
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: listStyle,
						children: [rows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: emptyListStyle,
							children: t("commit.none")
						}), rows.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileRow, {
							path: filePath(file),
							code: fileCode(file),
							tone: fileTone(file),
							title: file.conflicted ? t("status.conflict") : file.path,
							checked: chosen.has(file.path),
							disabled: file.conflicted || busy,
							onToggle: () => {
								toggle(file.path);
							}
						}, file.path))]
					})]
				})]
			});
		}
		/** One changed path: its checkbox, the path as its label, and a status badge. */
		function FileRow(props) {
			const [hover, setHover] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					...fileRowStyle,
					...hover && !props.disabled ? rowHoverStyle : null
				},
				onPointerEnter: () => {
					setHover(true);
				},
				onPointerLeave: () => {
					setHover(false);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: checkboxWrapStyle,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
						checked: props.checked,
						onChange: props.onToggle,
						label: props.path,
						title: props.title,
						disabled: props.disabled
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						...badgeStyle,
						color: props.tone
					},
					children: props.code
				})]
			});
		}
		/** Ask for a branch name, create it from the current HEAD, and switch to it. */
		function CreateBranchDialog(props) {
			const { t, sessionId, status, onClose } = props;
			const [name, setName] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const create = async () => {
				setBusy(true);
				try {
					await gitApi.createBranch({
						sessionId,
						name: name.trim()
					});
					props.notify(t("create.done", { branch: name.trim() }));
					props.refresh();
					onClose();
				} catch (error) {
					props.notify(errorText(t, error), true);
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				title: t("create.title"),
				description: t("create.description", { branch: status.head }),
				closeLabel: t("commit.cancel"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: actionsStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						onClick: onClose,
						disabled: busy,
						children: t("commit.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "primary",
						onClick: () => {
							create();
						},
						disabled: busy || name.trim().length === 0,
						children: t("create.submit")
					})]
				}),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: sectionStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: headingStyle,
						children: t("create.name")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						value: name,
						placeholder: t("create.placeholder"),
						autoFocus: true,
						style: branchInputStyle,
						onChange: (event) => setName(event.target.value)
					})]
				})
			});
		}
		/**
		* A switch that git refused because it would overwrite local edits. The first
		* attempt runs without `force`; only this second confirmation sends it.
		*/
		function ForceCheckoutDialog(props) {
			const { t, sessionId, branch, onClose } = props;
			const [busy, setBusy] = (0, react.useState)(false);
			const force = async () => {
				setBusy(true);
				try {
					await gitApi.checkout({
						sessionId,
						name: branch,
						force: true
					});
					props.notify(t("checkout.done", { branch }));
					props.refresh();
					onClose();
				} catch (error) {
					props.notify(errorText(t, error), true);
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				title: t("checkout.dirtyTitle"),
				description: t("checkout.dirtyBody", { branch }),
				closeLabel: t("commit.cancel"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: actionsStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						onClick: onClose,
						disabled: busy,
						children: t("commit.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "primary",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 14 }),
						onClick: () => {
							force();
						},
						disabled: busy,
						children: t("checkout.force")
					})]
				})
			});
		}
		/** Display path, showing both sides of a rename. */
		function filePath(file) {
			return file.oldPath === void 0 ? file.path : `${file.oldPath} → ${file.path}`;
		}
		/** Two-letter porcelain code, collapsed for display. */
		function fileCode(file) {
			if (file.conflicted) return "U";
			if (file.untracked) return "?";
			const code = `${file.indexStatus}${file.worktreeStatus}`;
			return code === ".." ? "·" : code;
		}
		const sectionStyle = {
			display: "grid",
			gap: 8,
			minWidth: 0
		};
		const rowHeaderStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			minWidth: 0
		};
		const languageStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			flex: "0 0 auto"
		};
		const headingStyle = {
			fontSize: 12,
			color: "var(--dsw-alias-label-secondary, currentColor)",
			flex: "0 0 auto"
		};
		const metaStyle = {
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary, currentColor)",
			flex: "0 0 auto"
		};
		const listStyle = {
			display: "grid",
			gap: 1,
			maxHeight: 216,
			overflowY: "auto",
			border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.25))",
			borderRadius: 10,
			padding: 4
		};
		const emptyListStyle = {
			padding: "10px 8px",
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary, currentColor)"
		};
		const fileRowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			minWidth: 0,
			padding: "3px 6px",
			borderRadius: 6
		};
		const rowHoverStyle = { background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.10))" };
		const checkboxWrapStyle = {
			display: "flex",
			alignItems: "center",
			minWidth: 0,
			overflow: "hidden"
		};
		const badgeStyle = {
			flex: "0 0 auto",
			minWidth: 22,
			padding: "0 5px",
			border: "1px solid currentColor",
			borderRadius: 6,
			fontFamily: "var(--dsw-font-mono, ui-monospace, monospace)",
			fontSize: 10,
			lineHeight: "16px",
			textAlign: "center",
			opacity: .9
		};
		const footerStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
			width: "100%"
		};
		const actionsStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			justifyContent: "flex-end"
		};
		const branchInputStyle = { width: "100%" };
		const textareaStyle = {
			width: "100%",
			resize: "vertical",
			minHeight: 96,
			fontFamily: "var(--dsw-font-mono, ui-monospace, monospace)",
			fontSize: 13,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-primary, inherit)",
			background: "var(--dsw-alias-bg-layer-1, transparent)",
			border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.25))",
			borderRadius: 8,
			padding: "8px 10px",
			outline: "none"
		};
		/** Codes that add content read as success, removals as warning, the rest neutral. */
		function fileTone(file) {
			const code = fileCode(file);
			if (code === "U") return "var(--dsw-alias-state-error-primary, currentColor)";
			if (code === "?" || code[1] === "A" || code === "AM") return "var(--dsw-alias-state-success-primary, currentColor)";
			if (code === "D" || code[1] === "D") return "var(--dsw-alias-state-warn-primary, currentColor)";
			return "var(--dsw-alias-label-tertiary, currentColor)";
		}
		//#endregion
		//#region src/client/BranchChip.tsx
		/**
		* The composer-tool-row entry: owns the session's git status, the branch menu,
		* the three dialog surfaces, and the toast. Everything below it is presentational.
		*/
		/** Branch chip for the session's workspace; renders nothing outside a repository. */
		function GitFlowChip({ sessionId, t }) {
			const [status, setStatus] = (0, react.useState)(void 0);
			const [hidden, setHidden] = (0, react.useState)(false);
			const [branches, setBranches] = (0, react.useState)(void 0);
			const [open, setOpen] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [dialog, setDialog] = (0, react.useState)(void 0);
			const [banner, setBanner] = (0, react.useState)(void 0);
			const notify = (0, react.useCallback)((text, failed = false) => {
				setBanner({
					seq: Date.now() + Math.random(),
					text,
					failed
				});
			}, []);
			const loadStatus = (0, react.useCallback)(async () => {
				try {
					setStatus(await gitApi.status(sessionId));
					setHidden(false);
				} catch (error) {
					if (isSilentError(error)) {
						setStatus(void 0);
						setHidden(true);
						return;
					}
					setHidden(false);
					notify(errorText(t, error), true);
				}
			}, [
				sessionId,
				t,
				notify
			]);
			(0, react.useEffect)(() => {
				loadStatus();
			}, [loadStatus]);
			(0, react.useEffect)(() => {
				if (!open) return;
				loadStatus();
				(async () => {
					try {
						setBranches(await gitApi.branches(sessionId));
					} catch (error) {
						notify(errorText(t, error), true);
					}
				})();
			}, [
				open,
				sessionId,
				t,
				notify,
				loadStatus
			]);
			const refresh = (0, react.useCallback)(() => {
				loadStatus();
			}, [loadStatus]);
			/** Push the current branch's unpushed commits, straight from the menu. */
			const pushCommits = async () => {
				setBusy(true);
				try {
					await gitApi.push({ sessionId });
					notify(t("push.done", { branch: status?.head ?? "" }));
					refresh();
				} catch (error) {
					notify(errorText(t, error), true);
				} finally {
					setBusy(false);
				}
			};
			const checkout = async (name) => {
				if (name === status?.head) return;
				setBusy(true);
				try {
					const next = await gitApi.checkout({
						sessionId,
						name
					});
					setStatus(next);
					notify(t("checkout.done", { branch: next.head }));
				} catch (error) {
					if (error instanceof GitApiError && error.code === "git/dirty-worktree") setDialog({
						kind: "force",
						branch: name
					});
					else notify(errorText(t, error), true);
				} finally {
					setBusy(false);
				}
			};
			if (hidden || status === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchMenu, {
					t,
					status,
					branches,
					busy,
					open,
					onOpenChange: setOpen,
					onSelectBranch: (name) => {
						checkout(name);
					},
					onNewBranch: () => {
						setDialog({ kind: "new" });
					},
					onCommit: () => {
						refresh();
						setDialog({ kind: "commit" });
					},
					onPush: () => {
						pushCommits();
					},
					onRefresh: () => {
						setBranches(void 0);
						refresh();
					}
				}),
				dialog?.kind === "commit" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommitDialog, {
					t,
					sessionId,
					status,
					notify,
					refresh,
					onClose: () => {
						setDialog(void 0);
					}
				}),
				dialog?.kind === "new" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreateBranchDialog, {
					t,
					sessionId,
					status,
					notify,
					refresh,
					onClose: () => {
						setDialog(void 0);
					}
				}),
				dialog?.kind === "force" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ForceCheckoutDialog, {
					t,
					sessionId,
					branch: dialog.branch,
					notify,
					refresh,
					onClose: () => {
						setDialog(void 0);
					}
				}),
				banner !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: banner.text,
					icon: banner.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 14 }) : void 0,
					onDone: () => {
						setBanner(void 0);
					}
				}, banner.seq)
			] });
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Browser copy for the git surface. Both dictionaries carry the same keys;
		* `en` is typed against `zh` so a missing key is a compile error.
		*/
		const GIT_FLOW_NS = "gitFlow";
		/** Both locales, in the shape `ctx.locale.register` validates. */
		const gitFlowLocale = {
			zh: {
				"chip.tooltip": "当前分支 {branch}，{count} 个未提交改动",
				"chip.tooltip.clean": "当前分支 {branch}，工作区干净",
				"chip.aheadBehind": "领先 {ahead}，落后 {behind}",
				"chip.unpushed": "有 {count} 个提交未推送",
				"menu.search": "搜索分支",
				"menu.local": "本地分支",
				"menu.remote": "仅在远端",
				"menu.empty": "没有匹配的分支",
				"menu.loading": "读取分支…",
				"menu.newBranch": "新建分支…",
				"menu.commit": "提交…",
				"menu.push": "推送提交",
				"menu.refresh": "刷新状态",
				"checkout.done": "已切换到 {branch}",
				"checkout.dirtyTitle": "工作区有未提交改动",
				"checkout.dirtyBody": "切换到 {branch} 会覆盖本地改动。可以先提交，或者强制切换（`git switch --force` 会丢弃全部本地改动）。",
				"checkout.force": "强制切换",
				"create.title": "新建分支",
				"create.description": "基于当前分支 {branch} 创建并切换。",
				"create.name": "分支名称",
				"create.placeholder": "例如 feature/git-flow",
				"create.submit": "创建并切换",
				"create.done": "已创建并切换到 {branch}",
				"commit.title": "提交改动",
				"commit.description": "只提交勾选的文件；提交信息可由模型生成，也可以自己写。",
				"commit.files": "改动文件",
				"commit.selectAll": "全部 {count} 个文件",
				"commit.message": "提交信息",
				"commit.messageLanguage": "提交信息语言",
				"commit.messagePlaceholder": "第一行写成 feat: 描述，空一行后可以补充要点",
				"commit.generate": "生成提交信息",
				"commit.regenerate": "重新生成",
				"commit.generating": "正在生成…",
				"commit.push": "推送",
				"commit.commit": "提交",
				"commit.commitPush": "提交并推送",
				"commit.cancel": "取消",
				"commit.none": "还没有勾选文件",
				"commit.needMessage": "请先填写提交信息",
				"commit.selected": "已选 {count} 个文件",
				"commit.noUpstream": "当前分支还没有上游，首次推送会自动建立",
				"commit.fallback": "模型没有给出可用信息，已填入模板，可自行修改",
				"commit.staleHost": "语言选择没生效：宿主进程还是旧版本，重启 dsh web 后再试",
				"commit.fallbackReason": "模型没有给出可用信息（{detail}），已填入模板，可自行修改",
				"commit.done": "已提交 {hash}",
				"commit.pushDone": "已提交并推送 {hash}",
				"commit.pushFail": "已提交 {hash}，但推送失败",
				"push.done": "已推送 {branch}",
				"status.clean": "工作区干净",
				"status.conflict": "有冲突文件",
				"error.notRepository": "当前工作区不是 git 仓库",
				"error.notInstalled": "本机没有可用的 git 命令",
				"error.timeout": "git 命令超时",
				"error.noRoute": "这个会话还没有模型路由，先发出一轮对话再试",
				"error.detached": "当前处于游离 HEAD，先切到一个分支再操作",
				"error.noFiles": "请至少勾选一个文件",
				"error.invalid": "输入不合法：{detail}",
				"error.failed": "操作失败：{detail}"
			},
			en: {
				"chip.tooltip": "Branch {branch}, {count} uncommitted changes",
				"chip.tooltip.clean": "Branch {branch}, working tree clean",
				"chip.aheadBehind": "{ahead} ahead, {behind} behind",
				"chip.unpushed": "{count} commits not pushed",
				"menu.search": "Search branches",
				"menu.local": "Local branches",
				"menu.remote": "Remote only",
				"menu.empty": "No matching branch",
				"menu.loading": "Loading branches…",
				"menu.newBranch": "New branch…",
				"menu.commit": "Commit…",
				"menu.push": "Push commits",
				"menu.refresh": "Refresh status",
				"checkout.done": "Switched to {branch}",
				"checkout.dirtyTitle": "You have uncommitted changes",
				"checkout.dirtyBody": "Switching to {branch} would overwrite local changes. Commit them first, or force the switch and let `git switch --force` discard every local change.",
				"checkout.force": "Force switch",
				"create.title": "New branch",
				"create.description": "Create from the current branch {branch} and switch to it.",
				"create.name": "Branch name",
				"create.placeholder": "e.g. feature/git-flow",
				"create.submit": "Create and switch",
				"create.done": "Created and switched to {branch}",
				"commit.title": "Commit changes",
				"commit.description": "Only the checked files are committed. The message can be drafted by the model or written by you.",
				"commit.files": "Changed files",
				"commit.selectAll": "All {count} files",
				"commit.message": "Commit message",
				"commit.messageLanguage": "Commit message language",
				"commit.messagePlaceholder": "Start with `feat: summary`, optionally add bullets after a blank line",
				"commit.generate": "Draft message",
				"commit.regenerate": "Regenerate",
				"commit.generating": "Drafting…",
				"commit.push": "Push",
				"commit.commit": "Commit",
				"commit.commitPush": "Commit and push",
				"commit.cancel": "Cancel",
				"commit.none": "No file selected",
				"commit.needMessage": "Write a commit message first",
				"commit.selected": "{count} files selected",
				"commit.noUpstream": "No upstream yet; the first push creates one",
				"commit.fallback": "The model returned nothing usable, so a template was filled in",
				"commit.staleHost": "The language choice did not apply: the host process is older than this page — restart dsh web",
				"commit.fallbackReason": "The model returned nothing usable ({detail}), so a template was filled in",
				"commit.done": "Committed {hash}",
				"commit.pushDone": "Committed and pushed {hash}",
				"commit.pushFail": "Committed {hash}, but the push failed",
				"push.done": "Pushed {branch}",
				"status.clean": "Working tree clean",
				"status.conflict": "Conflicted files",
				"error.notRepository": "This workspace is not a git repository",
				"error.notInstalled": "git is not available on this machine",
				"error.timeout": "The git command timed out",
				"error.noRoute": "This session has no model route yet; send one turn first",
				"error.detached": "The worktree has a detached HEAD; switch to a branch first",
				"error.noFiles": "Select at least one file",
				"error.invalid": "Invalid input: {detail}",
				"error.failed": "Operation failed: {detail}"
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** Services this fiber needs before it activates. */
		const inject = ["slots", "locale"];
		/**
		* Mount the branch chip and its copy.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(GIT_FLOW_NS, gitFlowLocale), "dsh-git-flow: locale dictionary");
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "dsh-git-flow",
				order: 20,
				locale: GIT_FLOW_NS
			}, GitFlowChip));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
