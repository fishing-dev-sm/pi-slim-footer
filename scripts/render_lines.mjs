// scripts/render_lines.mjs — 用真实 src/index.ts 渲染一屏 mock 会话 + footer，输出带 ANSI 真色的行到文件
// 运行：node --experimental-strip-types scripts/render_lines.mjs <badges|mixed> <out.ansi>
// 下游：scripts/ansi2png.py 把 ANSI 行画成 PNG（纯程序渲染，无截图杂质）
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import ext from "../src/index.ts";

const themeName = process.argv[2] === "mixed" ? "mixed" : "badges";
const outPath = process.argv[3];
if (!outPath) {
	console.error("usage: render_lines.mjs <badges|mixed> <out.ansi>");
	process.exit(1);
}
const WIDTH = 110;
const CONFIG_PATH = join(homedir(), ".pi", "agent", "slim-footer.json");
const hadConfig = existsSync(CONFIG_PATH);
const configBackup = hadConfig ? readFileSync(CONFIG_PATH, "utf8") : null;

// 临时配置：指定主题 + swarm-roster 放 +1 行（主行上方），展示多行管理
writeFileSync(
	CONFIG_PATH,
	JSON.stringify({ enabled: true, theme: themeName, pluginLines: { "swarm-roster": 1 }, axisMigrated: true }),
);

const theme = {
	style: (text, { fg, bg } = {}) => {
		const a = (c, isBg) => (c?.kind === "rgb" ? `\x1b[${isBg ? 48 : 38};2;${c.r};${c.g};${c.b}m` : "");
		return `${a(fg)}${a(bg, true)}${text}\x1b[0m`;
	},
};

// swarm 的真实 status 自带 ANSI 样式（青底 MANAGER / 白底 UUID / 黄底 LEADER），透传展示
const SWARM_STATUS =
	"\x1b[38;2;0;0;0m\x1b[48;2;6;182;212m ● MANAGER-01a1112c \x1b[0m" +
	"\x1b[38;2;0;0;0m\x1b[48;2;226;232;240m 01a1112c-59c8 \x1b[0m" +
	"\x1b[38;2;0;0;0m\x1b[48;2;202;138;4m LEADER \x1b[0m";

const handlers = {};
let footerFactory = null;
const pi = {
	on: (ev, fn) => (handlers[ev] ??= []).push(fn),
	registerCommand: () => {},
	getThinkingLevel: () => "high",
};
const ctx = {
	hasUI: true,
	cwd: "/home/sim/code/pi-fleet",
	model: { provider: "deepseek", id: "deepseek-v4-pro", contextWindow: 1_000_000, reasoning: true },
	getContextUsage: () => ({ tokens: 236_000 }), // 23.6% 绿
	sessionManager: {
		getBranch: () => [
			{ type: "message", message: { role: "user" } },
			{ type: "message", message: { role: "assistant", usage: { input: 1000, output: 500, cost: { total: 0.02 } } } },
		],
	},
	ui: { setFooter: (f) => (footerFactory = f), select: async () => undefined, notify: () => {} },
};
const footerData = {
	getGitBranch: () => "main",
	getExtensionStatuses: () =>
		new Map([
			["pi-permission-system", "yolo"],
			["swarm-roster", SWARM_STATUS],
		]),
	onBranchChange: () => () => {},
};

ext(pi);
const fire = (ev, payload = {}) => handlers[ev]?.forEach((fn) => fn(payload, ctx));
fire("session_start");

// tps：模拟一次 1.2s / 72 tok 的响应 → 60 tps（橙色速度徽章）
fire("message_start", { message: { role: "assistant" } });
await new Promise((r) => setTimeout(r, 1200));
fire("message_end", { message: { role: "assistant", usage: { output: 72, cost: { total: 0.006 } } } });

const footer = footerFactory({ requestRender() {} }, theme, footerData);
const lines = footer.render(WIDTH);

// 还原用户配置
if (configBackup !== null) writeFileSync(CONFIG_PATH, configBackup);
else if (existsSync(CONFIG_PATH)) unlinkSync(CONFIG_PATH);

// ── mock 会话内容（暗色，突出 footer；与 footer 同一 ANSI 真色编码）──
const c = (r, g, b) => (s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
const user = c(148, 163, 184);
const dim = c(88, 91, 112);
const faint = c(68, 70, 90);
const mock = [
	user("  ❯ 把 footer 换成 pi-slim-footer，双主题，插件状态另起一行"),
	"",
	dim("  ● Read(src/index.ts)"),
	dim("  ● Edit(src/index.ts)"),
	dim("  ● Bash(node --experimental-strip-types e2e.mjs)"),
	faint("    ⎿  ✓ E2E 结果：76 PASS / 0 FAIL"),
	"",
	dim("  * Cogitated for 4.2s"),
	"",
];

writeFileSync(outPath, [...mock, ...lines].join("\n"));
console.log(`✅ ${outPath}（${mock.length + lines.length} 行 × ${WIDTH} 列）`);
