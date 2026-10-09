"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { PositionPanel } from "@/components/PositionPanel";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import { useRouter } from "next/navigation";
import { createPublicClient, http, formatEther } from "viem";
import { monadTestnet } from "@/lib/contract";
import { ExternalLink } from "lucide-react";

/**
 * Perp trading page.
 *
 * Wallet handling mirrors the main page so behaviour is consistent: request
 * accounts, then nudge to chain 10143 if the wallet is elsewhere. The panel
 * itself reads and writes the perp contracts directly.
 */
export default function PerpPage() {
  const router = useRouter();
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState("0.00");

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });

  const refreshBalance = useCallback(
    async (addr: `0x${string}`) => {
      try {
        const wei = await publicClient.getBalance({ address: addr });
        setBalance(Number(formatEther(wei)).toFixed(4));
      } catch {
        setBalance("0.00");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const switchToMonad = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${monadTestnet.id.toString(16)}` }],
      });
    } catch (err: any) {
      // 4902 = chain not known to the wallet yet.
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${monadTestnet.id.toString(16)}`,
              chainName: monadTestnet.name,
              rpcUrls: monadTestnet.rpcUrls.default.http,
              nativeCurrency: monadTestnet.nativeCurrency,
              blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
            },
          ],
        });
      }
    }
  };

  const handleConnect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask, Rabby, or an EVM-compatible Web3 wallet!");
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.length) {
        const addr = accounts[0] as `0x${string}`;
        setAccount(addr);
        await refreshBalance(addr);
      }
      const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      if (parseInt(chainIdHex, 16) !== monadTestnet.id) {
        await switchToMonad();
      }
    } catch (err) {
      console.error("Connect error:", err);
    }
  };

  const handleDisconnect = () => {
    setAccount(null);
    setBalance("0.00");
  };

  // Keep the account in sync when the wallet changes, and refresh the balance
  // when the chain does.
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const onAccounts = (accs: string[]) => {
      const addr = (accs?.[0] as `0x${string}`) ?? null;
      setAccount(addr);
      if (addr) refreshBalance(addr);
      else setBalance("0.00");
    };
    const onChain = () => {
      if (account) refreshBalance(account);
    };
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, [account, refreshBalance]);

  const handleSelectView = (view: NavView) => {
    if (view === "PERP") return;
    router.push(`/?view=${view}`);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-purple-500 selection:text-white bg-[#0d1017] text-white relative">
      <CursorTrail />

      <Navbar
        currentView="PERP"
        onSelectView={handleSelectView}
        account={account}
        balance={balance}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <main className="flex-1 w-full pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Perp Terminal</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monad Testnet · 链上永续合约 · 所有数字均读取自合约
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <PositionPanel account={account} />

          {/* Stage controls. The demo's whole trigger lives here, which is why
              it sits beside the positions rather than behind a menu: the price
              bump and the liquidation are one click each, on the same screen
              the audience is already looking at. */}
          <DemoControlPanel account={account} />
        </div>
      </main>

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
            <button onClick={() => router.push("/?view=TOKEN")} className="hover:text-white transition">
              TOKEN
            </button>
            <button onClick={() => router.push("/market")} className="hover:text-white transition">
              MARKET
            </button>
            <button onClick={() => router.push("/agentcard")} className="hover:text-white transition">
              AGENTCARD
            </button>
            <span className="text-white font-bold">PERP</span>
            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
