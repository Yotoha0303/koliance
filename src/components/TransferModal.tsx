"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { parseEther } from "viem";
import { monadTestnet } from "@/lib/contract";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderAddress: string;
  balance: string;
  onSuccess?: (txHash: string) => void;
}

export function TransferModal({
  isOpen,
  onClose,
  senderAddress,
  balance,
  onSuccess,
}: TransferModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTxHash(null);

    const cleanRecipient = recipient.trim();
    if (!cleanRecipient.startsWith("0x") || cleanRecipient.length !== 42) {
      setError("请输入合法的 0x 开头 42 位 EVM 钱包地址");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("请输入大于 0 的有效转账金额");
      return;
    }

    if (numAmount > parseFloat(balance || "0")) {
      setError(`转账金额超出可用余额 (${balance} MON)`);
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) {
      setError("未检测到 Web3 钱包 (如 MetaMask / Phantom)");
      return;
    }

    setIsLoading(true);

    try {
      const valueHex = "0x" + parseEther(amount.trim()).toString(16);

      const hash = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: senderAddress,
            to: cleanRecipient,
            value: valueHex,
          },
        ],
      })) as string;

      setTxHash(hash);
      onSuccess?.(hash);
    } catch (err: any) {
      console.error("Transfer error:", err);
      setError(err?.shortMessage || err?.message || "转账交易被拒绝或失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetMax = () => {
    const balNum = parseFloat(balance || "0");
    // Leave small buffer for gas
    const maxVal = Math.max(0, balNum - 0.005).toFixed(4);
    setAmount(maxVal);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md rounded-2xl bg-[#141824] border border-white/15 p-6 shadow-2xl text-white z-10 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">链上转账 (Monad MON)</h3>
                <p className="text-[11px] font-mono text-slate-400">
                  当前余额: <span className="text-emerald-400 font-semibold">{balance} MON</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          {txHash ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/30 space-y-3 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-white">转账交易已成功广播！</div>
              <p className="text-[11px] font-mono text-slate-300 break-all bg-black/40 p-2 rounded-lg">
                Tx: {txHash}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <a
                  href={`${monadTestnet.blockExplorers.default.url}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>在区块浏览器中查看</span>
                </a>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-mono transition"
                >
                  关闭
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleTransfer} className="space-y-4">
              {error && (
                <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Recipient Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">接收方地址 (Recipient Address)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 focus:border-purple-400 focus:outline-none text-xs font-mono text-white placeholder-slate-500"
                  required
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                  <label>转账数量 (Amount MON)</label>
                  <button
                    type="button"
                    onClick={handleSetMax}
                    className="text-[10px] text-purple-300 hover:text-purple-200 underline"
                  >
                    最大 (保留少量Gas)
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 pr-14 rounded-xl bg-black/40 border border-white/15 focus:border-purple-400 focus:outline-none text-xs font-mono text-white placeholder-slate-500"
                    required
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-slate-400 pointer-events-none">
                    MON
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm transition shadow-lg shadow-purple-600/20 active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>钱包确认中...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>确认发送转账</span>
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
