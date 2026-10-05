"use client";

import React, { useState } from "react";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { useRouter } from "next/navigation";

export default function AgentCardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState("0.00");

  const handleSelectView = (view: NavView) => {
    if (view === "AGENTCARD") return;
    router.push(`/?view=${view}`);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-purple-500 selection:text-white bg-[#0b0e17] text-white relative">
      <CursorTrail />

      {/* Top Fixed Navigation */}
      <Navbar
        currentView="AGENTCARD"
        onSelectView={handleSelectView}
        account={account}
        balance={balance}
        onConnect={() => {}}
        onDisconnect={() => setAccount(null)}
      />

      {/* Main Agent Card Scanner Container: 6-Card Circulating Neural Asset Processor */}
      <main className="flex-1 w-full pt-16">
        <iframe
          src="/agentcard/index.html"
          className="w-full h-[calc(100vh-64px)] border-0"
          title="AI Card Scanner // 6-Card Circulating Neural Asset Processor"
        />
      </main>

      {/* Global Footer */}
      <footer className="border-t border-white/10 py-6 px-4 sm:px-8 mt-12 bg-[#0d1017]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-white tracking-wider">KOLIANCE</span>
            <span className="text-white/20">|</span>
            <span>&copy; {new Date().getFullYear()} Monad Ecosystem Trust Architecture.</span>
          </div>

          <div className="flex items-center gap-5">
            <button onClick={() => router.push("/?view=INDEX")} className="hover:text-white transition">
              INDEX
            </button>
            <button onClick={() => router.push("/?view=DETAIL")} className="hover:text-white transition">
              DETAIL
            </button>
            <button onClick={() => router.push("/?view=PRODUCT")} className="hover:text-white transition">
              PRODUCT
            </button>
            <button onClick={() => router.push("/?view=MARKET")} className="hover:text-white transition">
              MARKET
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
