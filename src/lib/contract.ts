import { defineChain } from "viem";

// Monad Testnet Chain Definition
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        "https://testnet-rpc.monad.xyz",
        "https://monad-testnet.drpc.org",
      ],
    },
    public: {
      http: [
        "https://testnet-rpc.monad.xyz",
        "https://monad-testnet.drpc.org",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

// Default contract address (can be overridden via NEXT_PUBLIC_KOLIANCE_ADDRESS in .env.local)
export const KOLIANCE_ADDRESS = (process.env.NEXT_PUBLIC_KOLIANCE_ADDRESS ||
  "0x32fDd6B096EE14246b5b6971135286Bad01F4928") as `0x${string}`;

// KolToken (KOL) deployed on Monad Testnet
export const KOL_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_KOL_TOKEN_ADDRESS ||
  "0x4cadb6f0e1b83ccb7207db4786b2a1500f066328") as `0x${string}`;

export const KOL_TOKEN_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MAX_SUPPLY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimBlockReward",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "reward", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "currentEra",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentRewardRatePerSecond",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BlockClaimed",
    inputs: [
      { name: "miner", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;


// Koliance Contract ABI
export const KOLIANCE_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataHash", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addTrust",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "action", type: "string" },
      { name: "proof", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "identities",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "createdAt", type: "uint256" },
      { name: "metadataHash", type: "string" },
    ],
  },
  {
    type: "function",
    name: "records",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "action", type: "string" },
      { name: "proof", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getRecordsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getAllRecords",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "action", type: "string" },
          { name: "proof", type: "bytes32" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "IdentityRegistered",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "metadataHash", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TrustAdded",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "action", type: "string", indexed: false },
      { name: "proof", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export interface IdentityData {
  exists: boolean;
  createdAt: bigint;
  metadataHash: string;
}

export interface TrustRecordData {
  from: `0x${string}`;
  to: `0x${string}`;
  action: string;
  proof: `0x${string}`;
  timestamp: bigint;
}
