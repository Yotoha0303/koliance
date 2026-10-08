# Koliance 质量缺口台账（GAP）

> **用途**：本项目**所有未完成事项的唯一台账**。任何"还没做"的东西都必须出现在这里，
> 否则它就不存在。协作者据此判断现状，不要依赖口头同步。
>
> **编号规则**（`提示词.md` 纪律 §4）：`ADR-` 架构决策 · `MIG-` 数据库迁移 · **`GAP-` 质量缺口** · `INC-` 线上故障 · `DEFER-` 延期债务
>
> **维护要求**：新增缺口立刻编号入表；修完把状态改为 ✅ 并附提交号；**不要删除已完成项**（它们是回归基线）。
>
> **最后更新**：2026-10-08 · 分支 `feat/perp-solvency-and-panel`
> **本轮**：RFC-001 取舍已裁决（`ADR-004`）——GAP-22~25 结案、RFC 降为输入材料、主题定为双线程
> **最新登记**：**GAP-06 强平价对拍已关闭**、**GAP-37 面板两条口径（新发现）**（见 §3.6）· GAP-36 已修（§3.4）· GAP-16/34 已修（§3.5）

---

## 0. 归档位置说明（GAP-31 ✅ 已修）

本仓库的文档原先分居两处，规划类文档**不在 git 下**，协作者 clone 后看不到。
**已修正**：规划文档迁入 `docs/planning/`，并附 `docs/planning/README.md` 索引。

当前结构：

| 位置 | 内容 |
| --- | --- |
| `docs/adr/` | 架构决策（**ADR-002 / 003 / 004**） |
| `docs/changes/` | 每次代码变更的记录（**001~012**） |
| `docs/planning/` | 目标、方案、审计、情报等规划类文档 + 索引 |
| `docs/GAP台账.md` | **本文件**，活的未竟事项台账 |

### 0.1 GAP-31 的残留：迁移后引用未同步（2026-10-08 补修）

文档迁进 `docs/planning/` 时，**别的文档里的引用没有跟着改**——活跃方案文档仍写
`docs/推荐方案-….md`、`docs/项目目标.md` 这类**缺 `planning/` 段**的路径，clone 后打不开。
这与 `ADR-004` 同批修掉的 `prompts/想法记录.md`（`prompts/` 在仓库外）是同一类缺陷。

**已补修**（活跃文档）：`执行方案-自治Agent清结算.md` 5 处、`推进方案.md` 1 处。

**历史快照不改**（纪律）：`缺陷分析-审计报告.md`、`推荐方案-*.md`、`执行记录-Phase0.md`
里的旧路径**保持原样**——它们写作时路径是准的，改写快照等于篡改证据链
（判据见 `docs/changes/010` 对 S-6 的纠正）。**只有"待执行的指令"需要准，"已发生的事实"不需要。**

> ⚠️ **不要再在本文件或任何入库文件里写机器绝对路径**（曾出现 `D:\MyDocuments\...`）。
> 本文件的这一行是**唯一**该被允许的例外，因为它本身就在说明这个问题。

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
| GAP-06 | 前端/链上清算价同源无一致性测试 | 🟠 P1 | ✅ | 见 §3.6 |
| GAP-07 | `closePosition` 无价格时效/滑点约束 | 🟠 P1 | ✅ | `c7da777` |
| GAP-08 | `_pushPrices` 字符串签名 + 失败无观测 | 🟡 P2 | ✅ | `c7da777` |
| GAP-09 | `perpConfig.ts` 的 FEEDS 与链上实测矛盾 | 🟡 P2 | ✅ | `df227bf` |
| GAP-10 | 无 CI，全部用例是"门外用例" | 🟡 P2 | ✅ | `2b05f05` |
| GAP-11 | 缺工程骨架目录 | 🟡 P2 | ✅ | `deploy/README.md`（发布环 runbook） |
| GAP-12 | 凭证硬编码（6 处，含 README 明文） | 🟡 P2 | 🔴 | **需人工轮换密钥**；README 已清理 |
| GAP-13 | 后端零链上交互 + `/health` 伪指标 | 🟡 P2 | 🟠 | — |
| GAP-14 | 合成随机行情以"实时数据"形态返回 | 🟡 P2 | ✅ | `docs/changes/018` |
| GAP-15 | `docs/changes` 先写后填纪律从未执行 | 🟠 P1 | ✅ | `0193e3a` 起 |
| GAP-16 | `项目目标.md` 交付缺口 | 🔴 P0 | 🟠 | 部分；见 §3 |
| GAP-17 | 负向证伪用例未常驻化 | 🟠 P1 | ✅ | `0193e3a` |
| GAP-18 | RFC `reserve` 无幂等键 → 重复预扣 | 🔴 P0 | ⬜ | 仅采纳 Redis 时激活 |
| GAP-19 | RFC 冻结 TTL 过期 → 资金永久卡死 | 🔴 P0 | ⬜ | 同上 |
| GAP-20 | RFC `HINCRBYFLOAT` 浮点账本漂移 | 🔴 P0 | ⬜ | 同上 |
| GAP-21 | RFC `daily_spent` 无重置机制 | 🟠 P1 | ⬜ | 同上 |
| GAP-22 | RFC 未引用仓库已有 `agentcard` 委托模块 | 🟠 P1 | ⬜ | 设计决策 |
| GAP-23 | RFC 架构与仓库分层不兼容 + 4 处内部矛盾 | 🔴 P0 | ⬜ | 设计决策 |
| GAP-24 | 三套 Session Key 模型互不兼容 | 🟠 P1 | 🟠 | **链上闭环**（`013`+`014`）；Go 侧仍用 `sk_sess_` |
| GAP-25 | 全局锁串行化 vs 10,000 TPS 目标 | 🟠 P1 | ⬜ | 无基准测试 |
| GAP-26 | perp 未部署 / 未接线 / 无 Bot | 🔴 P0 | 🟠 | 部分；见 §3 |
| GAP-27 | 逐块资金费率未实现（赛道靶心） | 🟠 P1 | ✅ | 本分支 |
| GAP-28 | 双 lockfile，`npm ci` 装过期树 | 🟡 P2 | 🟠 | — |
| GAP-29 | 缺 `deploy/` 目录 | 🟡 P2 | ✅ | `docs/changes/019` |
| GAP-30 | Redis 额度池 | 🟡 P2 | ⬜ | 需先修 GAP-18~21 |
| GAP-31 | 规划文档在仓库外，协作者看不到 | 🟡 P2 | ✅ | `df227bf`（`docs/planning/`） |
| GAP-32 | 覆盖率阈值未配 | 🟡 P2 | ✅ | `506c4ef`（合约侧；前端见 GAP-33） |
| GAP-33 | 前端覆盖率未配 | 🟡 P2 | ✅ | 见 §3.2 |
| GAP-34 | `closePosition` 破坏冻结后未重新冻结 | 🟠 P1 | ✅ | 见 §3.1 |
| GAP-35 | 全库行尾未重规范化（CRLF/LF 混用） | 🟡 P2 | 🟠 | 见 §3.3 |
| GAP-36 | `.gitignore` 的 `ignition/deployments/` 管不到 `contracts/` 下 → 部署产物误入库 | 🟠 P1 | ✅ | 见 §3.4 |
| GAP-37 | 面板同时显示两条口径的清算状态（一条含资金费、一条不含） | 🟠 P1 | 🟠 | 见 §3.6（**新发现**） |

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

**已完成的部分**（`50c51d8`）：`README.md` 的明文凭证已移除，改为环境变量清单表。
**但 git 历史无法清理**，所以泄露已成事实，**必须轮换**。

**建议顺序**（不可颠倒）：
1. 轮换四组密钥（**外部操作**）
2. 再改 `config.go` / `render.yaml`，把默认值改为空串（缺失即启动失败）
3. 最后处理 `exchange/route.ts` 的 OAuth secret fallback

顺序颠倒会得到"用一个缺失的配置换掉了一个已泄露的密钥"，服务直接挂。

---

### 3.1 GAP-34：`closePosition` 破坏冻结后未重新冻结

`推进方案.md:40` 把 `closePosition(uint256, bytes[])` 定为**冻结接口**，
目的是让前端与 Go Bot 能并行开发。

GAP-07 加了 `minOutUsd` 与 `deadline`（`c7da777`），**冻结被破坏**。

**核查过的代价**（所以是可接受的）：
- 消费方只有本仓库的测试与前端面板，均已同批更新；
- Go Bot 的接链部分不存在（GAP-26）；
- **perp 模块从未部署**（`deployed_addresses.json` 只有身份合约）。

**未竟**：接口现在处于"**已破冻结、未重新冻结**"的状态。
`IPositionManager.sol` 的 natspec 已写明这一点，并警告消费方"预期它还会变"。

**已完成**（`docs/changes/017`）：接口已按现在的签名**重新冻结**，`推进方案.md:34-37` 已对齐实际签名，`IPositionManager.sol` 文件头新增**权威冻结清单**
（20 函数 + 5 事件，并注明「与规划文档冲突时以本清单为准」），并由 `contracts/test/perp/FrozenSurface.ts` **机械守住**（含变异测试）。

**消费方现在可以按该接口并行开发。** 但注意：模块**仍未部署**，这是对接口形状的承诺，不是「地址已存在」。

---

### 3.2 GAP-33：前端覆盖率门禁（已关闭）

合约侧的地板在 `007` 配好，前端侧一直空着。现已配上（`docs/changes/011`）。

**关键发现：`70.35%` 是个假象**。v8 不加 `include` 时**只统计被测试 import 过的文件**——
实测全树只有 226 行参与统计。这意味着**新增一个谁都没 import 的组件，数字一点都不会降**，
门禁会长期全绿而生产代码在无人测量地增长。加 `include: ['src/**']` 后真相是 **7.89% / 2015 行**。

**范围决策**：两个极端都不可用（全树 7.89% 只说明"demo 外壳没测试"，已知且非门禁职责），
故门禁范围取 **perp 逻辑核心** `src/lib/perp.ts` + `perpConfig.ts`，**对齐合约侧
`INCLUDED_PREFIXES` 的同样做法**（那边也只门禁 perp 模块，不是全树）。

| 指标 | 实测 | 阈值 |
| --- | --- | --- |
| Lines | 76.74% | **72** |
| Branches | 60% | **55** |

**刻意低于实测**——贴着实测值定的地板会在下一次无关重构时变红、然后被赶时间的人删掉
（`check-coverage.ts` 的注释里有这条教训的原始出处）。v8 有 branch 数据，故 branches 一并门禁
（合约侧因 Hardhat 不输出 `BRDA` 只能门禁 lines）。

**范围有意留窄**：`PositionPanel.tsx`(659 行)、`/perp` 路由、`api/market` 均不在内。
它们确实无测试，但拉进来只会得到 25% 的地板、抓不住任何东西。
**要覆盖 UI，正确做法是先补组件测试再纳入，而不是先降阈值。**

**CI 侧的关键点**：`coverage.thresholds` **只在采集覆盖率时生效**，故 CI 的
`npx vitest run` 已改为 `npx vitest run --coverage`——否则配置里的地板在 CI 上根本不生效，
本地绿 CI 也绿，而门禁从未运行。

**负向证伪（已实跑）**：往 `perp.ts` 追加约 20 行无覆盖代码 →
Lines 76.74%→**68.04%**、Branches 60%→**50.76%**，**两条阈值同时报错，exit=1**；工作区已还原。

---

### 3.3 GAP-35：全库行尾未重规范化

**问题**：`.gitattributes` 是本次才加的（`f6ec42d`），此前仓库对行尾没有任何约束，
Windows 工作树是 CRLF、CI 是 LF。

**已经造成的实际伤害**：覆盖率门禁的阈值**基于本机的 CRLF 读数**定成了 93%，
而 CI 在 LF 下读到 89.22% —— **首次真实 CI 运行因此失败**。
详见 `docs/changes/007-覆盖率门禁.md`。

**已修的部分**：`.gitattributes` 把 `*.sol` / `*.ts` 等固定为 `eol=lf`，
**只对后续**检出生效；覆盖率阈值改以 LF 口径为准（88%）。

**未做的部分**：现有文件在工作树里仍是 CRLF。重规范化需要
`git add --renormalize . && git checkout -- .`，会在这个已经很宽的 PR 里
**混入成千上万行行尾噪声，使真正的改动无法评审**。因此留给独立的小 PR。

**风险**：任何在旧 Windows 检出上做覆盖率读数的人仍会读到偏高约 5 个点的值。
脚本注释已写明这一点。

---

### 3.4 GAP-36：`.gitignore` 规则作用于错误的路径层级（2026-10-08 新发现，已修）

> **与 GAP-16 的关系（重要）**：`contracts/lib/perpConfig.ts` 这个幻影路径**不是新发现**。
> `缺陷分析-审计报告.md` 的 **S-6** 早已识别它（`触发 GAP-16`），本台账 §3 的 GAP-16 亦已覆盖。
> 建立框架时我一度把它登记成 **GAP-37**，**经逐行核对后撤销**——那是重复编号，
> 正是纪律 D4 要消灭的漂移。**教训：登记新缺口前必须 `git grep` 全仓检索是否已被识别；
> 与既有编号撞车比漏登记更糟。**

**GAP-36 — `.gitignore` 里这条规则从未命中过**

`.gitignore` 写的是 `ignition/deployments/`，**带内部斜杠且无前导 `**/`**，因此它是**根锚定**模式，
只匹配仓库根下的 `ignition/deployments/`。而 ignition 的实际输出在 `contracts/ignition/deployments/`，
**规则从未命中**，3 个部署产物已被提交：

```
$ git check-ignore -v --no-index contracts/ignition/deployments/chain-10143/deployed_addresses.json
(exit=1，无输出 = 未命中)

$ git ls-files | grep ignition/deployments
contracts/ignition/deployments/chain-10143/build-info/solc-0_8_31-*.json
contracts/ignition/deployments/chain-10143/deployed_addresses.json
contracts/ignition/deployments/chain-10143/journal.jsonl
```

**为什么 `artifacts/` 没同样出问题**（同文件、同区域，却是对的）：
`artifacts/` / `cache/` / `typechain/` **没有内部斜杠**，按 gitignore 规则可在**任意层级**匹配，
所以它们对 `contracts/` 下同样生效。**只有 `ignition/deployments/` 这一条因为多了个斜杠而失效。**
这正是"看起来一视同仁的清单里藏了一条特例"。

> ⚠️ **`check-ignore` 的陷阱**：对**已入库**的文件，`git check-ignore -v <path>` 也返回 exit=1
> （即使规则本应忽略它），因为 git 跳过已跟踪文件。判定规则是否命中**必须加 `--no-index`**，
> 否则会把 GAP-36 误判成"规则没问题"。

**取消跟踪不丢信息**：身份合约地址已另有 4 处记录（`README.md:51`、`src/lib/contract.ts:31`、
`docs/planning/推进方案.md:18`、`docs/planning/执行方案-自治Agent清结算.md:193`），
且 CI 不部署、代码零引用（`git grep` 实测）。

**解除条件**：根 `.gitignore` 的 `ignition/deployments/` → `**/ignition/deployments/`，
再 `git rm --cached -r contracts/ignition/deployments`。

---

### 3.5 GAP-16 幻影路径 —— 已修，并纠正 S-6 的误判范围（2026-10-08）

**现状**：`contracts/lib/perpConfig.ts` 这个幻影路径在**活跃文档中已清零**（`git grep` 实测）。

| 文件 | 状态 |
| --- | --- |
| `docs/planning/推进方案.md:41` | ✅ 已改指 `src/lib/perpConfig.ts` |
| `docs/planning/推进方案.md:133` | ✅ 同上 |
| `docs/planning/执行方案-后端与合约.md:151` | ✅ 同上（S-6 **漏列**了这处） |
| `src/lib/perp.ts:4` | ✅ 注释改为 `./perpConfig`（与 `:33` 的实际 `from "./perpConfig"` 一致） |

**⚠️ S-6 的待改清单里有 2 处不该改 —— 这是对审计报告本身的纠正**：

S-6 把 `docs/执行记录-Phase0.md:205-207, 272` 列为"应改为 `src/lib/perpConfig.ts`"。**这是误判**：

- `执行记录-Phase0.md:205` 是**历史叙事**——「写共享常量时，我**最初**放在 `contracts/lib/perpConfig.ts`（因为 `推进方案.md` 第 41 行就是这么写的），前端反向导入」。
  **它描述的正是当初放错、随后发现并迁走的过程**。把它改成 `src/` 会**抹掉问题本身**，让这条记录失去意义。
- `:223` 同理，是"问题 2"里**回放的错误代码片段**。
- `:272` 是那次提交的**文件清单**，`src/lib/perpConfig.ts` 本就正确。

**结论**：历史记录与审计快照**不改**。修文档时"活跃方案"与"历史留痕"必须区分——
**前者是待执行指令，后者是既有事实**。把历史改成现状，等于篡改证据链。
（`docs/planning/缺陷分析-审计报告.md` 本身亦然：它是**时点审计结论**，
其 `:368` 的「不存在」当时为真，不改；仅**未竟清单**的条目按本节结论视为已了结。）

> **另：`GAP-34` 的错误指针已顺带修正**。`GAP-34` 引用「`推进方案.md:40`」指代接口冻结，
> 但实测 `:40` 是「部署 `MockUSDC` + `DemoOracle`」，接口冻结描述在 **`:34-37`**。
> `git show 8f69995:docs/planning/推进方案.md` 证实**引入 GAP-34 的那个提交里 `:40` 就已经是这行**，
> 即该指针**自始即错**、非文档后续漂移。本文件 `:197` 与 `:331` 已改为 `:34-37`。

---

**常量 SSOT 的正确表述**（供各 Agent 统一口径）：

| 角色 | 文件 | 说明 |
| --- | --- | --- |
| 链上编译期消费者 | `contracts/contracts/perp/PerpConstants.sol` | 定义 fee/margin/leverage bps |
| 链下消费者 SSOT | `src/lib/perpConfig.ts` | **镜像**上者；Pyth feedId 只在此定义 |
| **最终裁决者** | 部署实例的 `IPositionManager` getter 读回值 | 唯一不会过期的口径 |

---

### 3.6 GAP-06 已关闭；并发现 GAP-37（面板的两条清算口径）

**GAP-06 关闭**（`docs/changes/015`）。原判「需要链上部署」**是错的**——一致性在进程内
hardhat 链上即可验证。做法是**黄金向量**：前端算出 60 条强平价落成文件，
合约测试读同一份文件在链上重放，两侧任一漂移都会失败。

**验证结论**：前端注释声称的「bit-for-bit 一致」**成立**（资金费为零的口径下，60 条全部对上边界）。

**变异测试证明判据有牙齿**：给多头分支注入 1% 偏差 → 前端对拍变红；
即使用 `UPDATE_VECTORS=1` 重新生成向量把前端测试"洗白"，**合约对拍仍然抓住**
（`chain says NOT liquidatable`）。两侧各司其职，一条都不能少。

> **另一处判断修正**：GAP-06 与 GAP-34 的「需要链上部署」阻塞是**误判**。
> 合约逻辑的验证从来不需要部署到任何网络——hardhat 进程内链即可。

---

**新发现 GAP-37 —— 面板上并排显示两个不同口径的数字**

实测 `src/components/PositionPanel.tsx`：

| 位置 | 数据 | 口径 |
| --- | --- | --- |
| `:236` `liquidatable` | **读链上** `isLiquidatable` | **含**资金费（合约判定） |
| `:260` `liqPrice` | **本地算** `liquidationPrice()` | **不含**资金费（只有价格公式） |

**后果**：有持仓且资金费非零时，面板可能出现「显示为未达清算、但链上已判定可清算」
——**同一屏上两个数字互相矛盾**。这正是 `推进方案.md` 风险表所说「可信度崩」的另一种形态。

**且 `:258-259` 的注释原先是失实的**：它称该值「由 `tests/perp.test.ts` 保障」，
而那个文件的往返断言是**资金费盲**的（本地自洽、抓不到此偏离）。注释已改为指向
`LiquidationParity.ts` 并写明资金费这一保留项。

**未修**：修法需 `liquidationPriceWithFunding()`，且「面板该显示哪个数」是**产品决策**——
本次只把它变成**可测的**并登记，未擅自改展示行为。

---

## 4. RFC-001 相关项（GAP-18~25）—— **已由 `ADR-004` 裁决**

> ✅ **本节四个悬置项（GAP-22~25）原标"需要谁决策：架构"，现已裁决**（`docs/adr/ADR-004`，2026-10-08）。
> **结论：不按 RFC-001 原样落地**，RFC 降格为**输入材料**。

| GAP | 冲突 | **裁决（ADR-004）** |
| --- | --- | --- |
| GAP-22 | RFC 把"从零建委托系统"当前提，但 `backend/internal/agentcard` 已有约 70% 的 P0（限额/日限/白名单/冻结/批次归集） | **复用 `agentcard`，并排新建 = 不做**（D3）。消除新增第二套委托系统的风险 |
| GAP-23 | RFC 要求 Redis + gRPC + proto + Docker；仓库只有 `net/http` + pgx。且 RFC 内部 4 处自相矛盾 | **三者均不采纳**（D2）。额度预扣若确需，先用已有 PG 事务（`SELECT ... FOR UPDATE`） |
| GAP-24 | 三套 Session Key 模型（`sk_sess_` 字符串 / PG 地址 / EIP-712）互不兼容，**无代码把内存态写入 PG** | **部分进展**（`docs/changes/013`）：EIP-712 模型**已落链上**（`SessionKeyRegistry.sol`）并有 `viem` 摘要互操作测试。**但 Go 侧 `agentcard` 仍用 `sk_sess_` bearer 字符串**（`permission_guard.go:46`），未升级。接上需 Go 侧引入 `go-ethereum` 或最小 secp256k1 依赖——**重依赖，需先决策**（与 `ADR-001` 同源） |
| GAP-25 | `agentcard/service.go:95` 全程持全局锁 → 所有用户授权全局串行化；RFC 要 10,000 TPS | **保留、不阻塞**（§4 后果）：需先写基准测试量化，再见真章。10,000 TPS 的**叙事目标已放弃**——6 天内没有评委能验证 TPS |

**GAP-18~21（RFC 的 Lua 脚本缺陷）** 已实测复现（重复预扣致资金卡死、TTL 丢账、浮点漂移 5e-12、`daily_spent` 永不重置）。
**本次不采纳 Redis，故这四条不激活**（D2）；若将来采纳，**必须先修**——
修正规格见 `推荐方案` §3.4 的 F-01~F-06（该节仍是有效规格，未被 ADR-004 否决）。

**RFC-001 只复用三处**（ADR-004 D1）：`settlement_ledger` DDL（§4.2.2）、
ZK Validator 空接口（§3.4）、EIP-712 授权语义（改为升级 `agentcard`）。

---

## 5. 无阻塞但未做（可直接开工）

| 编号 | 事项 | 起点 | 预估 |
| --- | --- | --- | --- |
| GAP-25 | `agentcard` 全局锁 → 需先写基准测试量化 | `backend/internal/agentcard` | 1 天 |
| GAP-13 | 后端接 go-ethereum，`/health` 改为真实探活 | `backend/` | 1 天 |

---

## 6. 明确不做（⬜，附理由）

| 编号 | 事项 | 理由 |
| --- | --- | --- |
| GAP-30 | Redis 额度池 | `想法记录.md:4` 划定范围为"只完成立项/需求/设计/开发/测试和发布"；且 RFC 的 Lua 有 4 个实测缺陷（GAP-18~21），本次不值得引入 |
| GAP-18~21 | 修 RFC Lua 缺陷 | 不采纳 Redis 即不激活。**若将来采纳，必须先修这四条** |
| 05~10 环 | 运维/故障/迭代/自动化 | `想法记录.md:4` 明确不做，"交由平台处理" |
| **04 构建环** | 容器镜像 Digest / `REVISION` 运行时断言 | 本仓无 Dockerfile、无 `REVISION` 断言。**人工决定：不处理、不标记**（`ADR-004` D4 / `docs/changes/010`） |

---

## 7. 当前质量基线（用于回归）

分支 `feat/perp-solvency-and-panel`，**本地与 CI 均已实测**：

| 指标 | 数值 | 命令 |
| --- | --- | --- |
| 合约测试 | **146 passing**（3 solidity, 143 nodejs） | `cd contracts && npx hardhat test` |
| 合约覆盖率 | **89.22% 行**（LF 口径；门禁 88%） | `cd contracts && npx hardhat test --coverage && npx tsx scripts/check-coverage.ts` |
| 合约类型检查 | exit 0 | `cd contracts && npx tsc --noEmit` |
| 前端单测 | **23 passing**（3 files） | `npx vitest run` |
| 前端类型检查 | exit 0 | `npx tsc --noEmit` |
| 前端 lint | exit 0 | `npx next lint` |
| 前端构建 | ✓ 成功，含 `○ /perp` | `npx next build` |
| 后端构建/静态检查 | exit 0 | `cd backend && go build ./... && go vet ./...` |
| 后端测试 | **29 passing**，`-race` | `cd backend && go test -race ./...` |

**CI 状态**：`.github/workflows/ci.yml` 三个 job **全部通过**（run `37623974490`）。

> ⚠️ **覆盖率读数必须取自 LF 检出**（重新 clone 或在 `.gitattributes` 生效后重新检出）。
> 长期存在的 Windows 工作树会读到**偏高约 5 个点**的值——这正是首次 CI 失败的原因（GAP-35）。

**本轮基线变化**：合约 111 → **146**（+35），前端单测 9 → **23**（+14），后端 0 → **29**。
覆盖率从 0 → **89.22%（LF）**，带门禁。

---

## 8. 本轮提交

| 提交 | 内容 |
| --- | --- |
| `0193e3a` | 修 GAP-01~05：出金上限 + 逐笔容错 + 赏金基数（ADR-002） |
| `2c0e353` | `scripts/demo-seed.ts` 按出金上限定容 |
| `36fc5be` | 前端接线：`/perp` + `PositionPanel` + `perpAbi` |
| `2b05f05` | CI 门禁（GAP-10）+ 修 3 个既有类型错误（2 个非本人引入） |
| `8d9c715` | 清算 Bot 核心：头寸数学镜像 + 本地 nonce 管理器（GAP-26 部分） |
| `1e85092` | 逐块资金费率（GAP-27，ADR-003）+ 本台账 |
| `df227bf` | 规划文档迁入仓库（GAP-31）+ 修 FEEDS 矛盾（GAP-09） |
| `50c51d8` | 删陈旧 lockfile（GAP-28）+ README 去明文凭证（GAP-12 部分） |
| `506c4ef` | 覆盖率门禁（GAP-32） |
| `c7da777` | 平仓退出保护（GAP-07）+ 推送可观测（GAP-08） |
| `8f69995` | 台账更新（新开 GAP-33/34） |
| `42e41fc` | 修 14 处失效文档路径 |
| `1ac689a` | CI 改为**所有分支**触发（原来只 main，导致 fork 分支无 CI） |
| `e48ed61` | **CI 步骤顺序**：先 compile 再 tsc（artifacts 被 gitignore，否则 110 个类型错误） |
| `f6ec42d` | 覆盖率按 **LF 口径** + 新增 `.gitattributes`（GAP-35） |
| `822488e` | 台账记录 GAP-35 与两个"只有 CI 能发现"的失败 |

**详细复盘见 `docs/changes/009-CI首跑修复.md`** —— 三个问题**本机全部是绿的**。

**新一轮（仓库文档与 gitignore 修复）**：修 GAP-36（`.gitignore` 根锚定→`**/`）
+ 修 GAP-16 幻影路径（活跃文档 4 处）+ 修 GAP-34 错误指针 + 撤销 GAP-37（编号撞车）。
详见 `docs/changes/010-gitignore锚定与文档路径修复.md`。

**再一轮（03 环收口）**：前端覆盖率门禁（GAP-33 ✅）——`vitest.config.mts` 加
带 `include` 范围的阈值 + `coverage/` 入忽略 + CI 改跑 `--coverage`。详见 `docs/changes/011-前端覆盖率门禁.md`。

**再一轮（线程 B）**：EIP-712 链上委托 `SessionKeyRegistry.sol`（`推荐方案` P1-b）
+ 19 例测试（7 正向 / 12 证伪）+ 纳入覆盖率门禁 + ignition 模块。详见 `docs/changes/013-线程B-EIP712链上委托.md`。

**再一轮（打通连接）**：`openPositionFor` + `SessionKeyRegistry.chargeSpend`（具名消费方，两入口一套规则）
——Agent 持 session key 在链上开仓，用户签一次后不再碰钱包。178 用例通过。详见 `docs/changes/014-打通连接-Agent链上开仓.md`。

**再一轮（对拍）**：GAP-06 关闭 —— 前端强平价与链上判定黄金向量对拍（60 条），
含变异测试证明判据有牙齿；并发现 GAP-37（面板两条清算口径）。详见 `docs/changes/015-GAP06-强平价对拍.md`。

**再一轮（演示可运行）**：新增 `DemoControlPanel.tsx`（演示扳机，直接读链不经 Bot）
+ `DemoRehearsal.ts`（把彩排变成测试）；补前端 ABI 缺失的 `PositionLiquidated`。
**发现演示自带 42 分钟资金费时钟**（seed 把费率设到上限 1e13）。详见 `docs/changes/016-演示可运行-控制台与彩排.md`。

**再一轮（重新冻结）**：GAP-34 关闭 —— `IPositionManager` 接口重新冻结，
文件头加权威冻结清单（20 函数 + 5 事件），并新增机械守卫 `FrozenSurface.ts`（含变异测试）。
详见 `docs/changes/017-GAP34-接口重新冻结.md`。

**再一轮（可信度）**：GAP-14 关闭 —— 合成行情改用**确定性种子**（同请求恒定、跨天推进），
来源名改为如实（`synthetic_curated` / `synthetic_fallback`），并让 UI **显示**来源与说明。
详见 `docs/changes/018-GAP14-合成行情标注.md`。

**再一轮（发布环）**：GAP-11 / GAP-29 关闭 —— `deploy/README.md` 成为**发布环 runbook**
（含第 0 步：GAP-12 轮换凭证，附就绪改动与风险说明）；并补齐 `.env.example` 缺失的 4 个变量。
详见 `docs/changes/019-GAP11-发布环与env补齐.md`。

**PR**：[moonhotline/koliance#5](https://github.com/moonhotline/koliance/pull/5)
（16 提交，52 文件，CI 三 job 全绿）

---

## 9. 修复过程中引入又修掉的真实回归（供参考）

这些是**修 A 引入 B** 的案例，值得记下来，因为它们都是"读代码看不出来、跑测试才暴露"的：

| 提交 | 引入的回归 | 抓到它的测试 | 根因 |
| --- | --- | --- | --- |
| `1e85092` | 资金费无侧向符号 → 两侧被收同样的费，空头永远收不到钱 | `charges the crowded side and pays the thin side` | 资金费退化为手续费 |
| `1e85092` | `_equityAfterFunding` 漏了 `collateral` | `Pays a winning long out of the pool` | 权益凭空少一整个抵押品 |
| `506c4ef` | 覆盖率脚本在**无分支数据**的报告上打印"branches 100%" | 自己怀疑那个 100% 并 grep 原始文件 | 空分母被当成 100% |
| `c7da777` | 类型化调用打到无代码地址 → **每笔平仓 revert** | `Does not block a close when the price updater is not a contract` | `try/catch` **不捕获**"目标无代码" |
| `e48ed61` | CI 先 tsc 后 compile → **110 个类型错误**（本地却全绿） | 首次真实 CI 运行 | `artifacts/` 被 gitignore，viem 的合约类型从它推导 |
| `f6ec42d` | 覆盖率阈值按 CRLF 本机读数定 → **CI 失败** | 首次真实 CI 运行 | 覆盖率插桩按字节偏移，行尾改变测量结果 |
| `1ac689a` | workflow 从未被触发（`branches: [main]` 不覆盖 feature 分支） | `gh pr checks` 零 check-run | fork 的 PR 运行需要 base 分支已有 workflow |

**共性**：六条都不是逻辑想错，而是**对一个库/语言/环境行为的错误假设**
（整数除法舍入、try/catch 的边界、空分母、返回值的字段顺序、
构建产物被 gitignore、行尾对测量结果的影响）。

**其中三条只有真实 CI 才能发现** —— 本机怎么跑都是绿的。
**这是"CI 到底值不值"这个问题的答案，由 CI 自己给出。**
详见 `docs/changes/009-CI首跑修复.md`。
