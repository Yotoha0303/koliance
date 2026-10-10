import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * The normalization is the reason this file exists. Pyth reports `int64 price` plus
 * a separate `int32 expo`, and the exponent differs by feed — BTC/USD uses -8 while
 * Equity.US.NVDA/USD uses -5. An adapter that assumes -8 silently misprices equity
 * feeds by 1000x, which is the kind of bug that only shows up as wrong numbers on
 * stage. Every exponent case is covered explicitly below.
 */

const E18 = 10n ** 18n;
const usd = (n: bigint | number) => BigInt(n) * E18;

const BTC = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as const;
const NVDA_US = "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593" as const;

describe("PythOracleAdapter", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, other] = await viem.getWalletClients();

  /** Realistic expo values, taken from live feeds. */
  const EXPO_BTC = -8;
  const EXPO_NVDA = -5;

  async function setup(maxStaleness = 60n) {
    const pyth = await viem.deployContract("MockPyth");
    const adapter = await viem.deployContract("PythOracleAdapter", [
      pyth.address,
      maxStaleness,
      deployer.account.address,
    ]);
    const publicClient = await viem.getPublicClient();
    const now = await publicClient.getBlock().then((b) => b.timestamp);
    return { pyth, adapter, now };
  }

  // ==================== NORMALIZATION ====================

  it("Normalizes an expo -8 feed (BTC) to 18 decimals", async function () {
    const { pyth, adapter, now } = await setup();

    // BTC at 8310629537408 with expo -8 is $83,106.29537408.
    await pyth.write.setPrice([BTC, 8_310_629_537_408n, EXPO_BTC, now, 0n]);

    const [price] = await adapter.read.getPrice([BTC]);
    assert.equal(price, usd(83_106) + (295_374_080_000_000_000n));
  });

  it("Normalizes an expo -5 feed (Equity.US.NVDA) to 18 decimals", async function () {
    const { pyth, adapter, now } = await setup();

    // The live Monad value: 22511000 with expo -5 is $225.11. An adapter that
    // hardcoded -8 would read this as $0.22511.
    await pyth.write.setPrice([NVDA_US, 22_511_000n, EXPO_NVDA, now, 0n]);

    const [price] = await adapter.read.getPrice([NVDA_US]);
    assert.equal(price, usd(225) + (11n * E18) / 100n);
  });

  it("Handles an expo of 0", async function () {
    const { pyth, adapter, now } = await setup();

    await pyth.write.setPrice([BTC, 42n, 0, now, 0n]);

    assert.equal((await adapter.read.getPrice([BTC]))[0], usd(42));
  });

  it("Handles a positive exponent by multiplying", async function () {
    const { pyth, adapter, now } = await setup();

    // 7 with expo +2 is 700. shift = 18 + 2 = 20, so 7 * 10^20 = 700e18.
    await pyth.write.setPrice([BTC, 7n, 2, now, 0n]);

    assert.equal((await adapter.read.getPrice([BTC]))[0], usd(700));
  });

  it("Rejects a zero price", async function () {
    const { pyth, adapter, now } = await setup();
    await pyth.write.setPrice([BTC, 0n, EXPO_BTC, now, 0n]);

    await assert.rejects(adapter.read.getPrice([BTC]));
  });

  it("Rejects a negative price", async function () {
    const { pyth, adapter, now } = await setup();
    await pyth.write.setPrice([BTC, -1n, EXPO_BTC, now, 0n]);

    await assert.rejects(adapter.read.getPrice([BTC]));
  });

  it("Rejects an absurd exponent rather than overflowing the scale", async function () {
    const { pyth, adapter, now } = await setup();
    await pyth.write.setPrice([BTC, 1n, 40, now, 0n]);

    await assert.rejects(adapter.read.getPrice([BTC]));
  });

  // ==================== FEED REGISTRATION ====================

  it("Reverts with a legible error for an unregistered feed", async function () {
    const { adapter } = await setup();

    // This is exactly what the on-chain probes found for Equity.Index.NVDA/USD.
    await assert.rejects(adapter.read.getPrice([BTC]));
  });

  it("Reports whether a feed is registered", async function () {
    const { pyth, adapter, now } = await setup();
    await pyth.write.setPrice([BTC, 100n, EXPO_BTC, now, 0n]);

    assert.equal(await adapter.read.feedExists([BTC]), true);
    assert.equal(await adapter.read.feedExists([NVDA_US]), false);
  });

  // ==================== STALENESS ====================

  it("Returns the publish time alongside the price", async function () {
    const { pyth, adapter, now } = await setup();
    await pyth.write.setPrice([BTC, 8_310_629_537_408n, EXPO_BTC, now, 0n]);

    const [, publishTime] = await adapter.read.getPrice([BTC]);
    assert.equal(publishTime, now);
  });

  it("Reverts on a price older than the staleness bound", async function () {
    const { pyth, adapter, now } = await setup();

    // 143 days stale, matching the live Equity.US.NVDA/USD reading on Monad.
    const ancient = now - 143n * 86_400n;
    await pyth.write.setPrice([NVDA_US, 22_511_000n, EXPO_NVDA, ancient, 0n]);

    await assert.rejects(adapter.read.getPrice([NVDA_US]));
  });

  it("Accepts a price inside the staleness bound", async function () {
    const { pyth, adapter, now } = await setup();
    await pyth.write.setPrice([BTC, 100n, EXPO_BTC, now - 30n, 0n]);

    await adapter.read.getPrice([BTC]);
  });

  it("Allows an explicit override of the staleness bound", async function () {
    const { pyth, adapter, now } = await setup();

    const ancient = now - 1_000n;
    await pyth.write.setPrice([BTC, 100n, EXPO_BTC, ancient, 0n]);

    await assert.rejects(adapter.read.getPrice([BTC])); // default bound is 60s
    await adapter.read.getPriceNoOlderThan([BTC, 5_000n]); // widened explicitly
  });

  it("Refuses a staleness bound below Pyth's own minimum interval", async function () {
    const pyth = await viem.deployContract("MockPyth");
    await pyth.write.setValidTimePeriod([60n]);

    await assert.rejects(
      viem.deployContract("PythOracleAdapter", [
        pyth.address,
        30n,
        deployer.account.address,
      ])
    );
  });

  it("Constructs even when the Pyth address has no contract behind it", async function () {
    // A constructor that cannot complete without an external contract is a
    // deployment hazard, and it makes the Ignition module un-simulatable locally.
    const adapter = await viem.deployContract("PythOracleAdapter", [
      other.account.address, // an EOA — no code, so the probe will fail
      60n,
      deployer.account.address,
    ]);

    assert.equal(await adapter.read.maxStaleness(), 60n);
  });

  it("Only the owner may change the staleness bound", async function () {
    const { adapter } = await setup();

    await assert.rejects(
      adapter.write.setMaxStaleness([1_000n], { account: other.account })
    );
    await adapter.write.setMaxStaleness([1_000n]);
    assert.equal(await adapter.read.maxStaleness(), 1_000n);
  });

  // ==================== PUSH ====================

  it("Pushes updates and pays the fee from its own balance", async function () {
    const { pyth, adapter } = await setup();
    await pyth.write.setUpdateFee([1_000n]);

    // Fund the adapter so it can cover the fee.
    await deployer.sendTransaction({ to: adapter.address, value: 10_000n });

    await adapter.write.updatePriceFeeds([["0xdeadbeef"]]);

    assert.equal(await pyth.read.updateCallCount(), 1n);
  });

  it("Reverts a push it cannot fund, so a caller can decide to swallow it", async function () {
    const { pyth, adapter } = await setup();
    await pyth.write.setUpdateFee([1_000n]);

    // No balance on the adapter.
    await assert.rejects(adapter.write.updatePriceFeeds([["0xdeadbeef"]]));
  });

  it("Treats an empty update batch as a no-op", async function () {
    const { pyth, adapter } = await setup();

    await adapter.write.updatePriceFeeds([[]]);

    assert.equal(await pyth.read.updateCallCount(), 0n);
  });

  it("Refuses pushes from a stranger, so nobody can drain the fee balance", async function () {
    const { pyth, adapter } = await setup();
    await pyth.write.setUpdateFee([1_000n]);
    await deployer.sendTransaction({ to: adapter.address, value: 10_000n });

    await assert.rejects(
      adapter.write.updatePriceFeeds([["0xdeadbeef"]], { account: other.account }),
      /NotUpdater/
    );
    assert.equal(await pyth.read.updateCallCount(), 0n);
  });

  it("Accepts pushes from an allow-listed updater, and stops after revocation", async function () {
    const { pyth, adapter } = await setup();
    await pyth.write.setUpdateFee([0n]);

    await adapter.write.setUpdater([other.account.address, true]);
    assert.equal(await adapter.read.isUpdater([other.account.address]), true);
    await adapter.write.updatePriceFeeds([["0xdeadbeef"]], { account: other.account });
    assert.equal(await pyth.read.updateCallCount(), 1n);

    await adapter.write.setUpdater([other.account.address, false]);
    await assert.rejects(
      adapter.write.updatePriceFeeds([["0xdeadbeef"]], { account: other.account }),
      /NotUpdater/
    );
  });

  it("Only the owner may manage updaters, and never the zero address", async function () {
    const { adapter } = await setup();
    await assert.rejects(adapter.write.setUpdater([other.account.address, true], { account: other.account }));
    await assert.rejects(
      adapter.write.setUpdater(["0x0000000000000000000000000000000000000000", true]),
      /ZeroAddress/
    );
  });

  it("Only the owner may withdraw leftover MON", async function () {
    const { adapter } = await setup();
    await deployer.sendTransaction({ to: adapter.address, value: 10_000n });

    await assert.rejects(
      adapter.write.withdraw([other.account.address, 1_000n], { account: other.account })
    );
  });
});
