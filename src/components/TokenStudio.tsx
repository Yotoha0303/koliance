"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  Send,
  Pickaxe,
  ExternalLink,
  PlusCircle,
  TrendingDown,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Flame,
  ShieldCheck,
} from "lucide-react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  parseEther,
  http,
  isAddress,
} from "viem";
import {
  monadTestnet,
  KOL_TOKEN_ADDRESS,
  KOL_TOKEN_ABI,
} from "@/lib/contract";

interface TokenStudioProps {
  account: `0x${string}` | null;
  nativeBalance: string;
  onRefreshBalance?: () => void;
}

export function TokenStudio({
  account,
  nativeBalance,
  onRefreshBalance,
}: TokenStudioProps) {
  // Token state
  const [tokenBalance, setTokenBalance] = useState<string>("0.00");
  const [totalSupply, setTotalSupply] = useState<string>("0");
  const [currentEra, setCurrentEra] = useState<number>(0);
  const [rewardRate, setRewardRate] = useState<string>("0");
  const [loadingStats, setLoadingStats] = useState(false);

  // Actions state
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [transferType, setTransferType] = useState<"ICON" | "MON">("ICON");
  const [isTransferring, setIsTransferring] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string; txHash?: string } | null>(null);

  // Fetch token stats
  const fetchTokenData = async () => {
    try {
      setLoadingStats(true);
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http("https://testnet-rpc.monad.xyz"),
      });

      const [supply, era, rate] = await Promise.all([
        publicClient.readContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "totalSupply",
        }),
        publicClient.readContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "currentEra",
        }),
        publicClient.readContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "currentRewardRatePerSecond",
        }),
      ]);

      setTotalSupply(formatEther(supply));
      setCurrentEra(Number(era));
      setRewardRate(formatEther(rate));

      if (account) {
        const bal = await publicClient.readContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "balanceOf",
          args: [account],
        });
        setTokenBalance(formatEther(bal));
      }
    } catch (err) {
      console.error("Failed to fetch token data:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchTokenData();
    const interval = setInterval(fetchTokenData, 10000);
    return () => clearInterval(interval);
  }, [account]);

  // Add Token to MetaMask
  const handleAddToMetaMask = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setFeedback({ type: "error", msg: "未检测到 Web3 钱包 (MetaMask)" });
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: KOL_TOKEN_ADDRESS,
            symbol: "ICON",
            decimals: 18,
            image: "https://koliance.vercel.app/brand-icon-512.png",
          },
        },
      });
      setFeedback({ type: "success", msg: "成功发起代币添加请求！" });
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.message || "添加代币失败" });
    }
  };

  // Claim Block Reward
  const handleClaimReward = async () => {
    if (!account) {
      setFeedback({ type: "error", msg: "请先连接钱包！" });
      return;
    }
    if (typeof window === "undefined" || !window.ethereum) return;

    try {
      setIsClaiming(true);
      setFeedback(null);

      const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport: custom(window.ethereum),
      });

      const hash = await walletClient.writeContract({
        address: KOL_TOKEN_ADDRESS,
        abi: KOL_TOKEN_ABI,
        functionName: "claimBlockReward",
      });

      setFeedback({
        type: "success",
        msg: "成功占领区块并领取 ICON 代币奖励！",
        txHash: hash,
      });
      fetchTokenData();
      onRefreshBalance?.();
    } catch (err: any) {
      console.error("Claim reward failed:", err);
      setFeedback({
        type: "error",
        msg: err?.shortMessage || err?.message || "领取奖励失败",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Transfer ICON or MON
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!account) {
      setFeedback({ type: "error", msg: "请先连接钱包" });
      return;
    }

    const cleanRecipient = recipient.trim();
    if (!isAddress(cleanRecipient)) {
      setFeedback({ type: "error", msg: "请输入合法的 0x 开头 42 位钱包地址" });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: "error", msg: "请输入有效的转账数量" });
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) return;

    try {
      setIsTransferring(true);
      const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport: custom(window.ethereum),
      });

      let hash: `0x${string}`;

      if (transferType === "ICON") {
        if (numAmount > parseFloat(tokenBalance)) {
          setFeedback({ type: "error", msg: `ICON 余额不足 (当前: ${tokenBalance} ICON)` });
          setIsTransferring(false);
          return;
        }

        hash = await walletClient.writeContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "transfer",
          args: [cleanRecipient as `0x${string}`, parseEther(amount.trim())],
        });
      } else {
        if (numAmount > parseFloat(nativeBalance)) {
          setFeedback({ type: "error", msg: `MON 余额不足 (当前: ${nativeBalance} MON)` });
          setIsTransferring(false);
          return;
        }

        hash = await walletClient.sendTransaction({
          to: cleanRecipient as `0x${string}`,
          value: parseEther(amount.trim()),
        });
      }

      setFeedback({
        type: "success",
        msg: `${transferType} 转账成功广播！`,
        txHash: hash,
      });
      setAmount("");
      fetchTokenData();
      onRefreshBalance?.();
    } catch (err: any) {
      console.error("Transfer error:", err);
      setFeedback({
        type: "error",
        msg: err?.shortMessage || err?.message || "转账失败",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121624] via-[#101420] to-[#0a0d16] border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Monad Testnet (Chain ID: 10143)</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>KOL 代币 (ICON)</span>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 font-normal">
                已部署
              </span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl font-sans">
              Koliance 原生代币，名称 <strong className="text-white">kol</strong>，符号 <strong className="text-white">ICON</strong>。
              总硬顶恒定 <strong className="text-white">2^30 (1,073,741,824)</strong> 枚，遵循比特币式每 2 年减半释放模型。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={handleAddToMetaMask}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-mono transition"
            >
              <PlusCircle className="w-4 h-4 text-purple-400" />
              <span>添加 ICON 到 MetaMask</span>
            </button>
            <a
              href={`${monadTestnet.blockExplorers.default.url}/address/${KOL_TOKEN_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono transition shadow-lg shadow-purple-600/30"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Monad Explorer 查看</span>
            </a>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Token Balance */}
        <div className="p-5 rounded-2xl bg-[#141824]/90 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>我的 ICON 余额</span>
            <Coins className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {parseFloat(tokenBalance).toFixed(4)} <span className="text-sm text-purple-300 font-normal">ICON</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            原生 MON: <span className="text-emerald-400 font-semibold">{nativeBalance} MON</span>
          </div>
        </div>

        {/* Total Supply */}
        <div className="p-5 rounded-2xl bg-[#141824]/90 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>当前已产出总量</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {parseFloat(totalSupply).toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            硬顶: 1,073,741,824 (2^30)
          </div>
        </div>

        {/* Current Era / Halving */}
        <div className="p-5 rounded-2xl bg-[#141824]/90 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>减半纪元 (Era)</span>
            <TrendingDown className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            第 {currentEra} 纪元
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            周期: 每 2 年 (730 天) 减半 50%
          </div>
        </div>

        {/* Reward Rate */}
        <div className="p-5 rounded-2xl bg-[#141824]/90 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>当前区块产出速率</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {parseFloat(rewardRate).toFixed(3)} <span className="text-xs text-slate-400">/秒</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-mono">
            单槽最终确定性实时产出
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          {feedback.txHash && (
            <a
              href={`${monadTestnet.blockExplorers.default.url}/tx/${feedback.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline text-white hover:text-purple-200"
            >
              <span>查看交易: {feedback.txHash.slice(0, 8)}...{feedback.txHash.slice(-6)}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </motion.div>
      )}

      {/* Action Columns: Mining / Claiming + Transfer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Occupy Block & Claim Reward */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#141824]/90 border border-white/10 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                <Pickaxe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">占领区块 & 领取矿工奖励</h3>
                <p className="text-xs text-slate-400 font-mono">
                  claimBlockReward() · 链上实时铸造
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs font-sans text-slate-300">
              <p>
                • <strong>占领机制：</strong> Monad 是 10,000 TPS 极速链，任何用户只要向合约发送一笔交易，即可将上一结算点到当前的区块代币奖励打包并转移到自己的钱包。
              </p>
              <p>
                • <strong>防超发保证：</strong> 合约通过数学位移与时间纪元严格锁死最大硬顶为 2^30，无法任何方式增发或篡改。
              </p>
            </div>
          </div>

          <button
            onClick={handleClaimReward}
            disabled={isClaiming || !account}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm transition shadow-lg shadow-amber-500/20 active:scale-98 disabled:opacity-50"
          >
            {isClaiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在占领区块并铸造奖励...</span>
              </>
            ) : !account ? (
              <span>请先连接钱包</span>
            ) : (
              <>
                <Pickaxe className="w-4 h-4" />
                <span>立即占领区块并领取 ICON</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Transfer Portal (ICON or MON) */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#141824]/90 border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-400/20 flex items-center justify-center text-purple-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">链上转账控制台</h3>
                <p className="text-xs text-slate-400 font-mono">
                  支持转账 ICON 与 原生 MON
                </p>
              </div>
            </div>

            {/* Switch Currency Tab */}
            <div className="flex items-center gap-1 p-1 bg-black/50 border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setTransferType("ICON")}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition ${
                  transferType === "ICON"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ICON
              </button>
              <button
                type="button"
                onClick={() => setTransferType("MON")}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition ${
                  transferType === "MON"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                MON
              </button>
            </div>
          </div>

          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">接收方地址 (Recipient Address)</label>
              <input
                type="text"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-purple-400 focus:outline-none text-xs font-mono text-white placeholder-slate-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <label>转账数量 ({transferType})</label>
                <button
                  type="button"
                  onClick={() => {
                    if (transferType === "ICON") {
                      setAmount(tokenBalance);
                    } else {
                      const balNum = parseFloat(nativeBalance || "0");
                      setAmount(Math.max(0, balNum - 0.005).toFixed(4));
                    }
                  }}
                  className="text-[11px] text-purple-300 hover:text-purple-200 underline"
                >
                  全部可用 ({transferType === "ICON" ? parseFloat(tokenBalance).toFixed(4) : nativeBalance})
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-16 rounded-xl bg-black/40 border border-white/15 focus:border-purple-400 focus:outline-none text-xs font-mono text-white placeholder-slate-500"
                  required
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-mono text-purple-300 font-bold pointer-events-none">
                  {transferType}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isTransferring || !account}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-purple-600/25 active:scale-98 disabled:opacity-50"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>交易签名确认中...</span>
                </>
              ) : !account ? (
                <span>请先连接钱包</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>立即发送 {transferType} 转账</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
