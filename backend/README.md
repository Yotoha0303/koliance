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
