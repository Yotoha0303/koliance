import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys DemoOracle — the deterministic price source for the liquidation demo.
 *
 *   npx hardhat ignition deploy ignition/modules/DemoOracle.ts --network monadTestnet
 *
 * Prices are not seeded here: the frontend's demo control panel sets them, so the
 * deployed contract starts empty and `getPrice` reverts until something is set.
 */
export default buildModule("DemoOracleModule", (m) => {
  const demoOracle = m.contract("DemoOracle");

  return { demoOracle };
});
