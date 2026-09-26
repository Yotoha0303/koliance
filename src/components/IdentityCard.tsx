"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, Fingerprint, Sparkles, CheckCircle2, Clock, Globe, ArrowUpRight, Loader2 } from "lucide-react";
import { formatTimestamp, truncateAddress } from "@/lib/utils";
import { IdentityData, monadTestnet } from "@/lib/contract";
import confetti from "canvas-confetti";

interface IdentityCardProps {
  account: `0x${string}` | null;
  identity: IdentityData | null;
  isLoading: boolean;
  onRegister: (metadataHash: string) => Promise<string | undefined>;
}

export function IdentityCard({ account, identity, isLoading, onRegister }: IdentityCardProps) {
  const [metadataHash, setMetadataHash] = useState("");
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || (!metadataHash && !username)) return;

    // Build IPFS or identity hash representation
    const finalHash = metadataHash || `ipfs://koliance-${username.toLowerCase().replace(/\s+/g, "_")}-${Date.now().toString(16)}`;

    setIsSubmitting(true);
    setTxHash(null);
    try {
      const hash = await onRegister(finalHash);
      if (hash) {
        setTxHash(hash);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#836EF9", "#00F2FE", "#ffffff"],
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-monad-500/30 relative overflow-hidden"
    >
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-monad-500/20 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-monad-500/20 border border-monad-500/40 flex items-center justify-center text-monad-300">
            <Fingerprint className="w-6 h-6 text-monad-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              On-Chain Identity Station
            </h3>
            <p className="text-xs text-monad-200/70 font-mono">
              Immutable cryptographic record on Monad
            </p>
          </div>
        </div>

        {/* Identity Status Pill */}
        {identity?.exists ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified Identity
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-monad-500/10 border border-monad-500/30 text-monad-300 text-xs font-mono">
            Unregistered
          </span>
        )}
      </div>

      {/* Identity State Display */}
      {identity?.exists ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="p-5 rounded-2xl bg-monad-950/70 border border-monad-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-monad-300/70">BOUND ADDRESS</span>
              <span className="text-xs font-mono text-white bg-monad-500/20 px-2 py-0.5 rounded">
                {account ? truncateAddress(account, 10, 8) : "None"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-monad-300/70">METADATA HASH</span>
              <span className="text-xs font-mono text-cyber-accent truncate max-w-[200px] sm:max-w-xs">
                {identity.metadataHash}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-monad-300/70">REGISTERED AT</span>
              <span className="text-xs font-mono text-monad-200 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-monad-400" />
                {formatTimestamp(identity.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-monad-300/60 font-mono">
              Your identity is active and ready for trust endorsements.
            </p>
            {account && (
              <a
                href={`${monadTestnet.blockExplorers.default.url}/address/${account}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-monad-400 hover:text-white transition"
              >
                <span>Explorer Record</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </motion.div>
      ) : (
        /* Registration Form */
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-monad-200 flex items-center gap-1.5">
              <span>Identity Alias / Username</span>
              <span className="text-monad-400/60">(Optional)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alexander.monad"
              className="w-full px-4 py-3 rounded-xl bg-monad-950/60 border border-monad-500/30 focus:border-monad-400 focus:outline-none text-sm text-white placeholder-monad-400/40 font-mono transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-monad-200 flex items-center gap-1.5">
              <span>Metadata Hash / IPFS URI</span>
              <span className="text-cyber-accent text-[11px]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={metadataHash}
                onChange={(e) => setMetadataHash(e.target.value)}
                placeholder="ipfs://bafkreibm6... or leave blank for auto-hash"
                className="w-full px-4 py-3 rounded-xl bg-monad-950/60 border border-monad-500/30 focus:border-monad-400 focus:outline-none text-sm text-white placeholder-monad-400/40 font-mono transition"
              />
              <button
                type="button"
                onClick={() => setMetadataHash(`ipfs://QmKoliance${Math.random().toString(36).substring(2, 10)}`)}
                className="absolute right-2 top-2 px-2.5 py-1.5 rounded-lg bg-monad-500/20 hover:bg-monad-500/30 text-[11px] font-mono text-monad-300 transition"
              >
                Random IPFS
              </button>
            </div>
          </div>

          {account ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={isSubmitting || isLoading}
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-monad-600 via-monad-500 to-monad-600 hover:from-monad-500 hover:to-monad-400 text-white font-semibold text-sm shadow-glow transition duration-200 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Submitting to Monad Testnet...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyber-accent" />
                  <span>Register On-Chain Identity</span>
                </>
              )}
            </motion.button>
          ) : (
            <div className="p-4 rounded-xl bg-monad-950/40 border border-monad-500/20 text-center">
              <p className="text-xs text-monad-300 font-mono">
                Connect your Web3 wallet to register this identity on Monad.
              </p>
            </div>
          )}

          {/* Transaction Hash feedback */}
          <AnimatePresence>
            {txHash && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Tx: {truncateAddress(txHash, 10, 8)}</span>
                </div>
                <a
                  href={`${monadTestnet.blockExplorers.default.url}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-emerald-400 hover:text-white font-bold ml-2 shrink-0"
                >
                  <span>Explorer</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      )}
    </motion.div>
  );
}
