/**
 * Client-safe OAuth Client IDs.
 * Note: Only public client_id values belong here (never client_secrets).
 * Secrets are strictly read on the server from environment variables.
 */

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "59186292138-vd5g8l7uceqku34fua7f0sg79lpe2h98.apps.googleusercontent.com";

export const GITHUB_CLIENT_ID =
  process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ||
  "Ov23liz5v98MTdxFmu5u";

export const OAUTH_REDIRECT_URI = "https://koliance.oodai.space";
