/**
 * API base URL. In production set VITE_API_BASE (e.g. https://api.yourbrewery.com).
 * Defaults to same host as the admin app on port 4000, or localhost:4000 in dev.
 */
export function getApiBase(): string {
  const env = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
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
