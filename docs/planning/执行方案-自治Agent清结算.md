# Koliance 执行方案：自治 Agent 清结算与逐块资金费率

> **文档性质**：执行方案（落地排期 + 任务分解 + 验证命令）
> **上游设计**：`docs/推荐方案-自治Agent清结算.md`（架构决策与选型理由）
> **设计输入**：`docs/自治 Agent 交易与链下高性能清结算系统技术架构设计全案.md`（RFC-001）
> **代码基线**：`HEAD = 27400fc4b67bd60ea90aaffaac7be7066e037dbb`（`main`）
> **前置台账**：`docs/planning/缺陷分析-审计报告.md`（GAP-01~17）
> **编写日期**：2026-10-07
> **本文档只写"怎么做、谁做、什么时候做、怎么验证"，架构理由一律见推荐方案**

> **⚠️ 归档位置说明**：`docs/adr/` 与 `docs/changes/` 因需随代码版本化，**落在仓库内** `koliance/docs/`；
> 其余规划文档在仓库外 `D:\MyDocuments\koliance\docs\`（该目录**不在 git 下**）。
> 结果是 `adr/changes` 与规划文档**分居两处**，这是本仓库的既有结构缺陷，记为 **GAP-31**。

---

## 进度（截至 2026-10-07）

| 提交 | 内容 | 状态 |
| --- | --- | --- |
| `0193e3a` | Day 1 合约止血：GAP-01/02/03/04/05 修复 + ADR-002 + 8 条负向用例 | ✅ 已完成 |
| `2c0e353` | `scripts/demo-seed.ts`（按出金上限定容）+ `.env.example` 补 perp 地址 | ✅ 已完成 |
| `36fc5be` | Day 2 前端接线：`perpAbi.ts` / `PositionPanel.tsx` / `/perp` 路由 / Navbar | ✅ 已完成 |

**实测基线变化**：

| 指标 | 起点 | 现在 |
| --- | --- | --- |
| `npx hardhat test` | 111 passing | **120 passing**（3 solidity, 117 nodejs） |
| `npx vitest run` | 9 passing | **14 passing**（3 files） |
| `npx tsc --noEmit` | exit=0 | exit=0 |
| `go build` / `go vet` | exit=0 | exit=0 |
| `npx next build` | 未验 | **✓ Compiled，路由表出现 `○ /perp 6.63 kB`** |
| 前端 perp 接线 | 0 处引用 | `/perp` 页面 + 面板 + ABI + 地址配置 |

**仍未做**：链上部署（需 `PRIVATE_KEY` + Monad 测试币）、Go 清算 Bot、`DemoControlPanel`、funding、CI。
`/perp` 页面在地址配置前会显示"未配置"提示——**这是预期行为，不是 bug**。

---

**Day 1 的一个意外收获（必须记录，否则彩排必踩）**：
修复引入的出金上限**改变了彩排的资金规模要求**。
`docs/推进方案.md:135` 的彩排第 2 步写「存入 1000 USDC 流动性」，第 3 步「开 20 笔混合方向仓位」——
这两步**不再兼容**：50x 单笔的出金上限是 `999 + 49,950 = 50,949 USD`，20 笔需约 **1,019,000 USDC**，
而 1,000 USDC 的池子会被 `InsufficientPoolCapacity` 直接拒绝开仓。

`scripts/demo-seed.ts` 已按上限自动定容（实测 1,222,776 USDC，含 20% 余量），
但**彩排清单的表述需同步修正**——见下方 §7.2 的修订版。

---

## 0. 排期的硬约束

| 约束 | 数值 | 来源 |
| --- | --- | --- |
| 提交截止 | **2026-10-13** | `docs/前沿资讯与竞品分析.md:13-20`（⚠️ 外部情报，**未独立核实**，见推荐方案 U-4） |
| 今日 | **2026-10-07** | — |
| **可用自然日** | **6 天** | 10-07 → 10-13 |
| 有效工作日 | **5 天**（扣掉最后半天写提交材料） | 假设 |
| 参赛代码规则 | 只有 **2026-09-01 → 10-13** 新写的代码算数 | `前沿资讯与竞品分析.md:42` |
| 评判口径 | "Judges need to be able to verify what you built" | `前沿资讯与竞品分析.md:263` |
| 人力 | 假设 1 人（原 `执行方案-后端与合约.md:75` 已确认"你同时是 A+B"） | — |

**⚠️ 第 0 天必须先做的决定（阻塞后续全部排期）**

`docs/前沿资讯与竞品分析.md:284` 建议「立刻确认是否真的投 Metropolis」。本排期**假设投**。若不投，`P0-a`（修 4 个 P0）仍需做，但 `P1-a`（funding）可降级。

---

## 1. 【准入审查】开工前必须补的资产

按 `提示词.md` 十环 Gate Matrix，**01/02/03 环准出未达成**。以下 4 项每项 ≤ 30 分钟，**必须在写任何新业务代码之前完成**：

| # | 动作 | 产出 | 验收命令 |
| --- | --- | --- | --- |
| A-1 | 建 `docs/adr/`，把推荐方案 §3.1/§3.2 的决策落成 ADR-002 | `docs/adr/ADR-002-perp单池与预言机抽象.md` | `Test-Path docs/adr/ADR-002-*.md` → True |
| A-2 | 同上，ADR-003 记录清结算选型（含 GAP-23 四处矛盾的裁决） | `docs/adr/ADR-003-清结算架构选型.md` | `Test-Path docs/adr/ADR-003-*.md` → True |
| A-3 | 建 `docs/changes/`，约定"先写后填"（每 commit 一份） | `docs/changes/000-模板.md` | `Test-Path docs/changes` → True |
| A-4 | 建 `.github/workflows/ci.yml`，把 120 个既有用例纳入 | 见 §7.1 的 workflow 全文 | PR 上出现 required check 且绿 |

> **为什么 CI 是准入而不是收尾**：`提示词.md` 十环 03 环准出要求「所有新建测试用例 100% 纳入 CI 自动执行矩阵（**拒绝门外用例**）」。当前 120 个用例（111 hardhat + 9 vitest）全部是门外用例。若先写新代码再补 CI，新用例也会变成门外用例，且**修 GAP-01~04 的回归保护不存在**。

---

## 2. 五天排期总览

```
Day 1  合约止血      GAP-01/02/03/04 修复 + 5 个常驻负向用例（GAP-17）
Day 2  上线          perp 栈部署 10143 + 前端接线 + demo-seed
Day 3  清算 Bot      cmd/liquidator（Go）+ /api/v1/liquidations
Day 4  资金费率      GAP-27 链上实现 + straddle 测试 + 演示面板
Day 5  彩排          端到端彩排 3 遍 + 提交材料 + 收尾 GAP-29/28
```

**关键路径**：`Day1 → Day2 → Day4 → Day5`。Day 3（Bot）与 Day 4（funding）**可部分并行**——Bot 的链上事件回填不依赖 funding 完成。

**若只剩 3 天**：Day1 + Day2 + Day5，Day3/Day4 砍掉。此时资金费率与 Bot 都不做，只保证"链上有可验证的 perp + 前端能开平仓"。

---

## 3. Day 1：合约止血（GAP-01/02/03/04 + GAP-17）

**目标**：让 4 个 P0 缺陷不再存在，且**用常驻负向用例锁死**。

### 3.1 任务分解

| 任务 | 改动位置 | 具体做法 | 验收 |
| --- | --- | --- | --- |
| T1.1 GAP-01 | `PositionManager.sol:185-214`（close）、`:252-281`（liquidate） | **先付款、后 `_close`**；或给 `_close` 加 `try/catch` 语义。推荐**先 `payOut` 后 `_close`**：付款失败则整笔 revert，状态未污染（回到当前行为）但**必须保证 `payOut` 不再因可预期的原因失败** → 依赖 T1.3 | `closePosition` 在 `equity` 舍入到 0 USDC 时**不 revert**（改为跳过付款） |
| T1.2 GAP-02 | `PositionManager.sol:252-281` | 在循环内对**每一笔**做 `try` 语义：单笔付款失败只跳过该笔并 `emit PositionLiquidationFailed`，不中断整批 | 20 笔批 + 1 笔毒丸 → 19 笔关闭、1 笔保持 open、事件发出 |
| T1.3 GAP-03 | `PositionManager.sol:298-304` `reservedAssets()` | 返回 `openCollateralUsd + Σ max(0, unrealizedPnl)`。需遍历 —— **改为维护累加器**：在 open/close/liquidate 时更新 `openNotionalUsd`，并用 `oracle` 现价算总浮盈（每笔读价成本高，**折中方案**：`reserved = openCollateralUsd`（本金）+ `openNotionalUsd * fundingBufferBps`（缓冲），或直接**提高 `reservedAssets` 为本金 × 1.5**） | PROBE-F 场景：LP 无法把自己抽到 `obligated` 之下 |
| T1.4 GAP-04 | `PositionManager.sol:134-180` `openPosition` | 加 `if (sizeUsd > vault.availableAssets() + collateralUsd) revert InsufficientPoolCapacity()` | 1,000 池 + 20×50x 的第 N 笔被 revert |
| T1.5 GAP-17 | `contracts/test/perp/` | 把推荐方案 §4.1 的 5 个探针场景转成常驻测试 | 新用例在**修复前必须红**，修复后绿；`npx hardhat test` 计数从 111 上升 |
| T1.6 回归 | — | 保持 4 项工具链全绿 | 见 §3.3 |

**⚠️ T1.3 是四个里最难的一个，也是最容易做错的。** 完整实现需要每笔头寸的实时浮盈聚合，成本高且 gas 不可控。**推荐先做保守近似**：`reserved = openCollateralUsd + (openNotionalUsd * POOL_BUFFER_BPS / 10000)`，`POOL_BUFFER_BPS = 5000`（即按名义敞口的 50% 预留）。理由：宁可让 LP 少提，也不能让交易者拿不到钱。**把这个近似和它的代价写进 ADR-002**。

### 3.2 先红的负向用例（纪律 §3，必须先写）

```typescript
// contracts/test/perp/BrickedPosition.ts —— T1.5 的产物
// 每个 it() 在修复前必须 FAIL，这是它们的价值所在。

it("DEPRECATED-BEHAVIOUR: a close must NOT brick when equity rounds to 0 USDC", ...)
  // 复现 PROBE-A: DemoOracle.setPrice(NVDA, 162e18 + 1)
  // 断言：closePosition 成功 且 isOpen == false
  // 修复前：revert + isOpen == true  →  FAIL

it("PROBE-C: one bricked position must not poison a whole batch", ...)
  // 断言：liquidate([1,2]) 后 至少一笔被关闭
  // 修复前：整批回滚，两笔都 open  →  FAIL

it("PROBE-F: an LP must not drain principal below the pool's obligation", ...)
  // 断言：LP 全额退出被拒绝（obligated > reserved 时）
  // 修复前：LP 提走 20001 USDC  →  FAIL

it("PROBE-B: the pool cannot pay a winner -> openPosition should have blocked it", ...)
  // 断言：1,000 池 + 50x 的第 2 笔 openPosition revert
  // 修复前：开仓成功，平仓时 revert  →  FAIL

it("GAP-05: a bankrupt position must still pay a non-zero bounty", ...)
  // 断言：equity == 0 时 reward > 0
  // 修复前：reward == 0  →  FAIL
```

### 3.3 Day 1 验收关口（全部必须通过）

```powershell
cd contracts; npx hardhat test
# 期望：111 + 5 = 116 passing（3 solidity, 113 nodejs），且新增 5 条全绿
# ⚠️ 若新增 5 条里有红的，说明修复未完成 —— 不得进入 Day 2

cd ..; npx tsc --noEmit                       # exit=0
npx vitest run                                # 3 files / 9 tests passed
cd backend; go build ./...; go vet ./...      # exit=0
```

**准出判定**：`git diff` 只触及 `PositionManager.sol` / `Vault.sol` / 新增测试文件；`docs/changes/001-*.md` 已写。

---

## 4. Day 2：链上部署与前端接线（GAP-26）

**目标**：让**评委能看到链上地址**。这是本次会议最高价值的一天。

### 4.1 任务分解

| 任务 | 命令 / 位置 | 验收 |
| --- | --- | --- |
| T2.1 领测试币 | Monad 水龙头（`contracts/scripts/deploy-kol.ts:16-18` 已内置余额检查） | 部署账户 MON 余额 > 0 |
| T2.2 部署 perp 栈 | `npx hardhat ignition deploy ignition/modules/PerpStack.ts --network monadTestnet` | `deployed_addresses.json` 出现 `PerpStackModule#*` 4 个地址 |
| T2.3 部署 KolToken | `npx hardhat run scripts/deploy-kol.ts --network monadTestnet` | 合约地址可在 explorer 打开 |
| T2.4 播种演示数据 | **需新建** `contracts/scripts/demo-seed.ts`（`执行方案-后端与合约.md:259` 的原准出物，仍缺） | 脚本输出 20 笔 positionId |
| T2.5 前端接线 | `src/lib/perpConfig.ts` → 加 `PERP_ADDRESSES`；新建 `src/lib/perpAbi.ts` | `src/` 内出现对 perp 地址的引用 |
| T2.6 交易面板 | 新建 `src/components/PositionPanel.tsx`（复用 `src/lib/perp.ts` 的 `liquidationPrice`） | 前端能开仓、显示持仓与强平价 |
| T2.7 演示面板 | 新建 `src/components/DemoControlPanel.tsx`（调 `DemoOracle.bumpPrice`） | 一键 −15% 能改价格 |
| T2.8 .env 同步 | 根 `.env.local` + `contracts/.env` | 见 §4.3 |

### 4.2 `PerpStack.ts` 的已知约束（读代码得出，不是猜的）

`contracts/ignition/modules/PerpStack.ts:26-37` 的部署顺序**不可调换**：

1. `MockUSDC` → 2. `DemoOracle` → 3. `Vault(collateral, account0)` → 4. `PositionManager(vault, oracle, collateral, account0)` → 5. `m.call(vault, "setPositionManager", [pm])`

理由（`PerpStack.ts:8-16` 注释）：Vault 与 PositionManager 互相引用，无法互为构造参数；`setPositionManager` 是**一次性**且 `onlyOwner`，所以**部署账户必须仍是 Vault 的 owner**。

**⚠️ 与 KolToken 的部署账户必须一致**，否则 `NEXT_PUBLIC_KOL_TOKEN_ADDRESS` 对应的 owner 与演示账户不符，`claimBlockReward` 之外的 owner 操作会失败。

### 4.3 环境变量同步（双向对齐，纪律 §5）

```powershell
# 根 .env.local（前端）
NEXT_PUBLIC_KOLIANCE_ADDRESS=0x32fDd6B096EE14246b5b6971135286Bad01F4928
NEXT_PUBLIC_KOL_TOKEN_ADDRESS=0xe18e18604ebe9b7692ac67d2c0f1d5af3aa6cca4
NEXT_PUBLIC_PERP_VAULT=<T2.2 输出>
NEXT_PUBLIC_PERP_POSITION_MANAGER=<T2.2 输出>
NEXT_PUBLIC_PERP_USDC=<T2.2 输出>
NEXT_PUBLIC_PERP_ORACLE=<T2.2 输出>
NEXT_PUBLIC_GO_BACKEND_URL=http://localhost:8080

# contracts/.env
PRIVATE_KEY=<same as deploy>
```

**验收**：`git grep -n "NEXT_PUBLIC_PERP" src/` 有命中，且 `.env.example` 同步更新（当前 `.env.example` 只有 `KOLIANCE_ADDRESS` 与 `KOL_TOKEN_ADDRESS`）。

### 4.4 Day 2 验收关口

```powershell
# ① 链上地址真实存在
Get-Content contracts\ignition\deployments\chain-10143\deployed_addresses.json
# 期望：PerpStackModule# 的 4 个地址 + KolianceModule#Koliance + KolToken

# ② 部署后可读（把 <VAULT> 换成实际地址）
cd contracts
npx hardhat console --network monadTestnet
#   > const v = await viem.getContractAt("Vault", "<VAULT>")
#   > await v.read.totalAssets()      # 期望：播种后的 USD 值（18 位）
#   > await v.read.reservedAssets()   # 期望：> 0（20 笔仓位已开）

# ③ 前端构建通过
cd ..; npm run build                  # 期望成功

# ④ 前端确实引用了 perp
git grep -n "PERP_POSITION_MANAGER" src/
# 期望：≥1 处命中（当前为 0）
```

**准出判定**：explorer 上能看到 5+ 个真实合约地址；前端 `npm run build` 成功；`docs/changes/002-*.md` 已写。

---

## 5. Day 3：Go 清算 Bot（GAP-26）

**目标**：`docs/项目目标.md:22-23` 的路演高光——**1 秒内高并发完成数十笔链上清算**。

### 5.1 新增依赖（只加两个）

```go
// backend/go.mod
require (
    github.com/ethereum/go-ethereum v1.14.x   // ethclient / bind / core/types
    github.com/gorilla/websocket v1.5.x        // 或 coder/websocket，二选一
)
```

**⚠️ 不要引 gRPC / proto**（推荐方案 §3.2 取舍 2）。Bot 通过 `internal/perp` 包复用 `net/http` 之外的**纯链上通路**即可。

### 5.2 目录与任务

```
backend/
  cmd/liquidator/main.go          # 新增：Bot 入口
  internal/perp/chain/client.go   # 新增：go-ethereum 客户端 + abigen 绑定
  internal/perp/oracle/hermes.go  # 新增：Pyth Hermes 轮询客户端
  internal/perp/position/table.go # 新增：头寸内存表（事件回填 + 增量）
  internal/perp/nonce/manager.go  # 新增：本地 nonce 管理器（死保项）
  internal/market/                # 不动！服务现有 /market 页面
```

| 任务 | 做法 | 依据 |
| --- | --- | --- |
| T3.1 链上绑定 | 从 `contracts/artifacts` 用 `abigen` 生成；**生成物提交进仓库** | `执行方案-后端与合约.md:299` |
| T3.2 头寸回填 | `eth_getLogs` 分批（**每 1000 区块切分** + 限流重试） | `执行方案-后端与合约.md:305` |
| T3.3 增量订阅 | WebSocket 订阅新区块 | 同上 |
| T3.4 **本地 nonce 管理** | 单 goroutine 持锁 + channel 发放；**绝不用 `PendingNonceAt` 逐笔取** | `执行方案-后端与合约.md:311-321`（列为"死保项"） |
| T3.5 批量打包 | 待清算头寸**按 feedId 分桶**，同桶共用一次 `liquidate([])` | `推进方案.md:117` |
| T3.6 Gas | 测试网直接拉高 `gasPrice`，不做动态估价 | `执行方案-后端与合约.md:328-330` |
| T3.7 冷启动扫描 | 启动即全量扫一次，避免"前 30 秒没反应" | `执行方案-后端与合约.md:332` |
| T3.8 清算事件 API | `cmd/api/main.go` **新增** `GET /api/v1/liquidations`（内存环形缓冲，最近 100 条）。**不动现有 17 个路由** | `执行方案-后端与合约.md:336-340` |

**⚠️ T3.4 + GAP-05 的相互作用**：审计确认破产头寸的赏金为 0（`equity == 0 → reward == 0`）。若 Bot 按经济逻辑跳过这些头寸，**演示会只清算一部分**。两条对策任选：
- (a) Day 1 顺手修 GAP-05（赏金改为按 `sizeUsd` 计而非 `equity`）；
- (b) Bot 演示模式**不按赏金过滤**，把所有 `isLiquidatable` 的头寸全部提交。

**推荐 (a)**，因为它同时让"清算有经济动机"这句话在路演时站得住。

### 5.3 Day 3 验收关口

```powershell
cd backend; go build ./... ; go vet ./...        # exit=0

# Bot 冷启动后，日志出现结构化回填计数
go run cmd/liquidator/main.go
# 期望日志：backfill complete: N positions from block X..Y

# 前端调价 → 触发清算
#   1) 另开终端跑 cmd/api + npm run dev
#   2) DemoControlPanel 点"调低价格 -15%"
#   3) 断言：Bot 日志 1 秒内出现 N 笔已提交回执
curl http://localhost:8080/api/v1/liquidations
# 期望：JSON 数组，元素含 txHash / positionId / blockNumber

# 链上确认同区块/相邻区块的多笔清算
#   把 txHash 贴进 https://testnet.monadexplorer.com 逐个核对
```

**准出判定**：`/api/v1/liquidations` 返回真实 txHash；explorer 可查到；**连续跑 3 次不失败**（纪律 §5 幂等性）。

---

## 6. Day 4：逐块资金费率（GAP-27，赛道靶心）

**目标**：把官方样例原句 **"perpetuals whose funding refreshes each block"** 变成链上可验证的事实。

### 6.1 为什么这是最高价值的一天

| 依据 | 内容 |
| --- | --- |
| `前沿资讯与竞品分析.md:32-36` | Track 1 官方样例含「perpetuals whose funding refreshes each block」 |
| 同文 `:294` | 「剩下的空位：把逐块资金费率做成真实可演示的东西。别的链做不了这个（资金费率通常 1h/8h 更新一次）」 |
| 同文 `:263` | 评委口径 = 可验证 |
| **代码实测** | perp 合约**完全没有 funding**；但 `Position.openedAt`（`IPositionManager.sol:18`）**只写不读**（`PositionManager.sol:170` 是唯一出现）——**预埋字段已存在** |

> `openedAt` 存在而未被使用，说明原始设计留好了口子。**加 funding 不需要改 `Position` 结构。**

### 6.2 实现规格（供 ADR-002 落盘）

```
状态（PositionManager 或新 FundingRate.sol）：
  mapping(bytes32 => int256) public cumulativeFundingIndex;  // 18 位，可为负
  mapping(bytes32 => uint256) public lastFundingBlock;
  uint256 public constant FUNDING_RATE_PER_BLOCK_BPS = <待定>;  // 例：1 (0.01%/块)

每块（或每个被调用的交易里惰性更新）：
  _updateFunding(feedId):
    elapsed = block.number - lastFundingBlock[feedId]
    if elapsed == 0: return
    // 依赖 openNotionalLong / openNotionalShort 的偏斜
    skew = (longOI - shortOI) / (longOI + shortOI)
    delta = int256(elapsed) * FUNDING_RATE_PER_BLOCK_BPS * skew / BPS_DENOMINATOR
    cumulativeFundingIndex[feedId] += delta
    lastFundingBlock[feedId] = block.number

头寸结算时应用：
  fundingOwed = sizeUsd * (cumulativeFundingIndex_now - entryFundingIndex) / 1e18
  long 付 fundingOwed（>0 时），short 收；符号相反
```

**需要在 `Position` 里加 `entryFundingIndex`** —— 这是唯一的结构变更，需评估是否可接受。**替代方案（推荐，零结构变更）**：用 `entryPrice` 做等价折算，或把 funding **累积进 `entryPrice`** 的调整项。**这个取舍必须写进 ADR-002**。

### 6.3 任务分解

| 任务 | 做法 | 验收 |
| --- | --- | --- |
| T4.1 funding 数学 | 先写纯函数 + TS 侧镜像（`src/lib/perp.ts` 加 `fundingOwed()`） | vitest 覆盖 |
| T4.2 链上实现 | 惰性更新（在 `openPosition`/`closePosition`/`liquidate` 里调 `_updateFunding`） | 每次交易后 `cumulativeFundingIndex` 前进 |
| T4.3 **straddle 测试** | 多空等量 → `skew == 0` → funding 为 0（**这是最关键的一条**） | 多空对消断言 |
| T4.4 单向偏斜测试 | 全多 → long 付、池子收 | 断言方向与符号 |
| T4.5 逐块可观测 | 连续 10 块各跑一次交易，断言 index 单调递增 | blockNumber 递进断言 |
| T4.6 前端展示 | `PositionPanel` 显示当前 funding rate 与累计应付 | 前端可见 |
| T4.7 演示脚本 | 在 `DemoControlPanel` 加"连续 20 块刷新 funding"按钮 | 大屏可演示 |

### 6.4 Day 4 验收关口

```powershell
cd contracts; npx hardhat test
# 期望：116 + ~6 = 122 passing

# 关键断言（必须存在且绿）
#   it("charges zero funding when long and short open interest are equal")
#   it("transfers funding from the heavy side to the light side")
#   it("advances the cumulative funding index once per block")

# 链上可验证性（评委最关心）
#   在 explorer 上找 FundingUpdated 事件，连续多个区块
npx hardhat console --network monadTestnet
#   > await pm.read.cumulativeFundingIndex([NVDA_FEED])
#   连续调用两次之间发一笔交易，期望值变化
```

**准出判定**：explorer 上能看到**连续区块**的 funding 变化；straddle 测试绿；`docs/changes/004-*.md` 已写。

---

## 7. Day 5：彩排与提交

### 7.1 CI workflow（A-4 的产物，此处给全文）

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4        # ⚠️ 必须 pnpm，见 GAP-28
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: cd contracts && npx hardhat test
      - uses: actions/setup-go@v5
        with: { go-version: '1.25' }
      - run: cd backend && go build ./... && go vet ./...
```

**验收**：PR 上 `verify` 为 required check 且绿。这是 `提示词.md` 十环 03 环准出的**唯一凭据**。

### 7.2 彩排清单（`推进方案.md:134-140` 的原文，**已按出金上限修订**）

```
1. 冷启动 → 连钱包 → 自动切到 10143
2. 存入 1,222,776 USDC 流动性        ← 修订：原为 1000，已不足以支撑 20 笔 50x
3. 跑 `npx hardhat run scripts/demo-seed.ts --network monadTestnet` 开 20 笔混合方向仓位
4. 大屏点"调低价格" → < 1s 内持仓批量变红 → Bot 日志滚动 → 浏览器出块确认
5. 全程 90 秒内走完，无手动补救
6. 连续 20 个区块展示 funding index 递增（赛道靶心的可视化证据）
```

> **第 2 步为什么从 1,000 变成 1,222,776**：出金上限 = `保证金 + 名义本金`。
> 50x、1,000 USDC 保证金 → 上限 `999 + 49,950 = 50,949 USD`；20 笔 → 1,018,980 USD；
> 加 20% 余量 → 1,222,776。数字由脚本自动算出，**不要手抄**——
> `demo-seed.ts` 会在播种后断言 `totalAssets >= reservedAssets`，池子不够时会当场失败。
>
> **若想保留 1,000 USDC 的小池子演示**：把 `LEVERAGE_BPS` 降到 `10_000`（1x），
> 此时 20 笔只需约 44,000 USD。代价是清算演示失去杠杆张力（1x 需要 −99% 才爆仓）。
> **建议用 50x + 大池子**，并在路演时主动解释这是偿付护栏的直接结果。

### 7.3 提交材料

| 材料 | 内容 | 来源 |
| --- | --- | --- |
| 链上地址清单 | 6 个合约地址 + explorer 链接 | `deployed_addresses.json` |
| 真实交易哈希 | 至少 20 笔清算 tx + 连续 funding 区块 | explorer |
| 架构图 | 复用 RFC-001 §3.1/§3.2 的 C4 图（**质量高，可直接用**） | RFC-001 |
| 两个必答问题的答案 | 见 `前沿资讯与竞品分析.md:298-306` | 同上 |
| 6 天内的 commit 记录 | `git log --since=2026-10-01` | 证明"六周内新写" |

### 7.4 最后的 GAP 收尾（各 ≤ 20 分钟）

| GAP | 动作 | 验收 |
| --- | --- | --- |
| GAP-28 | 删除 `package-lock.json`，README 钉死 `pnpm install --frozen-lockfile` | `Test-Path package-lock.json` → False |
| GAP-29 | 确认 `docs/adr/` `docs/changes/` `deploy/` 就位 | `git ls-files` 有命中 |
| GAP-12 | ⚠️ **需先轮换密钥**，再改代码 | 见下 |

**⚠️ GAP-12 的时间陷阱**：凭证明文在 `README.md:16-33`、`config.go:38-44`、`render.yaml:17-28`、`exchange/route.ts:29,33`。**轮换密钥需要外部操作（Steam / Alpaca / Stripe / GitHub 后台）**，6 天内很可能做不完。建议：
- **本次只做最小动作**：从 `README.md` 删除明文凭证（1 分钟，且仓库可能公开）；
- 代码层的环境变量化 **延到赛后**，并记入 `docs/changes/` 作为已知债务。

---

## 8. 风险与砍单顺序

| 风险 | 影响 | 对策 | 状态 |
| --- | --- | --- | --- |
| **GAP-01~04 未修** | 清算演示必然翻车 | Day 1 死保；5 个负向用例先红后绿 | 🔴 最高 |
| **`reservedAssets` 近似方案被质疑** | 池子偿付模型不精确 | 写进 ADR-002，明说近似与代价 | 🟠 |
| **Day 2 领不到测试币** | 全链条阻塞 | 提前 1 天试水龙头；准备备用 RPC | 🟠 |
| **funding 需要改 `Position` 结构** | 与已有测试冲突 | 优先用"零结构变更"的 `entryPrice` 折算方案 | 🟠 |
| **GAP-05 赏金为 0 导致 Bot 少清算** | 演示"数十笔"打折扣 | Day 1 顺手修，或 Bot 不过滤赏金 | 🟠 |
| **10-13 截止日不准确** | 排期全错 | **开工前 30 分钟核对 `metropolis.monad.xyz`**（推荐方案 U-4） | 🟠 |
| Go Bot 并发 nonce 冲突 | 演示崩在最后一步 | 本地 nonce 管理器（T3.4）+ Day 3 压测 50 笔 | 🟠 |
| 时间不足 | Day 4/5 被压缩 | 砍单顺序见下 | 🟡 |

**砍单顺序（从先砍到死保）**：

```
T4.6/T4.7 前端 funding 展示  →  砍
T4.1-T4.5 funding 链上实现    →  砍（此时退回"链上 perp + Bot"叙事）
T3.8 /api/v1/liquidations     →  砍（Bot 日志仍可演示）
T3.5 批量打包 / T3.7 冷启动    →  不能砍（批量清算就是高光本身）
T2.4 demo-seed                →  不能砍（20 笔靠它）
T1.x 修 4 个 P0               →  死保
T2.2 perp 部署                →  死保（评委可验证性的唯一凭据）
```

---

## 9. 【负向证伪检验】汇总（每条都要能失败）

| 判据 | 负向用例（注入什么故障 → 必须触发失败） | 当前状态 |
| --- | --- | --- |
| 修复有效 | §3.2 的 5 条用例在修复前**必须红** | ✅ 已实测红（见推荐方案 §4.1） |
| CI 真的在跑 | 故意提交一个 `tsc` 错误 → CI 必须红 | ❌ CI 尚未建立 |
| 清算真的发出 | 断开 RPC → Bot 日志必须报错，不得静默 | ❌ 待实现 |
| `/api/v1/liquidations` 真有数据 | 不点调价按钮 → 该接口必须返回空数组而非假数据 | ❌ 待实现 |
| funding 真的逐块 | 连发 2 笔交易跨 2 块 → index 必须变化；同块两笔 → **不得**重复计费 | ❌ 待实现 |
| 部署幂等 | 连续两次跑 `npm run build` → 结果一致 | 待验 |
| 前端接线真实 | 把 `NEXT_PUBLIC_PERP_*` 置空 → 前端必须报错而非静默用 mock | ❌ 待实现 |

> **最后一行是本方案对 `prompt.md` 纪律 §3 的核心交付**：当前仓库的 `/api/market` 会用 `Math.random()` 合成行情并返回 `source: "monad_oracle_gatekeeper"`（GAP-14）。**新的 perp 前端绝不能重复这个模式**——价格来源必须真实可查，否则整个"可验证"叙事自毁。

---

## 10. 与 `prompt.md` 十环的对照

| 环 | 本方案的动作 | 准出凭据 |
| --- | --- | --- |
| 01 设计 | A-1/A-2 落 ADR-002/003；RFC-001 降为输入 | `docs/adr/` 有 2 份新 ADR |
| 02 开发 | A-3 建 `docs/changes/`，每 commit 一份 | `docs/changes/001~005-*.md` |
| 03 测试 | A-4 建 CI，120 → 128 个用例全部入矩阵 | PR required check 绿 |
| 04 构建 | 不做容器；Render 已够用 | N/A（本项目无 04 环需求） |
| 05–10 | **按 `想法记录.md:4` 明确不做**："只完成立项、需求、设计、开发、测试和发布，不做运维、故障和迭代" | N/A |

> `想法记录.md:4` 是用户已确认的范围裁剪，本方案据此**不排 05~10 环**。这是有意的豁免，不是遗漏。

---

## 附：本文档的实测依据索引

| 结论 | 证据位置 |
| --- | --- |
| 基线 `27400fc`、4 项工具链全绿 | 推荐方案 §0.2 |
| `pnpm` 才权威、`npm ci` 装过期树 | 推荐方案 §0.2 / GAP-28 |
| perp 合约自审计未变、GAP-01~04 仍成立 | 推荐方案 §0.3 |
| RFC Lua 四条缺陷（资金卡死 ×2、浮点漂移、日额不重置） | 推荐方案 §4.1（Redis 逐字执行原文） |
| funding 完全缺失、`openedAt` 只写不读 | 推荐方案 §2.10 |
| 现有 `agentcard` 委托模块与 RFC 重叠 | 推荐方案 §2.5（逐文件对照表） |
| 全局锁 `s.mu` 串行化 | 推荐方案 §2.8（`agentcard/service.go:95-96`） |
| perp 栈未部署、前端仍无引用 | 推荐方案 §2.9 / GAP-26 |
| 6 天倒计时、赛道样例、评判口径 | `前沿资讯与竞品分析.md:13-20, 32-36, 263-265, 294`（⚠️ 外部情报，未独立核实） |
| 10,000 TPS / P99 ≤ 15ms 为 RFC 目标且**无基准支撑** | 推荐方案 §6 U-1/U-2 |
