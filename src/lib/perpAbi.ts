/**
 * Minimal ABIs for the perp module.
 *
 * Hand-written rather than generated from the Hardhat artifacts, because
 * `.vercelignore` excludes `contracts/` from the deployed tree, so a build-time
 * import from there would fail on Vercel. The same constraint is why
 * `perpConfig.ts` lives under `src/`.
 *
 * Only the members the UI actually calls are listed. If you add a call, add the
 * entry here too — an omission surfaces as a viem "function not found" error at
 * runtime, not at build time.
 */

export const MOCK_USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const VAULT_ABI = [
  {
    type: "function",
    name: "addLiquidity",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "removeLiquidity",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "sharesOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "reservedAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "availableAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "usdcBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const DEMO_ORACLE_ABI = [
  {
    type: "function",
    name: "setPrice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feedId", type: "bytes32" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "bumpPrice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feedId", type: "bytes32" },
      { name: "deltaBps", type: "int256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [{ name: "feedId", type: "bytes32" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "publishTime", type: "uint256" },
    ],
  },
] as const;

export const POSITION_MANAGER_ABI = [
  {
    type: "function",
    name: "openPosition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feedId", type: "bytes32" },
      { name: "collateralAmount", type: "uint256" },
      { name: "leverageBps", type: "uint256" },
      { name: "isLong", type: "bool" },
      { name: "pythUpdateData", type: "bytes[]" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "closePosition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "pythUpdateData", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionIds", type: "uint256[]" },
      { name: "pythUpdateData", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPosition",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "feedId", type: "bytes32" },
          { name: "collateralUsd", type: "uint256" },
          { name: "sizeUsd", type: "uint256" },
          { name: "payoutCapUsd", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "isLong", type: "bool" },
          { name: "openedAt", type: "uint256" },
          { name: "entryFundingIndex", type: "int256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "positionEquity",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    type: "function",
    name: "fundingOwed",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    type: "function",
    name: "cumulativeFundingIndex",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    type: "function",
    name: "fundingRatePerBlockWad",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    type: "function",
    name: "fundingSkewWad",
    stateMutability: "view",
    inputs: [{ name: "feedId", type: "bytes32" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    type: "function",
    name: "openInterest",
    stateMutability: "view",
    inputs: [{ name: "feedId", type: "bytes32" }],
    outputs: [
      { name: "longUsd", type: "uint256" },
      { name: "shortUsd", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "isOpen",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "nextPositionId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isLiquidatable",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "unrealizedPnl",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    type: "function",
    name: "reservedAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "liquidatorRewardBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxProfitBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maintenanceMarginBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "PositionOpened",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "feedId", type: "bytes32", indexed: true },
      { name: "collateralUsd", type: "uint256", indexed: false },
      { name: "sizeUsd", type: "uint256", indexed: false },
      { name: "entryPrice", type: "uint256", indexed: false },
      { name: "isLong", type: "bool", indexed: false },
    ],
  },
] as const;

/** The shape `getPosition` returns, with the fields added by ADR-002 and ADR-003. */
export interface OnChainPosition {
  owner: `0x${string}`;
  feedId: `0x${string}`;
  collateralUsd: bigint;
  sizeUsd: bigint;
  payoutCapUsd: bigint;
  entryPrice: bigint;
  isLong: boolean;
  openedAt: bigint;
  entryFundingIndex: bigint;
}
