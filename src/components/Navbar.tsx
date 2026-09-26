"use client";

import React, { useState, useEffect } from "react";
import { Shield, Wallet, ChevronDown, CheckCircle2, Copy, LogOut, ExternalLink, Zap } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { monadTestnet } from "@/lib/contract";

interface NavbarProps {
  account: `0x${string}` | null;
  balance: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Navbar({ account, balance, onConnect, onDisconnect }: NavbarProps) {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const copyToClipboard = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-monad-500/20 px-4 sm:px-8 py-3.5 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-monad-600 via-monad-700 to-cyber-neon shadow-glow">
            <Shield className="w-5 h-5 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-cyber-dark animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-wider text-white">KOLIANCE</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-monad-500/20 text-monad-300 border border-monad-500/30">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-monad-300/70 font-mono tracking-tight hidden sm:block">
              Monad On-Chain Trust & Identity Infrastructure
            </p>
          </div>
        </div>

        {/* Network & Wallet Controls */}
        <div className="flex items-center gap-3">
          {/* Monad Testnet Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-monad-950/60 border border-monad-500/30 text-xs font-mono text-monad-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="w-2 h-2 -ml-4 rounded-full bg-emerald-400" />
            <span>Monad Testnet</span>
            <span className="text-monad-400/60">#10143</span>
          </div>

          {/* Wallet Button */}
          {account ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-monad-950/80 border border-monad-500/40 hover:border-monad-400 text-sm font-medium transition-all shadow-glow hover:shadow-glow-lg text-white"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs">{truncateAddress(account)}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-monad-500/20 text-monad-300 font-mono">
                  {balance} MON
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-monad-300" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-panel-glow p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-monad-500/20 mb-1">
                    <p className="text-[11px] text-monad-300/70 font-mono">Connected Account</p>
                    <p className="text-xs font-mono text-white truncate mt-0.5">{account}</p>
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-monad-500/20 text-xs text-monad-200 hover:text-white transition"
                  >
                    <span className="flex items-center gap-2">
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy Address"}
                    </span>
                  </button>

                  <a
                    href={`${monadTestnet.blockExplorers.default.url}/address/${account}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-monad-500/20 text-xs text-monad-200 hover:text-white transition"
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
              className="group relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-medium text-sm transition-all shadow-glow hover:shadow-glow-lg overflow-hidden active:scale-95"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <Wallet className="w-4 h-4" />
              <span className="relative">Connect Wallet</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
