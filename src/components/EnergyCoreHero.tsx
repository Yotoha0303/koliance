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
} from "lucide-react";
import { monadTestnet } from "@/lib/contract";

interface EnergyCoreHeroProps {
  onLaunchDApps: () => void;
  onExploreDetails: () => void;
}

export function EnergyCoreHero({ onLaunchDApps, onExploreDetails }: EnergyCoreHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveTps, setLiveTps] = useState(10000);
  const [activeBlocks, setActiveBlocks] = useState([
    { hash: "0x2a57...1983", method: "TrustAttest", value: "$30.80M", time: "1s ago" },
    { hash: "0x2a57...1793", method: "IdentityReg", value: "$5.39K", time: "2s ago" },
  ]);

  // Subtle live TPS fluctuation around 10k
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTps(Math.floor(9950 + Math.random() * 85));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // 3D Crystalline Energy Sphere & Orbital Rings Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = Math.min(window.innerHeight * 0.95, 820));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = Math.min(window.innerHeight * 0.95, 820);
    };
    window.addEventListener("resize", handleResize);

    // 3D Vertices for a multifaceted geodesic crystal core
    const vertices: Array<[number, number, number]> = [];
    const phi = (1 + Math.sqrt(5)) / 2;
    const radius = Math.min(width * 0.14, 130);

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

    // Orbital particles along 3 rings
    const ringParticles: Array<{
      ring: number;
      angle: number;
      speed: number;
      size: number;
      color: string;
    }> = [];

    const ringColors = ["#836EF9", "#00F2FE", "#a78bfa", "#ff007a", "#ffffff"];
    for (let i = 0; i < 90; i++) {
      ringParticles.push({
        ring: i % 3,
        angle: (i / 30) * Math.PI * 2,
        speed: 0.008 + (i % 3) * 0.003,
        size: Math.random() * 2 + 1,
        color: ringColors[i % ringColors.length],
      });
    }

    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;
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
    let isVisible = true;

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(render);
      }
    });
    observer.observe(canvas);

    const render = () => {
      if (!isVisible) return;

      ctx.clearRect(0, 0, width, height);

      rotX += 0.004 + mouseTiltY * 0.1;
      rotY += 0.006 + mouseTiltX * 0.1;
      rotZ += 0.002;

      const centerX = width / 2;
      const centerY = height * 0.38;

      // 1. Draw glowing ambient core back-light
      const ambientGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        radius * 2.8
      );
      ambientGlow.addColorStop(0, "rgba(131, 110, 249, 0.45)");
      ambientGlow.addColorStop(0.35, "rgba(160, 5, 93, 0.2)");
      ambientGlow.addColorStop(0.7, "rgba(0, 242, 254, 0.08)");
      ambientGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // 2. Rotate & Project 3D Crystal Vertices
      const projected: Array<{ x: number; y: number; z: number }> = [];

      for (const [x, y, z] of vertices) {
        // Rotate Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        // Rotate X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        // Rotate Z
        const cosZ = Math.cos(rotZ);
        const sinZ = Math.sin(rotZ);
        const x3 = x1 * cosZ - y2 * sinZ;
        const y3 = x1 * sinZ + y2 * cosZ;

        // Perspective projection
        const fov = 400;
        const scale = fov / (fov + z2 + 250);
        projected.push({
          x: centerX + x3 * scale,
          y: centerY + y3 * scale,
          z: z2,
        });
      }

      // Draw crystal wireframe facets
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < radius * radius * 1.5) {
            const avgZ = (projected[i].z + projected[j].z) / 2;
            const alpha = Math.max(0.1, (avgZ + radius) / (radius * 2)) * 0.65;

            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.strokeStyle = `rgba(168, 140, 255, ${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      // Draw crystal facet vertices (sparkling nodes)
      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#836EF9";
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 3. Draw Multiple 3D Orbital Rings (Plasma Bands)
      const ringConfigs = [
        { rx: radius * 2.3, ry: radius * 0.75, tilt: -0.38, stroke: "rgba(131, 110, 249, 0.45)" },
        { rx: radius * 2.1, ry: radius * 0.65, tilt: 0.45, stroke: "rgba(0, 242, 254, 0.4)" },
        { rx: radius * 2.5, ry: radius * 0.85, tilt: 0.15, stroke: "rgba(196, 181, 253, 0.3)" },
      ];

      ringConfigs.forEach((cfg) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(cfg.tilt);
        ctx.beginPath();
        ctx.ellipse(0, 0, cfg.rx, cfg.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = cfg.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });

      // 4. Draw Orbiting Photons on the Rings
      for (const p of ringParticles) {
        p.angle += p.speed;
        const cfg = ringConfigs[p.ring];

        // Orbit in ellipse coordinates
        const ex = Math.cos(p.angle) * cfg.rx;
        const ey = Math.sin(p.angle) * cfg.ry;

        // Apply tilt rotation
        const cosT = Math.cos(cfg.tilt);
        const sinT = Math.sin(cfg.tilt);
        const px = centerX + (ex * cosT - ey * sinT);
        const py = centerY + (ex * sinT + ey * cosT);

        // Draw particle
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative min-h-[92vh] flex flex-col justify-between pt-24 pb-8 overflow-hidden">
      {/* 3D Crystalline Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none -z-10 w-full h-full"
      />

      {/* Brand Header & Headline */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 text-center pt-2">
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border border-monad-500/30 text-xs text-monad-200 shadow-glow mb-4"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-white font-bold tracking-wider">
            MONAD HIGH-THROUGHPUT ENGINE
          </span>
          <span className="text-monad-400">|</span>
          <span className="text-cyber-accent font-mono">10,000 TPS Parallel Execution</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white uppercase font-sans"
        >
          KOLIANCE <span className="text-monad-400">//</span>{" "}
          <span className="text-gradient">TRUST ARCHITECTURE</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="text-xs sm:text-sm text-monad-300/80 font-mono tracking-widest uppercase mt-2 max-w-xl mx-auto"
        >
          Sub-second cryptographic attestations &amp; decentralized identity on Monad
        </motion.p>
      </div>

      {/* Empty Spacer to reveal the 3D Crystalline Center */}
      <div className="h-44 sm:h-64 pointer-events-none" />

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
                className="p-2.5 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Layers className="w-4 h-4 text-monad-300 group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">DApps</span>
              </button>

              <button
                onClick={onExploreDetails}
                className="p-2.5 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Zap className="w-4 h-4 text-cyber-accent group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">DeFi</span>
              </button>

              <button
                onClick={onExploreDetails}
                className="p-2.5 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Database className="w-4 h-4 text-purple-300 group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">Oracle</span>
              </button>

              <button
                onClick={onLaunchDApps}
                className="p-2.5 rounded-xl bg-monad-950/60 hover:bg-monad-900/60 border border-monad-500/20 hover:border-monad-400/50 transition group"
              >
                <Shield className="w-4 h-4 text-emerald-400 group-hover:text-white mx-auto mb-1" />
                <span className="text-[10px] font-mono text-monad-400 group-hover:text-white">Identity</span>
              </button>
            </div>

            <div className="pt-2 border-t border-monad-500/20 flex items-center justify-between text-[11px] font-mono">
              <span className="text-monad-400">Latency: <b className="text-white">0.8s</b></span>
              <span className="text-monad-400">Gas: <b className="text-emerald-400">Low</b></span>
              <span className="text-monad-400">Nodes: <b className="text-white">5.3K</b></span>
            </div>
          </motion.div>

          {/* 10,000 TPS Speedometer (Center 6 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="lg:col-span-6 glass-panel-glow rounded-3xl p-5 border border-monad-400/40 shadow-glow relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Radial Arc Gauge Graphic */}
              <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="rgba(131, 110, 249, 0.2)"
                    strokeWidth="8"
                    strokeDasharray="188 63"
                  />
                  {/* Active Neon Gauge Fill */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="8"
                    strokeDasharray="180 70"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00F2FE" />
                      <stop offset="60%" stopColor="#836EF9" />
                      <stop offset="100%" stopColor="#ff007a" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Pulsing Gauge Core */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <Activity className="w-5 h-5 text-cyber-accent animate-pulse" />
                  <span className="text-[10px] font-mono text-monad-300 font-bold mt-0.5">TPS</span>
                </div>
              </div>

              {/* Central Speedometer Metrics */}
              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="flex items-center justify-center sm:justify-between">
                  <span className="text-[11px] font-mono text-monad-300/80 uppercase tracking-widest">
                    PARALLELIZED EXECUTION SPEEDOMETER
                  </span>
                </div>

                <div className="flex items-baseline justify-center sm:justify-start gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight text-gradient">
                    {liveTps.toLocaleString()}
                  </span>
                  <span className="text-sm font-mono text-cyber-accent font-bold">TPS</span>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    OPERATIONAL
                  </span>
                  <span className="text-[11px] font-mono text-monad-400">
                    Uptime: <b className="text-monad-200">20+ Hours</b>
                  </span>
                </div>
              </div>

              {/* Action Trigger */}
              <button
                onClick={onLaunchDApps}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-bold text-xs uppercase tracking-wider shadow-glow hover:shadow-glow-lg transition shrink-0 active:scale-95"
              >
                Launch App
              </button>
            </div>
          </motion.div>

          {/* Live Consensus Status (Right 3 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-3 glass-panel-glow rounded-2xl p-4 border border-monad-500/30 text-left space-y-3"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-monad-300/80">
              <span className="uppercase tracking-wider">Live Consensus Status</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            {/* Segmented LED Bars */}
            <div className="grid grid-cols-5 gap-1.5 py-1">
              <div className="h-2 rounded-full bg-emerald-400 shadow-glow" />
              <div className="h-2 rounded-full bg-emerald-400 shadow-glow" />
              <div className="h-2 rounded-full bg-emerald-400 shadow-glow" />
              <div className="h-2 rounded-full bg-emerald-400 shadow-glow" />
              <div className="h-2 rounded-full bg-emerald-400/40" />
            </div>

            <div className="space-y-1.5 pt-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-monad-400">Validators Active:</span>
                <span className="text-white font-bold">412</span>
              </div>
              <div className="flex justify-between">
                <span className="text-monad-400">Blocks Processed:</span>
                <span className="text-cyber-accent font-bold">24.1M</span>
              </div>
            </div>

            <div className="pt-2 border-t border-monad-500/20 flex items-center justify-between text-[10px] font-mono text-monad-400">
              <span>MonadBFT Consensus</span>
              <a
                href={monadTestnet.blockExplorers.default.url}
                target="_blank"
                rel="noreferrer"
                className="text-monad-300 hover:text-white transition flex items-center gap-1"
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
