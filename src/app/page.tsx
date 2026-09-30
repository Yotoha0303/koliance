"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
} from "viem";
import {
  Shield,
  Layers,
  Sparkles,
  KeyRound,
  ExternalLink,
  Cpu,
  Github,
  Server,
  Activity,
  CheckCircle2,
  Terminal,
  Zap,
  Network,
  ArrowRight,
  Database,
  Lock,
  CreditCard,
} from "lucide-react";
import { BrandIcon } from "@/components/BrandIcon";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { EnergyCoreHero } from "@/components/EnergyCoreHero";
import { TrustConstellation } from "@/components/TrustConstellation";
import { ProductStudio } from "@/components/ProductStudio";
import { MarketTerminal } from "@/components/MarketTerminal";
import { IdentityCard } from "@/components/IdentityCard";
import { TrustAttestationCard } from "@/components/TrustAttestationCard";
import { TrustStream } from "@/components/TrustStream";
import { NetworkModal } from "@/components/NetworkModal";
import {
  monadTestnet,
  KOLIANCE_ADDRESS,
  KOLIANCE_ABI,
  IdentityData,
  TrustRecordData,
} from "@/lib/contract";
import { checkBackendHealth } from "@/lib/api";

function MainContent() {
  const searchParams = useSearchParams();
  const initialView = (searchParams.get("view") as NavView) || "INDEX";

  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState("0.00");
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);

  // Top Nav View: INDEX | DETAIL | PRODUCT | AGENTCARD
  const [currentView, setCurrentView] = useState<NavView>(initialView);
  const [hasVisitedAgentCard, setHasVisitedAgentCard] = useState(initialView === "AGENTCARD");

  useEffect(() => {
    if (currentView === "AGENTCARD") {
      setHasVisitedAgentCard(true);
    }
  }, [currentView]);

  // Sub-tab under Product Studio (for direct contract transactions)
  const [contractStudioOpen, setContractStudioOpen] = useState(false);

  // Contract State
  const [identity, setIdentity] = useState<IdentityData | null>(null);
  const [records, setRecords] = useState<TrustRecordData[]>([
    {
      from: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      to: "0x250b7305986c7C0D0190Fe0141a0F911b333E43D",
      action: "ENDORSE_CORE_DEV",
      proof: "0xa3872c9167b5e40e2d1d07c089207e4d82b3d81b312783709b119c43bcae619a",
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 3600),
    },
    {
      from: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      to: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      action: "SECURITY_AUDIT_VERIFIED",
      proof: "0x77c25143329977aa5386da6dd4b61a7a24558e8b0108be65e0ebc5cbe82e0e0a",
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 7200),
    },
    {
      from: "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98",
      to: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      action: "COMMUNITY_CONTRIBUTOR",
      proof: "0xfe31889c0993d0d866a27e792c3a502c38d4f40f06579bb8d2efebc8b05619d4",
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 14400),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState(false);

  // Setup Monad Public Client
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });

  // Switch or Add Monad Testnet to wallet
  const handleSwitchNetwork = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${monadTestnet.id.toString(16)}` }],
      });
      setNetworkModalOpen(false);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
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
          setNetworkModalOpen(false);
        } catch (addError) {
          console.error("Failed to add Monad Testnet", addError);
        }
      }
    }
  };

  // Connect Wallet
  const handleConnect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask, Rabby, or an EVM-compatible Web3 wallet!");
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0] as `0x${string}`);
      }

      const currentChainIdHex = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      const currentChainId = parseInt(currentChainIdHex, 16);
      setChainId(currentChainId);

      if (currentChainId !== monadTestnet.id) {
        setNetworkModalOpen(true);
      }
    } catch (err) {
      console.error("Connect error:", err);
    }
  };

  const handleDisconnect = () => {
    setAccount(null);
    setBalance("0.00");
    setIdentity(null);
  };

  // Fetch account balance and contract data
  const fetchData = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const bal = await publicClient.getBalance({ address: account });
      setBalance(parseFloat(formatEther(bal)).toFixed(4));

      if (KOLIANCE_ADDRESS && KOLIANCE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
          const idData = (await publicClient.readContract({
            address: KOLIANCE_ADDRESS,
            abi: KOLIANCE_ABI,
            functionName: "identities",
            args: [account],
          })) as [boolean, bigint, string];

          setIdentity({
            exists: idData[0],
            createdAt: idData[1],
            metadataHash: idData[2],
          });

          const onchainRecords = (await publicClient.readContract({
            address: KOLIANCE_ADDRESS,
            abi: KOLIANCE_ABI,
            functionName: "getAllRecords",
          })) as any[];

          if (onchainRecords && onchainRecords.length > 0) {
            setRecords(
              onchainRecords.map((r) => ({
                from: r.from,
                to: r.to,
                action: r.action,
                proof: r.proof,
                timestamp: r.timestamp,
              }))
            );
          }
        } catch (contractErr) {
          console.warn("Contract read warning:", contractErr);
        }
      }
    } catch (e) {
      console.error("Fetch data error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [account, publicClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    checkBackendHealth().then(setBackendHealthy);

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) handleDisconnect();
        else setAccount(accounts[0] as `0x${string}`);
      };
      const handleChainChanged = (newChainIdHex: string) => {
        const id = parseInt(newChainIdHex, 16);
        setChainId(id);
        if (id !== monadTestnet.id) setNetworkModalOpen(true);
        else setNetworkModalOpen(false);
      };

      window.ethereum.on?.("accountsChanged", handleAccountsChanged);
      window.ethereum.on?.("chainChanged", handleChainChanged);

      return () => {
        window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
        window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
      };
    }
  }, []);

  // Contract Actions: Register
  const handleRegister = async (metadataHash: string) => {
    if (!account || !window.ethereum) return;
    try {
      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom(window.ethereum),
      });

      if (KOLIANCE_ADDRESS && KOLIANCE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        const hash = await walletClient.writeContract({
          address: KOLIANCE_ADDRESS,
          abi: KOLIANCE_ABI,
          functionName: "register",
          args: [metadataHash],
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await fetchData();
        return hash;
      }
    } catch (err: any) {
      alert(`Registration failed: ${err?.shortMessage || err?.message || err}`);
    }
  };

  // Contract Actions: Add Trust
  const handleAddTrust = async (to: `0x${string}`, action: string, proof: `0x${string}`) => {
    if (!account || !window.ethereum) return;
    try {
      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom(window.ethereum),
      });

      if (KOLIANCE_ADDRESS && KOLIANCE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        const hash = await walletClient.writeContract({
          address: KOLIANCE_ADDRESS,
          abi: KOLIANCE_ABI,
          functionName: "addTrust",
          args: [to, action, proof],
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await fetchData();
        return hash;
      }
    } catch (err: any) {
      alert(`Trust attestation failed: ${err?.shortMessage || err?.message || err}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-purple-500 selection:text-white relative">
      {/* World-Class Cursor Trail Particle Ribbon */}
      <CursorTrail />

      {/* Top Fixed Navigation: INDEX | DETAIL | PRODUCT | AGENTCARD */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        account={account}
        balance={balance}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Dynamic View Panels */}
      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          {/* TAB 1: INDEX (Option 1: 3D Crystalline Energy Core + 10,000 TPS Speedometer) */}
          {currentView === "INDEX" && (
            <motion.div
              key="view-index"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="w-full"
            >
              {/* Fixed & Prominent 3D Energy Core Hero */}
              <EnergyCoreHero
                onLaunchDApps={() => setCurrentView("PRODUCT")}
                onExploreDetails={() => setCurrentView("DETAIL")}
              />

              {/* Protocol Architecture Bento Highlights */}
              <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-6">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Monad 10,000 TPS Parallel Trust Architecture
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Card 1 */}
                  <div
                    onClick={() => setCurrentView("DETAIL")}
                    className="rounded-3xl p-6 bg-[#131722]/80 border border-white/10 hover:border-purple-500/70 hover:scale-[1.05] hover:-translate-y-2.5 hover:shadow-[0_20px_45px_rgba(168,85,247,0.25)] transition-all duration-300 cursor-pointer group space-y-4 relative overflow-hidden shadow-lg"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-glow group-hover:scale-110 transition-transform">
                      <Network className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg text-white">Trust Constellation Graph</h3>
                        <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Multi-cluster trust weights, AI audit agents &amp; consensus metrics.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-cyan-400">
                      <span>View Detail Topology</span>
                      <span>&rarr;</span>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div
                    onClick={() => setCurrentView("PRODUCT")}
                    className="rounded-3xl p-6 bg-[#131722]/80 border border-white/10 hover:border-cyan-400/70 hover:scale-[1.05] hover:-translate-y-2.5 hover:shadow-[0_20px_45px_rgba(0,242,254,0.25)] transition-all duration-300 cursor-pointer group space-y-4 relative overflow-hidden shadow-lg"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-black font-extrabold shadow-glow group-hover:scale-110 transition-transform">
                      <Shield className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg text-white">Holographic Verification</h3>
                        <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        3D holographic identity badge, staking dashboard &amp; biometric protocol.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-cyan-400">
                      <span>Open Product Studio</span>
                      <span>&rarr;</span>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div
                    onClick={() => setCurrentView("AGENTCARD")}
                    className="rounded-3xl p-6 bg-[#131722]/80 border border-white/10 hover:border-indigo-400/70 hover:scale-[1.05] hover:-translate-y-2.5 hover:shadow-[0_20px_45px_rgba(99,102,241,0.25)] transition-all duration-300 cursor-pointer group space-y-4 relative overflow-hidden shadow-lg"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-glow group-hover:scale-110 transition-transform">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg text-white">AI Card Scanner</h3>
                        <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Full-stack Neural Asset Processor with 6-card circulating digitization.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-purple-400">
                      <span>Launch AI Scanner</span>
                      <span>&rarr;</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: DETAIL (1:1 Replica of Image 2) */}
          {currentView === "DETAIL" && (
            <motion.div
              key="view-detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-2 sm:px-6 py-4"
            >
              <TrustConstellation currentAccount={account} records={records} />
            </motion.div>
          )}

          {/* TAB 3: PRODUCT (1:1 Replica of Image 3 + Web3 Contract Studio) */}
          {currentView === "PRODUCT" && (
            <motion.div
              key="view-product"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-6"
            >
              {/* 1:1 Image 3 Dashboard & Holographic Certs */}
              <ProductStudio
                account={account}
                onStakeAction={() => setContractStudioOpen(true)}
                onRegisterAction={() => setContractStudioOpen(true)}
              />

              {/* Direct On-Chain Contract Studio Drawer/Section */}
              <div className="rounded-3xl bg-[#121622]/90 border border-white/10 p-6 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Shield className="w-5 h-5 text-cyan-400" />
                      <span>Monad On-Chain Smart Contract Attestation</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Direct contract: <code className="text-purple-300">{KOLIANCE_ADDRESS}</code> (Chain ID 10143)
                    </p>
                  </div>

                  <a
                    href={`${monadTestnet.blockExplorers.default.url}/address/${KOLIANCE_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-[#181d2c] border border-white/10 text-xs font-mono text-white hover:border-purple-400 transition flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>Sourcify Verified</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  </a>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <IdentityCard
                    account={account}
                    identity={identity}
                    isLoading={isLoading}
                    onRegister={handleRegister}
                  />

                  <TrustAttestationCard
                    account={account}
                    onAddTrust={handleAddTrust}
                  />
                </div>

                <TrustStream
                  records={records}
                  isLoading={isLoading}
                  onRefresh={fetchData}
                />
              </div>
            </motion.div>
          )}

          {/* TAB 4: MARKET (Yahoo Finance Live Terminal & Gatekeeper) */}
          {currentView === "MARKET" && (
            <motion.div
              key="view-market"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-4"
            >
              <MarketTerminal onTradeAction={() => setCurrentView("DETAIL")} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAB 5: AGENTCARD (Neural Asset Processor / AI Card Scanner - Persistent Warm Canvas) */}
        {hasVisitedAgentCard && (
          <div
            className={`pt-16 w-full h-[calc(100vh-64px)] ${
              currentView === "AGENTCARD" ? "block" : "hidden"
            }`}
          >
            <iframe
              src="/agentcard/index.html"
              className="w-full h-full border-0"
              title="AI Card Scanner // Neural Asset Processor"
            />
          </div>
        )}
      </main>

      {/* Global Footer (shown on INDEX, DETAIL, PRODUCT, MARKET) */}
      {currentView !== "AGENTCARD" && (
        <footer className="border-t border-white/10 py-6 px-4 sm:px-8 mt-12 bg-[#0d1017]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-3">
              <BrandIcon size={24} />
              <span className="font-extrabold text-white tracking-wider">KOLIANCE</span>
              <span className="text-white/20">|</span>
              <span>&copy; {new Date().getFullYear()} Monad Ecosystem Trust Architecture.</span>
            </div>

            <div className="flex items-center gap-5">
              <button onClick={() => setCurrentView("INDEX")} className="hover:text-white transition">
                INDEX
              </button>
              <button onClick={() => setCurrentView("DETAIL")} className="hover:text-white transition">
                DETAIL
              </button>
              <button onClick={() => setCurrentView("PRODUCT")} className="hover:text-white transition">
                PRODUCT
              </button>
              <button onClick={() => setCurrentView("MARKET")} className="hover:text-white transition">
                MARKET
              </button>
              <button onClick={() => setCurrentView("AGENTCARD")} className="text-cyan-400 hover:text-cyan-300 transition">
                AGENTCARD
              </button>
              <a
                href="https://docs.monad.xyz"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition flex items-center gap-1"
              >
                <span>Docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://testnet.monadexplorer.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition flex items-center gap-1"
              >
                <span>Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://github.com/monad-developers/hardhat3-monad"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition flex items-center gap-1"
              >
                <Github className="w-3.5 h-3.5" />
                <span>Hardhat</span>
              </a>
            </div>
          </div>
        </footer>
      )}

      {/* Network Switch Modal */}
      <NetworkModal
        isOpen={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        onSwitch={handleSwitchNetwork}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1017] text-white flex items-center justify-center font-mono">Loading Koliance...</div>}>
      <MainContent />
    </Suspense>
  );
}
