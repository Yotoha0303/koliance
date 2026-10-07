# 执行记录：从《项目目标》到 Phase 0 代码

> 目的：留下可复盘的决策轨迹，供后续学习"为什么这么写"，而不只是"写了什么"。
> 记录范围：`docs/项目目标.md` + `docs/推进方案.md` → Phase 0 代码落地（commit `2c42797`）
> 编写日期：2026-10-05

---

## 一、起点：两份上游文档的矛盾

### 读到了什么

`docs/项目目标.md`（1791 字节，2026-10-03）描述的是**永续合约系统**：
- Vault 金库（对标 GMX v1，单池模式）
- PositionManager（开平仓、杠杆、清算）
- Pyth 拉取式预言机
- Go 清算 Bot
- 前端演示面板

`docs/推进方案.md`（9941 字节，2026-10-03）是它的细化版，已经把工期、接口、风险列出来了。

### 发现的第一个矛盾

`推进方案.md` 第 0 节自己就点破了：

> **结论：不要改 `Koliance.sol`。** 身份合约与本次目标正交

但仓库里**已有的东西**是：链上身份/信任凭证系统（`Koliance.sol`）、AgentCard、Steam 游戏证明、Alpaca 股票交易。

**两者唯一的交集是 Monad 部署链路和前端外壳。** 这一点决定了后面所有代码的放置位置——新增独立目录，不碰旧的。

> 🧠 **可学的点**：拿到一个"要做什么"的文档时，第一件事是核对**它和代码库现状的差集**。`推进方案.md` 做对了这件事（它的第 0 节就是一张差距表），后来我沿用了这个做法。

---

## 二、代码勘察：我实际读了什么

顺序不是随意的——先读**配置和契约**，再读**实现**，因为配置决定了实现能怎么写。

| 读的文件 | 为什么读它 | 得到了什么关键事实 |
| --- | --- | --- |
| `backend/go.mod` | 判断后端能力边界 | 只有 3 个依赖（pgx / godotenv / stripe-go），**没有 go-ethereum** |
| `backend/cmd/api/main.go` | 看 HTTP 层实际状态 | 431 行内联 17 个路由，9 处手写方法校验 |
| `backend/internal/config/config.go` | 看配置约定 | 读 `.env`，`PYTH_HERMES_URL` 已配但没被用过 |
| `backend/internal/market/oracle_pyth.go` | **验证 Pyth 是否真的接了** | ⚠️ 文件名是 Pyth，实现调的是 Alpaca |
| `contracts/hardhat.config.ts` | 确认工具链 | Hardhat 3 + viem + node:test，Monad 10143 |
| `contracts/package.json` | 确认依赖与模块制式 | `"type": "module"` ← **这个后面引发了大问题** |
| `contracts/test/Koliance.ts` | 学现有测试风格 | viem + `node:test` 的写法 |
| `src/lib/api.ts` | 看前后端接口约定 | 前端直连 Go 后端，有 fallback 逻辑 |
| `.vercelignore` | 看部署范围 | **`contracts/` 被排除** ← 又一个关键约束 |

### 两个勘察得出的重要结论

**(1) Pyth 是假的**

`oracle_pyth.go` 里：
```go
FeedID: "alpaca_us_equity",   // ← 不是 Pyth feed id
```
`GetAllPrices()` 调的是 `data.alpaca.markets/v2/stocks/bars/latest`。`main.go:83` 的 `"pyth": true` 是写死的。

→ **含义**：清算 Bot 是全新工程，不是"改造现有模块"。

**(2) 后端零链上交互**

`go.mod` 里没有 go-ethereum。README 宣称的"Keccak256 证明写入 `Koliance.sol`"未实现。

→ **含义**：所有链上读写都要新建 `internal/chain`。

> 🧠 **可学的点**：**文件名的可信度低于 import 语句。** `oracle_pyth.go` 看起来像 Pyth 集成，`PythPriceData` 结构体也在，但真正的证据是 import 和 HTTP 请求目标。只看文件名会得出完全错误的排期。

---

## 三、外部事实核查：三次推翻了上游文档的假设

这一步**必须先做**，因为它决定了后面代码写什么。`推进方案.md` 里的风险清单有两条是"高危"，我逐条去核了。

### 核查 1：Pyth 到底在不在 Monad 上？

- 先查 Pyth 官方 EVM 地址表 → **Monad 不在列表里**（当时结论：可能没有）
- 再查 Monad 官方 Oracles 文档 → **Monad 确实列了 Pyth**，地址 `0x2880aB155794e7179c9eE2e38200202908C17B43`

**教训**：单一来源会给出相反的结论。两个官方源都要查，冲突时以**被部署方（Monad）**的文档为准。

### 核查 2：美股 feed 会盘中冻住吗？

`推进方案.md` 风险清单第 1 条断言"收盘后价格会冻住"，因此必须做 `DemoOracle` 兜底。

我直接查了 Pyth Hermes API：
- `Equity.US.NVDA/USD` —— 盘中更新
- **`Equity.Index.NVDA/USD`** —— 描述是 "PYTH PRICE IN USD FOR NVDA **24/7**"

→ **风险大幅降级**，但不是消除：真实 NVDA 不会因为你按了一下就跌 15%。

**`DemoOracle` 的职责因此改变了**：
- ~~盘中空窗兜底~~（原设计意图）
- **确定性演示触发器**（真实职责）

> 🧠 **可学的点**：上游文档的风险判断**基于当时的信息**，会过时。核实不是为了否定它，而是为了**重新定位某个组件存在的理由**。`DemoOracle` 从"补丁"变成了"演示核心"，这改变了它的设计优先级。

### 核查 3：赛道上有谁？

查了 Monad 生态后发现有直接竞品（Perpl 链上 CLOB 永续、Ostium RWA 永续 $53B 成交），以及一个**8 天后截止的黑客松**（Metropolis，10/13）。

而 Metropolis Track 1 的官方样例想法里写着：
> "perpetuals whose **funding refreshes each block**"

→ 这暗示了评委偏好：**用 Monad 性能做别的链做不到的机制**。

> 🧠 **可学的点**：技术方案不该在真空中确定。竞品占了什么叙事、赛题想看到什么，会反过来影响你**先做哪个模块**。

---

## 四、代码落地：每一步的判断依据

### 决策 1：为什么 Phase 0 是"冻结接口"？

`推进方案.md` 里写得很清楚：

> 关键是 **B 和 C 不得等 A 交付合约才能开工** —— 阶段 0 冻结接口的全部意义就在这里。

**逻辑链**：
1. 合约（A）、Go（B）、前端（C）要并行
2. 并行的前提是三方对"接口长什么样"达成一致
3. 所以第一步不是写实现，是**把接口钉死**

**为什么先做这个而不是直接写 Vault**：接口是**最便宜可改**的东西。此时改 `IPositionManager` 成本≈0；等 Vault/PositionManager 都写完了再改，要动三个模块。

> 🧠 **可学的点**：**先做"改起来最便宜、影响面最大"的东西。** 接口符合这两条——它是所有并行工作的契约。

### 决策 2：`IPriceOracle` 为什么要单独抽出来？

```solidity
interface IPriceOracle {
    function getPrice(bytes32 feedId) external view returns (uint256 price, uint256 publishTime);
}
```

`推进方案.md` 第 38 行说：

> **`IPriceOracle` 的抽象是全局关键**：业务合约只依赖接口，生产实现走 `PythOracleAdapter`，演示实现走 `DemoOracle`。后续替换不动任何业务代码。

**我的增强**：这个抽象还有一个上游文档没说的价值——**可测试性**。有了接口，测试里可以塞一个 `MockOracle`，不用起链、不用拉 Hermes。这让"清算阈值恰好上下 1 wei"这类边界测试变得可行。

### 决策 3：为什么给 `IPositionManager` 加参数 getter？

上游文档**没有**要求这个：

```solidity
function openFeeBps() external view returns (uint256);
function maintenanceMarginBps() external view returns (uint256);
// ...
```

我加它的理由：**参数的权威来源只有一个，就是部署**。

- Go 清算 Bot 启动时读链，而不是硬编码 1%
- 前端加载时对账，防止"重新部署但改了参数"导致 UI 静默失真

> 🧠 **可学的点**：`推进方案.md` 给的是**参数表**（`openFeeBps = 10`）。但如果这些值在三个地方各写一份，就必然漂移。**把"值的定义"和"值的传递"分开**——定义在合约里，其他人读出来。

### 决策 4：`liquidationPrice()` 为什么要跟链上"逐位对齐"？

`推进方案.md` 风险清单第 5 条：

> 前端强平价 ≠ 链上清算价 | 演示当场对不上，可信度崩 | `src/lib/perp.ts` 与合约共用常量

**"共用常量"只解决了一半问题。** 常量一致 ≠ 结果一致，因为**整数除法的顺序会改变结果**。

所以我做了两件事：
1. `perpConfig.ts` 作为唯一常量来源（上游要求）
2. `liquidationPrice()` 的整数运算**顺序与链上完全一致**（上游没要求，但不做就白做）

数学推导：
```
清算条件：collateral + pnl == size * MMR
其中 pnl = size * (exit - entry) / entry

解出 price：
  多仓： P = entry * (mm - collateral + size) / size
  空仓： P = entry * (collateral + size - mm) / size
  其中 mm = size * MAINTENANCE_MARGIN_BPS / 10000   ← 第一次除法
  最后再除以 size                                    ← 第二次除法
```
**两次整数除法，顺序不能变。** 链上也必须按同样顺序算。

**验证方式**（这一步是关键）：
```
isLiquidatable(liqPrice)      → true    ✅
isLiquidatable(liqPrice + 1)  → false   ✅  ← 这一个才说明精确
isLiquidatable(liqPrice - 1)  → true    ✅
```
如果在 `liqPrice + 1 wei` 处仍然是 `true`，说明有舍入漂移，演示时会对不上。

> 🧠 **可学的点**：涉及整数运算的"两处实现必须一致"时，**共用常量是不够的，要共用运算顺序**。而验证不能只测"大概对"，要测**边界上的 ±1**。

---

## 五、过程中撞到的两个真问题（及为什么那样修）

这两处是本次执行里最有价值的部分，因为它们**不是写错了，是设计约束撞上了**。

### 问题 1：`.vercelignore` 排除了 `contracts/`

**怎么发现的**：写共享常量时，我最初放在 `contracts/lib/perpConfig.ts`（因为 `推进方案.md` 第 41 行就是这么写的），前端反向导入。

**为什么这是错的**：`.vercelignore` 第 2 行：
```
contracts/
```
→ Vercel 构建时整个 `contracts/` 目录**不存在**，前端 `import` 会直接失败。

**修复**：canonical 文件改放 `src/lib/perpConfig.ts`（前端树内）。

> 🧠 **可学的点**：`推进方案.md` 说"前端 `src/lib/perp.ts` 直接 re-export 它"，方向是对的（单一来源），但**没说文件该放哪**。放错方向的代价是**部署直接挂**。
> 结论：**共享文件的位置由"最少权限的那一方"决定** —— 前端构建拿不到 `contracts/`，所以文件必须在 `src/`。

### 问题 2：跨目录导入触发 ESM/CJS 冲突

放好位置后，我让合约侧反向引用 `src/`：

```ts
// contracts/lib/perpConfig.ts
export * from "../../src/lib/perpConfig.js";
```

**`tsc` 报错**：
```
error TS6059: File 'src/lib/perpConfig.ts' is not under 'rootDir' 'contracts'
  File is CommonJS module because 'koliance/package.json' does not have field "type"
```

**根因**（两个独立问题叠在一起）：
1. `contracts/package.json` 有 `"type": "module"`（ESM）
2. 根 `package.json` **没有** `type` 字段 → 被当作 CJS
3. 跨过这个边界 → TS 认为模块制式不一致，拒绝

**考虑过的三个方案**：

| 方案 | 评估 | 结论 |
| --- | --- | --- |
| 根 `package.json` 加 `"type": "module"` | 会波及 `postcss.config.mjs`、`tailwind.config.ts`、`src/types/ethereum.d.ts` 等既有配置 | ❌ 影响面不可控 |
| 用 JSON 作唯一来源 | JSON 里**不能写 BigInt 字面量**（`10_000n`），而常量必须精确 | ❌ 精度不够 |
| **切断反向导入** | 合约不 import 那个文件，改为读 getter | ✅ 采用 |

**最终设计**：
- `src/lib/perpConfig.ts` —— 前端用的镜像值（有注释标明"不是运行时权威"）
- `IPositionManager.openFeeBps()` 等 —— **真正的权威**，Go 和前端都从这里读
- 合约侧**完全不引用** `src/`

修完 `tsc` exit 0。

> 🧠 **可学的点**：
> - "两处共用一份文件"经常撞上**模块系统/构建边界**。此时**共享数据**往往比**共享代码文件**更稳。
> - 我最初的错误是"为了让两边共用代码，去改模块制式"——**改模块制式影响面太大**。正确做法是**改耦合方式**（从 import 改成读接口）。
> - 这个错误是**跑了 `tsc` 才发现的**。如果只跑 `hardhat compile`（只编译 .sol），永远发现不了。

---

## 六、最终交付物

commit `2c42797`，9 文件 +590 行（git 口径）：

| 文件 | 行数 | 作用 |
| --- | --- | --- |
| `contracts/contracts/perp/interfaces/IPriceOracle.sol` | +18 | 预言机抽象，Pyth/Demo 可互换 |
| `contracts/contracts/perp/interfaces/IVault.sol` | +33 | 金库：LP 份额、`payOut`/`receiveFees` 权限 |
| `contracts/contracts/perp/interfaces/IPositionManager.sol` | +83 | 开平仓、批量清算、参数 getter、事件签名 |
| `contracts/contracts/perp/MockUSDC.sol` | +71 | 6 位小数测试币，`mint` 无权限 |
| `contracts/ignition/modules/MockUSDC.ts` | +15 | Ignition 部署模块 |
| `contracts/test/perp/MockUSDC.ts` | +108 | 7 个测试 |
| `src/lib/perpConfig.ts` | +77 | 常量（含 Pyth feed id） |
| `src/lib/perp.ts` | +182 | 强平价、保证金率、清算赏金、开仓校验 |
| `.gitignore` | +3 | 加 `*.tsbuildinfo` |

**验证证据**：
- `npx hardhat compile` —— 6 个 .sol 文件，无错
- `npx hardhat test` —— **14 passing**（新增 7 + 原有 7）
- `npx tsc --noEmit` —— 根目录与 `contracts/` **均 exit 0**
- 清算价数值校验 —— 多仓 $163.80 / 空仓 $196.20，**边界 ±1 wei 正确**

---

## 七、这次执行的思维模式提炼

按可复用程度排序：

1. **先核实现状，再信文档。** `oracle_pyth.go` 里没有 Pyth；Pyth 在 Monad 上确实有；美股 feed 确实 24/7。三个结论都和"读文件名/读文档"的直觉不同。

2. **先做最便宜的契约。** 接口比实现便宜。改接口成本≈0，改实现要动三个模块。

3. **共享常量 ≠ 结果一致。** 整数运算要共享**顺序**，验证要测 **±1 wei 边界**。

4. **共享的东西放在权限最小的那一方。** 前端构建拿不到 `contracts/`，所以共享文件必须在 `src/`。

5. **耦合方式出问题时，改耦合，别改环境。** 撞上 ESM/CJS 时，我没有去改根 `package.json` 的模块制式（影响面不可控），而是切断了反向依赖。

6. **编译通过 ≠ 类型正确。** `hardhat compile` 只编译 `.sol`。必须单独跑 `tsc` 才能发现跨模块问题。

7. **上游文档的风险项会过时。** 核实的价值不只在"消除风险"，还在于**重新定位组件存在的理由**（`DemoOracle` 从兜底变成演示核心）。

---

## 附：完整时间线

| # | 动作 | 产出 |
| --- | --- | --- |
| 1 | 读 `项目目标.md`、`推进方案.md` | 明确目标是永续系统，且与现有身份系统正交 |
| 2 | 勘察 backend + contracts + 配置 | 发现 Pyth 是假的、后端零链上交互、`.vercelignore` 排除 `contracts/` |
| 3 | 核查 Pyth/Monad/Ostium/Perpl/Metropolis | 推翻 2 条风险假设，发现 8 天后截止的黑客松 |
| 4 | 写 `ADR-001-是否引入Web框架.md` | 决策：不引入 gin/echo |
| 5 | 写 `执行方案-后端与合约.md` | 5 天排期 + 接口冻结方案 |
| 6 | 写 `前沿资讯与竞品分析.md` | 竞品定位 + 赛道情报 |
| 7 | 写 3 个接口 | 契约钉死 |
| 8 | 写 `perpConfig.ts` / `perp.ts` | 常量单一来源 + 强平价数学 |
| 9 | 写 `MockUSDC` + 测试 | 演示不卡水龙头 |
| 10 | 撞上 `.vercelignore` → 改位置 | 常量迁到 `src/` |
| 11 | 撞上 ESM/CJS → 改耦合方式 | 切断反向导入，改用 getter |
| 12 | 验证 + 提交 + 开 PR | `2c42797` → [PR #3](https://github.com/moonhotline/koliance/pull/3) |
