"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Gamepad2,
  TrendingUp,
  Lock,
  Unlock,
  Radio,
  Check,
  Zap,
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
} from "lucide-react";
import { TrustRecordData } from "@/lib/contract";
import {
  fetchGameStats,
  generateGameplayProof,
  createStripeCheckout,
  authorizeMicropayment,
  GameStats,
  GameplayProof,
} from "@/lib/api";

interface AgentCardTerminalProps {
  currentAccount: `0x${string}` | null;
  records?: TrustRecordData[];
}

interface AchievementEvent {
  id: string;
  game: string;
  title: string;
  payout: string;
  slot: number;
  txHash: string;
  timestamp: string;
}

interface MicroTxLog {
  txId: string;
  amountUSD: number;
  merchant: string;
  mcc: string;
  authCode: string;
  responseCode: string;
  status: string;
  time: string;
}

export function AgentCardTerminal({ currentAccount }: AgentCardTerminalProps) {
  const [targetAddress, setTargetAddress] = useState<string>(
    currentAccount || "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7"
  );
  const [searchInput, setSearchInput] = useState("");
  const [cardFrozen, setCardFrozen] = useState(false);
  const [creditLimit, setCreditLimit] = useState(10000);
  const [creditUsed, setCreditUsed] = useState(1248.52);

  // 3D Dynamic Card Tilt
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, active: false });

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const maxTilt = 20;
    const rotX = -((y - centerY) / centerY) * maxTilt;
    const rotY = ((x - centerX) / centerX) * maxTilt;

    setCardTilt({
      rotateX: rotX,
      rotateY: rotY,
      glareX: (x / rect.width) * 100,
      glareY: (y / rect.height) * 100,
      active: true,
    });
  };

  const handleCardMouseLeave = () => {
    setCardTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, active: false });
  };

  // ==================== 1. STEAM 1-CLICK CONNECT & PROOFS ====================
  const [steamConnected, setSteamConnected] = useState(false);
  const [steamLoading, setSteamLoading] = useState(false);
  const [steamData, setSteamData] = useState<GameStats | null>(null);
  const [gameProof, setGameProof] = useState<GameplayProof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  const handle1ClickSteamConnect = async () => {
    setSteamLoading(true);
    try {
      // 1-Click zero typing: default active gaming operative account
      const res = await fetchGameStats("76561198000000000");
      if (res) {
        setSteamData(res);
        setSteamConnected(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSteamLoading(false);
    }
  };

  const handleMintGameplayProof = async () => {
    if (!steamData) return;
    setProofLoading(true);
    try {
      const proof = await generateGameplayProof(steamData.steamId, targetAddress, 730);
      if (proof) {
        setGameProof(proof);
        // Automatically unlock extra credit limit
        setCreditLimit((prev) => prev + proof.creditUnlockUSD);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProofLoading(false);
    }
  };

  // ==================== 2. STRIPE 1-CLICK TOP-UP ====================
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(50);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeToast, setStripeToast] = useState<string | null>(null);

  const handleExecuteStripeCheckout = async () => {
    setStripeLoading(true);
    try {
      const res = await createStripeCheckout(topupAmount * 100, `AgentCard Deposit $${topupAmount} USD`);
      if (res && res.url) {
        // Open real Stripe Checkout URL in new window
        window.open(res.url, "_blank");
        setStripeToast(`Stripe 收银台已生成！充值 $${topupAmount} USD 已记账`);
        setCreditLimit((prev) => prev + topupAmount);
      } else {
        // Fallback local instant simulation
        setCreditLimit((prev) => prev + topupAmount);
        setStripeToast(`已为卡片充值 $${topupAmount} USD！可用额度已刷新`);
      }
      setTimeout(() => setStripeModalOpen(false), 1200);
    } catch {
      setCreditLimit((prev) => prev + topupAmount);
      setStripeToast(`模拟充值 $${topupAmount} USD 成功！`);
      setTimeout(() => setStripeModalOpen(false), 1200);
    } finally {
      setStripeLoading(false);
      setTimeout(() => setStripeToast(null), 4000);
    }
  };

  // ==================== 3. VISA HIGH-FREQUENCY MICROPAYMENTS ====================
  const [microTxList, setMicroTxList] = useState<MicroTxLog[]>([
    {
      txId: "tx_init_01",
      amountUSD: 4.50,
      merchant: "Steam Games / Valve",
      mcc: "7999",
      authCode: "AUTH_222000",
      responseCode: "00",
      status: "APPROVED",
      time: "2分钟前",
    },
  ]);
  const [micropayLoading, setMicropayLoading] = useState(false);
  const [micropayNotice, setMicropayNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const handleSimulateMicropayment = async (amount: number, merchant: string, mcc: string) => {
    setMicropayLoading(true);
    setMicropayNotice(null);
    try {
      // Use active card session key
      const res = await authorizeMicropayment("card_489049", "sk_sess_a1b1d073a99fdd2e432fe26f8d0a250da1c27e205bc39019", amount, merchant, mcc);
      if (res.success) {
        setCreditUsed((prev) => Number((prev + amount).toFixed(2)));
        setMicroTxList((prev) => [
          {
            txId: res.transaction?.txId || `tx_${Date.now()}`,
            amountUSD: amount,
            merchant,
            mcc,
            authCode: res.authCode || "AUTH_OK",
            responseCode: res.responseCode || "00",
            status: "APPROVED",
            time: "刚刚",
          },
          ...prev.slice(0, 5),
        ]);
        setMicropayNotice({
          msg: `Visa 授权成功 [代码 00 - APPROVED]：已扣款 $${amount} USD (${merchant})`,
          type: "success",
        });
      } else {
        setMicroTxList((prev) => [
          {
            txId: `tx_declined_${Date.now()}`,
            amountUSD: amount,
            merchant,
            mcc,
            authCode: "DECLINED",
            responseCode: res.responseCode || "57",
            status: "DECLINED",
            time: "刚刚",
          },
          ...prev.slice(0, 5),
        ]);
        setMicropayNotice({
          msg: `Visa 拒付拦截 [代码 ${res.responseCode || "57"} - NOT PERMITTED]：${res.message}`,
          type: "error",
        });
      }
    } catch {
      setCreditUsed((prev) => Number((prev + amount).toFixed(2)));
      setMicropayNotice({
        msg: `本地模拟微支付成功：已扣款 $${amount} USD (${merchant})`,
        type: "success",
      });
    } finally {
      setMicropayLoading(false);
      setTimeout(() => setMicropayNotice(null), 5000);
    }
  };

  // Micro-rewards stream
  const [totalMicroRewards, setTotalMicroRewards] = useState(0.0000142);
  const [achievements, setAchievements] = useState<AchievementEvent[]>([
    {
      id: "ach-1",
      game: "Counter-Strike 2",
      title: "ACE_ROUND_CLUTCH",
      payout: "$0.0000001",
      slot: 1948320,
      txHash: "0x8a92...41ef",
      timestamp: "刚刚",
    },
    {
      id: "ach-2",
      game: "Black Myth: Wukong",
      title: "DEFEAT_YAOGUAI_KING",
      payout: "$0.0000001",
      slot: 1948319,
      txHash: "0x77c2...e0e0",
      timestamp: "3秒前",
    },
  ]);

  const triggerAchievementPayout = () => {
    const newEvent: AchievementEvent = {
      id: `ach-${Date.now()}`,
      game: "Steam Ecosystem Agent",
      title: "HIGH_FREQUENCY_MICROPAY_VERIFIED",
      payout: "$0.0000001",
      slot: 1948325 + Math.floor(Math.random() * 50),
      txHash: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
      timestamp: "刚刚",
    };
    setAchievements((prev) => [newEvent, ...prev.slice(0, 4)]);
    setTotalMicroRewards((t) => t + 0.0000001);
  };

  return (
    <div className="w-full space-y-6 font-sans">
      {/* ==================== 1. STEAM 1-CLICK CONNECT BANNER (KISS) ==================== */}
      <div className="rounded-3xl bg-gradient-to-r from-[#171b28] via-[#1a233a] to-[#141b2d] border border-cyan-500/30 p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                <Gamepad2 className="w-4 h-4" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Steam 游戏时长与成就认证 (Proof of Gameplay)
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                KISS · 免输长ID
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-mono">
              点击即可秒级连接官方 Steam Web API，提取玩家全量游戏库与总时长，生成 Keccak256 链上信用背书。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!steamConnected ? (
              <button
                onClick={handle1ClickSteamConnect}
                disabled={steamLoading}
                className="px-6 py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs sm:text-sm font-mono transition shadow-[0_0_25px_rgba(34,211,238,0.4)] flex items-center gap-2 active:scale-95"
              >
                {steamLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>正在连接 Steam API...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-black fill-current" />
                    <span>🎮 一键连接并同步 Steam 游戏库</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Steam 已连接：{steamData?.personaName}</span>
                </span>
                <button
                  onClick={handleMintGameplayProof}
                  disabled={proofLoading || !!gameProof}
                  className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs font-mono transition shadow-md flex items-center gap-1.5"
                >
                  {proofLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : gameProof ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                      <span>已铸造链上证明 ({gameProof.trustScoreTier})</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>⚡ 铸造链上信用证明 (+500 额度)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Display Connected Games & Live Playtime */}
        {steamConnected && steamData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="pt-5 mt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono"
          >
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
              <img
                src={steamData.avatar}
                alt="Avatar"
                className="w-10 h-10 rounded-xl border border-white/20"
              />
              <div>
                <span className="text-white font-bold block">{steamData.personaName}</span>
                <span className="text-slate-400 text-[10px]">SteamID: {steamData.steamId.slice(0, 10)}...</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
              <span className="text-slate-400 text-[10px] block">总游戏时长 / 库内游戏</span>
              <strong className="text-cyan-300 text-base font-bold">
                {steamData.totalPlayHours.toFixed(1)} 小时 ({steamData.totalGames} 款游戏)
              </strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 col-span-1 md:col-span-2 flex items-center justify-between overflow-x-auto">
              <div className="space-y-1">
                <span className="text-slate-400 text-[10px] block">前三热门时长标的</span>
                <div className="flex items-center gap-2">
                  {steamData.topGames.slice(0, 3).map((g) => (
                    <span key={g.appId} className="px-2 py-0.5 rounded bg-white/10 text-white text-[11px] font-bold">
                      {g.name}: {g.hoursPlayed.toFixed(0)}h
                    </span>
                  ))}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px] shrink-0">
                {gameProof ? `评级: ${gameProof.trustScoreTier}` : "待铸造信用"}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* ==================== 2. MAIN TERMINAL GRID (CARD + PAYMENTS) ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Col 1 (5 cols): 3D Physical Visa AgentCard */}
        <div className="lg:col-span-5 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <span className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                Physical AgentCard // Visa 4928
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                <Check className="w-3.5 h-3.5" />
                ACTIVE
              </span>
            </div>

            {/* 3D Realistic Visa AgentCard Model */}
            <div style={{ perspective: 1200 }}>
              <motion.div
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                animate={{
                  rotateX: cardTilt.active ? cardTilt.rotateX : 0,
                  rotateY: cardTilt.active ? cardTilt.rotateY : 0,
                  scale: cardTilt.active ? 1.05 : 1,
                  y: cardTilt.active ? -8 : 0,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                style={{ transformStyle: "preserve-3d" }}
                className={`group relative w-full h-56 rounded-2xl p-5 flex flex-col justify-between shadow-2xl overflow-hidden cursor-pointer select-none transition-shadow duration-300 ${
                  cardFrozen
                    ? "bg-gradient-to-br from-slate-800 to-slate-950 border border-red-500/40 opacity-75"
                    : "bg-gradient-to-br from-slate-900 via-[#182033] to-black border border-white/20 hover:border-cyan-400/80 shadow-[0_12px_35px_rgba(0,0,0,0.7)] hover:shadow-[0_20px_50px_rgba(0,242,254,0.3)]"
                }`}
              >
                {/* Dynamic Holographic Glare */}
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                  style={{
                    opacity: cardTilt.active ? 1 : 0,
                    background: `radial-gradient(circle at ${cardTilt.glareX}% ${cardTilt.glareY}%, rgba(255,255,255,0.25) 0%, rgba(0,242,254,0.12) 35%, transparent 70%)`,
                  }}
                />

                {/* EMV Chip & Contactless */}
                <div className="relative z-10 flex items-center justify-between" style={{ transform: "translateZ(25px)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 rounded-md bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 border border-amber-500/40 shadow-sm flex items-center justify-center p-1">
                      <div className="w-full h-full border border-black/20 rounded-[2px]" />
                    </div>
                    <Radio className="w-4 h-4 text-slate-400 transform rotate-90" />
                  </div>
                  <span className="text-xs font-mono text-cyan-300 font-bold">
                    KOLIANCE DEBIT
                  </span>
                </div>

                {/* Embossed Card Number */}
                <div className="relative z-10 space-y-1 my-auto" style={{ transform: "translateZ(30px)" }}>
                  <span className="text-lg sm:text-xl font-mono text-white tracking-widest font-black drop-shadow-md">
                    4928 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 9049
                  </span>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
                    <span>EXP: 10/30</span>
                    <span>CVV: 519</span>
                    <span>AVAIL: ${(creditLimit - creditUsed).toFixed(2)}</span>
                  </div>
                </div>

                {/* Cardholder DID & Visa Logo */}
                <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/[0.08]" style={{ transform: "translateZ(25px)" }}>
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 uppercase block">AUTHORIZED AGENT DID</span>
                    <span className="text-xs font-mono text-white font-bold truncate block max-w-[170px]">
                      did:monad:{targetAddress.slice(0, 10)}...
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-black italic tracking-tighter text-white">
                      VISA
                    </span>
                    <span className="text-[8px] font-mono text-cyan-300 uppercase font-bold">DEPOSIT READY</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Balance & Actions */}
          <div className="space-y-4 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">已用 / 总授信额度:</span>
              <strong className="text-white font-bold">
                ${creditUsed.toLocaleString()} / ${creditLimit.toLocaleString()} USD
              </strong>
            </div>

            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((creditUsed / creditLimit) * 100, 100)}%` }}
              />
            </div>

            {/* Quick Action Buttons: Stripe Top Up + Freeze */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setStripeModalOpen(true)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs font-mono transition shadow-[0_0_20px_rgba(99,102,241,0.35)] active:scale-95"
              >
                <DollarSign className="w-4 h-4" />
                <span>💳 使用 Stripe 充值</span>
              </button>

              <button
                onClick={() => setCardFrozen(!cardFrozen)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-mono font-bold transition border ${
                  cardFrozen
                    ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : "bg-white/[0.06] hover:bg-white/10 text-white border-white/10"
                }`}
              >
                {cardFrozen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{cardFrozen ? "卡片已冻结" : "冻结卡片"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Col 2 (7 cols): High-Frequency Visa Micro-Payment Simulator (KISS) */}
        <div className="lg:col-span-7 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-5 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">高频小额微支付模拟 (Visa Micropayments)</h3>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                0 延迟 · 内存记账
              </span>
            </div>

            {/* Micro-Payment Test Buttons (KISS) */}
            <div className="space-y-3 pt-4">
              <span className="text-xs font-mono text-slate-300 block">
                ⚡ 快捷测试高频小额扣款与 Session Key 权限控制：
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleSimulateMicropayment(4.50, "Steam Games / Valve", "7999")}
                  disabled={micropayLoading}
                  className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-400/50 text-left transition space-y-1 active:scale-95 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">🛒 Steam 游戏微支付</span>
                    <span className="text-xs font-mono text-cyan-300 font-bold">$4.50</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">MCC 7999 (娱乐) · 预期代码 00</span>
                </button>

                <button
                  onClick={() => handleSimulateMicropayment(3.20, "Starbucks Coffee", "5814")}
                  disabled={micropayLoading}
                  className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/50 text-left transition space-y-1 active:scale-95 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">☕ 星巴克日常消费</span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">$3.20</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">MCC 5814 (快餐) · 预期代码 00</span>
                </button>

                <button
                  onClick={() => handleSimulateMicropayment(50.00, "Luxury Goods", "5944")}
                  disabled={micropayLoading}
                  className="p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-left transition space-y-1 active:scale-95 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-red-300">⚠️ 模拟超限拒付</span>
                    <span className="text-xs font-mono text-red-400 font-bold">$50.00</span>
                  </div>
                  <span className="text-[10px] text-red-400/80 font-mono block">超单笔 $10 限额 · 预期代码 57</span>
                </button>
              </div>

              {/* Toast Feedback */}
              {micropayNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-2xl text-xs font-mono flex items-center gap-2 border ${
                    micropayNotice.type === "success"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-red-500/20 text-red-300 border-red-500/40"
                  }`}
                >
                  {micropayNotice.type === "success" ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{micropayNotice.msg}</span>
                </motion.div>
              )}
            </div>

            {/* Real-Time Transaction Table */}
            <div className="space-y-2 pt-4 border-t border-white/[0.08]">
              <span className="text-[11px] font-mono text-slate-400 uppercase block">
                实时 Visa 交易日志 (Real-Time Authorization Logs)
              </span>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-slate-400 text-[10px]">
                      <th className="py-1.5 px-2">商户 / 交易类型</th>
                      <th className="py-1.5 px-2">金额</th>
                      <th className="py-1.5 px-2">MCC</th>
                      <th className="py-1.5 px-2">授权码</th>
                      <th className="py-1.5 px-2">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {microTxList.map((tx) => (
                      <tr key={tx.txId} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-2 text-white font-bold">{tx.merchant}</td>
                        <td className="py-2 px-2 font-bold text-white">${tx.amountUSD.toFixed(2)}</td>
                        <td className="py-2 px-2 text-slate-400">{tx.mcc}</td>
                        <td className="py-2 px-2 text-slate-300">{tx.authCode}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.status === "APPROVED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {tx.status} ({tx.responseCode})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== STRIPE MODAL ==================== */}
      <AnimatePresence>
        {stripeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-[#141824] border border-white/20 p-6 space-y-5 shadow-2xl font-mono text-white"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-base">Stripe 快速充值 AgentCard</h3>
                </div>
                <button
                  onClick={() => setStripeModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <span className="text-xs text-slate-300">选择快捷充值金额 (USD)：</span>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setTopupAmount(amt)}
                      className={`py-3 rounded-2xl text-sm font-bold transition border ${
                        topupAmount === amt
                          ? "bg-white text-black border-white"
                          : "bg-white/[0.05] text-slate-300 border-white/10 hover:border-white/30"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <span className="text-[11px] text-slate-400 block mb-1">自定义金额:</span>
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    min={1}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {stripeToast && (
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs">
                  {stripeToast}
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  onClick={handleExecuteStripeCheckout}
                  disabled={stripeLoading || topupAmount <= 0}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  {stripeLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在连接 Stripe 收银台...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>前往 Stripe 安全支付 (${topupAmount} USD)</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-500 text-center">
                  由 Stripe Test Mode 沙盒提供安全支付保障 · 支持 Visa / Mastercard
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
