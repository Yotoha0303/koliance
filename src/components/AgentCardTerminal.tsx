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

  // ==================== 1. STEAM CONNECT & PROOFS ====================
  const [steamConnected, setSteamConnected] = useState(false);
  const [steamLoading, setSteamLoading] = useState(false);
  const [steamData, setSteamData] = useState<GameStats | null>(null);
  const [gameProof, setGameProof] = useState<GameplayProof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [customSteamInput, setCustomSteamInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [steamNotice, setSteamNotice] = useState<string | null>(null);

  // Auto-detect OpenID callback or Stripe success on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    // Detect Stripe checkout return
    const status = params.get("status");
    if (status === "success") {
      setStripeToast("🎉 Stripe 充值成功！资金已到账至您的 AgentCard 授信额度。");
      setCreditLimit((prev) => prev + 50);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Detect Steam OpenID callback (claimed_id format: https://steamcommunity.com/openid/id/76561198...)
    const claimedId = params.get("openid.claimed_id") || params.get("openid.identity");
    const rawMatch = (claimedId || window.location.href).match(/openid\/id\/(\d{17})/) || (claimedId ? claimedId.match(/(\d{17})/) : null);
    if (rawMatch && rawMatch[1]) {
      const id = rawMatch[1];
      localStorage.setItem("koliance_steam_id", id);
      loadSteamProfile(id);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check cached Steam ID
    const cached = localStorage.getItem("koliance_steam_id");
    if (cached) {
      loadSteamProfile(cached);
    }
  }, []);

  const loadSteamProfile = async (identifier: string) => {
    setSteamLoading(true);
    setSteamNotice(null);
    try {
      const res = await fetchGameStats(identifier);
      if (res) {
        setSteamData(res);
        setSteamConnected(true);
        localStorage.setItem("koliance_steam_id", res.steamId);
        if (res.totalGames === 0) {
          setSteamNotice("💡 提示：若游戏时长显示为 0，请检查 Steam [个人资料 -> 隐私设置] 是否将『游戏详情』设为公开。");
        }
      }
    } catch (err: any) {
      setSteamNotice(`读取 Steam 资料失败: ${err?.message || err}`);
    } finally {
      setSteamLoading(false);
    }
  };

  // Official Steam OpenID 2.0 1-Click Redirect
  const handleSteamOpenIDLogin = () => {
    const returnUrl = encodeURIComponent(`${window.location.origin}/agentcard`);
    const realm = encodeURIComponent(window.location.origin);
    window.location.href = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${returnUrl}&openid.realm=${realm}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
  };

  const handleCustomSteamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSteamInput.trim()) return;
    loadSteamProfile(customSteamInput.trim());
  };

  const handleMintGameplayProof = async () => {
    if (!steamData) return;
    setProofLoading(true);
    try {
      const proof = await generateGameplayProof(steamData.steamId, targetAddress, 730);
      if (proof) {
        setGameProof(proof);
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
  const [topupAmount, setTopupAmount] = useState<number>(25);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeToast, setStripeToast] = useState<string | null>(null);

  const handleExecuteStripeCheckout = async () => {
    if (topupAmount < 0.5) {
      setStripeToast("⚠️ Stripe 官方规定 USD 最低充值金额为 $0.50");
      return;
    }
    setStripeLoading(true);
    setStripeToast(null);
    try {
      const amountCents = Math.round(topupAmount * 100);
      const res = await createStripeCheckout(amountCents, `Koliance AgentCard $${topupAmount} Top-Up`);
      if (res && res.url) {
        setStripeToast("🚀 正在跳转至 Stripe 官方安全收银台...");
        // Direct redirect to Stripe Hosted Checkout
        window.location.href = res.url;
      } else {
        setStripeToast(`Stripe 异常: ${res?.error || "请检查网络或稍后重试"}`);
      }
    } catch (err: any) {
      setStripeToast(`发起支付失败: ${err?.message || err}`);
    } finally {
      setStripeLoading(false);
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
                支持官方 OpenID / 自定义账号
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-mono">
              连接您的真实 Steam 账号或自定义绑定，实时拉取全量游戏库与总时长，生成 Keccak256 链上信用背书。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!steamConnected ? (
              <>
                {/* 1. Official Steam OpenID Button */}
                <button
                  onClick={handleSteamOpenIDLogin}
                  className="px-5 py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs sm:text-sm font-mono transition shadow-[0_0_25px_rgba(34,211,238,0.4)] flex items-center gap-2 active:scale-95"
                >
                  <Zap className="w-4 h-4 text-black fill-current" />
                  <span>🔑 登录我的 Steam 账号 (官方认证)</span>
                </button>

                {/* 2. Custom Input Toggle */}
                <button
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono transition"
                >
                  {showCustomInput ? "收起输入框" : "输入 Steam 昵称 / 链接"}
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>已绑定：{steamData?.personaName}</span>
                </span>

                <button
                  onClick={() => {
                    setSteamConnected(false);
                    setSteamData(null);
                    localStorage.removeItem("koliance_steam_id");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-400 hover:text-white text-xs font-mono transition"
                >
                  切换账号
                </button>

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

        {/* Custom Steam Input & Presets Bar */}
        {(!steamConnected && showCustomInput) && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3 font-mono">
            <form onSubmit={handleCustomSteamSubmit} className="flex gap-2">
              <input
                type="text"
                value={customSteamInput}
                onChange={(e) => setCustomSteamInput(e.target.value)}
                placeholder="输入你的 Steam 自定义昵称 / 主页链接 / 17位ID (如 gabelogannewell 或 https://steamcommunity.com/id/...)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={steamLoading || !customSteamInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs transition"
              >
                {steamLoading ? "查询中..." : "绑定此账号"}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>快速体验公开账号：</span>
              <button
                type="button"
                onClick={() => loadSteamProfile("76561197960287930")}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-cyan-300 transition"
              >
                👑 Gabe Newell (Valve CEO)
              </button>
              <button
                type="button"
                onClick={() => loadSteamProfile("76561198034202275")}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-emerald-300 transition"
              >
                ⚡ CS2 5000h 高玩
              </button>
            </div>
          </div>
        )}

        {/* Privacy Notice or Warning */}
        {steamNotice && (
          <div className="mt-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{steamNotice}</span>
          </div>
        )}

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
              <div className="overflow-hidden">
                <span className="text-white font-bold block truncate">{steamData.personaName}</span>
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
                  {steamData.topGames.length > 0 ? (
                    steamData.topGames.slice(0, 3).map((g) => (
                      <span key={g.appId} className="px-2 py-0.5 rounded bg-white/10 text-white text-[11px] font-bold">
                        {g.name}: {g.hoursPlayed.toFixed(0)}h
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 text-[11px]">隐私设置为非公开或暂无公开记录</span>
                  )}
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
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1">
                  <span className="text-indigo-300 font-bold block">💡 充值资金流向说明：</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    资金直接入账至您的 Stripe 开发者测试商户；支付完成后自动同步记入本 AgentCard（Visa 4928）的可用授信额度。
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">选择快捷充值金额 (USD)：</span>
                    <span className="text-[10px] text-amber-400">⚠️ Stripe 最低金额: $0.50</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[5, 10, 25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setTopupAmount(amt)}
                        className={`py-2 rounded-xl text-xs font-bold transition border ${
                          topupAmount === amt
                            ? "bg-white text-black border-white"
                            : "bg-white/[0.05] text-slate-300 border-white/10 hover:border-white/30"
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>自定义金额 (USD):</span>
                    <span className="text-slate-500">需 &ge; $0.50</span>
                  </div>
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    min={0.5}
                    step={0.5}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-400 font-mono"
                  />
                  {topupAmount < 0.5 && (
                    <span className="text-red-400 text-[10px] block mt-1">
                      * Stripe 官方规定 USD 单笔最低扣费金额为 $0.50 (50 美分)
                    </span>
                  )}
                </div>
              </div>

              {stripeToast && (
                <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 text-xs">
                  {stripeToast}
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  onClick={handleExecuteStripeCheckout}
                  disabled={stripeLoading || topupAmount < 0.5}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  {stripeLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在跳转 Stripe 收银台...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>前往 Stripe 官方收银台支付 (${topupAmount} USD)</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-500 text-center">
                  跳转至 Stripe 官方托管收银页面 · 支持测试卡 4242 4242... 秒级支付
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
