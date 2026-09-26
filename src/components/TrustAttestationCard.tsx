"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Zap, KeyRound, CheckCircle2, ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { generateProof, truncateAddress } from "@/lib/utils";
import { monadTestnet } from "@/lib/contract";

interface TrustAttestationCardProps {
  account: `0x${string}` | null;
  onAddTrust: (to: `0x${string}`, action: string, proof: `0x${string}`) => Promise<string | undefined>;
}

const PRESET_ACTIONS = [
  "ENDORSE_DEV",
  "CODE_AUDITOR",
  "DECENTRALIZED_ID",
  "COMMUNITY_CONTRIBUTOR",
  "DAO_MEMBER",
];

export function TrustAttestationCard({ account, onAddTrust }: TrustAttestationCardProps) {
  const [toAddress, setToAddress] = useState("");
  const [action, setAction] = useState(PRESET_ACTIONS[0]);
  const [customAction, setCustomAction] = useState("");
  const [rawProofText, setRawProofText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const finalAction = action === "CUSTOM" ? customAction : action;
  const currentProof = generateProof(rawProofText || `${account}->${toAddress}:${finalAction}:${Date.now()}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !toAddress || !finalAction) return;

    setIsSubmitting(true);
    setTxHash(null);
    try {
      const hash = await onAddTrust(toAddress as `0x${string}`, finalAction, currentProof);
      if (hash) {
        setTxHash(hash);
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#836EF9", "#00F2FE", "#10B981"],
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
      transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-monad-500/30 relative overflow-hidden"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
          <KeyRound className="w-6 h-6 text-cyber-accent" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            Issue Trust Attestation
          </h3>
          <p className="text-xs text-monad-200/70 font-mono">
            Cryptographically endorse a counterparty on Monad
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient Address */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-monad-200 flex items-center justify-between">
            <span>Recipient Address (Target)</span>
            <span className="text-[11px] text-monad-400 font-mono">0x...</span>
          </label>
          <input
            type="text"
            required
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x71C... or paste destination wallet"
            className="w-full px-4 py-3 rounded-xl bg-monad-950/60 border border-monad-500/30 focus:border-monad-400 focus:outline-none text-sm text-white placeholder-monad-400/40 font-mono transition"
          />
        </div>

        {/* Action Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-monad-200">Attestation Action Type</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_ACTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setAction(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                  action === item
                    ? "bg-monad-500 text-white shadow-glow border border-monad-400"
                    : "bg-monad-950/50 hover:bg-monad-900/50 text-monad-300 border border-monad-500/20"
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAction("CUSTOM")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                action === "CUSTOM"
                  ? "bg-monad-500 text-white shadow-glow border border-monad-400"
                  : "bg-monad-950/50 hover:bg-monad-900/50 text-monad-300 border border-monad-500/20"
              }`}
            >
              Custom...
            </button>
          </div>
        </div>

        {action === "CUSTOM" && (
          <div className="space-y-1.5">
            <input
              type="text"
              required
              value={customAction}
              onChange={(e) => setCustomAction(e.target.value)}
              placeholder="Enter custom action keyword..."
              className="w-full px-4 py-2.5 rounded-xl bg-monad-950/60 border border-monad-500/30 focus:border-monad-400 focus:outline-none text-sm text-white font-mono"
            />
          </div>
        )}

        {/* Cryptographic Proof Helper */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-monad-200">Proof Payload (Calculated Keccak256)</span>
            <span className="text-cyber-accent text-[11px]">bytes32</span>
          </div>
          <div className="p-3 rounded-xl bg-monad-950/80 border border-monad-500/20 text-xs font-mono text-monad-300/80 break-all select-all">
            {currentProof}
          </div>
          <input
            type="text"
            value={rawProofText}
            onChange={(e) => setRawProofText(e.target.value)}
            placeholder="Type extra endorsement message to update proof hash..."
            className="w-full px-4 py-2 rounded-xl bg-monad-950/40 border border-monad-500/20 focus:border-monad-400 focus:outline-none text-xs text-white placeholder-monad-400/40 font-mono transition"
          />
        </div>

        {/* Submit */}
        {account ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={isSubmitting || !toAddress}
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyber-accent via-monad-500 to-monad-600 hover:opacity-95 text-white font-semibold text-sm shadow-cyan transition duration-200 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Broadcasting to Monad...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-white" />
                <span>Submit Attestation Record</span>
              </>
            )}
          </motion.button>
        ) : (
          <div className="p-4 rounded-xl bg-monad-950/40 border border-monad-500/20 text-center">
            <p className="text-xs text-monad-300 font-mono">
              Connect your Web3 wallet to sign and push trust records.
            </p>
          </div>
        )}

        {/* Transaction Result */}
        <AnimatePresence>
          {txHash && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">Attestation Tx: {truncateAddress(txHash, 10, 8)}</span>
              </div>
              <a
                href={`${monadTestnet.blockExplorers.default.url}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-cyan-400 hover:text-white font-bold ml-2 shrink-0"
              >
                <span>Explorer</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </motion.div>
  );
}
