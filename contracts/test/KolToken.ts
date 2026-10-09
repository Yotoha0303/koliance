import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("KolToken (kol / ICON)", async function () {
  const { viem } = await network.getOrCreate();
  const testClient = await viem.getTestClient();
  const [ownerClient, minerClient, recipientClient] = await viem.getWalletClients();

  it("Should have correct token metadata and max supply", async function () {
    const kolToken = await viem.deployContract("KolToken");

    const name = await kolToken.read.name();
    const symbol = await kolToken.read.symbol();
    const decimals = await kolToken.read.decimals();
    const maxSupply = await kolToken.read.MAX_SUPPLY();

    assert.equal(name, "kol");
    assert.equal(symbol, "KOL");
    assert.equal(decimals, 18);
    // 2^30 * 10^18
    const expectedMaxSupply = (2n ** 30n) * (10n ** 18n);
    assert.equal(maxSupply, expectedMaxSupply);
  });

  it("Should claim block rewards based on elapsed time", async function () {
    const kolToken = await viem.deployContract("KolToken");

    // 前进 10 秒
    await testClient.increaseTime({ seconds: 10 });
    await testClient.mine({ blocks: 1 });

    const minerContract = await viem.getContractAt(
      "KolToken",
      kolToken.address,
      { client: { wallet: minerClient } }
    );

    await minerContract.write.claimBlockReward();

    const minerBalance = await kolToken.read.balanceOf([minerClient.account.address]);
    const totalSupply = await kolToken.read.totalSupply();

    assert.ok(minerBalance > 0n, "Miner should receive rewards");
    assert.equal(minerBalance, totalSupply);
  });

  it("Should support standard ERC20 transfer and allowance", async function () {
    const kolToken = await viem.deployContract("KolToken");

    // 先前进时间并 claim 一些代币
    await testClient.increaseTime({ seconds: 100 });
    await testClient.mine({ blocks: 1 });

    const minerContract = await viem.getContractAt(
      "KolToken",
      kolToken.address,
      { client: { wallet: minerClient } }
    );
    await minerContract.write.claimBlockReward();

    const initialMinerBalance = await kolToken.read.balanceOf([minerClient.account.address]);
    assert.ok(initialMinerBalance > 1000n);

    // 转账 1000 个 wei 到 recipient
    const sendAmount = 1000n;
    await minerContract.write.transfer([recipientClient.account.address, sendAmount]);

    const recipientBalance = await kolToken.read.balanceOf([recipientClient.account.address]);
    const afterMinerBalance = await kolToken.read.balanceOf([minerClient.account.address]);

    assert.equal(recipientBalance, sendAmount);
    assert.equal(afterMinerBalance, initialMinerBalance - sendAmount);
  });
});
