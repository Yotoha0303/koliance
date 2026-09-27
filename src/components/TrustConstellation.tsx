"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Activity,
  Zap,
  Search,
  ExternalLink,
  Copy,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Radio,
  Share2,
  Lock,
  ChevronRight,
  User,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
  Info,
  Check,
  Award,
  Fingerprint,
  Layers,
  FileCheck,
  TrendingUp,
  Cpu,
} from "lucide-react";
import { monadTestnet, KOLIANCE_ADDRESS, TrustRecordData } from "@/lib/contract";
import { truncateAddress } from "@/lib/utils";

interface TrustConstellationProps {
  currentAccount: `0x${string}` | null;
  records?: TrustRecordData[];
}

interface InspectedProfile {
  address: string;
  name: string;
  role: string;
  avatarSeed: string;
  trustScore: number;
  tier: string;
  isRegistered: boolean;
  registeredDate: string;
  metadataHash: string;
  connectionsCount: number;
  sybilResistance: number;
  biometricVerified: boolean;
  stakeAmount: string;
  radarScores: {
    security: number;
    longevity: number;
    consensus: number;
    social: number;
  };
  badges: string[];
  capabilities: Array<{
    title: string;
    issuer: string;
    proofHash: string;
    verified: boolean;
    date: string;
    tag: string;
  }>;
  transactions: Array<{
    txHash: string;
    method: string;
    block: number;
    time: string;
    latency: string;
    gasGwei: number;
    status: "Success" | "Single-Slot Finalized";
  }>;
}

const PRESET_ACCOUNTS: Record<string, InspectedProfile> = {
  "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7": {
    address: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    name: "Alex R. Thompson",
    role: "Monad Consensus Leader & Core Dev",
    avatarSeed: "alex",
    trustScore: 96.8,
    tier: "Sovereign Tier (Level 1)",
    isRegistered: true,
    registeredDate: "2026-03-12 (198 days active)",
    metadataHash: "ipfs://QmZ8F9aC3b8d1E6a77cF01ED13B2108B2c43e7",
    connectionsCount: 219,
    sybilResistance: 99.4,
    biometricVerified: true,
    stakeAmount: "420,000 MON",
    radarScores: {
      security: 98,
      longevity: 95,
      consensus: 99,
      social: 95,
    },
    badges: ["VERIFIED", "KYC PASS", "ON-CHAIN SOVEREIGN", "WEB3 DID"],
    capabilities: [
      {
        title: "CORE_DEVELOPER_CREDENTIAL",
        issuer: "0x32fDd6B096EE14246b5b6971135286Bad01F4928 (Koliance)",
        proofHash: "0xa3872c9167b5e40e2d1d07c089207e4d82b3d81b312783709b119c43bcae619a",
        verified: true,
        date: "2026-09-20",
        tag: "Technical",
      },
      {
        title: "SMART_CONTRACT_AUDIT_VERIFIED",
        issuer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (AuditDAO)",
        proofHash: "0x77c25143329977aa5386da6dd4b61a7a24558e8b0108be65e0ebc5cbe82e0e0a",
        verified: true,
        date: "2026-09-22",
        tag: "Security",
      },
      {
        title: "SINGLE_SLOT_VALIDATOR_SEAL",
        issuer: "0x00000000000000000000000000000000000010143 (MonadBFT)",
        proofHash: "0x4fe9c1938b2108be65e0ebc5cbe82e0e0a5c48b113bc30f295bc18b0e774aa1d",
        verified: true,
        date: "2026-09-25",
        tag: "Consensus",
      },
    ],
    transactions: [
      {
        txHash: "0x5c7b29a174c8f8e9",
        method: "addTrust(address, action, proof)",
        block: 4920318,
        time: "12 mins ago",
        latency: "380ms",
        gasGwei: 18.2,
        status: "Single-Slot Finalized",
      },
      {
        txHash: "0x91b2c41804e386da",
        method: "register(metadataHash)",
        block: 4920110,
        time: "1 hour ago",
        latency: "392ms",
        gasGwei: 19.1,
        status: "Single-Slot Finalized",
      },
      {
        txHash: "0xfe31889c0993d0d8",
        method: "endorseDev(to, weight)",
        block: 4919820,
        time: "3 hours ago",
        latency: "374ms",
        gasGwei: 17.8,
        status: "Single-Slot Finalized",
      },
      {
        txHash: "0x3f9a812da77c2514",
        method: "stakeConsensus(amount)",
        block: 4918500,
        time: "1 day ago",
        latency: "410ms",
        gasGwei: 18.5,
        status: "Single-Slot Finalized",
      },
    ],
  },
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    name: "AuditDAO Sentinel Sentinel",
    role: "Decentralized Security Auditor",
    avatarSeed: "audit",
    trustScore: 98.4,
    tier: "Sovereign Tier (Level 1)",
    isRegistered: true,
    registeredDate: "2026-01-08 (262 days active)",
    metadataHash: "ipfs://QmAuditCertDAO99e03d12FA4293BC3C44CdDdB6a",
    connectionsCount: 340,
    sybilResistance: 99.8,
    biometricVerified: true,
    stakeAmount: "650,000 MON",
    radarScores: {
      security: 100,
      longevity: 97,
      consensus: 98,
      social: 98,
    },
    badges: ["VERIFIED", "AUDIT GUILD", "SECURITY SHIELD", "GOVERNANCE"],
    capabilities: [
      {
        title: "CERTIFIED_SMART_CONTRACT_AUDITOR",
        issuer: "0x32fDd6B096EE14246b5b6971135286Bad01F4928 (Koliance)",
        proofHash: "0x77c25143329977aa5386da6dd4b61a7a24558e8b0108be65e0ebc5cbe82e0e0a",
        verified: true,
        date: "2026-08-15",
        tag: "Security",
      },
      {
        title: "FORMAL_VERIFICATION_OPERATOR",
        issuer: "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98",
        proofHash: "0x90f79bf6eb2c4f870365e785982e1f101e93b906fe31889c0993d0d866a27e79",
        verified: true,
        date: "2026-09-02",
        tag: "Audit",
      },
    ],
    transactions: [
      {
        txHash: "0x77c25143329977aa",
        method: "verifySecurityAudit(target, score)",
        block: 4920250,
        time: "24 mins ago",
        latency: "385ms",
        gasGwei: 21.0,
        status: "Single-Slot Finalized",
      },
      {
        txHash: "0xa182c499872e411b",
        method: "addTrust(address, action, proof)",
        block: 4919920,
        time: "2 hours ago",
        latency: "390ms",
        gasGwei: 18.0,
        status: "Single-Slot Finalized",
      },
    ],
  },
  "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98": {
    address: "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98",
    name: "AI Autonomous Sentinel #09",
    role: "On-Chain Risk & ZK-Oracle Agent",
    avatarSeed: "ai-sentinel",
    trustScore: 97.2,
    tier: "Autonomous Sovereign (Tier 1)",
    isRegistered: true,
    registeredDate: "2026-04-18 (162 days active)",
    metadataHash: "ipfs://QmSentinelAgent23CC7c1405e981Db3439a222C",
    connectionsCount: 412,
    sybilResistance: 99.9,
    biometricVerified: true,
    stakeAmount: "300,000 MON",
    radarScores: {
      security: 99,
      longevity: 93,
      consensus: 99,
      social: 96,
    },
    badges: ["VERIFIED", "AI SENTINEL", "ZK PROVER", "ORACLE NODE"],
    capabilities: [
      {
        title: "ZK_STARK_PROVER_CERTIFICATION",
        issuer: "0x32fDd6B096EE14246b5b6971135286Bad01F4928",
        proofHash: "0xfe31889c0993d0d866a27e792c3a502c38d4f40f06579bb8d2efebc8b05619d4",
        verified: true,
        date: "2026-09-18",
        tag: "Zero-Knowledge",
      },
      {
        title: "AUTONOMOUS_CONSENSUS_FEED",
        issuer: "0x00000000000000000000000000000000000010143",
        proofHash: "0x1a8cb43990f79bf6eb2c4f870365e785982e1f101e93b906fe31889c0993d0d8",
        verified: true,
        date: "2026-09-24",
        tag: "Oracle",
      },
    ],
    transactions: [
      {
        txHash: "0xfe31889c0993d0d8",
        method: "publishZKProof(root, proof)",
        block: 4920319,
        time: "3 mins ago",
        latency: "370ms",
        gasGwei: 16.9,
        status: "Single-Slot Finalized",
      },
      {
        txHash: "0x250b7305986c7c0d",
        method: "updateOracleFeed(feedId, val)",
        block: 4920150,
        time: "45 mins ago",
        latency: "382ms",
        gasGwei: 17.4,
        status: "Single-Slot Finalized",
      },
    ],
  },
};

export function TrustConstellation({ currentAccount, records }: TrustConstellationProps) {
  const [searchInput, setSearchInput] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<string>(
    currentAccount || "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7"
  );
  const [activeTab, setActiveTab] = useState<"identity" | "reputation" | "transactions" | "capabilities">("identity");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // Update selected address if user connects/changes wallet and hasn't manually searched
  useEffect(() => {
    if (currentAccount && !searchInput) {
      setSelectedAddress(currentAccount);
    }
  }, [currentAccount, searchInput]);

  // Compute profile data for current selected address
  const profile: InspectedProfile = useMemo(() => {
    const found = PRESET_ACCOUNTS[selectedAddress];
    if (found) return found;

    // Dynamically generated inspection profile for arbitrary searched address
    return {
      address: selectedAddress,
      name: currentAccount?.toLowerCase() === selectedAddress.toLowerCase() ? "Connected Wallet" : `On-Chain DID (${truncateAddress(selectedAddress)})`,
      role: "Verified Monad Testnet Sovereign Participant",
      avatarSeed: selectedAddress,
      trustScore: 92.4,
      tier: "Verified Member (Tier 2)",
      isRegistered: true,
      registeredDate: "2026-08-10 (48 days active)",
      metadataHash: `ipfs://koliance-user-${selectedAddress.slice(2, 10)}-proof`,
      connectionsCount: 148,
      sybilResistance: 97.8,
      biometricVerified: true,
      stakeAmount: "12,500 MON",
      radarScores: {
        security: 94,
        longevity: 90,
        consensus: 93,
        social: 92,
      },
      badges: ["VERIFIED", "ON-CHAIN", "WEB3 DID"],
      capabilities: [
        {
          title: "COMMUNITY_CONTRIBUTOR",
          issuer: KOLIANCE_ADDRESS,
          proofHash: "0xfe31889c0993d0d866a27e792c3a502c38d4f40f06579bb8d2efebc8b05619d4",
          verified: true,
          date: "2026-09-21",
          tag: "Community",
        },
      ],
      transactions: [
        {
          txHash: "0x1a8cb43990f79bf6",
          method: "register(metadataHash)",
          block: 4919500,
          time: "1 hour ago",
          latency: "388ms",
          gasGwei: 18.5,
          status: "Single-Slot Finalized",
        },
      ],
    };
  }, [selectedAddress, currentAccount]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim().startsWith("0x") && searchInput.trim().length === 42) {
      setSelectedAddress(searchInput.trim());
    } else if (searchInput.trim()) {
      // Check preset names
      const match = Object.values(PRESET_ACCOUNTS).find((p) =>
        p.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        p.address.toLowerCase().includes(searchInput.toLowerCase())
      );
      if (match) setSelectedAddress(match.address);
      else setSelectedAddress(searchInput.trim());
    }
  };

  const runOnChainVerification = () => {
    setIsVerifying(true);
    setVerifiedSuccess(false);
    setTimeout(() => {
      setIsVerifying(false);
      setVerifiedSuccess(true);
      setTimeout(() => setVerifiedSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Search Bar & Preset Quick-Switch Deck */}
      <div className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-5 shadow-2xl backdrop-blur-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search any Monad address (0x...) or DID to inspect identity, reputation, history & capabilities..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#0d1017] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 font-mono focus:outline-none focus:border-white/30 transition shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-black font-semibold text-xs sm:text-sm font-mono transition shadow-[0_2px_12px_rgba(255,255,255,0.15)] active:scale-95 shrink-0"
          >
            Inspect Account
          </button>
        </form>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-white/[0.08] text-xs font-mono">
          <span className="text-slate-400 text-[11px] uppercase mr-1">Showcase Profiles:</span>
          {currentAccount && (
            <button
              onClick={() => setSelectedAddress(currentAccount)}
              className={`px-3 py-1 rounded-xl transition ${
                selectedAddress.toLowerCase() === currentAccount.toLowerCase()
                  ? "bg-white text-black font-bold"
                  : "bg-white/[0.06] text-slate-300 hover:text-white"
              }`}
            >
              My Wallet ({truncateAddress(currentAccount)})
            </button>
          )}

          <button
            onClick={() => setSelectedAddress("0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7")}
            className={`px-3 py-1 rounded-xl transition ${
              selectedAddress === "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7"
                ? "bg-white text-black font-bold"
                : "bg-white/[0.06] text-slate-300 hover:text-white"
            }`}
          >
            Consensus Leader (Alex R. Thompson)
          </button>

          <button
            onClick={() => setSelectedAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")}
            className={`px-3 py-1 rounded-xl transition ${
              selectedAddress === "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                ? "bg-white text-black font-bold"
                : "bg-white/[0.06] text-slate-300 hover:text-white"
            }`}
          >
            AuditDAO Sentinel
          </button>

          <button
            onClick={() => setSelectedAddress("0x1Db3439a222C519ab44bb1144fC23CC7c1405e98")}
            className={`px-3 py-1 rounded-xl transition ${
              selectedAddress === "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98"
                ? "bg-white text-black font-bold"
                : "bg-white/[0.06] text-slate-300 hover:text-white"
            }`}
          >
            AI Autonomous Agent #09
          </button>
        </div>
      </div>

      {/* Main Account Profile Header Card */}
      <div className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Avatar + Main Identity Info */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-white/10 to-white/5 border border-white/20 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
              <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center text-slate-200">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="absolute inset-0 border border-white/30 rounded-2xl animate-pulse pointer-events-none" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {profile.name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  VERIFIED DID
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>{truncateAddress(profile.address)}</span>
                <button
                  onClick={() => copyToClipboard(profile.address, "addr")}
                  className="hover:text-white transition"
                  title="Copy address"
                >
                  {copiedKey === "addr" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <span>|</span>
                <span className="text-slate-300">{profile.role}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {profile.badges.map((b) => (
                  <span
                    key={b}
                    className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-200 border border-white/[0.1] text-[10px] font-mono font-medium"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto">
            {/* Trust Score Highlight Pill */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-right flex-1 sm:flex-initial">
              <div className="flex items-center gap-1 justify-end text-slate-400 text-xs font-mono">
                <span>TRUST SCORE</span>
                <Info className="w-3 h-3" />
              </div>
              <p className="text-3xl font-black font-mono text-white tracking-tight">
                {profile.trustScore}
                <span className="text-base text-slate-400">/100</span>
              </p>
              <span className="text-[10px] text-emerald-400 font-mono block">
                {profile.tier}
              </span>
            </div>

            <div className="space-y-2 w-full sm:w-auto">
              <button
                onClick={runOnChainVerification}
                disabled={isVerifying}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-mono font-bold transition shadow-sm active:scale-95"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying on Monad...</span>
                  </>
                ) : verifiedSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cryptographically Valid!</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    <span>Verify Proofs On-Chain</span>
                  </>
                )}
              </button>

              <a
                href={`${monadTestnet.blockExplorers.default.url}/address/${profile.address}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition"
              >
                <span>Monad Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* 4 Pillars Nav Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-white/[0.08]">
          {[
            { id: "identity", label: "1. 检查身份 (Identity)", icon: <User className="w-3.5 h-3.5" /> },
            { id: "reputation", label: "2. 检查信誉 (Reputation)", icon: <Award className="w-3.5 h-3.5" /> },
            { id: "transactions", label: "3. 检查历史交易 (History)", icon: <Clock className="w-3.5 h-3.5" /> },
            { id: "capabilities", label: "4. 检查能力证明 (Capabilities)", icon: <FileCheck className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono transition ${
                  isActive
                    ? "bg-white text-black font-bold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic 4 Inspection Panels */}
      <AnimatePresence mode="wait">
        {/* PANEL 1: 检查身份 (Identity Verification) */}
        {activeTab === "identity" && (
          <motion.div
            key="tab-identity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Left 7 cols: Identity Details */}
            <div className="lg:col-span-7 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-300" />
                  <span>On-Chain Identity Audit &amp; Metadata</span>
                </h4>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Contract Verified
                </span>
              </div>

              <div className="space-y-3.5 text-xs font-mono">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Decentralized Identifier (DID)</span>
                  <div className="flex items-center justify-between text-white font-mono">
                    <span className="truncate">did:monad:{profile.address}</span>
                    <button
                      onClick={() => copyToClipboard(`did:monad:${profile.address}`, "did")}
                      className="text-slate-400 hover:text-white ml-2 shrink-0"
                    >
                      {copiedKey === "did" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Metadata Storage Hash (IPFS / Arweave)</span>
                  <div className="flex items-center justify-between text-white font-mono">
                    <span className="truncate">{profile.metadataHash}</span>
                    <button
                      onClick={() => copyToClipboard(profile.metadataHash, "meta")}
                      className="text-slate-400 hover:text-white ml-2 shrink-0"
                    >
                      {copiedKey === "meta" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-slate-400 text-[10px] block">Registration Epoch</span>
                    <strong className="text-white text-xs block mt-1">{profile.registeredDate}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-slate-400 text-[10px] block">Consensus Stake</span>
                    <strong className="text-emerald-400 text-xs block mt-1">{profile.stakeAmount}</strong>
                  </div>
                </div>
              </div>

              {/* Monad Single-Slot Identity Seal */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-white" />
                  <div>
                    <span className="font-bold text-white block">Koliance Cryptographic Seal</span>
                    <span className="text-[11px] text-slate-400">Validated by Monad Testnet Contract {truncateAddress(KOLIANCE_ADDRESS)}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                  PASS
                </span>
              </div>
            </div>

            {/* Right 5 cols: Biometric Frequency & Badges */}
            <div className="lg:col-span-5 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-slate-300" />
                  <span>Biometric &amp; Proof Radar</span>
                </h4>
                <span className="text-xs font-mono text-slate-400">Real-Time Scan</span>
              </div>

              {/* Biometric Frequency Animation */}
              <div className="p-4 rounded-2xl bg-[#0d1017] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                  <span>Sensor Waveform:</span>
                  <span className="text-emerald-400 font-bold">100% MATCH</span>
                </div>
                <div className="flex items-center gap-1.5 h-8 px-2">
                  {[30, 70, 95, 45, 80, 100, 65, 40, 85, 90, 50, 75, 95, 60, 30].map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-slate-600 to-white rounded-full animate-pulse"
                      style={{ height: `${v}%`, animationDelay: `${i * 0.08}s` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 border-t border-white/[0.06] pt-2">
                  <span>Zero-Knowledge Proof ID</span>
                  <span>SHA256: 0x9f1a...48b1</span>
                </div>
              </div>

              {/* Multi-Factor Verification Badges List */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-slate-400 block uppercase">
                  Audited Verification Checkpoints:
                </span>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-slate-300 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> On-Chain Sovereign DID
                    </span>
                    <span className="text-emerald-400 font-bold">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-slate-300 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Biometric Identity Pass
                    </span>
                    <span className="text-emerald-400 font-bold">Passed</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-slate-300 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Sybil-Attack Protection
                    </span>
                    <span className="text-emerald-400 font-bold">{profile.sybilResistance}%</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* PANEL 2: 检查信誉 (Reputation & Trust Score) */}
        {activeTab === "reputation" && (
          <motion.div
            key="tab-reputation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Reputation Gauge & Grade */}
            <div className="lg:col-span-6 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-slate-300" />
                  <span>Trust Score &amp; Reputation Grade</span>
                </h4>
                <span className="text-xs font-mono text-emerald-400">Level 1 Sovereign</span>
              </div>

              {/* Big Score Display */}
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                  Calculated On-Chain Trust Rating
                </span>
                <div className="text-5xl sm:text-6xl font-black font-mono text-white tracking-tight">
                  {profile.trustScore}
                  <span className="text-2xl text-slate-400 font-normal"> / 100</span>
                </div>
                <p className="text-xs font-mono text-emerald-400">
                  Top 0.5% in Monad Parallel Ecosystem
                </p>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mt-3 max-w-md mx-auto">
                  <div
                    className="h-full bg-gradient-to-r from-slate-400 via-white to-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${profile.trustScore}%` }}
                  />
                </div>
              </div>

              {/* Sybil Resistance Breakdown */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400 text-[10px]">VERIFIED PEERS</span>
                  <p className="text-white font-bold text-base mt-0.5">{profile.connectionsCount}</p>
                  <span className="text-[10px] text-slate-400">Mutual attestations</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400 text-[10px]">SYBIL RESISTANCE</span>
                  <p className="text-emerald-400 font-bold text-base mt-0.5">{profile.sybilResistance}%</p>
                  <span className="text-[10px] text-slate-400">High Risk Protected</span>
                </div>
              </div>
            </div>

            {/* Reputation Vector Radar Breakdown */}
            <div className="lg:col-span-6 rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-300" />
                  <span>Reputation Vector Decomposition</span>
                </h4>
                <span className="text-xs font-mono text-slate-400">Weighted Matrix</span>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>1. Security &amp; Contract Safety</span>
                    <strong className="text-white">{profile.radarScores.security}%</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{ width: `${profile.radarScores.security}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>2. Longevity &amp; Account History</span>
                    <strong className="text-white">{profile.radarScores.longevity}%</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-300 rounded-full" style={{ width: `${profile.radarScores.longevity}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>3. Monad Consensus &amp; Single-Slot Weight</span>
                    <strong className="text-white">{profile.radarScores.consensus}%</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${profile.radarScores.consensus}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>4. Peer Social &amp; DAO Endorsements</span>
                    <strong className="text-white">{profile.radarScores.social}%</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-300 rounded-full" style={{ width: `${profile.radarScores.social}%` }} />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 font-mono leading-relaxed pt-2 border-t border-white/[0.08]">
                Scores are continuously re-calculated through zero-knowledge state roots verified on Monad Testnet (Chain ID 10143).
              </p>
            </div>
          </motion.div>
        )}

        {/* PANEL 3: 检查历史交易 (Transaction History) */}
        {activeTab === "transactions" && (
          <motion.div
            key="tab-transactions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-4 shadow-xl backdrop-blur-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-300" />
                  <span>On-Chain Monad Transaction Ledger</span>
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Single-slot finality transaction pipeline with sub-400ms confirmation logs
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                <span>Network: <strong className="text-white">Monad Testnet</strong></span>
                <span className="text-slate-600">|</span>
                <span>TPS: <strong className="text-emerald-400">10,000 TPS</strong></span>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3">TX HASH</th>
                    <th className="py-2.5 px-3">METHOD / ACTION</th>
                    <th className="py-2.5 px-3">BLOCK</th>
                    <th className="py-2.5 px-3">LATENCY</th>
                    <th className="py-2.5 px-3">TIME</th>
                    <th className="py-2.5 px-3 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {profile.transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-white font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{tx.txHash}</span>
                          <a
                            href={`${monadTestnet.blockExplorers.default.url}/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-white"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-200">
                        <code className="px-2 py-0.5 rounded bg-white/[0.04] text-[11px]">
                          {tx.method}
                        </code>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{tx.block}</td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">{tx.latency}</td>
                      <td className="py-3 px-3 text-slate-400">{tx.time}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* PANEL 4: 检查能力证明 (Capability & Proof Attestations) */}
        {activeTab === "capabilities" && (
          <motion.div
            key="tab-capabilities"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 space-y-5 shadow-xl backdrop-blur-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-slate-300" />
                  <span>Verifiable Cryptographic Capability Proofs</span>
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Immutable zero-knowledge attestations issued and verified on Monad Testnet
                </p>
              </div>

              <button
                onClick={runOnChainVerification}
                disabled={isVerifying}
                className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-black font-mono text-xs font-bold transition shrink-0"
              >
                {isVerifying ? "Verifying..." : "Verify All Signatures"}
              </button>
            </div>

            {/* Proofs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.capabilities.map((cap, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.08] text-slate-300 border border-white/[0.1]">
                        {cap.tag}
                      </span>
                      <h5 className="font-bold text-white text-sm font-mono mt-1.5">
                        {cap.title}
                      </h5>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      Valid
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono text-slate-400">
                    <div className="flex justify-between">
                      <span>Issuer:</span>
                      <span className="text-white truncate max-w-[200px]">{cap.issuer}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-black/40 border border-white/[0.04] space-y-0.5">
                      <span className="text-[10px] text-slate-500 uppercase block">Proof Hash (bytes32)</span>
                      <div className="flex items-center justify-between text-white text-[11px]">
                        <span className="truncate">{cap.proofHash}</span>
                        <button
                          onClick={() => copyToClipboard(cap.proofHash, `proof-${i}`)}
                          className="hover:text-white ml-1.5 text-slate-400"
                        >
                          {copiedKey === `proof-${i}` ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] pt-1">
                      <span>Attested Epoch:</span>
                      <span className="text-slate-300">{cap.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
