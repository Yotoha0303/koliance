# Sample Hardhat3 Project (`node:test` and `viem`)

This project showcases a Hardhat3 project using the native Node.js test runner (`node:test`) and the `viem` library for Monad Testnet interactions.

To learn more about Hardhat3, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). For support, see Hardhat's current [Getting help guide](https://hardhat.org/docs/guides/getting-help), or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) to report a bug.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using [`node:test`](https://nodejs.org/api/test.html), the Node.js native test runner, and [`viem`](https://viem.sh/).
- Monad Testnet and Mainnet network configuration.

## Setup

Install the dependencies:

```shell
npm install
```

Local compilation and tests do not require a private key. Before deploying to Testnet or Mainnet, set the `PRIVATE_KEY` configuration variable. Before verifying a contract, also set `ETHERSCAN_API_KEY`.

Store the variables in the Hardhat keystore:

```shell
npx hardhat keystore set PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY
```

Alternatively, copy `.env.example` to `.env` and fill in the values. The configuration loads this file through `dotenv`.

```shell
cp .env.example .env
```

Never commit `.env` or expose a funded account's private key.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `node:test` tests:

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### Deployment

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain, Monad Testnet, or Monad Mainnet.

#### Deploy to Local Chain

Local deployment does not require configuration variables:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

#### Deploy to Monad Testnet

Set `PRIVATE_KEY` to a funded Testnet account as described in [Setup](#setup), then deploy:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts --network monadTestnet
```

Set `ETHERSCAN_API_KEY`, then verify the deployed contract:

```shell
npx hardhat verify <CONTRACT_ADDRESS> --network monadTestnet
```

#### Deploy to Monad Mainnet

Set `PRIVATE_KEY` to a funded Mainnet account, then deploy:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts --network monadMainnet
```

Set `ETHERSCAN_API_KEY`, then verify the deployed contract:

```shell
npx hardhat verify <CONTRACT_ADDRESS> --network monadMainnet
```
