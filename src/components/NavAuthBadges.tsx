"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  Gamepad2,
  ChevronDown,
  CheckCircle2,
  LogOut,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  User,
  Mail,
  Loader2,
  Edit3,
  Wallet,
  Send,
  Copy,
  Link2,
  Coins,
} from "lucide-react";
import Image from "next/image";
import { createPublicClient, http, fallback, formatEther } from "viem";
import { GOOGLE_CLIENT_ID } from "@/lib/authConfig";
import { EditProfileModal, UserProfileData } from "@/components/EditProfileModal";
import { TransferModal } from "@/components/TransferModal";
import { monadTestnet, KOL_TOKEN_ADDRESS, KOL_TOKEN_ABI } from "@/lib/contract";
import { truncateAddress } from "@/lib/utils";

interface NavAuthBadgesProps {
  walletAddress?: string | null;
  balance?: string;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
}

export function NavAuthBadges({
  walletAddress,
  balance = "0.00",
  onConnectWallet,
  onDisconnectWallet,
}: NavAuthBadgesProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferCurrency, setTransferCurrency] = useState<"KOL" | "MON">("KOL");
  const [kolBalance, setKolBalance] = useState("0.00");
  const [copied, setCopied] = useState(false);

  // Fetch KOL Token balance for the connected wallet
  useEffect(() => {
    if (!walletAddress) {
      setKolBalance("0.00");
      return;
    }
    const fetchBalance = async () => {
      try {
        const client = createPublicClient({
          chain: monadTestnet,
          transport: fallback([
            http("https://monad-testnet.drpc.org"),
            http("https://testnet-rpc.monad.xyz"),
          ]),
        });
        const bal = await client.readContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        });
        setKolBalance(parseFloat(formatEther(bal)).toFixed(4));
      } catch (err) {
        console.error("Failed to load KOL balance in navbar:", err);
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Auth states stored in localStorage
  const [googleUser, setGoogleUser] = useState<{
    id: string;
    name: string;
    email: string;
    picture?: string | null;
    bio?: string | null;
    walletAddress?: string | null;
    tier: string;
    creditAllowanceUSD?: number;
  } | null>(null);

  const [githubUser, setGithubUser] = useState<{
    username: string;
    avatarUrl?: string;
    tier: string;
  } | null>(null);

  const [steamUser, setSteamUser] = useState<{
    steamId: string;
    personaName?: string;
    avatar?: string;
  } | null>(null);

  // Sync state on mount & listen to window events
  const syncAuthState = () => {
    try {
      const gRaw = localStorage.getItem("koliance_google_profile");
      if (gRaw) {
        const g = JSON.parse(gRaw);
        setGoogleUser({
          id: g.id || `did:koliance:google:${g.googleId || "user"}`,
          name: g.name,
          email: g.email,
          picture: g.picture,
          bio: g.bio,
          walletAddress: g.walletAddress || g.wallet_address,
          tier: g.trustTier || "GOOGLE VERIFIED CITIZEN",
          creditAllowanceUSD: g.creditAllowanceUSD || 1200,
        });
      } else {
        setGoogleUser(null);
      }

      const ghRaw = localStorage.getItem("koliance_github_user");
      if (ghRaw) {
        const gh = JSON.parse(ghRaw);
        setGithubUser({
          username: gh.username || gh.login,
          avatarUrl: gh.avatarUrl || gh.avatar_url,
          tier: gh.buidlTier || "BUIDLER",
        });
      } else {
        setGithubUser(null);
      }

      const stId = localStorage.getItem("koliance_steam_id");
      if (stId) {
        setSteamUser({
          steamId: stId,
          personaName: `Steam:${stId.slice(-6)}`,
        });
      } else {
        setSteamUser(null);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    syncAuthState();
    const handleStorage = () => syncAuthState();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // 1. Google 1-Click Login Trigger
  const handleGoogleLogin = () => {
    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent("https://koliance.oodai.space");
    const scope = encodeURIComponent("openid email profile");
    const state = encodeURIComponent(
      JSON.stringify({
        origin: window.location.origin,
        path: window.location.pathname || "/",
        timestamp: Date.now(),
      })
    );
    window.location.href = `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;
  };

  // 2. GitHub 1-Click Login Trigger
  const handleGithubLogin = () => {
    // Server route sets the httpOnly CSRF nonce cookie, then redirects to GitHub.
    const qs = new URLSearchParams({ path: window.location.pathname || "/" });
    window.location.href = `/api/auth/github/start?${qs.toString()}`;
  };

  // 3. Steam OpenID 2.0 1-Click Redirect
  const handleSteamLogin = () => {
    const returnUrl = encodeURIComponent(`${window.location.origin}/agentcard`);
    const realm = encodeURIComponent(window.location.origin);
    window.location.href = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${returnUrl}&openid.realm=${realm}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
  };

  // Quick Instant Demo Login for Testing (One-click Google + GitHub verify)
  const handleInstantGoogleDemo = () => {
    const demo = {
      googleId: "109842839210492819283",
      email: "alexander.dev@google.com",
      emailVerified: true,
      name: "Alexander Monad Core",
      picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      walletAddress: walletAddress || "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      trustTier: "GOOGLE VERIFIED ARCHITECT",
      creditAllowanceUSD: 1200,
    };
    localStorage.setItem("koliance_google_profile", JSON.stringify(demo));
    syncAuthState();
    setDropdownOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Active wallet is either bound wallet or connected wallet
  const effectiveWallet = walletAddress || googleUser?.walletAddress;

  return (
    <div className="relative">
      {/* Top-Right Account Pill Button (Solid, 100% Opaque High-End Tech Dark) */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-2xl bg-[#141824] hover:bg-[#1a2032] border border-white/20 hover:border-blue-400 text-xs font-mono text-white transition-all select-none shadow-lg active:scale-95 group"
      >
        {/* User Avatar Circle */}
        <div className="w-6 h-6 rounded-full overflow-hidden border border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)] relative bg-[#1c2438] flex items-center justify-center shrink-0">
          {googleUser?.picture ? (
            <Image
              src={googleUser.picture}
              alt={googleUser.name || "User Avatar"}
              width={24}
              height={24}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-3.5 h-3.5 text-blue-300" />
          )}
        </div>

        {/* User Identity / Display Name */}
        <div className="flex flex-col text-left leading-tight">
          <span className="font-sans font-semibold text-white text-xs truncate max-w-[85px] sm:max-w-[110px]">
            {googleUser ? googleUser.name : "个人中心"}
          </span>
          <span className="text-[9px] font-mono text-slate-300 flex items-center gap-1">
            {effectiveWallet ? (
              <span className="text-emerald-400 font-semibold">{truncateAddress(effectiveWallet)}</span>
            ) : (
              <span>编辑资料 / 账户</span>
            )}
          </span>
        </div>

        {/* Small Action indicator */}
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#222a42] text-slate-200 border border-white/20 group-hover:bg-blue-600 group-hover:text-white transition hidden sm:inline">
          编辑资料
        </span>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 group-hover:text-white transition" />
      </button>

      {/* Floating Integrated Account & Profile Center (Solid 100% Opaque #101420 Container) */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl bg-[#101420] border border-white/25 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] z-50 text-white space-y-3"
          >
            {/* 1. User Header & Edit Profile Action */}
            <div className="p-3 rounded-xl bg-[#172036] border border-blue-500/40 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-blue-400 bg-[#1c2438] flex items-center justify-center shrink-0">
                    {googleUser?.picture ? (
                      <Image
                        src={googleUser.picture}
                        alt={googleUser.name || "User Avatar"}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-blue-300" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <span className="truncate max-w-[130px]">{googleUser?.name || "Koliance 开发者"}</span>
                      {googleUser && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 truncate max-w-[150px]">
                      {googleUser?.email || "未登录谷歌账户"}
                    </div>
                  </div>
                </div>

                {/* Edit Profile Button */}
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setEditModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 border border-blue-400/50 text-[11px] font-mono text-white flex items-center gap-1 font-semibold transition shadow-md active:scale-95"
                >
                  <Edit3 className="w-3 h-3 text-white" />
                  <span>编辑资料</span>
                </button>
              </div>

              {/* Bio summary if present */}
              {googleUser?.bio && (
                <p className="text-[10px] text-slate-300 font-sans italic line-clamp-1 border-t border-white/10 pt-1.5">
                  &ldquo;{googleUser.bio}&rdquo;
                </p>
              )}
            </div>

            {/* 2. Web3 Wallet & Onchain Transfer Section */}
            <div className="p-3 rounded-xl bg-[#151a28] border border-white/20 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white flex items-center gap-1.5 font-bold">
                  <Wallet className="w-4 h-4 text-purple-400" />
                  <span>Monad 链上钱包</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className="text-[10px] text-purple-300 font-bold bg-purple-950/60 border border-purple-500/50 px-2 py-0.5 rounded-full">
                    {walletAddress ? `${kolBalance} KOL` : "未连接"}
                  </span>
                  <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 border border-emerald-500/50 px-2 py-0.5 rounded-full">
                    {walletAddress ? `${balance} MON` : "未连接"}
                  </span>
                </div>
              </div>

              {walletAddress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1018] border border-white/15 text-xs font-mono">
                    <span className="text-slate-100 font-semibold">{truncateAddress(walletAddress)}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyToClipboard(walletAddress)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#20273c] hover:bg-[#2c3652] text-slate-200 hover:text-white transition flex items-center gap-1 border border-white/10"
                        title="复制地址"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copied ? "已复制" : "复制"}</span>
                      </button>
                      <a
                        href={`${monadTestnet.blockExplorers.default.url}/address/${walletAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] p-1 rounded bg-[#20273c] hover:bg-[#2c3652] text-slate-200 hover:text-white transition border border-white/10"
                        title="在区块浏览器查看"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Wallet Action Buttons: Transfer KOL, Transfer MON & Disconnect */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      onClick={() => {
                        setTransferCurrency("KOL");
                        setDropdownOpen(false);
                        setTransferModalOpen(true);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-mono font-semibold transition flex items-center justify-center gap-1 shadow-md active:scale-95 border border-purple-400/40"
                    >
                      <Coins className="w-3 h-3 text-purple-200" />
                      <span>转账 KOL</span>
                    </button>
                    <button
                      onClick={() => {
                        setTransferCurrency("MON");
                        setDropdownOpen(false);
                        setTransferModalOpen(true);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-mono font-semibold transition flex items-center justify-center gap-1 shadow-md active:scale-95 border border-emerald-400/40"
                    >
                      <Send className="w-3 h-3 text-emerald-200" />
                      <span>转账 MON</span>
                    </button>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onDisconnectWallet?.();
                      }}
                      className="py-1.5 px-2 rounded-lg bg-[#2a1720] hover:bg-[#3d1f2d] border border-red-500/40 text-red-300 text-[11px] font-mono transition flex items-center justify-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>断开</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-300 font-sans">
                    连接 Monad 钱包以进行链上转账、资产抵押与信用背书。
                  </p>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onConnectWallet?.();
                    }}
                    className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-black font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Wallet className="w-3.5 h-3.5 text-black" />
                    <span>立即连接钱包 (Connect Wallet)</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Identity Credential Badges (Google, GitHub, Steam) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-200 px-0.5">
                <span className="flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>多轨身份背书与授信</span>
                </span>
                <span className="text-[9px] text-emerald-300 font-mono bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">额度增强</span>
              </div>

              {/* Google Row */}
              <div className="p-2.5 rounded-xl bg-[#151a28] border border-white/15 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.2C3.7 20 7.5 23.2 12 23.2z" />
                  </svg>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <span>Google 认证</span>
                      {googleUser && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 truncate max-w-[130px]">
                      {googleUser ? googleUser.email : "+$1,200 USD 授信"}
                    </div>
                  </div>
                </div>
                {googleUser ? (
                  <button
                    onClick={() => {
                      localStorage.removeItem("koliance_google_profile");
                      syncAuthState();
                    }}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-[#2a1720] hover:bg-[#3d1f2d] text-red-300 border border-red-500/40 transition"
                  >
                    解除
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleGoogleLogin}
                      className="text-[10px] font-mono px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-sm"
                    >
                      登录
                    </button>
                    <button
                      onClick={handleInstantGoogleDemo}
                      title="模拟登录"
                      className="p-1 rounded bg-[#222a42] hover:bg-[#2c3652] text-slate-200 border border-white/10"
                    >
                      <Sparkles className="w-3 h-3 text-blue-300" />
                    </button>
                  </div>
                )}
              </div>

              {/* GitHub Row */}
              <div className="p-2.5 rounded-xl bg-[#151a28] border border-white/15 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-white" />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <span>GitHub BUIDL</span>
                      {githubUser && <CheckCircle2 className="w-3 h-3 text-indigo-400" />}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 truncate max-w-[130px]">
                      {githubUser ? `@${githubUser.username}` : "+$1,000 USD 授信"}
                    </div>
                  </div>
                </div>
                {githubUser ? (
                  <button
                    onClick={() => {
                      localStorage.removeItem("koliance_github_user");
                      syncAuthState();
                    }}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-[#2a1720] hover:bg-[#3d1f2d] text-red-300 border border-red-500/40 transition"
                  >
                    解除
                  </button>
                ) : (
                  <button
                    onClick={handleGithubLogin}
                    className="text-[10px] font-mono px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm"
                  >
                    授权
                  </button>
                )}
              </div>

              {/* Steam Row */}
              <div className="p-2.5 rounded-xl bg-[#151a28] border border-white/15 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <span>Steam 游戏时长</span>
                      {steamUser && <CheckCircle2 className="w-3 h-3 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 truncate max-w-[130px]">
                      {steamUser ? steamUser.personaName : "+$800 USD 授信"}
                    </div>
                  </div>
                </div>
                {steamUser ? (
                  <button
                    onClick={() => {
                      localStorage.removeItem("koliance_steam_id");
                      syncAuthState();
                    }}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-[#2a1720] hover:bg-[#3d1f2d] text-red-300 border border-red-500/40 transition"
                  >
                    解除
                  </button>
                ) : (
                  <button
                    onClick={handleSteamLogin}
                    className="text-[10px] font-mono px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-sm"
                  >
                    绑定
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Koliance 统一账户与资产中心</span>
              <button
                onClick={() => setDropdownOpen(false)}
                className="hover:text-white transition"
              >
                收起
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={{
          id: googleUser?.id || "did:koliance:guest",
          email: googleUser?.email || "developer@koliance.io",
          name: googleUser?.name || "开发者",
          picture: googleUser?.picture || null,
          bio: googleUser?.bio || "Koliance Web3 & AI Identity",
          walletAddress: googleUser?.walletAddress || walletAddress,
          trustTier: googleUser?.tier || "DEVELOPER",
          creditAllowanceUSD: googleUser?.creditAllowanceUSD || 1200,
        }}
        walletAddress={walletAddress}
        onProfileUpdated={(updated) => {
          setGoogleUser({
            id: updated.id,
            name: updated.name,
            email: updated.email,
            picture: updated.picture,
            bio: updated.bio,
            walletAddress: updated.walletAddress,
            tier: updated.trustTier || "GOOGLE VERIFIED CITIZEN",
            creditAllowanceUSD: updated.creditAllowanceUSD,
          });
        }}
      />

      {/* Transfer Modal for Monad KOL & MON */}
      {effectiveWallet && (
        <TransferModal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          senderAddress={effectiveWallet}
          balance={balance}
          initialCurrency={transferCurrency}
        />
      )}
    </div>
  );
}
