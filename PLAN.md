# pi-slim-footer 计划书

> 一个 1-line footer 扩展，用于替换 pi 默认 footer 与 statusline-pi，收编并美化扩展状态文本（如 permission-system 的 "yolo"）。

- 包名：`pi-slim-footer`（已核对 npm，未被占用，2026-10-06）
- 项目路径：`~/code/pi-slim-footer`
- 目标形态：pi extension（TypeScript，pi 可直接运行 `.ts`，无需构建）

---

## 1. 背景与动机

当前 pi 会话中两处 UI 被认为"太丑"，且均无配置项可改：

1. **权限状态文字**：`@gotgenes/pi-permission-system` 在 yolo 模式下通过 `ctx.ui.setStatus()` 向 footer 输出一个裸文本 "yolo"。
   - 位置：`~/.pi/agent/npm/node_modules/@gotgenes/pi-permission-system/src/config/status.ts:31`
   - 该包配置只开放热键映射、终端通知、行数预算，无样式/文案配置。
2. **footer 整体**：当前 footer 由 `statusline-pi` 渲染，它调用 `ctx.ui.setFooter()` 替换了 pi 默认 footer。
   - 位置：`~/.pi/agent/npm/node_modules/statusline-pi/src/index.ts:265`
   - 扩展 status 的渲染在 `:324-327`：`getExtensionStatuses()` 取出的文本**不加任何样式**，`truncateToWidth` 后追加为独立一行——这就是 "yolo" 丑的直接原因。
   - 配置（`~/.pi/agent/statusline-pi.json`）只有 `enabled` 开关。
   - pi 原生默认 footer 更简陋，用户明确表示"原版的 footer 更丑"。

## 2. 关键事实（调研结论）

- pi 官方提供 `ctx.ui.setFooter(factory)`，可完全替换 footer；factory 签名 `(tui, theme, footerData)`，返回 `{ render(width), invalidate(), dispose() }`。
  - 官方示例：`examples/extensions/custom-footer.ts`（pi 安装目录下）
  - `footerData` 提供：`getGitBranch()`、`getExtensionStatuses()`（各扩展 `setStatus` 的文本，含 "yolo"）、`onBranchChange(cb)`。
- 渲染纪律（来自 pi `docs/tui.md`）：
  - 每行必须适配给定宽度；用 `visibleWidth()` / `truncateToWidth()` / `sliceByColumn()` 处理 ANSI、宽字符、emoji。
  - pi 每行后重置样式，颜色需在每行重新施加。
  - 颜色一律走 `theme.fg()` / `theme.style()` 语义色（accent / muted / warning / error / success…），不写死色值。
- 权限弹窗本体（`ctx.ui.custom` 内联组件）不属于 footer，无法被其他扩展接管；本项目不涉及它。
- 本地路径装包已有先例：`settings.json` 的 `packages` 中 `../../code/pi-fleet/packages/pi-agent-swarm`。

## 3. 命名核对

| 名字 | 状态 |
|---|---|
| `pi-footer` | ❌ 已占用（wobondar，0.5.1） |
| `pi-status-footer` / `pi-tidy-footer` | ❌ 已占用 |
| **`pi-slim-footer`** | ✅ **可用，选定** |
| pi-footerline / pi-one-footer / pi-clean-footer 等 | ✅ 可用（备选） |

## 4. 产品定义

- **一句话**：单行（1-line）footer，所有信息压进一行，宽度不够时按优先级丢弃段落，**绝不换行**。
- **核心卖点**（与 statusline-pi 的差异化）：
  1. 严格单行——statusline-pi 在窄终端会 wrap 成多行，本包 wrap 是设计禁区。
  2. 扩展 status（如 "yolo"）一等公民：上色（yolo 用 `error`/`warning`）、加图标/括号、收进主行而非另起一行。
  3. 每个段落可配置开关与顺序（JSON 配置）。

## 5. 段落设计（候选，按建议优先级排序）

| 优先级 | 段落 | 内容来源 | 窄终端处理 |
|---|---|---|---|
| P0 | 扩展 status | `footerData.getExtensionStatuses()` | 永不丢弃（这是本包存在的原因） |
| P1 | 模型 | `ctx.model`（provider/id 缩写） | 缩到只剩模型 id |
| P2 | context 用量 | `ctx.sessionManager` token 统计 | 只留百分比 |
| P3 | git 分支 | `footerData.getGitBranch()` | 截断分支名 |
| P4 | 目录 | `path.basename(ctx.cwd)` | 最先丢弃 |
| P5（可选） | cost / tps / CPU·MEM | 抄自 statusline-pi 的实现 | 默认关闭，配置开启 |

> 待用户确认：最终保留哪些段、顺序、分隔符样式。

## 6. 技术方案

```
pi-slim-footer/
├── package.json        # name: pi-slim-footer, pi-package
├── src/
│   └── index.ts        # ExtensionAPI 默认导出；session_start 时 ctx.ui.setFooter(...)
├── config.example.json # 段落开关/顺序/分隔符配置
└── README.md
```

- 渲染循环：`render(width)` 内按优先级拼装 → `visibleWidth` 超宽则从 P4 向上丢弃/截断 → 单行返回。
- 扩展 status 特殊规则：识别 "yolo" 等已知值给专用样式（`theme.fg("error", "⚠ yolo")`），未知值统一 `warning` 色。
- 刷新：git 分支变化经 `footerData.onBranchChange`；其余段落随 pi 渲染周期被动刷新，状态变化时 `invalidate()` + `tui.requestRender()`。

## 7. 安装与验证

1. 开发期：`~/.pi/agent/settings.json` 的 `packages` 加 `"../../code/pi-slim-footer"`（本地路径）。
2. 同时移除/禁用 `statusline-pi`（两者都调 `setFooter`，会冲突）。
3. E2E 验证（遵循项目规则：只做 E2E，不写单测）：
   - 启动 pi 交互会话，确认 footer 单行渲染；
   - 开 yolo 模式，确认 "yolo" 以新样式出现在主行；
   - 拖窄终端，确认不换行、按优先级丢弃；
   - 可复现产物：截图或 `script` 录制的终端输出。
4. 稳定后 `npm publish` 占名。

## 8. 待决策项（Open Questions）

1. **设计风格**：走 `opscope-tui-style` 科幻面板美学，还是极简纯文字风？（用户尚未拍板）
2. **段落取舍**：第 5 节的 P0–P5 列表需用户确认。
3. 是否复用 statusline-pi 的 cost/tps/CPU 采样逻辑（抄代码 vs 依赖它共存——后者不可行，setFooter 互斥）。

## 9. 不做的事（Non-goals）

- 不改 permission-system 的权限弹窗（`ctx.ui.custom` 组件，不可接管，需 fork 才能改，另立项）。
- 不做多行 footer、不做 overlay/widget。

---

## 完成状态（2025-10-06）

- ✅ `src/index.ts`：setFooter 全接管，双主题，/slim-footer 命令切换
- ✅ E2E：`e2e.mjs` 30/30 PASS（模拟 runtime 全链路）；`e2e_tui.py` 11/11 PASS（真实 pi TUI pty 驱动，产物 docs/e2e/report.md + A.log/B.log）
- ✅ 已挂载 `~/.pi/agent/settings.json`（移除 statusline-pi，插首位 `../../code/pi-slim-footer`）
- ✅ npm publish 占名：`pi-slim-footer` 已发布（0.1.0 → 0.2.0 → 0.2.1，public）

### 实现期对计划的两处修正

1. **未知扩展 status 不再是 priority 0**。真实环境发现 pi-agent-swarm 会 setStatus 三个值（MANAGER-xx / 完整 UUID / LEADER），若永不丢弃会把模型/CTX/git 全部挤出 110 列。改为丢弃优先级 5（紧在 cost 之后丢），显示位置不变（仍在左侧徽章区）；已知模式（yolo/plan/ask）仍为 0 永不丢。
   ⚠️ 已被 v0.2.0 取代：其他插件 status 不再内联进主行，而是独立成行（见下节），本条仅留作决策历史。
2. **显示顺序与丢弃优先级解耦**：`Seg = [priority, text]` 只控制丢弃，显示 = 插入顺序（assemble 不再 sort）。

### v0.2.0：插件状态多行管理（用户新需求）

- 我们独占第 0 行；其他插件 status 一律另起一行（默认第 1 行）
- `/slim-footer` → 插件行位置…：列出所有注册 status 的插件 key + 当前文本预览，逐个分配行号
  （-3..-1 主行上方 / 1..3 主行下方 / 0 不开放）；同号挤一行（空格分隔），异号各占一行
- 行号持久化 `pluginLines: {key: n}`；已知模式 status（yolo/plan/ask）固定第 0 行作 AUTO/PLAN/ASK 徽章，不参与管理
- E2E：e2e.mjs 52/52（新增两行/三行布局、同号挤行、命令改行号场景）；e2e_tui.py 13/13（真机验证 swarm 灰徽章独立行、与主行之间有整行光标移动）
- 实测发现 swarm 的 status 文本自带 ANSI 样式（青底 MANAGER/白底 UUID/黄底 LEADER），透传正常

### v0.2.1：自带 ANSI 样式的插件 status 透传

- 问题：插件行统一包灰徽章 ` ${status} `，但 pi-agent-swarm 的 status 自带 ANSI（青底 MANAGER 等），
  其内部 `\x1b[49m` 重置背景导致前导垫片空格显成孤立灰块
- 修法：`hasOwnAnsi()` 检测 —— 自带样式的 status 原样透传，纯文本才包灰徽章
- E2E：e2e.mjs 63/63（新增透传场景）；e2e_tui.py 14/14（真机断言 swarm 行无前导灰块）

### v0.3.0：菜单全英文 + 数轴坐标（用户反馈）

- 菜单全部改英文（slim-footer settings / badges·mixed theme / Plugin line positions… / Which line for "key"? / enable·disable）
- 坐标轴翻转为数轴语义：**正数在主行上方、负数在下方**（旧版相反）；默认插件行 -1（下方一行，视觉不变）
- 槽位从 6 个扩到 18 个（菜单 ±1..±9）；配置文件接受 ±99 任意整数
- 旧配置自动迁移：pluginLines 非空且无 axisMigrated 标记 → 全部取反并立即落盘（e2e.mjs 场景 4c 验证视觉位置不变）
- e2e_tui.py 修复：测试前强制 theme=badges（结束还原），断言对插件在主行上/下均鲁棒
- E2E：e2e.mjs 75/75；e2e_tui.py 14/14

### v0.3.1：行号菜单按数轴排序（用户反馈）

- 问题：行号菜单列表是 +1..+9 升序，视觉上 +1 离主行最远，违反数轴直觉
- 修法：LINES 改为 [+9..+1, -1..-9]——列表自上而下即数轴从上往下看（+1 紧贴主行上方，-1 紧贴下方）
- E2E：e2e.mjs 76/76（新增菜单选项顺序断言：options[0]=Line +9, [8]=Line +1, [9]=Line -1, [17]=Line -9，共 18 项）

### v0.3.2：README 示例图 + GitHub 发布

- 用户要求：不用真实终端截图（会混入指针/窗口装饰等杂质），纯程序渲染两种主题示例图
- 管线：scripts/render_lines.mjs（真实 src/index.ts + 假 runtime 出 ANSI 真色行，swarm 自带样式透传、60tps 模拟）
  → scripts/ansi2png.py（PIL 逐格绘制；字体链 JetBrainsMono NFM→FreeMono(⎇)→Noto Sans Mono CJK SC；fontTools cmap 判覆盖）
  → scripts/screenshots.sh 一键重生成；产物 docs/screenshots/theme-{badges,mixed}.png（1800×447）
- README 顶部插图（raw.githubusercontent.com 绝对 URL，npm 页可显示）；package.json 加 repository/homepage/bugs
- 首次 git init 推送到 github.com/fishing-dev-sm/pi-slim-footer（SSH alias github-fishing，须带 git@ 前缀）

### v0.3.3：多语言 README（对齐 pi-fleet 模式）

- 9 语言：README.md(English 主) + README.{zh-CN,es,fr,de,ja,ko,pt,ru}.md，顶部语言切换条（相对链接，当前语言加粗）
- 英文版为 canonical；安装段改 npm:pi-slim-footer 优先；顺带修正过时信息（断言数 63→76、丢弃序移除已废弃的内联 status 优先级）；FACC 链接改为绝对 GitHub URL
- package.json files 加 "README*.md"（npm 默认只带 README.md）
