import type { IRouter } from "express";
import { Request, Response } from "express";
import { getClubCodes } from "./clubs";

/** Club code string; valid values come from GET /api/clubs (admin-defined). */
export type ClubCode = string;

type InMemoryProduct = {
  id: string;
  name: string;
  description?: string;
  basePriceCents: number;
  currency: string;
  allowedClubs: ClubCode[];
  clubPrices: { clubCode: ClubCode; priceCents: number }[];
  isPreorder: boolean;
  preorderStartAt?: string | null;
  preorderEndAt?: string | null;
  releaseAt?: string | null;
  isActive: boolean;
  /** Number of units ordered but not yet picked up (preorder + ready-for-pickup). */
  orderedNotPickedUpCount: number;
  /** Available inventory; used when pullFromInventory is true on allocations. */
  inventoryQuantity: number;
  /** Optional tax rate id from config/tax-rates; null = no tax. */
  taxRateId: string | null;
};

// Very simple in-memory product store just for local preview.
// This resets whenever the backend restarts.
const products: InMemoryProduct[] = [
  {
    id: "seed-wood-1",
    name: "Barrel-Aged Stout 2026",
    description: "Wood Club release. Limit 2 per member.",
    basePriceCents: 3400,
    currency: "USD",
    allowedClubs: ["WOOD", "FOUNDERS"],
    clubPrices: [{ clubCode: "WOOD", priceCents: 3000 }],
    isPreorder: true,
    preorderStartAt: "2025-01-01T00:00:00",
    preorderEndAt: "2026-12-31T23:59:59",
    releaseAt: "2026-05-01T00:00:00",
    isActive: true,
    orderedNotPickedUpCount: 0,
    inventoryQuantity: 0,
    taxRateId: null
  }
];

export function getProductById(id: string): InMemoryProduct | undefined {
  return products.find((p) => p.id === id);
}

/** True if product is preorder and current time is within preorderStartAt..preorderEndAt (inclusive). */
export function isWithinPreorderWindow(p: InMemoryProduct): boolean {
  if (!p.isPreorder || !p.preorderStartAt || !p.preorderEndAt) return false;
  const now = Date.now();
  const start = new Date(p.preorderStartAt).getTime();
  const end = new Date(p.preorderEndAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

/** Returns price in cents for product; optional clubCode for club-specific price. */
export function getProductPriceCents(productId: string, clubCode?: ClubCode): number | null {
  const p = getProductById(productId);
  if (!p) return null;
  if (clubCode) {
    const cp = p.clubPrices.find((c) => c.clubCode === clubCode);
    if (cp) return cp.priceCents;
  }
  return p.basePriceCents;
}

/** Decrements product inventory by amount. Returns true if enough stock, false otherwise. */
export function decrementProductInventory(productId: string, amount: number): boolean {
  const p = products.find((x) => x.id === productId);
  if (!p || p.inventoryQuantity < amount) return false;
  p.inventoryQuantity -= amount;
  return true;
}

export function registerProductRoutes(router: IRouter) {
  // GET /api/products - list products (optionally filtered by club)
  // For shop (includeInactive=false): preorder products only appear when within preorder window.
  router.get("/products", async (req: Request, res: Response) => {
    const clubCode = (req.query.clubCode as string | undefined)?.toUpperCase() as
      | ClubCode
      | undefined;
    const validCodes = await getClubCodes();
    const clubCodesParam = req.query.clubCodes as string | undefined;
    const clubCodes: ClubCode[] = clubCodesParam
      ? clubCodesParam
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter((c) => validCodes.includes(c))
      : clubCode && validCodes.includes(clubCode)
        ? [clubCode]
        : [];
    const includeInactive = req.query.includeInactive === "true";

    let list = includeInactive
      ? [...products]
      : products.filter((p) => p.isActive);

    if (clubCodes.length > 0) {
      list = list.filter((p) => clubCodes.some((cc) => p.allowedClubs.includes(cc)));
    }

    // Shop view: preorder products only available during their window
    if (!includeInactive) {
      list = list.filter((p) => {
        if (!p.isPreorder) return true;
        return isWithinPreorderWindow(p);
      });
    }

    res.json(list);
  });

  // POST /api/products - create product with allowed clubs and pricing (admin)
  router.post("/products", (req: Request, res: Response) => {
    const {
      name,
      description,
      basePriceCents,
      currency = "USD",
      allowedClubIds,
      clubPrices,
      isPreorder,
      preorderStartAt,
      preorderEndAt,
      releaseAt,
      taxRateId,
      inventoryQuantity: initialInventory
    } = req.body;

    if (!name || typeof basePriceCents !== "number") {
      return res.status(400).json({
        error: "name and basePriceCents are required"
      });
    }

    const id = `p_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const allowedClubs: ClubCode[] = Array.isArray(allowedClubIds)
      ? (allowedClubIds
          .map((c: string) => c.toUpperCase())
          .filter((c: string) =>
            ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(c)
          ) as ClubCode[])
      : [];

    const normalizedClubPrices: { clubCode: ClubCode; priceCents: number }[] =
      Array.isArray(clubPrices)
        ? clubPrices
            .filter(
              (cp: any) =>
                cp &&
                typeof cp.clubCode === "string" &&
                typeof cp.priceCents === "number"
            )
            .map((cp: any) => ({
              clubCode: cp.clubCode.toUpperCase() as ClubCode,
              priceCents: cp.priceCents
            }))
            .filter((cp) =>
              ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(cp.clubCode)
            )
        : [];

    const product: InMemoryProduct = {
      id,
      name,
      description,
      basePriceCents,
      currency,
      allowedClubs,
      clubPrices: normalizedClubPrices,
      isPreorder: !!isPreorder,
      preorderStartAt: isPreorder ? preorderStartAt ?? null : null,
      preorderEndAt: isPreorder ? preorderEndAt ?? null : null,
      releaseAt: isPreorder ? releaseAt ?? null : null,
      isActive: true,
      orderedNotPickedUpCount: 0,
      inventoryQuantity:
        typeof initialInventory === "number" && initialInventory >= 0
          ? Math.floor(initialInventory)
          : 0,
      taxRateId: typeof taxRateId === "string" && taxRateId.trim() !== "" ? taxRateId.trim() : null
    };

    products.push(product);

    res.status(201).json(product);
  });

  // GET /api/products/:id - get single product (for editing)
  router.get("/products/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const product = products.find((p) => p.id === id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });

  // PATCH /api/products/:id - update product (inventory, sale status, or full edit)
  router.patch("/products/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const product = products.find((p) => p.id === id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const {
      inventoryQuantity,
      taxRateId,
      isActive,
      name,
      description,
      basePriceCents,
      allowedClubIds,
      clubPrices,
      isPreorder,
      preorderStartAt,
      preorderEndAt,
      releaseAt
    } = req.body;

    if (typeof inventoryQuantity === "number" && inventoryQuantity >= 0) {
      product.inventoryQuantity = Math.floor(inventoryQuantity);
    }
    if (taxRateId !== undefined) {
      product.taxRateId =
        typeof taxRateId === "string" && taxRateId.trim() !== ""
          ? taxRateId.trim()
          : null;
    }
    if (typeof isActive === "boolean") {
      product.isActive = isActive;
    }
    if (typeof name === "string" && name.trim()) {
      product.name = name.trim();
    }
    if (description !== undefined) {
      product.description =
        typeof description === "string" ? description : undefined;
    }
    if (typeof basePriceCents === "number" && basePriceCents >= 0) {
      product.basePriceCents = basePriceCents;
    }
    if (Array.isArray(allowedClubIds)) {
      const allowedClubs: ClubCode[] = allowedClubIds
        .map((c: string) => (c || "").toUpperCase())
        .filter((c: string) =>
          ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(c)
        ) as ClubCode[];
      product.allowedClubs = allowedClubs;
    }
    if (Array.isArray(clubPrices)) {
      const normalizedClubPrices: { clubCode: ClubCode; priceCents: number }[] =
        clubPrices
          .filter(
            (cp: any) =>
              cp &&
              typeof cp.clubCode === "string" &&
              typeof cp.priceCents === "number"
          )
          .map((cp: any) => ({
            clubCode: cp.clubCode.toUpperCase() as ClubCode,
            priceCents: cp.priceCents
          }))
          .filter((cp) =>
            ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(cp.clubCode)
          );
      product.clubPrices = normalizedClubPrices;
    }
    if (typeof isPreorder === "boolean") {
      product.isPreorder = isPreorder;
      product.preorderStartAt = isPreorder ? preorderStartAt ?? null : null;
      product.preorderEndAt = isPreorder ? preorderEndAt ?? null : null;
      product.releaseAt = isPreorder ? releaseAt ?? null : null;
    } else if (
      product.isPreorder &&
      (preorderStartAt !== undefined ||
        preorderEndAt !== undefined ||
        releaseAt !== undefined)
    ) {
      if (preorderStartAt !== undefined) product.preorderStartAt = preorderStartAt ?? null;
      if (preorderEndAt !== undefined) product.preorderEndAt = preorderEndAt ?? null;
      if (releaseAt !== undefined) product.releaseAt = releaseAt ?? null;
    }
    res.json(product);
  });

  // DELETE /api/products/:id - remove product completely
  router.delete("/products/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Product not found" });
    }
    products.splice(idx, 1);
    res.status(204).send();
  });

  // GET /api/products/:id/pricing - view per-club pricing for a product
  router.get("/products/:id/pricing", (req: Request, res: Response) => {
    const { id } = req.params;
    const product = products.find((p) => p.id === id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({
      productId: id,
      defaultPriceCents: product.basePriceCents,
      currency: product.currency,
      clubPrices: product.clubPrices
    });
  });
}

