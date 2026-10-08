import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * The frozen surface, pinned.
 *
 * `docs/changes/017` re-froze `IPositionManager` and closed GAP-34, and the
 * interface header now carries the authoritative list. A list in a comment is
 * still a comment: nothing stops the next change from editing a frozen
 * signature, updating the call sites, and leaving the header describing a
 * surface that no longer exists.
 *
 * This file is the mechanism. It reads the compiled ABI and asserts the frozen
 * set is intact, so moving a signature costs a deliberate edit here — which is
 * exactly the friction a freeze is supposed to create. The comment explains
 * *why* the surface is frozen; this makes it *true*.
 *
 * Deliberately NOT covered: anything not on the frozen list. Adding a function
 * is an extension, not a break, and this file should not obstruct it. Only
 * changes to the listed signatures fail.
 */

/** canonical signature -> expected input type list */
const FROZEN_FUNCTIONS: Record<string, string[]> = {
  "openPosition(bytes32,uint256,uint256,bool,bytes[])": ["bytes32", "uint256", "uint256", "bool", "bytes[]"],
  "openPositionFor(address,bytes32,uint256,uint256,bool,bytes[])": [
    "address",
    "bytes32",
    "uint256",
    "uint256",
    "bool",
    "bytes[]",
  ],
  "closePosition(uint256,uint256,uint256,bytes[])": ["uint256", "uint256", "uint256", "bytes[]"],
  "liquidate(uint256[],bytes[])": ["uint256[]", "bytes[]"],
  "setSessionKeyRegistry(address)": ["address"],
  "getPosition(uint256)": ["uint256"],
  "isLiquidatable(uint256)": ["uint256"],
  "nextPositionId()": [],
  "openFeeBps()": [],
  "closeFeeBps()": [],
  "maintenanceMarginBps()": [],
  "liquidatorRewardBps()": [],
  "maxLeverageBps()": [],
  "maxProfitBps()": [],
  "cumulativeFundingIndex(bytes32)": ["bytes32"],
  "fundingRatePerBlockWad()": [],
  "fundingOwed(uint256)": ["uint256"],
  "openInterest(bytes32)": ["bytes32"],
  "reservedAssets()": [],
  "accrueFunding(bytes32)": ["bytes32"],
};

/** event name -> expected non-indexed-and-indexed input type list, in declaration order */
const FROZEN_EVENTS: Record<string, string[]> = {
  PositionOpened: ["uint256", "address", "bytes32", "uint256", "uint256", "uint256", "bool"],
  PositionClosed: ["uint256", "address", "uint256", "int256"],
  PositionLiquidated: ["uint256", "address", "address", "uint256", "uint256"],
  FundingAccrued: ["bytes32", "int256", "uint256", "int256"],
  FundingSettled: ["uint256", "int256"],
};

type AbiItem = {
  type: string;
  name?: string;
  inputs?: { type: string }[];
};

/** Compose the canonical signature so it can be compared as a string. */
function sig(item: AbiItem): string {
  return `${item.name}(${(item.inputs ?? []).map((i) => i.type).join(",")})`;
}

describe("IPositionManager frozen surface (GAP-34 / changes 017)", async function () {
  const { viem } = await network.getOrCreate();

  it("every frozen function is still present with the frozen signature", async function () {
    const { abi } = await viem.getContractAt("PositionManager", "0x0000000000000000000000000000000000000001");

    const functions = new Map<string, AbiItem>();
    for (const item of abi as AbiItem[]) {
      if (item.type === "function") functions.set(sig(item), item);
    }

    const missing: string[] = [];
    const wrongShape: string[] = [];

    for (const [canonical, expectedInputs] of Object.entries(FROZEN_FUNCTIONS)) {
      const found = functions.get(canonical);
      if (!found) {
        // Either removed, or its inputs changed — both are the same breakage
        // from a consumer's point of view, so report which name did survive.
        const name = canonical.slice(0, canonical.indexOf("("));
        const survivors = [...functions.keys()].filter((k) => k.startsWith(`${name}(`));
        missing.push(
          survivors.length
            ? `${canonical} -> now ${survivors.join(" | ")}`
            : `${canonical} -> gone entirely`,
        );
        continue;
      }
      const actual = (found.inputs ?? []).map((i) => i.type);
      if (actual.join(",") !== expectedInputs.join(",")) {
        wrongShape.push(`${canonical}: inputs ${actual.join(",")}`);
      }
    }

    assert.equal(
      missing.length + wrongShape.length,
      0,
      "the frozen interface changed. If that is deliberate, update\n" +
        "  contracts/contracts/perp/interfaces/IPositionManager.sol (the frozen list)\n" +
        "  this file, and every call site in the same commit.\n" +
        [...missing, ...wrongShape].map((m) => `  ${m}`).join("\n"),
    );
  });

  it("every frozen event is still emitted with the frozen inputs", async function () {
    // Events are frozen for the same reason as functions: an off-chain indexer
    // backfills from them, so a changed topic or arity breaks it just as hard.
    const { abi } = await viem.getContractAt("PositionManager", "0x0000000000000000000000000000000000000001");

    const events = new Map<string, AbiItem>();
    for (const item of abi as AbiItem[]) {
      if (item.type === "event" && item.name) events.set(item.name, item);
    }

    const problems: string[] = [];
    for (const [name, expected] of Object.entries(FROZEN_EVENTS)) {
      const found = events.get(name);
      if (!found) {
        problems.push(`${name} -> missing from the ABI`);
        continue;
      }
      const actual = (found.inputs ?? []).map((i) => i.type);
      if (actual.join(",") !== expected.join(",")) {
        problems.push(`${name}: inputs ${actual.join(",")} (frozen: ${expected.join(",")})`);
      }
    }

    assert.equal(problems.length, 0, `frozen events changed:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  });

  it("does not freeze the whole surface — extensions stay allowed", async function () {
    // A guard on the guard. If someone regenerated FROZEN_FUNCTIONS from the ABI
    // wholesale, the freeze would become "whatever the ABI happens to be" and
    // would stop catching anything. The frozen set must stay a strict subset.
    const { abi } = await viem.getContractAt("PositionManager", "0x0000000000000000000000000000000000000001");
    const totalFunctions = (abi as AbiItem[]).filter((i) => i.type === "function").length;

    assert.ok(
      Object.keys(FROZEN_FUNCTIONS).length < totalFunctions,
      `the frozen list has ${Object.keys(FROZEN_FUNCTIONS).length} entries against ${totalFunctions} in the ABI — ` +
        `it looks regenerated rather than curated, which would defeat the freeze`,
    );
  });
});
