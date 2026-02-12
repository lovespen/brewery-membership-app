/** In-memory pickup entitlements (allocations, preorders, orders). Shared so members + allocations can read/write. */
export type InMemoryPickupEntitlement = {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  status: "NOT_READY" | "READY_FOR_PICKUP" | "PICKED_UP" | "EXPIRED";
  source: "ALLOCATION" | "PREORDER" | "ORDER";
  releaseAt: string | null;
  pickedUpAt: string | null;
};

const entitlements: InMemoryPickupEntitlement[] = [];

export function getEntitlementsByMemberId(memberId: string): InMemoryPickupEntitlement[] {
  return entitlements.filter((e) => e.userId === memberId);
}

export function getAllEntitlements(): InMemoryPickupEntitlement[] {
  return [...entitlements];
}

export function getEntitlementById(id: string): InMemoryPickupEntitlement | undefined {
  return entitlements.find((e) => e.id === id);
}

export function markEntitlementPickedUp(id: string): boolean {
  const e = entitlements.find((x) => x.id === id);
  if (!e || e.status !== "READY_FOR_PICKUP") return false;
  e.status = "PICKED_UP";
  e.pickedUpAt = new Date().toISOString();
  return true;
}

export function markEntitlementNotPickedUp(id: string): boolean {
  const e = entitlements.find((x) => x.id === id);
  if (!e || e.status !== "PICKED_UP") return false;
  e.status = "READY_FOR_PICKUP";
  e.pickedUpAt = null;
  return true;
}

export function addEntitlements(entries: Omit<InMemoryPickupEntitlement, "id">[]): void {
  for (const e of entries) {
    const id = `ent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    entitlements.push({ ...e, id });
  }
}

/** Promote NOT_READY entitlements (PREORDER or ALLOCATION) to READY_FOR_PICKUP when releaseAt has passed. */
export function promotePreordersToReady(): void {
  const now = new Date().toISOString();
  for (const e of entitlements) {
    if (e.status !== "NOT_READY" || !e.releaseAt) continue;
    if (e.releaseAt <= now) {
      e.status = "READY_FOR_PICKUP";
    }
  }
}
