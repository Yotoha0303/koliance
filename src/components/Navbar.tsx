"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Wallet,
  ChevronDown,
  CheckCircle2,
  Copy,
  LogOut,
  ExternalLink,
  Zap,
  Activity,
  Layers,
  Network,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { monadTestnet } from "@/lib/contract";

export type NavView = "INDEX" | "DETAIL" | "PRODUCT" | "MARKET" | "AGENTCARD";

interface NavbarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  account: `0x${string}` | null;
  balance: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Navbar({
  currentView,
  onSelectView,
  account,
  balance,
  onConnect,
  onDisconnect,
}: NavbarProps) {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const copyToClipboard = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems: Array<{ id: NavView; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: "INDEX", label: "INDEX", icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "DETAIL", label: "DETAIL", icon: <Network className="w-3.5 h-3.5" />, badge: "AGENT" },
    { id: "PRODUCT", label: "PRODUCT", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "MARKET", label: "MARKET", icon: <TrendingUp className="w-3.5 h-3.5" />, badge: "LIVE" },
    { id: "AGENTCARD", label: "AGENTCARD", icon: <CreditCard className="w-3.5 h-3.5" />, badge: "AI" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-8 py-2.5 backdrop-blur-xl transition-all bg-[#0d1017]/85 border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo (High-End White Aesthetic) */}
        <div
          onClick={() => onSelectView("INDEX")}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-white via-slate-200 to-slate-400 text-black shadow-[0_2px_12px_rgba(255,255,255,0.15)] group-hover:scale-105 transition-transform duration-300">
            <Shield className="w-4 h-4 text-black fill-black/20" />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0d1017] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider text-white">
                KOLIANCE
              </span>
              <span className="hidden md:inline-block text-[10px] text-slate-400 font-mono">
                // TRUST ARCHITECTURE
              </span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/[0.08] text-slate-200 border border-white/[0.12]">
                10k TPS
              </span>
            </div>
          </div>
        </div>

        {/* 5-Tab Navigation Switcher (Luxury Frosted White Pill) */}
        <nav className="flex items-center p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md overflow-x-auto">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`relative px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium tracking-wide transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-white-pill"
                    className="absolute inset-0 bg-white/[0.14] border border-white/25 rounded-xl shadow-[0_2px_10px_rgba(255,255,255,0.06)]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-white font-mono border border-white/20 hidden sm:inline">
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Network & High-End Contrast Wallet Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Monad Testnet Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="w-2 h-2 -ml-4 rounded-full bg-emerald-400" />
            <span>Monad Testnet</span>
            <span className="text-slate-400 text-[10px]">#10143</span>
          </div>

          {/* Wallet Button */}
          {account ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-xl bg-white/[0.06] border border-white/20 hover:border-white/40 text-xs sm:text-sm font-medium transition-all text-white shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs text-white">{truncateAddress(account)}</span>
                <span className="hidden sm:inline text-xs px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono">
                  {balance} MON
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#141824] border border-white/15 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-[11px] text-slate-400 font-mono">Connected Account</p>
                    <p className="text-xs font-mono text-white truncate mt-0.5">{account}</p>
                    <p className="text-[11px] font-mono text-emerald-400 mt-1">{balance} MON</p>
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-slate-300 hover:text-white transition"
                  >
                    <span className="flex items-center gap-2">
                      {copied ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied ? "Copied!" : "Copy Address"}
                    </span>
                  </button>

                  <a
                    href={`${monadTestnet.blockExplorers.default.url}/address/${account}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-slate-300 hover:text-white transition"
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      View on Explorer
                    </span>
                  </a>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onDisconnect();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-500/20 text-xs text-red-400 hover:text-red-300 transition mt-1"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="w-3.5 h-3.5" />
                      Disconnect
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-black font-semibold text-xs sm:text-sm transition-all shadow-[0_2px_12px_rgba(255,255,255,0.18)] active:scale-95"
            >
              <Wallet className="w-4 h-4 text-black" />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
