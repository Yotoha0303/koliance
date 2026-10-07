# 002 — perp 前端接线与交易面板（GAP-26 部分）

- **日期**：2026-10-07
- **环**：02 开发
- **类型**：新增
- **关联**：`docs/planning/缺陷分析-审计报告.md` GAP-26；`docs/adr/ADR-002-金库偿付模型.md`
- **前置**：`0193e3a`（出金上限）、`2c0e353`（demo-seed）

---

## 背景

GAP-26 实测：perp 合约已实现、111 项测试全绿，但**前端零接线**——
`src/` 内对 perp 地址的引用为 0，`src/lib/perp.ts` 除测试外无任何 importer，`deployed_addresses.json` 只有身份合约。
即：链上没有任何 perp 资产，前端也没有入口。评委无从验证。

本批补上前端侧，并把 GAP-26 的剩余部分（链上部署）留给下一步。

---

## 新增

| 文件 | 作用 |
| --- | --- |
| `src/lib/perpAbi.ts` | 手写 ABI（`MockUSDC` / `Vault` / `DemoOracle` / `PositionManager`）+ `OnChainPosition` 类型 |
| `src/components/PositionPanel.tsx` | 交易面板：开仓 / 平仓 / 持仓列表 / 池子状态 |
| `src/app/perp/page.tsx` | `/perp` 路由页，钱包连接与切链逻辑对齐主页面 |

## 修改

| 文件 | 变更 |
| --- | --- |
| `src/lib/perpConfig.ts` | 新增 `MAX_PROFIT_BPS`、`PERP_ADDRESSES`、`PERP_IS_CONFIGURED` |
| `src/lib/perp.ts` | 新增 `netCollateralUsd` / `payoutCapUsd` / `poolCapacityCheck`；re-export 新常量 |
| `src/components/Navbar.tsx` | `NavView` 增 `PERP`；导航项增 PERP（badge `ONCHAIN`） |
| `src/app/page.tsx` | `onSelectView` 对 `PERP`/`MARKET` 走 `router.push`（二者是独立路由，非本页 tab） |
| `tests/perp.test.ts` | 新增 5 项，镜像合约的 `_netCollateralUsd` / `_payoutCapUsd` / `_assertPoolCapacity` |

---

## 设计约束（三条，都是有意的"不做"）

### 1. 没有 mock 回退路径

`PERP_IS_CONFIGURED` 为 false 时，面板**渲染一条错误提示，不显示任何数字**。
理由：`/api/market` 已有反面教材——`Math.random()` 合成行情却返回
`source: "monad_oracle_gatekeeper"` 与 `trend: "Strong Bullish Accumulation"`（GAP-14），
前端 `MarketTerminal.tsx:176` 从不区分数据来源，断网与在线看到同一张图。
perp 面板**绝不能重复这个模式**：假数字会让"链上可验证"的叙事自毁。
这条已写入组件顶部注释。

### 2. ABI 手写，不从 Hardhat artifacts 生成

`.vercelignore` 排除 `contracts/`，Vercel 构建时该目录不存在，
从那里 import 会让部署直接挂——与 `perpConfig.ts` 落在 `src/` 是同一个约束。
代价：新增链上调用时必须同步补 ABI 条目，漏了会在**运行时**报 "function not found" 而非构建期。
已在 `perpAbi.ts` 顶部注明。

### 3. 强平价是镜像，不是读取

链上没有 per-position 的强平价 getter，所以 `liquidationPrice()` 是 `src/lib/perp.ts` 的镜像实现。
它与合约的**运算顺序**必须一致（两次整数除法，顺序不能变），
由 `tests/perp.test.ts` 的 "bit-for-bit liquidation price" 用例守。
组件注释里写明了这是镜像。

---

## 新增的镜像函数（与合约逐项对齐）

| TS 函数 | 合约对应 | 对齐点 |
| --- | --- | --- |
| `netCollateralUsd(gross)` | `PositionManager._netCollateralUsd` | **手续费按 gross 计，size 由 net 推导**（顺序错则差一个手续费） |
| `payoutCapUsd(p)` | `PositionManager._payoutCapUsd` | `net + size * MAX_PROFIT_BPS / BPS` |
| `poolCapacityCheck(p, assets, reserved)` | `PositionManager._assertPoolCapacity` | 比较 `reserved + cap` 与 `assets + collateral`（抵押品已入池） |

**为什么这些必须镜像而不是只读链上**：`poolCapacityCheck` 要在用户点开仓**之前**告诉他会失败。
合约只在 revert 时告知，那是事后。前端必须能事前算出同一个判据，
否则用户会在钱包里签一笔必然 revert 的交易。

---

## 验证

```powershell
npx tsc --noEmit                    # exit=0
npx vitest run                      # 3 files / 14 tests（基线 9 → +5）
npx next lint                       # 无 error（仅既有 <img> 警告）
npx next build                      # ✓ Compiled，路由表出现 ○ /perp  6.63 kB
cd contracts; npx hardhat test      # 120 passing（未受本批影响）
cd backend; go build ./...; go vet ./...   # exit=0
```

**实测结果**：全部通过。`next build` 输出 `├ ○ /perp  6.63 kB  261 kB`。

---

## 未竟

- **链上部署未做**（GAP-26 剩余部分）：需 `PRIVATE_KEY` + Monad 测试币。
  命令已备好：`npx hardhat ignition deploy ignition/modules/PerpStack.ts --network monadTestnet`，
  随后 `npx hardhat run scripts/demo-seed.ts --network monadTestnet`，
  把输出的 4 个地址填入 `.env.local`。**在此之前 `/perp` 页面会显示"未配置"提示**——这是预期行为，不是 bug。
- `DemoControlPanel`（一键砸盘触发清算）尚未做，依赖 Go 清算 Bot（Day 3）。
