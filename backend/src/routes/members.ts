import { Express, Request, Response } from "express";
import type { ClubCode } from "./products";
import { getClubCodes } from "./clubs";
import { getEntitlementsByMemberId, getEntitlementById, markEntitlementPickedUp, promotePreordersToReady } from "../stores/entitlements";

type InMemoryMember = {
  id: string;
  name?: string;
  email?: string;
  clubCode: ClubCode;
};

const members: InMemoryMember[] = [
  { id: "m1", name: "Alex Smith", email: "alex@example.com", clubCode: "SAP" },
  { id: "m2", name: "Briana Lee", email: "briana@example.com", clubCode: "WOOD" },
  { id: "m3", name: "Chris Doe", email: "chris@example.com", clubCode: "CELLARS" }
];

export function getMemberById(id: string): InMemoryMember | undefined {
  return members.find((m) => m.id === id);
}

export function getMembersByClub(clubCode: ClubCode): string[] {
  return members.filter((m) => m.clubCode === clubCode).map((m) => m.id);
}

export function getMemberIdsExist(ids: string[]): boolean {
  const set = new Set(members.map((m) => m.id));
  return ids.every((id) => set.has(id));
}

export function registerMemberRoutes(app: Express) {
  // GET /api/members - list members (optional ?clubCode= for filter)
  app.get("/api/members", (req: Request, res: Response) => {
    const validCodes = getClubCodes();
    const clubCode = (req.query.clubCode as string | undefined)?.trim().toUpperCase() as ClubCode | undefined;
    let list = [...members];
    if (clubCode && validCodes.includes(clubCode)) {
      list = list.filter((m) => m.clubCode === clubCode);
    }
    res.json(list);
  });

  // GET /api/members/:id/entitlements - pickup + preorder entitlements for member
  app.get(
    "/api/members/:id/entitlements",
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
  app.post(
    "/api/members/:id/pickups/fulfill",
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

