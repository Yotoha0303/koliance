"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Activity,
  Zap,
  Search,
  ExternalLink,
  Copy,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Radio,
  Lock,
  Unlock,
  CreditCard,
  Gamepad2,
  TrendingUp,
  ArrowRight,
  Clock,
  User,
  Fingerprint,
  Award,
  FileCheck,
  Check,
  Info,
  DollarSign,
  Send,
  Sliders,
  Flame,
  ChevronDown,
} from "lucide-react";
import { monadTestnet, KOLIANCE_ADDRESS, TrustRecordData } from "@/lib/contract";
import { truncateAddress } from "@/lib/utils";

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

interface OrderBookItem {
  id: string;
  asset: "MON/USDT" | "xNVDA/USDC" | "xBTC/MON" | "xAAPL/USDC";
  type: "BUY" | "SELL";
  price: string;
  amount: string;
  agentId: string;
  status: "FILLED" | "MATCHING";
  time: string;
}

export function AgentCardTerminal({ currentAccount, records }: AgentCardTerminalProps) {
  const [targetAddress, setTargetAddress] = useState<string>(
    currentAccount || "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7"
  );
  const [searchInput, setSearchInput] = useState("");
  const [cardFrozen, setCardFrozen] = useState(false);
  const [creditLimit, setCreditLimit] = useState(10000);
  const [creditUsed, setCreditUsed] = useState(1248.52);
  const [activeTab, setActiveTab] = useState<"card_engine" | "identity" | "reputation" | "transactions" | "capabilities">("card_engine");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Micro-payments & gaming achievements stream
  const [totalMicroRewards, setTotalMicroRewards] = useState(0.0000142);
  const [achievements, setAchievements] = useState<AchievementEvent[]>([
    {
      id: "ach-1",
      game: "CyberMonad Arena",
      title: "FIRST_BLOOD_KILL",
      payout: "$0.0000001",
      slot: 1948320,
      txHash: "0x8a92...41ef",
      timestamp: "Just now",
    },
    {
      id: "ach-2",
      game: "Monad Racer 2026",
      title: "DRIFT_KING_500M",
      payout: "$0.0000001",
      slot: 1948319,
      txHash: "0x77c2...e0e0",
      timestamp: "2s ago",
    },
    {
      id: "ach-3",
      game: "DeFi Dungeon",
      title: "COLLECT_ZK_ORB",
      payout: "$0.0000001",
      slot: 1948318,
      txHash: "0xfe31...19d4",
      timestamp: "5s ago",
    },
  ]);

  // Cross-Asset Orderbook (Crypto & Tokenized US Stocks)
  const [orderbook, setOrderbook] = useState<OrderBookItem[]>([
    {
      id: "ord-1",
      asset: "xNVDA/USDC",
      type: "BUY",
      price: "$142.80",
      amount: "50.0 SHARES",
      agentId: "Agent-Arbitrage-09",
      status: "FILLED",
      time: "1s ago",
    },
    {
      id: "ord-2",
      asset: "MON/USDT",
      type: "SELL",
      price: "$3.45",
      amount: "15,000 MON",
      agentId: "Consensus-Leader",
      status: "FILLED",
      time: "3s ago",
    },
    {
      id: "ord-3",
      asset: "xBTC/MON",
      type: "BUY",
      price: "18,420 MON",
      amount: "1.25 BTC",
      agentId: "AuditDAO-Agent",
      status: "MATCHING",
      time: "6s ago",
    },
    {
      id: "ord-4",
      asset: "xAAPL/USDC",
      type: "BUY",
      price: "$234.50",
      amount: "20.0 SHARES",
      agentId: "RiskShield-Sentinel",
      status: "FILLED",
      time: "9s ago",
    },
  ]);

  // Interactive Micro-Reward Trigger (Gaming Achievement)
  const [isSimulatingAchievement, setIsSimulatingAchievement] = useState(false);

  const triggerAchievementPayout = () => {
    setIsSimulatingAchievement(true);
    const gameTitles = [
      { game: "CyberMonad Arena", title: "DEFEAT_RAID_BOSS" },
      { game: "Monad Speedrun", title: "SUB_400MS_COMBO" },
      { game: "Neural Quest", title: "UNLOCKED_HIDDEN_SHIELD" },
      { game: "Starfire Tactics", title: "PERFECT_PARALLEL_DEFENSE" },
    ];
    const picked = gameTitles[Math.floor(Math.random() * gameTitles.length)];

    setTimeout(() => {
      const newEvent: AchievementEvent = {
        id: `ach-${Date.now()}`,
        game: picked.game,
        title: picked.title,
        payout: "$0.0000001",
        slot: 1948325 + Math.floor(Math.random() * 50),
        txHash: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        timestamp: "Just now",
      };

      setAchievements((prev) => [newEvent, ...prev.slice(0, 5)]);
      setTotalMicroRewards((t) => t + 0.0000001);
      setIsSimulatingAchievement(false);
    }, 450);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim().startsWith("0x")) {
      setTargetAddress(searchInput.trim());
    }
  };

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Top Banner: Monad Hackathon Focus & Search */}
      <div className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.12] text-xs font-mono text-white mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>MONAD HACKATHON // AI AGENT VISA PROTOCOL</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-300">10,000 TPS Parallel Execution</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Koliance AgentCard</span>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white border border-white/20 font-mono">
                VISA ISSUED
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-mono mt-1 max-w-2xl">
              The AI-Native Visa &amp; Credit Settlement Terminal on Monad. Facilitating high-frequency
              sub-cent micropayments, game achievement rewards ($0.0000001), and cross-asset tokenized stock trading.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 text-[11px] uppercase mr-1">Switch Entity:</span>
            {currentAccount && (
              <button
                onClick={() => setTargetAddress(currentAccount)}
                className={`px-3 py-1.5 rounded-xl transition ${
                  targetAddress.toLowerCase() === currentAccount.toLowerCase()
                    ? "bg-white text-black font-bold"
                    : "bg-white/[0.06] text-slate-300 hover:text-white"
                }`}
              >
                Connected Wallet
              </button>
            )}
            <button
              onClick={() => setTargetAddress("0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7")}
              className={`px-3 py-1.5 rounded-xl transition ${
                targetAddress === "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7"
                  ? "bg-white text-black font-bold"
                  : "bg-white/[0.06] text-slate-300 hover:text-white"
              }`}
            >
              Consensus Leader AI
            </button>
            <button
              onClick={() => setTargetAddress("0x1Db3439a222C519ab44bb1144fC23CC7c1405e98")}
              className={`px-3 py-1.5 rounded-xl transition ${
                targetAddress === "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98"
                  ? "bg-white text-black font-bold"
                  : "bg-white/[0.06] text-slate-300 hover:text-white"
              }`}
            >
              Sentinel Prover Agent
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Monad address (0x...) or DID to inspect AgentCard credentials and micro-payment ledger..."
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#0d1017] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 font-mono focus:outline-none focus:border-white/30 transition shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-black font-semibold text-xs sm:text-sm font-mono transition shadow-sm active:scale-95 shrink-0"
          >
            Inspect Terminal
          </button>
        </form>
      </div>

      {/* Main Terminal Grid: 3 Cohesive Interactive Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Col 1 (4 cols): 3D Physical Visa AgentCard & Controls */}
        <div className="lg:col-span-4 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-300" />
                Physical AgentCard
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                ACTIVE
              </span>
            </div>

            {/* 3D Realistic Visa AgentCard Model */}
            <motion.div
              whileHover={{ rotateY: 8, rotateX: -6, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`relative w-full h-56 rounded-2xl p-5 flex flex-col justify-between shadow-2xl overflow-hidden cursor-pointer select-none transition-all ${
                cardFrozen
                  ? "bg-gradient-to-br from-slate-800 to-slate-950 border border-red-500/40 opacity-75"
                  : "bg-gradient-to-br from-slate-900 via-[#1a2030] to-black border border-white/20 shadow-[0_10px_35px_rgba(0,0,0,0.6)]"
              }`}
            >
              {/* EMV Holographic Chip & Wireless Indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 rounded-md bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 border border-amber-500/40 shadow-sm flex items-center justify-center p-1">
                    <div className="w-full h-full border border-black/20 rounded-[2px]" />
                  </div>
                  <Radio className="w-4 h-4 text-slate-400 transform rotate-90" />
                </div>
                <span className="text-xs font-mono text-slate-400 font-bold">KOLIANCE AGENT</span>
              </div>

              {/* Embossed Card Number */}
              <div className="space-y-1 my-auto">
                <span className="text-lg sm:text-xl font-mono text-white tracking-widest font-black drop-shadow-md">
                  4219 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; {targetAddress.slice(2, 6).toUpperCase()}
                </span>
                <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
                  <span>EXP: 10/29</span>
                  <span>CVV: &bull;&bull;&bull;</span>
                  <span>CREDIT: ${creditLimit.toLocaleString()}</span>
                </div>
              </div>

              {/* Cardholder DID & Visa Hologram */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase block">AUTHORIZED AGENT DID</span>
                  <span className="text-xs font-mono text-white font-bold truncate block max-w-[170px]">
                    did:monad:{targetAddress.slice(0, 10)}...
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xl font-black italic tracking-tighter text-white">VISA</span>
                  <span className="text-[8px] font-mono text-slate-400 uppercase">PLATINUM AGENT</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Card Management Controls */}
          <div className="space-y-3 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Credit Used:</span>
              <strong className="text-white font-bold">${creditUsed.toLocaleString()} / ${creditLimit.toLocaleString()}</strong>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-white to-slate-300 rounded-full"
                style={{ width: `${(creditUsed / creditLimit) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setCardFrozen(!cardFrozen)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono transition ${
                  cardFrozen
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-white/[0.06] hover:bg-white/10 text-white border border-white/10"
                }`}
              >
                {cardFrozen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{cardFrozen ? "Card Frozen" : "Freeze Card"}</span>
              </button>

              <button
                onClick={() => setCreditLimit((l) => l + 2500)}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-mono font-bold transition shadow-sm active:scale-95"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Boost Limit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Col 2 (5 cols): High-Frequency Gaming Achievement Micro-Rewards ($0.0000001) */}
        <div className="lg:col-span-5 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-5 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Gaming Micro-Achievement Rewards</h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                $0.0000001 / ACH
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono mt-3 leading-relaxed">
              Every time a player unlocks a gaming milestone, the AI Agent executes an instantaneous
              micro-payment of <strong>$0.0000001</strong> directly to the player&apos;s address via Monad&apos;s 10,000 TPS single-slot pipeline.
            </p>

            {/* Total Stream Metric */}
            <div className="p-4 rounded-2xl bg-[#0d1017] border border-white/[0.06] mt-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block uppercase">
                  Accumulated Micro-Rewards Streamed
                </span>
                <strong className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                  ${totalMicroRewards.toFixed(7)} USD
                </strong>
              </div>
              <button
                onClick={triggerAchievementPayout}
                disabled={isSimulatingAchievement}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-mono font-bold transition shadow-sm flex items-center gap-1.5 active:scale-95"
              >
                {isSimulatingAchievement ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>0.4s Finalizing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Trigger Achievement</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Micro-Achievement Feed */}
            <div className="space-y-2 mt-4">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                Real-Time Monad Micro-Reward Ledger
              </span>

              <AnimatePresence>
                {achievements.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Flame className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-[11px] block">{item.title}</span>
                        <span className="text-[10px] text-slate-400">{item.game}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <strong className="text-emerald-400 font-bold block">{item.payout}</strong>
                      <span className="text-[9px] text-slate-500">Slot {item.slot} &bull; {item.timestamp}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.08] text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Execution Latency: <strong className="text-white">~380ms</strong></span>
            <span>Gas: <strong className="text-emerald-400">&lt; $0.000001</strong></span>
          </div>
        </div>

        {/* Col 3 (3 cols): Cross-Asset Tokenized US Stocks & Crypto Matching */}
        <div className="lg:col-span-3 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-4 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-300" />
                <h3 className="font-bold text-base text-white">Cross-Asset Matching</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-200">
                US STOCKS &amp; MON
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mt-2 leading-relaxed">
              AI Agents autonomously balance liquidity between crypto assets and tokenized equities.
            </p>

            {/* Orderbook List */}
            <div className="space-y-2 mt-4 text-xs font-mono">
              {orderbook.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{ord.asset}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        ord.type === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {ord.type}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>{ord.amount}</span>
                    <strong className="text-white font-mono">{ord.price}</strong>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-white/[0.04]">
                    <span>{ord.agentId}</span>
                    <span className="text-emerald-400">{ord.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.08] text-center">
            <span className="text-[11px] font-mono text-slate-400">
              Matched via Monad Parallel Orderbook Engine
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: 4 Deep On-Chain Verification Pillars */}
      <div className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-white" />
              <span>On-Chain Account Trust &amp; Capability Verification</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Target Monad Address: <code className="text-white font-bold">{targetAddress}</code>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {[
              { id: "identity", label: "1. 检查身份 (Identity)", icon: <User className="w-3.5 h-3.5" /> },
              { id: "reputation", label: "2. 检查信誉 (Reputation)", icon: <Award className="w-3.5 h-3.5" /> },
              { id: "transactions", label: "3. 检查历史交易 (Ledger)", icon: <Clock className="w-3.5 h-3.5" /> },
              { id: "capabilities", label: "4. 检查能力证明 (ZK-Proof)", icon: <FileCheck className="w-3.5 h-3.5" /> },
            ].map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                    active ? "bg-white text-black font-bold shadow-sm" : "bg-white/[0.04] text-slate-400 hover:text-white"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Identity */}
        {activeTab === "identity" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <span className="text-slate-400 text-[10px] uppercase">Monad DID Registration</span>
              <p className="text-white font-bold text-sm">did:monad:{targetAddress}</p>
              <span className="text-emerald-400 text-[11px] block">Verified &amp; Active on Monad Testnet #10143</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <span className="text-slate-400 text-[10px] uppercase">IPFS Identity Hash</span>
              <p className="text-white font-mono truncate">ipfs://koliance-agent-{targetAddress.slice(2, 10)}-proof-metadata</p>
              <span className="text-slate-400 text-[11px] block">Cryptographic Hash anchored in smart contract</span>
            </div>
          </div>
        )}

        {/* Tab 2: Reputation */}
        {activeTab === "reputation" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1 text-center">
              <span className="text-slate-400 text-[10px] uppercase">Trust Score</span>
              <p className="text-3xl font-black text-white font-mono">96.8 / 100</p>
              <span className="text-emerald-400 text-[11px]">Sovereign Tier</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1 text-center">
              <span className="text-slate-400 text-[10px] uppercase">Sybil Resistance</span>
              <p className="text-3xl font-black text-emerald-400 font-mono">99.4%</p>
              <span className="text-slate-400 text-[11px]">High Risk Protected</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1 text-center">
              <span className="text-slate-400 text-[10px] uppercase">Credit Line Assigned</span>
              <p className="text-3xl font-black text-white font-mono">${creditLimit.toLocaleString()}</p>
              <span className="text-slate-400 text-[11px]">Backed by Monad Stake</span>
            </div>
          </div>
        )}

        {/* Tab 3: Transactions */}
        {activeTab === "transactions" && (
          <div className="overflow-x-auto text-xs font-mono">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400 text-[11px]">
                  <th className="py-2 px-3">TX HASH</th>
                  <th className="py-2 px-3">METHOD</th>
                  <th className="py-2 px-3">LATENCY</th>
                  <th className="py-2 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 text-white">0x5c7b...f8e9</td>
                  <td className="py-2.5 px-3 text-slate-300">addTrust(address, action, proof)</td>
                  <td className="py-2.5 px-3 text-emerald-400">380ms</td>
                  <td className="py-2.5 px-3 text-emerald-400">Single-Slot Finalized</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 text-white">0x91b2...86da</td>
                  <td className="py-2.5 px-3 text-slate-300">executeMicroPayment($0.0000001)</td>
                  <td className="py-2.5 px-3 text-emerald-400">375ms</td>
                  <td className="py-2.5 px-3 text-emerald-400">Single-Slot Finalized</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Capabilities */}
        {activeTab === "capabilities" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-sm">CORE_DEVELOPER_CREDENTIAL</span>
                <span className="text-emerald-400 text-[10px]">Valid</span>
              </div>
              <p className="text-slate-400 text-[11px]">Proof: 0xa3872c9167b5e40e2d1d07c089207e4d82b3d81b312783709b119c43bcae619a</p>
              <span className="text-slate-500 text-[10px]">Signed by Koliance Smart Contract</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-sm">AI_AGENT_MICRO_SETTLEMENT_SEAL</span>
                <span className="text-emerald-400 text-[10px]">Valid</span>
              </div>
              <p className="text-slate-400 text-[11px]">Proof: 0xfe31889c0993d0d866a27e792c3a502c38d4f40f06579bb8d2efebc8b05619d4</p>
              <span className="text-slate-500 text-[10px]">Signed by Monad Single-Slot Engine</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
