"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { createPublicClient, createWalletClient, custom, http, formatUnits } from "viem";
import { monadTestnet } from "@/lib/contract";
import {
  PERP_ADDRESSES,
  PERP_IS_CONFIGURED,
  BPS_DENOMINATOR,
  FEEDS,
  USDC_DECIMALS,
  USD_DECIMALS,
  netCollateralUsd,
  positionSizeUsd,
  payoutCapUsd,
  poolCapacityCheck,
  unrealizedPnl,
  liquidationPrice,
  marginRatioBps,
  isLiquidatable,
  formatUsd,
  formatLeverage,
  validateOpenPosition,
} from "@/lib/perp";
import {
  MOCK_USDC_ABI,
  VAULT_ABI,
  DEMO_ORACLE_ABI,
  POSITION_MANAGER_ABI,
  type OnChainPosition,
} from "@/lib/perpAbi";

/**
 * On-chain perp trading panel.
 *
 * Every number here is read from the contracts. There is deliberately NO mock or
 * fallback path: if the perp addresses are unset the panel shows an error
 * instead of figures. A panel that silently displays plausible-but-fake numbers
 * is worse than one that fails, because it makes the demo unverifiable — the
 * same failure mode as the market route's synthesised candles.
 *
 * The estimated liquidation price is mirrored from `src/lib/perp.ts`, which is
 * asserted against the contract's formula by `tests/perp.test.ts`. It is a
 * mirror, not a read: the chain has no per-position liquidation-price getter.
 */

const RPC = "https://testnet-rpc.monad.xyz";
const E6 = 10n ** 6n;

/** The feed the demo trades. DemoOracle prices it; Pyth uses the same id. */
const ACTIVE_FEED = FEEDS.NVDA;

interface PositionRow {
  id: bigint;
  pos: OnChainPosition;
  pnl: bigint;
  marginBps: bigint;
  liqPrice: bigint;
  liquidatable: boolean;
}

/** Parse a decimal USDC string into 6-decimal units, tolerating junk input. */
function parseUsdc(input: string): bigint {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e6));
}

export function PositionPanel({ account }: { account: `0x${string}` | null }) {
  const [poolAssets, setPoolAssets] = useState(0n);
  const [poolReserved, setPoolReserved] = useState(0n);
  const [poolAvailable, setPoolAvailable] = useState(0n);
  const [walletUsdc, setWalletUsdc] = useState(0n);
  const [allowance, setAllowance] = useState(0n);
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
    txHash?: string;
  } | null>(null);

  const [collateral, setCollateral] = useState("100");
  const [leverageX, setLeverageX] = useState(10);
  const [isLong, setIsLong] = useState(true);

  const accountRef = useRef(account);
  accountRef.current = account;

  // ---- form-derived figures -------------------------------------------------

  const collateralAmount = parseUsdc(collateral); // 6-decimal USDC
  const collateralGrossUsd = collateralAmount * 10n ** BigInt(USD_DECIMALS - USDC_DECIMALS);
  const leverageBps = BigInt(Math.round(leverageX)) * (BPS_DENOMINATOR / 1n) / 1n;
  const netUsd = netCollateralUsd(collateralGrossUsd);

  // positionSizeUsd and payoutCapUsd read only collateral and leverage, so the
  // placeholder entryPrice is never consulted.
  const mathForPreview = {
    collateralUsd: netUsd,
    entryPrice: 1n,
    leverageBps: BigInt(Math.round(leverageX)) * BPS_DENOMINATOR,
    isLong,
  };
  const previewSize = positionSizeUsd(mathForPreview);
  const previewCap = payoutCapUsd(mathForPreview);

  const capacity = PERP_IS_CONFIGURED
    ? poolCapacityCheck(mathForPreview, poolAssets, poolReserved)
    : null;

  const needsApproval = allowance < collateralAmount;

  // ---- chain reads ---------------------------------------------------------

  const refresh = useCallback(async () => {
    if (!PERP_IS_CONFIGURED) return;
    const who = accountRef.current;
    try {
      const client = createPublicClient({ chain: monadTestnet, transport: http(RPC) });

      const [assets, reserved, available, nextId, mark] = await Promise.all([
        client.readContract({
          address: PERP_ADDRESSES.vault,
          abi: VAULT_ABI,
          functionName: "totalAssets",
        }),
        client.readContract({
          address: PERP_ADDRESSES.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "reservedAssets",
        }),
        client.readContract({
          address: PERP_ADDRESSES.vault,
          abi: VAULT_ABI,
          functionName: "availableAssets",
        }),
        client.readContract({
          address: PERP_ADDRESSES.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "nextPositionId",
        }),
        client.readContract({
          address: PERP_ADDRESSES.oracle,
          abi: DEMO_ORACLE_ABI,
          functionName: "getPrice",
          args: [ACTIVE_FEED],
        }),
      ]);

      setPoolAssets(assets);
      setPoolReserved(reserved);
      setPoolAvailable(available);
      const markPrice = (mark as readonly [bigint, bigint])[0];

      if (who) {
        const [bal, alw] = await Promise.all([
          client.readContract({
            address: PERP_ADDRESSES.usdc,
            abi: MOCK_USDC_ABI,
            functionName: "balanceOf",
            args: [who],
          }),
          client.readContract({
            address: PERP_ADDRESSES.usdc,
            abi: MOCK_USDC_ABI,
            functionName: "allowance",
            args: [who, PERP_ADDRESSES.positionManager],
          }),
        ]);
        setWalletUsdc(bal);
        setAllowance(alw);
      }

      // Ids are contiguous from 1, so the scan is bounded by nextPositionId.
      const found: PositionRow[] = [];
      for (let id = 1n; id < nextId; id++) {
        const open = await client.readContract({
          address: PERP_ADDRESSES.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "isOpen",
          args: [id],
        });
        if (!open) continue;

        const pos = (await client.readContract({
          address: PERP_ADDRESSES.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "getPosition",
          args: [id],
        })) as unknown as OnChainPosition;

        const math = {
          collateralUsd: pos.collateralUsd,
          entryPrice: pos.entryPrice,
          leverageBps: (pos.sizeUsd * BPS_DENOMINATOR) / (pos.collateralUsd || 1n),
          isLong: pos.isLong,
        };
        found.push({
          id,
          pos,
          pnl: unrealizedPnl(math, markPrice),
          marginBps: marginRatioBps(math, markPrice),
          liqPrice: liquidationPrice(math),
          liquidatable: isLiquidatable(math, markPrice),
        });
      }
      setRows(found);
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setFeedback({
        type: "error",
        msg: e?.shortMessage || e?.message || "读取链上状态失败",
      });
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh, account]);

  // ---- writes --------------------------------------------------------------

  const writeClient = () => {
    if (typeof window === "undefined" || !window.ethereum || !account) return null;
    return createWalletClient({
      account,
      chain: monadTestnet,
      transport: custom(window.ethereum),
    });
  };

  const run = async (key: string, label: string, fn: () => Promise<`0x${string}`>) => {
    const wc = writeClient();
    if (!wc) {
      setFeedback({ type: "error", msg: "请先连接钱包" });
      return;
    }
    setPending(key);
    setFeedback(null);
    try {
      const hash = await fn();
      setFeedback({ type: "success", msg: label, txHash: hash });
      await refresh();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setFeedback({ type: "error", msg: e?.shortMessage || e?.message || "交易失败" });
    } finally {
      setPending(null);
    }
  };

  const handleApprove = () =>
    run("approve", "已授权 PositionManager 使用 USDC", async () => {
      const wc = writeClient()!;
      return wc.writeContract({
        address: PERP_ADDRESSES.usdc,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [PERP_ADDRESSES.positionManager, 2n ** 255n],
      });
    });

  const handleOpen = () => {
    const validation = validateOpenPosition({
      collateralUsd: collateralGrossUsd,
      leverageBps: mathForPreview.leverageBps,
    });
    if (validation) {
      setFeedback({ type: "error", msg: validation });
      return;
    }
    if (capacity && !capacity.ok) {
      setFeedback({
        type: "error",
        msg: `池子容量不足：需要 $${formatUsd(capacity.requiredUsd)}，可用 $${formatUsd(
          capacity.availableUsd
        )}。调小保证金/杠杆，或先补充流动性。`,
      });
      return;
    }
    return run(
      `open-${isLong ? "long" : "short"}`,
      `已开${isLong ? "多" : "空"} ${collateral} USDC @ ${leverageX}x`,
      async () => {
        const wc = writeClient()!;
        return wc.writeContract({
          address: PERP_ADDRESSES.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "openPosition",
          args: [ACTIVE_FEED, collateralAmount, mathForPreview.leverageBps, isLong, []],
        });
      }
    );
  };

  const handleClose = (id: bigint) =>
    run(`close-${id}`, `已平仓 #${id}`, async () => {
      const wc = writeClient()!;
      return wc.writeContract({
        address: PERP_ADDRESSES.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: "closePosition",
        args: [id, []],
      });
    });

  // ---- render --------------------------------------------------------------

  if (!PERP_IS_CONFIGURED) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
        <div className="flex items-center gap-3 text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <h3 className="font-semibold">Perp 模块未配置</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-amber-200/80">
          缺少 <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_PERP_*</code> 环境变量。先运行{" "}
          <code className="rounded bg-black/30 px-1">
            npx hardhat run scripts/demo-seed.ts --network monadTestnet
          </code>
          ，再把输出的四个地址填入 <code className="rounded bg-black/30 px-1">.env.local</code>。
        </p>
        <p className="mt-2 text-xs text-amber-200/60">
          此处不会显示模拟数据 —— 假数据会让演示失去可验证性。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Pool state */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "池子总资产", value: `$${formatUsd(poolAssets)}`, hint: "totalAssets()" },
          {
            label: "已预留",
            value: `$${formatUsd(poolReserved)}`,
            hint: "reservedAssets() = Σ 出金上限",
          },
          { label: "可提取", value: `$${formatUsd(poolAvailable)}`, hint: "availableAssets()" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/50">{s.label}</div>
            <div className="mt-1 font-mono text-lg text-white">{s.value}</div>
            <div className="mt-0.5 text-[10px] text-white/30">{s.hint}</div>
          </div>
        ))}
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <div>{feedback.msg}</div>
            {feedback.txHash && (
              <a
                href={`https://testnet.monadexplorer.com/tx/${feedback.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center gap-1 truncate font-mono text-[10px] underline opacity-70"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {feedback.txHash}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- open form ---- */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-white">开仓</h3>
            <button
              onClick={refresh}
              className="rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:text-white/80"
              title="刷新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsLong(true)}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm transition ${
                isLong
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-white/10 text-white/50 hover:border-white/20"
              }`}
            >
              <ArrowUpRight className="h-4 w-4" /> 做多
            </button>
            <button
              onClick={() => setIsLong(false)}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm transition ${
                !isLong
                  ? "border-rose-500 bg-rose-500/20 text-rose-300"
                  : "border-white/10 text-white/50 hover:border-white/20"
              }`}
            >
              <ArrowDownRight className="h-4 w-4" /> 做空
            </button>
          </div>

          <label className="mb-1 block text-xs text-white/50">保证金 (USDC)</label>
          <input
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            inputMode="decimal"
            className="mb-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-white outline-none focus:border-white/30"
          />
          <div className="mb-3 text-[11px] text-white/40">
            钱包余额 {formatUnits(walletUsdc, USDC_DECIMALS)} USDC
          </div>

          <label className="mb-1 flex items-center justify-between text-xs text-white/50">
            <span>杠杆</span>
            <span className="font-mono text-white">{leverageX}x</span>
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={leverageX}
            onChange={(e) => setLeverageX(Number(e.target.value))}
            className="w-full accent-white"
          />

          <div className="my-4 space-y-1 rounded-lg bg-white/5 p-3 font-mono text-xs text-white/60">
            <div className="flex justify-between">
              <span>计入保证金</span>
              <span className="text-white">${formatUsd(netUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span>名义规模</span>
              <span className="text-white">${formatUsd(previewSize)}</span>
            </div>
            <div className="flex justify-between">
              <span>出金上限</span>
              <span className="text-amber-300">${formatUsd(previewCap)}</span>
            </div>
            <p className="pt-1 text-[10px] leading-relaxed text-white/30">
              池子需预留「出金上限」= 保证金 + 名义规模。偿付护栏：池子付不出的仓位会被直接拒绝开仓，而不是开了之后平不掉。
            </p>
          </div>

          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={!account || pending !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
            >
              {pending === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              授权 USDC
            </button>
          ) : (
            <button
              onClick={handleOpen}
              disabled={!account || pending !== null || (capacity ? !capacity.ok : false)}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold text-black transition disabled:opacity-40 ${
                isLong ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
              }`}
            >
              {pending?.startsWith("open") ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> 开仓中…
                </span>
              ) : (
                `开${isLong ? "多" : "空"} ${leverageX}x`
              )}
            </button>
          )}

          {!account && (
            <p className="mt-2 text-center text-xs text-white/40">请先在导航栏连接钱包</p>
          )}
        </div>

        {/* ---- positions ---- */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h3 className="mb-4 font-semibold text-white">
            持仓 <span className="text-white/40">({rows.length})</span>
          </h3>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/30">链上暂无持仓</p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {rows.map((r) => {
                const pnlPositive = r.pnl >= 0n;
                const mine =
                  account && r.pos.owner.toLowerCase() === account.toLowerCase();
                return (
                  <div
                    key={r.id.toString()}
                    className="rounded-lg border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white/40">#{r.id.toString()}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            r.pos.isLong
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {r.pos.isLong ? "多" : "空"}
                        </span>
                        <span className="font-mono text-[10px] text-white/40">
                          {formatLeverage(
                            (r.pos.sizeUsd * BPS_DENOMINATOR) / (r.pos.collateralUsd || 1n)
                          )}
                        </span>
                        {r.liquidatable && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                            可清算
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono text-sm ${
                          pnlPositive ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {pnlPositive ? "+" : "−"}${formatUsd(pnlPositive ? r.pnl : -r.pnl)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] text-white/40">
                      <div>
                        <div className="text-white/30">保证金</div>
                        <div className="text-white/70">${formatUsd(r.pos.collateralUsd)}</div>
                      </div>
                      <div>
                        <div className="text-white/30">入场价</div>
                        <div className="text-white/70">${formatUsd(r.pos.entryPrice)}</div>
                      </div>
                      <div>
                        <div className="text-white/30">预估强平价</div>
                        <div className="text-white/70">${formatUsd(r.liqPrice)}</div>
                      </div>
                    </div>

                    {mine && (
                      <button
                        onClick={() => handleClose(r.id)}
                        disabled={pending !== null}
                        className="mt-3 w-full rounded-md border border-white/15 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-40"
                      >
                        {pending === `close-${r.id}` ? "平仓中…" : "平仓"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
