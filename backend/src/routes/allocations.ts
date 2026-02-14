import type { IRouter } from "express";
import { Request, Response } from "express";
import type { ClubCode } from "./products";
import { getClubCodes } from "./clubs";
import { getProductById, decrementProductInventory, incrementOrderedNotPickedUp } from "./products";
import { getMembersByClub, getMemberIdsExist } from "./members";
import { addEntitlements } from "../stores/entitlements";
import { prisma } from "../db";

type AllocationTargetType = "club" | "members";

type AllocationPayload = {
  id: string;
  productId: string;
  quantityPerPerson: number;
  targetType: AllocationTargetType;
  clubCode?: ClubCode;
  memberIds: string[];
  pullFromInventory: boolean;
  totalQuantity: number;
  createdAt: string;
};

function toAllocationPayload(row: { id: string; productId: string; quantityPerPerson: number; targetType: string; clubCode: string | null; memberIds: unknown; pullFromInventory: boolean; totalQuantity: number; createdAt: Date }): AllocationPayload {
  return {
    id: row.id,
    productId: row.productId,
    quantityPerPerson: row.quantityPerPerson,
    targetType: row.targetType as AllocationTargetType,
    clubCode: row.clubCode ?? undefined,
    memberIds: (row.memberIds as string[]) ?? [],
    pullFromInventory: row.pullFromInventory,
    totalQuantity: row.totalQuantity,
    createdAt: row.createdAt.toISOString()
  };
}

async function addOrderedNotPickedUp(productId: string, quantity: number) {
  await incrementOrderedNotPickedUp(productId, quantity);
}

export function registerAllocationRoutes(router: IRouter) {
  // GET /api/products/:productId/allocations - list allocations for a product
  router.get("/products/:productId/allocations", async (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const list = await prisma.allocation.findMany({ where: { productId }, orderBy: { createdAt: "desc" } });
    res.json(list.map(toAllocationPayload));
  });

  // POST /api/products/:productId/allocations - create allocation (admin)
  // Body: { quantityPerPerson, targetType: 'club'|'members', clubCode?, memberIds?, pullFromInventory: boolean }
  router.post("/products/:productId/allocations", async (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const {
      quantityPerPerson,
      targetType,
      clubCode: bodyClubCode,
      memberIds: bodyMemberIds,
      pullFromInventory = false
    } = req.body;

    const qty = typeof quantityPerPerson === "number" ? Math.max(0, Math.floor(quantityPerPerson)) : 0;
    if (qty === 0) {
      return res.status(400).json({ error: "quantityPerPerson must be a positive number" });
    }

    const validTargets: AllocationTargetType[] = ["club", "members"];
    const target = validTargets.includes(targetType) ? targetType : null;
    if (!target) {
      return res.status(400).json({ error: "targetType must be 'club' or 'members'" });
    }

    let memberIds: string[] = [];

    if (target === "club") {
      const validCodes = await getClubCodes();
      const code = (bodyClubCode || "").toString().trim().toUpperCase() as ClubCode;
      if (!validCodes.includes(code)) {
        return res.status(400).json({
          error: validCodes.length > 0
            ? `clubCode required and must be one of: ${validCodes.join(", ")} (from admin-defined clubs)`
            : "No clubs defined. Create clubs in admin first."
        });
      }
      memberIds = getMembersByClub(code);
      if (memberIds.length === 0) {
        return res.status(400).json({ error: "No members found for that club" });
      }
    } else {
      if (!Array.isArray(bodyMemberIds) || bodyMemberIds.length === 0) {
        return res.status(400).json({ error: "memberIds must be a non-empty array for targetType 'members'" });
      }
      const ids = bodyMemberIds.filter((id: unknown) => typeof id === "string") as string[];
      if (ids.length === 0) {
        return res.status(400).json({ error: "memberIds must contain at least one string id" });
      }
      if (!getMemberIdsExist(ids)) {
        return res.status(400).json({ error: "One or more memberIds are not valid members" });
      }
      memberIds = ids;
    }

    const totalQuantity = qty * memberIds.length;

    if (pullFromInventory) {
      if (product.inventoryQuantity < totalQuantity) {
        return res.status(400).json({
          error: "Insufficient inventory",
          required: totalQuantity,
          available: product.inventoryQuantity
        });
      }
      const ok = await decrementProductInventory(productId, totalQuantity);
      if (!ok) {
        return res.status(400).json({ error: "Insufficient inventory" });
      }
    }

    const clubCodeVal = target === "club" ? ((bodyClubCode || "").toString().trim().toUpperCase() as ClubCode) : null;
    const created = await prisma.allocation.create({
      data: {
        productId,
        quantityPerPerson: qty,
        targetType,
        clubCode: clubCodeVal,
        memberIds: memberIds as unknown as object,
        pullFromInventory,
        totalQuantity
      }
    });
    const allocation = toAllocationPayload(created);

    const isPreorderAllocation = product.isPreorder && product.releaseAt;
    const status = isPreorderAllocation ? ("NOT_READY" as const) : ("READY_FOR_PICKUP" as const);
    const releaseAtRaw = isPreorderAllocation ? product.releaseAt : null;
    const releaseAt: string | null =
      releaseAtRaw != null
        ? typeof releaseAtRaw === "string"
          ? releaseAtRaw
          : (releaseAtRaw as Date).toISOString()
        : null;

    addEntitlements(
      memberIds.map((userId) => ({
        userId,
        productId,
        quantity: qty,
        status,
        source: "ALLOCATION" as const,
        releaseAt,
        pickedUpAt: null
      }))
    );
    await addOrderedNotPickedUp(productId, qty * memberIds.length);

    res.status(201).json(allocation);
  });
}
