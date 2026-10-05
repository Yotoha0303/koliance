import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * The perp module moves between 6-decimal USDC and 18-decimal internal USD.
 * These tests exist mainly to pin the 6-decimal assumption down early — if
 * MockUSDC ever drifts to 18, every conversion in Vault/PositionManager breaks
 * silently and the demo would show wrong numbers on stage.
 */
describe("MockUSDC", async function () {
  const { viem } = await network.getOrCreate();
  const [walletClient, otherWalletClient] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const ONE_USDC = 1_000_000n; // 6 decimals

  it("Uses 6 decimals to match real USDC", async function () {
    const usdc = await viem.deployContract("MockUSDC");

    assert.equal(await usdc.read.decimals(), 6);
    assert.equal(await usdc.read.symbol(), "mUSDC");
  });

  it("Mints to an arbitrary address and tracks supply", async function () {
    const usdc = await viem.deployContract("MockUSDC");

    await usdc.write.mint([walletClient.account.address, 1_000n * ONE_USDC]);

    assert.equal(await usdc.read.balanceOf([walletClient.account.address]), 1_000n * ONE_USDC);
    assert.equal(await usdc.read.totalSupply(), 1_000n * ONE_USDC);
  });

  it("Batch mints to seed demo accounts", async function () {
    const usdc = await viem.deployContract("MockUSDC");
    const recipients = [walletClient.account.address, otherWalletClient.account.address];

    await usdc.write.mintTo([recipients, 500n * ONE_USDC]);

    for (const r of recipients) {
      assert.equal(await usdc.read.balanceOf([r]), 500n * ONE_USDC);
    }
    assert.equal(await usdc.read.totalSupply(), 1_000n * ONE_USDC);
  });

  it("Transfers and rejects overdrafts", async function () {
    const usdc = await viem.deployContract("MockUSDC");
    await usdc.write.mint([walletClient.account.address, 100n * ONE_USDC]);

    await usdc.write.transfer([otherWalletClient.account.address, 30n * ONE_USDC]);
    assert.equal(await usdc.read.balanceOf([otherWalletClient.account.address]), 30n * ONE_USDC);
    assert.equal(await usdc.read.balanceOf([walletClient.account.address]), 70n * ONE_USDC);

    await assert.rejects(
      usdc.write.transfer([otherWalletClient.account.address, 200n * ONE_USDC], {
        account: walletClient.account,
      })
    );
  });

  it("Honours allowance on transferFrom and decrements it", async function () {
    const usdc = await viem.deployContract("MockUSDC");
    const owner = walletClient.account.address;
    const spender = otherWalletClient.account.address;

    await usdc.write.mint([owner, 100n * ONE_USDC]);
    await usdc.write.approve([spender, 40n * ONE_USDC]);

    await usdc.write.transferFrom([owner, spender, 25n * ONE_USDC], {
      account: otherWalletClient.account,
    });

    assert.equal(await usdc.read.balanceOf([spender]), 25n * ONE_USDC);
    assert.equal(await usdc.read.allowance([owner, spender]), 15n * ONE_USDC);

    await assert.rejects(
      usdc.write.transferFrom([owner, spender, 20n * ONE_USDC], {
        account: otherWalletClient.account,
      })
    );
  });

  it("A max approval is not decremented", async function () {
    const usdc = await viem.deployContract("MockUSDC");
    const owner = walletClient.account.address;
    const spender = otherWalletClient.account.address;
    const MAX = 2n ** 256n - 1n;

    await usdc.write.mint([owner, 100n * ONE_USDC]);
    await usdc.write.approve([spender, MAX]);
    await usdc.write.transferFrom([owner, spender, 10n * ONE_USDC], {
      account: otherWalletClient.account,
    });

    assert.equal(await usdc.read.allowance([owner, spender]), MAX);
  });

  it("Emits Transfer on mint", async function () {
    const usdc = await viem.deployContract("MockUSDC");

    await viem.assertions.emitWithArgs(
      usdc.write.mint([walletClient.account.address, ONE_USDC]),
      usdc,
      "Transfer",
      ["0x0000000000000000000000000000000000000000", walletClient.account.address, ONE_USDC]
    );
  });
});
