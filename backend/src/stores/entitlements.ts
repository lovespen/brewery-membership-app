/** Persisted pickup entitlements (allocations, preorders, orders). Stored in DB so they survive restarts. */
import { prisma } from "../db";

export type EntitlementPayload = {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  status: "NOT_READY" | "READY_FOR_PICKUP" | "PICKED_UP" | "EXPIRED";
  source: string;
  releaseAt: string | null;
  pickedUpAt: string | null;
};

function rowToPayload(row: {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  status: string;
  source: string;
  releaseAt: Date | null;
  pickedUpAt: Date | null;
}): EntitlementPayload {
  return {
    id: row.id,
    userId: row.userId,
    productId: row.productId,
    quantity: row.quantity,
    status: row.status as EntitlementPayload["status"],
    source: row.source,
    releaseAt: row.releaseAt?.toISOString() ?? null,
    pickedUpAt: row.pickedUpAt?.toISOString() ?? null
  };
}

export async function getEntitlementsByMemberId(memberId: string): Promise<EntitlementPayload[]> {
  const rows = await prisma.pickupEntitlement.findMany({
    where: { userId: memberId }
  });
  return rows.map(rowToPayload);
}

export async function getAllEntitlements(): Promise<EntitlementPayload[]> {
  const rows = await prisma.pickupEntitlement.findMany();
  return rows.map(rowToPayload);
}

export async function getEntitlementById(id: string): Promise<EntitlementPayload | undefined> {
  const row = await prisma.pickupEntitlement.findUnique({ where: { id } });
  if (!row) return undefined;
  return rowToPayload(row);
}

export async function markEntitlementPickedUp(id: string): Promise<boolean> {
  const row = await prisma.pickupEntitlement.findUnique({ where: { id } });
  if (!row || row.status !== "READY_FOR_PICKUP") return false;
  await prisma.pickupEntitlement.update({
    where: { id },
    data: { status: "PICKED_UP", pickedUpAt: new Date() }
  });
  return true;
}

export async function markEntitlementNotPickedUp(id: string): Promise<boolean> {
  const row = await prisma.pickupEntitlement.findUnique({ where: { id } });
  if (!row || row.status !== "PICKED_UP") return false;
  await prisma.pickupEntitlement.update({
    where: { id },
    data: { status: "READY_FOR_PICKUP", pickedUpAt: null }
  });
  return true;
}

export async function addEntitlements(entries: Omit<EntitlementPayload, "id">[]): Promise<void> {
  if (entries.length === 0) return;
  const now = new Date();
  await prisma.pickupEntitlement.createMany({
    data: entries.map((e) => ({
      userId: e.userId,
      productId: e.productId,
      quantity: e.quantity,
      status: e.status,
      source: e.source,
      releaseAt: e.releaseAt ? new Date(e.releaseAt) : null,
      pickedUpAt: null
    }))
  });
}

/** Promote NOT_READY entitlements to READY_FOR_PICKUP when releaseAt has passed. */
export async function promotePreordersToReady(): Promise<void> {
  const now = new Date();
  await prisma.pickupEntitlement.updateMany({
    where: {
      status: "NOT_READY",
      releaseAt: { lte: now }
    },
    data: { status: "READY_FOR_PICKUP" }
  });
}
