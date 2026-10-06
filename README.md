# pi-slim-footer

**badges**（全徽章主题）

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

**mixed**（状态彩色 + 数据暗文主题）

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> 截图为纯程序渲染（`scripts/screenshots.sh`：真实 `src/index.ts` 出 ANSI 行 → PIL 逐格画 PNG），无终端截图杂质。

pi 的单行 footer 扩展——严格一行、真色徽章、窄终端智能丢弃。替代 statusline-pi。

## 效果

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣀⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

宽终端（badges 主题，真色反白徽章）：模式 / 模型+思考档 / CTX(braille+%+窗口) / git / tps / cost，目录右对齐。

## 特性

- **主行严格单行**：我们自己的内容独占第 0 行，任何宽度下绝不换行；放不下按优先级丢弃
- **插件行管理**：其他插件的 `setStatus` 内容必须另起一行（默认 -1，主行下方一行），`/slim-footer` 里按数轴坐标分配行号（**正数在主行上方，负数在下方**）；**同号挤一行**（一个空格分隔），异号各占一行。菜单提供 ±1..±9 共 18 个槽位，配置文件可手写 ±99 任意整数
- **丢弃序**（数字大先丢）：`cost(6) → 其他扩展 status(5) → tps(4) → git(3) → CTX(2) → 模型(1) → 权限模式(0 永不丢)`
- **权限模式一等公民**：permission-system 的 `yolo` 渲染为黄底 ` AUTO ` 徽章（不再是裸文本第二行）；预留 `plan`→` PLAN `、`ask`→` ASK WHEN NEED `；其他扩展 status 原样灰徽章
- **两个主题**，`/slim-footer` 切换：
  - `badges`（A）：全反白徽章，FACC 风格
  - `mixed`（B）：状态彩色徽章 + 数据暗色文字，低刺激
- **情绪色**：CTX 绿→黄→橙→红→深红五段；tps 按速度变色（<10 蓝 / <30 青 / <60 绿 / ≥60 橙）
- **低饱和调色板**：HSL 降饱和（可配置），长时间盯屏不刺眼

## 安装

`~/.pi/agent/settings.json` 的 `packages` 加本地路径（或发布后 `npm:pi-slim-footer`），并移除 `npm:statusline-pi`（两者都会接管 footer）：

```json
{
  "packages": ["../../code/pi-slim-footer", "...其他包..."]
}
```

## 配置

`~/.pi/agent/slim-footer.json`（全部可选，见 [config.example.json](config.example.json)）：

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## 命令

`/slim-footer` — 菜单：

1. 切换主题 badges / mixed
2. **Plugin line positions…** — 列出所有注册了 footer status 的插件（显示当前 status 预览），逐个分配行号（数轴坐标）：
   ```
   Line +9 … +2 / +1   → 主行上方（+1 紧贴主行）
   Line  0             → slim-footer 主行（不开放给插件）
   Line -1 / -2 … -9   → 主行下方（-1 紧贴主行，默认 -1）
   ```
   同一行号的插件挤在一行，空格分隔；行号持久化到 `pluginLines`（配置文件接受 ±99）

   > v0.3.0 起坐标轴为数轴语义（正上负下）；旧版配置（正下负上）首次加载自动取反迁移并写回 `axisMigrated` 标记。

   插件 status 的渲染规则：**自带 ANSI 样式的文本原样透传**（如 pi-agent-swarm 的青底 MANAGER 徽章），纯文本才包我们的灰徽章。
3. 启用 / 停用（停用恢复 pi 默认 footer）

## 数据来源

| 段 | 来源 |
|---|---|
| 模式徽章 | `footerData.getExtensionStatuses()` 中值为已知模式的项（yolo/plan/ask） |
| 插件行 | `footerData.getExtensionStatuses()` 中其余项，按 `pluginLines` 分行 |
| 模型/思考档 | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()`（pi 内置，不 exec git） |
| tps | `message_start/update/end` 事件估算（抄 statusline-pi） |
| cost | 会话分支 assistant `usage.cost.total` 累计 |

## 测试（E2E）

```bash
node --experimental-strip-types e2e.mjs   # 模拟 runtime 全链路（63 断言）
python3 e2e_tui.py                        # 真实 pi TUI（pty 驱动，14 断言）→ docs/e2e/report.md
```

## 设计

见 [PLAN.md](PLAN.md)。视觉语言源自 [famous-anime-cache-countdown](../famous-anime-cache-countdown)。
