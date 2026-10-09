import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys SessionKeyRegistry — the on-chain anchor for agent delegations.
 *
 * Standalone, and deliberately so. It holds no funds and depends on no other
 * contract: it records who authorised which agent's session key to do how much,
 * and answers whether a spend is still inside that grant. The Vault holds the
 * money; this holds the permission. Keeping the two apart is what lets a
 * compromised session key be revoked without touching the treasury.
 *
 * It is separate from PerpStack rather than bundled into it because the two
 * have different lifetimes: the registry is per-environment and long-lived,
 * while the stack gets redeployed as the contracts change.
 *
 *   npx hardhat ignition deploy ignition/modules/SessionKeyRegistry.ts --network monadTestnet
 *
 * After deploying, put the address in `NEXT_PUBLIC_SESSION_KEY_REGISTRY` and in
 * the backend config, so the off-chain side verifies against the same instance
 * the chain has. A registry address that drifts between the two is exactly the
 * three-models problem GAP-24 records.
 */
export default buildModule("SessionKeyRegistryModule", (m) => {
  const sessionKeyRegistry = m.contract("SessionKeyRegistry");

  return { sessionKeyRegistry };
});
