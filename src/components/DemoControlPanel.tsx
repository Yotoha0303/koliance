"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  type PublicClient,
  type WalletClient,
} from "viem";
import { monadTestnet } from "@/lib/contract";
import {
  FEEDS,
  FEED_SYMBOLS,
  PERP_IS_CONFIGURED,
  PERP_ADDRESSES,
  USD_DECIMALS,
  type FeedSymbol,
} from "@/lib/perpConfig";
import { DEMO_ORACLE_ABI, POSITION_MANAGER_ABI } from "@/lib/perpAbi";

/**
 * Stage controls for the demo.
 *
 * This panel is the trigger the whole walkthrough hangs off: the pitch is
 * "drop the price, watch the positions go red and get cleared in under a
 * second", and until now there was nothing to drop the price with.
 *
 * It talks to the chain directly rather than through the Go bot, and that is a
 * deliberate choice rather than a shortcut. The bot's chain-facing half is a
 * tracked gap (GAP-26) — it cannot be rehearsed until it lands, and a demo that
 * depends on it cannot run at all until then. Reading `PositionLiquidated` off
 * the chain needs nothing that is not already deployed, so the screen works
 * today and keeps working when the bot arrives to do the same job faster. The
 * bots-vs-front-end comparison is the honest framing of what the bot adds:
 * not capability, throughput.
 *
 * Two details that are easy to get wrong and are handled on purpose:
 *
 *   1. The price moves by a *basis-point delta* (`bumpPrice`), not by setting
 *      an absolute price. The demo never needs to know the current price to
 *      move it, so a stale read cannot send it somewhere unintended.
 *   2. Liquidation is one batched call over every id, not a loop. The contract
 *      snapshots one price per feed for the whole batch and is per-position
 *      fault-isolated, so a single unpayable bounty cannot take the batch down
 *      — which is exactly why the stage moment is one transaction instead of
 *      twenty.
 */

/** Bumps the panel offers. Kept well inside DemoOracle's (-10000, 10000) bps limit. */
const BUMP_STEPS = [-1500n, -1000n, -500n, 500n, 1000n, 1500n] as const;

const CLIENT = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz"),
});

interface LiquidationRow {
  positionId: bigint;
  owner: string;
  liquidator: string;
  exitPrice: bigint;
  blockNumber: bigint;
  txHash: string;
}

/** How far back to scan for the event tail. Kept bounded so a fresh RPC cannot be asked for a huge range. */
const LOOKBACK_BLOCKS = 5_000n;

function fmtUsd(v: bigint): string {
  return Number(formatUnits(v, USD_DECIMALS)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function DemoControlPanel({ account }: { account: `0x${string}` | null }) {
  const [prices, setPrices] = useState<Partial<Record<FeedSymbol, bigint>>>({});
  const [positions, setPositions] = useState<{ id: bigint; liquidatable: boolean }[]>([]);
  const [liquidations, setLiquidations] = useState<LiquidationRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(
    null,
  );

  const walletClient = useMemo<WalletClient | null>(() => {
    if (typeof window === "undefined" || !window.ethereum || !account) return null;
    return createWalletClient({
      chain: monadTestnet,
      account,
      transport: custom(window.ethereum),
    });
  }, [account]);

  const readPrices = useCallback(async () => {
    if (!PERP_IS_CONFIGURED) return;
    const out: Partial<Record<FeedSymbol, bigint>> = {};
    for (const sym of FEED_SYMBOLS) {
      try {
        const [price] = (await CLIENT.readContract({
          address: PERP_ADDRESSES.oracle,
          abi: DEMO_ORACLE_ABI,
          functionName: "getPrice",
          args: [FEEDS[sym]],
        })) as [bigint, bigint];
        out[sym] = price;
      } catch {
        // A feed with no price set yet is normal before `demo-seed` runs.
        out[sym] = undefined;
      }
    }
    setPrices(out);
  }, []);

  const readPositions = useCallback(async () => {
    if (!PERP_IS_CONFIGURED) return;
    try {
      const next = (await CLIENT.readContract({
        address: PERP_ADDRESSES.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: "nextPositionId",
      })) as bigint;

      const rows: { id: bigint; liquidatable: boolean }[] = [];
      for (let id = 1n; id <= next; id++) {
        const open = (await CLIENT.readContract({
          address: PERP_ADDRESSES.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "isOpen",
          args: [id],
        })) as boolean;
        if (!open) continue;
        const liquidatable = (await CLIENT.readContract({
          address: PERP_ADDRESSES.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "isLiquidatable",
          args: [id],
        })) as boolean;
        rows.push({ id, liquidatable });
      }
      setPositions(rows);
    } catch {
      setPositions([]);
    }
  }, []);

  const readLiquidations = useCallback(async () => {
    if (!PERP_IS_CONFIGURED) return;
    try {
      const head = await CLIENT.getBlockNumber();
      const from = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n;
      const logs = await CLIENT.getContractEvents({
        address: PERP_ADDRESSES.positionManager,
        abi: POSITION_MANAGER_ABI,
        eventName: "PositionLiquidated",
        fromBlock: from,
        toBlock: head,
      });
      const rows: LiquidationRow[] = logs
        .map((l) => ({
          positionId: l.args.positionId as bigint,
          owner: l.args.owner as string,
          liquidator: l.args.liquidator as string,
          exitPrice: l.args.exitPrice as bigint,
          blockNumber: l.blockNumber ?? 0n,
          txHash: l.transactionHash ?? "",
        }))
        .reverse();
      setLiquidations(rows.slice(0, 25));
    } catch {
      setLiquidations([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([readPrices(), readPositions(), readLiquidations()]);
  }, [readPrices, readPositions, readLiquidations]);

  useEffect(() => {
    if (!PERP_IS_CONFIGURED) return;
    void refreshAll();
    const t = setInterval(() => void refreshAll(), 6_000);
    return () => clearInterval(t);
  }, [refreshAll]);

  const bump = useCallback(
    async (sym: FeedSymbol, deltaBps: bigint) => {
      if (!walletClient) {
        setFeedback({ kind: "err", msg: "先连接钱包（面板需要发交易）" });
        return;
      }
      const label = `${deltaBps > 0n ? "+" : ""}${(Number(deltaBps) / 100).toFixed(1)}%`;
      setBusy(`bump-${sym}-${deltaBps}`);
      setFeedback({ kind: "info", msg: `正在调整 ${sym} ${label}…` });
      try {
        const hash = await walletClient.writeContract({
          address: PERP_ADDRESSES.oracle,
          abi: DEMO_ORACLE_ABI,
          functionName: "bumpPrice",
          args: [FEEDS[sym], deltaBps],
          account,
          chain: monadTestnet,
        });
        await CLIENT.waitForTransactionReceipt({ hash });
        setFeedback({ kind: "ok", msg: `${sym} ${label} 已生效 · ${hash.slice(0, 10)}…` });
        await refreshAll();
      } catch (err: unknown) {
        const e = err as { shortMessage?: string; message?: string };
        setFeedback({ kind: "err", msg: e?.shortMessage || e?.message || "调价失败" });
      } finally {
        setBusy(null);
      }
    },
    [walletClient, account, refreshAll],
  );

  const liquidateAll = useCallback(async () => {
    if (!walletClient) {
      setFeedback({ kind: "err", msg: "先连接钱包（清算需要发交易）" });
      return;
    }
    const ids = positions.map((p) => p.id);
    if (ids.length === 0) {
      setFeedback({ kind: "info", msg: "当前没有未平仓头寸" });
      return;
    }

    setBusy("liquidate");
    setFeedback({ kind: "info", msg: `正在尝试清算 ${ids.length} 笔头寸…` });
    const started = Date.now();
    try {
      // One batched call. The contract snapshots a single price per feed for
      // the whole batch and isolates per-position payment failures, so ids that
      // should not be liquidated simply get skipped rather than reverting the
      // batch — which is why sending every id is safe.
      const hash = await walletClient.writeContract({
        address: PERP_ADDRESSES.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: "liquidate",
        args: [ids, []],
        account,
        chain: monadTestnet,
      });
      const receipt = await CLIENT.waitForTransactionReceipt({ hash });
      const elapsed = Date.now() - started;
      const cleared = receipt.logs.length;
      setFeedback({
        kind: "ok",
        msg: `一批提交 ${ids.length} 笔，回执 ${cleared} 条日志，用时 ${elapsed} ms · ${hash.slice(0, 10)}…`,
      });
      await refreshAll();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setFeedback({ kind: "err", msg: e?.shortMessage || e?.message || "清算失败" });
    } finally {
      setBusy(null);
    }
  }, [walletClient, account, positions, refreshAll]);

  if (!PERP_IS_CONFIGURED) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">演示控制台</h2>
        <p className="mt-2 text-xs text-slate-400">
          Perp 模块未配置。补齐 <code>NEXT_PUBLIC_PERP_*</code> 环境变量后此面板可用。
        </p>
      </section>
    );
  }

  const liquidatableNow = positions.filter((p) => p.liquidatable).length;

  return (
    <section className="rounded-xl border border-monad-500/25 bg-white/[0.02] p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">
          演示控制台
          <span className="ml-2 rounded border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wider text-amber-300">
            仅演示
          </span>
        </h2>
        <span className="text-[11px] tabular-nums text-slate-500">
          未平仓 {positions.length} · 可清算{" "}
          <b className={liquidatableNow > 0 ? "text-rose-400" : "text-slate-400"}>
            {liquidatableNow}
          </b>
        </span>
      </header>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        调低价格 → 头寸批量变红 → 一键清算。价格按<b>基点增量</b>调整，面板不需要知道当前价，
        因此不会因读到过期价格而跳到意外数值。
      </p>

      {/* ---------- price bumps ---------- */}
      <div className="mt-5 space-y-3">
        {FEED_SYMBOLS.map((sym) => (
          <div key={sym} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-300">{sym}</span>
              <span className="font-mono text-xs tabular-nums text-slate-400">
                {prices[sym] !== undefined ? `$${fmtUsd(prices[sym] as bigint)}` : "未设置"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BUMP_STEPS.map((d) => {
                const isDown = d < 0n;
                return (
                  <button
                    key={d.toString()}
                    type="button"
                    disabled={busy !== null || prices[sym] === undefined}
                    onClick={() => void bump(sym, d)}
                    className={[
                      "rounded border px-2 py-1 font-mono text-[11px] tabular-nums transition disabled:opacity-40",
                      isDown
                        ? "border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                        : "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10",
                    ].join(" ")}
                  >
                    {busy === `bump-${sym}-${d}` ? "…" : `${d > 0n ? "+" : ""}${Number(d) / 100}%`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- liquidate ---------- */}
      <button
        type="button"
        disabled={busy !== null || positions.length === 0}
        onClick={() => void liquidateAll()}
        className="mt-5 w-full rounded-lg border border-monad-500/40 bg-monad-500/15 px-4 py-2.5 text-sm font-semibold text-monad-200 transition hover:bg-monad-500/25 disabled:opacity-40"
      >
        {busy === "liquidate" ? "清算中…" : `一键清算全部持仓（${positions.length}）`}
      </button>

      {feedback && (
        <p
          className={[
            "mt-3 rounded border px-3 py-2 text-[11px] leading-relaxed",
            feedback.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200"
              : feedback.kind === "err"
                ? "border-rose-400/30 bg-rose-400/5 text-rose-200"
                : "border-white/10 bg-white/5 text-slate-300",
          ].join(" ")}
        >
          {feedback.msg}
        </p>
      )}

      {/* ---------- the screen sweep ---------- */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            清算流水
          </h3>
          <span className="text-[10px] text-slate-600">
            读自链上 <code>PositionLiquidated</code>，不经过 Bot
          </span>
        </div>

        {liquidations.length === 0 ? (
          <p className="mt-2 rounded border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-slate-600">
            暂无清算记录
          </p>
        ) : (
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
            {liquidations.map((l) => (
              <li
                key={`${l.txHash}-${l.positionId}`}
                className="flex items-center justify-between gap-2 rounded border border-white/5 bg-black/20 px-2.5 py-1.5 font-mono text-[11px] tabular-nums"
              >
                <span className="text-rose-300">#{l.positionId.toString()}</span>
                <span className="text-slate-400">@${fmtUsd(l.exitPrice)}</span>
                <span className="text-slate-500">{short(l.owner)}</span>
                <span className="text-slate-600">blk {l.blockNumber.toString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
