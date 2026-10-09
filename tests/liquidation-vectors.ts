import { liquidationPrice, netCollateralUsd } from "@/lib/perp";

/**
 * The shared input grid for the frontend/contract liquidation-price parity test
 * (GAP-06).
 *
 * Both sides read the vector file this produces, so the two implementations are
 * compared on identical inputs rather than on two hand-written sets that quietly
 * drift apart. The grid deliberately reaches into the awkward corners:
 *
 *   - leverage from 1x to 50x, so both ends of the allowed range are covered;
 *   - a price like 33,333 (in whole dollars) because the formula has two integer
 *     divisions and a value that does not divide evenly is where the two sides
 *     are most likely to disagree;
 *   - both directions, since the long and short branches are separate code.
 */
const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const usd = (n: bigint) => n * E18;
const usdc = (n: bigint) => n * E6;

const LEVERAGES = [10_000n, 20_000n, 100_000n, 250_000n, 500_000n];
const COLLATERALS = [100n, 1_000n];
const PRICES = [180n, 200n, 33_333n];
const DIRECTIONS = [true, false];

export interface LiquidationVector {
  leverageBps: string;
  collateralUsdc: string;
  entryPrice: string;
  isLong: boolean;
  liqPrice: string;
}

export function buildVectors(): LiquidationVector[] {
  const out: LiquidationVector[] = [];
  for (const leverageBps of LEVERAGES) {
    for (const c of COLLATERALS) {
      for (const p of PRICES) {
        for (const isLong of DIRECTIONS) {
          // Net of the open fee — the figure the chain stores as `collateralUsd`
          // and therefore the one its liquidation verdict is computed from.
          // Feeding the gross amount here would compare two different
          // quantities.
          const grossUsd = usdc(c) * 10n ** 12n; // USDC 6dp -> USD 18dp
          const collateralUsd = netCollateralUsd(grossUsd);
          const entryPrice = usd(p);
          out.push({
            leverageBps: leverageBps.toString(),
            collateralUsdc: c.toString(),
            entryPrice: entryPrice.toString(),
            isLong,
            liqPrice: liquidationPrice({ collateralUsd, entryPrice, leverageBps, isLong }).toString(),
          });
        }
      }
    }
  }
  return out;
}
