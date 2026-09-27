"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Activity,
  Zap,
  Cpu,
  Layers,
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
  Filter,
  Bell,
  Wallet,
  Settings,
  Grid,
  ChevronDown,
  Plus,
  Minus,
  RotateCcw,
  MoreHorizontal,
  Info,
  Check,
  User,
} from "lucide-react";
import { monadTestnet } from "@/lib/contract";

interface NodeItem {
  id: string;
  label: string;
  subLabel?: string;
  cluster: "violet" | "cyan" | "gold" | "core";
  score?: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  connections: string[];
}

export function TrustConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeSideNav, setActiveSideNav] = useState("trust_graph");
  const [activeTooltip, setActiveTooltip] = useState(true);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Initial nodes positioning matching Image 2 exactly
  const nodes: NodeItem[] = useMemo(
    () => [
      // Core Bright Node
      {
        id: "core",
        label: "KOLIANCEID",
        cluster: "core",
        score: 99.8,
        x: 440,
        y: 350,
        radius: 12,
        color: "#ffffff",
        connections: [
          "user_014",
          "koliance_mid",
          "koliance_top",
          "koliance_cyan",
          "dao_main",
          "police_ath",
        ],
      },
      // Violet Cluster (Left/Top)
      {
        id: "user_014",
        label: "user_014.trustgraph",
        cluster: "violet",
        score: 94.7,
        x: 370,
        y: 450,
        radius: 8,
        color: "#c084fc",
        connections: ["core", "violet_star_1", "violet_star_2", "violet_left_1", "violet_bot_1"],
      },
      {
        id: "violet_star_1",
        label: "KOLIANCEID",
        subLabel: "⭐ 95.79",
        cluster: "violet",
        score: 95.79,
        x: 450,
        y: 170,
        radius: 7,
        color: "#a855f7",
        connections: ["core", "violet_star_2", "top_addr_1", "dao_top"],
      },
      {
        id: "violet_star_2",
        label: "KOLIANCEID",
        subLabel: "⭐ 59.77",
        cluster: "violet",
        score: 59.77,
        x: 330,
        y: 330,
        radius: 8,
        color: "#c084fc",
        connections: ["core", "user_014", "violet_left_1", "violet_top_1"],
      },
      {
        id: "violet_left_1",
        label: "0x8a...e2f",
        cluster: "violet",
        x: 200,
        y: 430,
        radius: 6,
        color: "#c084fc",
        connections: ["violet_star_2", "user_014", "violet_left_2", "violet_bot_1"],
      },
      {
        id: "violet_left_2",
        label: "user_014.trgraph",
        cluster: "violet",
        x: 180,
        y: 360,
        radius: 5,
        color: "#a855f7",
        connections: ["violet_left_1", "violet_star_2", "violet_top_1"],
      },
      {
        id: "violet_top_1",
        label: "*0x8a...e2f",
        cluster: "violet",
        x: 230,
        y: 230,
        radius: 5.5,
        color: "#a855f7",
        connections: ["violet_left_2", "violet_star_1", "violet_star_2"],
      },
      {
        id: "top_addr_1",
        label: "*0x8a...e2f",
        cluster: "violet",
        x: 410,
        y: 120,
        radius: 5,
        color: "#c084fc",
        connections: ["violet_star_1", "violet_star_2"],
      },
      {
        id: "violet_bot_1",
        label: "KOLIANCEID",
        cluster: "violet",
        x: 250,
        y: 570,
        radius: 6,
        color: "#c084fc",
        connections: ["user_014", "violet_left_1", "bot_addr_1"],
      },
      // Cyan Cluster (Center/Right)
      {
        id: "koliance_cyan",
        label: "KOLIANCEID",
        cluster: "cyan",
        score: 96.2,
        x: 520,
        y: 350,
        radius: 8.5,
        color: "#00F2FE",
        connections: ["core", "user_014_trust", "police_ath", "cyan_bot"],
      },
      {
        id: "user_014_trust",
        label: "user_014.trust",
        subLabel: "94.7",
        cluster: "cyan",
        score: 94.7,
        x: 650,
        y: 390,
        radius: 7,
        color: "#38bdf8",
        connections: ["koliance_cyan", "police_ath", "gold_right_1"],
      },
      {
        id: "police_ath",
        label: "Police_Ath_Cosh",
        cluster: "cyan",
        x: 570,
        y: 460,
        radius: 6.5,
        color: "#00F2FE",
        connections: ["koliance_cyan", "user_014", "cyan_bot"],
      },
      {
        id: "cyan_bot",
        label: "0x8a...e2f",
        cluster: "cyan",
        x: 350,
        y: 600,
        radius: 5,
        color: "#38bdf8",
        connections: ["user_014", "core", "dao_bot"],
      },
      // Gold/Amber Cluster (Right/Bottom)
      {
        id: "dao_top",
        label: "VerifiableDAO",
        cluster: "gold",
        score: 98.1,
        x: 560,
        y: 190,
        radius: 7,
        color: "#fbbf24",
        connections: ["violet_star_1", "gold_right_1", "koliance_cyan"],
      },
      {
        id: "gold_right_1",
        label: "0x8a...",
        cluster: "gold",
        x: 640,
        y: 280,
        radius: 5.5,
        color: "#f59e0b",
        connections: ["dao_top", "user_014_trust", "koliance_cyan"],
      },
      {
        id: "gold_right_2",
        label: "0x8a...e2f",
        cluster: "gold",
        x: 660,
        y: 480,
        radius: 5,
        color: "#fbbf24",
        connections: ["user_014_trust", "dao_bot"],
      },
      {
        id: "dao_bot",
        label: "VerifiableDAO",
        cluster: "gold",
        score: 97.4,
        x: 510,
        y: 640,
        radius: 6.5,
        color: "#fbbf24",
        connections: ["core", "cyan_bot", "gold_right_2"],
      },
    ],
    []
  );

  // Canvas Constellation Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 780);
    let height = (canvas.height = 680);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = 680;
    };
    window.addEventListener("resize", handleResize);

    let animationId: number;
    let pulseT = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      pulseT += 0.025;

      const scale = (width / 800) * scaleFactor;
      const offsetX = (width - 800 * scale) / 2;
      const offsetY = 10;

      // 1. Draw central bright radial flare
      const centerNode = nodes.find((n) => n.id === "core");
      if (centerNode) {
        const cx = centerNode.x * scale + offsetX;
        const cy = centerNode.y * scale + offsetY;

        const flareGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 140 * scale);
        flareGrad.addColorStop(0, "rgba(192, 132, 252, 0.45)");
        flareGrad.addColorStop(0.3, "rgba(0, 242, 254, 0.2)");
        flareGrad.addColorStop(0.7, "rgba(131, 110, 249, 0.05)");
        flareGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 140 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw Connections with traveling energy packets
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      for (const n of nodes) {
        const sx = n.x * scale + offsetX;
        const sy = n.y * scale + offsetY;

        for (const connId of n.connections) {
          const target = nodeMap.get(connId);
          if (!target || n.id > connId) continue;

          const tx = target.x * scale + offsetX;
          const ty = target.y * scale + offsetY;

          // Color by cluster relationship
          let strokeColor = "rgba(168, 85, 247, 0.25)";
          if (n.cluster === "cyan" || target.cluster === "cyan") {
            strokeColor = "rgba(0, 242, 254, 0.25)";
          } else if (n.cluster === "gold" || target.cluster === "gold") {
            strokeColor = "rgba(251, 191, 36, 0.22)";
          }

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Traveling pulse particle
          const pulseOffset = (pulseT + (n.id.charCodeAt(0) % 7) * 0.3) % 1;
          const px = sx + (tx - sx) * pulseOffset;
          const py = sy + (ty - sy) * pulseOffset;

          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = n.cluster === "cyan" ? "#00F2FE" : n.cluster === "gold" ? "#fbbf24" : "#c084fc";
          ctx.fill();
        }
      }

      // 3. Draw Nodes with Rings and Labels
      for (const n of nodes) {
        const nx = n.x * scale + offsetX;
        const ny = n.y * scale + offsetY;
        const r = n.radius * scale;

        // Outer glow aura
        ctx.beginPath();
        ctx.arc(nx, ny, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${n.color}25`;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        // Node outline
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        // Node Label Pill
        const isUserTarget = n.id === "user_014";
        const labelText = n.subLabel ? `${n.label} ${n.subLabel}` : n.label;

        ctx.font = `${Math.max(9, Math.round(11 * scale))}px monospace`;
        ctx.textAlign = "center";

        if (!isUserTarget) {
          // Label pill background
          const textWidth = ctx.measureText(labelText).width;
          ctx.fillStyle = "rgba(15, 18, 28, 0.75)";
          ctx.fillRect(nx - textWidth / 2 - 4, ny + r + 4, textWidth + 8, 14);

          ctx.fillStyle = n.color === "#ffffff" ? "#f1f5f9" : n.color;
          ctx.fillText(labelText, nx, ny + r + 15);
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [nodes, scaleFactor]);

  return (
    <div className="w-full bg-[#0d1017] rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col font-sans">
      {/* 1:1 Top Header Bar */}
      <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#121622]/80 backdrop-blur-md">
        {/* Left: Brand KOLIANCEEX */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-glow">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-base tracking-wider text-white">
            KOLIANCE<span className="text-purple-400">EX</span>
          </span>
        </div>

        {/* Center: Search Bar */}
        <div className="relative w-80 max-w-md hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search *IDs & Wallets*"
            className="w-full pl-10 pr-4 py-1.5 rounded-full bg-[#181d2c] border border-white/10 text-xs text-white placeholder-slate-400 font-mono focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* Right: Notifications & Wallet */}
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181d2c] border border-white/10 hover:border-purple-500/40 text-xs font-mono text-slate-300 transition">
            <Bell className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-bold">
              3
            </span>
          </button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181d2c] border border-white/10 text-xs font-mono text-white shadow-sm">
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            <span>0xAb12...eF90</span>
            <span className="text-slate-400 text-[11px]">(1.4 ETH)</span>
          </div>
        </div>
      </header>

      {/* Main Container: Left Rail + Center Constellation + Right Sidebar */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-[700px]">
        {/* Left Vertical Nav Rail */}
        <aside className="w-full lg:w-44 border-r border-white/10 p-3 bg-[#0f131d]/60 flex lg:flex-col justify-between shrink-0">
          <nav className="flex lg:flex-col gap-1.5 w-full">
            {[
              { id: "trust_graph", label: "Trust Graph", icon: <Share2 className="w-4 h-4" /> },
              { id: "id_protocol", label: "ID Protocol", icon: <Shield className="w-4 h-4" /> },
              { id: "networks", label: "Networks", icon: <Radio className="w-4 h-4" /> },
              { id: "settings_top", label: "Settings", icon: <Settings className="w-4 h-4" /> },
            ].map((item) => {
              const active = activeSideNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSideNav(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                    active
                      ? "bg-purple-600 text-white font-semibold shadow-glow"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="hidden lg:block pt-4 border-t border-white/10">
            <button className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white transition">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </aside>

        {/* Center: Trust Constellation Graph Stage */}
        <main className="flex-1 relative bg-gradient-to-b from-[#0e121b] to-[#0a0d14] flex flex-col justify-between min-h-[680px] overflow-hidden">
          {/* Top Control Bar inside Graph */}
          <div className="p-5 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold text-white tracking-wide">
              Trust Constellation Graph
            </h2>

            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded-lg bg-[#181d2c] border border-white/10 text-slate-300 hover:text-white transition">
                <Grid className="w-4 h-4" />
              </button>

              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181d2c] border border-white/10 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active</span>
              </button>

              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181d2c] border border-white/10 text-xs font-mono text-slate-300">
                <span>All Connections</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Constellation Canvas */}
          <div className="relative flex-1 w-full h-[580px]">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* 1:1 Floating Tooltip Card over user_014.trustgraph */}
            {activeTooltip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute left-[38%] top-[54%] w-60 rounded-xl bg-[#141824]/95 border border-purple-500/40 p-3.5 shadow-2xl backdrop-blur-xl z-20 space-y-2 pointer-events-auto font-sans"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="font-bold text-xs text-white font-mono">
                    user_014.trustgraph
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Trust Score</span>
                    <strong className="text-white font-mono">94.7</strong>
                  </div>

                  <div className="flex justify-between items-center text-slate-300">
                    <span>On-Chain ID</span>
                    <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
                      <Check className="w-3 h-3" />
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>219 Connections</span>
                    <strong className="text-white font-mono">219</strong>
                  </div>

                  <div className="flex justify-between items-center text-slate-300 pt-1">
                    <span>Verified Badges</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[9px]">
                        ✓
                      </span>
                      <span className="w-4 h-4 rounded-full bg-slate-300 text-black flex items-center justify-center text-[9px] font-bold">
                        ★
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bottom Left Zoom & Reset Controls */}
            <div className="absolute bottom-5 left-5 flex flex-col gap-1.5 z-10">
              <button
                onClick={() => setScaleFactor((s) => Math.min(s + 0.1, 1.4))}
                className="w-8 h-8 rounded-lg bg-[#161a26]/90 border border-white/10 hover:border-purple-500/40 text-slate-300 hover:text-white flex items-center justify-center transition shadow-lg"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setScaleFactor((s) => Math.max(s - 0.1, 0.7))}
                className="w-8 h-8 rounded-lg bg-[#161a26]/90 border border-white/10 hover:border-purple-500/40 text-slate-300 hover:text-white flex items-center justify-center transition shadow-lg"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setScaleFactor(1)}
                className="w-8 h-8 rounded-lg bg-[#161a26]/90 border border-white/10 hover:border-purple-500/40 text-slate-300 hover:text-white flex items-center justify-center transition shadow-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom Right 1:1 Network Activity Card */}
            <div className="absolute bottom-5 right-5 w-56 rounded-2xl bg-[#141926]/90 border border-white/10 p-3.5 backdrop-blur-md z-10 space-y-2.5 font-sans">
              <div className="flex items-center justify-between text-xs text-white font-semibold">
                <span>Network Activity</span>
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
              </div>

              {/* Sparkline Visual */}
              <div className="h-6 w-full flex items-end gap-1 px-1">
                {[30, 45, 60, 40, 75, 55, 90, 65, 80, 70, 85].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-cyan-500/30 to-cyan-400 rounded-t-sm"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <div className="space-y-1 text-[11px] font-mono border-t border-white/10 pt-2">
                <div className="flex justify-between text-slate-400">
                  <span>Gas:</span>
                  <strong className="text-white">18 gwei</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Nodes:</span>
                  <strong className="text-white">5,142</strong>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-white/10 pt-2 text-[10px] font-mono">
                <span className="text-slate-400 block font-sans text-[11px]">
                  ID Verification Status
                </span>
                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Active</span>
                    <span className="text-cyan-400 font-bold">99.1%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full w-[99.1%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>System</span>
                    <span className="text-purple-400 font-bold">99.3%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full w-[99.3%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>System Vitals</span>
                    <span className="text-slate-400">0%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-600 rounded-full w-[0%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar: 3 Stacked Cards (1:1 with Image 2) */}
        <aside className="w-full lg:w-84 border-l border-white/10 p-4 bg-[#101420]/70 flex flex-col gap-4 shrink-0 overflow-y-auto">
          {/* Card 1: Holographic Biometric ID Card */}
          <div className="rounded-2xl bg-[#141826] border border-white/10 p-4 space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>Holographic Biometric ID Card</span>
              <button className="text-slate-400 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar & Biometric Audio Scan */}
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-glow">
                <div className="w-full h-full rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                  <User className="w-7 h-7 text-cyan-300" />
                </div>
                <div className="absolute inset-0 border border-cyan-400/40 rounded-2xl animate-pulse pointer-events-none" />
              </div>

              <div className="flex-1 space-y-0.5">
                <span className="text-[10px] uppercase font-mono text-slate-400">User</span>
                <h4 className="font-bold text-white text-sm">Alex R. Thompson</h4>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  ID: kx_0x1a2b3c4d...
                </p>
                <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 pt-0.5">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span>Real-time biometric scan</span>
                </div>
              </div>
            </div>

            {/* Biometric Frequency Wave Bars */}
            <div className="flex items-center gap-1 h-3 px-1">
              {[20, 60, 90, 40, 80, 100, 70, 30, 85, 45, 65, 95, 40, 20].map((val, i) => (
                <div
                  key={i}
                  className="flex-1 bg-cyan-400/70 rounded-full"
                  style={{ height: `${val}%` }}
                />
              ))}
            </div>

            {/* Iridescent Verification Badges */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-400 block">
                Iridescent verification badges
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  VERIFIED
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">
                  KYC
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold">
                  ON-CHAIN
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-mono font-bold">
                  WEB3
                </span>
              </div>
            </div>

            {/* Trust Score 94.7% Progress Bar */}
            <div className="space-y-1 pt-1 border-t border-white/10">
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1 text-slate-300">
                  Trust Score <Info className="w-3 h-3 text-slate-400" />
                </span>
                <strong className="text-cyan-400 font-mono font-bold text-sm">94.7%</strong>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full w-[94.7%]" />
              </div>
            </div>
          </div>

          {/* Card 2: Cryptographic Proof Stream (Parameters Card) */}
          <div className="rounded-2xl bg-[#141826] border border-white/10 p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>Cryptographic Proof Stream</span>
              <button className="text-slate-400 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="space-y-1 text-slate-400">
                <div>
                  Hash: <strong className="text-white block font-mono">0x5c7b...f8e9</strong>
                </div>
                <div>
                  Block: <strong className="text-white block font-mono">1947214</strong>
                </div>
                <div>
                  Timestamp: <strong className="text-white block font-mono">14:02:49</strong>
                </div>
              </div>

              <div className="space-y-1 text-slate-400">
                <div>
                  Action: <strong className="text-emerald-400 block font-mono">Proof Issued</strong>
                </div>
                <div>
                  Hash:{" "}
                  <a
                    href="https://testnet.monadexplorer.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline block font-mono"
                  >
                    0x65958 &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Cryptographic Proof Stream (Table Ledger) */}
          <div className="rounded-2xl bg-[#141826] border border-white/10 p-4 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>Cryptographic Proof Stream</span>
              <button className="text-slate-400 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-400 grid grid-cols-12 border-b border-white/10 pb-1">
              <span className="col-span-5">Hash</span>
              <span className="col-span-4">Block</span>
              <span className="col-span-3 text-right">Time</span>
            </div>

            <div className="space-y-2 text-[11px] font-mono">
              {[
                { hash: "0x5c7b...f8e9", block: "Proof Issued", time: "0x65958" },
                { hash: "0x5c7b...f8e9", block: "1947214", time: "0x65958" },
                { hash: "0x5c7b...f8e9", block: "14:02:49", time: "0x65958" },
                { hash: "0x5c7b...f8e9", block: "Proof Issued", time: "0x65958" },
                { hash: "0x5c7b...f8e9", block: "Proof Issued", time: "0x65958" },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center text-slate-300">
                  <div className="col-span-5 flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span className="truncate">{row.hash}</span>
                  </div>
                  <span className="col-span-4 text-slate-400 truncate">{row.block}</span>
                  <a
                    href="https://testnet.monadexplorer.com"
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-3 text-cyan-400 text-right hover:underline truncate"
                  >
                    {row.time}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
