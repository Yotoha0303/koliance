import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * SC-1 regression: LP share pricing must not treat trader collateral as LP
 * money, and the first-depositor inflation attack must not pay.
 *
 * Before the fix the Vault priced shares off its raw balance. Scenario below,
 * measured on the old code: LP-A deposits 20,000, a trader opens 5,000 margin at
 * 1x, LP-B deposits 20,000, the trader closes flat, LP-B redeems everything and
 * receives 17,782.22 USDC (-11%); the difference went to LP-A.
 */

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const usd = (n: bigint | number) => BigInt(n) * E18;
const usdc = (n: bigint | number) => BigInt(n) * E6;

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const BTC = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as const;
const PRICE = usd(180);

describe("Vault LP pricing (SC-1) and inflation resistance", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, lpA, lpB, trader, attacker] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  async function setup() {
    const token = await viem.deployContract("MockUSDC");
    const oracle = await viem.deployContract("DemoOracle");
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      oracle.address,
      token.address,
      deployer.account.address,
    ]);
    await vault.write.setPositionManager([pm.address]);
    // Funding off so the arithmetic below is exact; funding has its own tests
    // and is covered in the liability maths separately.
    await pm.write.setFundingRatePerBlockWad([0n]);
    await oracle.write.setPrice([NVDA, PRICE]);
    await oracle.write.setPrice([BTC, usd(65_000)]);

    for (const w of [lpA, lpB, attacker]) {
      await token.write.mint([w.account.address, usdc(100_000)]);
      await token.write.approve([vault.address, usdc(100_000)], { account: w.account });
    }
    await token.write.mint([trader.account.address, usdc(100_000)]);
    await token.write.approve([pm.address, usdc(100_000)], { account: trader.account });
    return { token, oracle, vault, pm };
  }

  async function redeemAll(vault: Awaited<ReturnType<typeof setup>>["vault"], token: Awaited<ReturnType<typeof setup>>["token"], who: typeof lpA) {
    const before = await token.read.balanceOf([who.account.address]);
    const shares = await vault.read.sharesOf([who.account.address]);
    await vault.write.removeLiquidity([shares], { account: who.account });
    return (await token.read.balanceOf([who.account.address])) - before;
  }

  it("a late LP gets its deposit back when traders close flat (was 17,782.22 of 20,000)", async function () {
    const { token, vault, pm } = await setup();

    await vault.write.addLiquidity([usdc(20_000)], { account: lpA.account });
    await pm.write.openPosition([NVDA, usdc(5_000), 10_000n, true, []], { account: trader.account });
    await vault.write.addLiquidity([usdc(20_000)], { account: lpB.account });
    await pm.write.closePosition([1n, 0n, 0n, []], { account: trader.account });

    const outB = await redeemAll(vault, token, lpB);
    const outA = await redeemAll(vault, token, lpA);

    // Both LPs get at least what they put in; the open+close fees (~10 USDC)
    // are split between them. Nothing near the old 2,217.78 transfer.
    assert.ok(outB >= usdc(20_000), `LP-B got ${outB}`);
    assert.ok(outB < usdc(20_010), `LP-B got ${outB}`);
    assert.ok(outA >= usdc(20_000), `LP-A got ${outA}`);
    assert.ok(outA < usdc(20_010), `LP-A got ${outA}`);
  });

  it("deposit NAV excludes open collateral; withdrawal NAV never counts unrealised trader losses", async function () {
    const { oracle, vault, pm } = await setup();
    await vault.write.addLiquidity([usdc(20_000)], { account: lpA.account });
    await pm.write.openPosition([NVDA, usdc(5_000), 10_000n, true, []], { account: trader.account });

    const coll = usd(5_000) - (usd(5_000) * 10n) / 10_000n; // net of the 0.1% open fee
    const assets = await vault.read.totalAssets();
    assert.equal(await pm.read.totalOpenCollateralUsd(), coll);
    assert.equal(await vault.read.lpNavUsd([false]), assets - coll);
    assert.equal(await vault.read.lpNavUsd([true]), assets - coll);

    // Trader down 10%: entering LPs see the loss, leaving LPs do not get paid it.
    await oracle.write.setPrice([NVDA, usd(162)]);
    const loss = coll / 10n;
    assert.equal(await vault.read.lpNavUsd([false]), assets - (coll - loss));
    assert.equal(await vault.read.lpNavUsd([true]), assets - coll);

    // Trader up 10%: both directions carry the gain as a liability.
    await oracle.write.setPrice([NVDA, usd(198)]);
    assert.equal(await vault.read.lpNavUsd([false]), assets - (coll + loss));
    assert.equal(await vault.read.lpNavUsd([true]), assets - (coll + loss));
  });

  it("a late LP does not buy into a trader's unrealised profit, and keeps its money when it is paid", async function () {
    const { token, oracle, vault, pm } = await setup();
    await vault.write.addLiquidity([usdc(20_000)], { account: lpA.account });
    await pm.write.openPosition([NVDA, usdc(2_000), 50_000n, true, []], { account: trader.account }); // 5x
    await oracle.write.setPrice([NVDA, usd(198)]); // +10% -> +50% on margin

    await vault.write.addLiquidity([usdc(20_000)], { account: lpB.account });
    await pm.write.closePosition([1n, 0n, 0n, []], { account: trader.account });

    const outB = await redeemAll(vault, token, lpB);
    // The ~1,000 profit was owed before LP-B arrived, so LP-A bears it.
    assert.ok(outB >= usdc(19_999), `LP-B got ${outB}`);
    assert.ok(outB <= usdc(20_005), `LP-B got ${outB}`);
  });

  it("liability is capped at each side's payout cap and tracks shorts", async function () {
    const { oracle, vault, pm } = await setup();
    await vault.write.addLiquidity([usdc(50_000)], { account: lpA.account });
    await pm.write.openPosition([BTC, usdc(1_000), 20_000n, false, []], { account: trader.account }); // 2x short
    await pm.write.openPosition([NVDA, usdc(1_000), 20_000n, true, []], { account: trader.account }); // 2x long
    const s = await pm.read.getPosition([1n]);
    const l = await pm.read.getPosition([2n]);
    const near = (a: bigint, b: bigint) => (a > b ? a - b : b - a) < 10n ** 6n;

    // BTC -50%: short gains half its size (below its cap). NVDA x3: long gains
    // 2x size, above its cap, so only the cap counts.
    await oracle.write.setPrice([BTC, usd(32_500)]);
    await oracle.write.setPrice([NVDA, usd(540)]);
    const expected = s.collateralUsd + s.sizeUsd / 2n + l.payoutCapUsd;
    assert.ok(near(await pm.read.lpLiabilityUsd([true]), expected));
    assert.ok(near(await pm.read.lpLiabilityUsd([false]), expected));

    // Short wiped out, long back at entry.
    await oracle.write.setPrice([BTC, usd(130_000)]);
    await oracle.write.setPrice([NVDA, PRICE]);
    assert.ok(near(await pm.read.lpLiabilityUsd([false]), l.collateralUsd));
    assert.ok(near(await pm.read.lpLiabilityUsd([true]), s.collateralUsd + l.collateralUsd));
  });

  it("feeds leave the book when their last position closes", async function () {
    const { vault, pm } = await setup();
    await vault.write.addLiquidity([usdc(50_000)], { account: lpA.account });
    await pm.write.openPosition([NVDA, usdc(100), 10_000n, true, []], { account: trader.account });
    await pm.write.openPosition([BTC, usdc(100), 10_000n, false, []], { account: trader.account });
    await pm.write.openPosition([NVDA, usdc(100), 10_000n, false, []], { account: trader.account });
    assert.equal(await pm.read.activeFeedCount(), 2n);

    await pm.write.closePosition([1n, 0n, 0n, []], { account: trader.account });
    assert.equal(await pm.read.activeFeedCount(), 2n); // NVDA short still open
    await pm.write.closePosition([2n, 0n, 0n, []], { account: trader.account });
    assert.equal(await pm.read.activeFeedCount(), 1n);
    await pm.write.closePosition([3n, 0n, 0n, []], { account: trader.account });
    assert.equal(await pm.read.activeFeedCount(), 0n);
    assert.equal(await pm.read.totalOpenCollateralUsd(), 0n);
    assert.equal(await pm.read.lpLiabilityUsd([true]), 0n);
  });

  it("liability includes funding owed TO traders", async function () {
    const { vault, pm } = await setup();
    await pm.write.setFundingRatePerBlockWad([10n ** 13n]);
    await vault.write.addLiquidity([usdc(50_000)], { account: lpA.account });
    // Long-heavy book: shorts are paid funding.
    await pm.write.openPosition([NVDA, usdc(5_000), 10_000n, true, []], { account: trader.account });
    await pm.write.openPosition([NVDA, usdc(1_000), 10_000n, false, []], { account: trader.account });
    const before = await pm.read.lpLiabilityUsd([true]);
    for (let i = 0; i < 20; i++) await publicClient.request({ method: "evm_mine", params: [] } as never);
    const after = await pm.read.lpLiabilityUsd([true]);
    assert.ok(after > before, "short side's funding income must raise the liability");
  });

  it("first-depositor inflation attack does not pay", async function () {
    const { token, vault } = await setup();
    // Attacker seeds 1 micro-USDC, then donates 10,000 USDC straight to the vault.
    await vault.write.addLiquidity([1n], { account: attacker.account });
    await token.write.transfer([vault.address, usdc(10_000)], { account: attacker.account });

    await vault.write.addLiquidity([usdc(10_000)], { account: lpB.account });
    assert.ok((await vault.read.sharesOf([lpB.account.address])) > 0n);

    const victimOut = await redeemAll(vault, token, lpB);
    const attackerOut = await redeemAll(vault, token, attacker);
    assert.ok(victimOut >= usdc(9_990), `victim got ${victimOut}`);
    assert.ok(attackerOut < usdc(10), `attacker recovered ${attackerOut} of a 10,000 donation`);
  });

  it("falls back to cap/collateral when a feed cannot be priced", async function () {
    const token = await viem.deployContract("MockUSDC");
    const pyth = await viem.deployContract("MockPyth");
    const adapter = await viem.deployContract("PythOracleAdapter", [pyth.address, 60n, deployer.account.address]);
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      adapter.address,
      token.address,
      deployer.account.address,
    ]);
    await vault.write.setPositionManager([pm.address]);
    const now = await publicClient.getBlock().then((b) => b.timestamp);
    await pyth.write.setPrice([BTC, 6_500_000_000_000n, -8, now, 0n]);

    await token.write.mint([lpA.account.address, usdc(50_000)]);
    await token.write.approve([vault.address, usdc(50_000)], { account: lpA.account });
    await vault.write.addLiquidity([usdc(50_000)], { account: lpA.account });
    await token.write.mint([trader.account.address, usdc(1_000)]);
    await token.write.approve([pm.address, usdc(1_000)], { account: trader.account });
    await pm.write.openPosition([BTC, usdc(1_000), 20_000n, true, []], { account: trader.account });
    const p = await pm.read.getPosition([1n]);

    await publicClient.request({ method: "evm_increaseTime", params: [3_600] } as never);
    await publicClient.request({ method: "evm_mine", params: [] } as never);
    await assert.rejects(adapter.read.getPrice([BTC])); // stale

    assert.equal(await pm.read.lpLiabilityUsd([true]), p.payoutCapUsd);
    assert.equal(await pm.read.lpLiabilityUsd([false]), p.collateralUsd);
  });
});
