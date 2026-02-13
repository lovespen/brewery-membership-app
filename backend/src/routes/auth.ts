import bcrypt from "bcrypt";
import type { IRouter } from "express";
import { Request, Response } from "express";
import type { ClubCode } from "./products";
import { getActiveMembershipYear } from "./config";
import { getClubByCode } from "./clubs";
import { getMembershipByClubAndYear } from "./memberships";
import { getUserByEmail, getUserById, setUserPasswordHash, verifyUserPassword } from "./users";
import { getMembershipRecordsByUserId } from "./user-memberships";

const SALT_ROUNDS = 10;

const tokenStore = new Map<string, { userId: string }>();

/** Hardcoded developer account (always has admin access). */
const DEV_ACCOUNT_EMAIL = "lovespen@gmail.com";

/** Comma-separated list of emails that can access the admin app. Set ADMIN_EMAILS in .env (e.g. ADMIN_EMAILS=admin@brewery.com,you@brewery.com). */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!fromEnv.includes(DEV_ACCOUNT_EMAIL)) fromEnv.push(DEV_ACCOUNT_EMAIL);
  return fromEnv;
}

export function isAdminUser(email: string): boolean {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/** Emails that can access the Developer fees tab and API. Set DEVELOPER_EMAILS in .env (e.g. DEVELOPER_EMAILS=you@example.com). Dev account is always included. */
export function getDeveloperEmails(): string[] {
  const raw = process.env.DEVELOPER_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!fromEnv.includes(DEV_ACCOUNT_EMAIL)) fromEnv.push(DEV_ACCOUNT_EMAIL);
  return fromEnv;
}

export function isDeveloperUser(email: string): boolean {
  return getDeveloperEmails().includes(email.trim().toLowerCase());
}

function randomToken(): string {
  return `tk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getAuthToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/** Routes that do not require admin. Path is relative to /api when called from app.use("/api", ...). */
export function isPublicApiRoute(method: string, path: string): boolean {
  const publicList: [string, string][] = [
    ["POST", "/register"],
    ["GET", "/auth/me"],
    ["POST", "/auth/login"],
    ["POST", "/auth/logout"],
    ["POST", "/auth/change-password"],
    ["POST", "/webhooks/stripe"],
    ["GET", "/products"],
    ["GET", "/clubs"],
    ["GET", "/memberships"],
    ["GET", "/config/membership-year"],
    ["GET", "/config/tip-percentages"]
  ];
  if (publicList.some(([m, p]) => m === method && p === path)) return true;
  if (method === "GET" && /^\/memberships\/[^/]+$/.test(path)) return true;
  if (method === "GET" && /^\/members\/[^/]+\/entitlements$/.test(path)) return true;
  if (method === "GET" && path === "/cart") return true;
  if (method === "POST" && path === "/cart/items") return true;
  if (method === "DELETE" && path.startsWith("/cart/items/")) return true;
  if (method === "POST" && path === "/cart/clear") return true;
  if (method === "POST" && path === "/checkout/create-payment-intent") return true;
  if (method === "GET" && path === "/push/vapid-public-key") return true;
  if (method === "POST" && path === "/push-subscriptions") return true;
  return false;
}

/** Middleware: require valid Bearer token and user email in DEVELOPER_EMAILS. Use after requireAdmin. */
export function requireDeveloper(req: Request, res: Response, next: (err?: unknown) => void): void {
  const u = (req as Request & { user?: { id: string; email: string } }).user;
  if (!u || !isDeveloperUser(u.email)) {
    res.status(403).json({ error: "Developer access required" });
    return;
  }
  next();
}

/** Middleware: require valid Bearer token and user email in ADMIN_EMAILS. */
export function requireAdmin(req: Request, res: Response, next: (err?: unknown) => void): void {
  void (async () => {
    try {
      const token = getAuthToken(req);
      if (!token) {
        res.status(401).json({ error: "Admin access requires login" });
        return;
      }
      const session = tokenStore.get(token);
      if (!session) {
        res.status(401).json({ error: "Session expired" });
        return;
      }
      const user = await getUserById(session.userId);
      if (!user) {
        res.status(401).json({ error: "Account not found" });
        return;
      }
      if (!isAdminUser(user.email)) {
        res.status(403).json({ error: "Admin access only" });
        return;
      }
      (req as Request & { user?: { id: string; email: string } }).user = { id: user.id, email: user.email };
      next();
    } catch (e) {
      next(e);
    }
  })();
}

export function registerAuthRoutes(router: IRouter) {
  // POST /api/auth/login - log in with email and password
  router.post("/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }
    const user = await getUserByEmail(email.trim());
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!user.passwordHash) {
      return res.status(401).json({ error: "Account has no password set; use set password flow" });
    }
    const valid = await verifyUserPassword(user.id, password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const allRecords = await getMembershipRecordsByUserId(user.id);
    const activeYear = getActiveMembershipYear();
    const records = allRecords.filter((r) => r.year === activeYear);
    const clubs = [...new Set(records.map((m) => m.clubCode))] as ClubCode[];
    const memberMemberships = await Promise.all(
      records.map(async (r) => {
        const offering = await getMembershipByClubAndYear(r.clubCode, r.year);
        const club = await getClubByCode(r.clubCode);
        return {
          clubCode: r.clubCode,
          clubName: club?.name ?? r.clubCode,
          year: r.year,
          toastDiscountCode: offering?.toastDiscountCode ?? `${r.clubCode}${r.year}`
        };
      })
    );
    const token = randomToken();
    tokenStore.set(token, { userId: user.id });
    const isAdmin = isAdminUser(user.email);
    const isDeveloper = isDeveloperUser(user.email);
    res.json({
      token,
      isAdmin,
      isDeveloper,
      member: {
        id: user.id,
        email: user.email,
        name: user.name ?? "",
        clubs,
        memberships: memberMemberships,
        membershipYear: activeYear
      }
    });
  });

  // GET /api/auth/me - current member from token
  router.get("/auth/me", async (req: Request, res: Response) => {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const session = tokenStore.get(token);
    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }
    const user = await getUserById(session.userId);
    if (!user) {
      tokenStore.delete(token);
      return res.status(401).json({ error: "Account not found" });
    }
    const allRecords = await getMembershipRecordsByUserId(user.id);
    const activeYear = getActiveMembershipYear();
    const records = allRecords.filter((r) => r.year === activeYear);
    const clubs = [...new Set(records.map((m) => m.clubCode))] as ClubCode[];
    const memberMemberships = await Promise.all(
      records.map(async (r) => {
        const offering = await getMembershipByClubAndYear(r.clubCode, r.year);
        const club = await getClubByCode(r.clubCode);
        return {
          clubCode: r.clubCode,
          clubName: club?.name ?? r.clubCode,
          year: r.year,
          toastDiscountCode: offering?.toastDiscountCode ?? `${r.clubCode}${r.year}`
        };
      })
    );
    const isAdmin = isAdminUser(user.email);
    const isDeveloper = isDeveloperUser(user.email);
    res.json({
      member: {
        id: user.id,
        email: user.email,
        name: user.name ?? "",
        clubs,
        memberships: memberMemberships,
        membershipYear: activeYear
      },
      isAdmin,
      isDeveloper
    });
  });

  // POST /api/auth/logout - invalidate token (client should discard token)
  router.post("/auth/logout", (req: Request, res: Response) => {
    const token = getAuthToken(req);
    if (token) tokenStore.delete(token);
    res.json({ ok: true });
  });

  // POST /api/auth/change-password - change password (requires Bearer token)
  router.post("/auth/change-password", async (req: Request, res: Response) => {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const session = tokenStore.get(token);
    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }
    const user = await getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ error: "Account not found" });
    }
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }
    if (user.passwordHash) {
      if (!currentPassword || typeof currentPassword !== "string") {
        return res.status(400).json({ error: "Current password is required" });
      }
      const valid = await verifyUserPassword(user.id, currentPassword);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await setUserPasswordHash(user.id, passwordHash);
    res.json({ ok: true });
  });
}
