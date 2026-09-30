"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Shield,
  Layers,
  Sparkles,
  Database,
  CheckCircle2,
  Cpu,
  Radio,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import { monadTestnet } from "@/lib/contract";

interface EnergyCoreHeroProps {
  onLaunchDApps: () => void;
  onExploreDetails: () => void;
}

export function EnergyCoreHero({ onLaunchDApps, onExploreDetails }: EnergyCoreHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveTps, setLiveTps] = useState(10032);

  // Live TPS fluctuation around 10,000
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTps(Math.floor(10015 + Math.random() * 45));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // 3D Crystalline Amethyst Energy Sphere & Orbital Plasma Rings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 900);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 440);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight || 440;
    };
    window.addEventListener("resize", handleResize);

    // 3D Vertices for a multifaceted geodesic crystal core
    const phi = (1 + Math.sqrt(5)) / 2;
    const radius = Math.min(width * 0.17, 125);

    // 12 base icosahedron vertices
    const rawVertices: Array<[number, number, number]> = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ];

    // Normalize and scale to radius
    const vertices: Array<[number, number, number]> = rawVertices.map(([x, y, z]) => {
      const len = Math.sqrt(x * x + y * y + z * z);
      return [(x / len) * radius, (y / len) * radius, (z / len) * radius];
    });

    // 20 triangular faces of the icosahedron
    const faces: Array<[number, number, number]> = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    // Unique edges
    const edgeSet = new Set<string>();
    const edges: Array<[number, number]> = [];
    faces.forEach(([a, b, c]) => {
      [[a, b], [b, c], [c, a]].forEach(([p1, p2]) => {
        const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([p1, p2]);
        }
      });
    });

    // Orbital particles along 3 multi-axis plasma rings
    const ringParticles: Array<{
      ring: number;
      angle: number;
      speed: number;
      size: number;
      opacity: number;
      color: string;
    }> = [];

    const ringColors = [
      "#ffffff",
      "#00F2FE",
      "#38bdf8",
      "#a855f7",
      "#836EF9",
      "#c084fc",
    ];

    for (let i = 0; i < 160; i++) {
      ringParticles.push({
        ring: i % 3,
        angle: (i / 40) * Math.PI * 2 + Math.random() * 0.2,
        speed: 0.008 + (i % 3) * 0.003 + Math.random() * 0.003,
        size: Math.random() * 2.4 + 1.2,
        opacity: Math.random() * 0.5 + 0.5,
        color: ringColors[i % ringColors.length],
      });
    }

    // Background floating stardust particles
    const bgStars: Array<{ x: number; y: number; s: number; a: number; da: number }> = [];
    for (let i = 0; i < 40; i++) {
      bgStars.push({
        x: Math.random(),
        y: Math.random(),
        s: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.6 + 0.2,
        da: 0.005 * (Math.random() > 0.5 ? 1 : -1),
      });
    }

    let rotX = 0.25;
    let rotY = 0;
    let rotZ = 0.1;
    let mouseTiltX = 0;
    let mouseTiltY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseTiltX = (e.clientX - cx) * 0.0003;
      mouseTiltY = (e.clientY - cy) * 0.0003;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      rotX += 0.004 + mouseTiltY * 0.06;
      rotY += 0.007 + mouseTiltX * 0.06;
      rotZ += 0.0015;

      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Draw subtle background stardust
      for (const star of bgStars) {
        star.a += star.da;
        if (star.a > 0.8 || star.a < 0.2) star.da = -star.da;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.a})`;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Outermost Ambient Nebula Halo
      const outerHalo = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        radius * 3.2
      );
      outerHalo.addColorStop(0, "rgba(131, 110, 249, 0.45)");
      outerHalo.addColorStop(0.3, "rgba(0, 242, 254, 0.22)");
      outerHalo.addColorStop(0.65, "rgba(131, 110, 249, 0.08)");
      outerHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = outerHalo;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // 3. Project 3D vertices
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosZ = Math.cos(rotZ);
      const sinZ = Math.sin(rotZ);

      const projected = vertices.map(([x, y, z]) => {
        // Rotate Y
        let x1 = x * cosY + z * sinY;
        let y1 = y;
        let z1 = -x * sinY + z * cosY;

        // Rotate X
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        // Rotate Z
        let x3 = x2 * cosZ - y2 * sinZ;
        let y3 = x2 * sinZ + y2 * cosZ;
        let z3 = z2;

        const scale = 380 / (380 + z3);
        return {
          x: centerX + x3 * scale,
          y: centerY + y3 * scale,
          z: z3,
        };
      });

      // 4. Draw Faceted Crystal Polygons (Front to back sort)
      const sortedFaces = faces
        .map(([ia, ib, ic]) => {
          const pa = projected[ia];
          const pb = projected[ib];
          const pc = projected[ic];
          const avgZ = (pa.z + pb.z + pc.z) / 3;
          return { ia, ib, ic, pa, pb, pc, avgZ };
        })
        .sort((a, b) => a.avgZ - b.avgZ);

      for (const face of sortedFaces) {
        const { pa, pb, pc, avgZ } = face;
        const normZ = (avgZ + radius) / (radius * 2); // 0 to 1

        // Triangle surface
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.lineTo(pc.x, pc.y);
        ctx.closePath();

        // Shading with amethyst tint
        const fillAlpha = Math.max(0.12, normZ * 0.45);
        ctx.fillStyle = `rgba(131, 110, 249, ${fillAlpha})`;
        ctx.fill();

        // Edge stroke for facet definition
        ctx.strokeStyle = `rgba(192, 132, 252, ${Math.max(0.2, normZ * 0.7)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 5. Draw Glowing Crystal Edges
      for (const [i, j] of edges) {
        const p1 = projected[i];
        const p2 = projected[j];
        const avgZ = (p1.z + p2.z) / 2;
        const alpha = Math.max(0.25, (avgZ + radius) / (radius * 2) * 0.9);

        ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // 6. Draw Crystal Node Vertices
      for (const p of projected) {
        const alpha = Math.max(0.3, (p.z + radius) / (radius * 2));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 242, 254, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      // 7. Blinding Central Nuclear Flare (Exact match to target design)
      const coreFlare = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 1.05
      );
      coreFlare.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      coreFlare.addColorStop(0.12, "rgba(255, 255, 255, 0.95)");
      coreFlare.addColorStop(0.28, "rgba(0, 242, 254, 0.85)");
      coreFlare.addColorStop(0.48, "rgba(131, 110, 249, 0.65)");
      coreFlare.addColorStop(0.75, "rgba(131, 110, 249, 0.2)");
      coreFlare.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = coreFlare;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // 8. Draw 3 Multi-Axis Orbital Plasma Rings
      const ringConfigs = [
        { tiltX: 1.15, tiltZ: 0.35, rx: radius * 1.9, ry: radius * 0.65, color: "#836EF9" },
        { tiltX: -0.85, tiltZ: 0.65, rx: radius * 2.2, ry: radius * 0.75, color: "#00F2FE" },
        { tiltX: 0.45, tiltZ: -0.95, rx: radius * 2.45, ry: radius * 0.82, color: "#a78bfa" },
      ];

      for (let r = 0; r < ringConfigs.length; r++) {
        const ring = ringConfigs[r];
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotY * 0.35 + ring.tiltZ);
        ctx.scale(1, ring.tiltX > 0 ? 0.38 : -0.38);

        ctx.beginPath();
        ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(131, 110, 249, 0.22)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // 9. Draw Radiant Ring Particles & Plasma Trails
      for (const p of ringParticles) {
        p.angle += p.speed;
        const ring = ringConfigs[p.ring];
        const rx = ring.rx;
        const ry = ring.ry;

        const rawX = Math.cos(p.angle) * rx;
        const rawY = Math.sin(p.angle) * ry;

        const ringAngle = rotY * 0.35 + ring.tiltZ;
        const scaledY = rawY * (ring.tiltX > 0 ? 0.38 : -0.38);

        const px = centerX + rawX * Math.cos(ringAngle) - scaledY * Math.sin(ringAngle);
        const py = centerY + rawX * Math.sin(ringAngle) + scaledY * Math.cos(ringAngle);

        // Particle Glow
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative min-h-[92vh] flex flex-col justify-between pt-20 pb-8 overflow-hidden select-none">
      {/* Top Hero Brand Header & Typography */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 text-center pt-2 z-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.1] text-xs text-slate-300 shadow-glow mb-3 backdrop-blur-md"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-white font-bold tracking-wider">
            MONAD HIGH-THROUGHPUT ENGINE
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-cyan-400 font-mono">10,000 TPS Parallel Execution</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase font-sans leading-none"
        >
          KOLIANCE <span className="text-purple-400">//</span>{" "}
          <span className="text-gradient">TRUST ARCHITECTURE</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-xs sm:text-sm text-slate-400 font-mono tracking-widest uppercase mt-3 max-w-2xl mx-auto"
        >
          Sub-second cryptographic attestations &amp; decentralized identity on Monad
        </motion.p>
      </div>

      {/* Prominent 3D Geodesic Crystal Stage */}
      <div className="relative w-full max-w-5xl mx-auto h-[320px] sm:h-[400px] flex items-center justify-center my-1 z-10">
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-pointer"
          title="3D Crystalline Monad Parallel Energy Core"
        />

        {/* Orbiting Telemetry Badges */}
        <div className="absolute top-4 left-6 hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0f1322]/80 text-[11px] font-mono text-cyan-300 border border-cyan-500/30 shadow-[0_0_20px_rgba(0,242,254,0.2)] backdrop-blur-md">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>PARALLEL EVM CORE</span>
        </div>

        <div className="absolute bottom-6 right-6 hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0f1322]/80 text-[11px] font-mono text-purple-200 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)] backdrop-blur-md">
          <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>SINGLE-SLOT MONADBFT</span>
        </div>
      </div>

      {/* Bottom Floating Control Deck: 1:1 Match of 5 Cards in Target Image */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-stretch">
          {/* CARD 1: PARALLELIZED EXECUTION SPEEDOMETER */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="rounded-2xl p-4 bg-[#0d101d]/90 border border-white/[0.08] hover:border-cyan-400/60 hover:shadow-[0_16px_40px_rgba(0,242,254,0.25)] hover:-translate-y-2.5 hover:scale-[1.04] backdrop-blur-xl flex flex-col justify-between shadow-xl space-y-3 transition-all duration-300 cursor-pointer"
          >
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Speedometer</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            </div>

            <div className="flex items-center gap-3">
              {/* Radial Dial */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="url(#speedoGrad)"
                    strokeWidth="5"
                    strokeDasharray={163}
                    strokeDashoffset={163 - (163 * (liveTps / 10000)) * 0.78}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                  <defs>
                    <linearGradient id="speedoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00F2FE" />
                      <stop offset="60%" stopColor="#836EF9" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-mono text-cyan-300 font-bold">10k</span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black font-mono text-white tracking-tight">
                    {liveTps.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-cyan-400">TPS</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>OPERATIONAL</span>
                </div>
                <span className="text-[9px] font-mono text-slate-500 block">UPTIME: 20+ HOURS</span>
              </div>
            </div>

            <button
              onClick={onLaunchDApps}
              className="w-full py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-90 text-white font-mono text-[11px] font-bold transition shadow-glow hover:scale-[1.02] active:scale-[0.98]"
            >
              LAUNCH APP
            </button>
          </motion.div>

          {/* CARD 2: LIVE CONSENSUS STATUS */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-2xl p-4 bg-[#0d101d]/90 border border-white/[0.08] hover:border-emerald-400/60 hover:shadow-[0_16px_40px_rgba(52,211,153,0.25)] hover:-translate-y-2.5 hover:scale-[1.04] backdrop-blur-xl flex flex-col justify-between shadow-xl space-y-3 transition-all duration-300 cursor-pointer"
          >
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Live Consensus</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            {/* 4 Green Glow Slot Bars */}
            <div className="grid grid-cols-4 gap-1.5 py-1">
              {[1, 2, 3, 4].map((slot) => (
                <div
                  key={slot}
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"
                  style={{ animationDelay: `${slot * 0.2}s` }}
                />
              ))}
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>VALIDATORS:</span>
                <strong className="text-white">412 ACTIVE</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>BLOCKS:</span>
                <strong className="text-white">24.1M</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>MonadBFT</span>
              <a
                href={`${monadTestnet.blockExplorers.default.url}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-white flex items-center gap-1 transition"
              >
                Explorer &rarr;
              </a>
            </div>
          </motion.div>

          {/* CARD 3: ECOSYSTEM PROTOCOLS */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="rounded-2xl p-4 bg-[#0d101d]/90 border border-white/[0.08] hover:border-purple-400/60 hover:shadow-[0_16px_40px_rgba(168,85,247,0.25)] hover:-translate-y-2.5 hover:scale-[1.04] backdrop-blur-xl flex flex-col justify-between shadow-xl space-y-3 transition-all duration-300"
          >
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Ecosystem</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center">
              <button
                onClick={onLaunchDApps}
                className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition group"
                title="DApps"
              >
                <Layers className="w-4 h-4 text-purple-300 group-hover:text-white mx-auto mb-0.5" />
                <span className="text-[9px] font-mono text-slate-400 group-hover:text-white block">DApps</span>
              </button>

              <button
                onClick={onExploreDetails}
                className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition group"
                title="DeFi"
              >
                <Zap className="w-4 h-4 text-cyan-300 group-hover:text-white mx-auto mb-0.5" />
                <span className="text-[9px] font-mono text-slate-400 group-hover:text-white block">DeFi</span>
              </button>

              <button
                onClick={onExploreDetails}
                className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition group"
                title="Oracle"
              >
                <Database className="w-4 h-4 text-indigo-300 group-hover:text-white mx-auto mb-0.5" />
                <span className="text-[9px] font-mono text-slate-400 group-hover:text-white block">Oracle</span>
              </button>

              <button
                onClick={onLaunchDApps}
                className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition group"
                title="Identity"
              >
                <Shield className="w-4 h-4 text-emerald-400 group-hover:text-white mx-auto mb-0.5" />
                <span className="text-[9px] font-mono text-slate-400 group-hover:text-white block">ID</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Status</span>
              <span className="text-emerald-400">All Live</span>
            </div>
          </motion.div>

          {/* CARD 4: NETWORK PERFORMANCE */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="rounded-2xl p-4 bg-[#0d101d]/90 border border-white/[0.08] hover:border-cyan-400/60 hover:shadow-[0_16px_40px_rgba(0,242,254,0.25)] hover:-translate-y-2.5 hover:scale-[1.04] backdrop-blur-xl flex flex-col justify-between shadow-xl space-y-3 transition-all duration-300 cursor-pointer"
          >
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Performance</span>
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Latency:</span>
                <strong className="text-white">0.8s</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gas:</span>
                <strong className="text-emerald-400">Low (&lt;0.001)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nodes:</span>
                <strong className="text-white">5.3K Global</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Ping</span>
              <span className="text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> 12ms
              </span>
            </div>
          </motion.div>

          {/* CARD 5: RECENT BLOCKS TABLE */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="rounded-2xl p-4 bg-[#0d101d]/90 border border-white/[0.08] hover:border-indigo-400/60 hover:shadow-[0_16px_40px_rgba(99,102,241,0.25)] hover:-translate-y-2.5 hover:scale-[1.04] backdrop-blur-xl flex flex-col justify-between shadow-xl space-y-3 transition-all duration-300 cursor-pointer"
          >
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Recent Blocks</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between py-0.5 border-b border-white/[0.04]">
                <div>
                  <span className="text-slate-300 font-bold block">0x2a57...1983</span>
                  <span className="text-[9px] text-purple-400">TrustAttest</span>
                </div>
                <span className="text-emerald-400 font-bold">$30.80M</span>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <div>
                  <span className="text-slate-300 font-bold block">0x2a57...1783</span>
                  <span className="text-[9px] text-cyan-400">IdentityReg</span>
                </div>
                <span className="text-cyan-300 font-bold">$5.39K</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
              <a
                href={`${monadTestnet.blockExplorers.default.url}/blocks`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                <span>View all blocks</span>
                <span>&rarr;</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
