# Koliance Go Backend Service

Koliance 的高性能 Go 后端服务，负责处理链下索引、元数据缓存、信任图谱分析与高速 REST/GraphQL API。

## 目录结构
```
backend/
├── cmd/
│   └── api/
│       └── main.go       # HTTP API 服务入口 (内置 CORS 与标准路由)
├── internal/
│   ├── model/            # 数据结构 (与 Koliance.sol 严格对齐)
│   ├── indexer/          # 链上事件监听器 (规划集成 go-ethereum)
│   └── service/          # 业务逻辑与图谱计算
├── go.mod
└── README.md
```

## 运行方式
```bash
cd backend
go run cmd/api/main.go
```
服务将在 `http://localhost:8080` 启动，默认包含：
- `GET /api/v1/health` - 服务与 Monad 节点健康状态
- `GET /api/v1/stats` - 链上身份与信任总览统计
- `GET /api/v1/identities/:address` - 身份详情查询

## 与 Next.js 前端连接
前端 `src/lib/api.ts` 已内置适配器，只需在前端 `.env.local` 设置：
```env
NEXT_PUBLIC_GO_BACKEND_URL=http://localhost:8080
```
前端即可自动平滑切换至 Go 极速索引器服务。

## 访问控制与配置（安全加固）

| 类别 | 端点 | 凭证 |
|---|---|---|
| 公开（只读） | `health`、`stats`、`game/steam/profile`、`developer/github/profile`、`market/overview`、`market/prices` | 无 |
| 公开（演示写入，参数严格校验） | `agentcard/generate`、`game/proof`、`developer/github/proof`、`stripe/checkout-session` | 无 |
| 卡主 | `GET agentcard/cards/{id}`、`agentcard/session-key`、`agentcard/authorize`（不带 sessionKey 时） | `Authorization: Bearer <cardToken>`（只在 `generate` 响应中返回一次，服务端仅存 SHA-256） |
| Agent | `agentcard/authorize`（带 sessionKey） | 为**该卡**签发的 `sk_sess_…` |
| 运营方 | `agentcard/batch-settle`、`stripe/customer`；以及 `market/trade`、`market/close`（除非 `DEMO_PUBLIC_TRADING=true`） | `Authorization: Bearer $KOLIANCE_API_TOKEN`；未配置时返回 503（fail closed） |

- 卡片接口不再返回完整卡号与 CVV，只返回 `formattedNumber`（`4928 **** **** 1234`）与 `last4`；`cardId` 为随机值，不再由卡号派生。
- 所有动账金额必须是有限正数且不超过 100000。
- 环境变量：
  - `CORS_ALLOWED_ORIGINS`：逗号分隔的精确 origin 列表，默认 `https://koliance.oodai.space,http://localhost:3000,http://127.0.0.1:3000`，不支持 `*`。
  - `KOLIANCE_API_TOKEN`：运营方令牌。
  - `DEMO_PUBLIC_TRADING`：`true` 时允许浏览器直接下 Alpaca 模拟盘订单（仍有参数上限），默认 `false`。
