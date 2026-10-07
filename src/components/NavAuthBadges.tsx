"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
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
} from "lucide-react";
import Image from "next/image";
import { GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID } from "@/lib/authConfig";
import { EditProfileModal, UserProfileData } from "@/components/EditProfileModal";

interface NavAuthBadgesProps {
  walletAddress?: string | null;
}

export function NavAuthBadges({ walletAddress }: NavAuthBadgesProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);

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
          tier: g.trustTier || "GOOGLE ARCHITECT",
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
    const clientId =
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || GITHUB_CLIENT_ID;
    const state = encodeURIComponent(
      btoa(
        JSON.stringify({
          origin: window.location.origin,
          path: window.location.pathname || "/",
          t: Date.now(),
        })
      )
    );
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&prompt=select_account&scope=read:user&state=${state}`;
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

  const hasAnyAuth = !!(googleUser || githubUser || steamUser);

  return (
    <div className="relative">
      {/* Trigger Button: shows connected avatars/badges or Login entry */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] hover:border-white/25 text-xs font-mono text-slate-200 transition-all select-none shadow-sm active:scale-95"
      >
        {/* If User is Logged In (Google / Platform User) -> Prominent User Avatar & Profile Chip */}
        {googleUser ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-blue-400/80 shadow-[0_0_8px_rgba(59,130,246,0.35)] relative bg-blue-500/20 flex items-center justify-center shrink-0">
              {googleUser.picture ? (
                <Image
                  src={googleUser.picture}
                  alt={googleUser.name}
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-blue-300" />
              )}
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-sans font-semibold text-white text-xs truncate max-w-[90px] sm:max-w-[120px]">
                {googleUser.name || "开发者"}
              </span>
              <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> 已认证
              </span>
            </div>
          </div>
        ) : (
          /* When NOT logged in: Prominent User Icon + Platform Badges */
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-white/[0.08] border border-white/20 flex items-center justify-center text-slate-300">
              <User className="w-3 h-3 text-white" />
            </div>

            {/* Google Status Icon */}
            <div className="w-4 h-4 rounded-full bg-white/[0.06] flex items-center justify-center">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.2C3.7 20 7.5 23.2 12 23.2z"
                />
              </svg>
            </div>

            {/* GitHub Status Icon */}
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                githubUser ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/40" : "bg-white/[0.06] text-slate-400"
              }`}
            >
              <Github className="w-2.5 h-2.5" />
            </div>

            {/* Steam Status Icon */}
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                steamUser ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40" : "bg-white/[0.06] text-slate-400"
              }`}
            >
              <Gamepad2 className="w-2.5 h-2.5" />
            </div>

            <span className="hidden md:inline font-sans font-medium text-xs text-slate-200 ml-0.5">
              {hasAnyAuth ? "已认证背书" : "登录 / 背书"}
            </span>
          </div>
        )}

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
      </button>

      {/* Floating Identity & Login Menu */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#141824]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl z-50 text-white space-y-2.5"
          >
            {/* If Google User is logged in: Dedicated Profile Overview Card */}
            {googleUser && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20 border border-blue-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-blue-400/80 bg-blue-500/20 flex items-center justify-center shrink-0">
                      {googleUser.picture ? (
                        <Image
                          src={googleUser.picture}
                          alt={googleUser.name}
                          width={36}
                          height={36}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-blue-300" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{googleUser.name || "Koliance 开发者"}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 truncate max-w-[150px]">
                        {googleUser.email}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setEditModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-[11px] font-mono text-blue-200 flex items-center gap-1 transition shadow-sm active:scale-95"
                  >
                    <Edit3 className="w-3 h-3 text-blue-300" />
                    <span>编辑资料</span>
                  </button>
                </div>

                {/* Bound Wallet Badge & Bio */}
                <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">已绑定钱包:</span>
                  <span className="text-blue-300 font-bold">
                    {googleUser.walletAddress || walletAddress
                      ? `${(googleUser.walletAddress || walletAddress)?.slice(0, 6)}...${(googleUser.walletAddress || walletAddress)?.slice(-4)}`
                      : "未绑定 (点击编辑绑定)"}
                  </span>
                </div>
              </div>
            )}

            {/* Header info */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Web2-&gt;Web3 身份信誉凭证</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                额度增强
              </span>
            </div>

            {/* 1. Google Section */}
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-blue-500/40 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.2C3.7 20 7.5 23.2 12 23.2z"
                    />
                  </svg>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Google 开发者登录</span>
                      {googleUser && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate max-w-[160px]">
                      {googleUser ? googleUser.email : "+$1,200 USD 授信"}
                    </div>
                  </div>
                </div>

                {googleUser ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setEditModalOpen(true);
                      }}
                      className="text-[10px] font-mono px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 transition flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>资料</span>
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem("koliance_google_profile");
                        syncAuthState();
                      }}
                      className="text-[10px] font-mono px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition"
                    >
                      解除
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleGoogleLogin}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-sm"
                    >
                      登录
                    </button>
                    <button
                      onClick={handleInstantGoogleDemo}
                      title="快速模拟验证"
                      className="text-[10px] font-mono p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
                    >
                      <Sparkles className="w-3 h-3 text-blue-300" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. GitHub Section */}
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-slate-200" />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>GitHub BUIDL 背书</span>
                      {githubUser && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate max-w-[160px]">
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
                    className="text-[10px] font-mono px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition"
                  >
                    解除
                  </button>
                ) : (
                  <button
                    onClick={handleGithubLogin}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm"
                  >
                    授权
                  </button>
                )}
              </div>
            </div>

            {/* 3. Steam Section */}
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Steam 游戏时长认证</span>
                      {steamUser && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate max-w-[160px]">
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
                    className="text-[10px] font-mono px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition"
                  >
                    解除
                  </button>
                ) : (
                  <button
                    onClick={handleSteamLogin}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-sm"
                  >
                    绑定
                  </button>
                )}
              </div>
            </div>

            {/* Close / Action footer */}
            <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>三轨背书实时汇入 AgentCard</span>
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

      {/* Edit Profile Modal for Google / Platform User */}
      {googleUser && (
        <EditProfileModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          profile={{
            id: googleUser.id,
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture,
            bio: googleUser.bio,
            walletAddress: googleUser.walletAddress || walletAddress,
            trustTier: googleUser.tier,
            creditAllowanceUSD: googleUser.creditAllowanceUSD,
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
              tier: updated.trustTier || "GOOGLE ARCHITECT",
              creditAllowanceUSD: updated.creditAllowanceUSD,
            });
          }}
        />
      )}
    </div>
  );
}
