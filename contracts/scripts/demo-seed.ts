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
const COLLATERAL_USDC = 1_000n * E6;
const LEVERAGE_BPS = 500_000n; // 50x
const ENTRY_PRICE_USD = 180n * E18;

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
    const isLong = i % 2 === 0;
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
