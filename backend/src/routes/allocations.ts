import { Express, Request, Response } from "express";
import type { ClubCode } from "./products";
import { getClubCodes } from "./clubs";
import { getProductById, decrementProductInventory } from "./products";
import { getMembersByClub, getMemberIdsExist } from "./members";
import { addEntitlements } from "../stores/entitlements";

type AllocationTargetType = "club" | "members";

type InMemoryAllocation = {
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

const allocations: InMemoryAllocation[] = [];

function nextId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function addOrderedNotPickedUp(productId: string, quantity: number) {
  const p = getProductById(productId);
  if (p) p.orderedNotPickedUpCount += quantity;
}

export function registerAllocationRoutes(app: Express) {
  // GET /api/products/:productId/allocations - list allocations for a product
  app.get("/api/products/:productId/allocations", (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const list = allocations.filter((a) => a.productId === productId);
    res.json(list);
  });

  // POST /api/products/:productId/allocations - create allocation (admin)
  // Body: { quantityPerPerson, targetType: 'club'|'members', clubCode?, memberIds?, pullFromInventory: boolean }
  app.post("/api/products/:productId/allocations", async (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = getProductById(productId);
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
      const ok = decrementProductInventory(productId, totalQuantity);
      if (!ok) {
        return res.status(400).json({ error: "Insufficient inventory" });
      }
    }

    const allocation: InMemoryAllocation = {
      id: nextId("alloc"),
      productId,
      quantityPerPerson: qty,
      targetType,
      memberIds: [...memberIds],
      pullFromInventory,
      totalQuantity,
      createdAt: new Date().toISOString()
    };
    if (target === "club") {
      allocation.clubCode = (bodyClubCode || "").toUpperCase() as ClubCode;
    }
    allocations.push(allocation);

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
    for (let i = 0; i < memberIds.length; i++) {
      addOrderedNotPickedUp(productId, qty);
    }

    res.status(201).json(allocation);
  });
}
