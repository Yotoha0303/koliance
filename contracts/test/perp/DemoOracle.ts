import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * Feed ids are inlined as literals rather than imported from `src/lib/perpConfig.ts`.
 * `contracts/` is ESM while the root package is not, and importing across that
 * boundary breaks tsc (see the note in src/lib/perpConfig.ts). The contract side
 * treats feed ids as opaque arguments anyway — they are only meaningful off chain.
 */
const NVDA =
  "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const TSLA =
  "0xe6da44bff5b8b06897a3739dd331b440d6662595bb862e37046892c568ae3fc0" as const;
const BTC =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as const;

const E18 = 10n ** 18n;
const NVDA_PRICE = 180n * E18;

describe("DemoOracle", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, otherAccount] = await viem.getWalletClients();

  it("Round-trips a price set by the owner", async function () {
    const oracle = await viem.deployContract("DemoOracle");
    await oracle.write.setPrice([NVDA, NVDA_PRICE]);

    const [price, publishTime] = await oracle.read.getPrice([NVDA]);
    assert.equal(price, NVDA_PRICE);
    assert.ok(publishTime > 0n);
  });

  it("Rejects reads for a feed that was never set", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await assert.rejects(oracle.read.getPrice([NVDA]));
  });

  it("Rejects a zero price", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await assert.rejects(oracle.write.setPrice([NVDA, 0n]));
  });

  it("Only the owner may set prices", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await assert.rejects(
      oracle.write.setPrice([NVDA, NVDA_PRICE], { account: otherAccount.account })
    );
  });

  it("Sets several prices in one transaction", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await oracle.write.setPrices(
      [
        [NVDA, TSLA, BTC],
        [180n * E18, 250n * E18, 65_000n * E18],
      ]
    );

    assert.equal((await oracle.read.getPrice([NVDA]))[0], 180n * E18);
    assert.equal((await oracle.read.getPrice([TSLA]))[0], 250n * E18);
    assert.equal((await oracle.read.getPrice([BTC]))[0], 65_000n * E18);
  });

  it("Rejects mismatched batch lengths", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await assert.rejects(oracle.write.setPrices([[NVDA, TSLA], [180n * E18]]));
  });

  it("Bumps a price down by bps — the crash-the-market control", async function () {
    const oracle = await viem.deployContract("DemoOracle");
    await oracle.write.setPrice([NVDA, NVDA_PRICE]);

    // -1500 bps = -15%. 15% of 180 is 27, so 180 -> 153.
    await oracle.write.bumpPrice([NVDA, -1500n]);

    assert.equal((await oracle.read.getPrice([NVDA]))[0], 153n * E18);
  });

  it("Bumps a price up by bps", async function () {
    const oracle = await viem.deployContract("DemoOracle");
    await oracle.write.setPrice([NVDA, NVDA_PRICE]);

    await oracle.write.bumpPrice([NVDA, 1000n]);

    assert.equal((await oracle.read.getPrice([NVDA]))[0], 198n * E18);
  });

  it("Rejects a bump on a feed that was never set", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await assert.rejects(oracle.write.bumpPrice([NVDA, -1500n]));
  });

  it("Rejects a bump of 100% or more, which would zero or invert the price", async function () {
    const oracle = await viem.deployContract("DemoOracle");
    await oracle.write.setPrice([NVDA, NVDA_PRICE]);

    await assert.rejects(oracle.write.bumpPrice([NVDA, -10_000n]));
    await assert.rejects(oracle.write.bumpPrice([NVDA, 10_000n]));
    await assert.rejects(oracle.write.bumpPrice([NVDA, -50_000n]));
  });

  it("Only the owner may bump prices", async function () {
    const oracle = await viem.deployContract("DemoOracle");
    await oracle.write.setPrice([NVDA, NVDA_PRICE]);

    await assert.rejects(
      oracle.write.bumpPrice([NVDA, -1500n], { account: otherAccount.account })
    );
  });

  it("Advances the publish timestamp on each write", async function () {
    const oracle = await viem.deployContract("DemoOracle");
    await oracle.write.setPrice([NVDA, NVDA_PRICE]);
    const [, first] = await oracle.read.getPrice([NVDA]);

    await oracle.write.bumpPrice([NVDA, -1500n]);

    const [, second] = await oracle.read.getPrice([NVDA]);
    assert.ok(second >= first);
  });

  it("Emits PriceSet on set and bump", async function () {
    const oracle = await viem.deployContract("DemoOracle");
    const publicClient = await viem.getPublicClient();

    await oracle.write.setPrice([NVDA, NVDA_PRICE]);
    const setEvents = await publicClient.getContractEvents({
      address: oracle.address,
      abi: oracle.abi,
      eventName: "PriceSet",
      fromBlock: 0n,
    });
    assert.equal(setEvents.length, 1);
    assert.equal(setEvents[0].args.feedId, NVDA);
    assert.equal(setEvents[0].args.price, NVDA_PRICE);

    await oracle.write.bumpPrice([NVDA, -1500n]);
    const bumpEvents = await publicClient.getContractEvents({
      address: oracle.address,
      abi: oracle.abi,
      eventName: "PriceSet",
      fromBlock: 0n,
    });
    assert.equal(bumpEvents.length, 2);
    assert.equal(bumpEvents[1].args.price, 153n * E18);
  });

  it("Transfers ownership and revokes the previous owner", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await oracle.write.transferOwnership([otherAccount.account.address]);
    assert.equal(
      (await oracle.read.owner()).toLowerCase(),
      otherAccount.account.address.toLowerCase()
    );

    // The original deployer is no longer the owner.
    await assert.rejects(oracle.write.setPrice([NVDA, NVDA_PRICE]));

    // The new owner can write.
    await oracle.write.setPrice([NVDA, NVDA_PRICE], { account: otherAccount.account });
    assert.equal((await oracle.read.getPrice([NVDA]))[0], NVDA_PRICE);
  });

  it("Rejects transferring ownership to the zero address", async function () {
    const oracle = await viem.deployContract("DemoOracle");

    await assert.rejects(oracle.write.transferOwnership(["0x0000000000000000000000000000000000000000"]));
  });
});
