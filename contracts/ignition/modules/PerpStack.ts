import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys and wires the whole perp stack, in the order the contracts require.
 *
 *   npx hardhat ignition deploy ignition/modules/PerpStack.ts --network monadTestnet
 *
 * Wiring constraints that dictate the order below:
 *
 *   1. Vault and PositionManager reference each other, so neither can take the
 *      other as a constructor argument. Both get deployed with a placeholder and
 *      the link is made afterwards via `setPositionManager`, which is one-shot.
 *   2. That call is owner-only, so whatever account deploys must still own the
 *      Vault at wiring time. A later `transferOwnership` would break it.
 *   3. PositionManager needs the Vault's address at construction, so the Vault
 *      has to exist first.
 *
 * DemoOracle is deployed as the price source. Swap in a PythOracleAdapter by
 * changing the `oracle` argument handed to PositionManager — nothing else moves,
 * which is the point of the IPriceOracle abstraction.
 */
export default buildModule("PerpStackModule", (m) => {
  const collateral = m.contract("MockUSDC");
  const oracle = m.contract("DemoOracle");

  const vault = m.contract("Vault", [collateral, m.getAccount(0)]);

  const positionManager = m.contract("PositionManager", [
    vault,
    oracle,
    collateral,
    m.getAccount(0),
  ]);

  // One-shot, owner-only. Must happen before any position can open, since
  // PositionManager settles fees and payouts through the Vault.
  m.call(vault, "setPositionManager", [positionManager]);

  return { collateral, oracle, vault, positionManager };
});
