"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Code2,
  GitBranch,
  Star,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Search,
  Layers,
  Award,
  Terminal,
  Cpu,
  Info,
} from "lucide-react";
import {
  fetchDeveloperStats,
  generateDeveloperProof,
  DeveloperStats,
  DeveloperProof,
  GitHubRepoItem,
} from "@/lib/api";

interface GitHubDevWallProps {
  currentAccount: `0x${string}` | null;
  onProofMinted?: (proof: DeveloperProof) => void;
}

export function GitHubDevWall({ currentAccount, onProofMinted }: GitHubDevWallProps) {
  const [username, setUsername] = useState<string>("moonhotline");
  const [customInput, setCustomInput] = useState<string>("");
  const [devStats, setDevStats] = useState<DeveloperStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mintLoading, setMintLoading] = useState<boolean>(false);
  const [buidlProof, setBuidlProof] = useState<DeveloperProof | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = async (targetUser: string) => {
    setLoading(true);
    setNotice(null);
    try {
      const stats = await fetchDeveloperStats(targetUser);
      if (stats) {
        setDevStats(stats);
        setUsername(targetUser);
      } else {
        setNotice(`未找到 GitHub 用户 @${targetUser}，已显示默认开发者主页。`);
      }
    } catch (err: any) {
      setNotice(`获取 GitHub 开发者数据失败: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile("moonhotline");
  }, []);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      loadProfile(customInput.trim());
      setCustomInput("");
    }
  };

  const handleMintProof = async () => {
    if (!devStats) return;
    setMintLoading(true);
    try {
      const wallet = currentAccount || "0x0000000000000000000000000000000000000000";
      const proof = await generateDeveloperProof(devStats.username, wallet);
      if (proof) {
        setBuidlProof(proof);
        if (onProofMinted) {
          onProofMinted(proof);
        }
      }
    } catch (err: any) {
      setNotice(`铸造开发者存证失败: ${err?.message || err}`);
    } finally {
      setMintLoading(false);
    }
  };

  return (
    <div className="w-full rounded-3xl bg-gradient-to-b from-[#111520] via-[#0d1017] to-[#080a0f] border border-indigo-500/30 p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)] space-y-6 font-mono text-white relative overflow-hidden">
      {/* Background Cyber Ambient Glows */}
      <div className="absolute top-0 right-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Header: Developer DID Profile + Badges + Mint CTA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10 border-b border-white/[0.08] pb-5">
        {/* Profile Details */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={devStats?.avatarUrl || "https://avatars.githubusercontent.com/u/228437717?v=4"}
              alt="GitHub Avatar"
              className="w-14 h-14 rounded-2xl border-2 border-indigo-400/80 shadow-[0_0_20px_rgba(99,102,241,0.4)] object-cover"
            />
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#111520]"
              title="Verified BUIDLer"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white tracking-wide">
                {devStats?.name || username}
              </h3>
              <a
                href={devStats?.htmlUrl || `https://github.com/${username}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition"
              >
                <span>@{devStats?.username || username}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                VERIFIED GITHUB DID
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-md">
              {devStats?.bio || "Active Web3 & AI Developer on Monad"}
            </p>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-white/10 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase leading-none">开源仓库</span>
              <strong className="text-white text-sm font-black">{devStats?.publicRepos || 13} 个</strong>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-white/10 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase leading-none">累计星标</span>
              <strong className="text-white text-sm font-black">{devStats?.totalStars || 5} Stars</strong>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-purple-500/30 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-[10px] text-purple-400/80 block uppercase leading-none">BUIDL 评级</span>
              <strong className="text-purple-300 text-sm font-black">
                {buidlProof ? buidlProof.tier : devStats?.buidlTier || "CORE BUIDLER"}
              </strong>
            </div>
          </div>
        </div>

        {/* Mint CTA Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleMintProof}
            disabled={mintLoading || !!buidlProof}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm transition shadow-[0_0_25px_rgba(99,102,241,0.4)] flex items-center gap-2 active:scale-95 disabled:opacity-60"
          >
            {mintLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>正在向 Monad 提交存证...</span>
              </>
            ) : buidlProof ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>已铸造开发者信用 (+${buidlProof.creditUnlockUSD} 额度)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200 fill-current" />
                <span>铸造 GitHub 开发者信用凭证 (+1000 额度)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Query Bar & Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
        <form onSubmit={handleCustomSubmit} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="查询其他 GitHub 开发者 (如 moonhotline, torvalds)"
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !customInput.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition"
          >
            {loading ? "检索中..." : "验证开发者"}
          </button>
        </form>

        {/* Tech Stack Pills */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 mr-1">语言栈：</span>
          {(devStats?.languages && devStats.languages.length > 0
            ? devStats.languages
            : ["TypeScript", "Go", "Solidity"]
          ).map((lang) => (
            <span
              key={lang}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/[0.05] border border-white/10 text-cyan-300"
            >
              {lang}
            </span>
          ))}
        </div>
      </div>

      {/* Notice Message */}
      {notice && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Repositories 3D Spatial Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(devStats?.topRepos && devStats.topRepos.length > 0
          ? devStats.topRepos
          : [
              {
                id: 1,
                name: "koliance",
                full_name: "moonhotline/koliance",
                html_url: "https://github.com/moonhotline/koliance",
                description: "AI Agent Financial Sovereignty & Visa Micropayments Engine on Monad",
                language: "TypeScript",
                stargazers_count: 3,
                forks_count: 1,
                updated_at: "2026-10-05T08:00:00Z",
              },
              {
                id: 2,
                name: "token-bankcard",
                full_name: "moonhotline/token-bankcard",
                html_url: "https://github.com/moonhotline/token-bankcard",
                description: "Token Bankcard Smart Gateway & Decentralized Issuing Protocols",
                language: "Go",
                stargazers_count: 1,
                forks_count: 0,
                updated_at: "2026-08-02T08:49:50Z",
              },
              {
                id: 3,
                name: "toy-factory",
                full_name: "moonhotline/toy-factory",
                html_url: "https://github.com/moonhotline/toy-factory",
                description: "Smart contract tooling and autonomous agent test harness",
                language: "TypeScript",
                stargazers_count: 1,
                forks_count: 0,
                updated_at: "2026-08-02T08:50:15Z",
              },
            ]
        ).map((repo) => (
          <div
            key={repo.id || repo.name}
            className="p-4 rounded-2xl bg-[#141824]/80 border border-white/10 hover:border-indigo-400/60 transition-all duration-300 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.7)] hover:shadow-[0_15px_35px_rgba(99,102,241,0.25)] hover:scale-[1.02] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-sm text-white group-hover:text-indigo-300 transition flex items-center gap-1.5 truncate"
                >
                  <Code2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="truncate">{repo.name}</span>
                </a>
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-white transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {repo.description || "开源基础设施与智能合约开发套件。"}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06] text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                <span>{repo.language || "TypeScript"}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-amber-300">
                  <Star className="w-3 h-3 fill-amber-300/30" />
                  <span>{repo.stargazers_count || 0}</span>
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <GitBranch className="w-3 h-3" />
                  <span>{repo.forks_count || 0}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Proof Record Details If Minted */}
      {buidlProof && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-xs space-y-1.5 font-mono"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Monad 链上开发者信用背书已生效</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {new Date(buidlProof.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
            <div>
              <span className="text-slate-400">Keccak256 存证哈希：</span>
              <span className="text-cyan-300 block truncate font-mono">{buidlProof.proofHash}</span>
            </div>
            <div>
              <span className="text-slate-400">授信额度解锁：</span>
              <span className="text-emerald-400 block font-bold">+${buidlProof.creditUnlockUSD} USD</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom Hint */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-white/[0.08] pt-3">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>支持将 GitHub 开发者信用与 Steam 游戏信用并行叠加，共同赋能 AgentCard 授信额度。</span>
        </div>
        <span className="text-indigo-400/80 font-mono">由 Official GitHub REST API 提供数据驱动</span>
      </div>
    </div>
  );
}
