// demo.mjs — pi-slim-footer 一行设计稿 v2（低饱和版）
// 运行：node demo.mjs
// 设计语言抄 famous-anime-cache-countdown（FACC）：反白徽章 + braille 条 + WCAG contrastFg
// v2 变更：① 全调色板降饱和（HSL sat×0.45）；② yolo 徽章改为权限模式徽章：
//   yolo → ` AUTO `（绿）/ plan → ` PLAN `（紫）/ 默认 → ` ASK WHEN NEED `（灰）
//   依据：permission-system 目前只发 "yolo"（src/config/status.ts:13），其余映射预留

const RESET = "\x1b[0m";
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = (r, g, b) =>
	"#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

// style：与 FACC index.ts StyleFn 同签名（text, fgHex, bgHex?），输出 ANSI 真色
const style = (text, fgHex, bgHex) => {
	const f = hexToRgb(fgHex);
	const fg = `\x1b[38;2;${f.join(";")}m`;
	const bg = bgHex ? `\x1b[48;2;${hexToRgb(bgHex).join(";")}m` : "";
	return `${fg}${bg}${text}${RESET}`;
};

// WCAG 对比度选反白字色（与 FACC contrastFg 一致）
function contrastFg(bgHex) {
	const [r, g, b] = hexToRgb(bgHex);
	const ch = (v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	const lum = 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
	return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? "#000000" : "#ffffff";
}

// ── 降饱和：hex → HSL（sat×sMul, lum×lMul）→ hex ─────────────
function mute(hex, sMul = 0.45, lMul = 0.9) {
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
	const hue2rgb = (p, q, t) => {
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

// ── 调色板（Tailwind 原色 → 降饱和版；base 注释供对照）────────
// 徽章底用 BG（更深 sat×0.4 lum×0.75），前景元素用 FG（sat×0.5 lum×1.0）
const badge = (hex) => mute(hex, 0.3, 0.72);
const fore = (hex) => mute(hex, 0.4, 1.0);
const C = {
	green: fore("#22c55e"), // ctx <40% 前景
	greenBg: badge("#22c55e"),
	yellow: fore("#eab308"), // ctx 40-60%
	yellowBg: badge("#eab308"),
	orange: fore("#f97316"), // ctx 60-75%
	orangeBg: badge("#f97316"),
	red: fore("#ef4444"), // ctx 75-90%
	redBg: badge("#ef4444"),
	deepRedBg: badge("#b91c1c"), // ctx >90%
	slateBg: mute("#334155", 0.5, 1.1), // 模型徽章底（中性深色，基本无彩可降）
	violet: fore("#8b5cf6"), // git / PLAN
	violetBg: badge("#8b5cf6"),
	cyanBg: badge("#0891b2"), // tps
	zincBg: mute("#3f3f46", 1.0, 1.0), // cost / 系统段底（本就灰）
	dim: mute("#64748b", 0.7, 1.0), // 次要文字
	faint: mute("#475569", 0.7, 1.1), // 最次要（目录）
};

// ── 简易 visibleWidth（CJK/全角/emoji 算 2 列）─────────────────
function vwidth(s) {
	s = s.replace(/\x1b\[[0-9;]*m/g, "");
	let w = 0;
	for (const ch of s) {
		const cp = ch.codePointAt(0);
		if (
			cp >= 0x1100 &&
			(cp <= 0x115f || cp === 0x2329 || cp === 0x232a || (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
				(cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) ||
				(cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1f64f) ||
				(cp >= 0x20000 && cp <= 0x3fffd))
		)
			w += 2;
		else w += 1;
	}
	return w;
}

// ── braille 用量条：8 格 × 垂直 3 级（⣀⣤⣶⣿），从左往右填 ──────
const LEVELS = ["⣀", "⣤", "⣶", "⣿"];
function brailleBar(frac, color, cells = 8) {
	const units = Math.round(Math.max(0, Math.min(1, frac)) * cells * 3);
	let bar = "";
	for (let i = 0; i < cells; i++) {
		const level = Math.max(0, Math.min(3, units - i * 3));
		bar += style(LEVELS[level], color);
	}
	return bar;
}

// ctx 用量 → 五段色（前景/徽章底成对返回）
function ctxPhase(pct) {
	if (pct < 40) return { fg: C.green, bg: C.greenBg };
	if (pct < 60) return { fg: C.yellow, bg: C.yellowBg };
	if (pct < 75) return { fg: C.orange, bg: C.orangeBg };
	if (pct < 90) return { fg: C.red, bg: C.redBg };
	return { fg: C.red, bg: C.deepRedBg };
}

// ── 权限模式徽章（核心卖点：扩展 status 一等公民）─────────────
// permission-system 现状：yolo 时发 "yolo"，否则无 status（status.ts:13,25-28）
// 映射表预留：yolo/auto→AUTO（黄）、plan→PLAN（紫）、ask/default→ASK WHEN NEED（灰）
// 未知 status：原样展示，灰底（不抢戏）
function modeBadge(status) {
	if (status === undefined || status === null) return null;
	const s = status.toLowerCase();
	if (s === "yolo" || s === "auto") return style(" AUTO ", contrastFg(C.yellowBg), C.yellowBg);
	if (s === "plan") return style(" PLAN ", "#ffffff", C.violetBg);
	if (s === "ask" || s === "default" || s === "ask-when-need") return style(" ASK WHEN NEED ", "#ffffff", C.zincBg);
	return style(` ${status} `, "#ffffff", C.zincBg); // 未知扩展 status：原样灰徽章
}

// tps 速度变色：冷→暖表示慢→快（蓝 <10，青 10-30，绿 30-60，橙 >60）
function tpsBg(tps) {
	if (tps < 10) return badge("#3b82f6"); // 慢：蓝
	if (tps < 30) return badge("#14b8a6"); // 中：青
	if (tps < 60) return badge("#22c55e"); // 快：绿
	return badge("#f97316"); // 飙：橙
}

// ── 演示数据（对齐 statusline-pi 真实输出）─────────────────────
const INFO = {
	status: "yolo", // 扩展 status 原文（permission-system 发的就是 "yolo"）
	ctxPct: 1.6,
	ctxWin: "1M",
	model: "kimi/k3",
	thinking: "high",
	cost: "$0.026",
	tps: 40,
	branch: "main",
	dir: "~/code/pi-slim-footer",
};

// ═══════════════════════════════════════════════════════════════
// 方案 A —— 全徽章（FACC 重度风格：每段都是反白徽章）
// ═══════════════════════════════════════════════════════════════
function badgesA(info) {
	const pc = ctxPhase(info.ctxPct);
	// [优先级, 文本]；0 = 永不丢弃
	const segs = [];
	const mb = modeBadge(info.status);
	if (mb) segs.push([0, mb]);
	segs.push([1, style(` ${info.model} ${info.thinking} `, "#e2e8f0", C.slateBg)]);
	segs.push([
		2,
		style(" CTX ", contrastFg(pc.bg), pc.bg) + brailleBar(info.ctxPct / 100, pc.fg) + style(` ${info.ctxPct}%·${info.ctxWin} `, contrastFg(pc.bg), pc.bg),
	]);
	segs.push([5, style(` ${info.cost} `, "#e4e4e7", C.zincBg)]);
	segs.push([4, style(` ${info.tps} tps `, contrastFg(tpsBg(info.tps)), tpsBg(info.tps))]);
	segs.push([3, style(` ⎇ ${info.branch} `, "#ffffff", C.violetBg)]);
	return segs;
}

// ═══════════════════════════════════════════════════════════════
// 方案 B —— 混合（状态类徽章 + 数据类暗色文字，日常低刺激）
// ═══════════════════════════════════════════════════════════════
function badgesB(info) {
	const pc = ctxPhase(info.ctxPct);
	const segs = [];
	const mb = modeBadge(info.status);
	if (mb) segs.push([0, mb]);
	segs.push([1, style(`${info.model}`, "#cbd5e1") + style(` ${info.thinking}`, C.dim)]);
	segs.push([2, brailleBar(info.ctxPct / 100, pc.fg) + style(` ${info.ctxPct}%`, pc.fg)]);
	segs.push([5, style(info.cost, C.dim)]);
	segs.push([4, style(`${info.tps}t`, C.dim)]);
	segs.push([3, style(`⎇${info.branch}`, C.violet)]);
	return segs;
}

// ── 组装：左段群 + 右对齐目录；超宽按优先级丢弃（数字大的先丢）──
function assemble(segs, dir, width) {
	const dirFull = style(` ${dir}`, C.faint);
	const dirBase = style(` ${dir.split("/").pop()}`, C.faint);

	const tryBuild = (list, dirStr) => {
		const left = list.map(([, t]) => t).join(" ");
		const pad = width - vwidth(left) - vwidth(dirStr);
		if (pad < 1) return null;
		return left + " ".repeat(pad) + dirStr;
	};

	let list = [...segs].sort((a, b) => a[0] - b[0]);
	for (;;) {
		const line = tryBuild(list, dirFull) ?? tryBuild(list, dirBase);
		if (line) return line;
		if (list.length <= 1) return tryBuild(list, "") ?? list.map(([, t]) => t).join(" ");
		const maxP = Math.max(...list.map(([p]) => p));
		list = list.filter(([p]) => p !== maxP);
	}
}

// ── 打印 ──────────────────────────────────────────────────────
const ruler = (w) => "─".repeat(w);
function scene(title, fn, info, width) {
	console.log(`  ${title}  ${style(`(width=${width})`, C.dim)}`);
	console.log(`  ${ruler(width)}`);
	console.log("  " + assemble(fn(info), info.dir, width));
	console.log();
}

console.log();
console.log(style(" pi-slim-footer 设计稿 v2 ", "#ffffff", C.slateBg) + style("  低饱和 · 权限模式徽章 AUTO / PLAN / ASK WHEN NEED", C.dim));
console.log();

console.log(style(" 权限模式徽章（映射：yolo→AUTO，plan→PLAN，默认→ASK WHEN NEED，未知原样灰底）", C.dim));
console.log("  " + [modeBadge("yolo"), modeBadge("plan"), modeBadge("ask"), modeBadge("some-other-status")].join(" "));
console.log();

// ── 方案 A ──
console.log(style(" 方案 A · 全徽章 ", "#ffffff", C.cyanBg) + style("  每段反白（低饱和版）", C.dim));
console.log();
scene("A1 AUTO 模式 · 完整", badgesA, INFO, 110);
scene("A2 PLAN 模式 · 完整", badgesA, { ...INFO, status: "plan" }, 110);
scene("A3 ASK WHEN NEED · 完整", badgesA, { ...INFO, status: "ask" }, 110);
scene("A4 中宽（丢 cost → tps → git）", badgesA, INFO, 80);
scene("A5 窄（只剩 模式 + 模型）", badgesA, INFO, 52);
scene("A6 ctx 高位 85% 变红 · 无 status（无模式徽章）", badgesA, { ...INFO, status: null, ctxPct: 85 }, 110);
scene("A7 tps 速度变色：慢 8t / 中 25t / 快 45t / 飙 85t", badgesA, { ...INFO, tps: 8 }, 78);
console.log("  " + assemble(badgesA({ ...INFO, tps: 25 }), INFO.dir, 78));
console.log("  " + assemble(badgesA({ ...INFO, tps: 45 }), INFO.dir, 78));
console.log("  " + assemble(badgesA({ ...INFO, tps: 85 }), INFO.dir, 78));
console.log();

// ── 方案 B ──
console.log(style(" 方案 B · 混合 ", "#ffffff", C.violetBg) + style("  模式/CTX 彩色，其余暗色文字", C.dim));
console.log();
scene("B1 AUTO 模式 · 完整", badgesB, INFO, 110);
scene("B2 PLAN 模式 · 完整", badgesB, { ...INFO, status: "plan" }, 110);
scene("B3 中宽", badgesB, INFO, 80);
scene("B4 窄", badgesB, INFO, 52);
scene("B5 ctx 高位 85% · 无 status", badgesB, { ...INFO, status: null, ctxPct: 85 }, 110);

// ── 图例 ──
console.log(style(" 图例 ", "#ffffff", C.zincBg));
console.log(
	"  " +
		[
			modeBadge("yolo") + style(" ← 权限模式徽章：扩展 status 一等公民（永不丢弃）", C.dim),
			style(" CTX ", contrastFg(C.greenBg), C.greenBg) + style("⣿⣿⣶⣤⣀⣀⣀⣀", C.green) + style(" ← context 用量条（五段变色）", C.dim),
			style(" kimi/k3 high ", "#e2e8f0", C.slateBg) + style(" ← 模型+思考档", C.dim),
			style(" ⎇ main ", "#ffffff", C.violetBg) + style(" ← git 分支", C.dim),
			[style(8, contrastFg(tpsBg(8)), tpsBg(8)), style(25, contrastFg(tpsBg(25)), tpsBg(25)), style(45, contrastFg(tpsBg(45)), tpsBg(45)), style(85, contrastFg(tpsBg(85)), tpsBg(85))]
				.map((t, i) => style(` ${[8, 25, 45, 85][i]} tps `, contrastFg(tpsBg([8, 25, 45, 85][i])), tpsBg([8, 25, 45, 85][i])))
				.join(" ") + style(" ← tps 速度变色（慢→快：蓝青绿橙）", C.dim),
		].join("\n  "),
);
console.log();
