/**
 * Where the landing page points people.
 *
 * The dashboard is a separate app (the Tripwire frontend), so its location is
 * configuration, not a constant. It defaults to the local dev address because
 * that is the only place it currently runs — set NEXT_PUBLIC_DASHBOARD_URL when
 * it is deployed somewhere real.
 */
export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:5173";

export const REPO_URL = "https://github.com/Ike-weber/Tripwire";
