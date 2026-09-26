# 🛡️ Koliance — Monad On-Chain Trust & Identity Infrastructure

Koliance 是构建在 **Monad 高并发并行 EVM Testnet** 上的去中心化数字身份与链上信任凭证基础设施。

本项目提供**全栈极简解决方案**：
- ⚡ **智能合约**：使用官方 Hardhat 模板，预配 Monad Testnet（Chain ID 10143），支持 Solidity 0.8.31 与 Ignition 部署。
- ✨ **动效前端**：Next.js 15 (App Router) + TypeScript + Tailwind CSS，融合 **GSAP 3** 粒子视差与 **Framer Motion** 丝滑平滑过渡。
- 🚀 **Vercel 零配置一键上线**：前端直接位于根目录，推送到 GitHub 并在 Vercel 导入即可直接部署。
- 🐹 **Go 高性能后端就绪**：预留清晰 Clean Architecture 架构（`backend/`），后续无缝接入事件监听与信任图谱索引。

---

## 📁 项目工程架构

```
koliance/
├── contracts/               # 智能合约层 (Hardhat + Monad Testnet)
│   ├── contracts/
│   │   └── Koliance.sol     # 身份与信任凭据智能合约
│   ├── ignition/
│   │   └── modules/Koliance.ts
│   ├── test/Koliance.ts     # 合约单元测试 (viem)
│   ├── hardhat.config.ts    # Monad Testnet 配置 (RPC: https://testnet-rpc.monad.xyz)
│   └── .env                 # 私钥存储 (严格 .gitignore 隔离)
│
├── src/                     # 前端工程 (Next.js 15 App Router + TS)
│   ├── app/                 # 主页、路由与布局
│   ├── components/          # 交互动效组件
│   │   ├── Navbar.tsx       # 玻璃拟物导航、Monad 状态、钱包连接
│   │   ├── HeroGsap.tsx     # GSAP 粒子星座流光与 10,000 TPS 脉冲
│   │   ├── IdentityCard.tsx # Framer Motion 身份登记与查看
│   │   ├── TrustAttestationCard.tsx # 信任凭证背书与 Keccak256 密码学证明
│   │   ├── TrustStream.tsx  # 链上信任凭证检索与流展示
│   │   └── NetworkModal.tsx # Monad Testnet 一键网络自适应切换
│   └── lib/                 # Viem/Wagmi 链上交互与 Go 后端适配
│
├── backend/                 # Go 后端微服务骨架
│   ├── cmd/api/main.go      # Go REST 服务入口 (内置 CORS 与标准路由)
│   ├── internal/model/      # 与 Koliance.sol 严格对齐的 Go 结构体
│   └── README.md
│
├── .vercelignore            # 忽略 contracts/ 和 backend/，极速 Vercel 构建
└── package.json             # 根目录 Next.js 构建脚本
```

---

## 🚀 快速开始

### 1. 部署智能合约到 Monad Testnet

进入 `contracts/` 目录：
```bash
cd contracts

# 确保 .env 中已设置 PRIVATE_KEY (已自动生成)
# PRIVATE_KEY=0x...

# 编译合约
npx hardhat compile

# 运行合约测试
npx hardhat test

# 部署到 Monad Testnet
npx hardhat ignition deploy ignition/modules/Koliance.ts --network monadTestnet
```

部署完成后，命令行将输出合约部署地址，如：`0xYourDeployedContractAddress`。

---

### 2. 启动前端项目

在项目根目录下：
```bash
# 本地开发模式
npm run dev
```

在浏览器打开 `http://localhost:3000` 即可体验！

> **提示**：若已部署合约，可在根目录 `.env.local` 中配置合约地址：
> ```env
> NEXT_PUBLIC_KOLIANCE_ADDRESS=你的合约地址
> ```
> 若未配置，前端将启动优雅的仿真演示模式（Demo Mode），所有动画和操作仍可即时交互。

---

### 3. 一键部署到 Vercel (最简方案)

#### 方式 A：GitHub 自动持续集成（推荐）
1. 将当前项目推送到 GitHub：
   ```bash
   git init
   git add .
   git commit -m "feat: initial koliance fullstack release"
   git remote add origin https://github.com/your-username/koliance.git
   git push -u origin main
   ```
2. 登录 [Vercel 官网](https://vercel.com)，点击 **"Add New..." -> "Project"**。
3. 选择你的 `koliance` 仓库。
4. **无需修改任何配置**（Framework 自动识别为 Next.js，根目录即为部署根），点击 **"Deploy"**！
5. 几十秒内即可在全球 CDN 上线。

#### 方式 B：终端 Vercel CLI 部署
```bash
npm i -g vercel
vercel
```

---

### 4. 运行 Go 后端服务 (可选)

```bash
npm run backend:run
# 或
cd backend && go run cmd/api/main.go
```
服务将在 `http://localhost:8080` 启动，提供链上数据索引接口。

---

## 💎 动效与技术亮点

- **GSAP 3 时间线流光**：Canvas 粒子物理系统 + 磁性排版动效，完美诠释 Monad 10,000 TPS 极速性能。
- **Framer Motion 交互**：选项卡弹性布局切换、全息微质感拟物面板、背书成功彩带粒子。
- **全兼容 Web3**：深度适配 MetaMask / OKX / Rabby 钱包，内置链 ID 10143 自动弹窗切换。
