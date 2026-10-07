"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Mail,
  Award,
  Edit3,
  User,
} from "lucide-react";
import Image from "next/image";
import { GOOGLE_CLIENT_ID } from "@/lib/authConfig";
import { EditProfileModal } from "@/components/EditProfileModal";

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string | null;
  walletAddress?: string | null;
  trustTier: string;
  creditAllowanceUSD: number;
}

interface GoogleAuthWallProps {
  walletAddress?: string | null;
  onProfileSynced?: (profile: GoogleProfile) => void;
}

export function GoogleAuthWall({ walletAddress, onProfileSynced }: GoogleAuthWallProps) {
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Read saved profile from localStorage if present
  useEffect(() => {
    try {
      const cached = localStorage.getItem("koliance_google_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        setProfile(parsed);
        if (onProfileSynced) onProfileSynced(parsed);
      }
    } catch {
      // ignore
    }
  }, [onProfileSynced]);

  const handleExchangeCode = React.useCallback(async (authCode: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/google/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: "https://koliance.oodai.space",
          wallet_address: walletAddress || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Google 认证授权失败");
      }

      setProfile(data.profile);
      localStorage.setItem("koliance_google_profile", JSON.stringify(data.profile));
      setSyncSuccess(true);
      if (onProfileSynced) onProfileSynced(data.profile);
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, onProfileSynced]);

  // Check URL parameters if redirected from Google OAuth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const scope = url.searchParams.get("scope");

    // Only process if it looks like a Google OAuth response (includes google scope or from Google redirect)
    if (code && scope && scope.includes("googleapis")) {
      handleExchangeCode(code);
      // Clean up URL without reload
      url.searchParams.delete("code");
      url.searchParams.delete("scope");
      url.searchParams.delete("authuser");
      url.searchParams.delete("prompt");
      window.history.replaceState({}, document.title, url.toString());
    }
  }, [handleExchangeCode]);

  const handleLaunchGoogleLogin = () => {
    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      GOOGLE_CLIENT_ID;
    if (!clientId) {
      setErrorMsg("未配置 NEXT_PUBLIC_GOOGLE_CLIENT_ID 环境变量");
      return;
    }
    const redirectUri = encodeURIComponent("https://koliance.oodai.space");
    const scope = encodeURIComponent("openid email profile");
    const state = encodeURIComponent(
      JSON.stringify({
        origin: window.location.origin,
        timestamp: Date.now(),
      })
    );

    const authUrl = `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    window.location.href = authUrl;
  };

  // Mock demo account for one-click instant testing in sandbox/dev
  const handleQuickDemoVerify = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Simulates an official Google ID token verification
      const res = await fetch("/api/auth/google/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Verified payload structure
          id_token: "demo_verified_google_identity",
          wallet_address: walletAddress || "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
        }),
      });

      // If backend mock is called or we synthesize verified user:
      let syncedProfile: GoogleProfile;
      if (res.ok) {
        const data = await res.json();
        syncedProfile = data.profile;
      } else {
        // Fallback demo profile
        syncedProfile = {
          googleId: "109842839210492819283",
          email: "alexander.dev@google.com",
          emailVerified: true,
          name: "Alexander Monad Core",
          picture: null,
          walletAddress: walletAddress || "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
          trustTier: "GOOGLE VERIFIED ARCHITECT",
          creditAllowanceUSD: 1200,
        };
      }

      setProfile(syncedProfile);
      localStorage.setItem("koliance_google_profile", JSON.stringify(syncedProfile));
      setSyncSuccess(true);
      if (onProfileSynced) onProfileSynced(syncedProfile);
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setProfile(null);
    localStorage.removeItem("koliance_google_profile");
  };

  return (
    <div className="rounded-3xl bg-gradient-to-r from-[#171e2c] via-[#1a2334] to-[#141b27] border border-blue-500/30 p-5 sm:p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <Globe className="w-4 h-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Google 开发者身份背书 (Proof of Google Identity)
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              OAuth 2.0 / TypeORM Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            绑定官方 Google Workspace / Gmail 开发者账户，联合 TypeORM 数据库实体映射，即刻激活
            <span className="text-blue-400 font-bold ml-1">+$1,200 USD</span> AgentCard 授信与信用证明。
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {!profile ? (
            <>
              <button
                onClick={handleLaunchGoogleLogin}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-mono text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/25"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
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
                )}
                <span>Google 官方登录</span>
              </button>

              <button
                onClick={handleQuickDemoVerify}
                disabled={loading}
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs transition border border-white/10 flex items-center gap-1.5"
                title="快捷测试 Google 开发者身份背书与 TypeORM 实体数据"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>快速模拟认证</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-mono text-xs transition border border-blue-500/30 flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>编辑资料</span>
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono text-xs transition border border-red-500/30 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>解除绑定</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
        {syncSuccess && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Google 身份背书验证通过！TypeORM 实体映射已同步，授信额度已实时加成。</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Details Card when connected */}
      {profile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* User ID & Info */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
            {profile.picture ? (
              <Image
                src={profile.picture}
                alt={profile.name}
                width={44}
                height={44}
                className="w-11 h-11 rounded-full border border-blue-400/40"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <User className="w-5 h-5" />
              </div>
            )}
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm truncate">{profile.name}</span>
                {profile.emailVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono truncate">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
            </div>
          </div>

          {/* Trust Tier */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">信用认证评级</div>
              <div className="text-sm font-bold text-blue-300 font-mono flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>{profile.trustTier}</span>
              </div>
            </div>
            <Award className="w-6 h-6 text-blue-400/50" />
          </div>

          {/* Credit Allowance */}
          <div className="p-4 rounded-2xl bg-black/40 border border-blue-500/30 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">AgentCard 授信加成</div>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                +${profile.creditAllowanceUSD.toLocaleString()} USD
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-[10px] font-mono text-emerald-300">
              已激活生效
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          profile={{
            id: `did:koliance:google:${profile.googleId}`,
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            walletAddress: profile.walletAddress || walletAddress,
            trustTier: profile.trustTier,
            creditAllowanceUSD: profile.creditAllowanceUSD,
          }}
          walletAddress={walletAddress}
          onProfileUpdated={(updated) => {
            const updatedProfile = {
              ...profile,
              name: updated.name,
              picture: updated.picture,
              walletAddress: updated.walletAddress,
            };
            setProfile(updatedProfile);
            if (onProfileSynced) onProfileSynced(updatedProfile);
          }}
        />
      )}
    </div>
  );
}
