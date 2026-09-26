import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.31",
    settings: {
      evmVersion: "osaka",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    monadTestnet: {
      type: "http",
      url: "https://testnet-rpc.monad.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [configVariable("PRIVATE_KEY")],
      chainId: 10143,
    },
    monadMainnet: {
      type: "http",
      url: "https://rpc.monad.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [configVariable("PRIVATE_KEY")],
      chainId: 143,
    },
  },
  verify: {
    blockscout: {
      enabled: false,
    },
    etherscan: {
      enabled: true,
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
    sourcify: {
      enabled: true,
      apiUrl: "https://sourcify-api-monad.blockvision.org",
    },
  },
  chainDescriptors: {
    143: {
      name: "MonadMainnet",
      blockExplorers: {
        etherscan: {
          name: "Monadscan",
          url: "https://monadscan.com",
          apiUrl: "https://api.etherscan.io/v2/api",
        },
      },
    },
  },
});
