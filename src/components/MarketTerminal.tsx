"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Search,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Shield,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Clock,
  CheckCircle2,
  DollarSign,
  Cpu,
  Info,
  Sliders,
  ChevronRight,
  Zap,
} from "lucide-react";

interface MarketResponse {
  source: string;
  meta: {
    symbol: string;
    name: string;
    currency: string;
    regularMarketPrice: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketVolume: number;
    exchangeName?: string;
    marketCap?: string;
    peRatio?: number | null;
  };
  chart: {
    timestamps: number[];
    closes: number[];
  };
  analysis: {
    rsi: number;
    rsiSignal: string;
    sma20: number;
    trend: string;
    support: number;
    resistance: number;
    volatility: string;
    healthScore: number;
    agentCardViability: string;
    aiVerdict: string;
  };
}

const PRESET_SYMBOLS = [
  { symbol: "NVDA", name: "NVIDIA", type: "Equity" },
  { symbol: "AAPL", name: "Apple", type: "Equity" },
  { symbol: "TSLA", name: "Tesla", type: "Equity" },
  { symbol: "BTC-USD", name: "Bitcoin", type: "Crypto" },
  { symbol: "ETH-USD", name: "Ethereum", type: "Crypto" },
  { symbol: "MON-USD", name: "Monad", type: "Parallel EVM" },
];

const TICKER_TAPE = [
  { symbol: "NVDA", price: "$142.80", change: "+3.14%" },
  { symbol: "AAPL", price: "$234.50", change: "+0.80%" },
  { symbol: "TSLA", price: "$258.40", change: "-1.22%" },
  { symbol: "BTC-USD", price: "$65,420", change: "+2.22%" },
  { symbol: "ETH-USD", price: "$2,640", change: "+2.53%" },
  { symbol: "MON-USD", price: "$3.45", change: "+13.86%" },
];

interface MarketTerminalProps {
  onTradeAction?: () => void;
}

export function MarketTerminal({ onTradeAction }: MarketTerminalProps) {
  const [selectedSymbol, setSelectedSymbol] = useState("NVDA");
  const [selectedRange, setSelectedRange] = useState("1mo");
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketResponse | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Fetch market data from server route with gatekeeping
  const fetchMarketData = async (sym: string, rng: string) => {
    setLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/market?symbol=${encodeURIComponent(sym)}&range=${rng}`);
      const json = await res.json();
      if (!res.ok) {
        setSearchError(json.error || "Gatekeeper rejected symbol");
        return;
      }
      setMarketData(json);
    } catch (err: any) {
      setSearchError("Failed to fetch market data: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData(selectedSymbol, selectedRange);
  }, [selectedSymbol, selectedRange]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (!clean) return;

    // Client-side Gatekeeping Pre-filter: only alphanumeric, dot, dash, max 10 chars
    const regex = /^[A-Z0-9.\-]{1,10}$/;
    if (!regex.test(clean)) {
      setSearchError("Gatekeeper: Invalid symbol. Only letters, numbers, '.', '-' (max 10 chars).");
      return;
    }

    setSelectedSymbol(clean);
    setSearchInput("");
  };

  // SVG Chart points calculation
  const chartCoordinates = useMemo(() => {
    if (!marketData || !marketData.chart.closes.length) return null;
    const closes = marketData.chart.closes;
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const width = 640;
    const height = 180;
    const padding = 15;

    const points = closes.map((price, idx) => {
      const x = padding + (idx / (closes.length - 1)) * (width - padding * 2);
      const y = height - padding - ((price - min) / range) * (height - padding * 2);
      return { x, y, price, timestamp: marketData.chart.timestamps[idx] };
    });

    // Create SVG path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { points, pathD, areaD, min, max, width, height };
  }, [marketData]);

  const isPositive = (marketData?.meta.regularMarketChangePercent || 0) >= 0;

  return (
    <div className="w-full space-y-6 font-sans">
      {/* 1. Ticker Tape Header */}
      <div className="rounded-2xl bg-[#121622]/90 border border-white/[0.08] p-3 shadow-md backdrop-blur-md overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider pr-3 border-r border-white/10">
            <Activity className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Yahoo Finance Tape</span>
          </div>

          {TICKER_TAPE.map((item) => {
            const pos = item.change.startsWith("+");
            const isSelected = selectedSymbol === item.symbol;
            return (
              <button
                key={item.symbol}
                onClick={() => setSelectedSymbol(item.symbol)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-xl transition ${
                  isSelected
                    ? "bg-white text-black font-bold shadow-sm"
                    : "hover:bg-white/[0.06] text-slate-300"
                }`}
              >
                <span>{item.symbol}</span>
                <span className={isSelected ? "text-black" : "text-white"}>{item.price}</span>
                <span className={pos ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                  {item.change}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Search & Gatekeeper Bar */}
      <div className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.12] text-xs font-mono text-white mb-2">
              <Shield className="w-3.5 h-3.5 text-white" />
              <span>MARKET DATA GATEKEEPER &amp; SANITIZATION ENGINE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Yahoo Finance Terminal</span>
              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-white/10 text-white border border-white/20 font-mono">
                LIVE &amp; CACHED RESILIENT
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-mono mt-1">
              Zero-latency market quotes, quantitative technical indicators (RSI, SMA), and AgentCard cross-asset liquidity evaluation.
            </p>
          </div>

          {/* Quick Preset Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            {PRESET_SYMBOLS.map((s) => (
              <button
                key={s.symbol}
                onClick={() => setSelectedSymbol(s.symbol)}
                className={`px-3 py-1.5 rounded-xl transition ${
                  selectedSymbol === s.symbol
                    ? "bg-white text-black font-bold shadow-sm"
                    : "bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                <span>{s.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Form with Gatekeeper Security Feedback */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setSearchError(null);
              }}
              placeholder="Search ticker (e.g., NVDA, AAPL, MSFT, TSLA, BTC-USD, MON-USD)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#0d1017] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 font-mono focus:outline-none focus:border-white/30 transition shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-black font-semibold text-xs sm:text-sm font-mono transition shadow-sm active:scale-95 shrink-0"
          >
            Query Market
          </button>
        </form>

        {searchError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* 3. Main Market Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Asset Header, Price Chart, Key Statistics */}
        <div className="lg:col-span-8 space-y-6">
          {/* Asset Price Banner & Range Switcher */}
          <div className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {marketData?.meta.symbol || selectedSymbol}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/[0.08] text-slate-300 font-mono">
                    {marketData?.meta.currency || "USD"} &bull; {marketData?.meta.exchangeName || "NASDAQ"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {marketData?.meta.name || "Loading asset metadata..."}
                </p>
              </div>

              {/* Range Switcher */}
              <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
                {["1d", "5d", "1mo", "6mo", "1y"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRange(r)}
                    className={`px-3 py-1 rounded-lg uppercase transition ${
                      selectedRange === r
                        ? "bg-white text-black font-bold shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Readout & Day High/Low */}
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-black font-mono text-white">
                    ${marketData?.meta.regularMarketPrice?.toLocaleString() || "---"}
                  </span>
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                      isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>
                      {isPositive ? "+" : ""}
                      {marketData?.meta.regularMarketChange} ({isPositive ? "+" : ""}
                      {marketData?.meta.regularMarketChangePercent}%)
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 block">
                  Data source: {marketData?.source === "yahoo_finance_live" ? "Live Yahoo Finance" : "Verified High-Fidelity Mirror"}
                </span>
              </div>

              {/* Day Range Bar */}
              <div className="text-right space-y-1 text-xs font-mono">
                <span className="text-slate-400 text-[10px] uppercase block">24h Day Range</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">${marketData?.meta.regularMarketDayLow || "---"}</span>
                  <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full w-2/3" />
                  </div>
                  <span className="text-white font-bold">${marketData?.meta.regularMarketDayHigh || "---"}</span>
                </div>
              </div>
            </div>

            {/* SVG Interactive Price Chart */}
            <div className="relative w-full h-[210px] rounded-2xl bg-[#0d1017] border border-white/[0.06] p-2 overflow-hidden">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono text-slate-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Streaming Yahoo Finance Series...</span>
                </div>
              ) : chartCoordinates ? (
                <>
                  <svg className="w-full h-full" viewBox={`0 0 ${chartCoordinates.width} ${chartCoordinates.height}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Area */}
                    <path d={chartCoordinates.areaD} fill="url(#chartGradient)" />

                    {/* Line */}
                    <path
                      d={chartCoordinates.pathD}
                      fill="none"
                      stroke={isPositive ? "#10b981" : "#ef4444"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Hover Indicator */}
                    {hoveredPointIndex !== null && chartCoordinates.points[hoveredPointIndex] && (
                      <>
                        <line
                          x1={chartCoordinates.points[hoveredPointIndex].x}
                          y1="0"
                          x2={chartCoordinates.points[hoveredPointIndex].x}
                          y2={chartCoordinates.height}
                          stroke="rgba(255,255,255,0.2)"
                          strokeDasharray="3 3"
                        />
                        <circle
                          cx={chartCoordinates.points[hoveredPointIndex].x}
                          cy={chartCoordinates.points[hoveredPointIndex].y}
                          r="5"
                          fill="#ffffff"
                          stroke={isPositive ? "#10b981" : "#ef4444"}
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </svg>

                  {/* Interactive Cursor Hover Overlay */}
                  <div
                    className="absolute inset-0 cursor-crosshair"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const xRatio = (e.clientX - rect.left) / rect.width;
                      const idx = Math.min(
                        Math.floor(xRatio * chartCoordinates.points.length),
                        chartCoordinates.points.length - 1
                      );
                      setHoveredPointIndex(Math.max(0, idx));
                    }}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                  />

                  {/* Hover Floating Tooltip */}
                  {hoveredPointIndex !== null && chartCoordinates.points[hoveredPointIndex] && (
                    <div
                      className="absolute top-3 left-4 p-2 rounded-xl bg-black/80 border border-white/20 text-xs font-mono text-white shadow-lg pointer-events-none"
                    >
                      <span className="text-slate-400 text-[10px] block">
                        {new Date(chartCoordinates.points[hoveredPointIndex].timestamp * 1000).toLocaleDateString()}
                      </span>
                      <strong className="text-sm font-bold">
                        ${chartCoordinates.points[hoveredPointIndex].price}
                      </strong>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Key Statistics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-2 border-t border-white/[0.08]">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] block">52W HIGH / LOW</span>
                <p className="text-white font-bold mt-0.5 truncate">
                  ${marketData?.meta.fiftyTwoWeekLow?.toFixed(1)} - ${marketData?.meta.fiftyTwoWeekHigh?.toFixed(1)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] block">VOLUME</span>
                <p className="text-white font-bold mt-0.5 truncate">
                  {(marketData?.meta.regularMarketVolume || 0).toLocaleString()}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] block">20-DAY SMA</span>
                <p className="text-emerald-400 font-bold mt-0.5">
                  ${marketData?.analysis.sma20?.toFixed(2) || "---"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] block">VOLATILITY</span>
                <p className="text-white font-bold mt-0.5">
                  {marketData?.analysis.volatility || "Normal"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Yahoo Finance Deep Analysis Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl bg-[#121622]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-xl space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-300" />
                  <span>Yahoo Finance Analysis</span>
                </h4>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.08] text-slate-300 border border-white/[0.1]">
                  QUANTITATIVE
                </span>
              </div>

              {/* Health Score Gauge */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Market Health Score</span>
                  <p className="text-3xl font-black font-mono text-white">
                    {marketData?.analysis.healthScore || 85}
                    <span className="text-base text-slate-400">/100</span>
                  </p>
                  <span className="text-emerald-400 text-[11px] font-mono font-bold block mt-0.5">
                    {marketData?.analysis.trend || "Bullish"}
                  </span>
                </div>

                <div className="w-14 h-14 rounded-full border-4 border-emerald-400/40 border-t-white flex items-center justify-center font-mono text-xs font-bold text-white shadow-sm">
                  {marketData?.analysis.healthScore || 85}%
                </div>
              </div>

              {/* RSI (Relative Strength Index) Indicator */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>14-Period RSI:</span>
                  <strong className="text-white font-bold">
                    {marketData?.analysis.rsi || 52.4} ({marketData?.analysis.rsiSignal || "Healthy"})
                  </strong>
                </div>

                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="w-3/10 bg-blue-500/50" title="Oversold (<30)" />
                  <div className="w-4/10 bg-emerald-500/50" title="Healthy (30-70)" />
                  <div className="w-3/10 bg-red-500/50" title="Overbought (>70)" />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Oversold (30)</span>
                  <span>Neutral (50)</span>
                  <span>Overbought (70)</span>
                </div>
              </div>

              {/* Pivot Support & Resistance */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400 text-[10px] block">DYNAMIC SUPPORT</span>
                  <strong className="text-emerald-400 text-sm font-bold block mt-0.5">
                    ${marketData?.analysis.support || "---"}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400 text-[10px] block">DYNAMIC RESISTANCE</span>
                  <strong className="text-amber-400 text-sm font-bold block mt-0.5">
                    ${marketData?.analysis.resistance || "---"}
                  </strong>
                </div>
              </div>

              {/* AI Agent Verdict Commentary */}
              <div className="p-3.5 rounded-2xl bg-[#0d1017] border border-white/[0.06] space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  AI Agent Intelligence Verdict
                </span>
                <p className="text-xs text-slate-300 font-mono leading-relaxed">
                  {marketData?.analysis.aiVerdict || "Analyzing real-time Yahoo Finance order flows..."}
                </p>
              </div>

              {/* AgentCard Cross-Asset Settlement Suitability */}
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">
                  AgentCard Tokenized Escrow Grade
                </span>
                <p className="text-xs font-mono text-white font-bold">
                  {marketData?.analysis.agentCardViability || "A (Eligible for Monad Single-Slot Trading)"}
                </p>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-4 border-t border-white/[0.08]">
              <button
                onClick={onTradeAction}
                className="w-full py-3 rounded-2xl bg-white hover:bg-slate-100 text-black font-semibold text-xs font-mono transition shadow-sm flex items-center justify-center gap-2 active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 text-black" />
                <span>Trade {selectedSymbol} on AgentCard</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
