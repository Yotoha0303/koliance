"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Layers,
  Sparkles,
  KeyRound,
  ExternalLink,
  Cpu,
  Activity,
  CheckCircle2,
  Terminal,
  Zap,
  Network,
  ArrowRight,
  Database,
  Lock,
  Search,
  Bell,
  ChevronDown,
  Settings,
  MoreHorizontal,
  Fingerprint,
  TrendingUp,
  User,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { monadTestnet, KOLIANCE_ADDRESS } from "@/lib/contract";

interface ProductStudioProps {
  account: `0x${string}` | null;
  onStakeAction?: () => void;
  onRegisterAction?: () => void;
}

export function ProductStudio({ account, onStakeAction, onRegisterAction }: ProductStudioProps) {
  const [activeSideTab, setActiveSideTab] = useState("overview");
  const [selectedAsset, setSelectedAsset] = useState("portfolio");
  const [hoveredMonth, setHoveredMonth] = useState("May");

  return (
    <div className="w-full flex flex-col xl:flex-row items-center justify-between gap-8 py-4 font-sans">
      {/* LEFT: 3D Holographic Identity Verification Badge & Certificate Stream (1:1 with Image 3) */}
      <div className="w-full xl:w-5/12 flex flex-col items-center justify-center relative min-h-[580px] p-6 overflow-hidden">
        {/* Ambient Glow & Starfields */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-[80px]" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/15 rounded-full blur-[80px]" />
        </div>

        {/* Floating Brand Header */}
        <div className="w-full flex items-center gap-3 mb-8 z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-white shadow-glow">
            <span className="font-black text-xl">K</span>
          </div>
          <span className="text-2xl font-black tracking-wider text-white">Koliance</span>
        </div>

        {/* 3D Floating Holographic Cards Stage */}
        <div className="relative w-full max-w-md h-[340px] flex items-center justify-center z-10">
          {/* Card 1: Identity Verification Badge (Left Front) */}
          <motion.div
            animate={{
              y: [-6, 6, -6],
              rotateZ: [-2, 1, -2],
            }}
            transition={{
              repeat: Infinity,
              duration: 5,
              ease: "easeInOut",
            }}
            className="absolute left-2 top-4 w-52 h-72 rounded-3xl bg-[#141826]/90 border-2 border-cyan-400 p-5 shadow-[0_0_35px_rgba(0,242,254,0.35)] backdrop-blur-xl flex flex-col items-center justify-between text-center z-20"
          >
            {/* Holographic Badge Silhouette */}
            <div className="relative w-28 h-28 rounded-full border-2 border-dashed border-cyan-300 flex items-center justify-center p-2 mt-2">
              <div className="w-full h-full rounded-full bg-gradient-to-b from-cyan-400/30 to-purple-600/40 flex items-center justify-center border border-white/20">
                <User className="w-12 h-12 text-cyan-200" />
              </div>
              <div className="absolute -inset-1 border border-cyan-400/50 rounded-full animate-spin" style={{ animationDuration: "12s" }} />
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-black tracking-widest text-white uppercase font-mono">
                IDENTITY VERIFICATION BADGE
              </h4>
              <span className="text-[10px] text-cyan-300 font-mono">
                MONAD TESTNET ON-CHAIN
              </span>
            </div>
          </motion.div>

          {/* Card 2: Trust Certificate (Right Back with curved arrow) */}
          <motion.div
            animate={{
              y: [6, -6, 6],
              rotateZ: [2, -1, 2],
            }}
            transition={{
              repeat: Infinity,
              duration: 5.5,
              ease: "easeInOut",
            }}
            className="absolute right-4 top-10 w-48 h-64 rounded-2xl bg-[#181d2e]/85 border border-purple-400/60 p-4 shadow-[0_0_30px_rgba(168,85,247,0.3)] backdrop-blur-xl flex flex-col justify-between text-left z-10"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-purple-400/30 pb-2">
                <span className="text-[10px] font-mono font-bold text-purple-300 uppercase">
                  TRUST CERTIFICATE
                </span>
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              </div>

              {/* Faux certificate lines */}
              <div className="space-y-1.5 pt-2">
                <div className="h-1.5 w-3/4 bg-purple-400/40 rounded-full" />
                <div className="h-1.5 w-full bg-purple-400/30 rounded-full" />
                <div className="h-1.5 w-5/6 bg-purple-400/30 rounded-full" />
                <div className="h-1.5 w-2/3 bg-purple-400/20 rounded-full" />
              </div>
            </div>

            {/* Seal */}
            <div className="flex items-center justify-between pt-2 border-t border-purple-400/20">
              <span className="text-[9px] font-mono text-slate-400">#0x32fD...4928</span>
              <div className="w-7 h-7 rounded-full bg-purple-500/30 border border-purple-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-purple-300" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sparkling particle stream with cursor arrow */}
        <div className="w-full relative h-16 flex items-center justify-start px-8">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400/80 to-purple-500 rounded-full blur-[1px]" />
          <div className="absolute right-12 w-6 h-6 transform rotate-45 border-t-2 border-r-2 border-white shadow-glow" />
        </div>
      </div>

      {/* RIGHT: Web3 Dashboard Container (1:1 with Image 3) */}
      <div className="w-full xl:w-7/12 rounded-3xl bg-[#0f121b] border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-5">
        {/* Top Bar inside Dashboard */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-black font-extrabold text-sm">
              K
            </div>
            <span className="font-bold text-white text-base">Koliance</span>
            <span className="text-slate-400 text-sm hidden sm:inline">|</span>
            <span className="text-slate-300 font-medium text-sm hidden sm:inline">Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl bg-[#161a26] border border-white/10 text-slate-300 hover:text-white transition">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161a26] border border-white/10 text-xs text-white">
              <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold">
                K
              </div>
              <span>Koliance</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Dashboard Body: Left Mini-Nav + Right Content */}
        <div className="flex flex-col md:flex-row gap-5">
          {/* Mini Nav Sidebar */}
          <div className="w-full md:w-36 flex md:flex-col justify-between shrink-0 border-b md:border-b-0 md:border-r border-white/10 pr-0 md:pr-3 pb-3 md:pb-0">
            <div className="flex md:flex-col gap-1 w-full overflow-x-auto">
              {[
                { id: "overview", label: "Overview", icon: <Layers className="w-3.5 h-3.5" /> },
                { id: "assets", label: "Assets", icon: <Database className="w-3.5 h-3.5" /> },
                { id: "governance", label: "Governance", icon: <Cpu className="w-3.5 h-3.5" /> },
                { id: "security", label: "Security", icon: <Shield className="w-3.5 h-3.5" /> },
                { id: "profile", label: "Profile", icon: <User className="w-3.5 h-3.5" /> },
              ].map((tab) => {
                const active = activeSideTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSideTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition shrink-0 ${
                      active
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-glow"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button className="hidden md:flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white transition">
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>

          {/* Right Main Grid */}
          <div className="flex-1 space-y-5">
            {/* Row 1: Digital Assets (3 cards) + Security Protocol */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left 8 cols: Digital Assets */}
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Digital Assets</span>
                  <button className="text-[11px] font-mono text-slate-400 hover:text-white">
                    Manage Assets
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Card 1: ETH */}
                  <div
                    onClick={() => setSelectedAsset("eth")}
                    className={`p-3 rounded-2xl bg-[#141826] border transition cursor-pointer flex flex-col justify-between ${
                      selectedAsset === "eth"
                        ? "border-cyan-400 shadow-glow"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-white font-mono">ETH</span>
                        <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <p className="text-xs font-extrabold text-white font-mono">$148,730.40</p>
                      <span className="text-[10px] text-emerald-400 font-mono">+12.5% 24h</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStakeAction?.();
                      }}
                      className="mt-2.5 w-full py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-[10px] font-mono font-bold text-white transition"
                    >
                      Stake Now
                    </button>
                  </div>

                  {/* Card 2: Portfolio Value (Featured highlighted) */}
                  <div
                    onClick={() => setSelectedAsset("portfolio")}
                    className={`p-3 rounded-2xl bg-[#161d30] border-2 transition cursor-pointer flex flex-col justify-between ${
                      selectedAsset === "portfolio"
                        ? "border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.3)]"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-cyan-300 font-mono">Portfolio Value</span>
                        <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <p className="text-xs font-extrabold text-white font-mono">$148,730.40</p>
                      <span className="text-[10px] text-emerald-400 font-mono">+12.5% 24h</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStakeAction?.();
                      }}
                      className="mt-2.5 w-full py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[10px] font-mono font-black text-black transition"
                    >
                      Stake Now
                    </button>
                  </div>

                  {/* Card 3: BTC */}
                  <div
                    onClick={() => setSelectedAsset("btc")}
                    className={`p-3 rounded-2xl bg-[#141826] border transition cursor-pointer flex flex-col justify-between ${
                      selectedAsset === "btc"
                        ? "border-amber-400 shadow-glow"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-amber-400 font-mono">BTC</span>
                        <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <p className="text-xs font-extrabold text-white font-mono">$148,730.40</p>
                      <span className="text-[10px] text-emerald-400 font-mono">+12.5% 24h</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStakeAction?.();
                      }}
                      className="mt-2.5 w-full py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-[10px] font-mono font-bold text-white transition"
                    >
                      Stake Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 4 cols: Security Protocol Card */}
              <div className="lg:col-span-4 rounded-2xl bg-[#141826] border border-white/10 p-3.5 flex flex-col items-center justify-between h-full min-h-[170px] shadow-lg">
                <div className="w-full flex items-center justify-between text-xs font-bold text-white">
                  <span>Security Protocol</span>
                  <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                </div>

                {/* Concentric Biometric Fingerprint Rings */}
                <div className="relative w-20 h-20 rounded-full border border-cyan-400/40 flex items-center justify-center p-2 my-1">
                  <div className="w-full h-full rounded-full border border-cyan-400/60 flex items-center justify-center">
                    <Fingerprint className="w-9 h-9 text-cyan-300 animate-pulse" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/30 animate-spin" style={{ animationDuration: "10s" }} />
                </div>

                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  Verified
                </span>
              </div>
            </div>

            {/* Row 2: Main Balance Bar */}
            <div className="p-3.5 rounded-2xl bg-[#141826] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block">Main Balance</span>
                <strong className="text-lg font-black text-white font-mono">$148,730.40</strong>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                <span>KTX: <strong className="text-white">12,450</strong></span>
                <span>BTC: <strong className="text-white">1.85</strong></span>
                <span>ETH: <strong className="text-white">35.2</strong></span>
              </div>

              <button
                onClick={onRegisterAction}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-medium transition"
              >
                Manage Assets
              </button>
            </div>

            {/* Row 3: Asset Performance Wave Chart + Transaction Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Asset Performance (Left 8 cols) */}
              <div className="lg:col-span-8 p-4 rounded-2xl bg-[#141826] border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Asset Performance</span>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" /> ETH
                    </span>
                    <span className="flex items-center gap-1 text-purple-400">
                      <span className="w-2 h-2 rounded-full bg-purple-400" /> KTX
                    </span>
                    <span className="flex items-center gap-1 text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-400" /> BTC
                    </span>
                  </div>
                </div>

                {/* Spline Wave Curves SVG */}
                <div className="relative w-full h-36">
                  <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="cyanWave" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#00F2FE" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="purpleWave" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Cyan fill and line */}
                    <path
                      d="M0,80 Q50,60 100,75 T200,65 T260,25 T320,60 T400,30 L400,120 L0,120 Z"
                      fill="url(#cyanWave)"
                    />
                    <path
                      d="M0,80 Q50,60 100,75 T200,65 T260,25 T320,60 T400,30"
                      fill="none"
                      stroke="#00F2FE"
                      strokeWidth="2.5"
                    />

                    {/* Purple fill and line */}
                    <path
                      d="M0,100 Q60,90 120,95 T220,75 T260,45 T330,80 T400,55"
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2"
                    />

                    {/* Peak Dot on May */}
                    <circle cx="260" cy="25" r="4.5" fill="#00F2FE" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="260" cy="45" r="4" fill="#c084fc" stroke="#ffffff" strokeWidth="1.5" />
                  </svg>

                  {/* May Peak Glow Pointer */}
                  <div className="absolute left-[62%] top-1 -translate-x-1/2 p-1 rounded-md bg-cyan-400 text-black font-mono text-[9px] font-bold shadow-glow pointer-events-none">
                    $148.7K
                  </div>
                </div>

                {/* Months Axis */}
                <div className="flex justify-between text-[10px] font-mono text-slate-400 px-2 pt-1 border-t border-white/10">
                  {["Sun", "Feb", "Apr", "May", "Fen", "Jatt", "Abu"].map((m) => (
                    <span
                      key={m}
                      className={m === "May" ? "text-cyan-400 font-bold" : ""}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Transaction Feed (Right 4 cols) */}
              <div className="lg:col-span-4 p-4 rounded-2xl bg-[#141826] border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>Transaction Feed</span>
                  <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                </div>

                <div className="space-y-2.5">
                  {/* Row 1 */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                        <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-[11px] block">+1.2 ETH</span>
                        <span className="text-[9px] text-slate-400">Animated activator</span>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-mono text-[11px] font-bold">+1.2 &darr;</span>
                  </div>

                  {/* Row 2 */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-[11px] block">-0.5 KTX</span>
                        <span className="text-[9px] text-slate-400">Animated indicator</span>
                      </div>
                    </div>
                    <span className="text-red-400 font-mono text-[11px] font-bold">-0.5 &darr;</span>
                  </div>

                  {/* Row 3 */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-[11px] block">Pending 3D Trust Cert</span>
                        <span className="text-[9px] text-slate-400">Animated indicator</span>
                      </div>
                    </div>
                    <span className="text-amber-400 font-mono text-[11px]">&gt;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
