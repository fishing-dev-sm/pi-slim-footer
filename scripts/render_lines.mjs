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

// 临时配置：指定主题
writeFileSync(
	CONFIG_PATH,
	JSON.stringify({ enabled: true, theme: themeName }),
);

const theme = {
	style: (text, { fg, bg } = {}) => {
		const a = (c, isBg) => (c?.kind === "rgb" ? `\x1b[${isBg ? 48 : 38};2;${c.r};${c.g};${c.b}m` : "");
		return `${a(fg)}${a(bg, true)}${text}\x1b[0m`;
	},
};

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
	// 只留 yolo（AUTO 徽章来源），不带其他插件 status——只截主行本体
	getExtensionStatuses: () => new Map([["pi-permission-system", "yolo"]]),
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

// 只截 footer 本体（插件行 + 主行），不带任何会话内容
writeFileSync(outPath, lines.join("\n"));
console.log(`✅ ${outPath}（${lines.length} 行 × ${WIDTH} 列）`);
