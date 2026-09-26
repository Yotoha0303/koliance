import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { keccak256, stringToBytes } from "viem";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address) return "";
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function generateProof(text: string): `0x${string}` {
  return keccak256(stringToBytes(text || Date.now().toString()));
}

export function formatTimestamp(timestamp: bigint | number): string {
  if (!timestamp) return "Just now";
  const ms = Number(timestamp) * 1000;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}
