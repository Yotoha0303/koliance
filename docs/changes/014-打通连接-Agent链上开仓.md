# 014 — 打通"最后一公里"：Agent 持 Session Key 在链上开仓

- **日期**：2026-10-08（UTC）
- **环**：02 开发
- **类型**：新增 + 一处设计缺口修复
- **关联**：**ADR-004**（"双线程的连接"至此可执行）· GAP-24（链上闭环）· `docs/changes/013`（上一环）
- **分支**：`feat/perp-solvency-and-panel`

---

## 做了什么

`013` 建好了 `SessionKeyRegistry`——用户能签一份有界授权。但**没有任何东西使用它**：
`PositionManager` 不认识它，Agent 拿不到开仓的路。本项目要的是**连接**：
Agent 持用户签过的 session key 去开仓，用户签一次之后**再不碰钱包**。

本次把这个连接接上。**不依赖任何外部资源**（`PRIVATE_KEY` / 测试币都不需要），`hardhat test` 闭环。

---

## 改动

### 1. `PositionManager`：抽出共享开仓体 + 新增 `openPositionFor`

把 `openPosition` 的实现体抽成 `_openPosition(owner_, payer, …)`：

| 入口 | owner | payer |
| --- | --- | --- |
| `openPosition`（原路径） | `msg.sender` | `msg.sender` |
| **`openPositionFor`（新）** | **委托的用户**（从 registry 读） | **Agent**（`msg.sender`） |

**两个角色必须分开，理由不是偏好**：
- owner 是**用户**——Agent 若拥有头寸，就无法被"撤销回干净状态"，头寸会变成它自己的。
- payer 是**Agent**——它出保证金、付 gas。这正是"自治执行"在链上必须意味着的东西。

**原有路径零行为变化**：`openPosition` 现在是 `_openPosition(msg.sender, msg.sender, …)` 的一层薄包装。
有专门用例断言自服务开仓**不消耗**任何委托额度。

**默认关闭（fail closed）**：未设 registry 时 `openPositionFor` 直接 revert `SessionKeyRegistryUnset`。
不猜地址——猜地址的 manager 就是"委托规则没人选过"的 manager。

### 2. 发现并修掉一个真实的设计缺口（本次最有价值的部分）

第一次集成测试，**11 例里 5 例失败，单一根因**：

```
SessionKeyRegistry.authorizeSpend:288
  reverted with NotAuthorizedCaller("0xDC11…12aDD")
```

栈里的地址是 **`PositionManager` 合约本身**。`authorizeSpend` 只允许 **agent** 或 **user** 调用，
而链上真正要扣减额度的**是 manager 合约**——它既不是 agent 也不是 user。

**这不是测试写错了，是设计缺了一块。** 想了三种修法，前两种被否：

| 方案 | 否决理由 |
| --- | --- |
| 放宽为"任何调用者都可以扣" | 等于把有界授权变成**可转让的 bearer token**，路人可燃烧他人额度 |
| 限定消费方必须是 **EOA** | **与我自己的拓扑自相矛盾**——消费方本来就是合约。我一度写了 `ConsumerMustBeEOA`，随即发现它和调用方互斥 |
| **具名消费方 + 独立模块入口**（采纳） | 见下 |

**采纳的做法**：

```solidity
address public spendConsumer;                    // registry owner 指定一个模块
function setSpendConsumer(address) onlyOwner     // 指定/清零
function authorizeSpend(...)                     // agent 或 user，语义不变
function chargeSpend(...)                        // 仅 spendConsumer
function _charge(...) private                    // 唯一的规则实现，两个入口共用
```

**关键点是"两个入口、一套规则"**：`chargeSpend` **不能**绕过任何一条限额——
上限、日窗口、冻结、过期、撤销全部由 `_charge` 统一施加。
有专门用例断言：被指定的消费方**照样**会撞 `ExceededPerTxLimit`。

**为什么不干脆让 agent 自己补扣？** 那等于让调用方**断言自己的花费成功**——
正是 registry 存在的原因所要防止的。所以扣减权交给"能证明动作确实发生了"的那一方，
而在这个仓库里，那就是 `PositionManager`。

### 3. 单位必须写明（否则就是下一个 GAP-24）

registry 把金额当**不透明 `uint256`**——它限制"某笔花费"，对"花的是什么"没有意见。
于是单位由消费方决定，**而每个消费方必须写清是哪个**：

> perp 路径传 `collateralAmount` 的 **USDC 基本单位（6 位小数）**，
> 即 ERC-20 transfer 用的那个数，**不是** `PositionManager` 内部存的 18 位 USD。
> 混用会让上限看起来松 $10^{12}$ 倍。

已写进 `ISessionKeyRegistry` 的 natspec。`openPositionFor` 只传原始转账数额，不传别的。

---

## 验证

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 全套件 | `npx hardhat test --coverage` | **178 passing**（原 165）✅ |
| 集成测试 | `npx hardhat test test/perp/AgentPosition.ts` | **11 passing** ✅ |
| 委托测试 | `npx hardhat test test/perp/SessionKeyRegistry.ts` | **21 passing**（原 19）✅ |
| 覆盖率门禁 | `npx tsx scripts/check-coverage.ts` | **90.92%** ≥ 88%，exit=0 ✅ |
| 类型检查 | `npx tsc --noEmit` | **exit=0** ✅ |

## 负向证伪（D3）——集成侧 11 例中 8 例是证伪

| 证伪用例 | 攻击面 |
| --- | --- |
| **日额度被消耗**（第 2 笔 2,000 后第 3 笔必拒） | "检查了但没扣"的委托不是上限，只是建议——Agent 可以每块开一仓 |
| 单笔超上限 | 单笔闸门 |
| **调用者不是被委托的 agent** | 持 key 者不得冒充被授权方 |
| 撤销后 | 撤销必须生效 |
| 过期后 | 时效 |
| **管理器未接 registry** | 必须 fail closed |
| 未注册的 session key | 无授权不得开仓 |
| 自服务路径不消耗委托额度 | 新入口不得污染旧路径 |

registry 侧新增 2 例：**`chargeSpend` 只认被指定的消费方**（未指定时连 agent 也不行；
指定后其他人仍不行）、**非 owner 不得指定消费方**。

---

## 未竟

- **Go 侧仍未升级**。`agentcard` 还是 `sk_sess_` bearer 字符串（`permission_guard.go:46`）。
  接上需 Go 引入 `go-ethereum` 或最小 secp256k1 依赖——**重依赖，需你决策**（与 `ADR-001` 同源）。
- **未部署**。registry 与 manager 都还没有 Monad 地址，阻塞于 `PRIVATE_KEY` + 测试币。
- **前端无授权面板**。用户目前只能通过脚本签委托。
- **`chargeSpend` 是单槽位**（一个 `spendConsumer`）。若将来有第二个模块要扣减，
  需改成集合；**当前不需要**，故不预做。
