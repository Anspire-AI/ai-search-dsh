// Anspire AI Search — dsh 客户端模块（设置页插件配置卡片）
//
// 加载机制（dsh-client-modules）：
//   Node 侧扫描 package.json 的 dsh.client 声明 + exports['./client']，
//   serve 到 /plugins/<id>/client.js；浏览器侧 __ModuleLoader__.load 注册
//   factory，首次 require 时物化。
//
// 本模块职责：往 settings.plugin.item 槽注册一张配置卡片，
// 通过 ctx.settingsScope.bind({namespace}) 读写 anspire-ai-search 命名空间。

window.__ModuleLoader__.load({
	id: "anspire-ai-search-dsh-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		//#region 常量
		/** 本插件在 Host 侧注册的 settings 命名空间（与 index.js 的 NS 一致） */
		var NS = "anspire-ai-search";
		/** 卡片自身的文案字典命名空间 */
		var LOCALE_NS = "settings.plugins.anspire";
		//#endregion

		//#region 文案
		var zh = {
			title: "Anspire AI 搜索",
			description: "全网搜索 + 垂域结构化数据（anspire_search 工具）",
			apiKey: "API KEY",
			apiKeyHint: "从 https://open.anspire.cn 获取；留空则使用环境变量 ANSPIRE_API_KEY",
			baseUrl: "API 地址",
			baseUrlHint: "一般无需修改",
			timeoutMs: "请求超时（毫秒）",
			timeoutMsHint: "1000 - 120000",
			defaultTopK: "默认返回条数",
			defaultTopKHint: "10 / 20 / 30 / 40 / 50",
			overridden: "已覆盖",
			reset: "恢复默认",
			invalidNumber: "请输入有效数字",
			unsaved: "有未保存修改",
			readOnly: "当前配置源只读，无法在此修改。",
			saveFailed: "保存失败，请重试。",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			expand: "展开",
			collapse: "收起",
		};
		var en = {
			title: "Anspire AI Search",
			description: "Web search + vertical structured data (anspire_search tool)",
			apiKey: "API KEY",
			apiKeyHint: "Get one at https://open.anspire.cn; empty falls back to ANSPIRE_API_KEY env",
			baseUrl: "API base URL",
			baseUrlHint: "Usually no change needed",
			timeoutMs: "Timeout (ms)",
			timeoutMsHint: "1000 - 120000",
			defaultTopK: "Default result count",
			defaultTopKHint: "10 / 20 / 30 / 40 / 50",
			overridden: "overridden",
			reset: "reset",
			invalidNumber: "Enter a valid number",
			unsaved: "unsaved changes",
			readOnly: "The configuration source is read-only.",
			saveFailed: "Save failed, please retry.",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			expand: "expand",
			collapse: "collapse",
		};
		//#endregion

		//#region 表单状态（staged 编辑，save 时统一写入）
		function numberSpec(field, min, max, step) {
			return {
				field: field,
				format: function (value) { return typeof value === "number" ? String(value) : ""; },
				parse: function (text) {
					var trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					var parsed = Number(trimmed);
					if (!Number.isFinite(parsed)) return undefined;
					if (parsed < min || parsed > max) return undefined;
					if (step !== undefined && (parsed / step) % 1 !== 0) return undefined;
					return { kind: "set", value: parsed };
				},
			};
		}

		function textSpec(field) {
			return {
				field: field,
				format: function (value) { return typeof value === "string" ? value : ""; },
				parse: function (text) {
					var trimmed = text.trim();
					return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
				},
			};
		}

		/** 卡片表单：staged 草稿 + save 统一提交（对齐官方 CardForm 语义） */
		function CardForm(scope, specs) {
			this.scope = scope;
			this.specs = new Map(specs.map(function (s) { return [s.field, s]; }));
			this.staged = new Map();
			this.listeners = new Set();
			this.saving = false;
			this.failed = false;
			var self = this;
			scope.subscribe(function () { self.publish(); });
		}
		CardForm.prototype.publish = function () {
			for (var _i = 0, _a = Array.from(this.listeners); _i < _a.length; _i++) {
				var l = _a[_i]; l();
			}
		};
		CardForm.prototype.snapshotOf = function () { return this.scope.getSnapshot(); };
		CardForm.prototype.sectionValue = function (f) {
			var snap = this.snapshotOf();
			return snap.value ? snap.value[f] : undefined;
		};
		CardForm.prototype.baseValue = function (f) {
			var snap = this.snapshotOf();
			return snap.base ? snap.base[f] : undefined;
		};
		CardForm.prototype.userLayer = function () { return this.snapshotOf().user; };
		CardForm.prototype.stored = function (f) {
			var user = this.userLayer();
			return user !== undefined && Object.prototype.hasOwnProperty.call(user, f);
		};
		CardForm.prototype.spec = function (f) {
			var s = this.specs.get(f);
			if (s === undefined) throw new Error("anspire card has no field " + f);
			return s;
		};
		CardForm.prototype.shell = function () {
			var snap = this.snapshotOf();
			var plan = this.plan();
			return {
				available: snap.status === "ready",
				writable: snap.writable,
				dirty: plan.length > 0,
				invalid: plan.some(function (p) { return p.run === undefined; }),
				saving: this.saving,
				failed: this.failed,
			};
		};
		CardForm.prototype.field = function (f) {
			var staged = this.staged.get(f);
			var spec = this.spec(f);
			if (staged === undefined) {
				return {
					text: spec.format(this.sectionValue(f)),
					overridden: this.stored(f),
					invalid: false,
				};
			}
			var write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
			return {
				text: staged.text,
				overridden: write ? write.kind === "set" : false,
				invalid: write === undefined,
			};
		};
		CardForm.prototype.plan = function () {
			var plan = [];
			var self = this;
			this.staged.forEach(function (staged, f) {
				var spec = self.spec(f);
				if (staged.clear) {
					if (self.stored(f)) plan.push({ field: f, run: function () { return self.clear(f); } });
					return;
				}
				if (staged.text === spec.format(self.sectionValue(f))) return;
				var write = spec.parse(staged.text);
				if (write === undefined) plan.push({ field: f, run: undefined });
				else if (write.kind === "clear") plan.push({ field: f, run: function () { return self.clear(f); } });
				else plan.push({ field: f, run: function () { return self.store(f, write.value); } });
			});
			return plan;
		};
		CardForm.prototype.clear = function (f) {
			var self = this;
			return this.scope.unset(f).then(function () { return !self.stored(f); });
		};
		CardForm.prototype.store = function (f, value) {
			var self = this;
			return this.scope.set(f, value).then(function () {
				var user = self.userLayer();
				return user !== undefined && user[f] === value;
			});
		};
		CardForm.prototype.stage = function (f, edit) {
			this.staged.set(f, edit);
			this.failed = false;
			this.publish();
		};
		CardForm.prototype.discard = function () {
			if (this.staged.size === 0 && !this.failed) return;
			this.staged.clear();
			this.failed = false;
			this.publish();
		};
		CardForm.prototype.save = function () {
			var self = this;
			var plan = this.plan();
			var writes = plan.filter(function (p) { return p.run !== undefined; });
			if (plan.length === 0 || this.saving || writes.length !== plan.length) return Promise.resolve();
			this.saving = true;
			this.failed = false;
			this.publish();
			var landed = true;
			var chain = Promise.resolve();
			writes.forEach(function (w) {
				chain = chain.then(function () {
					return w.run().then(function (ok) { landed = ok && landed; });
				});
			});
			return chain.then(function () {
				if (landed) self.staged.clear();
				self.saving = false;
				self.failed = !landed;
				self.publish();
			});
		};
		/** 供 React useSyncExternalStore 订阅 */
		CardForm.prototype.subscribe = function (listener) {
			var _this = this;
			this.listeners.add(listener);
			return function () { _this.listeners.delete(listener); };
		};
		//#endregion

		//#region React 组件
		var cardCss = [
			".ansp_card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}",
			".ansp_cardHeader{width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;background:none;border:none;font:inherit;text-align:left}",
			".ansp_cardHeader:hover{background:var(--dsw-alias-bg-layer-3)}",
			".ansp_cardTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);display:block}",
			".ansp_cardDesc{font-size:12px;color:var(--dsw-alias-label-tertiary);display:block;margin-top:2px}",
			".ansp_cardBody{padding:4px 14px 14px;border-top:1px solid var(--dsw-alias-border-l2)}",
			".ansp_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}",
			".ansp_field+.ansp_field{border-top:1px solid var(--dsw-alias-border-l2)}",
			".ansp_fieldHead{align-items:center;gap:8px;display:flex}",
			".ansp_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}",
			".ansp_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}",
			".ansp_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:none;border:none;padding:0;font-size:12px}",
			".ansp_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}",
			".ansp_reset:disabled{cursor:default}",
			".ansp_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;width:100%;box-sizing:border-box}",
			".ansp_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}",
			".ansp_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}",
			".ansp_inputInvalid{border-color:var(--dsw-alias-label-error)}",
			".ansp_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}",
			".ansp_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}",
			".ansp_footer{display:flex;align-items:center;gap:8px;padding-top:12px}",
			".ansp_failed{color:var(--dsw-alias-label-error);margin:0 0 0 auto;font-size:12px}",
			".ansp_discard{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:none;border:none;padding:0 4px;font-size:12px}",
			".ansp_discard:disabled{cursor:default;color:var(--dsw-alias-label-tertiary)}",
			".ansp_save{font:inherit;color:var(--dsw-alias-bg-inverse, #fff);cursor:pointer;background:var(--dsw-alias-brand-primary);border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:500;margin-left:8px}",
			".ansp_save:disabled{cursor:default;opacity:.5}",
			".ansp_pending{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-left:auto}",
			".ansp_readonly{color:var(--dsw-alias-label-tertiary);font-size:12px;margin:8px 0 0}",
		].join("\n");
		var cssTag = "anspire-ai-search-dsh-plugin/card.css";
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + cssTag + '"]') === null) {
			var styleTag = document.createElement("style");
			styleTag.dataset.plugin = "anspire-ai-search-dsh-plugin";
			styleTag.dataset.pluginCss = cssTag;
			styleTag.textContent = cardCss;
			document.head.appendChild(styleTag);
		}

		function Field(props) {
			var inputId = react.useId();
			var invalid = props.invalid;
			return react.createElement("div", { className: "ansp_field" },
				react.createElement("div", { className: "ansp_fieldHead" },
					react.createElement("label", { className: "ansp_label", htmlFor: inputId }, props.label),
					props.overridden ? react.createElement("span", { className: "ansp_badge" }, props.overriddenLabel) : null,
					react.createElement("button", {
						type: "button", className: "ansp_reset",
						disabled: props.disabled || !props.overridden,
						onClick: props.onReset,
					}, props.resetLabel),
				),
				react.createElement("input", {
					id: inputId,
					className: invalid ? "ansp_input ansp_inputInvalid" : "ansp_input",
					type: props.secret ? "password" : "text",
					inputMode: props.numeric ? "decimal" : undefined,
					value: props.text,
					disabled: props.disabled,
					autoComplete: "off",
					spellCheck: false,
					onChange: function (e) { props.onEdit(e.target.value); },
				}),
				invalid
					? react.createElement("p", { className: "ansp_invalid" }, props.invalidLabel)
					: react.createElement("p", { className: "ansp_hint" }, props.hint),
			);
		}

		function AnspireCard(props) {
			var t = props.t;
			var state = props.useCard(function (s) { return s; });
			var _a = react.useState(false), open = _a[0], setOpen = _a[1];
			if (!state.available) return null;
			var blocked = !state.dirty || state.invalid || state.saving;
			var disabled = !state.writable;
			return react.createElement("li", { className: "ansp_card" },
				react.createElement("button", {
					type: "button", className: "ansp_cardHeader",
					"aria-expanded": open,
					onClick: function () { setOpen(!open); },
				},
					react.createElement("span", { style: { flex: 1 } },
						react.createElement("span", { className: "ansp_cardTitle" }, t("title")),
						react.createElement("span", { className: "ansp_cardDesc" }, t("description")),
					),
					state.dirty ? react.createElement("span", { className: "ansp_pending" }, t("unsaved")) : null,
					react.createElement("span", { className: "ansp_cardDesc" }, open ? "▴" : "▾"),
				),
				open ? react.createElement("div", { className: "ansp_cardBody" },
					!state.writable ? react.createElement("p", { className: "ansp_readonly", role: "status" }, t("readOnly")) : null,
					react.createElement(Field, {
						label: t("apiKey"), hint: t("apiKeyHint"), secret: true,
						overriddenLabel: t("overridden"), resetLabel: t("reset"), invalidLabel: t("invalidNumber"),
						disabled: disabled, numeric: false,
						text: state.apiKey.text, overridden: state.apiKey.overridden, invalid: state.apiKey.invalid,
						onEdit: function (text) { props.edit("apiKey", text); },
						onReset: function () { props.resetField("apiKey"); },
					}),
					react.createElement(Field, {
						label: t("baseUrl"), hint: t("baseUrlHint"),
						overriddenLabel: t("overridden"), resetLabel: t("reset"), invalidLabel: t("invalidNumber"),
						disabled: disabled, numeric: false,
						text: state.baseUrl.text, overridden: state.baseUrl.overridden, invalid: state.baseUrl.invalid,
						onEdit: function (text) { props.edit("baseUrl", text); },
						onReset: function () { props.resetField("baseUrl"); },
					}),
					react.createElement(Field, {
						label: t("timeoutMs"), hint: t("timeoutMsHint"),
						overriddenLabel: t("overridden"), resetLabel: t("reset"), invalidLabel: t("invalidNumber"),
						disabled: disabled, numeric: true,
						text: state.timeoutMs.text, overridden: state.timeoutMs.overridden, invalid: state.timeoutMs.invalid,
						onEdit: function (text) { props.edit("timeoutMs", text); },
						onReset: function () { props.resetField("timeoutMs"); },
					}),
					react.createElement(Field, {
						label: t("defaultTopK"), hint: t("defaultTopKHint"),
						overriddenLabel: t("overridden"), resetLabel: t("reset"), invalidLabel: t("invalidNumber"),
						disabled: disabled, numeric: true,
						text: state.defaultTopK.text, overridden: state.defaultTopK.overridden, invalid: state.defaultTopK.invalid,
						onEdit: function (text) { props.edit("defaultTopK", text); },
						onReset: function () { props.resetField("defaultTopK"); },
					}),
					react.createElement("div", { className: "ansp_footer" },
						state.failed ? react.createElement("p", { className: "ansp_failed", role: "status" }, t("saveFailed")) : null,
						react.createElement("button", { type: "button", className: "ansp_discard", disabled: !state.dirty || state.saving, onClick: props.discard }, t("discard")),
						react.createElement("button", { type: "button", className: "ansp_save", disabled: blocked, onClick: props.save }, t(state.saving ? "saving" : "save")),
					),
				) : null,
			);
		}
		//#endregion

		//#region 插件主体
		function apply(ctx) {
			// 文案字典（zh/en，按 dsh locale 切换）
			ctx.effect(function () {
				return ctx.locale.register(LOCALE_NS, { zh: zh, en: en });
			}, "anspire-card: dictionaries");

			// 表单：绑定 anspire-ai-search 命名空间
			var scope = ctx.settingsScope.bind({ namespace: NS });
			var form = new CardForm(scope, [
				textSpec("apiKey"),
				textSpec("baseUrl"),
				numberSpec("timeoutMs", 1000, 120000),
				numberSpec("defaultTopK", 10, 50, 1),
			]);

			// snapshot store（useSyncExternalStore 兼容）
			var listeners = new Set();
			var projection = function () {
				return Object.assign(form.shell(), {
					apiKey: form.field("apiKey"),
					baseUrl: form.field("baseUrl"),
					timeoutMs: form.field("timeoutMs"),
					defaultTopK: form.field("defaultTopK"),
				});
			};
			var snapshot = projection();
			var publish = function () {
				snapshot = projection();
				listeners.forEach(function (l) { l(); });
			};
			form.listeners.add(publish);

			var useCard = function (selector) {
				var sel = selector || function (s) { return s; };
				return react.useSyncExternalStore(
					function (onStoreChange) {
						listeners.add(onStoreChange);
						return function () { listeners.delete(onStoreChange); };
					},
					function () { return sel(snapshot); },
					function () { return sel(snapshot); },
				);
			};

			// 注册卡片到 settings.plugin.item 槽（configurable tab 逐卡片渲染）
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					id: "anspire-ai-search",
					order: 30,
					locale: LOCALE_NS,
					inject: function () {
						return {
							hooks: { useCard: useCard },
							edit: function (f, text) { form.stage(f, { text: text, clear: false }); },
							resetField: function (f) {
								form.stage(f, { text: form.spec(f).format(form.baseValue(f)), clear: true });
							},
							save: function () { return form.save(); },
							discard: function () { form.discard(); },
						};
					},
				}, AnspireCard);
			});
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale", "settingsScope"];
		return module.exports;
	},
});
