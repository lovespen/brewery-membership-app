/**
 * Backend API base URL. For local dev use your machine's IP (e.g. http://192.168.1.5:4000)
 * so the device/emulator can reach the server. localhost works for web or same-machine only.
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:4000";

/** Member web app URL (for "Checkout on web" link). Same host as API, different port in dev. */
export const MEMBER_WEB_BASE =
  process.env.EXPO_PUBLIC_MEMBER_WEB_BASE ?? "http://localhost:5174";

/** URL for staff pickup page (encoded in QR). Staff scan to see and mark member's pickups. */
export function getStaffPickupUrl(memberId: string): string {
  return `${API_BASE}/staff-pickup?memberId=${encodeURIComponent(memberId)}`;
}
