import type { IRouter } from "express";
import { Request, Response } from "express";
import type { ClubCode } from "./products";
import { getClubCodes, getClubByCode } from "./clubs";
import { getEntitlementsByMemberId, getEntitlementById, markEntitlementPickedUp, promotePreordersToReady } from "../stores/entitlements";
import { prisma } from "../db";

export type MemberPayload = {
  id: string;
  name: string | null;
  email: string | null;
  clubCode: ClubCode;
};

/** Get member by user id; returns first active membership's club for clubCode. */
export async function getMemberById(id: string): Promise<MemberPayload | undefined> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        take: 1,
        include: { club: { select: { code: true } } }
      }
    }
  });
  if (!user) return undefined;
  const clubCode = (user.memberships[0]?.club?.code ?? "") as ClubCode;
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    clubCode
  };
}

/** Get user IDs that have an active membership for the given club. */
export async function getMembersByClub(clubCode: ClubCode): Promise<string[]> {
  const club = await getClubByCode(clubCode);
  if (!club) return [];
  const memberships = await prisma.membership.findMany({
    where: { clubId: club.id, status: "ACTIVE" },
    select: { userId: true }
  });
  return memberships.map((m) => m.userId);
}

/** Return true if every id exists as a User. */
export async function getMemberIdsExist(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false;
  const found = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true }
  });
  const set = new Set(found.map((u) => u.id));
  return ids.every((id) => set.has(id));
}

export function registerMemberRoutes(router: IRouter) {
  // GET /api/members - list members (optional ?clubCode= for filter). One row per active membership.
  router.get("/members", async (req: Request, res: Response) => {
    const validCodes = await getClubCodes();
    const clubCode = (req.query.clubCode as string | undefined)?.trim().toUpperCase() as ClubCode | undefined;
    const clubFilter = clubCode && validCodes.includes(clubCode) ? (await getClubByCode(clubCode))?.id : undefined;
    const memberships = await prisma.membership.findMany({
      where: { status: "ACTIVE", ...(clubFilter ? { clubId: clubFilter } : {}) },
      include: { user: { select: { id: true, name: true, email: true } }, club: { select: { code: true } } }
    });
    const list: MemberPayload[] = memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? null,
      email: m.user.email ?? null,
      clubCode: m.club.code as ClubCode
    }));
    res.json(list);
  });

  // GET /api/members/:id/entitlements - pickup + preorder entitlements for member
  router.get(
    "/members/:id/entitlements",
    async (req: Request, res: Response) => {
      promotePreordersToReady();
      const { id } = req.params;
      const all = getEntitlementsByMemberId(id);
      const readyForPickup = all.filter((e) => e.status === "READY_FOR_PICKUP");
      const upcomingPreorders = all.filter((e) => e.status === "NOT_READY");
      res.json({
        memberId: id,
        readyForPickup,
        upcomingPreorders
      });
    }
  );

  // POST /api/members/:id/pickups/fulfill - employee marks items picked up
  router.post(
    "/members/:id/pickups/fulfill",
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { entitlementIds } = req.body as { entitlementIds?: string[] };
      const ids = Array.isArray(entitlementIds) ? entitlementIds : [];
      const fulfilled: string[] = [];
      for (const entId of ids) {
        const ent = getEntitlementById(entId);
        if (ent && ent.userId === id && markEntitlementPickedUp(entId)) fulfilled.push(entId);
      }
      res.json({ memberId: id, fulfilledEntitlementIds: fulfilled });
    }
  );
}
