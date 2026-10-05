"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Gamepad2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Clock,
  Layers,
  Flame,
  LayoutGrid,
  Film,
  Trophy,
  ExternalLink,
  CheckCircle2,
  Info,
} from "lucide-react";
import { GameplayProof } from "@/lib/api";

export interface SteamGameItem {
  appId: number;
  name: string;
  hoursPlayed: number;
  iconUrl: string;
  headerUrl?: string;
}

interface SteamGameWallProps {
  steamId: string;
  personaName: string;
  avatar: string;
  totalPlayHours: number;
  totalGames: number;
  games: SteamGameItem[];
  selectedGameId: number | null;
  onSelectGame: (game: SteamGameItem) => void;
  onMintProof: (game: SteamGameItem) => void;
  proofLoading: boolean;
  gameProof: GameplayProof | null;
  onSwitchAccount: () => void;
}

export function SteamGameWall({
  steamId,
  personaName,
  avatar,
  totalPlayHours,
  totalGames,
  games,
  selectedGameId,
  onSelectGame,
  onMintProof,
  proofLoading,
  gameProof,
  onSwitchAccount,
}: SteamGameWallProps) {
  const [viewMode, setViewMode] = useState<"marquee" | "grid">("marquee");

  // Fallback demo games if user has privacy enabled or empty library
  const displayGames: SteamGameItem[] =
    games && games.length > 0
      ? games
      : [
          {
            appId: 1222690,
            name: "Plants vs. Zombies™ Garden Warfare 2: Deluxe Edition",
            hoursPlayed: 66.4,
            iconUrl: "",
            headerUrl: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1222690/header.jpg",
          },
          {
            appId: 292030,
            name: "The Witcher 3: Wild Hunt — Remastered",
            hoursPlayed: 36.2,
            iconUrl: "",
            headerUrl: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg",
          },
          {
            appId: 1233570,
            name: "Mirror's Edge™ Catalyst",
            hoursPlayed: 21.0,
            iconUrl: "",
            headerUrl: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1233570/header.jpg",
          },
          {
            appId: 730,
            name: "Counter-Strike 2",
            hoursPlayed: 142.5,
            iconUrl: "",
            headerUrl: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg",
          },
          {
            appId: 570,
            name: "Dota 2",
            hoursPlayed: 98.0,
            iconUrl: "",
            headerUrl: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/header.jpg",
          },
          {
            appId: 2358720,
            name: "Black Myth: Wukong",
            hoursPlayed: 48.6,
            iconUrl: "",
            headerUrl: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg",
          },
        ];

  // Split into 2 rows for opposite infinite scrolling
  const row1 = displayGames.filter((_, idx) => idx % 2 === 0);
  const row2 = displayGames.filter((_, idx) => idx % 2 !== 0);

  // Duplicate for seamless 0-gap looping marquee
  const seamlessRow1 = [...row1, ...row1, ...row1];
  const seamlessRow2 = [...row2, ...row2, ...row2];

  // Find currently selected game object
  const activeGame =
    displayGames.find((g) => g.appId === selectedGameId) || displayGames[0];

  return (
    <div className="w-full rounded-3xl bg-gradient-to-b from-[#141824] via-[#10131d] to-[#0c0e15] border border-cyan-500/30 p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-6 font-mono text-white relative overflow-hidden">
      {/* Background Cyber Ambient Lights */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header: Player DID + Stats Capsules + Mint CTA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10 border-b border-white/[0.08] pb-5">
        {/* Profile Card */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src={avatar || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"}
              alt="Steam Avatar"
              className="w-14 h-14 rounded-2xl border-2 border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.4)] object-cover"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#141824]" title="Online" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white tracking-wide">{personaName}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                VERIFIED STEAM DID
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>SteamID: {steamId.slice(0, 10)}...</span>
              <span>·</span>
              <button
                onClick={onSwitchAccount}
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition"
              >
                切换账号
              </button>
            </div>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-white/10 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase leading-none">累计总时长</span>
              <strong className="text-white text-sm font-black">{totalPlayHours.toFixed(1)}h</strong>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-white/10 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase leading-none">游戏库藏品</span>
              <strong className="text-white text-sm font-black">{totalGames} 款游戏</strong>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-amber-500/30 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-amber-400/80 block uppercase leading-none">信用评级</span>
              <strong className="text-amber-300 text-sm font-black">
                {gameProof ? gameProof.trustScoreTier : "PLATINUM 宗师"}
              </strong>
            </div>
          </div>
        </div>

        {/* Mint CTA Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onMintProof(activeGame)}
            disabled={proofLoading || !!gameProof}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm transition shadow-[0_0_25px_rgba(168,85,247,0.4)] flex items-center gap-2 active:scale-95 disabled:opacity-60"
          >
            {proofLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>正在向 Monad 提交存证...</span>
              </>
            ) : gameProof ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>已铸造链上背书 (+${gameProof.creditUnlockUSD} 额度)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200 fill-current" />
                <span>铸造当前游戏信用凭证 (+500 额度)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mode Toggle & Currently Selected Asset Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
        <div className="flex items-center gap-2 text-slate-300">
          <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>
            当前锚定游戏资产：
            <strong className="text-cyan-300 ml-1">{activeGame.name}</strong>
            <span className="text-slate-400 ml-1.5 font-bold">({activeGame.hoursPlayed.toFixed(1)} 小时)</span>
          </span>
        </div>

        {/* View Switcher: Marquee vs Grid */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setViewMode("marquee")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === "marquee"
                ? "bg-cyan-400 text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>3D 无限滚动画卷</span>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === "grid"
                ? "bg-cyan-400 text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>全景网格</span>
          </button>
        </div>
      </div>

      {/* ==================== 1. INFINITE ROLLING GAME MARQUEE ==================== */}
      {viewMode === "marquee" ? (
        <div
          className="relative w-full py-6 overflow-hidden rounded-2xl group perspective-stage"
          style={{
            perspective: 1600,
            transformStyle: "preserve-3d",
            maskImage:
              "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
          }}
        >
          {/* Subtle Top & Bottom Cinematic Shadow for Camera Depth */}
          <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#10131d] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[#0c0e15] to-transparent z-10 pointer-events-none" />

          {/* 3D Stage tilted for realistic spatial camera perspective */}
          <div
            className="space-y-6"
            style={{
              transform: "rotateX(4deg)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Row 1: Foreground Layer (Crisp, High-Detail Depth) */}
            <div className="animate-marquee-left flex gap-5 dof-foreground">
              {seamlessRow1.map((game, idx) => {
                const isSelected = activeGame.appId === game.appId;
                const header =
                  game.headerUrl ||
                  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`;
                return (
                  <div
                    key={`r1-${game.appId}-${idx}`}
                    onClick={() => onSelectGame(game)}
                    className={`relative w-64 h-36 rounded-2xl overflow-hidden cursor-pointer shrink-0 transition-all duration-300 group/card select-none border shadow-[0_18px_38px_-10px_rgba(0,0,0,0.85)] ${
                      isSelected
                        ? "border-cyan-400 ring-4 ring-cyan-400/40 z-30 shadow-[0_20px_50px_rgba(34,211,238,0.5)]"
                        : "border-white/10 hover:border-cyan-400/80 hover:z-30 hover:shadow-[0_20px_40px_rgba(0,242,254,0.35)]"
                    }`}
                    style={{
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <img
                      src={header}
                      alt={game.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg";
                      }}
                      className="w-full h-full object-cover group-hover/card:scale-108 transition-transform duration-500"
                    />
                    
                    {/* Gloss Reflection Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent pointer-events-none" />
                    
                    {/* Dark gradient for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent p-3 flex flex-col justify-between" />
                    
                    {/* Top Pill */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/75 backdrop-blur-md text-cyan-300 border border-cyan-400/30 shadow-sm flex items-center gap-1">
                        <Flame className="w-3 h-3 text-cyan-400" />
                        <span>{game.hoursPlayed.toFixed(0)}h 时长</span>
                      </span>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-400 text-black shadow-sm">
                          已锚定
                        </span>
                      )}
                    </div>

                    {/* Bottom Title */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <span className="text-xs font-bold text-white drop-shadow-md line-clamp-1 block">
                        {game.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">AppID: {game.appId}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 2: Background Layer (Recessed Spatial Distance with Optical DOF) */}
            <div className="animate-marquee-right flex gap-5 dof-background">
              {seamlessRow2.map((game, idx) => {
                const isSelected = activeGame.appId === game.appId;
                const header =
                  game.headerUrl ||
                  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`;
                return (
                  <div
                    key={`r2-${game.appId}-${idx}`}
                    onClick={() => onSelectGame(game)}
                    className={`relative w-64 h-36 rounded-2xl overflow-hidden cursor-pointer shrink-0 transition-all duration-300 group/card select-none border shadow-[0_18px_38px_-10px_rgba(0,0,0,0.85)] ${
                      isSelected
                        ? "border-cyan-400 ring-4 ring-cyan-400/40 z-30 shadow-[0_20px_50px_rgba(34,211,238,0.5)]"
                        : "border-white/10 hover:border-cyan-400/80 hover:z-30 hover:shadow-[0_20px_40px_rgba(0,242,254,0.35)]"
                    }`}
                    style={{
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <img
                      src={header}
                      alt={game.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg";
                      }}
                      className="w-full h-full object-cover group-hover/card:scale-108 transition-transform duration-500"
                    />

                    {/* Gloss Reflection Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent pointer-events-none" />

                    {/* Dark gradient for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent p-3 flex flex-col justify-between" />
                    
                    {/* Top Pill */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/75 backdrop-blur-md text-amber-300 border border-amber-400/30 shadow-sm flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>{game.hoursPlayed.toFixed(0)}h 时长</span>
                      </span>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-400 text-black shadow-sm">
                          已锚定
                        </span>
                      )}
                    </div>

                    {/* Bottom Title */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <span className="text-xs font-bold text-white drop-shadow-md line-clamp-1 block">
                        {game.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">AppID: {game.appId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ==================== 2. GRID EXPLORATION MODE ==================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
          {displayGames.map((game) => {
            const isSelected = activeGame.appId === game.appId;
            const header =
              game.headerUrl ||
              `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`;
            return (
              <div
                key={`grid-${game.appId}`}
                onClick={() => onSelectGame(game)}
                className={`relative h-36 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 group select-none border ${
                  isSelected
                    ? "border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg"
                    : "border-white/10 hover:border-cyan-400/60 hover:scale-[1.02]"
                }`}
              >
                <img
                  src={header}
                  alt={game.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg";
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-black/80 text-cyan-300 border border-white/10">
                      {game.hoursPlayed.toFixed(1)}h
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center text-black">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div>
                    <strong className="text-xs font-bold text-white line-clamp-1 block">
                      {game.name}
                    </strong>
                    <span className="text-[10px] text-slate-400">AppID: {game.appId}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Hint */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-white/[0.08] pt-3">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>悬停即可暂停滚动；点击任意游戏卡片即可将其设为首选信用背书标的。</span>
        </div>
        <span className="text-cyan-400/80 font-mono">由 Valve Steam Web API 官方认证提供</span>
      </div>
    </div>
  );
}
