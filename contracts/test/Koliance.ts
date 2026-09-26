import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Koliance", async function () {
  const { viem } = await network.getOrCreate();
  const [walletClient, otherWalletClient] = await viem.getWalletClients();

  it("Should register an identity correctly", async function () {
    const koliance = await viem.deployContract("Koliance");
    const metaHash = "ipfs://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx";

    await koliance.write.register([metaHash]);

    const identity = await koliance.read.identities([walletClient.account.address]);
    assert.equal(identity[0], true); // exists
    assert.ok(identity[1] > 0n);     // createdAt
    assert.equal(identity[2], metaHash); // metadataHash
  });

  it("Should add and query trust records", async function () {
    const koliance = await viem.deployContract("Koliance");
    const to = otherWalletClient.account.address;
    const action = "ENDORSE_DEVELOPER";
    const proof = "0x1234567890123456789012345678901234567890123456789012345678901234";

    await koliance.write.addTrust([to, action, proof]);

    const count = await koliance.read.getRecordsCount();
    assert.equal(count, 1n);

    const record = await koliance.read.records([0n]);
    assert.equal(record[0].toLowerCase(), walletClient.account.address.toLowerCase());
    assert.equal(record[1].toLowerCase(), to.toLowerCase());
    assert.equal(record[2], action);
    assert.equal(record[3], proof);
  });
});
