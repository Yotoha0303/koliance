"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Search, ArrowRight, ShieldCheck, Copy, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { TrustRecordData, monadTestnet } from "@/lib/contract";
import { formatTimestamp, truncateAddress } from "@/lib/utils";

interface TrustStreamProps {
  records: TrustRecordData[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function TrustStream({ records, isLoading, onRefresh }: TrustStreamProps) {
  const [search, setSearch] = useState("");
  const [copiedProof, setCopiedProof] = useState<string | null>(null);

  const filteredRecords = records.filter(
    (r) =>
      r.from.toLowerCase().includes(search.toLowerCase()) ||
      r.to.toLowerCase().includes(search.toLowerCase()) ||
      r.action.toLowerCase().includes(search.toLowerCase())
  );

  const copyProof = (proof: string) => {
    navigator.clipboard.writeText(proof);
    setCopiedProof(proof);
    setTimeout(() => setCopiedProof(null), 2000);
  };

  return (
    <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-monad-500/30">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-monad-400" />
            <span>On-Chain Trust Explorer</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-monad-500/20 text-monad-300 font-mono">
              {records.length} Records
            </span>
          </h3>
          <p className="text-xs text-monad-200/70 font-mono mt-0.5">
            Immutable trust graph synced with Monad Testnet
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-monad-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search address or action..."
              className="pl-8 pr-4 py-2 rounded-xl bg-monad-950/60 border border-monad-500/30 focus:border-monad-400 focus:outline-none text-xs text-white placeholder-monad-400/40 font-mono w-48 sm:w-64 transition"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-monad-950/60 border border-monad-500/30 hover:border-monad-400 text-monad-300 hover:text-white transition disabled:opacity-50"
            title="Refresh from Monad RPC"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Record List */}
      {filteredRecords.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-monad-950/40 border border-monad-500/20">
          <ShieldCheck className="w-10 h-10 text-monad-400/40 mx-auto mb-2" />
          <p className="text-sm text-monad-300 font-medium">No Trust Records Found</p>
          <p className="text-xs text-monad-400/60 font-mono mt-1">
            {records.length === 0
              ? "Be the first to issue an on-chain trust attestation above!"
              : "No records matched your search query."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredRecords.map((record, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="p-4 rounded-2xl bg-monad-950/60 hover:bg-monad-950/90 border border-monad-500/20 hover:border-monad-500/40 transition-all duration-200 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  {/* From -> To */}
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2 py-0.5 rounded bg-monad-500/10 text-monad-300 border border-monad-500/20">
                      {truncateAddress(record.from)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-monad-400 shrink-0" />
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {truncateAddress(record.to)}
                    </span>
                  </div>

                  {/* Action Badge */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-monad-500/20 text-white font-mono text-[11px] font-semibold tracking-wide border border-monad-400/40 shadow-glow">
                      {record.action}
                    </span>
                    <span className="text-[11px] text-monad-400/70 font-mono">
                      {formatTimestamp(record.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Proof & Links */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-monad-500/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-monad-400/60 font-mono">PROOF:</span>
                    <span className="text-[11px] font-mono text-monad-300/80 truncate max-w-[220px] sm:max-w-md">
                      {record.proof}
                    </span>
                    <button
                      onClick={() => copyProof(record.proof)}
                      className="text-monad-400 hover:text-white transition"
                    >
                      {copiedProof === record.proof ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <a
                    href={`${monadTestnet.blockExplorers.default.url}/address/${record.from}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-monad-400 hover:text-white transition"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
