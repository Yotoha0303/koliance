# 020 — GAP-35：行尾重规范化 + GAP-28：lockfile 现状核实

- **日期**：2026-10-08（UTC）
- **环**：02 开发
- **类型**：既有缺陷修复（含**两处台账判断的更正**）
- **关联**：**GAP-35**（关闭）· **GAP-28**（关闭）· `docs/changes/007`（行尾导致 CI 首红的原始记录）
- **分支**：`feat/perp-solvency-and-panel`

---

## GAP-28：前提已消失，直接关闭

台账描述的是「**双 lockfile**，`npm ci` 装过期树」。

实测 `git ls-files`：**只有** `contracts/package-lock.json`（npm）与根 `pnpm-lock.yaml`（pnpm）。
陈旧的**根 `package-lock.json` 早已被删**（`50c51d8`）。

**且当前形态是正确的分工**：`contracts/` 是独立 npm 工程用 npm，根用 pnpm——
CI 正是这么跑的（`ci.yml` 的 contracts job 用 `npm ci`、frontend job 用 `pnpm --frozen-lockfile`）。

**结论**：缺口不存在，关闭。

---

## GAP-35：推迟的理由不成立，且代价比台账写的更大

### 台账的假设是错的

> 「重规范化需要 `git add --renormalize .`，会在这个已经很宽的 PR 里
> **混入成千上万行行尾噪声**，使真正的改动无法评审。因此留给独立的小 PR。」

**实测索引状态：235 个文件全是 `i/lf`，`i/crlf` 与 `i/mixed` 均为 0。**
索引**早就是 LF** —— 所以**根本没有东西需要提交**。那个"独立的小 PR"就是**不存在的 PR**。

### 真正的缺陷在工作树，不在索引

`.gitattributes` 是 `f6ec42d` 才加的，**只对后续检出生效**。
于是属性生效**之前**检出的文件在工作树里仍是 CRLF，**尽管属性已声明 `eol=lf`**：

```
修复前：  .sol  16 个 w/crlf / 22      有 eol=lf 属性却仍 CRLF：137 个
```

**`.sol` 是覆盖率唯一测量的类型**，所以这不是"无害的格式问题"。

### 修复：刷新工作树，零提交

逐个 `rm` 后 `git checkout --`（`checkout-index -a -f` **不应用**属性，实测无效；单文件 `rm` + `git checkout` 才生效）。

```
修复后：  235 i/lf w/lf · 16 i/-text w/-text · 0 w/crlf · 0 w/mixed
```

**索引未被触碰**（`git status` 干净）。这是纯工作树操作。

### 实测后果：覆盖率读数下降了约 1.6 个点

| 口径 | 读数 |
| --- | --- |
| 此前报告的（工作树 CRLF） | **90.92%** |
| **现在（工作树 LF）** | **89.29%** |

**本会话我一直在报 CRLF 的虚高读数**——正是台账 §3.3 描述的那个效应，只是幅度是 1.6 点而非 5 点。

**地板 88% 仍然通过**，所以 **CI 不会因此变红**。但这条差异现在有实测数字了，
而不是"约 5 个点"的估计。

### 顺带补齐 `.gitattributes`

首版覆盖 13 条规则，**漏了 11 种文本类型**（`.go` / `.sql` / `.mjs` / `.mod` / `.sum` /
`.txt` / `.svg` / `.example` / `.sample` / `.gitignore` / `.vercelignore`）。
补齐后再刷新一遍，**全库文本文件现为 235/235 LF**。

`.gitattributes` 的 diff 是 **16 行新增、0 行删除**——**没有一行"行尾噪声"**，
这本身就是"推迟理由不成立"的证据。

---

## 验证（全部在 LF 下重跑）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 行尾状态 | `git ls-files --eol` | **235 w/lf**，0 w/crlf，0 w/mixed ✅ |
| 索引未变 | `git status --porcelain` | 仅 `.gitattributes`（`M`）✅ |
| 合约套件 | `npx hardhat test` | **187 passing** ✅ |
| 合约覆盖率 | `npx hardhat test --coverage` + `check-coverage.ts` | **89.29%** ≥ 88% ✅ |
| 前端套件 | `npx vitest run --coverage` | **31 passing**，lines **80.23%** ≥ 72 ✅ |

---

## 未竟

- **GAP-12**：凭证轮换（人工，外部后台）+ `render.yaml` 统一 `sync: false`（见 `deploy/README.md` 第 0 步）。
- **GAP-13 / GAP-25**：**需先决策 Go 侧重依赖**。
- **GAP-24 链下部分**：同上。
- **GAP-16**：三条内容缺失（Bot 接链 / 部署 / ZK 插槽）——**均由上述外部阻塞传导而来**。
- **GAP-26**：部署阻塞于 `PRIVATE_KEY` + Monad 测试币。
- **GAP-37**：面板两条清算口径，未修（产品决策）。
