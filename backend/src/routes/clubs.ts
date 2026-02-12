import { Express, Request, Response } from "express";
import { prisma } from "../db";

export type Club = {
  id: string;
  name: string;
  code: string;
  description: string;
};

export async function getClubs(): Promise<Club[]> {
  const list = await prisma.club.findMany({ orderBy: { code: "asc" } });
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description ?? ""
  }));
}

/** Valid club codes for the current season (from admin-defined clubs). */
export async function getClubCodes(): Promise<string[]> {
  const list = await prisma.club.findMany({ select: { code: true }, orderBy: { code: "asc" } });
  return list.map((c) => c.code);
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

export function registerClubRoutes(app: Express) {
  // GET /api/clubs - list clubs
  app.get("/api/clubs", async (_req: Request, res: Response) => {
    const clubs = await getClubs();
    res.json(clubs);
  });

  // GET /api/clubs/:id - get one club
  app.get("/api/clubs/:id", async (req: Request, res: Response) => {
    const club = await getClubById(req.params.id);
    if (!club) {
      return res.status(404).json({ error: "Club not found" });
    }
    res.json(club);
  });

  // POST /api/clubs - create club (admin)
  app.post("/api/clubs", async (req: Request, res: Response) => {
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
  app.patch("/api/clubs/:id", async (req: Request, res: Response) => {
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
