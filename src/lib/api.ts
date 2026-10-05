// Koliance API Bridge: Connects to Go high-concurrency backend service

const GO_BACKEND_URL = process.env.NEXT_PUBLIC_GO_BACKEND_URL || "http://localhost:8080";

export interface StatsResponse {
  chainId: number;
  networkName: string;
  totalIdentities: number;
  totalTrusts: number;
  liveTps: number;
  status: string;
}

export interface GameStats {
  steamId: string;
  personaName: string;
  avatar: string;
  totalPlayHours: number;
  totalGames: number;
  topGames: Array<{
    appId: number;
    name: string;
    hoursPlayed: number;
    iconUrl: string;
    headerUrl?: string;
  }>;
}

export interface GameplayProof {
  proofHash: string;
  steamId: string;
  targetWallet: string;
  appId: number;
  gameName: string;
  playtimeHours: number;
  achievementsUnlocked: number;
  trustScoreTier: string;
  creditUnlockUSD: number;
  generatedAt: string;
}

export interface VisaCardData {
  cardId: string;
  cardNumber: string;
  formattedNumber: string;
  expiry: string;
  cvv: string;
  cardholderName: string;
  walletAddress: string;
  balanceUSD: number;
  status: string;
  createdAt: string;
}

export interface MarketPosition {
  asset_id?: string;
  symbol: string;
  qty: string;
  avg_entry_price?: string;
  side: string;
  market_value: string;
  cost_basis?: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
}

export interface MarketOverviewData {
  account: {
    id: string;
    account_number: string;
    buying_power: string;
    cash: string;
    portfolio_value: string;
    equity: string;
    multiplier: string;
    shorting_enabled: boolean;
    long_market_value?: string;
    short_market_value?: string;
  };
  positions: MarketPosition[];
  realtimePrices: Array<{
    symbol: string;
    feedId: string;
    price: number;
    confidence: number;
    updatedAt: string;
  }>;
}

export async function fetchBackendStats(): Promise<StatsResponse | null> {
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
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/health`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ==================== GAME / STEAM ====================
export async function fetchGameStats(steamId: string): Promise<GameStats | null> {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/game/steam/profile?id=${encodeURIComponent(steamId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateGameplayProof(steamId: string, walletAddress: string, appId: number = 730): Promise<GameplayProof | null> {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/game/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamId, walletAddress, appId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ==================== AGENTCARD ====================
export async function generateAgentCard(walletAddress: string, cardholderName: string = "KOLIANCE AGENT", initialDeposit: number = 2500): Promise<VisaCardData | null> {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/agentcard/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, cardholderName, initialDeposit }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function authorizeMicropayment(cardId: string, sessionKey: string, amountUSD: number, merchantName: string, mcc: string = "7999") {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/agentcard/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, sessionKey, amountUSD, merchantName, mcc }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// ==================== MARKET ====================
export async function fetchMarketOverview(): Promise<MarketOverviewData | null> {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/market/overview`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function executeMarketTrade(symbol: string, side: "buy" | "sell", notionalUSD: number, leverage: number = 4) {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/market/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, side, notionalUSD, leverage }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

export async function closeMarketPosition(symbol: string) {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/market/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    return await res.json();
  } catch (err) {
    return { error: String(err) };
  }
}

// ==================== STRIPE ====================
export async function createStripeCheckout(amountCents: number, description: string) {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/stripe/checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents, description }),
    });
    return await res.json();
  } catch (err) {
    return { error: String(err) };
  }
}
