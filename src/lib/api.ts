// Koliance API Bridge: Connects to future Go backend service (or falls back to direct RPC)

const GO_BACKEND_URL = process.env.NEXT_PUBLIC_GO_BACKEND_URL || "";

export interface StatsResponse {
  chainId: number;
  networkName: string;
  totalIdentities: number;
  totalTrusts: number;
  liveTps: number;
  status: string;
}

export async function fetchBackendStats(): Promise<StatsResponse | null> {
  if (!GO_BACKEND_URL) return null;
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/stats`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  if (!GO_BACKEND_URL) return false;
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/health`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
