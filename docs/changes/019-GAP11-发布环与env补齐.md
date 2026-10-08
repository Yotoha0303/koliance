# 019 — GAP-11：发布环落地（`deploy/`）+ 补齐 `.env.example`

- **日期**：2026-10-08（UTC）
- **环**：05 部署
- **类型**：新增 + 既有缺陷修复
- **关联**：**GAP-11**（本文件关闭）· GAP-12（轮换凭证，**仍阻塞于人工**）· GAP-26（部署阻塞）
- **分支**：`feat/perp-solvency-and-panel`

---

## 缺口

台账写的是「缺工程骨架目录 → 补 `deploy/`」。但**空目录没有价值**。
真正的缺口是：**「发布」是 `想法记录.md #4` 明确划在范围内的六环之一，
却没有一处可执行的步骤**——所有部署知识散在 `推进方案.md` 与记忆里。

---

## 新增：`deploy/README.md` —— 发布 runbook

不是占位目录，是**照着能跑完的步骤**：

| 段 | 内容 |
| --- | --- |
| **0** | **先轮换凭证**（见下，标为 ⛔ 前置） |
| 1 | 合约 → Monad：`PerpStack` + `SessionKeyRegistry` 两条 ignition 命令与验收 |
| 2 | `demo-seed.ts` 灌数（**并标注它带来的 42 分钟资金费时钟**） |
| 3 | 前端环境变量 → Vercel |
| 4 | 后端 → Render |
| 5 | **发布后核验**：`cast call` 读回四个参数 getter + 浏览器实操路径 |
| — | **彩排清单**：标明**前四步已被 `DemoRehearsal.ts` 自动化覆盖**，只剩第 5 步需人工 |
| — | **回滚**：合约不可升级，故回滚 = 前端回退 + 换新地址；**并解释 `PERP_IS_CONFIGURED` 为何是硬门禁** |

---

## ⛔ 顺带确认 GAP-12：`render.yaml` 里的明文密钥

实测 `render.yaml` 含**明文** `STEAM_API_KEY`、`ALPACA_API_KEY` / `ALPACA_API_SECRET`、
`STRIPE_PUBLISHABLE_KEY`；而同文件的 `STRIPE_SECRET_KEY` 与 `DATABASE_URL`
**已经用的是正确写法** `sync: false`——所以**正确形态就在旁边，只是没被统一采用**。

**本次没有单方面修改它**，理由写进了 runbook：

> `autoDeploy: true`。若这些值**尚未**存在于 Render 面板，把 `sync: false` 推上去
> 会在下次部署时**让线上后端拿不到密钥而挂掉**。

代码侧把改动**准备好并写明风险**，落地时机交由人工——这也是 runbook 把它列为**第 0 步**的原因。

**泄露已成事实**：值在 git 历史里，删掉当前行**不会**让它们重新变成秘密。必须去各后台轮换。

---

## 顺带修复：`.env.example` 缺 4 个代码实际读取的变量

写 runbook 时核实环境变量清单，发现**代码读取 11 个，`.env.example` 只声明 7 个**：

| 缺失 | 读取处 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/db.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/db.ts` |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | `src/lib/authConfig.ts` 等 4 处 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `src/lib/authConfig.ts` 等 4 处 |

**后果**：新 clone 的人**没有任何途径得知这些变量是必需的**，除非去读源码。
这与 GAP-16 的幻影路径是同一类问题的**镜像**——那边是文档指向不存在的东西，
这边是存在的东西没人指向。

修完复核：**声明 11 = 使用 11**，既无缺失也无多余。

## 我自己的一个错误（已当场纠正）

我在 runbook 初稿里写了 `NEXT_PUBLIC_SESSION_KEY_REGISTRY` ——**这个变量在代码里不存在**。
核实环境变量时抓到并删除，同时在 runbook 里写明：

> 合约已建、已测，但**前端还没有授权面板**去读它，所以**不需要**这个变量。
> **不要现在预先加上**——一个没有人读的变量只会让人以为它生效了。

这已是本会话**第三次**「我写下的东西与仓库实际不符、由核实抓出」。
纪律「读到才算」在这三次里都起了作用，这正是它值得保留的理由。

---

## 验证

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 环境变量对齐 | 比对 `git grep process.env.NEXT_PUBLIC_*` 与 `.env.example` | **11 = 11**，无缺无余 ✅ |
| runbook 无臆造命令 | 逐条核对模块名与脚本名（`git ls-files`） | 与仓库一致 ✅ |
| 无代码改动 | `git status --porcelain -- '*.sol' '*.ts' '*.go'` | 空 ✅ |

---

## 未竟

- **GAP-12**：凭证轮换（**人工，外部后台**）+ `render.yaml` 统一为 `sync: false`（runbook 第 0 步）。
- **GAP-13 / GAP-25**：后端接链、全局锁基准——**均需先决策 Go 侧重依赖**。
- **部署**：阻塞于 `PRIVATE_KEY` + Monad 测试币（GAP-26）。
- **GAP-37**：面板两条清算口径，未修（产品决策）。
