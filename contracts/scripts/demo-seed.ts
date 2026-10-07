import { network } from "hardhat";

/**
 * Seed a demo-ready perp deployment.
 *
 *   npx hardhat run scripts/demo-seed.ts --network monadTestnet
 *   npx hardhat run scripts/demo-seed.ts            # against the local simulated net
 *
 * Reads the addresses from `contracts/.env` (written by the Ignition deploy) and
 * falls back to a fresh local deployment when they are absent, so the script is
 * runnable both on testnet and on the in-process network.
 *
 * Sizing note — this is the part that changed when payouts were capped.
 * ---------------------------------------------------------------------
 * `reservedAssets()` is now the sum of each position's payout cap,
 * `collateral + notional`, and `openPosition` refuses anything the pool cannot
 * cover. So liquidity must be sized against the CAP, not the collateral:
 *
 *   20 positions x 1,000 USDC collateral @ 50x
 *     size per position  =  999 x 50        =  49,950 USD
 *     cap per position   =  999 + 49,950    =  50,949 USD
 *     total reserved     =  20 x 50,949     = 1,018,980 USD
 *
 *   => the pool needs > 1,018,980 USDC. We seed 1,200,000 for headroom.
 *
 * At 10x the same 20 positions need only ~220k, which is the sizing most demos
 * actually want. `LEVERAGE_BPS` and `POSITION_COUNT` below control it.
 */

const BPS = 10_000n;
const E6 = 10n ** 6n;
const E18 = 10n ** 18n;

/** 24/7 Equity.Index.NVDA/USD on Pyth. Passed through as an opaque feed id. */
const NVDA_FEED =
  "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;

const POSITION_COUNT = 20;
/**
 * How many of the positions are longs. The rest are shorts.
 *
 * Deliberately NOT 50/50. An even split is the natural way to seed a
 * liquidation demo — a price move kills the longs and spares the shorts, which
 * is the interesting case — but it also makes the skew exactly zero, so funding
 * accrues nothing and the mechanism is invisible.
 *
 * 14/6 gives a skew of +0.4: longs pay, shorts are paid, and a price drop still
 * liquidates the longs while sparing the shorts. Both mechanisms stay visible.
 * Set to 10 for a balanced book when only liquidation matters.
 */
const LONG_COUNT = 14;
const COLLATERAL_USDC = 1_000n * E6;
const LEVERAGE_BPS = 500_000n; // 50x
const ENTRY_PRICE_USD = 180n * E18;

/**
 * Funding rate for the demo, WAD per block at full skew.
 *
 * The deployed default is 1e11 (~0.86%/day on a 1s chain). That is the honest
 * figure and it is invisible over a few hundred blocks: on a 49,950 USD position
 * it moves ~0.005 USD per block. A demo that cannot show the mechanism may as
 * well not have it, so the seed raises the rate to the ceiling (1e13, i.e.
 * 1e-5 of notional per block) — enough that a crowded side visibly bleeds margin
 * over a few hundred blocks.
 *
 * The mechanism is identical at either rate; only the arithmetic scale differs.
 * Set this to 0 to leave the deployed default alone, or to 1e11 to be
 * conservative on stage. See ADR-003 for why this is a parameter and not a
 * constant.
 */
const DEMO_FUNDING_RATE_PER_BLOCK_WAD = 10_000_000_000_000n; // 1e13, the ceiling

/** Pool size derived from the per-position cap, plus 20% headroom. */
function requiredLiquidityUsdc(): bigint {
  const gross = COLLATERAL_USDC;
  const fee = (gross * 10n) / BPS; // OPEN_FEE_BPS
  const collateral = gross - fee;
  const size = (collateral * LEVERAGE_BPS) / BPS;
  const cap = collateral + size; // MAX_PROFIT_BPS = 10_000 -> +100% of notional
  const total = cap * BigInt(POSITION_COUNT);
  return (total * 120n) / 100n;
}

async function main() {
  const { viem, networkName } = await network.getOrCreate();
  const [deployer] = await viem.getWalletClients();

  const liquidity = requiredLiquidityUsdc();
  console.log(`\n=== Koliance perp demo seed (${networkName}) ===`);
  console.log(`deployer    : ${deployer.account.address}`);
  console.log(`positions   : ${POSITION_COUNT} x ${COLLATERAL_USDC / E6} USDC @ ${LEVERAGE_BPS / BPS}x`);
  console.log(`liquidity   : ${liquidity / E6} USDC (sized to the payout caps)`);

  const token = await viem.deployContract("MockUSDC");
  const oracle = await viem.deployContract("DemoOracle");
  const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
  const pm = await viem.deployContract("PositionManager", [
    vault.address,
    oracle.address,
    token.address,
    deployer.account.address,
  ]);

  // Wiring order matters: PositionManager settles through the Vault, so the
  // one-shot registration has to happen before any position can open.
  await vault.write.setPositionManager([pm.address]);
  await oracle.write.setPrice([NVDA_FEED, ENTRY_PRICE_USD]);

  // Raise funding so the mechanism is visible over a demo-length run.
  if (DEMO_FUNDING_RATE_PER_BLOCK_WAD > 0n) {
    await pm.write.setFundingRatePerBlockWad([DEMO_FUNDING_RATE_PER_BLOCK_WAD]);
  }
  console.log(`funding rate: ${await pm.read.fundingRatePerBlockWad()} WAD/block`);

  // Fund and seed the LP.
  await token.write.mint([deployer.account.address, liquidity]);
  await token.write.approve([vault.address, liquidity]);
  await vault.write.addLiquidity([liquidity]);

  // Fund the trader and open mixed directions so a price move liquidates some
  // and spares others — the mixed batch is what makes the demo convincing.
  const tradingCapital = COLLATERAL_USDC * BigInt(POSITION_COUNT) * 2n;
  await token.write.mint([deployer.account.address, tradingCapital]);
  await token.write.approve([pm.address, tradingCapital]);

  const ids: bigint[] = [];
  for (let i = 0; i < POSITION_COUNT; i++) {
    const isLong = i < LONG_COUNT;
    await pm.write.openPosition([NVDA_FEED, COLLATERAL_USDC, LEVERAGE_BPS, isLong, []], {
      account: deployer.account,
    });
    ids.push(await pm.read.nextPositionId());
  }

  const assets = await vault.read.totalAssets();
  const reserved = await pm.read.reservedAssets();
  const available = await vault.read.availableAssets();

  console.log(`\n--- state ---`);
  console.log(`totalAssets     : ${assets / E18} USD`);
  console.log(`reservedAssets  : ${reserved / E18} USD`);
  console.log(`availableAssets : ${available / E18} USD`);
  console.log(`positions       : ${ids.length} (${ids.map((i) => i.toString()).join(", ")})`);

  // The book is mixed long/short, so the net skew is small — funding will be
  // mild. Print it so a demo operator can see the mechanism is live rather than
  // assuming it from the rate.
  const [longOi, shortOi] = await pm.read.openInterest([NVDA_FEED]);
  const skew = await pm.read.fundingSkewWad([NVDA_FEED]);
  console.log(`openInterest    : long ${longOi / E18} / short ${shortOi / E18} USD`);
  console.log(`fundingSkewWad  : ${skew} (${Number(skew) / 1e18 >= 0 ? "+" : ""}${(Number(skew) / 1e18).toFixed(4)})`);
  if (skew === 0n) {
    console.log(`  note: skew is 0, so funding accrues nothing. Open an unequal`);
    console.log(`        number of longs and shorts to make the mechanism visible.`);
  }

  // The invariant the solvency guards exist to protect. Assert it here too, so a
  // seeding that would leave the pool unable to pay fails loudly rather than at
  // demo time.
  if (assets < reserved) {
    throw new Error(`INSOLVENT after seeding: totalAssets=${assets} < reserved=${reserved}`);
  }
  console.log(`invariant       : totalAssets >= reservedAssets  OK`);

  console.log(`\naddresses (put these in .env.local):`);
  console.log(`NEXT_PUBLIC_PERP_USDC=${token.address}`);
  console.log(`NEXT_PUBLIC_PERP_ORACLE=${oracle.address}`);
  console.log(`NEXT_PUBLIC_PERP_VAULT=${vault.address}`);
  console.log(`NEXT_PUBLIC_PERP_POSITION_MANAGER=${pm.address}`);
}

main().catch((error) => {
  console.error("demo-seed failed:", error);
  process.exitCode = 1;
});
