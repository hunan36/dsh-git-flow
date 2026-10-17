window.__ModuleLoader__.load({
	id: "@hunan36/dsh-git-flow",
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: nameStyle,
								children: status.head
							}),
							props.flow?.kind !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: flowBadgeStyle,
								children: t(`flow.${props.flow.kind}`)
							}),
							status.behind > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									...badgeBase,
									background: "var(--dsw-alias-state-business-primary, #4176e6)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutlineRegular, { size: 10 }), status.behind]
							}),
							status.ahead > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									...badgeBase,
									background: "var(--dsw-alias-state-success-primary, #22c55e)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 10 }), status.ahead]
							}),
							status.upstream === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: aheadStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 11 })
							}),
							status.files.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									...badgeBase,
									background: "var(--dsw-alias-state-warn-primary, #f59e0b)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 10 }), status.files.length]
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
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 }),
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
						style: actionsStyle$2,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }),
								label: t("menu.newBranch"),
								onClick: () => {
									props.onOpenChange(false);
									props.onNewBranch();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkleRegular, { size: 14 }),
								label: t("menu.commit"),
								disabled: status.files.length === 0,
								onClick: () => {
									props.onOpenChange(false);
									props.onCommit();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 14 }),
								label: t("menu.push"),
								disabled: status.ahead === 0 && status.upstream !== void 0,
								onClick: () => {
									props.onOpenChange(false);
									props.onPush();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutlineRegular, { size: 14 }),
								label: t("menu.pull"),
								disabled: status.upstream === void 0,
								onClick: () => {
									props.onOpenChange(false);
									props.onPull();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 }),
								label: t("menu.refresh"),
								onClick: () => {
									props.onOpenChange(false);
									props.onRefresh();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }),
								label: t("menu.startFlow"),
								disabled: status.detached,
								onClick: () => {
									props.onOpenChange(false);
									props.onStartFlow();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 }),
								label: t("menu.finishFlow"),
								disabled: props.flow?.kind === void 0 || status.files.length > 0,
								onClick: () => {
									props.onOpenChange(false);
									props.onFinishFlow();
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
				}), props.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 })]
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
			backdropFilter: "var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%))",
			WebkitBackdropFilter: "var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%))",
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
		const actionsStyle$2 = {
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
		const rowHoverStyle$1 = { background: "var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.10))" };
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
		/** Chip count pill: white glyphs on a state color; the color names the fact. */
		const badgeBase = {
			display: "inline-flex",
			alignItems: "center",
			gap: 2,
			minWidth: 16,
			padding: "0 5px",
			borderRadius: 8,
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-primary-inverted, #ffffff)"
		};
		/** Flow-family tag next to the chip name; neutral so it never competes with the counts. */
		const flowBadgeStyle = {
			flex: "0 0 auto",
			padding: "0 5px",
			borderRadius: 6,
			fontSize: 10,
			lineHeight: "15px",
			color: "var(--dsw-alias-label-secondary, currentColor)",
			background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.14))"
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
		const STALE_SELECTION = [
			"git/invalid-input",
			"git/no-files-selected",
			"git/tag-exists",
			"git/gitflow-branch-required"
		];
		/** Whether an error means the checked paths are out of date. */
		function isStaleSelection(error) {
			return error instanceof GitApiError && STALE_SELECTION.includes(error.code);
		}
		/** Codes with dedicated copy; anything else falls back to git's message. */
		const CODED = {
			"git/not-a-repository": "error.notRepository",
			"git/not-installed": "error.notInstalled",
			"git/timeout": "error.timeout",
			"git/dirty-worktree": "checkout.dirtyTitle",
			"git/detached-head": "error.detached",
			"git/invalid-input": "error.invalid",
			"git/no-files-selected": "error.noFiles",
			"git/no-route": "error.noRoute",
			"git/develop-missing": "error.developMissing",
			"git/merge-conflict": "error.mergeConflict",
			"git/tag-exists": "error.tagExists",
			"git/gitflow-branch-required": "error.gitflowBranchRequired"
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
			discard: (body) => post("/discard", body),
			push: (body) => post("/push", body),
			pull: (body) => post("/pull", body),
			generateMessage: (body) => post("/generate-message", body),
			gitflowState: (sessionId) => request(`/gitflow?${query(sessionId)}`),
			startFlow: (body) => post("/gitflow/start", body),
			initDevelop: (body) => post("/gitflow/init-develop", body),
			finishFlow: (body) => post("/gitflow/finish", body)
		};
		//#endregion
		//#region src/client/CommitDialog.tsx
		/**
		* Small modal surfaces: the commit composer, the new-branch prompt, and the
		* second confirmation a dirty worktree needs before a forced switch.
		* Every mutation goes through `/api/dsh-git-flow/*`, which names only the session.
		*/
		/** Custom property and storage key behind the drag-to-resize width. */
		const DIALOG_WIDTH_VAR = "--dsh-git-flow-dialog-width";
		const DIALOG_WIDTH_KEY = "dsh-git-flow:dialog-width";
		/** Bounds for the dragged width, in px. */
		const WIDTH_MIN = 380;
		const WIDTH_MAX = 1100;
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
			/** Paths awaiting the destructive-action confirmation. */
			const [discard, setDiscard] = (0, react.useState)(void 0);
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				className: "dsh-git-flow-dialog",
				title: t("commit.title"),
				description: t("commit.description"),
				closeLabel: t("commit.cancel"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: footerStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: metaStyle,
						children: [t("commit.selected", { count: paths.length }), status.upstream === void 0 && ` · ${t("commit.noUpstream")}`]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: actionsStyle$1,
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
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResizeHandle, { label: t("commit.resize") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: sectionStyle$1,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							style: rowHeaderStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: headingStyle$1,
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
									icon: message.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkleRegular, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 }),
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
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: sectionStyle$1,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							style: rowHeaderStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: headingStyle$1,
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
								discardLabel: t("commit.discardOne", { path: file.path }),
								onToggle: () => {
									toggle(file.path);
								},
								onDiscard: () => {
									setDiscard([file.path]);
								}
							}, file.path))]
						})]
					})
				]
			}), discard !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiscardDialog, {
				t,
				sessionId,
				files: discard,
				notify: props.notify,
				refresh: props.refresh,
				onClose: () => {
					setDiscard(void 0);
				}
			})] });
		}
		/** One changed path: checkbox, single-line path, status badge, discard action. */
		function FileRow(props) {
			const [hover, setHover] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-git-flow-file-row",
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
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
						className: "dsh-git-flow-file-label",
						checked: props.checked,
						onChange: props.onToggle,
						label: props.path,
						title: props.title,
						disabled: props.disabled
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							...badgeStyle,
							color: props.tone
						},
						children: props.code
					}),
					!props.disabled && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: props.discardLabel,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-git-flow-file-action",
							style: iconButtonStyle,
							"aria-label": props.discardLabel,
							onClick: props.onDiscard,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
						})
					})
				]
			});
		}
		/**
		* Right-edge gripper for the dialog card. The card owns its width through the
		* `--dsh-git-flow-dialog-width` custom property (see styles.ts), so the drag
		* only has to write that property; the chosen width is remembered per browser.
		*/
		function ResizeHandle(props) {
			const [dragging, setDragging] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const stored = window.localStorage.getItem(DIALOG_WIDTH_KEY);
				if (stored !== null) document.documentElement.style.setProperty(DIALOG_WIDTH_VAR, stored);
			}, []);
			const onPointerDown = (event) => {
				const handle = event.currentTarget;
				const card = handle.closest(".dsh-git-flow-dialog");
				if (!(card instanceof HTMLElement)) return;
				event.preventDefault();
				const startX = event.clientX;
				const startWidth = card.offsetWidth;
				const target = handle;
				target.setPointerCapture(event.pointerId);
				setDragging(true);
				let width = startWidth;
				const move = (moveEvent) => {
					const limit = Math.min(WIDTH_MAX, window.innerWidth - 48);
					width = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), WIDTH_MIN), Math.max(WIDTH_MIN, limit));
					document.documentElement.style.setProperty(DIALOG_WIDTH_VAR, `${width}px`);
				};
				const up = () => {
					target.releasePointerCapture(event.pointerId);
					target.removeEventListener("pointermove", move);
					target.removeEventListener("pointerup", up);
					target.removeEventListener("pointercancel", up);
					setDragging(false);
					window.localStorage.setItem(DIALOG_WIDTH_KEY, `${width}px`);
				};
				target.addEventListener("pointermove", move);
				target.addEventListener("pointerup", up);
				target.addEventListener("pointercancel", up);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: props.label,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-git-flow-resize",
					role: "separator",
					"aria-label": props.label,
					"aria-orientation": "vertical",
					"data-dragging": dragging ? "true" : void 0,
					onPointerDown,
					onDoubleClick: () => {
						document.documentElement.style.removeProperty(DIALOG_WIDTH_VAR);
						window.localStorage.removeItem(DIALOG_WIDTH_KEY);
					}
				})
			});
		}
		/**
		* Confirmation for a destructive discard. Nothing is sent until the user picks
		* the destructive action here.
		*/
		function DiscardDialog(props) {
			const { t, sessionId, files, onClose } = props;
			const [busy, setBusy] = (0, react.useState)(false);
			const discard = async () => {
				setBusy(true);
				try {
					await gitApi.discard({
						sessionId,
						files
					});
					props.notify(t("commit.discardDone", { count: files.length }));
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
				title: t("commit.discardTitle"),
				description: t("commit.discardBody", { count: files.length }),
				closeLabel: t("commit.cancel"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: actionsStyle$1,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						onClick: onClose,
						disabled: busy,
						children: t("commit.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "primary",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 14 }),
						onClick: () => {
							discard();
						},
						disabled: busy,
						children: t("commit.discard")
					})]
				})
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
					style: actionsStyle$1,
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
					style: sectionStyle$1,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: headingStyle$1,
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
					style: actionsStyle$1,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						onClick: onClose,
						disabled: busy,
						children: t("commit.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "primary",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 14 }),
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
		const sectionStyle$1 = {
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
		const headingStyle$1 = {
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
		const rowHoverStyle = { background: "var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.10))" };
		const iconButtonStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "0 0 auto",
			width: 22,
			height: 22,
			padding: 0,
			border: "none",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary, currentColor)",
			cursor: "pointer"
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
		const actionsStyle$1 = {
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
		//#region src/client/GitFlowDialog.tsx
		/**
		* The three git-flow modal surfaces: start a flow branch, guide the first
		* `develop` into existence, and finish a flow branch.
		*
		* The finish dialog is the one destructive surface here, so it lists every step
		* of the run before the user confirms: merging, tagging, versioning, pushing,
		* and deleting the branch all happen without a second prompt afterwards.
		*/
		/** Flow families in the order the start dialog offers them. */
		const KINDS = [
			"feature",
			"release",
			"hotfix"
		];
		/** Copy key naming one family. */
		function kindKey(kind) {
			return `flow.${kind}`;
		}
		/**
		* Name a flow branch and create it from the branch its family starts at.
		* A missing develop is not an error the user can fix in this dialog, so it
		* closes and hands off to the guided creation instead.
		*/
		function StartFlowDialog(props) {
			const { t, sessionId, state, status, onClose } = props;
			const [kind, setKind] = (0, react.useState)("feature");
			const [name, setName] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const prefix = kind === "feature" ? state.branches.featurePrefix : kind === "release" ? state.branches.releasePrefix : state.branches.hotfixPrefix;
			const base = kind === "hotfix" ? state.branches.production : state.branches.develop;
			const blank = name.trim().length === 0;
			const start = async () => {
				if (blank) {
					props.notify(t("start.needName"), true);
					return;
				}
				setBusy(true);
				try {
					const next = await gitApi.startFlow({
						sessionId,
						kind,
						name: name.trim()
					});
					props.notify(t("start.done", { branch: next.head }));
					props.refresh();
					onClose();
				} catch (error) {
					if (error instanceof GitApiError && error.code === "git/develop-missing") {
						onClose();
						props.onNeedDevelop();
						return;
					}
					props.notify(errorText(t, error), true);
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				title: t("start.title"),
				description: t("start.description", {
					develop: state.branches.develop,
					production: state.branches.production
				}),
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
							start();
						},
						disabled: busy || blank,
						children: t("start.submit")
					})]
				}),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: sectionStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: headingStyle,
						children: t("start.kind")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: pillRowStyle,
						children: KINDS.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
							active: kind === id,
							disabled: busy,
							onClick: () => {
								setKind(id);
							},
							children: t(kindKey(id))
						}, id))
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: sectionStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: headingStyle,
							children: t("start.name")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							value: name,
							placeholder: t("start.placeholder", { prefix }),
							autoFocus: true,
							style: inputStyle,
							disabled: busy,
							onChange: (event) => setName(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Enter") start();
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: hintStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", {
								style: codeStyle,
								children: [prefix, name.trim() || "…"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("start.base", { base }) })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: hintStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("start.versionHint") }), status.detached && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["· ", t("error.detached")] })]
						})
					]
				})]
			});
		}
		/** Create the integration branch from production (or HEAD when there is none). */
		function InitDevelopDialog(props) {
			const { t, sessionId, state, status, onClose } = props;
			const [busy, setBusy] = (0, react.useState)(false);
			const from = state.hasProduction ? state.branches.production : status.head;
			const create = async () => {
				setBusy(true);
				try {
					await gitApi.initDevelop({ sessionId });
					props.notify(t("initDevelop.done", { develop: state.branches.develop }));
					props.refresh();
					onClose();
					props.onDone();
				} catch (error) {
					props.notify(errorText(t, error), true);
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				title: t("initDevelop.title", { develop: state.branches.develop }),
				description: t("initDevelop.description", {
					develop: state.branches.develop,
					from
				}),
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
						disabled: busy,
						children: t("initDevelop.submit", { develop: state.branches.develop })
					})]
				})
			});
		}
		/**
		* Confirm and run the finish sequence. The step list is generated from the same
		* facts the host will act on, so what the user reads is what will happen.
		*/
		function FinishFlowDialog(props) {
			const { t, sessionId, state, status, onClose } = props;
			const isRelease = (state.kind ?? "feature") !== "feature";
			const targets = isRelease ? [state.branches.production, state.branches.develop] : [state.branches.develop];
			const [version, setVersion] = (0, react.useState)(() => state.version ?? "");
			const [busy, setBusy] = (0, react.useState)(false);
			const tag = isRelease && version.trim().length > 0 ? `${state.branches.tagPrefix}${version.trim()}` : state.tagName;
			const finish = async () => {
				setBusy(true);
				try {
					const done = await gitApi.finishFlow({
						sessionId,
						version: isRelease && version.trim().length > 0 ? version.trim() : void 0
					});
					if (done.failure !== void 0) props.notify(t("finish.partial", {
						branch: done.branch,
						detail: done.failure.detail
					}), true);
					else {
						const parts = [t("finish.merged", { targets: done.mergedInto.join(", ") })];
						if (done.tag !== void 0) parts.push(t("finish.tagCreated", { tag: done.tag }));
						if (done.deleted) parts.push(t("finish.deleted"));
						props.notify(`${t("finish.done", { branch: done.branch })} · ${parts.join(" · ")}`);
					}
					props.refresh();
					onClose();
				} catch (error) {
					props.notify(errorText(t, error), true);
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				title: t("finish.title", { branch: state.head }),
				description: t("finish.description"),
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
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 14 }),
						onClick: () => {
							finish();
						},
						disabled: busy || status.files.length > 0 || state.tagExists,
						children: t("finish.submit")
					})]
				}),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						style: sectionStyle,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ol", {
							style: stepsStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("finish.mergeInto", { targets: targets.join(", ") }) }),
								isRelease && tag !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("finish.tag", { tag }) }),
								isRelease && version.trim().length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("finish.version", { version: version.trim() }) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("finish.push") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("finish.delete") })
							]
						})
					}),
					isRelease && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: sectionStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: headingStyle,
								children: t("finish.versionLabel")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								value: version,
								placeholder: "0.4.0",
								style: inputStyle,
								disabled: busy,
								onChange: (event) => setVersion(event.target.value)
							}),
							state.tagExists && tag !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: { ...warnStyle },
								children: t("finish.tagExists", { tag })
							})
						]
					}),
					status.files.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: warnStyle,
						children: t("checkout.dirtyTitle")
					})
				]
			});
		}
		const sectionStyle = {
			display: "grid",
			gap: 8,
			minWidth: 0
		};
		const headingStyle = {
			fontSize: 12,
			color: "var(--dsw-alias-label-secondary, currentColor)"
		};
		const pillRowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			flexWrap: "wrap"
		};
		const inputStyle = { width: "100%" };
		const hintStyle = {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: 6,
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary, currentColor)"
		};
		const codeStyle = {
			padding: "0 4px",
			borderRadius: 4,
			fontFamily: "var(--dsw-font-mono, ui-monospace, monospace)",
			background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12))"
		};
		const stepsStyle = {
			display: "grid",
			gap: 6,
			margin: 0,
			paddingLeft: 18,
			fontSize: 13,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-primary, inherit)"
		};
		const warnStyle = {
			padding: "8px 10px",
			borderRadius: 8,
			fontSize: 12,
			color: "var(--dsw-alias-state-warn-primary, #b45309)",
			background: "var(--dsw-alias-state-warn-bg, rgba(245,158,11,0.12))"
		};
		const actionsStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			justifyContent: "flex-end"
		};
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
			const [flow, setFlow] = (0, react.useState)(void 0);
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
					try {
						setFlow(await gitApi.gitflowState(sessionId));
					} catch (error) {
						if (!isSilentError(error)) notify(errorText(t, error), true);
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
				(async () => {
					try {
						setFlow(await gitApi.gitflowState(sessionId));
					} catch {}
				})();
			}, [loadStatus, sessionId]);
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
			/** Pull the current branch's unmerged commits, straight from the menu. */
			const pullRemote = async () => {
				setBusy(true);
				try {
					await gitApi.pull({ sessionId });
					notify(t("pull.done", { branch: status?.head ?? "" }));
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
					onPull: () => {
						pullRemote();
					},
					onRefresh: () => {
						setBranches(void 0);
						refresh();
					},
					flow,
					onStartFlow: () => {
						refresh();
						setDialog({ kind: "start" });
					},
					onFinishFlow: () => {
						setDialog({ kind: "finish" });
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
				dialog?.kind === "start" && flow !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StartFlowDialog, {
					t,
					sessionId,
					state: flow,
					status,
					notify,
					refresh,
					onClose: () => {
						setDialog(void 0);
					},
					onNeedDevelop: () => {
						setDialog({
							kind: "init-develop",
							thenStart: true
						});
					}
				}),
				dialog?.kind === "finish" && flow !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FinishFlowDialog, {
					t,
					sessionId,
					state: flow,
					status,
					notify,
					refresh,
					onClose: () => {
						setDialog(void 0);
					}
				}),
				dialog?.kind === "init-develop" && flow !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InitDevelopDialog, {
					t,
					sessionId,
					state: flow,
					status,
					notify,
					refresh,
					onClose: () => {
						setDialog(void 0);
					},
					onDone: () => {
						if (dialog.thenStart === true) setDialog({ kind: "start" });
					}
				}),
				banner !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: banner.text,
					icon: banner.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 14 }) : void 0,
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
				"menu.pull": "拉取远程代码",
				"menu.refresh": "刷新状态",
				"menu.startFlow": "启动 Git Flow 分支…",
				"menu.finishFlow": "完成 Git Flow 分支…",
				"flow.feature": "功能",
				"flow.release": "发布",
				"flow.hotfix": "热修复",
				"flow.badge": "{kind}",
				"start.title": "启动 Git Flow 分支",
				"start.description": "功能与发布分支从 {develop} 切出，热修复从 {production} 切出。",
				"start.kind": "分支类型",
				"start.name": "名称",
				"start.placeholder": "例如 login，将创建 {prefix}login",
				"start.submit": "创建并切换",
				"start.done": "已创建并切换到 {branch}",
				"start.needName": "请先填写名称",
				"start.base": "将从 {base} 切出",
				"start.versionHint": "发布与热修复的名称建议带版本号，例如 0.4.0",
				"initDevelop.title": "还没有 {develop} 分支",
				"initDevelop.description": "Git Flow 需要一个集成分支。将从 {from} 创建 {develop} 并切换过去。",
				"initDevelop.submit": "创建 {develop}",
				"initDevelop.done": "已创建 {develop}",
				"finish.title": "完成 {branch}",
				"finish.description": "以下动作会依次执行，合并提交与标签一旦创建就不会回滚。",
				"finish.mergeInto": "合并到 {targets}（--no-ff）",
				"finish.tag": "创建标签 {tag}",
				"finish.version": "把 package.json 版本改为 {version}",
				"finish.push": "推送分支与标签到 origin",
				"finish.delete": "删除已完成的本地分支",
				"finish.versionLabel": "版本号",
				"finish.submit": "完成并合并",
				"finish.tagExists": "标签 {tag} 已存在，请先改用其它版本号",
				"finish.done": "已完成 {branch}",
				"finish.partial": "{branch} 已在本地完成，但推送失败：{detail}",
				"finish.merged": "已合并到 {targets}",
				"finish.tagCreated": "已创建标签 {tag}",
				"finish.versionWritten": "已提交版本号 {version}",
				"finish.deleted": "已删除本地分支",
				"finish.pushFail": "推送失败：{detail}",
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
				"commit.discard": "放弃更改",
				"commit.discardTitle": "放弃这些文件的改动？",
				"commit.discardBody": "将把 {count} 个文件恢复到 HEAD：已跟踪的改动被丢弃，未跟踪的文件会被删除。此操作无法撤销。",
				"commit.discardDone": "已放弃 {count} 个文件的改动",
				"commit.discardOne": "放弃「{path}」的改动",
				"commit.resize": "拖动调整面板宽度",
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
				"pull.done": "已拉取 {branch}",
				"status.clean": "工作区干净",
				"status.conflict": "有冲突文件",
				"error.notRepository": "当前工作区不是 git 仓库",
				"error.notInstalled": "本机没有可用的 git 命令",
				"error.timeout": "git 命令超时",
				"error.noRoute": "这个会话还没有模型路由，先发出一轮对话再试",
				"error.detached": "当前处于游离 HEAD，先切到一个分支再操作",
				"error.noFiles": "请至少勾选一个文件",
				"error.invalid": "输入不合法：{detail}",
				"error.failed": "操作失败：{detail}",
				"error.developMissing": "仓库里还没有 develop 分支，请先创建",
				"error.mergeConflict": "合并时出现冲突，请先解决冲突再完成分支",
				"error.tagExists": "标签已经存在：{detail}",
				"error.gitflowBranchRequired": "当前分支不是功能、发布或热修复分支"
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
				"menu.pull": "Pull from remote",
				"menu.refresh": "Refresh status",
				"menu.startFlow": "Start git flow branch…",
				"menu.finishFlow": "Finish git flow branch…",
				"flow.feature": "Feature",
				"flow.release": "Release",
				"flow.hotfix": "Hotfix",
				"flow.badge": "{kind}",
				"start.title": "Start a git flow branch",
				"start.description": "Features and releases branch off {develop}; hotfixes branch off {production}.",
				"start.kind": "Branch type",
				"start.name": "Name",
				"start.placeholder": "e.g. login, which creates {prefix}login",
				"start.submit": "Create and switch",
				"start.done": "Created and switched to {branch}",
				"start.needName": "Write a name first",
				"start.base": "branches off {base}",
				"start.versionHint": "Release and hotfix names should carry a version, e.g. 0.4.0",
				"initDevelop.title": "No {develop} branch yet",
				"initDevelop.description": "A git flow needs an integration branch. {develop} will be created from {from} and checked out.",
				"initDevelop.submit": "Create {develop}",
				"initDevelop.done": "Created {develop}",
				"finish.title": "Finish {branch}",
				"finish.description": "These steps run in order. Once a merge commit or tag exists it is not rolled back.",
				"finish.mergeInto": "Merge into {targets} (--no-ff)",
				"finish.tag": "Create tag {tag}",
				"finish.version": "Set package.json version to {version}",
				"finish.push": "Push the branches and tag to origin",
				"finish.delete": "Delete the finished local branch",
				"finish.versionLabel": "Version",
				"finish.submit": "Finish and merge",
				"finish.tagExists": "Tag {tag} already exists; pick another version first",
				"finish.done": "Finished {branch}",
				"finish.partial": "{branch} finished locally, but the push failed: {detail}",
				"finish.merged": "Merged into {targets}",
				"finish.tagCreated": "Created tag {tag}",
				"finish.versionWritten": "Committed version {version}",
				"finish.deleted": "Deleted the local branch",
				"finish.pushFail": "Push failed: {detail}",
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
				"commit.discard": "Discard changes",
				"commit.discardTitle": "Discard these files?",
				"commit.discardBody": "This restores {count} files to HEAD: tracked edits are dropped and untracked files are deleted. It cannot be undone.",
				"commit.discardDone": "Discarded changes in {count} files",
				"commit.discardOne": "Discard changes in “{path}”",
				"commit.resize": "Drag to resize the panel",
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
				"pull.done": "Pulled {branch}",
				"status.clean": "Working tree clean",
				"status.conflict": "Conflicted files",
				"error.notRepository": "This workspace is not a git repository",
				"error.notInstalled": "git is not available on this machine",
				"error.timeout": "The git command timed out",
				"error.noRoute": "This session has no model route yet; send one turn first",
				"error.detached": "The worktree has a detached HEAD; switch to a branch first",
				"error.noFiles": "Select at least one file",
				"error.invalid": "Invalid input: {detail}",
				"error.failed": "Operation failed: {detail}",
				"error.developMissing": "This repository has no develop branch yet; create it first",
				"error.mergeConflict": "The merge conflicted; resolve the conflicts before finishing",
				"error.tagExists": "That tag already exists: {detail}",
				"error.gitflowBranchRequired": "This branch is not a feature, release, or hotfix branch"
			}
		};
		//#endregion
		//#region src/client/styles.ts
		/**
		* The one stylesheet this plugin needs. Inline styles cannot reach inside the
		* primitive components (the checkbox labels its own text, the modal card owns
		* its width), so the few rules that must cross that boundary live here and are
		* installed once per client fiber.
		* @module dsh-git-flow/client/styles
		*/
		const STYLE_ID = "dsh-git-flow-styles";
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
`;
		/**
		* Install the stylesheet for this fiber.
		* @returns a disposer removing the style element.
		*/
		function installStyles() {
			if (document.getElementById(STYLE_ID) !== null) return () => {};
			const element = document.createElement("style");
			element.id = STYLE_ID;
			element.textContent = CSS;
			document.head.appendChild(element);
			return () => {
				element.remove();
			};
		}
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
			ctx.effect(installStyles, "dsh-git-flow: stylesheet");
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
