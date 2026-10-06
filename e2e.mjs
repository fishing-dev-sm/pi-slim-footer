// e2e.mjs — pi-slim-footer E2E：真实加载 src/index.ts，模拟 pi runtime 全链路验证
// 运行：node --experimental-strip-types e2e.mjs
// 链路：extension factory → pi.on/registerCommand → session_start → ctx.ui.setFooter →
//       factory(tui, theme, footerData) → render(width) → 多行输出
// 覆盖：双主题渲染、/slim-footer 切换主题与启停、插件行位置管理（数轴坐标：正上负下、默认同行 -1、
//       同号挤一行、命令改行号、旧配置坐标轴迁移）、status 映射（yolo→AUTO / 未知→插件行 / 无）、
//       git 分支有无、tps/cost 事件流、每行宽度断言
// 产物：ANSI 真色输出 + PASS/FAIL 断言汇总（可重复运行，结束恢复原配置）

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import ext from "./src/index.ts";

const CONFIG_PATH = join(homedir(), ".pi", "agent", "slim-footer.json");
const hadConfig = existsSync(CONFIG_PATH);
const configBackup = hadConfig ? readFileSync(CONFIG_PATH, "utf8") : null;

const writeConfig = (obj) => writeFileSync(CONFIG_PATH, JSON.stringify(obj));

// ── ANSI theme stub（theme.style 收到 parseColor 的 {kind:"rgb",r,g,b}）──
const RESET = "\x1b[0m";
const ansi = (c, bg) => (c?.kind === "rgb" ? `\x1b[${bg ? 48 : 38};2;${c.r};${c.g};${c.b}m` : "");
const theme = {
	style: (text, { fg, bg } = {}) => `${ansi(fg)}${ansi(bg, true)}${text}${RESET}`,
};

function vwidth(s) {
	s = s.replace(/\x1b\[[0-9;]*m/g, "");
	let w = 0;
	for (const ch of s) {
		const cp = ch.codePointAt(0);
		w += cp >= 0x1100 && (cp <= 0x115f || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x1f300 && cp <= 0x1f64f)) ? 2 : 1;
	}
	return w;
}
const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

let pass = 0,
	fail = 0;
function check(name, cond) {
	if (cond) pass++;
	else fail++;
	console.log(`  ${cond ? "✅" : "❌"} ${name}`);
}

// ── 构造 fake pi / ctx / footerData ───────────────────────────
function makeRuntime({ statuses = { ext0: "yolo" }, branch = "main", thinking = "high" } = {}) {
	const handlers = {};
	let commandDef = null;
	let footerFactory = null;
	const selectQueue = [];
	const selectCalls = [];
	const notifications = [];

	const pi = {
		on: (ev, fn) => ((handlers[ev] ??= []).push(fn), undefined),
		registerCommand: (name, def) => (commandDef = { name, ...def }),
		getThinkingLevel: () => thinking,
	};
	const tui = { renders: 0, requestRender() { this.renders++; } };
	const footerData = {
		getGitBranch: () => branch,
		getExtensionStatuses: () => new Map(Object.entries(statuses)),
		onBranchChange: () => () => {},
	};
	const ctx = {
		hasUI: true,
		cwd: "/home/sim/code/pi-slim-footer",
		model: { provider: "kimi-coding", id: "k3", contextWindow: 1_000_000, reasoning: true },
		getContextUsage: () => ({ tokens: 16_000 }),
		sessionManager: {
			getBranch: () => [
				{ type: "message", message: { role: "user" } },
				{ type: "message", message: { role: "assistant", usage: { input: 1000, output: 500, cost: { total: 0.02 } } } },
			],
		},
		ui: {
			setFooter: (f) => (footerFactory = f),
			select: async (title, options) => (selectCalls.push({ title, options }), selectQueue.shift()),
			notify: (msg, level) => notifications.push({ msg, level }),
		},
	};
	const fire = (ev, payload = {}) => handlers[ev]?.forEach((fn) => fn(payload, ctx));
	return { pi, tui, footerData, ctx, fire, getFooter: () => footerFactory, queueSelect: (x) => selectQueue.push(x), selectCalls, notifications, getCommand: () => commandDef };
}

// ── 渲染器：打印 + 每行宽度断言 + 行数断言 ─────────────────────
const WIDTHS = [110, 80, 52];
function renderAllWidths(rt, label, expectedLines) {
	console.log(`  ── ${label} ──`);
	const footer = rt.getFooter()(rt.tui, theme, rt.footerData);
	let lastLines = [];
	for (const w of WIDTHS) {
		const lines = footer.render(w);
		lastLines = lines;
		for (const [i, l] of lines.entries()) console.log(`  [w=${w} L${i}] ${l}`);
		check(`${label} w=${w}: 行数=${expectedLines}`, lines.length === expectedLines);
		for (const [i, l] of lines.entries()) check(`${label} w=${w} L${i}: 宽度 ${vwidth(l)} <= ${w}`, vwidth(l) <= w);
	}
	return lastLines;
}

try {
	// ── 1) badges 主题 + yolo → AUTO 徽章在第 0 行，单行 ──
	writeConfig({ theme: "badges" });
	const rt = makeRuntime({ statuses: { "pi-permission-system": "yolo" }, branch: "main" });
	ext(rt.pi);
	rt.fire("session_start");
	check("session_start 后 setFooter 被调用", typeof rt.getFooter() === "function");
	check("/slim-footer 命令已注册", rt.getCommand()?.name === "slim-footer");

	// tps + cost 事件流
	rt.fire("message_start", { message: { role: "assistant" } });
	rt.fire("message_update", { message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", delta: "x".repeat(400) } });
	rt.fire("message_end", { message: { role: "assistant", usage: { output: 100, cost: { total: 0.006 } } } });

	const lines1 = renderAllWidths(rt, "A badges · AUTO(yolo) · git main", 1);
	check("AUTO 徽章在第 0 行", plain(lines1[0]).includes("AUTO"));

	// ── 2) /slim-footer 切换 mixed 主题 ──
	rt.queueSelect("mixed   colored status + dim data theme (B)");
	await rt.getCommand().handler("", rt.ctx);
	check("切换后写配置 theme=mixed", JSON.parse(readFileSync(CONFIG_PATH, "utf8")).theme === "mixed");
	renderAllWidths(rt, "B mixed · AUTO(yolo) · git main", 1);

	// ── 3) 未知插件 status：默认另起 -1 行（下方），不混入我们的行 ──
	writeConfig({ theme: "badges" });
	const rt2 = makeRuntime({ statuses: { swarm: "01a11146-d212", "swarm-roster": "● MANAGER LEADER" }, branch: "main", thinking: "off" });
	ext(rt2.pi);
	rt2.fire("session_start");
	const lines3 = renderAllWidths(rt2, "A badges · 两个插件status(默认同行-1)", 2);
	check("插件 status 不在第 0 行", !plain(lines3[0]).includes("MANAGER") && !plain(lines3[0]).includes("01a11146"));
	check("同号挤一行：两个插件同在 -1 行", plain(lines3[1]).includes("MANAGER") && plain(lines3[1]).includes("01a11146"));

	// ── 4) /slim-footer 管理插件行位置：swarm-roster → +1（上方独立行）──
	rt2.queueSelect("Plugin line positions… (2 plugins)");
	rt2.queueSelect("swarm-roster  →  line -1  \"● MANAGER LEADER\"");
	rt2.queueSelect("Line +1 · 1 above main line");
	await rt2.getCommand().handler("", rt2.ctx);
	check("配置写入 pluginLines", JSON.parse(readFileSync(CONFIG_PATH, "utf8")).pluginLines?.["swarm-roster"] === 1);
	// 行号菜单必须按数轴排序：+9 在最顶，+1 紧贴主行上方，然后 -1..-9
	const lineMenu = rt2.selectCalls.find((c) => c.title?.startsWith("Which line for"));
	check("行号菜单按数轴排序（+9…+1,-1…-9）",
		lineMenu?.options?.[0]?.startsWith("Line +9") && lineMenu?.options?.[8]?.startsWith("Line +1") &&
		lineMenu?.options?.[9]?.startsWith("Line -1") && lineMenu?.options?.[17]?.startsWith("Line -9") &&
		lineMenu?.options?.length === 18);
	const lines4 = renderAllWidths(rt2, "A badges · roster→+1(上方) + swarm→-1(下方)", 3);
	check("roster 在最上方（第 +1 行）", plain(lines4[0]).includes("MANAGER"));
	check("我们的主行在中间", plain(lines4[1]).includes("kimi-coding/k3"));
	check("swarm 在最下方（第 -1 行）", plain(lines4[2]).includes("01a11146"));

	// ── 4b) 自带 ANSI 样式的插件 status：原样透传，不包我们的灰徽章（无前导灰块）──
	writeConfig({ theme: "badges" });
	const rt2b = makeRuntime({ statuses: { swarm: "\x1b[38;2;0;0;0m\x1b[48;2;6;182;212m ● MANAGER-01a11157 \x1b[49m\x1b[39m" }, branch: "main" });
	ext(rt2b.pi);
	rt2b.fire("session_start");
	const lines4b = renderAllWidths(rt2b, "A badges · 插件自带ANSI→透传", 2);
	check("自带样式的 status 原样出现在插件行", lines4b[1].includes("48;2;6;182;212"));
	check("插件行无前导灰块（zinc 底空格）", !lines4b[1].includes("48;2;63;63;70"));

	// ── 4c) 旧配置坐标轴迁移：{swarm:-1}（旧义=上方）→ 自动取反为 +1（新义=上方），视觉位置不变 ──
	writeConfig({ theme: "badges", pluginLines: { swarm: -1 } });
	const rt2c = makeRuntime({ statuses: { swarm: "01a11146-d212" }, branch: "main" });
	ext(rt2c.pi);
	rt2c.fire("session_start");
	const migrated = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
	check("旧配置行号取反迁移（-1 → +1）", migrated.pluginLines?.swarm === 1);
	check("迁移后写入 axisMigrated 标记", migrated.axisMigrated === true);
	const lines4c = renderAllWidths(rt2c, "A badges · 迁移后 swarm 仍在上方", 2);
	check("迁移后视觉位置不变（swarm 在主行上方）", plain(lines4c[0]).includes("01a11146") && plain(lines4c[1]).includes("kimi-coding/k3"));

	// ── 5) 无 status + disable/enable ──
	writeConfig({ theme: "badges" });
	const rt3 = makeRuntime({ statuses: {}, branch: "main" });
	ext(rt3.pi);
	rt3.fire("session_start");
	renderAllWidths(rt3, "A badges · 无 status", 1);
	rt3.queueSelect("disable  restore pi default footer");
	await rt3.getCommand().handler("", rt3.ctx);
	check("disable 后 setFooter(undefined)", rt3.getFooter() === undefined);
	rt3.queueSelect("enable");
	await rt3.getCommand().handler("", rt3.ctx);
	check("enable 后重新挂载", typeof rt3.getFooter() === "function");

	// ── 6) 事件触发重渲染 ──
	const before = rt3.tui.renders;
	rt3.fire("thinking_level_select");
	check("thinking_level_select 触发 requestRender", rt3.tui.renders > before);
} finally {
	if (configBackup !== null) writeFileSync(CONFIG_PATH, configBackup);
	else if (existsSync(CONFIG_PATH)) unlinkSync(CONFIG_PATH);
}

console.log(`\n  ${fail === 0 ? "🎉" : "💥"} E2E 结果：${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
