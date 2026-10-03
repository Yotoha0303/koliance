# 🛡️ Koliance — Monad On-Chain Trust & Intelligent Finance Infrastructure

Koliance 是构建在 **Monad 高并发并行 EVM Testnet**（Chain ID: `10143`）上的去中心化数字身份、游戏信用凭据与智能金融基础设施。

本项目已实现**模块化全栈解耦架构**：
- 🌐 **Vercel**：托管 Next.js 15 (App Router) 动效交互前端与 Web3 钱包终端；
- 🐹 **Render**：托管 Go 高并发微服务内核（支持每秒万级微支付与异步批量存证）；
- 🗄️ **Supabase**：提供云端 PostgreSQL 连接池与 Realtime 订单/信用状态同步；
- ⚡ **Cloudflare**：提供全球边缘加速、DDoS 安全防御与外部 API 反向代理。

---

## 🔑 核心集成与 API 凭证配置

### ## 您的 Steam Web API 密钥
- **密钥**: `745B577BC3554647B4FA40BE9635E838`
- **域名名称**: `koliance.oodai.space`
- **已集成接口**:
  - `GetPlayerSummaries`：获取玩家昵称与头像
  - `GetOwnedGames`：获取玩家全量游戏库及各游戏总时长
  - `GetPlayerAchievements`：获取游戏成就解锁时间与状态
  - 密码学证明引擎：生成 Keccak256 证明哈希并记录至 `Koliance.sol`

### 📈 Alpaca 美股与衍生品交易凭证 (Paper Trading)
- **API 端点**: `https://paper-api.alpaca.markets/v2`
- **Key ID**: `PK2SMWLLV64SKRMOJJCQUHUANB`
- **Secret**: `Eh8yhX5FKFUKhKt3L5dQY7e6MGsJs7XZaCrw6PtcMtgU`
- **账户能力**: 自带 \$100,000 体验金，支持美股做多 (Long)、做空 (Short)、1x~4x 日内杠杆与实时行情。

### 💳 Stripe 支付与发票集成
- **可发布密钥**: `pk_test_51UMQCbEP5h4ijOX4RfqfeOsj5flpshzH2814PRH1FIvK8kPn79Goucx9sAfzvnkVIzdU30f60ozxkD0FC9vejNM300uNY0C82o`
- **Secret 密钥**: 配置于环境变量 `STRIPE_SECRET_KEY`（沙盒测试模式 `sk_test_...`）
- **集成服务**: Checkout Sessions, Payments, Billing, Invoicing, Connect 账户。

---

## 🏛️ 系统架构与模块解耦

```
koliance/
├── contracts/                     # 智能合约层 (Hardhat + Monad Testnet)
│   ├── contracts/
│   │   └── Koliance.sol           # 身份与信任凭证链上账本 (0x32fDd6B096EE14246b5b6971135286Bad01F4928)
│   └── hardhat.config.ts          # Monad RPC: https://testnet-rpc.monad.xyz
│
├── backend/                       # Go 高并发微服务内核 (Modular Monolith)
│   ├── cmd/api/main.go            # API 网关与路由注册
│   ├── internal/
│   │   ├── config/                # 环境变量配置加载器
│   │   ├── platform/
│   │   │   ├── database/          # Supabase Postgres (pgxpool) 连接池与故障自愈
│   │   │   └── stripeclient/      # Stripe v78 官方 SDK 适配
│   │   ├── game/                  # 【游戏模块】Steam API 抓取与链上证明生成
│   │   ├── agentcard/             # 【AgentCard 模块】Visa BIN/Luhn 生成、Session Key 权限矩阵、高频微支付
│   │   └── market/                # 【股票市场模块】Alpaca 杠杆交易撮合与实时喂价
│   ├── .env                       # 后端私密凭证 (本地运行)
│   └── go.mod
│
├── src/                           # 前端工程 (Next.js 15 App Router + Tailwind + GSAP)
│   ├── app/                       # 页面路由: / (首页), /agentcard (卡片终端), /market (股票终端)
│   ├── components/                # 交互动效组件 (AgentCardTerminal, MarketTerminal, EnergyCoreHero)
│   └── lib/api.ts                 # 前端与 Go 后端无缝通信适配层
└── README.md
```

---

## ⚡ 三大核心业务实现

### 1. AgentCard：Visa 体系 + 高频微支付 + 细粒度权限控制
- **标准卡要素生成**：符合国际 **ISO/IEC 7812** 规范，生成以 `492810` 为 BIN 码的 16 位卡号，通过 **Luhn (MOD 10)** 密码学校验，配备真实 CVV 与有效期。
- **Session Key 权限矩阵**：
  - `MaxPerTxUSD`：单笔最高限额（超限触发 Visa 57 错误码拒付）；
  - `DailyLimitUSD`：每日消费累计上限；
  - `AllowedMCCs`：限定商户分类码（例如 7999 - 游戏，5814 - 餐饮，5734 - 软件服务）；
  - `ExpiresAt`：会话生命周期与熔断保护。
- **零延迟链下微支付**：内存账户秒级扣款，支持万级 TPS；累计交易通过 `POST /api/v1/agentcard/batch-settle` 批量哈希归集上链至 Monad。

### 2. Game 模块：Steam 游戏时长与成就链上存证
- 通过 Steam Web API 一键输入 SteamID，秒级抓取玩家全部游戏库、游玩总时长与特定游戏成就；
- 生成标准化凭证摘要，经 Keccak256 签名打包成 `ProofHash` 写入 `Koliance.sol`，直接兑换 AgentCard 信用额度。

### 3. Market 股票市场：多空杠杆与实时行情
- 对接 **Alpaca Paper API**，支持真实美股标的（NVDA, AAPL, TSLA, SPY 等）；
- 支持 **做多 (Long / Buy)** 与 **做空 (Short / Sell)**，支持 1x~4x 杠杆保证金交易；
- 聚合低延迟毫秒级美股最新成交价与买卖盘报价。

---

## 🚀 快速启动指南

### 启动 Go 后端微服务
```bash
cd backend
go run cmd/api/main.go
```
服务将在 `http://localhost:8080` 启动，输出各服务自检状态：
```
🚀 Koliance Go Backend Service listening on http://localhost:8080
   ├─ Steam Web API: Active (koliance.oodai.space)
   ├─ Alpaca Paper API: Active (https://paper-api.alpaca.markets/v2)
   ├─ Realtime Price Oracle: Active
   └─ Stripe Integration: Ready (Key loaded: true)
```

### 启动 Next.js 前端
```bash
npm run dev
```
打开浏览器访问 `http://localhost:3000` 即可体验全套完整交互。

---

## 📡 后端 API 接口速查表

| 方法 | 路由 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | 服务健康检查与 Monad 合约网络状态 |
| `GET` | `/api/v1/game/steam/profile?id={id}` | 获取 Steam 玩家基本资料与游戏时长排行 |
| `POST` | `/api/v1/game/proof` | 生成游戏成就/时长的链上 Keccak256 证明 |
| `POST` | `/api/v1/agentcard/generate` | 生成一张合法 Luhn 校验的 16 位 Visa 虚拟卡 |
| `POST` | `/api/v1/agentcard/session-key` | 为 AI Agent 颁发带限额与 MCC 限制的 Session Key |
| `POST` | `/api/v1/agentcard/authorize` | 执行高频小额扣款鉴权（模拟 Visa 授权流程） |
| `POST` | `/api/v1/agentcard/batch-settle` | 将已结算的交易打包为 Monad 存证批次 |
| `GET` | `/api/v1/market/overview` | 获取 Alpaca 交易账户（资金、杠杆、持仓）与行情 |
| `GET` | `/api/v1/market/prices?symbol=NVDA` | 获取指定美股的最新实时价格 |
| `POST` | `/api/v1/market/trade` | 下达美股做多/做空杠杆交易订单 |
| `POST` | `/api/v1/stripe/checkout-session` | 创建 Stripe 收银台充值会话链接 |
| `POST` | `/api/v1/stripe/customer` | 注册或绑定 Stripe 客户资料 |

---

## 🌐 线上部署运维指引

- **Vercel**：代码推送到 GitHub `main` 分支后自动触发持续集成部署；
- **Render**：创建 Web Service，Root Directory 设置为 `backend`，Build Command 为 `go build -o api cmd/api/main.go`，Start Command 为 `./api`；
- **Supabase**：在后台复制 PostgreSQL URI 填入 Render 的 `DATABASE_URL` 环境变量即可直连；
- **Cloudflare**：DNS 接入并开启 SSL/TLS 全加密与 Proxy 代理保护。
