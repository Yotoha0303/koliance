"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Wallet,
  FileText,
  Camera,
  X,
  Check,
  Save,
  Loader2,
  Sparkles,
  Link2,
} from "lucide-react";
import Image from "next/image";
import { truncateAddress } from "@/lib/utils";

export interface UserProfileData {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  bio?: string | null;
  walletAddress?: string | null;
  trustTier?: string;
  creditAllowanceUSD?: number;
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfileData;
  walletAddress?: string | null;
  onProfileUpdated: (updated: UserProfileData) => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
];

export function EditProfileModal({
  isOpen,
  onClose,
  profile,
  walletAddress,
  onProfileUpdated,
}: EditProfileModalProps) {
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "Koliance Web3 & AI Identity");
  const [picture, setPicture] = useState(profile.picture || "");
  const [boundWallet, setBoundWallet] = useState(
    profile.walletAddress || walletAddress || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveSuccess(false);

    try {
      const payload = {
        id: profile.id,
        email: profile.email,
        name: name.trim() || profile.email.split("@")[0],
        bio: bio.trim(),
        picture: picture.trim() || null,
        wallet_address: boundWallet.trim() || null,
      };

      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update profile");
      }

      const updatedProfile: UserProfileData = {
        ...profile,
        name: payload.name,
        bio: payload.bio,
        picture: payload.picture,
        walletAddress: payload.wallet_address,
      };

      // Update localStorage cached profile
      localStorage.setItem("koliance_google_profile", JSON.stringify({
        ...updatedProfile,
        googleId: profile.id.replace("did:koliance:google:", ""),
      }));

      // Fire storage event to notify other components
      window.dispatchEvent(new Event("storage"));

      onProfileUpdated(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      alert("保存失败: " + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg rounded-3xl bg-[#121624] border border-white/15 p-6 shadow-2xl overflow-hidden text-white"
      >
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">编辑用户个人资料</h3>
              <p className="text-[11px] font-mono text-slate-400">
                Koliance 账号绑定与链上身份扩展
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Avatar Preview & URL */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5">
              头像设置 (Avatar URL / Preset)
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black/50 border border-white/20 shrink-0 relative flex items-center justify-center">
                {picture ? (
                  <Image
                    src={picture}
                    alt={name}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <input
                  type="url"
                  value={picture}
                  onChange={(e) => setPicture(e.target.value)}
                  placeholder="https://... 头像直链"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">预设:</span>
                  {PRESET_AVATARS.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPicture(url)}
                      className="w-5 h-5 rounded-full overflow-hidden border border-white/20 hover:scale-110 transition"
                    >
                      <Image src={url} alt={`Preset ${i}`} width={20} height={20} className="w-full h-full object-cover" unoptimized />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* User Name */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              用户昵称 (Display Name)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的昵称"
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400 pl-9"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Bio / Description */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              个人简介 (Bio / Description)
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="介绍你的 Web3 经历与开发专长..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Wallet Binding */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-mono text-slate-300">
                绑定 Monad 钱包 (Bound Wallet)
              </label>
              {walletAddress && boundWallet !== walletAddress && (
                <button
                  type="button"
                  onClick={() => setBoundWallet(walletAddress)}
                  className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  <span>使用当前连接钱包</span>
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={boundWallet}
                onChange={(e) => setBoundWallet(e.target.value)}
                placeholder="0x... Monad 钱包地址"
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-blue-400 pl-9"
              />
              <Wallet className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Email Info (Read-only) */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Mail className="w-3.5 h-3.5" />
              <span>注册 Google 邮箱</span>
            </div>
            <span className="font-mono text-slate-200">{profile.email}</span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saveSuccess ? "已同步保存" : "保存修改"}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
