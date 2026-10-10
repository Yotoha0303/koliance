import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Same stack as PerpStack, but priced by Pyth instead of DemoOracle.
 *
 *   npx hardhat ignition deploy ignition/modules/PerpStackPyth.ts --network monadTestnet
 *
 * Two things differ from PerpStack and both matter:
 *
 *   1. PythOracleAdapter is wired as the PositionManager's `priceUpdater`, so
 *      signed updates get pushed before each price read. PerpStack leaves that
 *      zero because DemoOracle needs nothing.
 *   2. The adapter pays Pyth's update fee from its own MON balance, so it needs
 *      funding after deployment. Ignition cannot send arbitrary value to a
 *      contract, so this is a manual step the deploy notes call out.
 *
 * CAUTION on feed choice. Pyth's off-chain metadata lists feeds that are not
 * deployed to every chain. On Monad Testnet the 24/7 `Equity.Index.*` feeds are
 * absent and the `Equity.US.*` variants are months stale — only the crypto feeds
 * are usable today. Verify with `priceFeedExists` before pointing this at a new
 * feed; the addresses below are the Monad Testnet deployment.
 */

/** Pyth on Monad Testnet. */
const PYTH_MONAD_TESTNET = "0x2880aB155794e7179c9eE2e38200202908C17B43";

export default buildModule("PerpStackPythModule", (m) => {
  const pythAddress = m.getParameter("pythAddress", PYTH_MONAD_TESTNET);
  // 60s matches Pyth's own getValidTimePeriod() on this deployment. The adapter
  // rejects anything shorter at construction.
  const maxStaleness = m.getParameter("maxStaleness", 60n);

  const collateral = m.contract("MockUSDC");

  const oracle = m.contract("PythOracleAdapter", [
    pythAddress,
    maxStaleness,
    m.getAccount(0),
  ]);

  const vault = m.contract("Vault", [collateral, m.getAccount(0)]);

  const positionManager = m.contract("PositionManager", [
    vault,
    oracle,
    collateral,
    m.getAccount(0),
  ]);

  m.call(vault, "setPositionManager", [positionManager]);
  // Unlike PerpStack, the adapter has to be registered so updates are pushed.
  m.call(positionManager, "setPriceUpdater", [oracle]);
  // The adapter only accepts pushes from its owner and allow-listed updaters
  // (it pays the Pyth fee from its own balance), so authorise the manager.
  m.call(oracle, "setUpdater", [positionManager, true]);

  return { collateral, oracle, vault, positionManager };
});
