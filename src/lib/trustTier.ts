/**
 * Tier granted by a Google login.
 *
 * It used to depend on the e-mail domain: anyone with a @gmail.com (or
 * google.com / github.com / monad.xyz) address became "GOOGLE VERIFIED
 * ARCHITECT" with a $1200 allowance, everybody else "CITIZEN" with $600. A
 * domain proves nothing about the person, and @gmail.com is free to create, so
 * the rule only rewarded picking the right address. Every Google login now
 * gets the same baseline; anything above it has to come from a credential the
 * server verified itself (GitHub OAuth stats, Steam proofs, on-chain records).
 */
export const GOOGLE_BASELINE = Object.freeze({
  tier: "GOOGLE VERIFIED CITIZEN",
  creditAllowanceUSD: 600,
});

export function googleLoginTier(): { tier: string; creditAllowanceUSD: number } {
  return { ...GOOGLE_BASELINE };
}
