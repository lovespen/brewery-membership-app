import { Express, Request, Response } from "express";
import type { ClubCode } from "./products";
import { getClubByCode, getClubCodes } from "./clubs";
import { getMembershipByClubAndYear } from "./memberships";
import { getUserById, getUserByEmail, getAllUsers } from "./users";
import { prisma } from "../db";

type UserMembershipRecord = {
  id: string;
  userId: string;
  clubCode: ClubCode;
  year: number;
  status: string;
  createdAt: string;
};

export async function getMembershipRecordsByUserId(
  userId: string
): Promise<UserMembershipRecord[]> {
  const list = await prisma.membership.findMany({
    where: { userId },
    include: { club: true },
    orderBy: [{ year: "desc" }, { club: { code: "asc" } }]
  });
  return list.map((m) => ({
    id: m.id,
    userId: m.userId,
    clubCode: m.club.code as ClubCode,
    year: m.year,
    status: m.status,
    createdAt: m.createdAt.toISOString()
  }));
}

export function registerUserMembershipRoutes(app: Express) {
  // GET /api/user-memberships - list (optional ?userId=). Returns records with user email/name.
  app.get("/api/user-memberships", async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    const memberships = await prisma.membership.findMany({
      where: userId ? { userId } : undefined,
      include: { club: true, user: { select: { id: true, email: true, name: true } } },
      orderBy: [{ year: "desc" }, { club: { code: "asc" } }]
    });
    const withUser = await Promise.all(
      memberships.map(async (m) => {
        const offering = await getMembershipByClubAndYear(m.club.code, m.year);
        return {
          id: m.id,
          userId: m.userId,
          clubCode: m.club.code,
          year: m.year,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
          userEmail: m.user.email,
          userName: m.user.name,
          toastDiscountCode: offering?.toastDiscountCode ?? null
        };
      })
    );
    res.json(withUser);
  });

  // POST /api/user-memberships - add membership to an account (admin/dev)
  app.post("/api/user-memberships", async (req: Request, res: Response) => {
    const { userId: userIdOrEmail, clubCode, year } = req.body;
    if (!userIdOrEmail || typeof userIdOrEmail !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }
    const trimmed = userIdOrEmail.trim();
    const user = trimmed.includes("@")
      ? await getUserByEmail(trimmed)
      : await getUserById(trimmed);
    if (!user) {
      return res.status(400).json({
        error: trimmed.includes("@")
          ? "No account with that email. Select the account from the search list."
          : "User not found"
      });
    }
    const validCodes = await getClubCodes();
    const code = (typeof clubCode === "string" ? clubCode.trim().toUpperCase() : "") as ClubCode;
    if (!validCodes.includes(code)) {
      return res.status(400).json({
        error: validCodes.length > 0
          ? `clubCode must be one of: ${validCodes.join(", ")} (from admin-defined clubs)`
          : "No clubs defined. Create clubs in admin first."
      });
    }
    const y = typeof year === "number" ? year : parseInt(String(year), 10);
    if (Number.isNaN(y) || y < 2020 || y > 2030) {
      return res.status(400).json({ error: "Valid year (2020–2030) required" });
    }
    const club = await getClubByCode(code);
    if (!club) {
      return res.status(400).json({ error: "Club not found" });
    }
    const existing = await prisma.membership.findUnique({
      where: { userId_clubId_year: { userId: user.id, clubId: club.id, year: y } }
    });
    if (existing) {
      return res.status(409).json({ error: "This account already has that club/year membership" });
    }
    const rec = await prisma.membership.create({
      data: { userId: user.id, clubId: club.id, year: y, status: "ACTIVE" },
      include: { club: true }
    });
    res.status(201).json({
      id: rec.id,
      userId: rec.userId,
      clubCode: rec.club.code,
      year: rec.year,
      status: rec.status,
      createdAt: rec.createdAt.toISOString()
    });
  });

  // PATCH /api/user-memberships/:id - transfer to another user (admin/dev)
  app.patch("/api/user-memberships/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId: newUserId } = req.body;
    const rec = await prisma.membership.findUnique({ where: { id }, include: { club: true } });
    if (!rec) {
      return res.status(404).json({ error: "Membership record not found" });
    }
    if (!newUserId || typeof newUserId !== "string") {
      return res.status(400).json({ error: "userId is required to transfer" });
    }
    const targetUser = await getUserById(newUserId);
    if (!targetUser) {
      return res.status(400).json({ error: "Target user not found" });
    }
    const existing = await prisma.membership.findUnique({
      where: {
        userId_clubId_year: {
          userId: newUserId,
          clubId: rec.clubId,
          year: rec.year
        }
      }
    });
    if (existing) {
      return res.status(409).json({ error: "Target account already has that club/year membership" });
    }
    const updated = await prisma.membership.update({
      where: { id },
      data: { userId: newUserId },
      include: { club: true }
    });
    res.json({
      id: updated.id,
      userId: updated.userId,
      clubCode: updated.club.code,
      year: updated.year,
      status: updated.status,
      createdAt: updated.createdAt.toISOString()
    });
  });

  // DELETE /api/user-memberships/:id - remove membership from account (admin/dev)
  app.delete("/api/user-memberships/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const rec = await prisma.membership.findUnique({ where: { id } });
    if (!rec) {
      return res.status(404).json({ error: "Membership record not found" });
    }
    await prisma.membership.delete({ where: { id } });
    res.status(204).send();
  });

  // GET /api/users/export-csv - export all members and their memberships as CSV (admin/dev)
  app.get("/api/users/export-csv", async (_req: Request, res: Response) => {
    const allUsers = await getAllUsers();
    const allMemberships = await prisma.membership.findMany({
      include: { club: true },
      orderBy: [{ userId: "asc" }, { year: "desc" }]
    });
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const escape = (val: string | null | undefined): string => {
      if (val == null) return "";
      const s = String(val);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header =
      "userId,email,name,userCreatedAt,clubCode,year,status,membershipCreatedAt";
    const rows: string[] = [header];

    for (const user of allUsers) {
      const memberships = allMemberships.filter((m) => m.userId === user.id);
      if (memberships.length === 0) {
        rows.push(
          [
            escape(user.id),
            escape(user.email),
            escape(user.name),
            escape(user.createdAt),
            "",
            "",
            "",
            ""
          ].join(",")
        );
      } else {
        for (const m of memberships) {
          rows.push(
            [
              escape(user.id),
              escape(user.email),
              escape(user.name),
              escape(user.createdAt),
              escape(m.club.code),
              m.year,
              escape(m.status),
              escape(m.createdAt.toISOString())
            ].join(",")
          );
        }
      }
    }

    const csv = rows.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="members-export-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  });
}
