"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { Sparkles, ShieldCheck, Zap, Activity, ArrowRight, Layers } from "lucide-react";

interface HeroGsapProps {
  onRegisterClick: () => void;
  onExploreClick: () => void;
}

export function HeroGsap({ onRegisterClick, onExploreClick }: HeroGsapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtextRef = useRef<HTMLParagraphElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // 1. GSAP Particle Constellation Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight * 0.85);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight * 0.85;
    };
    window.addEventListener("resize", handleResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      alpha: number;
    }> = [];

    const colors = ["#836EF9", "#A0055D", "#00F2FE", "#a78bfa"];
    const count = Math.min(Math.floor(width / 18), 70);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.6 + 0.2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(131, 110, 249, ${0.15 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 2. GSAP Entrance Timeline
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: -20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, delay: 0.2 }
      )
        .fromTo(
          headlineRef.current,
          { opacity: 0, y: 40, filter: "blur(10px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 1 },
          "-=0.4"
        )
        .fromTo(
          subtextRef.current,
          { opacity: 0, y: 25 },
          { opacity: 1, y: 0, duration: 0.8 },
          "-=0.6"
        )
        .fromTo(
          buttonsRef.current,
          { opacity: 0, y: 20, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.7 },
          "-=0.5"
        )
        .fromTo(
          statsRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8 },
          "-=0.4"
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative pt-32 pb-20 overflow-hidden flex flex-col items-center text-center px-4">
      {/* Dynamic Background Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none -z-10 opacity-70"
      />

      {/* Decorative radial glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-monad-600/20 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-cyber-accent/15 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Futuristic Monad Badge */}
      <div
        ref={badgeRef}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border border-monad-400/40 text-xs text-monad-200 shadow-glow mb-6"
      >
        <Sparkles className="w-3.5 h-3.5 text-cyber-accent animate-spin" style={{ animationDuration: "6s" }} />
        <span className="font-semibold tracking-wide text-white">NEXT-GEN ON-CHAIN TRUST</span>
        <span className="text-monad-400">|</span>
        <span className="text-monad-300 font-mono">10,000 TPS Monad Engine</span>
      </div>

      {/* Kinetic Headline */}
      <h1
        ref={headlineRef}
        className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight max-w-4xl text-white leading-[1.1] mb-6"
      >
        Decentralized <span className="text-gradient">Identity & Trust</span> Architecture
      </h1>

      {/* Subtitle */}
      <p
        ref={subtextRef}
        className="max-w-2xl text-base sm:text-lg text-monad-200/80 mb-10 font-normal leading-relaxed"
      >
        Koliance leverages Monad&apos;s parallelized EVM execution to establish verifiable, cryptographic, sub-second
        identity attestations and decentralized trust credentials.
      </p>

      {/* Call to Actions */}
      <div
        ref={buttonsRef}
        className="flex flex-wrap items-center justify-center gap-4 mb-16"
      >
        <button
          onClick={onRegisterClick}
          className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-xl bg-gradient-to-r from-monad-600 via-monad-500 to-monad-600 hover:from-monad-500 hover:to-monad-400 text-white font-semibold text-sm shadow-glow hover:shadow-glow-lg transition-all duration-300 active:scale-95"
        >
          <ShieldCheck className="w-4 h-4 text-cyber-accent" />
          <span>Register Identity</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={onExploreClick}
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl glass-panel hover:bg-monad-900/40 border border-monad-500/30 hover:border-monad-400/60 text-monad-200 hover:text-white font-medium text-sm transition-all duration-300"
        >
          <Layers className="w-4 h-4" />
          <span>Explore Trust Graph</span>
        </button>
      </div>

      {/* Live Monad Network Benchmarks */}
      <div
        ref={statsRef}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl"
      >
        <div className="glass-panel rounded-2xl p-4 border border-monad-500/20 text-left">
          <div className="flex items-center justify-between text-monad-400 text-xs mb-1 font-mono">
            <span>NETWORK SPEED</span>
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono flex items-baseline gap-1">
            <span>10,000</span>
            <span className="text-xs text-emerald-400 font-normal">TPS</span>
          </div>
          <p className="text-[11px] text-monad-300/60 mt-1">Parallelized EVM</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-monad-500/20 text-left">
          <div className="flex items-center justify-between text-monad-400 text-xs mb-1 font-mono">
            <span>FINALITY</span>
            <Activity className="w-3.5 h-3.5 text-cyber-accent" />
          </div>
          <div className="text-2xl font-bold text-white font-mono flex items-baseline gap-1">
            <span>~1.0</span>
            <span className="text-xs text-cyber-accent font-normal">SEC</span>
          </div>
          <p className="text-[11px] text-monad-300/60 mt-1">Single-slot finality</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-monad-500/20 text-left">
          <div className="flex items-center justify-between text-monad-400 text-xs mb-1 font-mono">
            <span>CONSENSUS</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            <span>MonadBFT</span>
          </div>
          <p className="text-[11px] text-monad-300/60 mt-1">Pipelined execution</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-monad-500/20 text-left">
          <div className="flex items-center justify-between text-monad-400 text-xs mb-1 font-mono">
            <span>COMPATIBILITY</span>
            <Layers className="w-3.5 h-3.5 text-monad-300" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            <span>100% EVM</span>
          </div>
          <p className="text-[11px] text-monad-300/60 mt-1">Solidity 0.8.31 Native</p>
        </div>
      </div>
    </div>
  );
}
