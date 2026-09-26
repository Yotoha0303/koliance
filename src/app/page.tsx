"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  parseAbi,
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
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { HeroGsap } from "@/components/HeroGsap";
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

export default function Home() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState("0.00");
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"identity" | "attest" | "stream" | "architecture">("identity");

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

  const mainSectionRef = useRef<HTMLDivElement>(null);

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
      // 1. Balance
      const bal = await publicClient.getBalance({ address: account });
      setBalance(parseFloat(formatEther(bal)).toFixed(4));

      // 2. Fetch Identity from Koliance contract if contract address configured
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

          // Fetch all records
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
          console.warn("Contract read warning (mock data fallback active):", contractErr);
        }
      }
    } catch (e) {
      console.error("Fetch data error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [account, publicClient]);

  // Initial and reactive effects
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
      } else {
        // Simulated local execution for immediate UI satisfaction
        await new Promise((r) => setTimeout(r, 1200));
        setIdentity({
          exists: true,
          createdAt: BigInt(Math.floor(Date.now() / 1000)),
          metadataHash,
        });
        return "0x7d8fa30113bc30f295bc18b0e774aa1d1290326417fa11c3905e321bf4a0c8b2";
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
      } else {
        // Simulated local record update
        await new Promise((r) => setTimeout(r, 1200));
        const newRecord: TrustRecordData = {
          from: account,
          to,
          action,
          proof,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        };
        setRecords((prev) => [newRecord, ...prev]);
        return "0x91b2c41804e386da6dd4b61a7a24558e8b0108be65e0ebc5cbe82e0e0a5c48b1";
      }
    } catch (err: any) {
      alert(`Trust attestation failed: ${err?.shortMessage || err?.message || err}`);
    }
  };

  const scrollToHub = (tab: "identity" | "attest" | "stream") => {
    setActiveTab(tab);
    mainSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-monad-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        account={account}
        balance={balance}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <main className="flex-1">
        {/* GSAP Hero Section */}
        <HeroGsap
          onRegisterClick={() => scrollToHub("identity")}
          onExploreClick={() => scrollToHub("stream")}
        />

        {/* Interactive Hub Section */}
        <div ref={mainSectionRef} className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
          {/* Framer Motion Tab Switcher */}
          <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl glass-panel max-w-xl mx-auto mb-10 border border-monad-500/20">
            <button
              onClick={() => setActiveTab("identity")}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "identity" ? "text-white" : "text-monad-300/80 hover:text-white"
              }`}
            >
              {activeTab === "identity" && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 shadow-glow"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                Identity Hub
              </span>
            </button>

            <button
              onClick={() => setActiveTab("attest")}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "attest" ? "text-white" : "text-monad-300/80 hover:text-white"
              }`}
            >
              {activeTab === "attest" && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 shadow-glow"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                Add Trust
              </span>
            </button>

            <button
              onClick={() => setActiveTab("stream")}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "stream" ? "text-white" : "text-monad-300/80 hover:text-white"
              }`}
            >
              {activeTab === "stream" && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 shadow-glow"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                Trust Stream
              </span>
            </button>

            <button
              onClick={() => setActiveTab("architecture")}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "architecture" ? "text-white" : "text-monad-300/80 hover:text-white"
              }`}
            >
              {activeTab === "architecture" && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 shadow-glow"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                Go Backend & Arch
              </span>
            </button>
          </div>

          {/* Active Tab Animated Panels */}
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              {activeTab === "identity" && (
                <motion.div
                  key="identity-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <IdentityCard
                    account={account}
                    identity={identity}
                    isLoading={isLoading}
                    onRegister={handleRegister}
                  />
                </motion.div>
              )}

              {activeTab === "attest" && (
                <motion.div
                  key="attest-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <TrustAttestationCard
                    account={account}
                    onAddTrust={handleAddTrust}
                  />
                </motion.div>
              )}

              {activeTab === "stream" && (
                <motion.div
                  key="stream-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <TrustStream
                    records={records}
                    isLoading={isLoading}
                    onRefresh={fetchData}
                  />
                </motion.div>
              )}

              {activeTab === "architecture" && (
                <motion.div
                  key="arch-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-monad-500/30 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-monad-500/20 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-monad-500/20 border border-monad-500/40 flex items-center justify-center text-monad-300">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">Full-Stack Architecture & Go Backend</h4>
                        <p className="text-xs text-monad-200/70 font-mono">
                          Zero-Config Vercel + Monad Testnet + Go High-Speed Indexer
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${backendHealthy ? "bg-emerald-400" : "bg-monad-500/50"}`} />
                      <span className="text-xs font-mono text-monad-300">
                        {backendHealthy ? "Go Service Online" : "Direct RPC Mode"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-monad-950/60 border border-monad-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-monad-300 text-xs font-bold font-mono">
                        <Terminal className="w-4 h-4 text-cyber-accent" />
                        <span>SMART CONTRACT (HARDHAT)</span>
                      </div>
                      <p className="text-xs text-monad-200/70 leading-relaxed">
                        Pre-configured for Monad Testnet (Chain ID 10143) in <code className="text-white">contracts/</code>.
                        Supports single-slot execution, automated Ignition deployments, and Solidity 0.8.31.
                      </p>
                      <div className="text-[11px] font-mono text-monad-400 bg-black/40 p-2 rounded-lg">
                        npx hardhat ignition deploy ignition/modules/Koliance.ts --network monadTestnet
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-monad-950/60 border border-monad-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-monad-300 text-xs font-bold font-mono">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <span>GO BACKEND READY</span>
                      </div>
                      <p className="text-xs text-monad-200/70 leading-relaxed">
                        Standard Go Clean Architecture in <code className="text-white">backend/</code>. Ready to index
                        identity events, cache trust graphs, and serve REST endpoints at microsecond latency.
                      </p>
                      <div className="text-[11px] font-mono text-monad-400 bg-black/40 p-2 rounded-lg">
                        cd backend &amp;&amp; go run cmd/api/main.go
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-monad-950/40 border border-monad-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
                    <div className="text-monad-300">
                      <span className="text-emerald-400 font-bold">Vercel Deployment: </span>
                      Push this repo to GitHub and import into Vercel with zero extra setup!
                    </div>
                    <a
                      href="https://vercel.com/new"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 transition shrink-0"
                    >
                      Deploy to Vercel
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-monad-500/20 py-8 px-4 sm:px-8 mt-20 glass-panel">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-monad-400/80">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">KOLIANCE</span>
            <span>&copy; {new Date().getFullYear()} Monad Ecosystem.</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://docs.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              <span>Monad Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              <span>Monad Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/monad-developers/hardhat3-monad"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Hardhat Monad</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Network Switch Modal */}
      <NetworkModal
        isOpen={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        onSwitch={handleSwitchNetwork}
      />
    </div>
  );
}
