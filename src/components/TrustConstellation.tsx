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
} from "lucide-react";
import { monadTestnet } from "@/lib/contract";
import { truncateAddress } from "@/lib/utils";

interface ConstellationNode {
  id: string;
  label: string;
  address: string;
  category: "validator" | "ai_agent" | "oracle" | "protocol" | "user";
  trustScore: number; // 0 - 100
  stake: string;
  attestations: number;
  status: "active" | "validating" | "syncing";
  latency: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  connections: string[];
}

const INITIAL_NODES: ConstellationNode[] = [
  {
    id: "genesis",
    label: "Monad Parallel Engine",
    address: "0x00000000000000000000000000000000000010143",
    category: "validator",
    trustScore: 99.9,
    stake: "1,500,000 MON",
    attestations: 12480,
    status: "validating",
    latency: "0.2ms",
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 12,
    color: "#836EF9",
    connections: ["val-1", "val-2", "val-3", "ai-1", "oracle-1", "koliance-core"],
  },
  {
    id: "val-1",
    label: "Consensus Leader #01",
    address: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    category: "validator",
    trustScore: 99.4,
    stake: "420,000 MON",
    attestations: 4321,
    status: "validating",
    latency: "0.4ms",
    x: -120,
    y: -80,
    z: 40,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 8,
    color: "#00F2FE",
    connections: ["genesis", "val-2", "ai-1"],
  },
  {
    id: "val-2",
    label: "Monad Validator #02",
    address: "0x250b7305986c7C0D0190Fe0141a0F911b333E43D",
    category: "validator",
    trustScore: 98.7,
    stake: "380,000 MON",
    attestations: 3890,
    status: "validating",
    latency: "0.5ms",
    x: 130,
    y: -70,
    z: -30,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 7.5,
    color: "#00F2FE",
    connections: ["genesis", "val-3", "koliance-core"],
  },
  {
    id: "val-3",
    label: "Monad Validator #03",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    category: "validator",
    trustScore: 97.9,
    stake: "310,000 MON",
    attestations: 2950,
    status: "validating",
    latency: "0.6ms",
    x: -90,
    y: 110,
    z: -40,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 7,
    color: "#00F2FE",
    connections: ["genesis", "val-1", "oracle-1"],
  },
  {
    id: "ai-1",
    label: "Sentinel AI Audit Agent",
    address: "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98",
    category: "ai_agent",
    trustScore: 96.8,
    stake: "150,000 MON",
    attestations: 8940,
    status: "active",
    latency: "0.8ms",
    x: -160,
    y: 20,
    z: 70,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 8.5,
    color: "#a78bfa",
    connections: ["genesis", "val-1", "ai-2", "koliance-core"],
  },
  {
    id: "ai-2",
    label: "ZKP Prover Sentinel",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    category: "ai_agent",
    trustScore: 98.2,
    stake: "200,000 MON",
    attestations: 6420,
    status: "active",
    latency: "0.3ms",
    x: -70,
    y: -140,
    z: -60,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 7,
    color: "#a78bfa",
    connections: ["ai-1", "genesis"],
  },
  {
    id: "oracle-1",
    label: "zkState Oracle Node",
    address: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
    category: "oracle",
    trustScore: 95.9,
    stake: "120,000 MON",
    attestations: 5120,
    status: "active",
    latency: "1.1ms",
    x: 140,
    y: 90,
    z: 60,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 7,
    color: "#38bdf8",
    connections: ["genesis", "val-3", "koliance-core"],
  },
  {
    id: "koliance-core",
    label: "Koliance Trust Registry",
    address: "0x32fDd6B096EE14246b5b6971135286Bad01F4928",
    category: "protocol",
    trustScore: 99.8,
    stake: "850,000 MON",
    attestations: 15420,
    status: "active",
    latency: "0.1ms",
    x: 60,
    y: 130,
    z: -20,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 9,
    color: "#ff007a",
    connections: ["genesis", "val-2", "ai-1", "oracle-1"],
  },
  {
    id: "user-1",
    label: "Dev Sovereign DID",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "user",
    trustScore: 94.2,
    stake: "45,000 MON",
    attestations: 312,
    status: "active",
    latency: "0.9ms",
    x: 100,
    y: -130,
    z: 50,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 6,
    color: "#10b981",
    connections: ["koliance-core", "val-2"],
  },
];

interface ProofEvent {
  id: string;
  slot: number;
  block: number;
  txHash: string;
  source: string;
  target: string;
  action: string;
  latencyMs: number;
  timestamp: string;
}

export function TrustConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNode | null>(INITIAL_NODES[0]);
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(true);

  // Live cryptographic proof stream
  const [proofs, setProofs] = useState<ProofEvent[]>([
    {
      id: "proof-1",
      slot: 1948291,
      block: 4920318,
      txHash: "0x3f9a...812d",
      source: "0x8920...43e7",
      target: "0x250b...E43D",
      action: "ENDORSE_CORE_DEV",
      latencyMs: 382,
      timestamp: "Just now",
    },
    {
      id: "proof-2",
      slot: 1948290,
      block: 4920317,
      txHash: "0x77c2...e0e0",
      source: "0x3C44...93BC",
      target: "0x8920...43e7",
      action: "SECURITY_AUDIT_PASS",
      latencyMs: 395,
      timestamp: "2s ago",
    },
    {
      id: "proof-3",
      slot: 1948289,
      block: 4920316,
      txHash: "0xfe31...19d4",
      source: "0x1Db3...5e98",
      target: "0x90F7...b906",
      action: "AI_SENTINEL_CONSENSUS",
      latencyMs: 374,
      timestamp: "4s ago",
    },
    {
      id: "proof-4",
      slot: 1948288,
      block: 4920315,
      txHash: "0x1a8c...b439",
      source: "0x5B38...ddC4",
      target: "0x32fD...4928",
      action: "ZK_IDENTITY_ATTEST",
      latencyMs: 410,
      timestamp: "7s ago",
    },
  ]);

  // Periodic new proof generation (simulating Monad ~400ms single slot)
  useEffect(() => {
    const interval = setInterval(() => {
      const actions = [
        "ZK_IDENTITY_ATTEST",
        "ENDORSE_CORE_DEV",
        "SENTINEL_WEIGHT_REBALANCE",
        "DAO_REPUTATION_UPDATE",
        "SINGLE_SLOT_CONSENSUS_VOTE",
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const randomSlot = 1948292 + Math.floor(Math.random() * 50);

      const newProof: ProofEvent = {
        id: `proof-${Date.now()}`,
        slot: randomSlot,
        block: 4920319 + Math.floor(Math.random() * 50),
        txHash: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        source: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        target: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        action: randomAction,
        latencyMs: Math.floor(360 + Math.random() * 65),
        timestamp: "Just now",
      };

      setProofs((prev) => [newProof, ...prev.slice(0, 5)]);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // 3D Interactive Force Constellation Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = 560);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = 560;
    };
    window.addEventListener("resize", handleResize);

    const nodes = JSON.parse(JSON.stringify(INITIAL_NODES)) as ConstellationNode[];

    let rotX = 0.2;
    let rotY = 0;
    let targetRotX = 0.2;
    let targetRotY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouse2DX = -1000;
    let mouse2DY = -1000;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse2DX = e.clientX - rect.left;
      mouse2DY = e.clientY - rect.top;

      if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        targetRotY += dx * 0.006;
        targetRotX += dy * 0.006;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseLeave = () => {
      isDragging = false;
      mouse2DX = -1000;
      mouse2DY = -1000;
      setHoveredNode(null);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);

    // Pulse energy animation
    let pulseT = 0;
    let animationId: number;

    const focalLength = 400;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth camera rotation
      if (isRotating && !isDragging) {
        targetRotY += 0.0025;
      }
      rotX += (targetRotX - rotX) * 0.08;
      rotY += (targetRotY - rotY) * 0.08;
      pulseT += 0.04;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const centerX = width / 2;
      const centerY = height / 2;

      // Project 3D nodes to 2D
      interface ProjectedNode {
        node: ConstellationNode;
        px: number;
        py: number;
        scale: number;
        zDepth: number;
      }

      const projected: ProjectedNode[] = [];
      let closestHovered: ConstellationNode | null = null;
      let minHoverDist = 24;

      for (const node of nodes) {
        // Rotate around Y
        let x1 = node.x * cosY + node.z * sinY;
        let y1 = node.y;
        let z1 = -node.x * sinY + node.z * cosY;

        // Rotate around X
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        // Perspective
        const scale = focalLength / (focalLength + z2 + 250);
        const px = centerX + x2 * scale;
        const py = centerY + y2 * scale;

        projected.push({
          node,
          px,
          py,
          scale,
          zDepth: z2,
        });

        // Hover test
        const dist = Math.hypot(mouse2DX - px, mouse2DY - py);
        if (dist < minHoverDist) {
          closestHovered = node;
          minHoverDist = dist;
        }
      }

      setHoveredNode(closestHovered);

      // Sort by depth (back to front)
      projected.sort((a, b) => a.zDepth - b.zDepth);

      const nodeMap = new Map<string, ProjectedNode>();
      projected.forEach((p) => nodeMap.set(p.node.id, p));

      // 1. Draw Connection Lines & Pulses
      ctx.lineWidth = 1;
      for (const p of projected) {
        const srcNode = p.node;
        for (const connId of srcNode.connections) {
          const target = nodeMap.get(connId);
          if (!target) continue;

          // Avoid double drawing by order check
          if (srcNode.id > connId) continue;

          const isHighlighted =
            (closestHovered && (closestHovered.id === srcNode.id || closestHovered.id === connId)) ||
            (selectedNode && (selectedNode.id === srcNode.id || selectedNode.id === connId));

          ctx.beginPath();
          ctx.moveTo(p.px, p.py);
          ctx.lineTo(target.px, target.py);

          if (isHighlighted) {
            ctx.strokeStyle = "rgba(0, 242, 254, 0.7)";
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = "rgba(131, 110, 249, 0.18)";
            ctx.lineWidth = 0.8;
          }
          ctx.stroke();

          // Traveling energy pulse dot
          const pulseOffset = (pulseT + (srcNode.id.charCodeAt(0) % 5) * 0.5) % 1;
          const pulseX = p.px + (target.px - p.px) * pulseOffset;
          const pulseY = p.py + (target.py - p.py) * pulseOffset;

          ctx.beginPath();
          ctx.arc(pulseX, pulseY, isHighlighted ? 3 : 1.8, 0, Math.PI * 2);
          ctx.fillStyle = isHighlighted ? "#00F2FE" : "#836EF9";
          ctx.fill();
        }
      }

      // 2. Draw Nodes
      for (const p of projected) {
        const { node, px, py, scale } = p;
        const isSelected = selectedNode?.id === node.id;
        const isHovered = closestHovered?.id === node.id;
        const radius = Math.max(4, node.radius * scale * (isSelected || isHovered ? 1.3 : 1));

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(px, py, radius + (isHovered ? 6 : 3), 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? "rgba(0, 242, 254, 0.3)"
          : isHovered
          ? "rgba(131, 110, 249, 0.3)"
          : "rgba(131, 110, 249, 0.1)";
        ctx.fill();

        // Node center
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#00F2FE" : node.color;
        ctx.fill();

        // Highlight ring on selected
        if (isSelected || isHovered) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label if scale is large or hovered/selected
        if (scale > 0.8 || isHovered || isSelected) {
          ctx.font = `${Math.max(10, Math.round(11 * scale))}px monospace`;
          ctx.fillStyle = isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.85)";
          ctx.textAlign = "center";
          ctx.fillText(node.label, px, py + radius + 14);
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    // Click handler to select node
    const onCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Find closest node within 30px
      let closest: ConstellationNode | null = null;
      let minDist = 30;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const centerX = width / 2;
      const centerY = height / 2;

      for (const node of nodes) {
        let x1 = node.x * cosY + node.z * sinY;
        let y1 = node.y;
        let z1 = -node.x * sinY + node.z * cosY;
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        const scale = focalLength / (focalLength + z2 + 250);
        const px = centerX + x2 * scale;
        const py = centerY + y2 * scale;

        const dist = Math.hypot(clickX - px, clickY - py);
        if (dist < minDist) {
          closest = node;
          minDist = dist;
        }
      }

      if (closest) {
        setSelectedNode(closest);
      }
    };

    canvas.addEventListener("click", onCanvasClick);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("click", onCanvasClick);
      cancelAnimationFrame(animationId);
    };
  }, [isRotating, selectedNode]);

  // Filtered nodes list for table
  const displayedNodes = useMemo(() => {
    if (filterCategory === "all") return INITIAL_NODES;
    return INITIAL_NODES.filter((n) => n.category === filterCategory);
  }, [filterCategory]);

  return (
    <section className="space-y-8 animate-in fade-in duration-500">
      {/* Detail View Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-monad-500/20 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-monad-500/10 border border-monad-500/30 text-xs font-mono text-monad-300 mb-2">
            <Radio className="w-3.5 h-3.5 text-cyber-neon animate-pulse" />
            <span>3D TRUST TOPOLOGY &amp; GRAPH TELEMETRY</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Interactive Trust Constellation</span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-cyber-neon/10 border border-cyber-neon/30 text-cyber-neon font-mono">
              Monad Parallel Consensus
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-monad-200/70 font-mono mt-1 max-w-2xl">
            Real-time peer-to-peer trust weights, AI audit sentinels, and single-slot cryptographic
            attestations verified on Monad Testnet.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: "All Nodes" },
            { id: "validator", label: "Validators" },
            { id: "ai_agent", label: "AI Sentinels" },
            { id: "oracle", label: "Oracles" },
            { id: "protocol", label: "Protocols" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                filterCategory === tab.id
                  ? "bg-monad-500 text-white shadow-glow border border-monad-400"
                  : "bg-monad-950/60 text-monad-300/80 hover:text-white border border-monad-500/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3D Topology + Node Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 3D Constellation Canvas */}
        <div className="lg:col-span-2 glass-panel-glow rounded-3xl p-4 sm:p-6 border border-monad-500/30 relative flex flex-col justify-between overflow-hidden">
          {/* Canvas Header Overlay */}
          <div className="flex items-center justify-between z-10 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="w-2.5 h-2.5 -ml-4.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono text-white font-semibold">
                Live Force Topology (Drag to Rotate)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRotating(!isRotating)}
                className="px-2.5 py-1 rounded-lg bg-monad-950/80 border border-monad-500/30 text-[11px] font-mono text-monad-300 hover:text-white transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${isRotating ? "animate-spin" : ""}`} />
                <span>{isRotating ? "Auto-Rotate ON" : "Paused"}</span>
              </button>
            </div>
          </div>

          {/* Canvas Element */}
          <div className="relative w-full h-[520px] rounded-2xl overflow-hidden bg-black/40 border border-monad-500/20 cursor-grab active:cursor-grabbing">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Bottom Floating Legend */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-monad-950/80 backdrop-blur-md border border-monad-500/30 text-[11px] font-mono text-monad-300">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#836EF9]" /> Engine
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00F2FE]" /> Validator
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" /> AI Sentinel
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff007a]" /> Registry
                </span>
              </div>
              <span className="text-monad-400/80 hidden sm:inline">
                Click any node to inspect on-chain telemetry
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Holographic Node Inspector HUD Card */}
        <div className="glass-panel-glow rounded-3xl p-6 border border-monad-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-monad-500/20 rounded-full blur-[60px] pointer-events-none" />

          {selectedNode ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-monad-500/20 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedNode.color }}
                    />
                    <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded bg-monad-500/20 text-monad-300 border border-monad-500/30">
                      {selectedNode.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {selectedNode.label}
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyber-neon to-emerald-400 font-mono">
                    {selectedNode.trustScore}%
                  </span>
                  <p className="text-[10px] text-monad-300/70 font-mono">TRUST SCORE</p>
                </div>
              </div>

              {/* Address with Copy */}
              <div className="p-3 rounded-xl bg-monad-950/60 border border-monad-500/20">
                <span className="text-[10px] font-mono text-monad-400/80 uppercase block mb-1">
                  On-Chain Monad DID
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-white truncate">
                    {selectedNode.address}
                  </span>
                  <button
                    onClick={() => copyAddress(selectedNode.address)}
                    className="p-1 rounded hover:bg-monad-500/20 text-monad-300 hover:text-white transition shrink-0"
                  >
                    {copiedAddress === selectedNode.address ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Telemetry Stats Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-monad-950/40 border border-monad-500/20 space-y-1">
                  <span className="text-monad-400 text-[10px]">CONSENSUS STAKE</span>
                  <p className="text-white font-bold text-sm">{selectedNode.stake}</p>
                </div>

                <div className="p-3 rounded-xl bg-monad-950/40 border border-monad-500/20 space-y-1">
                  <span className="text-monad-400 text-[10px]">ATTESTATIONS</span>
                  <p className="text-white font-bold text-sm">
                    {selectedNode.attestations.toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-monad-950/40 border border-monad-500/20 space-y-1">
                  <span className="text-monad-400 text-[10px]">EXECUTION LATENCY</span>
                  <p className="text-emerald-400 font-bold text-sm">{selectedNode.latency}</p>
                </div>

                <div className="p-3 rounded-xl bg-monad-950/40 border border-monad-500/20 space-y-1">
                  <span className="text-monad-400 text-[10px]">FINALITY SLOTS</span>
                  <p className="text-cyan-400 font-bold text-sm">1 Slot (MonadBFT)</p>
                </div>
              </div>

              {/* Connected Peers Badges */}
              <div>
                <span className="text-[11px] font-mono text-monad-400 uppercase block mb-2">
                  Connected Trust Peers ({selectedNode.connections.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.connections.map((peerId) => {
                    const peer = INITIAL_NODES.find((n) => n.id === peerId);
                    return (
                      <button
                        key={peerId}
                        onClick={() => peer && setSelectedNode(peer)}
                        className="px-2.5 py-1 rounded-lg bg-monad-950/60 hover:bg-monad-500/30 border border-monad-500/20 hover:border-monad-400 text-[11px] font-mono text-monad-200 hover:text-white transition flex items-center gap-1.5"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: peer?.color || "#fff" }}
                        />
                        <span>{peer?.label.split(" ")[0] || peerId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-monad-300/60 font-mono text-xs">
              <Share2 className="w-8 h-8 mb-2 opacity-40 animate-pulse" />
              <span>Select any node on the left constellation to inspect holographic telemetry</span>
            </div>
          )}

          {/* Footer Action */}
          {selectedNode && (
            <div className="pt-4 border-t border-monad-500/20 mt-4">
              <a
                href={`${monadTestnet.blockExplorers.default.url}/address/${selectedNode.address}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-monad-500/20 hover:bg-monad-500/30 border border-monad-500/40 text-xs font-mono text-white transition shadow-glow"
              >
                <span>Verify on Monad Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Cryptographic Proof Stream */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-monad-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-monad-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-monad-600 to-cyber-neon flex items-center justify-center shadow-glow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cryptographic Proof Stream (Single-Slot Pipeline)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  LIVE
                </span>
              </h3>
              <p className="text-xs text-monad-200/70 font-mono">
                Continuous state transitions and trust attestations confirmed in &lt; 400ms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-monad-300">
            <span>Avg Latency: <strong className="text-white">384ms</strong></span>
            <span className="text-monad-500/50">|</span>
            <span>Finality: <strong className="text-emerald-400">1 Slot (MonadBFT)</strong></span>
          </div>
        </div>

        {/* Proof Event Cards */}
        <div className="space-y-2.5">
          <AnimatePresence>
            {proofs.map((proof, i) => (
              <motion.div
                key={proof.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-monad-950/60 border border-monad-500/20 hover:border-monad-500/40 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-monad-500/20 border border-monad-500/30 flex items-center justify-center text-xs font-mono text-cyber-neon font-bold shrink-0">
                    #{i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{proof.action}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-monad-500/20 text-monad-300">
                        Slot {proof.slot}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-monad-400/80 mt-0.5">
                      <span>{proof.source}</span>
                      <span>&rarr;</span>
                      <span>{proof.target}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono self-end md:self-auto">
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold">{proof.latencyMs}ms</span>
                    <span className="text-[10px] text-monad-400/60 block">{proof.timestamp}</span>
                  </div>

                  <a
                    href={`${monadTestnet.blockExplorers.default.url}/tx/${proof.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-monad-900/60 hover:bg-monad-500/30 text-monad-300 hover:text-white transition"
                    title="View on Monad Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
