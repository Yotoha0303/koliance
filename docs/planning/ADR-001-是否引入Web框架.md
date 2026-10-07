# ADR-001：Go 后端是否引入 Web 框架（gin / echo）

- **状态**：已决定 —— **不引入框架**，改用标准库路由 + 分层重构
- **日期**：2026-10-05
- **触发**：`开发记录.md` 第 1 条「后端采用 http 开发后端，是否考虑接入 gin 或者 echo，还是不动？」
- **影响范围**：`backend/`（不含 `contracts/`、`src/`）

---

## 1. 决策

**不引入 gin / echo。** 用 Go 1.22+ 的 `net/http` 原生路由模式（`"POST /path"` 语法）替代现状，并把路由层从 `cmd/api/main.go` 抽到 `internal/httpapi/`。

预期投入约半天，生产依赖保持 3 个不变（pgx / godotenv / stripe-go）。

---

## 2. 现状盘点（实测）

技术栈：stdlib `net/http` + `http.ServeMux`，`go.mod` 声明 `go 1.25.0`。

| 指标 | 实测值 | 位置 |
| --- | --- | --- |
| 路由数 | 17 | `backend/cmd/api/main.go` |
| 手写 `enableCORS(...)` 包裹 | 17 处 | 同上 |
| 手写 `if r.Method != http.MethodPost` | 9 处 | 同上 |
| 路径参数处理 | 仅 1 处，用 `strings.TrimPrefix` 手动切 | `main.go:215` |
| `main.go` 总行数 | 431 行（装配 + 路由 + handler + 内联请求结构体混在一起） | — |
| 直接依赖 | `pgx/v5`、`godotenv`、`stripe-go/v78` | `backend/go.mod` |

问题**不是"缺框架"**，而是**路由层没有从 `main.go` 里分出来**。这两件事容易被混为一谈。

---

## 3. 评估：框架提供的价值 vs 标准库已覆盖的部分

| 诉求 | gin/echo 提供 | Go 1.22+ ServeMux 现状 |
| --- | --- | --- |
| 免写方法校验 | ✅ | ✅ `mux.HandleFunc("POST /x", h)`，不匹配自动 405 |
| 路径参数 | ✅ | ✅ `"GET /cards/{id}"` + `r.PathValue("id")` |
| 中间件链 | ✅ `r.Use()` | ❌ 需自写 ~15 行包装函数 |
| 请求绑定 + 校验 | ✅ `ShouldBindJSON` + validator tag | ❌ 需自写 ~30 行 helper |
| 路由分组 | ✅ `r.Group(...)` | ❌ 靠命名约定或自包一层 |
| WebSocket / SSE | ❌ 都不自带 | 同样需引 `gorilla/websocket` 或 `coder/websocket` |

**关键判断**：表中前两行——即当前 90% 样板代码的来源——`go 1.25.0` **已原生支持，只是没启用**。框架真正独有的增量只有中间件链、绑定校验、路由分组三项，对应约 45 行自写 helper。

---

## 4. 不引入的理由

1. **真正的风险点不在 HTTP 层。**
   `docs/推进方案.md` 标注的高危项是：本地 nonce 管理器（第 118 行，高并发下必然冲突）、批量清算的同价格快照分桶（第 117 行）、Pyth 美股喂价盘中空窗（第 25 行）。框架对这些零帮助，时间应投在这里。

2. **迁移成本是纯支出。**
   17 个 handler 重写，加上前端 `src/lib/api.ts` 12 个调用函数的回归验证。在黑客松排期内换不来任何演示价值。

3. **依赖树代价。**
   gin 会拖入 `bytedance/sonic`、`go-playground/validator`、`ugorji/go` 等一串依赖；Render free 单实例（`render.yaml:8`）的构建与冷启动都会变差。
   **若未来确实要引，选 echo 而非 gin** —— 依赖树显著更轻，且自带 CORS / Recover 中间件。

4. **下一阶段要加的能力，框架同样不提供。**
   `开发记录.md` 第 1 条与 `docs/项目目标.md` 第 32 行要求「WebSocket 实时行情推送」，`推进方案` 2.3 要求 `/api/v1/liquidations` 供前端大屏滚动。长连接路由 gin/echo 均无内置支持，换框架不产生收益。

---

## 5. 执行方案（约半天，纯标准库）

1. **启用 Go 1.22 路由模式**
   将 `mux.HandleFunc("/api/v1/game/proof", enableCORS(...))` 改为 `mux.HandleFunc("POST /api/v1/game/proof", h)`，删除全部 9 处方法校验，以及 `main.go:215` 的 `TrimPrefix`（改为 `r.PathValue("id")`）。

2. **抽出中间件链 helper**，消除 17 处 `enableCORS` 包裹：
   ```go
   func chain(h http.HandlerFunc, mws ...func(http.HandlerFunc) http.HandlerFunc) http.HandlerFunc
   ```

3. **路由迁移到 `internal/httpapi/`**
   `main.go` 只保留装配流程：config → service → router → `ListenAndServe`。
   同时把 `jsonResponse`、body 解码收敛为 `decodeJSON[T]` 泛型 helper。

   **这一步是为阶段 2 铺路**：`cmd/liquidator` 与 `cmd/api` 需要共享同一份头寸/清算数据，路由留在 `main.go` 里无法复用。

---

## 6. 重新评估的触发条件

出现以下任一情况时，本决策应重新审视：

- 端点数量增长到 50+
- 需要按 group 做差异化鉴权（如 `/api/v1/admin/*` 与 `/api/v1/public/*` 两套 scope）
- 团队已有 gin 手感，迁移边际成本趋近于零
- 需要 OpenAPI 自动生成 —— 此时应评估 `huma` / `ogen`，而非 gin

**当前三条主要条件均不成立。**

---

## 7. 关联的待办发现（与本决策无关，但同期记录）

1. **凭证硬编码**
   - `src/app/api/auth/github/exchange/route.ts:33`：GitHub OAuth **client secret 作为 fallback 硬编码**
   - `backend/internal/config/config.go:38-44`：Steam API Key、Alpaca API Key/Secret 硬编码为默认值
   - `render.yaml:17-23`：同类凭证明文入库
   若仓库公开，等同于已泄露，需转为环境变量并轮换。
   > 另注：`README.md:16-33` 直接列出了 Steam 与 Alpaca 的完整凭证。

2. **CORS 配置**
   当前为 `Access-Control-Allow-Origin: *`。在无凭证场景下无问题，但重构中间件时**不要顺手加上 `Allow-Credentials: true`** —— 该组合会被浏览器直接拒绝。
