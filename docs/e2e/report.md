# pi-slim-footer E2E 报告

- 时间：2026-10-06 21:24:51
- 结果：14 PASS / 0 FAIL

## 明细

- ✅ [A] footer 在 30s 内渲染
- ✅ [A] 模型徽章（slate 底）
- ✅ [A] footer 含模型 id
- ✅ [A] CTX 徽章（绿底，低用量）
- ✅ [A] git 徽章（紫底）
- ✅ [A] swarm 插件 status 存在
- ✅ [A] swarm status 与主行不在同一终端行
- ✅ [A] swarm 行无前导灰块（zinc 底）
- ✅ [A] 无裸 'yolo' 独立行
- ✅ [B] footer 在 30s 内渲染
- ✅ [B] 模型徽章（slate 底）
- ✅ [B] footer 含模型 id
- ✅ [B] CTX 徽章已按优先级丢弃
- ✅ [B] git 徽章已按优先级丢弃

## 原始日志

- `A.log`（cols=110, ~/code/pi-fleet）
- `B.log`（cols=52, ~/code/pi-fleet）

复现：`python3 e2e_tui.py`（需 settings.json 已挂载 ../../code/pi-slim-footer 且移除 statusline-pi）