/**
 * pi-slim-footer —— 单行主表盘 + 插件状态多行管理（FACC 风格真色徽章）
 *
 * 设计语言学自 famous-anime-cache-countdown：反白徽章 + braille 条 + WCAG contrastFg，
 * 调色板为 Tailwind 原色经 HSL 降饱和（sat/lum 可在配置里微调）。
 *
 * 行模型（数轴坐标）：我们自己的内容独占第 0 行（严格单行，绝不换行）；其他插件通过 ctx.ui.setStatus
 * 注册的状态必须另起一行，行号按数轴管理——正数在主行上方、负数在下方、0 永远是我们。
 * 配置文件接受 ±99 任意整数行号；/slim-footer 菜单提供 ±1..±9 共 18 个槽位。
 *
 * 第 0 行段落（左→右，括号内为丢弃优先级，0 = 永不丢弃，数字越大越先丢）：
 *   [0] 权限模式徽章：yolo→` AUTO `（黄）、plan→` PLAN `（紫）、ask/default→` ASK WHEN NEED `（灰）
 *   [1] 模型 ` provider/id thinking `（深灰底）
 *   [2] CTX ` CTX ` + 8 格 braille 条（⣀⣤⣶⣿）+ ` pct%·win `，用量五段变色（绿黄橙红深红）
 *   [3] git ` ⎇ branch `（紫底，无分支不显示）
 *   [4] tps 速度徽章：慢→快 蓝/青/绿/橙（<10 / <30 / <60 / ≥60），无数据灰底 `-- tps`
 *   [5] cost ` $0.026 `（灰底，最先丢弃）
 *   右对齐：cwd（~ 折叠），宽度不够缩成 basename，再不够丢弃
 *
 * 主题：`badges`（A，全徽章）/ `mixed`（B，状态彩色+数据暗文），/slim-footer 菜单切换。
 * 配置：~/.pi/agent/slim-footer.json（见 config.example.json），pluginLines 记录插件行号。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseColor, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

// ── 配置 ──────────────────────────────────────────────────────
const CONFIG_PATH = join(homedir(), ".pi", "agent", "slim-footer.json");

type ThemeName = "badges" | "mixed";
interface Saturation {
	badgeSat: number; // 徽章底饱和度系数（0-1）
	badgeLum: number; // 徽章底亮度系数
	foreSat: number; // 前景元素饱和度系数
}
interface SlimFooterConfig {
	enabled: boolean;
	theme: ThemeName;
	saturation: Saturation;
	pluginLines: Record<string, number>; // 插件 status key → 行号（正数上方，负数下方；0 永远是我们，不开放）
	axisMigrated?: boolean; // v0.3.0 数轴翻转迁移标记（旧配置正=下负=上 → 已取反）
}
const DEFAULT_CONFIG: SlimFooterConfig = {
	enabled: true,
	theme: "badges",
	saturation: { badgeSat: 0.3, badgeLum: 0.72, foreSat: 0.4 },
	pluginLines: {},
};

// 插件行号约束：配置文件接受 ±99；菜单提供 ±1..±9（18 槽位）；默认 -1（主行下方一行）
const MIN_PLUGIN_LINE = -99;
const MAX_PLUGIN_LINE = 99;
const MENU_SLOT_MAX = 9;
const DEFAULT_PLUGIN_LINE = -1;

function normalizePluginLine(n: unknown): number | null {
	if (typeof n !== "number" || !Number.isInteger(n)) return null;
	if (n === 0 || n < MIN_PLUGIN_LINE || n > MAX_PLUGIN_LINE) return null;
	return n;
}

function loadConfig(): SlimFooterConfig {
	try {
		const j = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
		// v0.3.0 数轴翻转：旧配置正数=下方、负数=上方 → 全部取反（一次性迁移，写回 axisMigrated 标记）
		const rawLines = (j.pluginLines ?? {}) as Record<string, unknown>;
		const needMigrate = j.axisMigrated !== true && Object.keys(rawLines).length > 0;
		const pluginLines: Record<string, number> = {};
		for (const [k, v] of Object.entries(rawLines)) {
			const n = normalizePluginLine(v);
			if (n !== null) pluginLines[k] = needMigrate ? -n : n;
		}
		const config: SlimFooterConfig = {
			enabled: typeof j.enabled === "boolean" ? j.enabled : DEFAULT_CONFIG.enabled,
			theme: j.theme === "mixed" ? "mixed" : "badges",
			saturation: {
				badgeSat: typeof j.saturation?.badgeSat === "number" ? j.saturation.badgeSat : DEFAULT_CONFIG.saturation.badgeSat,
				badgeLum: typeof j.saturation?.badgeLum === "number" ? j.saturation.badgeLum : DEFAULT_CONFIG.saturation.badgeLum,
				foreSat: typeof j.saturation?.foreSat === "number" ? j.saturation.foreSat : DEFAULT_CONFIG.saturation.foreSat,
			},
			pluginLines,
			...(j.axisMigrated === true || needMigrate ? { axisMigrated: true } : {}),
		};
		if (needMigrate) saveConfig(config); // 迁移立即落盘，避免重复取反
		return config;
	} catch {
		return structuredClone(DEFAULT_CONFIG);
	}
}

function saveConfig(config: SlimFooterConfig): boolean {
	try {
		writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
		return true;
	} catch {
		return false;
	}
}

// ── 色彩工具（与 demo.mjs 一致）────────────────────────────────
const hexToRgb = (h: string): [number, number, number] => [
	parseInt(h.slice(1, 3), 16),
	parseInt(h.slice(3, 5), 16),
	parseInt(h.slice(5, 7), 16),
];
const rgbToHex = (r: number, g: number, b: number): string =>
	"#" +
	[r, g, b]
		.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
		.join("");

/** WCAG 对比度选反白字色（与 FACC / pi-fleet contrastTextColor 一致） */
function contrastFg(bgHex: string): string {
	const [r, g, b] = hexToRgb(bgHex);
	const ch = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	const lum = 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
	return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? "#000000" : "#ffffff";
}

/** 降饱和：hex → HSL（sat×sMul, lum×lMul）→ hex */
function mute(hex: string, sMul: number, lMul: number): string {
	const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
		else if (max === g) h = ((b - r) / d + 2) / 6;
		else h = ((r - g) / d + 4) / 6;
	}
	s *= sMul;
	const l2 = Math.max(0, Math.min(1, l * lMul));
	const hue2rgb = (p: number, q: number, t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	if (s === 0) return rgbToHex(l2 * 255, l2 * 255, l2 * 255);
	const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s;
	const p = 2 * l2 - q;
	return rgbToHex(hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255);
}

/** 上色函数签名：fg 十六进制，bg 可选（徽章用）。footer factory 内用 theme.style 实现 */
export type StyleFn = (text: string, fgHex: string, bgHex?: string) => string;

// ── 调色板（Tailwind 原色 → 降饱和版）─────────────────────────
function buildPalette(sat: Saturation) {
	const badge = (hex: string) => mute(hex, sat.badgeSat, sat.badgeLum);
	const fore = (hex: string) => mute(hex, sat.foreSat, 1.0);
	return {
		green: fore("#22c55e"),
		greenBg: badge("#22c55e"),
		yellow: fore("#eab308"),
		yellowBg: badge("#eab308"),
		orange: fore("#f97316"),
		orangeBg: badge("#f97316"),
		red: fore("#ef4444"),
		redBg: badge("#ef4444"),
		deepRedBg: badge("#b91c1c"),
		slateBg: mute("#334155", 0.5, 1.1),
		violet: fore("#8b5cf6"),
		violetBg: badge("#8b5cf6"),
		zincBg: "#3f3f46",
		dim: mute("#64748b", 0.7, 1.0),
		faint: mute("#475569", 0.7, 1.1),
	};
}
type Palette = ReturnType<typeof buildPalette>;

// ctx 用量 → 五段色（前景/徽章底成对）
function ctxPhase(pct: number, pal: Palette): { fg: string; bg: string } {
	if (pct < 40) return { fg: pal.green, bg: pal.greenBg };
	if (pct < 60) return { fg: pal.yellow, bg: pal.yellowBg };
	if (pct < 75) return { fg: pal.orange, bg: pal.orangeBg };
	if (pct < 90) return { fg: pal.red, bg: pal.redBg };
	return { fg: pal.red, bg: pal.deepRedBg };
}

// tps 速度变色：冷→暖表示慢→快
function tpsBg(pal: Palette, tps: number): string {
	if (tps < 10) return mute("#3b82f6", 0.3, 0.72); // 慢：蓝
	if (tps < 30) return mute("#14b8a6", 0.3, 0.72); // 中：青
	if (tps < 60) return pal.greenBg; // 快：绿
	return pal.orangeBg; // 飙：橙
}

// ── braille 用量条：8 格 × 垂直 3 级（⣀⣤⣶⣿），从左往右填 ──────
const LEVELS = ["⣀", "⣤", "⣶", "⣿"];
function brailleBar(frac: number, color: string, style: StyleFn, cells = 8): string {
	const units = Math.round(Math.max(0, Math.min(1, frac)) * cells * 3);
	let bar = "";
	for (let i = 0; i < cells; i++) {
		const level = Math.max(0, Math.min(3, units - i * 3));
		bar += style(LEVELS[level], color);
	}
	return bar;
}

// ── 权限模式徽章（核心：扩展 status 一等公民）─────────────────
// permission-system 现状只发 "yolo"（其 src/config/status.ts），plan/ask 映射为预留
const KNOWN_MODES = new Set(["yolo", "auto", "plan", "ask", "default", "ask-when-need"]);
const isModeStatus = (status: string) => KNOWN_MODES.has(status.trim().toLowerCase());
const sanitizeStatus = (text: string) => text.replace(/[\r\n\t]+/g, " ").trim();
const hasOwnAnsi = (text: string) => /\x1b\[/.test(text); // 插件自带样式的 status 原样透传，不再包我们的徽章
export function modeBadge(status: string, style: StyleFn, pal: Palette): string {
	const s = status.toLowerCase();
	if (s === "yolo" || s === "auto") return style(" AUTO ", contrastFg(pal.yellowBg), pal.yellowBg);
	if (s === "plan") return style(" PLAN ", "#ffffff", pal.violetBg);
	if (s === "ask" || s === "default" || s === "ask-when-need") return style(" ASK WHEN NEED ", "#ffffff", pal.zincBg);
	return style(` ${status} `, "#ffffff", pal.zincBg); // 未知扩展 status：原样灰徽章
}

// ── 数值格式化 ────────────────────────────────────────────────
const fmtPct = (pct: number) => (pct < 10 ? pct.toFixed(1) : `${Math.round(pct)}`);
function fmtWindow(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
	if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
	return `${n}`;
}
const fmtTps = (tps: number) => (tps < 100 ? tps.toFixed(1) : `${Math.round(tps)}`);

// ── 渲染输入 ──────────────────────────────────────────────────
interface FooterInfo {
	modeStatuses: string[]; // 已知模式 status（yolo/plan/ask…）→ 第 0 行模式徽章
	model: string; // "provider/id"
	thinking: string | null;
	ctxPct: number | null; // null = 无 contextWindow 数据
	ctxWin: number;
	tps: number | null;
	tpsInProgress: boolean;
	cost: number;
	branch: string | null;
	dir: string; // ~ 折叠后的 cwd
}

type Seg = [priority: number, text: string]; // 仅控制丢弃（0=永不丢）：cost5→tps4→git3→CTX2→模型1→模式0；显示顺序=插入顺序

// ═══════════════════════════════════════════════════════════════
// 主题 A · badges —— 全徽章（每段反白）
// ═══════════════════════════════════════════════════════════════
function segmentsBadges(info: FooterInfo, style: StyleFn, pal: Palette): Seg[] {
	const segs: Seg[] = [];
	for (const st of info.modeStatuses) segs.push([0, modeBadge(st, style, pal)]);
	segs.push([1, style(` ${info.model}${info.thinking ? ` ${info.thinking}` : ""} `, "#e2e8f0", pal.slateBg)]);
	if (info.ctxPct !== null) {
		const pc = ctxPhase(info.ctxPct, pal);
		segs.push([
			2,
			style(" CTX ", contrastFg(pc.bg), pc.bg) +
				brailleBar(info.ctxPct / 100, pc.fg, style) +
				style(` ${fmtPct(info.ctxPct)}%·${fmtWindow(info.ctxWin)} `, contrastFg(pc.bg), pc.bg),
		]);
	}
	if (info.branch) segs.push([3, style(` ⎇ ${info.branch} `, "#ffffff", pal.violetBg)]);
	const tbg = info.tps === null ? pal.zincBg : tpsBg(pal, info.tps);
	const tfg = info.tps === null ? "#a1a1aa" : contrastFg(tbg);
	segs.push([4, style(` ${info.tps === null ? "--" : fmtTps(info.tps)} tps${info.tpsInProgress ? "…" : ""} `, tfg, tbg)]);
	segs.push([5, style(` $${info.cost.toFixed(3)} `, "#e4e4e7", pal.zincBg)]);
	return segs;
}

// ═══════════════════════════════════════════════════════════════
// 主题 B · mixed —— 状态彩色徽章 + 数据暗色文字（低刺激）
// ═══════════════════════════════════════════════════════════════
function segmentsMixed(info: FooterInfo, style: StyleFn, pal: Palette): Seg[] {
	const segs: Seg[] = [];
	for (const st of info.modeStatuses) segs.push([0, modeBadge(st, style, pal)]);
	segs.push([1, style(info.model, "#cbd5e1") + (info.thinking ? style(` ${info.thinking}`, pal.dim) : "")]);
	if (info.ctxPct !== null) {
		const pc = ctxPhase(info.ctxPct, pal);
		segs.push([2, brailleBar(info.ctxPct / 100, pc.fg, style) + style(` ${fmtPct(info.ctxPct)}%`, pc.fg)]);
	}
	if (info.branch) segs.push([3, style(`⎇${info.branch}`, pal.violet)]);
	const tpsText = info.tps === null ? "--t" : `${fmtTps(info.tps)}t${info.tpsInProgress ? "…" : ""}`;
	segs.push([4, style(tpsText, pal.dim)]);
	segs.push([5, style(`$${info.cost.toFixed(3)}`, pal.dim)]);
	return segs;
}

// ── 组装：左段群 + 右对齐目录；超宽按优先级丢弃（数字大的先丢）──
function assemble(segs: Seg[], dir: string, width: number, style: StyleFn, pal: Palette): string {
	const dirFull = style(` ${dir}`, pal.faint);
	const dirBase = style(` ${basename(dir)}`, pal.faint);

	const tryBuild = (list: Seg[], dirStr: string): string | null => {
		const left = list.map(([, t]) => t).join(" ");
		const pad = width - visibleWidth(left) - visibleWidth(dirStr);
		if (pad < 1) return null;
		return left + " ".repeat(pad) + dirStr;
	};

	let list = [...segs]; // 不排序：显示顺序=插入顺序，优先级只管丢弃
	for (;;) {
		const line = tryBuild(list, dirFull) ?? tryBuild(list, dirBase);
		if (line) return truncateToWidth(line, width); // 安全网：严格单行
		if (list.length === 0) return "";
		if (list.length === 1) {
			const noDir = tryBuild(list, "");
			if (noDir) return truncateToWidth(noDir, width);
			return truncateToWidth(list[0][1], width);
		}
		const maxP = Math.max(...list.map(([p]) => p));
		list = list.filter(([p]) => p !== maxP);
	}
}

// ── 扩展主体 ──────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
	let config = loadConfig();
	let renderRequested: (() => void) | undefined;

	// tps 追踪（逻辑抄 statusline-pi：完成响应聚合 + 进行中的实时估算）
	let responseStartMs: number | undefined;
	let liveOutputTokens = 0;
	let doneOutputTokens = 0;
	let doneDurationMs = 0;
	let lastSpeedRender = 0;
	const SPEED_RENDER_THROTTLE_MS = 250;

	let sessionCost = 0;
	// 最近一次 render 见到的插件 status（[key, text]），供 /slim-footer 管理菜单使用
	let lastStatusEntries: Array<[string, string]> = [];

	const resetSpeed = () => {
		responseStartMs = undefined;
		liveOutputTokens = 0;
		doneOutputTokens = 0;
		doneDurationMs = 0;
		lastSpeedRender = 0;
	};

	const requestRender = () => renderRequested?.();
	const requestSpeedRender = () => {
		const now = Date.now();
		if (now - lastSpeedRender < SPEED_RENDER_THROTTLE_MS) return;
		lastSpeedRender = now;
		requestRender();
	};

	const currentTps = (): { tps: number | null; inProgress: boolean } => {
		const liveMs = responseStartMs === undefined ? 0 : Date.now() - responseStartMs;
		const totalTokens = doneOutputTokens + liveOutputTokens;
		const totalMs = doneDurationMs + liveMs;
		const inProgress = responseStartMs !== undefined;
		if (totalTokens <= 0 || totalMs <= 0) return { tps: null, inProgress };
		return { tps: totalTokens / (totalMs / 1000), inProgress };
	};

	const aggregateCost = (ctx: ExtensionContext): number => {
		let total = 0;
		for (const e of ctx.sessionManager.getBranch()) {
			if (e.type === "message" && e.message.role === "assistant") {
				const usage = (e.message as { usage?: { cost?: { total?: number } } }).usage;
				total += usage?.cost?.total ?? 0;
			}
		}
		return total;
	};

	function mount(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubBranch = footerData.onBranchChange(() => tui.requestRender());
			renderRequested = () => tui.requestRender();
			const pal = buildPalette(config.saturation);
			const style: StyleFn = (text, fgHex, bgHex) =>
				theme.style(text, { fg: parseColor(fgHex), ...(bgHex ? { bg: parseColor(bgHex) } : {}) });

			return {
				dispose() {
					unsubBranch();
					renderRequested = undefined;
				},
				invalidate() {},
				render(width: number): string[] {
					const contextWindow = ctx.model?.contextWindow ?? 0;
					const usedTokens = ctx.getContextUsage?.()?.tokens ?? 0;
					const thinking = pi.getThinkingLevel?.();
					const speed = currentTps();
					const provider = ctx.model?.provider;
					const modelId = ctx.model?.id ? ctx.model.id.replace(/^models\//, "") : "no-model";

					// 状态分发：已知模式（yolo/plan/ask…）→ 第 0 行模式徽章；
					// 其他插件 status → 按 pluginLines 配置的行号分组（默认第 1 行）
					const modeStatuses: string[] = [];
					const otherByLine = new Map<number, string[]>();
					lastStatusEntries = [];
					for (const [key, rawText] of footerData.getExtensionStatuses?.() ?? []) {
						const text = sanitizeStatus(rawText);
						if (!text) continue;
						lastStatusEntries.push([key, text]);
						if (isModeStatus(text)) {
							modeStatuses.push(text);
							continue;
						}
						const n = normalizePluginLine(config.pluginLines[key]) ?? DEFAULT_PLUGIN_LINE;
						const arr = otherByLine.get(n) ?? [];
						arr.push(text);
						otherByLine.set(n, arr);
					}

					const info: FooterInfo = {
						modeStatuses,
						model: provider ? `${provider}/${modelId}` : modelId,
						thinking: thinking && thinking !== "off" ? thinking : null,
						ctxPct: contextWindow > 0 ? Math.min(100, (usedTokens / contextWindow) * 100) : null,
						ctxWin: contextWindow,
						tps: speed.tps,
						tpsInProgress: speed.inProgress,
						cost: sessionCost,
						branch: footerData.getGitBranch?.() ?? null,
						dir: ctx.cwd.replace(homedir(), "~"),
					};

					const segs = config.theme === "badges" ? segmentsBadges(info, style, pal) : segmentsMixed(info, style, pal);
					const line0 = assemble(segs, info.dir, width, style, pal);

					// 插件行：同号挤一行（一个空格分隔）；数轴坐标——正数在主行上方、负数在下方。
					// 按行号降序排：正数组 +N..+1（上→下）、负数组 -1..-N（上→下），天然正确。
					// 自带 ANSI 样式的 status（如 pi-agent-swarm）原样透传；纯文本包灰徽章。
					const pluginLines = [...otherByLine.entries()]
						.sort((a, b) => b[0] - a[0])
						.map(([n, texts]) =>
							[n, truncateToWidth(texts.map((t) => (hasOwnAnsi(t) ? t : modeBadge(t, style, pal))).join(" "), width)] as const,
						);
					return [
						...pluginLines.filter(([n]) => n > 0).map(([, l]) => l),
						line0,
						...pluginLines.filter(([n]) => n < 0).map(([, l]) => l),
					];
				},
			};
		});
	}

	pi.on("session_start", (_event, ctx) => {
		resetSpeed();
		sessionCost = aggregateCost(ctx);
		if (config.enabled) mount(ctx);
	});

	pi.on("session_shutdown", () => {
		renderRequested = undefined;
		resetSpeed();
		sessionCost = 0;
	});

	pi.on("model_select", (_event, ctx) => {
		resetSpeed();
		sessionCost = aggregateCost(ctx);
		requestRender();
	});

	pi.on("thinking_level_select", () => {
		requestRender();
	});

	pi.on("message_start", (event) => {
		if (event.message.role !== "assistant") return;
		responseStartMs = Date.now();
		liveOutputTokens = 0;
		requestRender();
	});

	pi.on("message_update", (event) => {
		if (event.message.role !== "assistant" || responseStartMs === undefined) return;
		const ev = event.assistantMessageEvent;
		if (ev.type === "text_delta" || ev.type === "thinking_delta" || ev.type === "toolcall_delta") {
			liveOutputTokens += Math.max(1, ev.delta.length / 4);
		}
		requestSpeedRender();
	});

	pi.on("message_end", (event) => {
		if (event.message.role === "assistant" && responseStartMs !== undefined) {
			const durationMs = Date.now() - responseStartMs;
			const usage = (event.message as { usage?: { output?: number; cost?: { total?: number } } }).usage;
			const outputTokens = usage?.output ?? Math.round(liveOutputTokens);
			if (outputTokens > 0 && durationMs > 0) {
				doneOutputTokens += outputTokens;
				doneDurationMs += durationMs;
			}
			sessionCost += usage?.cost?.total ?? 0;
			responseStartMs = undefined;
			liveOutputTokens = 0;
		}
		requestRender();
	});

	pi.registerCommand("slim-footer", {
		description: "slim-footer settings: theme, plugin status lines, enable/disable",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify(`slim-footer: no UI in this mode — edit ${CONFIG_PATH} directly`, "warning");
				return;
			}

			// 可管理的插件 = 当前有非模式 status 的 key ∪ 配置里存过的 key
			const manageableKeys = (): string[] => {
				const modeKeys = new Set(lastStatusEntries.filter(([, t]) => isModeStatus(t)).map(([k]) => k));
				const keys = new Set<string>([...lastStatusEntries.map(([k]) => k), ...Object.keys(config.pluginLines)]);
				return [...keys].filter((k) => !modeKeys.has(k)).sort();
			};

			const cur = config.theme;
			const choice = await ctx.ui.select("slim-footer settings", [
				`badges  all-badge theme (A)${cur === "badges" ? "  ● current" : ""}`,
				`mixed   colored status + dim data theme (B)${cur === "mixed" ? "  ● current" : ""}`,
				`Plugin line positions… (${manageableKeys().length} plugins)`,
				config.enabled ? "disable  restore pi default footer" : "enable",
			]);
			if (!choice) return;

			if (choice.startsWith("badges") || choice.startsWith("mixed")) {
				const next: ThemeName = choice.startsWith("badges") ? "badges" : "mixed";
				if (next === cur) return;
				config.theme = next;
				if (!saveConfig(config)) ctx.ui.notify("slim-footer: could not save config; applies to this session only", "warning");
				if (config.enabled) mount(ctx); // setFooter 替换语义，重挂即换主题
				ctx.ui.notify(`slim-footer theme → ${next}`, "info");
				return;
			}

			if (choice.startsWith("Plugin line positions")) {
				// 循环管理：选插件 → 选行号 → 回到插件列表，直到取消
				const fmtLine = (n: number) => (n > 0 ? `+${n}` : `${n}`);
				// 数轴坐标：正数在主行上方、负数在下方；菜单 ±1..±9 共 18 槽位（配置文件可手写 ±99）
				// 列表顺序 = 数轴从上往下看：+9..+1（+1 紧贴主行上方）、-1..-9（-1 紧贴下方）
				const LINES: number[] = [];
				for (let n = MENU_SLOT_MAX; n >= 1; n--) LINES.push(n);
				for (let n = -1; n >= -MENU_SLOT_MAX; n--) LINES.push(n);
				for (;;) {
					const items = manageableKeys();
					if (items.length === 0) {
						ctx.ui.notify("No manageable plugins yet — plugins appear here after they call ctx.ui.setStatus", "info");
						return;
					}
					const lineOf = (k: string) => normalizePluginLine(config.pluginLines[k]) ?? DEFAULT_PLUGIN_LINE;
					const textOf = (k: string) => lastStatusEntries.find(([kk]) => kk === k)?.[1];
					const pick = await ctx.ui.select(
						"Plugin line positions (line 0 = slim-footer main line, reserved · same number shares a line, space-separated)",
						items.map((k) => {
							const t = textOf(k);
							const preview = t ? `  "${t.length > 24 ? `${t.slice(0, 24)}…` : t}"` : "  (no status right now)";
							return `${k}  →  line ${fmtLine(lineOf(k))}${preview}`;
						}),
					);
					if (!pick) return;
					const key = items.find((k) => pick.startsWith(`${k}  →`));
					if (!key) return;
					const posPick = await ctx.ui.select(
						`Which line for "${key}"? (positive = above main line, negative = below)`,
						LINES.map(
							(n) =>
								`Line ${fmtLine(n)} · ${Math.abs(n)} ${n > 0 ? "above" : "below"} main line${lineOf(key) === n ? "  ● current" : ""}`,
						),
					);
					if (!posPick) continue;
					const m = /^Line ([+-]?\d+)/.exec(posPick);
					if (!m) continue;
					config.pluginLines[key] = Number(m[1]);
					if (!saveConfig(config)) ctx.ui.notify("slim-footer: could not save config; applies to this session only", "warning");
					requestRender();
					ctx.ui.notify(`slim-footer: ${key} → line ${fmtLine(Number(m[1]))}`, "info");
				}
			}

			config.enabled = !config.enabled;
			if (!saveConfig(config)) ctx.ui.notify("slim-footer: could not save config; applies to this session only", "warning");
			if (config.enabled) mount(ctx);
			else ctx.ui.setFooter(undefined);
			ctx.ui.notify(`slim-footer ${config.enabled ? "enabled" : "disabled"}`, "info");
		},
	});
}
