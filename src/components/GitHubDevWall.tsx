"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  GitBranch,
  Star,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Search,
  Award,
  Info,
  Key,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  fetchDeveloperStats,
  generateDeveloperProof,
  DeveloperStats,
  DeveloperProof,
} from "@/lib/api";
import { relayTarget } from "@/lib/oauthState";

function githubStartUrl(path: string, customClientId?: string | null): string {
  const qs = new URLSearchParams({ path });
  if (customClientId) qs.set("client_id", customClientId);
  return `/api/auth/github/start?${qs.toString()}`;
}

interface GitHubDevWallProps {
  currentAccount: `0x${string}` | null;
  onProofMinted?: (proof: DeveloperProof) => void;
}

export function GitHubDevWall({ currentAccount, onProofMinted }: GitHubDevWallProps) {
  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [devStats, setDevStats] = useState<DeveloperStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [mintLoading, setMintLoading] = useState<boolean>(false);
  const [buidlProof, setBuidlProof] = useState<DeveloperProof | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // OAuth Setup Modal State
  const [oauthModalOpen, setOauthModalOpen] = useState<boolean>(false);
  const [clientIdInput, setClientIdInput] = useState<string>("");
  const [clientSecretInput, setClientSecretInput] = useState<string>("");

  // Check URL parameters for OAuth ?code=... or cached bound username on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const rawState = params.get("state");

    if (code) {
      // 1. Dual-domain Relay Check:
      // If authorization was initiated from another domain (e.g. started on https://koliance.oodai.space,
      // but GitHub redirected to https://koliance.vercel.app as the registered callback),
      // seamlessly bounce the user back to their initiating domain with the authorization code!
      // Only to an EXACT allow-listed origin (no *.vercel.app wildcard), and
      // carrying the state so that origin can verify it against its cookie.
      const relay = relayTarget(window.location.origin, code, rawState);
      if (relay) {
        window.location.replace(relay);
        return;
      }

      handleOAuthCodeExchange(code, rawState);
      return;
    }

    const cachedUser = localStorage.getItem("koliance_github_user");
    if (cachedUser) {
      loadProfile(cachedUser);
    }
  }, []);

  // Exchange authorization code with Next.js backend API
  const handleOAuthCodeExchange = async (code: string, state: string | null) => {
    setLoading(true);
    setNotice("正在完成 GitHub 官方 OAuth 授权验证...");
    try {
      const storedClientId = localStorage.getItem("koliance_github_client_id") || "";
      const storedClientSecret = localStorage.getItem("koliance_github_client_secret") || "";

      const res = await fetch("/api/auth/github/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          state,
          clientId: storedClientId,
          clientSecret: storedClientSecret,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.stats) {
        setDevStats(data.stats);
        setGithubConnected(true);
        localStorage.setItem("koliance_github_user", data.stats.username);
        setNotice(`GitHub 官方授权登录成功！已绑定 @${data.stats.username}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setNotice(`GitHub 授权换取失败: ${data.error || "请检查 Client ID 与 Secret 配置"}`);
      }
    } catch (err: any) {
      setNotice(`GitHub 授权请求异常: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (targetUser: string) => {
    const cleanUser = targetUser.trim();
    if (!cleanUser) return;
    setLoading(true);
    setNotice(null);
    try {
      const stats = await fetchDeveloperStats(cleanUser);
      if (stats) {
        setDevStats(stats);
        setGithubConnected(true);
        localStorage.setItem("koliance_github_user", stats.username);
      } else {
        setNotice(`未检索到 GitHub 开发者 @${cleanUser}，请检查用户名拼写。`);
      }
    } catch (err: any) {
      setNotice(`获取 GitHub 开发者数据失败: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Official GitHub OAuth 2.0 1-Click Redirect
  const handleGitHubOAuthRedirect = () => {
    const configuredClientId =
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ||
      localStorage.getItem("koliance_github_client_id") ||
      "Ov23liz5v98MTdxFmu5u";

    if (!configuredClientId) {
      // Prompt modal to enter Client ID or create one with 1-click link
      setOauthModalOpen(true);
      return;
    }

    // The server route mints the CSRF nonce (httpOnly cookie) and redirects to
    // GitHub with prompt=select_account so the account switcher is shown.
    window.location.href = githubStartUrl(
      window.location.pathname || "/agentcard",
      localStorage.getItem("koliance_github_client_id")
    );
  };

  const handleSaveOAuthAndRedirect = () => {
    if (!clientIdInput.trim()) return;
    localStorage.setItem("koliance_github_client_id", clientIdInput.trim());
    if (clientSecretInput.trim()) {
      localStorage.setItem("koliance_github_client_secret", clientSecretInput.trim());
    }
    setOauthModalOpen(false);

    window.location.href = githubStartUrl(window.location.pathname || "/agentcard", clientIdInput.trim());
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      loadProfile(usernameInput.trim());
      setUsernameInput("");
    }
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem("koliance_github_user");
    setGithubConnected(false);
    setDevStats(null);
    setBuidlProof(null);
    setNotice("已解除当前账号绑定。点击官方认证可在 GitHub 页面切换任意账号，或直接在下方输入账号绑定。");
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

  // Pre-filled registration URL on GitHub
  const githubCreateAppUrl =
    typeof window !== "undefined"
      ? `https://github.com/settings/applications/new?oauth_application[name]=Koliance+AgentCard&oauth_application[url]=${encodeURIComponent(
          window.location.origin
        )}&oauth_application[callback_url]=${encodeURIComponent(
          window.location.origin + "/agentcard"
        )}`
      : "https://github.com/settings/applications/new";

  // ==================== 1. UNBOUND STATE: DYNAMIC AUTH / CONNECT PANEL ====================
  if (!githubConnected || !devStats) {
    return (
      <div className="rounded-3xl bg-gradient-to-r from-[#171b28] via-[#1a233a] to-[#141b2d] border border-indigo-500/30 p-5 sm:p-6 shadow-2xl relative overflow-hidden font-mono text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
                <Code2 className="w-4 h-4" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                GitHub 开发者认证与开源背书 (Proof of BUIDL)
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                官方 OAuth 2.0 直跳 / 动态绑定
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-mono">
              点击即可秒级跳转至 GitHub 官方授权登录，提取开发者全量公开仓库、Star 贡献与主力技术栈，生成 Keccak256 链上信用背书。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 1. Official GitHub OAuth 2.0 Redirect Button */}
            <button
              onClick={handleGitHubOAuthRedirect}
              disabled={loading}
              className="px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold text-xs sm:text-sm font-mono transition shadow-[0_0_25px_rgba(99,102,241,0.4)] flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>正在处理授权...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 text-white" />
                  <span>登录我的 GitHub 账号 (官方授权认证)</span>
                </>
              )}
            </button>

            {/* 2. Custom Input Toggle (Identical to Steam) */}
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono transition"
            >
              {showCustomInput ? "收起输入框" : "输入 GitHub 昵称 / 链接"}
            </button>
          </div>
        </div>

        {/* Custom GitHub Input & Presets Bar */}
        {showCustomInput && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3 font-mono">
            <form onSubmit={handleCustomSubmit} className="flex gap-2">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="输入你的 GitHub 账号或链接 (如 moonhotline, torvalds, vitalikbuterin)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                disabled={loading || !usernameInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition"
              >
                {loading ? "查询中..." : "绑定此账号"}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>快速体验公开账号：</span>
              <button
                type="button"
                onClick={() => loadProfile("moonhotline")}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-indigo-300 transition flex items-center gap-1"
              >
                <Code2 className="w-3 h-3 text-indigo-400" />
                <span>@moonhotline (Koliance 核心开发)</span>
              </button>
              <button
                type="button"
                onClick={() => loadProfile("torvalds")}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-amber-300 transition flex items-center gap-1"
              >
                <Star className="w-3 h-3 text-amber-400" />
                <span>@torvalds (Linux 之父)</span>
              </button>
              <button
                type="button"
                onClick={() => loadProfile("vitalikbuterin")}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-emerald-300 transition flex items-center gap-1"
              >
                <Award className="w-3 h-3 text-emerald-400" />
                <span>@vitalikbuterin (以太坊创始人)</span>
              </button>
            </div>
          </div>
        )}

        {/* Notice or Feedback */}
        {notice && (
          <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Modal: GitHub OAuth App Client Setup */}
        <AnimatePresence>
          {oauthModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg rounded-3xl bg-[#141824] border border-indigo-500/40 p-6 space-y-4 shadow-2xl relative text-white font-mono"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-base text-white">GitHub 官方 OAuth 授权直跳配置</h3>
                  </div>
                  <button
                    onClick={() => setOauthModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-2">
                  <span className="text-indigo-300 font-bold block flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>为什么需要 Client ID？</span>
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    遵循 GitHub 官方 OAuth 2.0 规范，跳转至 GitHub 授权页需要关联您的 GitHub OAuth Application Client ID。
                  </p>
                  <a
                    href={githubCreateAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/40 text-indigo-200 text-xs font-bold transition"
                  >
                    <span>在 GitHub 创建 OAuth App (已预填名称与回调地址)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">GitHub Client ID (必填)：</label>
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="如 Ov23li98..."
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:border-indigo-400 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1">GitHub Client Secret (可选)：</label>
                    <input
                      type="password"
                      value={clientSecretInput}
                      onChange={(e) => setClientSecretInput(e.target.value)}
                      placeholder="用于后端安全换取 Token"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:border-indigo-400 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveOAuthAndRedirect}
                    disabled={!clientIdInput.trim()}
                    className="flex-1 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>保存并立即跳转至 GitHub 授权</span>
                  </button>
                  <button
                    onClick={() => {
                      setOauthModalOpen(false);
                      setShowCustomInput(true);
                    }}
                    className="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs transition"
                  >
                    免配直接查账号
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ==================== 2. BOUND STATE: VERIFIED DEVELOPER WALL ====================
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
              src={devStats.avatarUrl || "https://avatars.githubusercontent.com/u/228437717?v=4"}
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
                {devStats.name || devStats.username}
              </h3>
              <a
                href={devStats.htmlUrl || `https://github.com/${devStats.username}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition"
              >
                <span>@{devStats.username}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                VERIFIED GITHUB DID
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>已绑定: @{devStats.username}</span>
              <span>·</span>
              <button
                onClick={handleSwitchAccount}
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition"
              >
                切换账号
              </button>
            </div>
            {devStats.bio && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-md">
                {devStats.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-white/10 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase leading-none">开源仓库</span>
              <strong className="text-white text-sm font-black">{devStats.publicRepos} 个</strong>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-white/10 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase leading-none">累计星标</span>
              <strong className="text-white text-sm font-black">{devStats.totalStars} Stars</strong>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-purple-500/30 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-[10px] text-purple-400/80 block uppercase leading-none">BUIDL 评级</span>
              <strong className="text-purple-300 text-sm font-black">
                {buidlProof ? buidlProof.tier : devStats.buidlTier}
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
                <span>铸造 GitHub 开发者信用凭证 (+${devStats.creditAllowanceUSD} 额度)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tech Stack Pills & Repos Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
        <div className="text-slate-300">
          <span>展示该开发者公开仓库：</span>
          <strong className="text-indigo-300 ml-1">{devStats.topRepos?.length || 0} 个主力标的</strong>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 mr-1">语言栈：</span>
          {(devStats.languages && devStats.languages.length > 0
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

      {/* Repositories 3D Spatial Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(devStats.topRepos && devStats.topRepos.length > 0
          ? devStats.topRepos
          : []
        ).map((repo) => (
          <div
            key={repo.id || repo.name}
            className="p-4 rounded-2xl bg-[#141824]/90 border border-white/10 hover:border-indigo-400/60 transition-all duration-300 shadow-[0_8px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_15px_35px_rgba(99,102,241,0.25)] hover:scale-[1.02] hover:-translate-y-0.5 flex flex-col justify-between group select-none"
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

              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {repo.description || "开源基础设施与智能合约开发套件。"}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06] text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                <span className="text-slate-300">{repo.language || "TypeScript"}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-amber-300 font-bold">
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
        <span className="text-indigo-400/80 font-mono">由 Official GitHub REST API 提供动态数据驱动</span>
      </div>
    </div>
  );
}
