import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { hashTypedData } from "viem";

/**
 * The last mile: an agent opens a position on chain under a session key.
 *
 * `SessionKeyRegistry` alone proves a user can grant a bounded authority.
 * `PositionManager` alone proves anyone can open a position. Neither is the
 * thing ADR-004 describes — the connection is that the *agent*, holding a key
 * the user signed for, is the one who opens it, and the trader never touches a
 * wallet after the initial signature.
 *
 * That is what these tests exercise end to end, and the assertions split the
 * same way the other suites do: the happy path proves the claim, the
 * falsification cases prove the guard rails are load-bearing rather than
 * decorative.
 *
 * The one that matters most is the daily cap being *charged*. A delegation
 * that is checked but never consumed is not a cap at all — it is a suggestion,
 * and an agent could open one position per block forever. The third open in the
 * cap test is the assertion that this cannot happen.
 *
 * Two roles are asserted separately on purpose. The position's owner is the
 * delegating user; the payer is the agent. Collapsing them would mean an agent
 * that owns positions, which cannot be revoked into a clean state, and a payer
 * that is the user, which is not autonomous execution.
 */

const E6 = 10n ** 6n;
const E18 = 10n ** 18n;
const usdc = (n: bigint | number) => BigInt(n) * E6;
const usd = (n: bigint | number) => BigInt(n) * E18;

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const PRICE_180 = usd(180);

const ONE_DAY = 86_400n;
const COLLATERAL = usdc(1_000);
const LEVERAGE = 100_000n; // 10x

describe("Agent opens a position under a session key (ADR-004 connection)", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, lp, user, agent, outsider] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  const AGENT_ID = 1n;
  const PER_TX = usdc(2_000);
  const DAILY = usdc(3_000);

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

  /** Full stack, wired the way production will be — registry included. */
  async function setup(opts: { wireRegistry?: boolean } = {}) {
    const { wireRegistry = true } = opts;

    const token = await viem.deployContract("MockUSDC");
    const oracle = await viem.deployContract("DemoOracle");
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      oracle.address,
      token.address,
      deployer.account.address,
    ]);
    const registry = await viem.deployContract("SessionKeyRegistry");

    await vault.write.setPositionManager([pm.address]);
    await oracle.write.setPrice([NVDA, PRICE_180]);

    if (wireRegistry) {
      await pm.write.setSessionKeyRegistry([registry.address]);
      // The manager is a contract, so it cannot be the agent; the registry
      // owner names it as the *charging module* instead.
      await registry.write.setSpendConsumer([pm.address]);
    }

    // LP side of the book.
    await token.write.mint([lp.account.address, usdc(100_000)]);
    await token.write.approve([vault.address, usdc(100_000)], { account: lp.account });
    await vault.write.addLiquidity([usdc(100_000)], { account: lp.account });

    // The AGENT holds the money — that is what "autonomous execution" means
    // on chain. The user's own balance stays untouched throughout.
    await token.write.mint([agent.account.address, usdc(10_000)]);
    await token.write.approve([pm.address, usdc(10_000)], { account: agent.account });

    return { token, oracle, vault, pm, registry };
  }

  /**
   * The user signs one delegation. This is the ONLY thing the user does — every
   * later step is the agent's.
   */
  async function delegate(
    ctx: Awaited<ReturnType<typeof setup>>,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    const block = await publicClient.getBlock();
    const message = {
      user: user.account.address,
      agent: agent.account.address,
      sessionKey: agent.account.address, // ephemeral key held by the agent
      maxSpendPerTx: PER_TX,
      dailySpendLimit: DAILY,
      validUntil: block.timestamp + ONE_DAY * 7n,
      nonce: AGENT_ID,
      ...overrides,
    };

    const signature = await user.signTypedData({
      account: user.account,
      domain: {
        name: "Koliance",
        version: "1",
        chainId,
        verifyingContract: ctx.registry.address as `0x${string}`,
      },
      types: TYPES,
      primaryType: "AgentDelegation",
      message: message as never,
    });

    // The AGENT submits the grant and pays the gas. It cannot alter a field —
    // any edit changes the digest and the recovery fails.
    await ctx.registry.write.registerDelegation(
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
      { account: agent.account },
    );

    return message;
  }

  /** The agent opens a position. No user signature anywhere in this call. */
  async function agentOpen(
    ctx: Awaited<ReturnType<typeof setup>>,
    opts: { collateral?: bigint; leverageBps?: bigint; isLong?: boolean } = {},
  ) {
    const { collateral = COLLATERAL, leverageBps = LEVERAGE, isLong = true } = opts;
    return ctx.pm.write.openPositionFor(
      [agent.account.address, NVDA, collateral, leverageBps, isLong, []],
      { account: agent.account },
    );
  }

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

  // ==================== THE CONNECTION, END TO END ====================

  it("an agent opens a position the user never signed for — the user touches nothing", async function () {
    const ctx = await setup();
    await delegate(ctx);

    const userBefore = await ctx.token.read.balanceOf([user.account.address]);
    const agentBefore = await ctx.token.read.balanceOf([agent.account.address]);

    await agentOpen(ctx);

    const p = await ctx.pm.read.getPosition([1n]);

    // The position belongs to the USER. An agent that owned positions could
    // not be revoked into a clean state.
    assert.equal(p.owner.toLowerCase(), user.account.address.toLowerCase());

    // The AGENT paid. That is what makes this autonomous rather than a wallet
    // popup with extra steps.
    const userAfter = await ctx.token.read.balanceOf([user.account.address]);
    const agentAfter = await ctx.token.read.balanceOf([agent.account.address]);
    assert.equal(userAfter, userBefore, "the user's balance must not move");
    assert.equal(agentBefore - agentAfter, COLLATERAL, "the agent must have paid the margin");

    assert.equal(p.collateralUsd, usd(999)); // 1000 less the 0.1% open fee
    assert.equal(await ctx.pm.read.isOpen([1n]), true);
  });

  it("charges the delegation — a checked-but-unconsumed cap is not a cap", async function () {
    const ctx = await setup();
    await delegate(ctx);

    await agentOpen(ctx);

    const d = await ctx.registry.read.getDelegation([agent.account.address]);
    assert.equal(d.spentInWindow, COLLATERAL, "the open must consume allowance");
    assert.equal(await ctx.registry.read.remainingDailyAllowance([agent.account.address]), DAILY - COLLATERAL);
  });

  it("the user can close a position an agent opened", async function () {
    const ctx = await setup();
    await delegate(ctx);
    await agentOpen(ctx);

    // Not the agent — the owner. Ownership is what confers the exit.
    await ctx.pm.write.closePosition([1n, 0n, 0n, []], { account: user.account });

    assert.equal(await ctx.pm.read.isOpen([1n]), false);
  });

  // ==================== FALSIFICATION ====================

  it("refuses a second open once the day's allowance is gone", async function () {
    const ctx = await setup();
    await delegate(ctx);

    // 1,000 + 1,000 fits the 3,000 day; the third would be 3,000 exactly, which
    // is allowed, so the fourth is what must fail. Use 1,000 each time and cap
    // the day at 3,000 by hand.
    await delegate(ctx, { dailySpendLimit: usdc(2_000), nonce: 7n });

    await agentOpen(ctx); // 1,000
    await agentOpen(ctx); // 2,000

    await expectRevert(agentOpen(ctx), "SessionKeyNotAuthorized");

    const d = await ctx.registry.read.getDelegation([agent.account.address]);
    assert.equal(d.spentInWindow, usdc(2_000), "a refused open must not consume allowance");
  });

  it("refuses an open that exceeds the per-transaction cap", async function () {
    const ctx = await setup();
    await delegate(ctx, { maxSpendPerTx: usdc(500) });

    await expectRevert(agentOpen(ctx), "SessionKeyNotAuthorized");
  });

  it("refuses a caller who is not the delegated agent", async function () {
    const ctx = await setup();
    await delegate(ctx);

    // `outsider` holds nothing and is named nowhere. It must not be able to
    // spend the user's allowance.
    await expectRevert(
      ctx.pm.write.openPositionFor(
        [agent.account.address, NVDA, COLLATERAL, LEVERAGE, true, []],
        { account: outsider.account },
      ),
      "NotDelegatedAgent",
    );
  });

  it("refuses after the delegation is revoked", async function () {
    const ctx = await setup();
    await delegate(ctx);

    await ctx.registry.write.revoke([agent.account.address], { account: user.account });
    await expectRevert(agentOpen(ctx), "SessionKeyNotAuthorized");
  });

  it("refuses after the delegation expires", async function () {
    const ctx = await setup();
    await delegate(ctx);
    await agentOpen(ctx);

    await publicClient.request({ method: "evm_increaseTime", params: [Number(ONE_DAY) * 8] } as never);
    await publicClient.request({ method: "evm_mine" } as never);

    await expectRevert(agentOpen(ctx), "SessionKeyNotAuthorized");
  });

  it("refuses when the manager has no registry wired — agents off by default", async function () {
    const ctx = await setup({ wireRegistry: false });
    await delegate(ctx);

    // The registry exists and the delegation is valid, but the manager was
    // never pointed at it. Failing closed is the point: a manager that guessed
    // a registry address would be a manager whose delegation rules nobody
    // chose.
    await expectRevert(agentOpen(ctx), "SessionKeyRegistryUnset");
  });

  it("refuses an unregistered session key", async function () {
    const ctx = await setup();
    // No `delegate` call at all.
    await expectRevert(agentOpen(ctx), "SessionKeyNotAuthorized");
  });

  it("the plain path is untouched — a trader still opens for themselves", async function () {
    const ctx = await setup();
    await delegate(ctx);

    await ctx.token.write.mint([user.account.address, usdc(5_000)]);
    await ctx.token.write.approve([ctx.pm.address, usdc(5_000)], { account: user.account });

    await ctx.pm.write.openPosition([NVDA, COLLATERAL, LEVERAGE, true, []], { account: user.account });

    const p = await ctx.pm.read.getPosition([1n]);
    assert.equal(p.owner.toLowerCase(), user.account.address.toLowerCase());

    // The registry must not have been consulted, so the agent's allowance is
    // untouched by a self-serve open.
    const d = await ctx.registry.read.getDelegation([agent.account.address]);
    assert.equal(d.spentInWindow, 0n);
  });
});
