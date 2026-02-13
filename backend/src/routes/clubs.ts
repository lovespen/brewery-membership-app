import type { IRouter } from "express";
import { Request, Response } from "express";
import { prisma } from "../db";

export type Club = {
  id: string;
  name: string;
  code: string;
  description: string;
};

export async function getClubs(): Promise<Club[]> {
  const list = await prisma.club.findMany({ orderBy: { code: "asc" } });
  return list.map((c: { id: string; name: string; code: string; description: string | null }) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description ?? ""
  }));
}

/** Valid club codes for the current season (from admin-defined clubs). */
export async function getClubCodes(): Promise<string[]> {
  const list = await prisma.club.findMany({ select: { code: true }, orderBy: { code: "asc" } });
  return list.map((c: { code: string }) => c.code);
}

export async function getClubById(id: string): Promise<Club | undefined> {
  const c = await prisma.club.findUnique({ where: { id } });
  if (!c) return undefined;
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description ?? ""
  };
}

export async function getClubByCode(code: string): Promise<Club | undefined> {
  const c = await prisma.club.findFirst({
    where: { code: { equals: code.toUpperCase(), mode: "insensitive" } }
  });
  if (!c) return undefined;
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description ?? ""
  };
}

const DEFAULT_CLUBS = [
  { name: "Wood Club", code: "WOOD", description: "Wood Club membership" },
  { name: "Sap Club", code: "SAP", description: "Sap Club membership" },
  { name: "Cellars", code: "CELLARS", description: "Cellars membership" },
  { name: "Founders", code: "FOUNDERS", description: "Founders membership" }
];

/** Creates default clubs if the database has none. Returns how many were created. Used at startup. */
export async function ensureDefaultClubs(): Promise<number> {
  const count = await prisma.club.count();
  if (count > 0) return 0;
  for (const { name, code, description } of DEFAULT_CLUBS) {
    await prisma.club.create({
      data: { name, code, description: description ?? "" }
    });
  }
  return DEFAULT_CLUBS.length;
}

/** Creates only the default clubs that don't exist yet (by code). Returns how many were created. */
export async function ensureMissingDefaultClubs(): Promise<number> {
  let created = 0;
  for (const { name, code, description } of DEFAULT_CLUBS) {
    const existing = await getClubByCode(code);
    if (!existing) {
      await prisma.club.create({
        data: { name, code, description: description ?? "" }
      });
      created += 1;
    }
  }
  return created;
}

/** Updates Cellars and Founders descriptions to remove "combination" wording. Run at startup to fix existing DB rows. */
export async function fixClubDescriptionsNoCombination(): Promise<void> {
  const updates: { code: string; description: string }[] = [
    { code: "CELLARS", description: "Cellars membership" },
    { code: "FOUNDERS", description: "Founders membership" }
  ];
  for (const { code, description } of updates) {
    const club = await prisma.club.findFirst({
      where: { code: { equals: code, mode: "insensitive" } }
    });
    if (club && (club.description ?? "").toLowerCase().includes("combination")) {
      await prisma.club.update({
        where: { id: club.id },
        data: { description }
      });
    }
  }
}

export function registerClubRoutes(router: IRouter) {
  // GET /api/clubs - list clubs
  router.get("/clubs", async (_req: Request, res: Response) => {
    const clubs = await getClubs();
    res.json(clubs);
  });

  // POST /api/clubs/seed-defaults - create any default clubs that don't exist yet (admin)
  router.post("/clubs/seed-defaults", async (_req: Request, res: Response) => {
    const created = await ensureMissingDefaultClubs();
    const clubs = await getClubs();
    res.json({ created, clubs });
  });

  // GET /api/clubs/:id - get one club
  router.get("/clubs/:id", async (req: Request, res: Response) => {
    const club = await getClubById(req.params.id);
    if (!club) {
      return res.status(404).json({ error: "Club not found" });
    }
    res.json(club);
  });

  // POST /api/clubs - create club (admin)
  router.post("/clubs", async (req: Request, res: Response) => {
    const { name, code, description } = req.body;
    const rawCode = (code || "").toString().trim().toUpperCase().replace(/\s+/g, "_");
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!rawCode) {
      return res.status(400).json({ error: "code is required" });
    }
    const existing = await getClubByCode(rawCode);
    if (existing) {
      return res.status(409).json({ error: "A club with this code already exists" });
    }
    const club = await prisma.club.create({
      data: {
        name: name.trim(),
        code: rawCode,
        description: typeof description === "string" ? description.trim() : ""
      }
    });
    res.status(201).json({
      id: club.id,
      name: club.name,
      code: club.code,
      description: club.description ?? ""
    });
  });

  // PATCH /api/clubs/:id - update club (admin)
  router.patch("/clubs/:id", async (req: Request, res: Response) => {
    const club = await getClubById(req.params.id);
    if (!club) {
      return res.status(404).json({ error: "Club not found" });
    }
    const { name, code, description } = req.body;
    let data: { name?: string; code?: string; description?: string } = {};
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (typeof code === "string" && code.trim()) {
      const rawCode = code.trim().toUpperCase().replace(/\s+/g, "_");
      const other = await prisma.club.findFirst({
        where: { code: rawCode, id: { not: club.id } }
      });
      if (other) {
        return res.status(409).json({ error: "Another club already uses this code" });
      }
      data.code = rawCode;
    }
    if (description !== undefined) {
      data.description = typeof description === "string" ? description.trim() : "";
    }
    const updated = await prisma.club.update({
      where: { id: req.params.id },
      data
    });
    res.json({
      id: updated.id,
      name: updated.name,
      code: updated.code,
      description: updated.description ?? ""
    });
  });
}
