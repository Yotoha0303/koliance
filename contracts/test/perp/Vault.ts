import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * Units in play: MockUSDC is 6-decimal, the Vault's internal USD is 18-decimal.
 * `usdcToUsdScale` is therefore 1e12. Most of these tests exist to pin that
 * conversion down — mixing the two units is the main hazard in the Vault and the
 * failure mode (silently wrong payouts) is not visible without asserting numbers.
 */
const E18 = 10n ** 18n;
const E6 = 10n ** 6n;

const ONE_USDC = E6;
const THOUSAND_USDC = 1_000n * E6;

/** 18-decimal USD helper for readability. */
const usd = (n: bigint | number) => BigInt(n) * E18;

/** 6-decimal USDC helper. */
const usdc = (n: bigint | number) => BigInt(n) * E6;

describe("Vault", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, lp, other, positionManager] = await viem.getWalletClients();

  /** Deploy MockUSDC + Vault and fund `lp`. */
  async function setup() {
    const token = await viem.deployContract("MockUSDC");
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);

    await token.write.mint([lp.account.address, usdc(10_000)]);
    await token.write.approve([vault.address, usdc(10_000)], { account: lp.account });

    return { token, vault };
  }

  // ==================== CONSTRUCTION ====================

  it("Rejects an asset whose decimals are not 6", async function () {
    const eighteen = await viem.deployContract("MockERC20", [18]);

    await assert.rejects(
      viem.deployContract("Vault", [eighteen.address, deployer.account.address])
    );
  });

  it("Accepts a 6-decimal asset and records the conversion scale", async function () {
    const { vault } = await setup();

    assert.equal(await vault.read.usdcToUsdScale(), 10n ** 12n);
  });

  it("Hands ownership to the account passed to the constructor", async function () {
    const token = await viem.deployContract("MockUSDC");
    const vault = await viem.deployContract("Vault", [token.address, other.account.address]);

    assert.equal((await vault.read.owner()).toLowerCase(), other.account.address.toLowerCase());
  });

  // ==================== LP ====================

  it("Mints shares 1:1 in USD terms on the first deposit", async function () {
    const { vault } = await setup();

    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });

    assert.equal(await vault.read.totalShares(), usd(1_000));
    assert.equal(await vault.read.sharesOf([lp.account.address]), usd(1_000));
    assert.equal(await vault.read.totalAssets(), usd(1_000));
  });

  it("Mints shares proportionally on later deposits", async function () {
    const { vault } = await setup();

    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.addLiquidity([usdc(500)], { account: lp.account });

    // 1500 USDC total against 1000 shares minted first -> 1500 shares.
    assert.equal(await vault.read.totalShares(), usd(1_500));
    assert.equal(await vault.read.totalAssets(), usd(1_500));
  });

  it("Rejects a zero deposit", async function () {
    const { vault } = await setup();

    await assert.rejects(vault.write.addLiquidity([0n], { account: lp.account }));
  });

  it("Returns principal on withdrawal", async function () {
    const { token, vault } = await setup();
    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });

    await vault.write.removeLiquidity([usd(400)], { account: lp.account });

    assert.equal(await vault.read.totalShares(), usd(600));
    assert.equal(await token.read.balanceOf([lp.account.address]), usdc(9_400));
  });

  it("Rejects withdrawing more shares than held", async function () {
    const { vault } = await setup();
    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });

    await assert.rejects(
      vault.write.removeLiquidity([usd(1_001)], { account: lp.account })
    );
  });

  it("Tracks two LPs independently", async function () {
    const { token, vault } = await setup();
    await token.write.mint([other.account.address, THOUSAND_USDC]);
    await token.write.approve([vault.address, THOUSAND_USDC], { account: other.account });

    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.addLiquidity([THOUSAND_USDC], { account: other.account });

    assert.equal(await vault.read.sharesOf([lp.account.address]), usd(1_000));
    assert.equal(await vault.read.sharesOf([other.account.address]), usd(1_000));
    assert.equal(await vault.read.totalShares(), usd(2_000));
  });

  // ==================== RESERVE GATING ====================
  // The reason reservedAssets() exists: LPs must not be able to withdraw the
  // collateral backing live positions, or winning traders end up unpaid.

  it("Blocks a withdrawal larger than the unreserved balance", async function () {
    const { vault } = await setup();
    const pm = await viem.deployContract("MockPositionManager");

    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.setPositionManager([pm.address]);

    // 600 of the 1000 is backing open positions.
    await pm.write.setReserved([usd(600)]);

    assert.equal(await vault.read.reservedAssets(), usd(600));
    assert.equal(await vault.read.availableAssets(), usd(400));

    await assert.rejects(
      vault.write.removeLiquidity([usd(1_000)], { account: lp.account })
    );
  });

  it("Allows a withdrawal up to the unreserved balance", async function () {
    const { vault } = await setup();
    const pm = await viem.deployContract("MockPositionManager");

    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.setPositionManager([pm.address]);
    await pm.write.setReserved([usd(600)]);

    await vault.write.removeLiquidity([usd(400)], { account: lp.account });

    assert.equal(await vault.read.totalShares(), usd(600));
  });

  it("Treats the reserve as zero before the PositionManager is wired", async function () {
    const { vault } = await setup();
    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });

    assert.equal(await vault.read.reservedAssets(), 0n);
    assert.equal(await vault.read.availableAssets(), usd(1_000));
  });

  it("Clamps available assets at zero when the reserve exceeds the pool", async function () {
    const { vault } = await setup();
    const pm = await viem.deployContract("MockPositionManager");

    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.setPositionManager([pm.address]);
    await pm.write.setReserved([usd(5_000)]);

    assert.equal(await vault.read.availableAssets(), 0n);
  });

  // ==================== WIRING ====================

  it("Wires the PositionManager once", async function () {
    const { vault } = await setup();
    const pm = await viem.deployContract("MockPositionManager");

    await vault.write.setPositionManager([pm.address]);

    assert.equal((await vault.read.positionManager()).toLowerCase(), pm.address.toLowerCase());
  });

  it("Refuses to rewire the PositionManager", async function () {
    const { vault } = await setup();
    const pm = await viem.deployContract("MockPositionManager");
    const pm2 = await viem.deployContract("MockPositionManager");

    await vault.write.setPositionManager([pm.address]);

    await assert.rejects(vault.write.setPositionManager([pm2.address]));
  });

  it("Only the owner may wire the PositionManager", async function () {
    const { vault } = await setup();
    const pm = await viem.deployContract("MockPositionManager");

    await assert.rejects(
      vault.write.setPositionManager([pm.address], { account: other.account })
    );
  });

  // ==================== PAYOUT ====================

  it("Pays a trader out of the pool", async function () {
    const { token, vault } = await setup();
    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.setPositionManager([positionManager.account.address]);

    await vault.write.payOut([other.account.address, usd(120)], {
      account: positionManager.account,
    });

    assert.equal(await token.read.balanceOf([other.account.address]), usdc(120));
    assert.equal(await vault.read.totalAssets(), usd(880));
  });

  it("Refuses a payout the pool cannot fund", async function () {
    const { vault } = await setup();
    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.setPositionManager([positionManager.account.address]);

    await assert.rejects(
      vault.write.payOut([other.account.address, usd(1_001)], {
        account: positionManager.account,
      })
    );
  });

  it("Refuses a payout from anyone but the PositionManager", async function () {
    const { vault } = await setup();
    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });

    // Not wired at all.
    await assert.rejects(
      vault.write.payOut([other.account.address, usd(1)], { account: other.account })
    );

    // Wired, but a third party still cannot call it.
    await vault.write.setPositionManager([positionManager.account.address]);
    await assert.rejects(
      vault.write.payOut([other.account.address, usd(1)], { account: other.account })
    );
  });

  it("Refuses a payout that rounds to zero USDC", async function () {
    const { vault } = await setup();
    await vault.write.addLiquidity([THOUSAND_USDC], { account: lp.account });
    await vault.write.setPositionManager([positionManager.account.address]);

    // 1e11 wei of USD is 0.1 USDC in 18-decimal terms... but below one USDC unit
    // would truncate to zero. Use an amount smaller than 1e12 (one USDC).
    await assert.rejects(
      vault.write.payOut([other.account.address, 1n], { account: positionManager.account })
    );
  });

  // ==================== FEES ====================

  it("Records fees from the PositionManager", async function () {
    const { vault } = await setup();
    await vault.write.setPositionManager([positionManager.account.address]);

    await vault.write.receiveFees([usd(10)], { account: positionManager.account });

    assert.equal(await vault.read.accumulatedFees(), usd(10));
  });

  it("Refuses fee records from anyone but the PositionManager", async function () {
    const { vault } = await setup();
    await vault.write.setPositionManager([positionManager.account.address]);

    await assert.rejects(
      vault.write.receiveFees([usd(10)], { account: other.account })
    );
  });

  // ==================== UNITS ====================

  it("Converts between USDC and USD in both directions", async function () {
    const { vault } = await setup();

    assert.equal(await vault.read.usdcToUsd([ONE_USDC]), usd(1));
    assert.equal(await vault.read.usdToUsdc([usd(1)]), ONE_USDC);
  });

  it("Truncates rather than rounds up when converting USD down to USDC", async function () {
    const { vault } = await setup();

    // Half a USDC unit (5e5 wei of 6-decimal) is not representable in USD->USDC
    // at full precision; the conversion must never round up and overpay.
    assert.equal(await vault.read.usdToUsdc([usd(1) + 1n]), ONE_USDC);
  });
});
