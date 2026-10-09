# 010 — 修 GAP-36（`.gitignore` 根锚定）+ 修 GAP-16（幻影路径）+ 修 GAP-34 错误指针

- **日期**：2026-10-08（UTC）
- **类型**：既有缺陷修复 + 撤销一个误登记的缺口
- **关联**：**GAP-36**（新发现、新修）· **GAP-16**（已修）· **GAP-34**（指针已修）· **GAP-37**（已撤销）
- **分支**：`feat/perp-solvency-and-panel`

---

## 修复：GAP-36 — `.gitignore` 规则作用于错误的路径层级

`.gitignore` 里写的是 `ignition/deployments/`，**带内部斜杠且无前导 `**/`**，因此是**根锚定**模式，
只匹配仓库根下的 `ignition/`；而 ignition 的输出实际在 `contracts/ignition/deployments/`，
**规则从未命中**，3 个部署产物已被提交：

```
$ git check-ignore -v --no-index contracts/ignition/deployments/chain-10143/deployed_addresses.json
(exit=1，无输出 = 未命中)

$ git ls-files | grep ignition/deployments
contracts/ignition/deployments/chain-10143/build-info/solc-0_8_31-*.json
contracts/ignition/deployments/chain-10143/deployed_addresses.json
contracts/ignition/deployments/chain-10143/journal.jsonl
```

**为什么 `artifacts/` 没同样出事**（同文件、同区域，却是对的）：
`artifacts/` / `cache/` / `typechain/` **没有内部斜杠**，按 gitignore 规则可在**任意层级**匹配，
所以它们对 `contracts/` 下同样生效。**只有 `ignition/deployments/` 这一条因为多了个斜杠而失效**——
一份读起来一视同仁的清单里，藏了一条特例。

**修法**：`ignition/deployments/` → `**/ignition/deployments/`，并
`git rm --cached -r contracts/ignition/deployments`。**取消跟踪不丢信息**：身份合约地址另有 4 处记录
（`README.md:51`、`src/lib/contract.ts:31`、`推进方案.md:18`、`执行方案-自治Agent清结算.md:193`），
`git grep` 实测代码零引用，CI 不部署。

> ⚠️ **`check-ignore` 陷阱**：对**已入库**的文件，`git check-ignore -v <path>` 也返回 exit=1
> （即使规则本应忽略它），因为 git 跳过已跟踪文件。**判定规则是否命中必须加 `--no-index`**，
> 否则会把 GAP-36 误判成"规则没问题"。

---

## 修复：GAP-16 — 幻影路径 `contracts/lib/perpConfig.ts`

**活跃文档中已清零**。修了 4 处（比审计报告 S-6 所列多 1 处）：

| 文件 | 改动 |
| --- | --- |
| `docs/planning/推进方案.md:41` | `contracts/lib/perpConfig.ts` → `src/lib/perpConfig.ts` |
| `docs/planning/推进方案.md:133` | 同上 |
| `docs/planning/执行方案-后端与合约.md:151` | 同上（**S-6 漏列**） |
| `src/lib/perp.ts:4` | 注释 → `./perpConfig`（与同文件 `:33` 的实际 `from "./perpConfig"` 一致） |

### ⚠️ 纠正 S-6 的误判：历史记录不该改

S-6 把 `docs/执行记录-Phase0.md:205-207, 272` 列为"应改为 `src/lib/perpConfig.ts`"。**这是误判，已拒绝执行**：

- `:205` 是**历史叙事**——「写共享常量时，我**最初**放在 `contracts/lib/perpConfig.ts`……前端反向导入」。
  **它描述的正是当初放错、随后发现并迁走的过程**。改成 `src/` 会**抹掉问题本身**，让这条记录失去意义。
- `:223` 是"问题 2"里**回放的错误代码片段**；`:272` 是那次提交的**文件清单**，本就正确。

**修文档必须区分「活跃方案」与「历史留痕」**：前者是待执行指令，后者是既有事实。
把历史改成现状 = 篡改证据链。`缺陷分析-审计报告.md:368` 同属**时点审计结论**，其「不存在」当时为真，**不改**。

---

## 修复：GAP-34 的错误指针

`GAP-34` 引用「`推进方案.md:40`」指代接口冻结，但实测 `:40` 是「部署 `MockUSDC` + `DemoOracle`」，
接口冻结描述在 **`:34-37`**。`git show 8f69995:docs/planning/推进方案.md` 证实：
**引入 GAP-34 的那个提交里 `:40` 就已经是这行**——该指针**自始即错**，不是文档后来漂移所致。
台账 `:197` 与 `:331` 已改为 `:34-37`。

> GAP-34 的**主体**（重新冻结 `closePosition` 接口）仍未做，本次只修指针。

---

## 撤销：GAP-37（编号撞车，并入 GAP-16）

本次建立本地 AI 协同框架时，我把 `contracts/lib/perpConfig.ts` 幻影路径登记为 **GAP-37**。
**逐行核对后撤销**——`缺陷分析-审计报告.md:500` 的 **S-6 早已识别它（触发 GAP-16）**。

**教训**：登记新缺口前必须 `git grep` 全仓检索是否已被覆盖——
**与既有编号撞车比漏登记更糟**。该教训已写入本地框架的纪律 D4（`AGENTS.md`，见下节）。

---

## 人工决定：04 构建环不处理、也不标记

`提示词.md` 对 04 环要求「镜像不可变 Digest + 运行时断言 `REVISION == Git HEAD`」，
本仓**无对应物**（实测无 Dockerfile、无 `REVISION` 断言）。**人工决定**：不处理、不标记，
**不列入门禁矩阵、不标状态、不作阻断依据**。本记录与本地框架的脚注是它唯一的留痕，
使「缺席」读起来是**决定**而非**疏漏**。

---

## 附：AI 协同框架（**本地工具，不入库**）

本次同时建立了一套 AI 协同框架（`AGENTS.md` 约束规范 + `.claude/agents/` 六个子代理 +
`record.md`/`memory.md` 运行态），来源是 `提示词.md` 与 `AI协同工程架构.png`。

**按人工决定：只在本地使用，不提交到远程仓库**（已写入 `.gitignore`）。
理由：它是「AI 怎么干活」的约束与运行态，**不是本项目的交付物**；且 `.claude/agents/` 属
Claude Code 客户端配置，各人环境不同。

> 因此本记录**不把它列为交付物**，也**不引用**其中的文件作为仓库资产。
> 它的存在已在 `.gitignore` 中以注释说明，便于他人理解为何这些路径被忽略。

---

## 验证（逐条实测）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| `.gitignore` 已修复 | `git check-ignore -v --no-index contracts/ignition/deployments/...` | **命中** ✅ |
| 取消跟踪成功 | `git ls-files \| grep -c ignition/deployments` | **0** ✅ |
| 工作区文件保留 | `ls contracts/ignition/deployments/chain-10143/` | 3 项仍在磁盘 ✅ |
| 幻影路径清零 | `git grep "contracts/lib/perpConfig" -- docs/planning/推进方案.md docs/planning/执行方案-后端与合约.md src/` | 空 ✅ |
| 类型检查 | `npx tsc --noEmit` | **exit=0** ✅ |
| 前端单测 | `npx vitest run` | **23 passed**（3 files）✅ |
| 框架未被入库 | `git check-ignore -q AGENTS.md .claude/agents/falsifier.md` | 忽略 ✅ |

## 负向证伪（D3，已实跑非声称）

注入空分母 lcov 到 `contracts/coverage/lcov.info`，验证覆盖率门禁不会退化为「100%」假绿：

```
$ printf 'TN:\nSF:contracts/perp/Vault.sol\nDA:1,1\nLF:0\nLH:0\nend_of_record\n' > contracts/coverage/lcov.info
$ npx tsx contracts/scripts/check-coverage.ts
  TOTAL   lines n/a   branches n/a
  ✗ Coverage below floor: lines n/a < 88%
  exit=1
```

**未静默**，报 `n/a` 而非 100%。现场已还原。
（该守卫是 `docs/changes/009` 记录的历史缺陷面，`check-coverage.ts:146` 已修，本次确认无回归。）

---

## 未竟

- **GAP-34 主体**：`closePosition` 接口的**重新冻结**仍未做（本次只修了它的错误指针）。
- **GAP-33**：前端覆盖率阈值未配 —— 03 测试环唯一未满足项。
  实测 `@vitest/coverage-v8` **未安装**（台账"可用"指可安装，非已装），须先加依赖。

## 已了结

- **GAP-36** ✅ 已修（`.gitignore` `**/ignition/deployments/` + `git rm --cached`）。
- **GAP-16** ✅ 活跃文档已清零。
- **GAP-34 指针** ✅ 已改为 `:34-37`。
- **GAP-37** ⛔ 已撤销（编号撞车，并入 GAP-16）。
- **04 构建环** ⬜ 人工决定不处理、不标记。
