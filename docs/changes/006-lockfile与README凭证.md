# 006 — 删除陈旧 lockfile（GAP-28）+ README 移除明文凭证（GAP-12 部分）

- **日期**：2026-10-07
- **环**：02 开发
- **类型**：工程卫生 + 安全
- **关联**：GAP-28、GAP-12
- **分支**：`feat/perp-solvency-and-panel`

---

## GAP-28：删除根 `package-lock.json`

**问题**：仓库有**双 lockfile**，且根 `package-lock.json` 已陈旧——它早于
`@supabase/supabase-js` 的引入，不含该依赖。`pnpm-lock.yaml` 才是完整权威。

**实测后果**：在未 `pnpm install` 的情况下 `npx tsc --noEmit` 报 **23 个错误**
（`Cannot find module 'typeorm' / 'vitest' / '@supabase/supabase-js'`）。
即：任何用 `npm ci` 的人都会得到一棵跑不过类型检查的依赖树。

**修复**：`git rm package-lock.json`。

**删除前的依赖核查**（确认无人依赖它）：

| 检查 | 结果 |
| --- | --- |
| 根 `package-lock.json` 是否含 `@supabase/supabase-js` | ❌ 不含（陈旧） |
| CI 的 `npm ci` 目标 | `contracts/`（`working-directory` + `cache-dependency-path: contracts/package-lock.json`）✅ 不受影响 |
| `contracts/package-lock.json` | ✅ 保留，未被本改动触及 |
| 是否有脚本引用根 lockfile | ❌ 无 |

**验证**：`pnpm install --frozen-lockfile` → `Done`；`pnpm --version` = `9.15.0`，
与 CI 的 `pnpm/action-setup@v4 version: 9` 匹配。

**README 更新**：明确写出「根目录必须用 pnpm，`contracts/` 用 npm ci」，
并附本地跑全部检查的命令（与 CI 一致），以及 `docs/` 的导航。

---

## GAP-12（部分）：README 移除明文凭证

**问题**：`README.md` 曾以明文列出 Steam API Key、Alpaca Key ID + Secret、
Stripe Publishable Key。仓库若公开即等同泄露。

**本次动作**（不阻塞、1 分钟）：**从 README 删除明文**，改为环境变量清单表。

**⚠️ 这不能撤销泄露** —— 这些值仍在：
- git 历史（已提交，无法从历史中"删除"）
- `backend/internal/config/config.go:38-44`（作为 `getEnv` 的默认值）
- `render.yaml:17-28`（`envVars` 明文）
- `src/app/api/auth/github/exchange/route.ts:29,33`（OAuth `client_id` + **`client_secret`** fallback）

**因此 GAP-12 仍为 🔴 未修复**：代码层的环境变量化 + **密钥轮换**需要外部后台操作
（Steam / Alpaca / Stripe / GitHub 开发者后台），**无法用代码提交完成**。
README 里已写明这一点，避免下一个人误以为已经处理完。

**建议顺序**：
1. 轮换四组密钥（外部操作）
2. 再改 `config.go` / `render.yaml`（把默认值改为空串，缺失即启动失败）
3. 最后处理 `exchange/route.ts` 的 OAuth secret fallback

顺序不能颠倒——先改代码但没轮换，等于把"已泄露"的密钥换成"缺失"的配置，服务直接挂。

---

## 验证

```powershell
Test-Path package-lock.json        # 期望 False
Test-Path contracts/package-lock.json  # 期望 True（独立工程，保留）
pnpm install --frozen-lockfile     # 期望 Done
npx tsc --noEmit                   # 期望 exit=0
npx vitest run                     # 期望 23 passed
Select-String -Path README.md -Pattern "745B577BC3554647|PK2SMWLLV64SKRMOJI|Eh8yhX5FKFUKhKt3"
                                   # 期望无输出（明文已移除）
```

**实测结果**：全部符合预期。`pnpm-lock.yaml` 与 `contracts/package-lock.json` 保留。
