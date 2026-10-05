import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys MockUSDC — the test-only collateral token for the perp demo.
 *
 * Deploying this instead of waiting on a Monad testnet USDC faucet keeps the
 * demo off external dependencies: whoever runs it controls the collateral.
 *
 *   npx hardhat ignition deploy ignition/modules/MockUSDC.ts --network monadTestnet
 */
export default buildModule("MockUSDCModule", (m) => {
  const mockUsdc = m.contract("MockUSDC");

  return { mockUsdc };
});
