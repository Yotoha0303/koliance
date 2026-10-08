import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
// The hardhat-viem helper exposes clients and deployment, not the standalone
// hashing functions, so the digest helper is imported from viem itself.
import { hashTypedData } from "viem";

/**
 * SessionKeyRegistry — EIP-712 delegation, on chain.
 *
 * This is ADR-004's "connection" between the two threads: the perp gives an
 * agent something worth doing, and this gives it permission to do it. The
 * design claim being tested is narrow and checkable — *the user signs once and
 * a bounded authority exists that anyone can verify* — and the tests below are
 * split by whether they defend that claim or try to break it.
 *
 * The falsification cases are the point of the file. Each one is a way a
 * delegation system is commonly wrong, and each must fail loudly:
 *
 *   - a relayer edits a field after the user signed  -> signature must not recover
 *   - the same signed payload is submitted twice     -> nonce must refuse it
 *   - revocation is undone by replaying the original -> nonce must still refuse
 *   - a spend slips past per-tx but blows the daily  -> the second call must refuse
 *   - the daily window never rolls over              -> GAP-21, the RFC's own bug
 *
 * The window case is worth naming: the RFC's Redis script kept `daily_spent` as
 * a counter with no reset, so a user who hit their cap once was capped forever
 * (GAP-21). The assertion that the window *rolls* is therefore a regression test
 * against a defect already observed in the design this contract replaces.
 *
 * The interop test is the other half. GAP-24 records three mutually
 * incompatible Session Key models in this repository, with nothing checking
 * that any two agree. `viem` signs the same typed structure off chain, and the
 * digest is compared against the contract's own before anything is submitted —
 * so a mismatch fails as a digest comparison, not as a mystifying revert.
 */

const E6 = 10n ** 6n;
const usdc = (n: bigint | number) => BigInt(n) * E6;

/** secp256k1 group order, for constructing a deliberately malleable signature. */
const SECP256K1N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

describe("SessionKeyRegistry (EIP-712 delegation)", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, user, agent, outsider] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  const ONE_DAY = 86_400n;
  const MAX_PER_TX = usdc(100);
  const DAILY_LIMIT = usdc(250);

  /** The typed structure, in viem's shape. Must mirror the contract constant. */
  const DOMAIN = () =>
    ({
      name: "Koliance",
      version: "1",
      chainId,
      verifyingContract: registry.address as `0x${string}`,
    }) as const;

  const TYPES = {
    AgentDelegation: [
      { name: "user", type: "address" },
      { name: "agent", type: "address" },
      { name: "sessionKey", type: "address" },
      { name: "maxSpendPerTx", type: "uint256" },
      { name: "dailySpendLimit", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  } as const;

  let registry: Awaited<ReturnType<typeof viem.deployContract<"SessionKeyRegistry">>>;
  let sessionKey: `0x${string}`;
  let nonce: bigint;

  /** Deploy fresh and hand out a fresh ephemeral session key + nonce. */
  async function reset() {
    registry = await viem.deployContract("SessionKeyRegistry");
    // An ephemeral key is just an address; the registry never needs its private
    // key because the *user* is the one who signs, and the key only ever
    // identifies which delegation is being spent against.
    sessionKey = agent.account.address;
    nonce = 1n;
  }

  async function validUntil() {
    const block = await publicClient.getBlock();
    return block.timestamp + ONE_DAY * 7n;
  }

  /** Sign a delegation with the given wallet, at the given terms. */
  async function sign(signer: (typeof user)["account"], overrides: Partial<Record<string, unknown>> = {}) {
    const message = {
      user: user.account.address,
      agent: agent.account.address,
      sessionKey,
      maxSpendPerTx: MAX_PER_TX,
      dailySpendLimit: DAILY_LIMIT,
      validUntil: await validUntil(),
      nonce,
      ...overrides,
    };
    const signature = await user.signTypedData({
      account: signer,
      domain: DOMAIN(),
      types: TYPES,
      primaryType: "AgentDelegation",
      message: message as never,
    });
    return { message, signature };
  }

  /** Register with a freshly signed delegation at the given terms. */
  async function register(overrides: Partial<Record<string, unknown>> = {}) {
    const { message, signature } = await sign(user.account, overrides);
    await registry.write.registerDelegation(
      [
        message.user as `0x${string}`,
        message.agent as `0x${string}`,
        message.sessionKey as `0x${string}`,
        message.maxSpendPerTx as bigint,
        message.dailySpendLimit as bigint,
        message.validUntil as bigint,
        message.nonce as bigint,
        signature,
      ],
      { account: user.account },
    );
    return message;
  }

  /**
   * Assert a call reverts with a named custom error.
   *
   * viem buries the error name differently depending on where in the stack it
   * was decoded, so this digs through the usual places rather than trusting one.
   * A test that silently passes because it matched the wrong string would be
   * exactly the false green this file exists to prevent.
   */
  async function expectRevert(promise: Promise<unknown>, errorName: string) {
    try {
      await promise;
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const cause = (e.cause ?? {}) as Record<string, unknown>;
      const data = (cause.data ?? e.data ?? {}) as Record<string, unknown>;
      const haystack = [
        String(e.message ?? ""),
        String(cause.message ?? ""),
        String(cause.reason ?? ""),
        String(data.errorName ?? ""),
        String(data.reason ?? ""),
        JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
      ].join(" ");
      assert.ok(
        haystack.includes(errorName),
        `expected revert with ${errorName}, got: ${haystack.slice(0, 400)}`,
      );
      return;
    }
    assert.fail(`expected revert with ${errorName}, but the call succeeded`);
  }

  await reset();

  // ==================== IN THE CLEAR: the claim holds ====================

  it("registers a delegation the user signed, and records the terms", async function () {
    const m = await register();

    const d = await registry.read.getDelegation([sessionKey]);

    assert.equal(d.user.toLowerCase(), user.account.address.toLowerCase());
    assert.equal(d.agent.toLowerCase(), agent.account.address.toLowerCase());
    assert.equal(d.maxSpendPerTx, MAX_PER_TX);
    assert.equal(d.dailySpendLimit, DAILY_LIMIT);
    assert.equal(d.validUntil, m.validUntil);
    assert.equal(d.exists, true);
    assert.equal(d.revoked, false);
    assert.equal(d.frozen, false);
  });

  it("burns the nonce, so the same grant cannot be submitted again", async function () {
    assert.equal(await registry.read.nonceUsed([user.account.address, nonce]), true);
  });

  it("lets the agent spend within both caps, and accumulates the window", async function () {
    const half = MAX_PER_TX; // 100, under the per-tx cap

    assert.equal(await registry.read.isAuthorized([sessionKey, half]), true);

    await registry.write.authorizeSpend([sessionKey, half], { account: agent.account });
    await registry.write.authorizeSpend([sessionKey, half], { account: agent.account });

    const d = await registry.read.getDelegation([sessionKey]);
    assert.equal(d.spentInWindow, half * 2n);
    assert.equal(await registry.read.remainingDailyAllowance([sessionKey]), DAILY_LIMIT - half * 2n);
  });

  it("reports the exact digest viem signs — the two models agree (GAP-24)", async function () {
    // A second, unrelated delegation so the assertion does not depend on the
    // state the earlier tests left behind.
    nonce = 99n;
    const { message } = await sign(user.account);

    const onChain = await registry.read.delegationDigest([
      message.user as `0x${string}`,
      message.agent as `0x${string}`,
      message.sessionKey as `0x${string}`,
      message.maxSpendPerTx as bigint,
      message.dailySpendLimit as bigint,
      message.validUntil as bigint,
      message.nonce as bigint,
    ]);

    const offChain = await hashTypedData({
      domain: DOMAIN(),
      types: TYPES,
      primaryType: "AgentDelegation",
      message: message as never,
    });

    assert.equal(onChain, offChain, "off-chain signer and on-chain verifier disagree on the digest");
  });

  it("rolls the daily window forward after 24h (GAP-21 regression)", async function () {
    nonce = 100n;
    await reset();
    await register();

    const spend = MAX_PER_TX;
    await registry.write.authorizeSpend([sessionKey, spend], { account: agent.account });
    await registry.write.authorizeSpend([sessionKey, spend], { account: agent.account });

    // Two spends of 100 against a 250 cap: 50 left.
    assert.equal(await registry.read.remainingDailyAllowance([sessionKey]), usdc(50));
    assert.equal(await registry.read.isAuthorized([sessionKey, spend]), false);

    // Past the window. In the RFC's version this changed nothing and the user
    // stayed capped forever.
    await publicClient.request({ method: "evm_increaseTime", params: [Number(ONE_DAY) + 1] } as never);
    await publicClient.request({ method: "evm_mine" } as never);

    assert.equal(
      await registry.read.remainingDailyAllowance([sessionKey]),
      DAILY_LIMIT,
      "allowance did not reset after the window closed",
    );
    assert.equal(await registry.read.isAuthorized([sessionKey, spend]), true);

    await registry.write.authorizeSpend([sessionKey, spend], { account: agent.account });
    const d = await registry.read.getDelegation([sessionKey]);
    assert.equal(d.spentInWindow, spend, "window did not restart from zero");
  });

  it("revokes, and the revocation sticks", async function () {
    nonce = 200n;
    await reset();
    await register();

    assert.equal(await registry.read.isAuthorized([sessionKey, MAX_PER_TX]), true);

    await registry.write.revoke([sessionKey], { account: user.account });
    assert.equal(await registry.read.isAuthorized([sessionKey, MAX_PER_TX]), false);

    await expectRevert(
      registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account }),
      "DelegationIsRevoked",
    );

    // Replaying the original signature must not resurrect it.
    const { message, signature } = await sign(user.account);
    await expectRevert(
      registry.write.registerDelegation(
        [
          message.user as `0x${string}`,
          message.agent as `0x${string}`,
          message.sessionKey as `0x${string}`,
          message.maxSpendPerTx as bigint,
          message.dailySpendLimit as bigint,
          message.validUntil as bigint,
          message.nonce as bigint,
          signature,
        ],
        { account: user.account },
      ),
      "NonceAlreadyUsed",
    );
  });

  it("freezes on the owner's word too — a circuit breaker that does not need the user", async function () {
    nonce = 300n;
    await reset();
    await register();

    await registry.write.freeze([sessionKey], { account: deployer.account });
    await expectRevert(
      registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account }),
      "DelegationIsFrozen",
    );

    await registry.write.unfreeze([sessionKey], { account: user.account });
    await registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account });
  });

  // ==================== FALSIFICATION: the guards must bite ====================

  it("refuses a field edited after signing — a relayer cannot escalate a cap", async function () {
    nonce = 400n;
    await reset();

    // The user consents to 100. The submitter tries to pass 1,000,000.
    const { message, signature } = await sign(user.account);

    await expectRevert(
      registry.write.registerDelegation(
        [
          message.user as `0x${string}`,
          message.agent as `0x${string}`,
          message.sessionKey as `0x${string}`,
          usdc(1_000_000), // <- inflated
          message.dailySpendLimit as bigint,
          message.validUntil as bigint,
          message.nonce as bigint,
          signature,
        ],
        { account: outsider.account },
      ),
      "InvalidSignature",
    );
  });

  it("refuses a signature from anyone but the user", async function () {
    nonce = 401n;
    await reset();

    const { message, signature } = await sign(outsider.account);

    await expectRevert(
      registry.write.registerDelegation(
        [
          message.user as `0x${string}`,
          message.agent as `0x${string}`,
          message.sessionKey as `0x${string}`,
          message.maxSpendPerTx as bigint,
          message.dailySpendLimit as bigint,
          message.validUntil as bigint,
          message.nonce as bigint,
          signature,
        ],
        { account: outsider.account },
      ),
      "InvalidSignature",
    );
  });

  it("refuses a malleable signature — one consent must not have two encodings", async function () {
    nonce = 402n;
    await reset();

    const { message, signature } = await sign(user.account);

    // Flip s -> n - s and v -> v ^ 1. Both recover the same signer on a naive
    // ecrecover, which is why high-s is rejected.
    const r = signature.slice(0, 66);
    const s = BigInt("0x" + signature.slice(66, 130));
    const v = Number("0x" + signature.slice(130, 132));
    const flipped = (SECP256K1N - s).toString(16).padStart(64, "0");
    const flippedV = (v === 27 ? 28 : 27).toString(16).padStart(2, "0");
    const malleable = (r + flipped + flippedV) as `0x${string}`;

    await expectRevert(
      registry.write.registerDelegation(
        [
          message.user as `0x${string}`,
          message.agent as `0x${string}`,
          message.sessionKey as `0x${string}`,
          message.maxSpendPerTx as bigint,
          message.dailySpendLimit as bigint,
          message.validUntil as bigint,
          message.nonce as bigint,
          malleable,
        ],
        { account: outsider.account },
      ),
      "SignatureMalleable",
    );
  });

  it("refuses a per-transaction spend over the cap", async function () {
    nonce = 403n;
    await reset();
    await register();

    await expectRevert(
      registry.write.authorizeSpend([sessionKey, MAX_PER_TX + 1n], { account: agent.account }),
      "ExceededPerTxLimit",
    );
  });

  it("refuses a spend that fits per-tx but breaks the day", async function () {
    nonce = 404n;
    await reset();
    await register();

    // 100 + 100 + 100 = 300 against a 250 cap. Each call is legal alone; the
    // third must be refused, and nothing may have been consumed by the attempt.
    await registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account });
    await registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account });
    await expectRevert(
      registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account }),
      "ExceededDailyLimit",
    );

    const d = await registry.read.getDelegation([sessionKey]);
    assert.equal(d.spentInWindow, usdc(200), "a refused spend must not consume allowance");
  });

  it("refuses a delegation that is already expired at registration", async function () {
    nonce = 405n;
    await reset();

    const block = await publicClient.getBlock();
    await expectRevert(register({ validUntil: block.timestamp - 1n }), "ValidityInThePast");
  });

  it("refuses a spend after expiry", async function () {
    nonce = 406n;
    await reset();
    await register();
    await registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account });

    await publicClient.request({ method: "evm_increaseTime", params: [Number(ONE_DAY) * 8] } as never);
    await publicClient.request({ method: "evm_mine" } as never);

    await expectRevert(
      registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: agent.account }),
      "DelegationExpired",
    );
  });

  it("refuses a passer-by burning the user's daily window", async function () {
    nonce = 407n;
    await reset();
    await register();

    await expectRevert(
      registry.write.authorizeSpend([sessionKey, MAX_PER_TX], { account: outsider.account }),
      "NotAuthorizedCaller",
    );
  });

  it("refuses a delegation to oneself", async function () {
    nonce = 408n;
    await reset();
    await expectRevert(register({ agent: user.account.address }), "SelfDelegation");
  });

  it("refuses rebinding a live session key to a different user", async function () {
    nonce = 409n;
    await reset();
    await register();

    // A second user signs over the SAME session key address. The signature is
    // valid for them, but the key is already spoken for.
    const second = await viem.deployContract("SessionKeyRegistry");
    const { message: m2, signature: s2 } = await (async () => {
      const message = {
        user: outsider.account.address,
        agent: agent.account.address,
        sessionKey, // same key
        maxSpendPerTx: MAX_PER_TX,
        dailySpendLimit: DAILY_LIMIT,
        validUntil: await validUntil(),
        nonce: 1n,
      };
      const signature = await outsider.signTypedData({
        account: outsider.account,
        domain: {
          name: "Koliance",
          version: "1",
          chainId,
          verifyingContract: second.address as `0x${string}`,
        },
        types: TYPES,
        primaryType: "AgentDelegation",
        message: message as never,
      });
      return { message, signature };
    })();

    await second.write.registerDelegation(
      [
        m2.user as `0x${string}`,
        m2.agent as `0x${string}`,
        m2.sessionKey as `0x${string}`,
        m2.maxSpendPerTx as bigint,
        m2.dailySpendLimit as bigint,
        m2.validUntil as bigint,
        m2.nonce as bigint,
        s2,
      ],
      { account: outsider.account },
    );

    // Now try to take the same session key on the ORIGINAL registry, which
    // already has it bound to `user`.
    const { message, signature } = (await (async () => {
      const message = {
        user: outsider.account.address,
        agent: agent.account.address,
        sessionKey,
        maxSpendPerTx: MAX_PER_TX,
        dailySpendLimit: DAILY_LIMIT,
        validUntil: await validUntil(),
        nonce: 2n,
      };
      const signature = await outsider.signTypedData({
        account: outsider.account,
        domain: DOMAIN(),
        types: TYPES,
        primaryType: "AgentDelegation",
        message: message as never,
      });
      return { message, signature };
    })()) as { message: Record<string, unknown>; signature: `0x${string}` };

    await expectRevert(
      registry.write.registerDelegation(
        [
          message.user as `0x${string}`,
          message.agent as `0x${string}`,
          message.sessionKey as `0x${string}`,
          message.maxSpendPerTx as bigint,
          message.dailySpendLimit as bigint,
          message.validUntil as bigint,
          message.nonce as bigint,
          signature,
        ],
        { account: outsider.account },
      ),
      "SessionKeyAlreadyBound",
    );
  });

  it("refuses a zero-amount spend, so a no-op cannot roll the window", async function () {
    nonce = 410n;
    await reset();
    await register();
    await expectRevert(
      registry.write.authorizeSpend([sessionKey, 0n], { account: agent.account }),
      "ZeroAmount",
    );
  });

  it("refuses to act on a session key that was never registered", async function () {
    await reset();
    await expectRevert(
      registry.write.authorizeSpend([outsider.account.address, MAX_PER_TX], { account: agent.account }),
      "NoSuchDelegation",
    );
  });
});
