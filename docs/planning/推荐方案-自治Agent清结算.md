# Koliance 推荐方案：自治 Agent 交易与清结算

> **文档性质**：技术方案推荐（系统架构师口径）
> **输入依据**：`docs/自治 Agent 交易与链下高性能清结算系统技术架构设计全案.md`（下称 **RFC-001**）
> **代码基线**：`HEAD = 27400fc4b67bd60ea90aaffaac7be7066e037dbb`（`main`，已 `git fetch` + 快进）
> **配套文档**：`docs/执行方案-自治Agent清结算.md`（落地排期与任务分解）、`docs/缺陷分析与GAP台账.md`（GAP 编号延续处）
> **编写日期**：2026-10-07
> **统计口径**：`git ls-files`（`08c9989` 时 160 → 现 `27400fc` 共 194 个受控文件），已隔离 `node_modules` / `artifacts` / `.next`

---

## 0. 本次拉取动作与已验证基线

### 0.1 拉取结果（实测）

```
git fetch --all                    → upstream/main 前进 16 个提交（480a086..27400fc）
git checkout main && git merge --ff-only upstream/main
                                   → Fast-forward，67 files changed, +13177 −138
HEAD = 27400fc
```

我的工作分支 `feat/perp-demo-oracle`（`08c9989`）**已被上游合并**（commit `104bc26` = PR #4），perp 合约（`08c9989` 的 18 个文件）**逐字节未变**。

### 0.2 拉取后基线实测

| 命令 | 真实结果 | 判定 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | `Done in 1m 8s` | ✅ |
| `npx tsc --noEmit`（根） | `exit=0` | ✅ 绿 |
| `npx vitest run`（根） | `Test Files 3 passed (3)`、`Tests 9 passed (9)` | ✅ 绿 |
| `npx hardhat test`（`contracts/`） | `111 passing (3 solidity, 108 nodejs)` | ✅ 绿 |
| `go build ./...` / `go vet ./...`（`backend/`） | `exit=0` | ✅ 绿 |
| `Test-Path .github` | `False` | ❌ 仍无 CI |

**⚠️ 必须记录的踩坑（否则下一个人一定重复）**：在 `pnpm install` **之前**，`npx tsc --noEmit` 是 **`exit=2`，23 个错误**（`Cannot find module 'typeorm' / 'vitest' / '@supabase/supabase-js'`）。原因：本次拉取新增了依赖与 `pnpm-lock.yaml`，而 `package-lock.json` 已陈旧（不含 `@supabase/supabase-js`）。**仓库现在有双 lockfile，`pnpm` 才是权威**（`pnpm-lock.yaml` 含全部新依赖）。这一点未写进任何文档——列入 GAP-28。

### 0.3 对审计结论的复核

`缺陷分析与GAP台账.md` 的 4 个 P0（GAP-01/02/03/04）**全部仍然成立**：

```
git diff 08c9989 HEAD -- contracts/contracts/perp/ contracts/test/perp/ src/lib/perp.ts
  → 空（perp 合约逐字节未变）
Select-String contracts/contracts/perp/*.sol -Pattern "maxPnlCap"  → 无输出
```

新增的 `tests/perp.test.ts`（99 行 / 5 个用例）**只测纯数学**，未构造任何池子偿付或边界场景，因此**不覆盖 GAP-01~04**。审计结论无需修正。

---

## 1. 【准入审查】

### 1.1 环位判定

按 `提示词.md` 十环 Gate Matrix：

| 环 | 准出 | 实测 | 判定 |
| --- | --- | --- | --- |
| 01 设计 | ADR 落盘 + Schema 迁移带时间戳 + 可测验收标准 | 仅 `ADR-001`（Go 框架决策）。RFC-001 **自称 `[RFC-001]` 但目录里无配套 ADR 编号体系**，且未落 `docs/adr/` | ❌ **未达成** |
| 02 开发 | 满足 01 + `docs/changes` 先写后填 | `docs/changes` **仍不存在** | ❌ **未达成** |
| 03 测试 | 全部用例入 CI + 覆盖率阈值 | **无 `.github/`**；120 个用例全是门外用例 | ❌ **未达成** |
| 04–10 | — | 无资产 | ❌ 未进入 |

**结论：讨论"新增自治 Agent 清结算系统"之前，01/02/03 环的准出必须先补。** RFC-001 是一份**新的 01 环设计输入**，不是 01 环的准出物——它没有 ADR 编号、没有迁移时间戳、没有把验收标准写成可机器判定（`提示词.md` 要求）。

### 1.2 前置环硬资产

| 资产 | 状态 | 由谁补 |
| --- | --- | --- |
| `docs/adr/ADR-002`（perp 单池模型 + 预言机抽象） | ❌ 缺 | 本方案 §3 已给结论，需落盘 |
| `docs/adr/ADR-003`（清结算架构选型） | ❌ 缺 | **本方案 §3 即是其内容** |
| `docs/changes/` | ❌ 缺 | GAP-15 |
| `tests/`（顶层） | ⚠️ 已由上游新建（3 个 vitest 文件） | 已部分达成 |
| `deploy/` | ❌ 缺 | GAP-11 |
| CI workflow | ❌ 缺 | GAP-10 |

---

## 2. RFC-001 评审：实测证伪与现状冲突

按纪律 §1「读到才算」，本节每条都在本机跑过。**为了把"读代码的怀疑"变成"观察到的失败"，我起了本地 Redis（`D:\Redis\redis-server.exe`）把 RFC-001 §4.2.1 的两段 Lua 脚本逐字落盘执行**，跑完已关闭实例并删除临时目录。

### 2.1 🔴 GAP-18 `reserve_token.lua` 无幂等键校验 → 重复预扣 → 资金永久卡死 ✅ 实测

**RFC 位置**：§4.2.1 `reserve_token.lua` 第 4 步写入 `SETEX order:freeze:{intent_id} ...`。

**缺陷**：脚本**从不检查 `freeze_key` 是否已存在**，直接覆写并再次扣减 `available`。而 `commit_token.lua` 只读**一条** freeze 记录（`GET freeze_key`，单值，不是累加）。

**实测（TEST D）**：
```
reserve 10 (intent-1):        → 1  90  SUCCESS
reserve 10 AGAIN (同 intent-1) → 1  80  SUCCESS     ← 未被拒绝
state: available=80  reserved=20  daily_spent=0
freeze 记录持有: 10                                  ← 只记住最后一次
commit actual=10 → 1  COMMITTED
FINAL: available=80  reserved=10  daily_spent=10     ← 10 永久卡在 reserved
```

**影响链**：`intent_id` 由 Agent 生成（RFC §4.1.2 `TradingIntentRequest.intent_id` 是客户端字段）。一个 Agent 重试、或恶意 Agent 复用同一 `intent_id`，就会把自己 10 单位资金永久锁死在 `reserved`——`available` 少了 10，但**没有任何脚本或路径能放它出来**（`reserved` 只能被 `commit` 减，而每笔 intent 只能 commit 一次）。

**与 RFC 自身目标冲突**：§2.2 NFR 写「消除负余额与超额划扣」。实测证明该脚本**不能**保证这一点。

### 2.2 🔴 GAP-19 冻结 TTL 过期后无回收路径 → 资金永久卡死 ✅ 实测

**RFC 位置**：§4.2.1 第 5 步 `SETEX`，注释写「防止撮合挂起导致死锁」。

**缺陷**：TTL 让 **freeze key 消失**，但 `reserved` 字段的金额**留在原地**。脚本注释所声称的"防死锁"实际效果相反——它制造了一个**不可恢复的漏账**。

**实测（TEST E）**：
```
reserve 10 with 2s TTL:  → 1  90  SUCCESS
state: available=90  reserved=10  daily_spent=0
等待 3 秒后:
  EXISTS freeze_key → 0            ← 凭单消失
  state: available=90  reserved=10  ← 10 还在冻结，凭单没了
commit 尝试 → 0  FREEZE_RECORD_EXPIRED_OR_NOT_FOUND
FINAL: available=90  reserved=10   ← 10 永久卡死
```

**影响链**：RFC §2.1 分支 C 明确设计了"撮合超时 → 回滚"，但**超时判定依赖的正是这条会自己消失的凭单**。一旦 Robot/中间件重启、或撮合耗时超过 TTL，该笔资金**既不能 commit 也不能 rollback**。这正是 `prompt.md` 纪律 §3 所指的"判据夹缝"。

**修复方向（供 §3 采纳）**：把 TTL 从「凭单」移到「**扫描器**」——freeze 记录不设 TTL，改为带时间戳的持久记录 + 后台 reconciler 扫描超时项并释放。凭单不能是唯一真相来源。

### 2.3 🔴 GAP-20 `HINCRBYFLOAT` 浮点账本 → 实测漂移 ✅ 实测

**RFC 位置**：§4.2.1 全篇用 `HINCRBYFLOAT`；§4.2.2 DDL 却用 `NUMERIC(36,18)`。

**缺陷**：Redis 的 `HINCRBYFLOAT` 是 IEEE-754 double（有效位约 15–17 位十进制）。RFC §2.2 要求「严格保证单用户并发扣款不超过授权上限」，而浮点累加**必然**产生残差。

**实测（TEST B / TEST F）**：
```
单次 0.001 后 available = 99.99899999999999523      （应为 99.999）

1000 次 0.001 的 reserve+commit 循环后：
  available   = 98.99999999999522515                （应为 99）
  daily_spent =  1.00000000000000067                （应为 1）
```

**影响判读（不夸大）**：漂移量约 **5e-12**，在"演示 1000 笔"的量级下不会造成可见错账，**但它使 §2.2 的「严格保证」这一措辞无法成立**——这是一条**不可证伪的承诺**，而纪律 §3 要求判据必须可证伪。同时它引入了一个真实的边界漏洞：`daily_spent` 略大 → 提前触发 `EXCEEDED_DAILY_LIMIT`（用户体验性拒绝，无害）；`available` 略小 → 同样偏保守。**方向是保守的，所以危害有限**，但**必须改为整数最小单位**（如 micro-USD 整数），否则：

- §4.2.2 的 `NUMERIC(36,18)` 与 Redis 里的 double **不是同一个数**，链下账本与 PG 账本会对不上；
- 未来接真链上 `uint256` 时，两边舍入规则不同 → 对账差异。

### 2.4 🟠 GAP-21 `daily_spent` 无重置机制 ✅ 实测

**RFC 位置**：§4.2.1 开篇写「`daily_spent`: 当日已消耗额度（**重置窗口 86400 秒**）」。

**实测**：两段脚本里 `daily_spent` 仅出现 3 次，**无任何重置逻辑**：

```
reserve_token.lua: 2 处（读取 1、判断 1）
commit_token.lua:  1 处（HINCRBYFLOAT 累加 1）
```

且 Redis **Hash 的单个字段无法设置 TTL**（TTL 只能作用在整个 key 上）。所以「重置窗口 86400 秒」在给定实现下**不可能生效**——`daily_spent` 是**累计值**，不是当日值。

**影响**：`daily_limit` 变成**终身限额**。演示跑满额度后，该用户再也无法交易，且 `reserved` 里的钱还被 GAP-19 锁着。这会让"一次授权、Agent 自主跑 100 笔"的演示路径在第 N 笔后**静默停止**。

**修复方向**：`daily_spent:{user}:{yyyymmdd}` 做独立 key（可带 TTL），或存「窗口起点 + 已用量」并由脚本按 `now` 判定跨窗归零。

### 2.5 🟠 GAP-22 RFC-001 完全未引用仓库已有的 AgentCard 委托模块，约 70% 的 P0 已存在 ✅ 实读

**RFC §4.3.1 要求新建** `internal/domain/delegation.go`、`internal/settlement/pool_service.go`、`scripts/lua/*.lua`、`api/proto/...proto`。

**仓库现状**（`git ls-files`，本次拉取前就已存在）：

| RFC 的 P0/P1 组件 | 仓库现有实现 | 差异 |
| --- | --- | --- |
| Session Key 委托（限额/TTL/冻结） | ✅ `backend/internal/agentcard/permission_guard.go`(`PermissionGuard`, `SessionKey`, `IssueSessionKey`, `VerifyAndDeduct`, `FreezeSessionKey`) | RFC 要 EIP-712 签名；现有是 `sk_sess_` **随机 hex 字符串** |
| 单笔 + 日限额 + 类别白名单 | ✅ `permission_guard.go:84-103`（`MaxPerTxUSD` / `DailyLimitUSD` / `AllowedMCCs`） | 语义等价，字段名不同 |
| 熔断/冻结 | ✅ `FreezeSessionKey` + `IsFrozen` | — |
| 双重记账 | ✅ `backend/migrations/001_*.sql` 的 `settlement_ledger`? **否**——现有是 `card_transactions`（单式） | RFC 是真·复式记账，**这部分是新增** |
| 批量结算上链 | ✅ `agentcard/service.go:188-218` `BatchSettle()`（sha256 归集 + `MonadBatchHash`） | RFC 要 Merkle Root + Vault 合约 |
| PG 表结构 | ✅ `session_keys` / `card_transactions` / `cards` / `game_proofs` / `users` | RFC 要 `session_delegations` / `trading_orders` / `settlement_ledger` / `agent_identities` |
| 前端 Session Key 实体 | ✅ `src/entities/SessionKey.ts`（TypeORM，`session_key_address` / `single_tx_limit_usd` / `is_frozen`） | — |

**结论**：RFC-001 把"从零建委托系统"当前提，**但仓库已经有一套可运行的、字段语义几乎对应的实现**。RFC 未提及它，导致方案看起来是 100% 新建，实际是**改造 + 补缺**。

**这不是"重复劳动"的指责**——RFC 的 EIP-712 是实质升级（现有 `sk_sess_` 是 bearer token，**不可离线验签、可被中间件伪造**）。问题在于**方案没算这笔账**：如果按 RFC §4.3.1 全新建，`agentcard.Service.AuthorizeMicropayment` 与新的 `settlement.PoolService` 会**同时持有同一笔钱的权威**。

### 2.6 🔴 GAP-23 RFC 的架构与仓库分层不兼容；且 RFC 内部有四处自相矛盾 ⚠️ 实读

**仓库事实**：`backend/internal/{config,game,agentcard,market,platform}` —— **没有 Redis、没有 gRPC、没有 proto**；`go.mod` 只有 3 个直接依赖（pgx / godotenv / stripe-go）；后端**唯一传输层是 `cmd/api/main.go` 的 `net/http`**。

**RFC §4.3.1 要求**：`cmd/{gateway,dispatcher,router}` 三个新 main + `api/proto/**` + `internal/{adapter,domain,settlement,verifier}` + `docker-compose.yml`（Redis + PG）。

**RFC 内部矛盾（四处）**：

| # | RFC 声明的位置 A | RFC 声明的位置 B | 冲突 |
| --- | --- | --- | --- |
| 1 | §4.3.1 目录树：`scripts/lua/` 只有 `commit_token.lua` / `reserve_token.lua` / `rollback_token.lua` | §3.3 组件图要求 `lockManager`「Lua Scripts Manager」/ §4.2.1 只给出 2 段 | `rollback_token.lua` **正文从未给出**，只在目录树里出现 |
| 2 | §4.1.2 proto 有独立的 `SettlementService.{Reserve,Commit,Rollback}Token`（gRPC） | §3.2 容器图：`middleware <--> fastPool (Lua)` 直连 | Reserve/Commit 到底是**跨进程 gRPC 调用**还是**进程内 Lua 调用**？两者对延迟与事务边界的含义完全不同（NFR 要 P99 ≤ 15ms） |
| 3 | §4.1.2 `RollbackTokenRequest.reason` / `RollbackTokenResponse.restored_balance` | §4.2.1 无 rollback 脚本 | 同上，接口定义了实现不存在 |
| 4 | §4.2.2 `session_delegations` 有 `agent_id ... REFERENCES agent_identities(agent_id)` | §4.2.2 `agent_identities.agent_id VARCHAR(66)` 注释「格式 0x + 64 hex」 | `VARCHAR(66)` **恰好容纳** `0x`+64，但 `session_delegations.agent_id` 也是 `VARCHAR(66)` 且无 `ON DELETE` 规则——RFC `agent_identities` 无删除路径，非阻塞，但需明确 |

**结论**：RFC-001 是一份**高质量的宏观设计**（C4 分层、NFR 量化、EIP-712 契约、复式记账建模都扎实），但它是**按"绿地项目"写的**，与本仓库的现状有四处结构性错配（无 Redis / 无 gRPC / 已有委托模块 / 无 CI）。直接照做会产生**第二套并行基础设施**。

### 2.7 🟠 GAP-24 双 Session Key 模型冲突 ✅ 实读

本次拉取新增 `src/entities/SessionKey.ts`（TypeORM → PG `session_keys`）—— 它描述的是**链上地址**（`session_key_address VARCHAR(42)`）。而 `backend/internal/agentcard` 的 `SessionKey.KeyHex` 是 **`sk_sess_` + 48 hex**（`permission_guard.go:43`），**不是地址**。

RFC-001 又引入第三种：EIP-712 `sessionPublicKey`（§4.1.1，`type: address`）。

**三个模型互不兼容**：`backend/.../session_keys`（DB 表）与 `permission_guard`（内存 map）**已经对不上**——没有代码把 `IssueSessionKey` 的结果写入 PG。再叠 EIP-712 会产生**第三张真相表**。这是纪律 §4「单一事实源」的直接违反。

### 2.8 🟠 GAP-25 现有并发模型与 RFC 的 10,000 TPS 目标存在结构性张力 📖 实读

`agentcard/service.go:95-96` 的 `AuthorizeMicropayment` 全程持有 `s.mu.Lock()`，且该锁挂在 **Service 上（全局）**，保护全局 `cards` map。`permission_guard.go:68` 同样全程持锁。

**实读结论（设计层面，无需基准即可断言）**：所有用户的授权请求**全局串行化**。RFC §2.2 要求「10,000 TPS / P99 ≤ 15ms」——这需要**按用户分片**（per-user lock 或 Lua 原子操作），而 RFC 的 Redis Lua 正好能提供。所以 RFC 方向是对的，但必须**显式替换**现有全局锁路径，否则新的 Redis 层前面仍有一把全局锁。

**⚠️ 诚实限定**：`10,000 TPS` 目前**没有基准测试**支撑，现有代码的**实际**吞吐未测。本条只断言"全局锁串行化"这一**设计事实**，不断言"达不到 X TPS"。

### 2.9 🔴 GAP-26 `项目目标.md` 的交付缺口一条未变 ✅ 实测

| 目标要求 | 实测（`27400fc`） |
| --- | --- |
| perp 栈链上部署 | `deployed_addresses.json` **仍只有** `KolianceModule#Koliance` |
| Go 清算 Bot | `cmd/liquidator` 仍不存在；`go.mod` 仍无 go-ethereum |
| `GET /api/v1/liquidations` | 仍不存在 |
| 前端交易面板 | 无 `PositionPanel.tsx` / `DemoControlPanel.tsx` |
| 前端 ↔ perp 接线 | `src/` 仍无 perp ABI；`perp.ts` 已进 vitest 但**不被任何组件 import** |
| `scripts/demo-seed.ts` | 仍不存在 |

**建议（写进方案）**：perp 模块**不是本次的战场**。这不是放弃，是资源分配——见 §3.1。

### 2.10 🟠 GAP-27 赛道定位机会：逐块资金费率 ⚠️ 外部情报，未独立核实

`docs/前沿资讯与竞品分析.md:32-36` 记载 Metropolis Track 1 官方样例含 **"perpetuals whose funding refreshes each block"**；同文 `:294` 判断「剩下的空位：把逐块资金费率做成真实可演示的东西」。

**本方案采信该情报**（来源为 2026-10-05 抓取），但**未经我独立核实**。若成立，这是比 RFC-001 更高价值的方向——原因见 §3.1。

**代码侧实测支撑**：perp 合约**完全没有资金费率**（`grep -i funding contracts/contracts/perp/*.sol` 只命中 `PythOracleAdapter.sol:118` 的一句英文注释，与资金费率无关）。`Position.openedAt`（`IPositionManager.sol:18`）**只被写入、从未被读取**（`PositionManager.sol:170` 是唯一出现）——即**预埋字段已存在但未使用**，加资金费率**不需要改 Position 结构**。

> 这一条很关键：`openedAt` 存在而未被使用，说明原始设计**留好了口子**。加 funding 的成本比想象中低。

### 2.11 🔴 GAP-28 双 lockfile，`pnpm` 才是权威，但无文档 ✅ 实测

见 §0.2。`package-lock.json` 陈旧（缺 `@supabase/supabase-js`），`pnpm-lock.yaml` 完整。`npm ci` 会装上过期依赖树；**必须用 `pnpm install --frozen-lockfile`**。建议删除 `package-lock.json` 或在 README/CI 中钉死 pnpm。

---

## 3. 【推荐方案】

### 3.1 核心判断：不要按 RFC-001 的 P0→P2 顺序做

RFC-001 §5 的优先级排序**有一个根本问题**：它把「EIP-712 验签器 + Redis Lua 预扣」放在 **P0**，把「链上只读对齐 + Batch Rollup」放在 **P2**。

**问题在于**：按此顺序，P0 完成时**链上不会有任何新东西**。而 Metropolis 的评判口径（`前沿资讯与竞品分析.md:263-265`）明确写着：

> "Judges need to be able to verify what you built during the six weeks."

**只有测试网上的真实合约地址与交易哈希算数。** 一个跑在本地 Redis 上的高并发预扣引擎，在评委眼里**不可验证**。

同时：`docs/项目目标.md` 的 perp 交付缺口（GAP-26）**一条未变**，距离 10-13 只剩 **6 天**。

**因此推荐的方向是**：

> **把 RFC-001 的"链下高性能"降为支撑手段，把"链上可验证的机制创新"提为目标。**

具体地：**不做通用的 Agent 支付清结算，做一个 Monad 原生、逐块资金费率的永续合约**，用 RFC-001 的 Session Key 授权 + 链下预扣**恰好解决"自治 Agent 如何在链上交易"这一个问题**。

**为什么这个组合比 RFC-001 原样落地更好**：

| 维度 | RFC-001 原样落地 | 推荐方案 |
| --- | --- | --- |
| 评委可验证性 | ❌ 本地 Redis，链上零新资产 | ✅ 链上 Vault + 逐块 funding 的 tx hash |
| 与赛道题目的对应 | ⚠️ 泛化的"Agent 基础设施" | ✅ 直击 Track 1 官方样例原句 |
| 复用现有代码 | ❌ 全新建，产生第二套委托系统 | ✅ 复用 `agentcard` + `perp` 两套已有资产 |
| 6 天可行性 | ❌ P0 就要求 Redis+gRPC+proto+Docker | ✅ 复用 `net/http` + 已有 PG 通路 |
| 真实护城河 | ⚠️ 与 Ostium/Perpl 同质 | ✅ 逐块 funding 是别的链做不到的 |

### 3.2 推荐架构（三层，全部复用现有技术栈）

```
┌─ 前端 (Next.js 15，已有) ────────────────────────────────────────┐
│  授权面板：主钱包签一次 EIP-712 → 生成 Session Key               │
│  交易面板：持仓 / 保证金率 / 预估强平价（复用 src/lib/perp.ts）   │
│  DemoControlPanel：调价 → 触发批量清算（演示高光）                │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTPS（已有 net/http，不引 gRPC）
┌────────────────────────▼───────────────────────────────────────┐
│  Agent 中间件 (Go，复用 backend/ 现有分层)                       │
│  ┌─ 复用 ─────────────────────────────────────────────────┐    │
│  │ internal/agentcard  委托限额 + 熔断（升级为 EIP-712 验签）│    │
│  │ internal/platform/database  已有 pgx 通路              │    │
│  │ cmd/api/main.go     已有 17 路由 + CORS               │    │
│  └───────────────────────────────────────────────────────┘    │
│  ┌─ 新增（最小面）────────────────────────────────────────┐    │
│  │ internal/agentcard/eip712.go   验签（新增 1 文件）      │    │
│  │ internal/perp/oracle.go        Pyth Hermes 客户端      │    │
│  │ internal/perp/funding.go       资金费率计算 + 结算触发  │    │
│  │ cmd/liquidator/main.go         清算 Bot（新增 1 main）  │    │
│  └───────────────────────────────────────────────────────┘    │
│  链下额度：先用 PG 事务（已有），**不引 Redis**                  │
└────────────────────────┬───────────────────────────────────────┘
                         │ JSON-RPC（已有 viem / 将来 go-ethereum）
┌────────────────────────▼───────────────────────────────────────┐
│  链上 (Monad 10143)                                             │
│  Vault.sol / PositionManager.sol   ← 已有，需先修 GAP-01~04      │
│  + FundingRate.sol / funding 逻辑  ← 新增，赛道靶心              │
│  SessionKeyRegistry.sol            ← 新增，EIP-712 公钥登记      │
└─────────────────────────────────────────────────────────────────┘
```

**关键取舍（三条，都是"不做"的决定）**：

1. **不引 Redis / 不引 Docker（本次）**。理由：`10,000 TPS` 是 RFC 的目标，**但 6 天内没有任何评委能验证 TPS**；而"链上有个能逐块更新资金费率的合约"是当场能看的。额度预扣先用 PG 事务 + `SELECT ... FOR UPDATE`，语义正确、可复现、零新增基础设施。Redis 留作 **GAP-30**（若赛后继续）。
2. **不引 gRPC / 不写 proto**。理由：后端唯一传输层已是 `net/http`，`ADR-001` 明确"不引入框架"的前提是"分层清晰"。新增一个 proto + gRPC 栈在 6 天内换不来演示价值，且 RFC 自身对 Reserve/Commit 是 gRPC 还是进程内落地就是矛盾的（GAP-23 冲突 2）。
3. **不照抄 RFC 的 Lua 脚本**。理由：GAP-18/19/20/21 四条实测缺陷都在这 2 段脚本里。若要引入 Redis，**必须先修 F-01~F-04**（见 §3.4）。

### 3.3 交付范围（收敛后的 P0/P1/P2）

| 优先级 | 交付物 | 复用 / 新增 | 为什么 |
| --- | --- | --- | --- |
| **P0-a** | 修复 GAP-01/02/03/04（4 个 P0 合约缺陷） | 改 `PositionManager.sol` + `Vault.sol` | **前置阻断**：不修则清算演示必然翻车 |
| **P0-b** | perp 栈部署到 Monad 10143，前端接线 | 用已有 `PerpStack.ts` + `src/lib/perp.ts` | 让"链上资产"存在，满足评委可验证性 |
| **P0-c** | Go 清算 Bot（`cmd/liquidator`） | 新增，但**只加 `go-ethereum` 一个依赖** | 路演高光；`docs/项目目标.md` 明列 |
| **P1-a** | **逐块资金费率**（链上） | 新增 `funding` 逻辑；`openedAt` 已预埋 | 赛道靶心，Monad 原生叙事 |
| **P1-b** | EIP-712 委托 + Session Key 链上登记 | 升级 `agentcard.PermissionGuard`，新增 `SessionKeyRegistry.sol` | 自治 Agent 叙事的**实质**升级（现有 `sk_sess_` 是 bearer token） |
| **P1-c** | `GET /api/v1/liquidations` + 前端大屏 | 复用 `cmd/api/main.go` 路由风格 | Bot 结果可视化 |
| **P2-a** | 复式记账 `settlement_ledger` | RFC §4.2.2 的 DDL 可直接用 | 这是 RFC 里**真正新增且高质量**的部分 |
| **P2-b** | Redis Lua 预扣（**修完 F-01~F-04 再上**） | RFC §4.2.1 修正版 | 赛后/有余力 |
| **P2-c** | ZK Verifier 抽象插槽 | RFC §4.3.1 `zk_interface.go` | 纯叙事，接口留空即可 |

**时间不足时的砍单顺序**（从先砍到死保）：
`P2-c → P2-b → P2-a → P1-c → P1-b → P1-a → P0-c → P0-b → P0-a（死保）`

> 注意 P1-a（逐块资金费率）排在 P1-c/P2 之前——它是**叙事能否立住**的分水岭，而 P2 全是"看起来很专业但不产生链上资产"的部分。

### 3.4 RFC Lua 脚本的修正规格（若采纳 P2-b，必须先实现这些）

以下是把 §2 的实测缺陷直接转成实现要求，**每条都要有对应的负向用例**（纪律 §3）：

| 编号 | 要求 | 负向用例（注入故障必须失败） |
| --- | --- | --- |
| **F-01** | `reserve` 开头检查 `EXISTS freeze_key`，存在即返回 `DUPLICATE_INTENT` 且**不做任何扣减** | 同 `intent_id` 调用两次 → 第二次返回非 0 错误码，且 `available`/`reserved` **不变** |
| **F-02** | freeze 记录**不设 TTL**；改为 `HSET freeze_key amount ts` 持久化，另建 `order:expiring`（**ZSET**，score=到期时间）供 reconciler 扫描 | 等 TTL 到期后 `reserved` **必须可被 reconciler 归零**；测试断言"超时 60s 后 reserved 回到 0 且 available 恢复" |
| **F-03** | 全部金额改**整数最小单位**（推荐 micro-USD，`10^-6`），脚本内**禁止 `tonumber` 浮点**；用 `string` + `math` 整数运算，或改用 `HINCRBY`（整数） | 1000 次 0.001 循环后 `available` 与 `daily_spent` **精确等于**期望值（当前实测漂移 5e-12） |
| **F-04** | `daily_spent` 改为独立 key `spend:{user}:{yyyymmdd}`（可带 48h TTL），或存 `window_start` 由脚本按 `now` 判定归零 | 跨天后 `daily_spent` 归零；测试注入 `now = 次日` 后断言额度恢复 |
| **F-05** | 补齐 `rollback_token.lua`（RFC 只在目录树提及，正文缺失） | 回滚后 `available + reserved` 之和**不变**（守恒律） |
| **F-06** | 统一脚本返回形状。当前实测：`reserve` 返回 3 元组、`commit` 返回 **2 元组且类型不同**（成功时第 1 元素是 int，失败时第 2 元素是 string） | Go 客户端对两种形状都有解码测试；形状不匹配时**显式报错**而非静默错位 |

> F-03 的实测依据：`1000 × 0.001` 后 `available = 98.99999999999522515`、`daily_spent = 1.00000000000000067`。

### 3.5 与 `prompt.md` 的十环对应

| 环 | 本方案的动作 |
| --- | --- |
| 01 设计 | 把 §3.1/§3.2 落成 `docs/adr/ADR-002`（perp 模型）与 `ADR-003`（清结算选型）；RFC-001 降格为**输入材料**并补 `MIG-` 编号的迁移 |
| 02 开发 | 建 `docs/changes/`，每个 commit 一份变更记录（GAP-15） |
| 03 测试 | 建 `.github/workflows/ci.yml`，把 120 个用例（111 hardhat + 9 vitest）全部纳入（GAP-10）；补 GAP-17 的 5 个常驻负向用例 |
| 04 构建 | 无 Docker；Render 已够用。补运行时 `REVISION` 断言（可选） |

---

## 4. 【负向证伪检验】

### 4.1 本次实测的原始 stdout（逐字保留）

**Redis 环境**：`D:\Redis\redis-server.exe`，`redis_version:5.0.14.1`（Windows 端口），临时端口 6390，`--save "" --appendonly no`。两段 Lua **逐字复制** RFC-001 §4.2.1，未做任何修改。跑完已 `shutdown nosave` 并删除临时目录。

```
=== TEST D: DOUBLE-RESERVE with the same intent_id (no idempotency guard) ===
reserve 10 (intent-1):        1 / 90 / SUCCESS
reserve 10 AGAIN (same intent-1): 1 / 80 / SUCCESS
state (reserved should be 10 if guarded; 20 = leak): 80 / 20 / 0
freeze record holds: 10
commit actual=10: 1 / COMMITTED
FINAL (reserved should be 0; non-zero = permanently stuck funds): 80 / 10 / 10

=== TEST E: freeze record EXPIRES before commit ===
reserve 10 with a 2s TTL: 1 / 90 / SUCCESS
state now: 90 / 10 / 0
freeze key exists? 0
state after expiry: 90 / 10 / 0
commit attempt after expiry: 0 / FREEZE_RECORD_EXPIRED_OR_NOT_FOUND
FINAL state: 90 / 10 / 0

=== TEST B: 3-decimal precision ===
available after 0.001 spend (expect 99.999): 99.99899999999999523
daily_spent (expect 0.001): 0.001

=== TEST F: drift over 1000 reserve/commit cycles of 0.001 ===
available (exact 99): 98.99999999999522515
daily_spent (exact 1): 1.00000000000000067

=== reply shapes ===
reserve SUCCESS            -> 1 / 90 / SUCCESS          (3 元素)
reserve INSUFFICIENT_FUNDS -> 0 / 5 / INSUFFICIENT_FUNDS (3 元素)
commit  EXPIRED            -> 0 / FREEZE_RECORD_EXPIRED_OR_NOT_FOUND   (2 元素)
```

**对照基线（脚本本身在正常路径下是对的，不能全盘否定）**：
```
=== TEST 1: reserve 10 (happy path) ===
1 / 90 / SUCCESS      state: available=90 reserved=10 daily_spent=0   freeze TTL: 30
=== TEST A: commit(actual=7) refunds the difference ===
1 / COMMITTED         available=93 reserved=0 daily_spent=7
```

### 4.2 仓库基线证伪命令（可直接粘取）

```powershell
# ① perp 合约自审计以来未变（GAP-01~04 仍成立）
git diff 08c9989 HEAD --stat -- contracts/contracts/perp/ src/lib/perp.ts
# 期望：仅 tests/perp.test.ts 新增；合约零变化

# ② maxPnlCap 仍未实现
Select-String -Path contracts\contracts\perp\*.sol -Pattern "maxPnlCap"
# 期望：无输出

# ③ 资金费率完全缺失，且 openedAt 是预埋死字段
Select-String -Path contracts\contracts\perp\*.sol -Pattern "funding"
# 期望：仅 PythOracleAdapter.sol:118 一句英文注释
Select-String -Path contracts\contracts\perp\PositionManager.sol -Pattern "openedAt"
# 期望：仅 :170 一处（只写不读）

# ④ perp 前端仍未被任何组件引用（死代码）
Select-String -Path (git ls-files src) -Pattern 'from "@/lib/perp"'
# 期望：无输出（只有 tests/perp.test.ts 引用）

# ⑤ perp 栈仍未部署
Get-Content contracts\ignition\deployments\chain-10143\deployed_addresses.json
# 期望：仅 KolianceModule#Koliance

# ⑥ 无 CI / 无 docs/changes / 无 docs/adr
Test-Path .github ; Test-Path docs\changes ; Test-Path docs\adr
# 期望：False / False / False（docs/adr 在仓库外层，需按实际路径调整）

# ⑦ 双 lockfile，npm 装的是过期树（GAP-28）
Select-String -Path package-lock.json -Pattern "supabase" -SimpleMatch
# 期望：无输出 ← package-lock.json 缺 @supabase/supabase-js，必须用 pnpm
```

**正向回归基线（全程必须保持）**：
```powershell
pnpm install --frozen-lockfile          # 不要用 npm ci（GAP-28）
npx tsc --noEmit                        # 期望 exit=0
npx vitest run                          # 期望 3 files / 9 tests passed
cd contracts; npx hardhat test          # 期望 111 passing (3 solidity, 108 nodejs)
cd backend; go build ./...; go vet ./...  # 期望 exit=0
```

---

## 5. 【下游同步清单与未竟 GAP】

### 5.1 下游同步清单（纪律 §4：消除两处不同成熟度的事实）

| # | 文件 | 现状 | 应改为 |
| --- | --- | --- | --- |
| S-1 | `docs/自治 Agent...全案.md:1` | 自称 `[RFC-001]`，但无 ADR 编号体系、未落 `docs/adr/` | 降格为**输入材料**；其决策结论落 `ADR-002`/`ADR-003` |
| S-2 | RFC §4.2.1 `reserve_token.lua` | 无幂等键、TTL 丢账、浮点账本 | 按 §3.4 的 F-01~F-06 修正，每项配负向用例 |
| S-3 | RFC §4.2.1 | 注释称 `daily_spent` 有「86400 秒重置窗口」 | 删除该表述或补实现（Hash 字段无 TTL） |
| S-4 | RFC §4.3.1 目录树 | 列出 `rollback_token.lua` 但正文无此脚本 | 补齐正文，或从目录树移除 |
| S-5 | RFC §4.1.2 vs §3.2 | Reserve/Commit 是 gRPC 服务还是进程内 Lua 自相矛盾 | 择一并写明理由（本方案建议：**进程内**，理由见 §3.2 取舍 2） |
| S-6 | RFC 全文 | 未引用仓库已有的 `agentcard` 委托模块 | §2 增一节"与现有资产的差异"，明确**升级**而非**重建** |
| S-7 | `docs/推进方案.md:53` | 「设 `maxPnlCap`」——零实现 | 标注**未实现**（延续既有 S-4） |
| S-8 | `src/lib/perpConfig.ts:59-76` | 称 `Equity.Index.*` 可用于演示，与链上实测矛盾 | 见既有 S-1，仍未修 |
| S-9 | `docs/前沿资讯与竞品分析.md:42-44, :263-265` | 已明确"只有六周内新代码算数"、评委要**可验证** | 本方案 §3.1 据此调整优先级；两份文档需互相引用 |
| S-10 | `README.md:16-33` | Steam / Alpaca 凭证明文 | 既有 GAP-12，仍未修 |
| S-11 | `package-lock.json` | 陈旧，与 `pnpm-lock.yaml` 冲突 | 删除或在 README 钉死 `pnpm`（GAP-28） |
| S-12 | 所有文档 | 未记录"必须用 `pnpm install`" | 写入 README 与将来的 CI |

### 5.2 未竟 GAP 台账（延续 `缺陷分析与GAP台账.md` 的编号）

| GAP | 严重度 | 未竟事项 | 承载形式 | 依赖条件 | 可度量 DoD |
| --- | --- | --- | --- | --- | --- |
| **GAP-18** | 🔴 P0 | `reserve` 无幂等键 → 重复预扣致资金永久卡死 | `scripts/lua/reserve_token.lua` | 若采纳 P2-b | 同 `intent_id` 二次调用返回 `DUPLICATE_INTENT` 且余额不变 |
| **GAP-19** | 🔴 P0 | freeze TTL 过期 → 无回收路径 → 资金永久卡死 | Lua + reconciler | 若采纳 P2-b | 超时后 `reserved` 可归零；reconciler 有单测 |
| **GAP-20** | 🔴 P0 | `HINCRBYFLOAT` 浮点账本 → 漂移 5e-12 | Lua + PG DDL | 若采纳 P2-b | 1000 次循环后余额**精确**相等 |
| **GAP-21** | 🟠 P1 | `daily_spent` 无重置机制 | Lua | 若采纳 P2-b | 跨天归零测试通过 |
| **GAP-22** | 🟠 P1 | RFC 未引用已有 `agentcard` 委托模块，方案按全新建 | RFC §2 + `ADR-003` | 无 | RFC 增差异节；实现改为**升级** `PermissionGuard` |
| **GAP-23** | 🔴 P0 | RFC 架构与仓库分层不兼容 + 四处内部矛盾 | RFC §3/§4 | 无 | 四处矛盾逐一裁决并写入 `ADR-003` |
| **GAP-24** | 🟠 P1 | 三套 Session Key 模型（`sk_sess_` 字符串 / PG 地址 / EIP-712）互不兼容 | `permission_guard.go` + `src/entities/SessionKey.ts` + 新合约 | GAP-22 | 只保留一套；`git grep` 对另两套零命中 |
| **GAP-25** | 🟠 P1 | 全局 `s.mu` 串行化 vs 10,000 TPS 目标 | `agentcard/service.go` | 无 | 改为按用户分片；**且必须补基准测试**（当前 `10,000 TPS` 无证据） |
| **GAP-26** | 🔴 P0 | `项目目标.md` 交付缺口一条未变 | 跨模块 | GAP-01~04 先修 | perp 地址在 `deployed_addresses.json`；`src/` 引用它；Bot 有真实 tx |
| **GAP-27** | 🟠 P1 | 逐块资金费率未实现（赛道靶心） | `PositionManager.sol` | GAP-01~04 | 每块可更新 `cumulativeFundingIndex`；有 straddle 测试（多空对消） |
| **GAP-28** | 🟡 P2 | 双 lockfile，`npm ci` 装过期树 | 仓库 | 无 | 删 `package-lock.json` 或 CI 钉死 pnpm |
| **GAP-29** | 🟡 P2 | 无 `docs/adr/` / `docs/changes/` / `deploy/` | 仓库骨架 | 无 | 三目录存在且有受控文件 |
| **GAP-30** | 🟡 P2 | Redis 额度池（真需要时） | 新模块 | GAP-18~21 先修 | §3.4 的 F-01~F-06 全部有负向用例 |

### 5.3 与既有台账的关系

`缺陷分析与GAP台账.md` 的 **GAP-01~17 全部仍然成立**（perp 合约零变化）。本方案的 **GAP-18~30** 是新增项。两组关系：

- **GAP-01~04（🔴）是本方案的绝对前置**——不修则 P0-a 不可交付，且 P1-a（funding）会建在错误的偿付模型上；
- **GAP-18~21（🔴🟠）只在采纳 P2-b（Redis）时激活**——本方案 §3.2 的取舍 3 建议**本次不做**，正是为了避开这四条。

---

## 6. 【未验证清单】（纪律 §1）

| # | 线索 | 为何未验证 | 建议验证方式 |
| --- | --- | --- | --- |
| U-1 | RFC §5 P0 DoD「1,000 并发扣划压力测试下零超扣」能否达成 | 未写 Go 基准、未起 Redis 集群 | 写 `tests/benchmark_test.go`，1,000 goroutine 打同一用户，断言 `Σavailable + Σreserved` 守恒 |
| U-2 | 「10,000 TPS / P99 ≤ 15ms」是否有依据 | 无任何基准 | 同上；且在**修完 GAP-25 分片**后再测 |
| U-3 | 现有 `agentcard` 实际吞吐（全局锁的真实影响） | 未基准测试 | 同上，先测现状再改 |
| U-4 | `docs/前沿资讯与竞品分析.md` 关于 Metropolis Track 1 样例与截止日的记载 | 该文档为 2026-10-05 外部抓取，我未独立核实 | 本机浏览器打开 `metropolis.monad.xyz` 核对 |
| U-5 | RFC §4.2.2 的 `NUMERIC(36,18)` 与 Redis double 对账差异的实际幅度 | 未建双写对照 | 同一笔流水同时写 PG 与 Redis，比对千笔后差异 |
| U-6 | Redis 5.0.14.1（Windows 端口）与生产 Redis 7.2（RFC docker-compose 指定）行为是否完全一致 | 本地没有 7.2；本次测的是 5.0.14.1 | **`HINCRBYFLOAT` / `SETEX` 语义在两版间稳定**，故结论可迁移；但仍建议在 7.x 上复跑 §4.1 |
| U-7 | 加资金费率后 `Position` 结构是否真的无需变更 | 只确认了 `openedAt` 只写不读，未设计完整 funding 数学 | 先写 `ADR-002` 的 funding 规格，再评估结构变更 |

---

## 7. 一页结论

**拉取**：`main` 已快进到 `27400fc`（+16 提交）。我的 perp 分支已合入；perp 合约零变化，**审计的 4 个 P0 全部仍然成立**。拉取引入了新的依赖与 pnpm 权威 lockfile（`npm ci` 会装过期树 —— GAP-28）。

**RFC-001 评审**：宏观设计扎实（C4 分层、EIP-712 契约、复式记账 DDL 质量高），但存在**四个可实测的致命缺陷**（都在 §4.2.1 的两段 Lua 里，我已逐字执行复现）：重复预扣致资金永久卡死、TTL 过期致资金永久卡死、浮点账本漂移、`daily_spent` 永不重置。此外它与仓库现状有四处结构性错配（无 Redis / 无 gRPC / 已有委托模块 / 无 CI），并有四处**内部自相矛盾**。

**推荐**：**不按 RFC 的 P0→P2 顺序落地**。RFC 把全部"链上可见的东西"排在 P2，而 Metropolis 的评判口径是"评委要能验证你六周里真做了什么"——本地 Redis 引擎不可验证。建议**把 RFC 的高性能降为支撑手段，把链上可验证的机制创新提为目标**：修完 4 个 P0 → 部署 perp → 上 Go 清算 Bot → **做逐块资金费率**（赛道官方样例原句，且 `openedAt` 字段已预埋），Session Key 用 EIP-712 **升级**现有 `agentcard` 而非重建。Redis 留作 P2，且必须先修 F-01~F-06。

**最高优先动作**（顺序不可颠倒）：`GAP-01~04` → `GAP-26/27`（部署 + funding）→ `GAP-22/23/24`（裁决架构冲突）→ `GAP-18~21`（仅在引入 Redis 时）。

> 配套落地排期、任务分解与验证命令见 `docs/执行方案-自治Agent清结算.md`。
