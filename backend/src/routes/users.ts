import bcrypt from "bcrypt";
import { Express, Request, Response } from "express";
import { prisma } from "../db";

const SALT_ROUNDS = 10;

/** Hardcoded developer account; ensured on startup so you can always log in to admin. */
const DEV_ACCOUNT = { email: "lovespen@gmail.com", password: "$Pl63724", name: "Developer" };

/** Ensures the hardcoded dev user exists with the correct password. Call once at startup. */
export async function ensureDevUser(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: DEV_ACCOUNT.email } });
  const passwordHash = await bcrypt.hash(DEV_ACCOUNT.password, SALT_ROUNDS);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash }
    });
    return;
  }
  await prisma.user.create({
    data: {
      email: DEV_ACCOUNT.email,
      name: DEV_ACCOUNT.name,
      passwordHash
    }
  });
}

export type InMemoryUser = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  createdAt: string;
};

export async function getUserById(id: string): Promise<InMemoryUser | undefined> {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return undefined;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt.toISOString()
  };
}

export async function getUserByEmail(email: string): Promise<InMemoryUser | undefined> {
  const u = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u) return undefined;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt.toISOString()
  };
}

export async function getAllUsers(): Promise<InMemoryUser[]> {
  const list = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return list.map((u: { id: string; email: string; name: string | null; passwordHash: string | null; createdAt: Date }) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt.toISOString()
  }));
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function setUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });
}

export function registerUserRoutes(app: Express) {
  // POST /api/register - create account (public); firstName, lastName, password required
  app.post("/api/register", async (req: Request, res: Response) => {
    const { email, firstName, lastName, password } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const first = typeof firstName === "string" ? firstName.trim() : "";
    const last = typeof lastName === "string" ? lastName.trim() : "";
    if (!first) return res.status(400).json({ error: "First name is required" });
    if (!last) return res.status(400).json({ error: "Last name is required" });
    const existing = await getUserByEmail(trimmed);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const fullName = `${first} ${last}`;
    const user = await prisma.user.create({
      data: {
        email: trimmed,
        name: fullName,
        passwordHash
      }
    });
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  });

  // GET /api/users - list accounts (admin/dev); never expose passwordHash
  app.get("/api/users", async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    res.json(
      users.map((u: { id: string; email: string; name: string | null; createdAt: Date }) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt.toISOString()
      }))
    );
  });
}
