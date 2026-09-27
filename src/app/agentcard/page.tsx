"use client";

import React, { useState } from "react";
import { Navbar, NavView } from "@/components/Navbar";
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
    <div className="min-h-screen flex flex-col bg-[#0b0e17] text-white">
      {/* Top Fixed Navigation */}
      <Navbar
        currentView="AGENTCARD"
        onSelectView={handleSelectView}
        account={account}
        balance={balance}
        onConnect={() => {}}
        onDisconnect={() => setAccount(null)}
      />

      {/* Main Agent Card Scanner Container */}
      <main className="flex-1 w-full pt-16">
        <iframe
          src="/agentcard/index.html"
          className="w-full h-[calc(100vh-64px)] border-0"
          title="AI Card Scanner // Neural Asset Processor"
        />
      </main>
    </div>
  );
}
