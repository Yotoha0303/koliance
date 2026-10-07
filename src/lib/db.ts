import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kjsggytvrmpkmlytkdri.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_bnZzhsY4gqOQc_2n3_wBUA_X622_pre";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface DbUserRecord {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  bio?: string | null;
  wallet_address?: string | null;
  trust_tier: string;
  credit_allowance_usd: number;
  steam_id?: string | null;
  github_username?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Upsert user profile to database.
 * If Supabase is connected, writes to PostgreSQL table 'users'.
 */
export async function syncUserToDatabase(user: Partial<DbUserRecord> & { id: string; email: string; name: string }) {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture || null,
      bio: user.bio || "Koliance Web3 & AI Identity",
      wallet_address: user.wallet_address || null,
      trust_tier: user.trust_tier || "GOOGLE VERIFIED CITIZEN",
      credit_allowance_usd: user.credit_allowance_usd || 600,
      steam_id: user.steam_id || null,
      github_username: user.github_username || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.warn("[Database] User upsert notice (fallback to in-memory):", error.message);
      return payload;
    }
    return data;
  } catch (err) {
    console.warn("[Database] Exception during syncUserToDatabase:", err);
    return user;
  }
}

/**
 * Fetch user profile by ID, Email, or Wallet Address.
 */
export async function fetchUserFromDatabase(params: { id?: string; email?: string; wallet?: string }) {
  try {
    let query = supabase.from("users").select("*");
    if (params.id) {
      query = query.eq("id", params.id);
    } else if (params.email) {
      query = query.eq("email", params.email);
    } else if (params.wallet) {
      query = query.eq("wallet_address", params.wallet);
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as DbUserRecord;
  } catch {
    return null;
  }
}
