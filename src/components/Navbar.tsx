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
  Sparkles,
  Layers,
  Network,
  CreditCard,
  Cpu,
} from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { monadTestnet } from "@/lib/contract";

export type NavView = "INDEX" | "DETAIL" | "PRODUCT" | "AGENTCARD";

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
    { id: "DETAIL", label: "DETAIL", icon: <Network className="w-3.5 h-3.5" />, badge: "3D" },
    { id: "PRODUCT", label: "PRODUCT", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "AGENTCARD", label: "AGENTCARD", icon: <CreditCard className="w-3.5 h-3.5 text-cyan-400" />, badge: "AI" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10 px-3 sm:px-8 py-2.5 backdrop-blur-xl transition-all bg-[#0f131d]/80">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => onSelectView("INDEX")}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-400 shadow-glow group-hover:scale-105 transition-transform duration-300">
            <Shield className="w-4 h-4 text-white" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider text-white">
                KOLIANCE
              </span>
              <span className="hidden md:inline-block text-[10px] text-slate-400 font-mono">
                // TRUST ARCHITECTURE
              </span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                10k TPS
              </span>
            </div>
          </div>
        </div>

        {/* 4-Tab Navigation Switcher: INDEX | DETAIL | PRODUCT | AGENTCARD */}
        <nav className="flex items-center p-1 rounded-2xl bg-[#141826]/90 border border-white/10 shadow-inner backdrop-blur-md">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`relative px-3 sm:px-4 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-400/50 rounded-xl shadow-glow"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-mono border border-cyan-400/30 hidden sm:inline">
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Network & Wallet Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Monad Testnet Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141826] border border-white/10 text-xs font-mono text-slate-300">
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
                className="flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#141826] border border-white/10 hover:border-purple-500 text-xs sm:text-sm font-medium transition-all shadow-glow text-white"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs">{truncateAddress(account)}</span>
                <span className="hidden sm:inline text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                  {balance} MON
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#141826] border border-white/10 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
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
              className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm transition-all shadow-glow overflow-hidden active:scale-95"
            >
              <Wallet className="w-4 h-4" />
              <span className="relative">Connect</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
