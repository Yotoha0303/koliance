"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  Lock,
  Globe,
  CheckCircle2,
  Cpu,
  Radio,
} from "lucide-react";
import { monadTestnet } from "@/lib/contract";

interface EnergyCoreHeroProps {
  onLaunchDApps: () => void;
  onExploreDetails: () => void;
}

export function EnergyCoreHero({ onLaunchDApps, onExploreDetails }: EnergyCoreHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveTps, setLiveTps] = useState(10032);
  const [activeBlocks, setActiveBlocks] = useState([
    { hash: "0x2a57...1983", method: "TrustAttest", value: "$30.80M", time: "1s ago" },
    { hash: "0x2a57...1793", method: "IdentityReg", value: "$5.39K", time: "2s ago" },
  ]);

  // Live TPS fluctuation around 10,000
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTps(Math.floor(10010 + Math.random() * 45));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // 3D Crystalline Energy Sphere & Orbital Plasma Rings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 420);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight || 420;
    };
    window.addEventListener("resize", handleResize);

    // 3D Vertices for a multifaceted geodesic crystal core
    const vertices: Array<[number, number, number]> = [];
    const phi = (1 + Math.sqrt(5)) / 2;
    const radius = Math.min(width * 0.16, 115);

    // Icosahedron base vertices
    const basePoints: Array<[number, number, number]> = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ];

    // Normalize and scale
    basePoints.forEach(([x, y, z]) => {
      const len = Math.sqrt(x * x + y * y + z * z);
      vertices.push([(x / len) * radius, (y / len) * radius, (z / len) * radius]);
    });

    // Edges between icosahedron vertices
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const dx = basePoints[i][0] - basePoints[j][0];
        const dy = basePoints[i][1] - basePoints[j][1];
        const dz = basePoints[i][2] - basePoints[j][2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (Math.abs(dist - 2) < 0.1) {
          edges.push([i, j]);
        }
      }
    }

    // Orbital particles along 3 multi-axis rings
    const ringParticles: Array<{
      ring: number;
      angle: number;
      speed: number;
      size: number;
      color: string;
    }> = [];

    const ringColors = ["#836EF9", "#00F2FE", "#a78bfa", "#38bdf8", "#ffffff"];
    for (let i = 0; i < 110; i++) {
      ringParticles.push({
        ring: i % 3,
        angle: (i / 36) * Math.PI * 2,
        speed: 0.009 + (i % 3) * 0.004,
        size: Math.random() * 2.2 + 1.2,
        color: ringColors[i % ringColors.length],
      });
    }

    let rotX = 0.2;
    let rotY = 0;
    let rotZ = 0;
    let mouseTiltX = 0;
    let mouseTiltY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseTiltX = (e.clientX - cx) * 0.0004;
      mouseTiltY = (e.clientY - cy) * 0.0004;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      rotX += 0.004 + mouseTiltY * 0.08;
      rotY += 0.007 + mouseTiltX * 0.08;
      rotZ += 0.002;

      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Draw glowing ambient core back-light
      const ambientGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        radius * 2.5
      );
      ambientGlow.addColorStop(0, "rgba(131, 110, 249, 0.4)");
      ambientGlow.addColorStop(0.3, "rgba(0, 242, 254, 0.2)");
      ambientGlow.addColorStop(0.7, "rgba(131, 110, 249, 0.05)");
      ambientGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Project 3D vertices
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

        const scale = 360 / (360 + z3);
        return {
          x: centerX + x3 * scale,
          y: centerY + y3 * scale,
          z: z3,
        };
      });

      // 3. Draw Crystal Edges with depth glow
      ctx.lineWidth = 1.4;
      for (const [i, j] of edges) {
        const p1 = projected[i];
        const p2 = projected[j];
        const avgZ = (p1.z + p2.z) / 2;
        const alpha = Math.max(0.18, (avgZ + radius) / (radius * 2) * 0.85);

        ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // 4. Draw Crystal Nodes (Vertices)
      for (const p of projected) {
        const alpha = Math.max(0.3, (p.z + radius) / (radius * 2));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 242, 254, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      // 5. Draw 3 Multi-Axis Orbital Plasma Rings
      const ringConfigs = [
        { tiltX: 1.1, tiltZ: 0.3, rx: radius * 1.85, ry: radius * 0.65, color: "#836EF9" },
        { tiltX: -0.8, tiltZ: 0.6, rx: radius * 2.1, ry: radius * 0.72, color: "#00F2FE" },
        { tiltX: 0.4, tiltZ: -0.9, rx: radius * 2.3, ry: radius * 0.8, color: "#a78bfa" },
      ];

      for (let r = 0; r < ringConfigs.length; r++) {
        const ring = ringConfigs[r];
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotY * 0.4 + ring.tiltZ);
        ctx.scale(1, ring.tiltX > 0 ? 0.38 : -0.38);

        ctx.beginPath();
        ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(131, 110, 249, 0.16)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // 6. Draw Ring Particles
      for (const p of ringParticles) {
        p.angle += p.speed;
        const ring = ringConfigs[p.ring];
        const rx = ring.rx;
        const ry = ring.ry;

        const rawX = Math.cos(p.angle) * rx;
        const rawY = Math.sin(p.angle) * ry;

        const ringAngle = rotY * 0.4 + ring.tiltZ;
        const scaledY = rawY * (ring.tiltX > 0 ? 0.38 : -0.38);

        const px = centerX + rawX * Math.cos(ringAngle) - scaledY * Math.sin(ringAngle);
        const py = centerY + rawX * Math.sin(ringAngle) + scaledY * Math.cos(ringAngle);

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
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
    <div className="relative min-h-[90vh] flex flex-col justify-between pt-24 pb-10 overflow-hidden">
      {/* Brand Header & Headline */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 text-center pt-2 z-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border border-monad-500/30 text-xs text-monad-200 shadow-glow mb-3"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-white font-bold tracking-wider">
            MONAD HIGH-THROUGHPUT ENGINE
          </span>
          <span className="text-monad-400">|</span>
          <span className="text-cyber-accent font-mono">10,000 TPS Parallel Execution</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white uppercase font-sans leading-none"
        >
          KOLIANCE <span className="text-monad-400">//</span>{" "}
          <span className="text-gradient">TRUST ARCHITECTURE</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-xs sm:text-sm text-monad-300/80 font-mono tracking-widest uppercase mt-3 max-w-xl mx-auto"
        >
          Sub-second cryptographic attestations &amp; decentralized identity on Monad
        </motion.p>
      </div>

      {/* Prominent 3D Geodesic Crystal Hero Stage (Guaranteed Visible) */}
      <div className="relative w-full max-w-5xl mx-auto h-[320px] sm:h-[400px] flex items-center justify-center my-1 z-10">
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-pointer"
          title="3D Crystalline Monad Parallel Energy Core"
        />

        {/* Orbiting Telemetry Badges */}
        <div className="absolute top-4 left-6 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel text-[11px] font-mono text-cyan-300 border border-cyan-500/30 shadow-glow">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>PARALLEL EVM CORE</span>
        </div>

        <div className="absolute bottom-6 right-6 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel text-[11px] font-mono text-monad-200 border border-monad-500/30 shadow-glow">
          <Radio className="w-3.5 h-3.5 text-purple-400" />
          <span>SINGLE-SLOT MONADBFT</span>
        </div>
      </div>

      {/* Bottom Floating Control & Telemetry Deck */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Ecosystem Protocols (Left 3 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-3 glass-panel-glow rounded-2xl p-4 border border-monad-500/30 text-left space-y-3"
          >
            <div className="text-[11px] font-mono text-monad-300/80 uppercase tracking-wider flex items-center justify-between">
              <span>Ecosystem Protocols</span>
              <Sparkles className="w-3.5 h-3.5 text-cyber-accent" />
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <button
                onClick={onLaunchDApps}
                className="p-2 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Layers className="w-4 h-4 text-monad-300 group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">DApps</span>
              </button>

              <button
                onClick={onExploreDetails}
                className="p-2 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Zap className="w-4 h-4 text-cyber-accent group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">DeFi</span>
              </button>

              <button
                onClick={onExploreDetails}
                className="p-2 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Database className="w-4 h-4 text-purple-300 group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">Oracle</span>
              </button>

              <button
                onClick={onLaunchDApps}
                className="p-2 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Shield className="w-4 h-4 text-emerald-400 group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">Identity</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-monad-400/80 pt-1 border-t border-monad-500/20">
              <span>Latency: <strong className="text-white">0.8s</strong></span>
              <span>Gas: <strong className="text-emerald-400">Low</strong></span>
              <span>Nodes: <strong className="text-white">5.3K</strong></span>
            </div>
          </motion.div>

          {/* 10,000 TPS Speedometer Dial (Center 6 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-6 glass-panel-glow rounded-2xl p-4 sm:p-5 border border-monad-500/30 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            {/* Speedometer Radial Gauge */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="rgba(131, 110, 249, 0.15)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="url(#speedGradient)"
                  strokeWidth="8"
                  strokeDasharray={289}
                  strokeDashoffset={289 - (289 * (liveTps / 10000)) * 0.75}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00F2FE" />
                    <stop offset="50%" stopColor="#836EF9" />
                    <stop offset="100%" stopColor="#ff007a" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <Activity className="w-4 h-4 text-cyber-accent animate-pulse mb-0.5" />
                <span className="text-[10px] font-mono text-monad-300/80 uppercase">TPS</span>
              </div>
            </div>

            {/* Readout Numbers & Launch Action */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <span className="text-[11px] font-mono text-monad-300 uppercase tracking-wider block">
                Parallelized Execution Speedometer
              </span>
              <div className="flex items-baseline justify-center sm:justify-start gap-2">
                <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                  {liveTps.toLocaleString()}
                </span>
                <span className="text-xs font-mono font-bold text-cyber-accent">TPS</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-3 text-xs font-mono text-monad-400">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Operational
                </span>
                <span>Uptime: <strong className="text-white">20+ Hours</strong></span>
              </div>
            </div>

            <button
              onClick={onLaunchDApps}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-monad-600 via-monad-500 to-cyber-neon hover:opacity-90 text-white font-mono text-xs font-bold transition shadow-glow hover:scale-105 active:scale-95 shrink-0"
            >
              LAUNCH APP
            </button>
          </motion.div>

          {/* Live Consensus Status (Right 3 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-3 glass-panel-glow rounded-2xl p-4 border border-monad-500/30 text-left space-y-3"
          >
            <div className="text-[11px] font-mono text-monad-300/80 uppercase tracking-wider flex items-center justify-between">
              <span>Live Consensus Status</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="grid grid-cols-4 gap-1.5 py-1">
              {[1, 2, 3, 4].map((slot) => (
                <div
                  key={slot}
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-sm animate-pulse"
                  style={{ animationDelay: `${slot * 0.25}s` }}
                />
              ))}
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-monad-300/90">
                <span>Validators Active:</span>
                <strong className="text-white">412</strong>
              </div>
              <div className="flex justify-between text-monad-300/90">
                <span>Blocks Processed:</span>
                <strong className="text-white">24.1M</strong>
              </div>
            </div>

            <div className="pt-1.5 border-t border-monad-500/20 flex items-center justify-between text-[11px] font-mono text-monad-400">
              <span>MonadBFT Consensus</span>
              <a
                href={`${monadTestnet.blockExplorers.default.url}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white flex items-center gap-1 transition"
              >
                Explorer &rarr;
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
