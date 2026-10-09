import {
  liquidationPriceWithFunding,
  netCollateralUsd,
  positionSizeUsd,
  fundingDeltaWad,
  fundingOwed,
} from "@/lib/perp";
import { WAD } from "@/lib/perpConfig";

/**
 * The shared input grid for the funding-aware liquidation-price parity test
 * (GAP-37).
 *
 * GAP-06 pinned `liquidationPrice()` — the price formula alone — against 60
 * vectors, and its contract half deliberately drives the funding rate to zero
 * before comparing. That leaves the funding term with no cross-boundary check at
 * all, which is precisely the term that can put the panel and the chain in
 * disagreement on one screen.
 *
 * The funding amount is NOT handed to the contract as a number. It is derived
 * from `elapsedBlocks` and `fundingRateWad` using the frontend's own funding
 * arithmetic, and the contract half reproduces it by actually accruing funding
 * for that many blocks. The contract then has to agree on the owed amount *and*
 * on the price boundary it implies — so a drift in either the funding formula or
 * the price formula shows up.
 *
 * To make the amount reproducible off-chain, the contract half opens **exactly
 * one position per vector**. A one-sided book has a skew of exactly +/-WAD, so
 * the per-block delta collapses to `elapsed * rate` with no dependence on the
 * book's size in a way the vector would have to guess. Both the long and the
 * short grid rows therefore produce a *paying* position.
 *
 * The grid reaches into the corners the same way GAP-06's does: the full
 * leverage range, a price that does not divide evenly, both directions, and —
 * new here — zero funding (where the two formulas must coincide exactly) beside
 * non-zero funding.
 */
const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const usdc = (n: bigint) => n * E6;

const LEVERAGES = [10_000n, 500_000n];
const COLLATERALS = [100n, 1_000n];
const PRICES = [200n];
const DIRECTIONS = [true, false];
/**
 * Blocks of funding to accrue. Zero pins the funding-aware formula to the
 * funding-free one; the two non-zero values put the funding term at roughly
 * 0.5% and 5% of the maintenance margin at the ceiling rate below, which is far
 * more than the one wei of price separation the parity boundary needs.
 */
const ELAPSED = [0n, 5n, 50n];
/**
 * `MAX_FUNDING_RATE_PER_BLOCK_WAD`, i.e. the ceiling `setFundingRatePerBlockWad`
 * will accept. Used at the maximum on purpose: the contract half accrues funding
 * one block per call rather than mining, so a larger per-block step buys a larger
 * funding term for the same number of transactions.
 */
const RATE = 10n ** 13n;

export interface FundingLiquidationVector {
  leverageBps: string;
  collateralUsdc: string;
  entryPrice: string;
  isLong: boolean;
  elapsedBlocks: string;
  fundingRateWad: string;
  /** Derived by the frontend from the two fields above; the chain must agree. */
  fundingOwedUsd: string;
  liqPrice: string;
}

export function buildFundingVectors(): FundingLiquidationVector[] {
  const out: FundingLiquidationVector[] = [];
  for (const leverageBps of LEVERAGES) {
    for (const c of COLLATERALS) {
      for (const p of PRICES) {
        for (const isLong of DIRECTIONS) {
          for (const elapsed of ELAPSED) {
            // Net of the open fee — the figure the chain stores as
            // `collateralUsd` and therefore the one its verdict is computed
            // from. Feeding the gross amount would compare two quantities.
            const grossUsd = usdc(c) * 10n ** 12n; // USDC 6dp -> USD 18dp
            const collateralUsd = netCollateralUsd(grossUsd);
            const entryPrice = p * E18;

            const math = { collateralUsd, entryPrice, leverageBps, isLong };

            // A one-sided book: skew is exactly +/-WAD, and a position opened
            // before any accrual carries entryFundingIndex zero.
            const skewWad = isLong ? WAD : -WAD;
            const delta = fundingDeltaWad(elapsed, RATE, skewWad);
            const fundingOwedUsd = fundingOwed(
              { sizeUsd: positionSizeUsd(math), isLong, entryFundingIndex: 0n },
              delta
            );

            out.push({
              leverageBps: leverageBps.toString(),
              collateralUsdc: c.toString(),
              entryPrice: entryPrice.toString(),
              isLong,
              elapsedBlocks: elapsed.toString(),
              fundingRateWad: RATE.toString(),
              fundingOwedUsd: fundingOwedUsd.toString(),
              liqPrice: liquidationPriceWithFunding(math, fundingOwedUsd).toString(),
            });
          }
        }
      }
    }
  }
  return out;
}
