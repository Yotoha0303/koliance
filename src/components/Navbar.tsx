"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Zap,
  Network,
  CreditCard,
  TrendingUp,
  Coins,
  Activity,
} from "lucide-react";
import { BrandIcon } from "@/components/BrandIcon";
import { NavAuthBadges } from "@/components/NavAuthBadges";

export type NavView =
  | "INDEX"
  | "DETAIL"
  | "PRODUCT"
  | "MARKET"
  | "AGENTCARD"
  | "TOKEN"
  | "PERP";

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

  const navItems: Array<{ id: NavView; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: "INDEX", label: "INDEX", icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "TOKEN", label: "TOKEN", icon: <Coins className="w-3.5 h-3.5" />, badge: "ICON" },
    { id: "DETAIL", label: "DETAIL", icon: <Network className="w-3.5 h-3.5" />, badge: "AGENT" },
    { id: "PRODUCT", label: "PRODUCT", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "MARKET", label: "MARKET", icon: <TrendingUp className="w-3.5 h-3.5" />, badge: "LIVE" },
    { id: "PERP", label: "PERP", icon: <Activity className="w-3.5 h-3.5" />, badge: "ONCHAIN" },
    { id: "AGENTCARD", label: "AGENTCARD", icon: <CreditCard className="w-3.5 h-3.5" />, badge: "AI" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-8 py-2.5 backdrop-blur-2xl transition-all bg-[#0d1017] border-b border-white/15 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo (High-End White Aesthetic) */}
        <div
          onClick={() => onSelectView("INDEX")}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="relative group-hover:scale-105 transition-transform duration-300">
            <BrandIcon size={36} glow />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0d1017] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider text-white">
                KOLIANCE
              </span>
              <span className="hidden md:inline-block text-[10px] text-slate-400 font-mono">
                {"//"} TRUST ARCHITECTURE
              </span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#1e2436] text-slate-200 border border-white/20">
                10k TPS
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Switcher (Solid dark contrast pill, zero scrollbar) */}
        <nav className="flex items-center p-1 rounded-2xl bg-[#141824] border border-white/15 shadow-inner overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`relative px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium tracking-wide transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-white-pill"
                    className="absolute inset-0 bg-[#252c40] border border-white/30 rounded-xl shadow-md"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/15 text-white font-mono border border-white/25 hidden sm:inline">
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Unified Account Center */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* User Account / Profile Center: Avatar, Edit Profile, Connect Wallet, Transfer MON, Identity Badges */}
          <NavAuthBadges
            walletAddress={account}
            balance={balance}
            onConnectWallet={onConnect}
            onDisconnectWallet={onDisconnect}
          />
        </div>
      </div>
    </header>
  );
}
