# Koliance 质量缺口台账（GAP）

> **用途**：本项目**所有未完成事项的唯一台账**。任何"还没做"的东西都必须出现在这里，
> 否则它就不存在。协作者据此判断现状，不要依赖口头同步。
>
> **编号规则**（`提示词.md` 纪律 §4）：`ADR-` 架构决策 · `MIG-` 数据库迁移 · **`GAP-` 质量缺口** · `INC-` 线上故障 · `DEFER-` 延期债务
>
> **维护要求**：新增缺口立刻编号入表；修完把状态改为 ✅ 并附提交号；**不要删除已完成项**（它们是回归基线）。
>
> **最后更新**：2026-10-07 · 分支 `feat/perp-solvency-and-panel`

---

## 0. 归档位置说明（GAP-31）

本仓库的文档分居两处，这是**既有结构问题**：

| 位置 | 内容 | 是否版本控制 |
| --- | --- | --- |
| `koliance/docs/`（仓库内） | `adr/`、`changes/`、**本台账** | ✅ 随代码 |
| `D:\MyDocuments\koliance\docs\`（仓库外） | 项目目标、推进方案、执行方案、推荐方案、缺陷分析、竞品分析 | ❌ **不在 git 下** |

**后果**：协作者 clone 仓库后看不到规划类文档，只能看到 ADR 与变更记录。
**建议**：把仓库外的规划文档迁入 `koliance/docs/planning/`。**未做，见 GAP-31。**

---

## 1. 状态总览

| 状态 | 含义 |
| --- | --- |
| ✅ | 已修复，有测试或命令可验证 |
| 🔴 | 未修复，**有明确阻塞**（见"阻塞"列） |
| 🟠 | 未修复，无阻塞，只是没做 |
| ⬜ | 明确不做（有理由） |

| 编号 | 标题 | 严重度 | 状态 | 提交 / 阻塞 |
| --- | --- | --- | --- | --- |
| GAP-01 | 平仓/清算付款失败致头寸永久卡死 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-02 | 单笔不可付款污染整批清算 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-03 | LP 抽干本金致盈利交易者被拒付 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-04 | `maxPnlCap` 未实现 + 开仓无偿付护栏 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-05 | 破产头寸清算赏金为 0（激励反向） | 🟠 P1 | ✅ | `0193e3a` |
| GAP-06 | 前端/链上清算价同源无一致性测试 | 🟠 P1 | 🟠 | 需链上对拍 |
| GAP-07 | `closePosition` 无价格时效/滑点约束 | 🟠 P1 | 🟠 | — |
| GAP-08 | `_pushPrices` 字符串签名 + 失败无观测 | 🟡 P2 | 🟠 | — |
| GAP-09 | `perpConfig.ts` 的 FEEDS 与链上实测矛盾 | 🟡 P2 | 🟠 | — |
| GAP-10 | 无 CI，全部用例是"门外用例" | 🟡 P2 | ✅ | `2b05f05` |
| GAP-11 | 缺工程骨架目录 | 🟡 P2 | 🟠 | 部分完成 |
| GAP-12 | 凭证硬编码（6 处，含 README 明文） | 🟡 P2 | 🔴 | **需人工轮换密钥** |
| GAP-13 | 后端零链上交互 + `/health` 伪指标 | 🟡 P2 | 🟠 | — |
| GAP-14 | 合成随机行情以"实时数据"形态返回 | 🟡 P2 | 🟠 | — |
| GAP-15 | `docs/changes` 先写后填纪律从未执行 | 🟠 P1 | ✅ | `0193e3a` 起 |
| GAP-16 | `项目目标.md` 交付缺口 | 🔴 P0 | 🟠 | 部分；见 §3 |
| GAP-17 | 负向证伪用例未常驻化 | 🟠 P1 | ✅ | `0193e3a` |
| GAP-18 | RFC `reserve` 无幂等键 → 重复预扣 | 🔴 P0 | ⬜ | 仅采纳 Redis 时激活 |
| GAP-19 | RFC 冻结 TTL 过期 → 资金永久卡死 | 🔴 P0 | ⬜ | 同上 |
| GAP-20 | RFC `HINCRBYFLOAT` 浮点账本漂移 | 🔴 P0 | ⬜ | 同上 |
| GAP-21 | RFC `daily_spent` 无重置机制 | 🟠 P1 | ⬜ | 同上 |
| GAP-22 | RFC 未引用仓库已有 `agentcard` 委托模块 | 🟠 P1 | ⬜ | 设计决策 |
| GAP-23 | RFC 架构与仓库分层不兼容 + 4 处内部矛盾 | 🔴 P0 | ⬜ | 设计决策 |
| GAP-24 | 三套 Session Key 模型互不兼容 | 🟠 P1 | ⬜ | 设计决策 |
| GAP-25 | 全局锁串行化 vs 10,000 TPS 目标 | 🟠 P1 | ⬜ | 无基准测试 |
| GAP-26 | perp 未部署 / 未接线 / 无 Bot | 🔴 P0 | 🟠 | 部分；见 §3 |
| GAP-27 | 逐块资金费率未实现（赛道靶心） | 🟠 P1 | ✅ | 本分支 |
| GAP-28 | 双 lockfile，`npm ci` 装过期树 | 🟡 P2 | 🟠 | — |
| GAP-29 | 缺 `deploy/` 目录 | 🟡 P2 | 🟠 | — |
| GAP-30 | Redis 额度池 | 🟡 P2 | ⬜ | 需先修 GAP-18~21 |
| GAP-31 | 规划文档在仓库外，协作者看不到 | 🟡 P2 | 🟠 | 见 §0 |
| GAP-32 | 覆盖率阈值未配 | 🟡 P2 | 🟠 | — |

---

## 2. 已修复项的验证方式（回归基线）

这些**不要删**。它们是"曾经真实坏过"的证据。

### GAP-01~05 + GAP-17 → `contracts/test/perp/SolvencyGuards.ts`（8 条）

其中 **6 条在修复前实测为红**（另 2 条是控制组）：

| 用例 | 修复前失败原因 |
| --- | --- |
| LP 不能抽干池子（PROBE-F） | `reserve 999e18 must cover the obligation 2197.8e18` |
| 容量不足拒绝开仓（PROBE2） | `Missing expected rejection` |
| 权益截断为 0 USDC 仍能平仓（PROBE-A） | `writeContract` revert |
| 超上限利润封顶而非卡死 | `a payout cap must exist` |
| 单笔不污染整批（PROBE-C） | revert 于 `PositionManager.sol:276` |
| 破产头寸仍有赏金 | `got 0` |

**验证命令**：
```powershell
cd contracts; npx hardhat test test/perp/SolvencyGuards.ts   # 期望 8 passing
```

### GAP-27 → `contracts/test/perp/Funding.ts`（18 条）

核心一条：`can push a position through its maintenance margin on its own` ——
50x 多单、**价格完全不动**，1,500 块后仅凭持仓成本跌破维持保证金。

**验证命令**：
```powershell
cd contracts; npx hardhat test test/perp/Funding.ts          # 期望 18 passing
```

### GAP-10 → `.github/workflows/ci.yml`

三个 job（contracts / frontend / backend），135 个合约用例 + 23 个 vitest + Go 全部入矩阵。

**验证命令**：
```powershell
Test-Path .github/workflows/ci.yml    # 期望 True
```

> ⚠️ **workflow 本身尚未在 GitHub Actions 上跑过**（本地只验证了它调用的每条命令）。
> 首次真实运行才能确认，尤其 `forge-std` 从 GitHub 拉取这一步。
> **另需在仓库设置里手动开启分支保护（required check）**，无法用代码提交完成。

---

## 3. 🔴 有明确阻塞的未竟项

### GAP-16 / GAP-26：perp 模块的交付缺口

`docs/项目目标.md` 要求的五件事，逐项现状：

| 目标要求 | 现状 | 阻塞 |
| --- | --- | --- |
| `Vault.sol` / `PositionManager.sol` | ✅ 已实现，138 用例通过 | — |
| Pyth 拉取式预言机 | ✅ `PythOracleAdapter` 已实现；**美股 feed 在 Monad 上不可用**（`执行方案-后端与合约.md:29-46` 实测） | 外部事实，非缺陷 |
| 前端交易面板 | ✅ `/perp` 页面 + `PositionPanel`，读链不读 mock | — |
| **Go 清算 Bot** | 🟠 **核心已做**（`internal/perp/{position,nonce}`，29 测试 `-race` 通过）；**接链部分未做** | ⛔ **需要 RPC + 已部署的 `PositionManager` 地址** |
| **链上部署** | 🔴 **未做** | ⛔ **需要 `PRIVATE_KEY` + Monad 测试币** |
| `GET /api/v1/liquidations` | 🟠 未做 | ⛔ 依赖 Bot |

**为什么接链部分没写**：写了也无法验证，只会变成"看起来完成了"的代码。
按 `提示词.md` 纪律 §1「读到才算，严禁推断」，**在能跑通之前不写**。

**解除阻塞后要做的**（命令已备好）：

```powershell
cd contracts
npx hardhat ignition deploy ignition/modules/PerpStack.ts --network monadTestnet
npx hardhat run scripts/demo-seed.ts --network monadTestnet
# 把输出的 4 个地址填入根 .env.local
```

然后才轮到：`eth_getLogs` 回填 → WebSocket 订阅 → `abigen` 绑定 → `cmd/liquidator/main.go`。

> **注意**：在地址配置前，`/perp` 页面会显示"Perp 模块未配置"提示。
> **这是设计行为，不是 bug** —— 面板拒绝显示任何数字，因为没有真实数据可显示。

### GAP-12：凭证硬编码

6 处：`config.go:38-44`、`render.yaml:17-28`、`README.md:16-33`、
`src/app/api/auth/github/exchange/route.ts:29,33`。

**阻塞**：轮换密钥需要外部后台操作（Steam / Alpaca / Stripe / GitHub），无法用代码完成。

**建议的最小动作**（不阻塞其他工作）：先从 `README.md` 删除明文凭证——
仓库若公开即等同泄露，而这一步只需 1 分钟。

---

## 4. 设计决策类未竟项（GAP-22~25）

RFC-001（`自治 Agent 交易与链下高性能清结算系统技术架构设计全案.md`）与本仓库现状的冲突。
**结论：不按 RFC 原样落地**，理由见仓库外 `docs/推荐方案-自治Agent清结算.md` §3。

| GAP | 冲突 | 需要谁决策 |
| --- | --- | --- |
| GAP-22 | RFC 把"从零建委托系统"当前提，但 `backend/internal/agentcard` 已有约 70% 的 P0（限额/日限/白名单/冻结/批次归集） | 架构 |
| GAP-23 | RFC 要求 Redis + gRPC + proto + Docker；仓库只有 `net/http` + pgx。且 RFC 内部 4 处自相矛盾 | 架构 |
| GAP-24 | 三套 Session Key 模型（`sk_sess_` 字符串 / PG 地址 / EIP-712）互不兼容，**无代码把内存态写入 PG** | 架构 |
| GAP-25 | `agentcard/service.go:95` 全程持全局锁 → 所有用户授权全局串行化；RFC 要 10,000 TPS | 需先写基准测试 |

**GAP-18~21（RFC 的 Lua 脚本缺陷）** 已实测复现（重复预扣致资金卡死、TTL 丢账、浮点漂移 5e-12、`daily_spent` 永不重置）。
**本次不采纳 Redis，故这四条不激活**；若将来采纳，**必须先修**。

---

## 5. 无阻塞但未做（可直接开工）

| 编号 | 事项 | 起点 | 预估 |
| --- | --- | --- | --- |
| GAP-09 | `src/lib/perpConfig.ts:59-76` 称 `Equity.Index.*` 可用于演示，与链上实测（`priceFeedExists=false`）矛盾 | 改注释或拆分 `AVAILABLE_FEEDS` / `UNAVAILABLE_FEEDS` | 15 分钟 |
| GAP-31 | 规划文档迁入仓库 `docs/planning/` | 复制 6 个文件 | 15 分钟 |
| GAP-28 | 删 `package-lock.json`（陈旧），README 钉死 `pnpm install --frozen-lockfile` | 删除 + 文档 | 15 分钟 |
| GAP-32 | 覆盖率阈值：合约侧 `solidity-coverage`，前端 `vitest --coverage` | 配置 + CI 步骤 | 半天 |
| GAP-29 | `deploy/` 目录（若确需；Render 已够用则可标 ⬜） | — | — |
| GAP-07 | `closePosition` 加 `minOut` 滑点约束 | `PositionManager.sol` | 半天 |
| GAP-08 | `_pushPrices` 改用 `IPyth(priceUpdater)` + 失败发事件 | `PositionManager.sol` | 半天 |
| GAP-06 | 前端强平价与链上对拍测试 | 需要链上部署 | 依赖 GAP-16 |
| GAP-13 | 后端接 go-ethereum，`/health` 改为真实探活 | `backend/` | 1 天 |
| GAP-14 | `/api/market` 的 `Math.random` 路径标注为合成数据并在 UI 明示 | `src/app/api/market/route.ts` | 半天 |
| GAP-11 | 补 `deploy/` 与顶层 `tests/` 的骨架 | — | 30 分钟 |

---

## 6. 明确不做（⬜，附理由）

| 编号 | 事项 | 理由 |
| --- | --- | --- |
| GAP-30 | Redis 额度池 | `想法记录.md:4` 划定范围为"只完成立项/需求/设计/开发/测试和发布"；且 RFC 的 Lua 有 4 个实测缺陷（GAP-18~21），本次不值得引入 |
| GAP-18~21 | 修 RFC Lua 缺陷 | 不采纳 Redis 即不激活。**若将来采纳，必须先修这四条** |
| 05~10 环 | 运维/故障/迭代/自动化 | `想法记录.md:4` 明确不做，"交由平台处理" |

---

## 7. 当前质量基线（用于回归）

分支 `feat/perp-solvency-and-panel`，全部实测：

| 指标 | 数值 | 命令 |
| --- | --- | --- |
| 合约测试 | **138 passing**（3 solidity, 135 nodejs） | `cd contracts && npx hardhat test` |
| 合约类型检查 | exit 0 | `cd contracts && npx tsc --noEmit` |
| 前端单测 | **23 passing**（3 files） | `npx vitest run` |
| 前端类型检查 | exit 0 | `npx tsc --noEmit` |
| 前端 lint | exit 0 | `npx next lint` |
| 前端构建 | ✓ 成功，含 `○ /perp` | `npx next build` |
| 后端构建/静态检查 | exit 0 | `cd backend && go build ./... && go vet ./...` |
| 后端测试 | **29 passing**，`-race` | `cd backend && go test -race ./...` |

**本轮基线变化**：合约 111 → 138（+27），前端单测 9 → 23（+14），后端 0 → 29。

---

## 8. 本轮提交

| 提交 | 内容 |
| --- | --- |
| `0193e3a` | 修 GAP-01~05：出金上限 + 逐笔容错 + 赏金基数（ADR-002） |
| `2c0e353` | `scripts/demo-seed.ts` 按出金上限定容 |
| `36fc5be` | 前端接线：`/perp` + `PositionPanel` + `perpAbi` |
| `2b05f05` | CI 门禁（GAP-10）+ 修 3 个既有类型错误（2 个非本人引入） |
| `8d9c715` | 清算 Bot 核心：头寸数学镜像 + 本地 nonce 管理器 |
| （本次） | 逐块资金费率（GAP-27，ADR-003）+ 本台账 |
