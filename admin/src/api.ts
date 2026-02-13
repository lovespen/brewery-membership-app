/**
 * API base URL. Must set VITE_API_BASE when building for production (e.g. Vercel).
 * In dev, defaults to http://localhost:4000.
 */
export function getApiBase(): string {
  const env = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  if (env && env.trim()) return env.trim().replace(/\/$/, "");
  return "http://localhost:4000";
}

const ADMIN_TOKEN_KEY = "breweryAdminToken";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore
  }
}
