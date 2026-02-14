import type { IRouter } from "express";
import { Request, Response } from "express";
import { getClubCodes, getClubByCode } from "./clubs";
import { prisma } from "../db";

/** Club code string; valid values come from GET /api/clubs (admin-defined). */
export type ClubCode = string;

export type ProductPayload = {
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
  orderedNotPickedUpCount: number;
  inventoryQuantity: number;
  taxRateId: string | null;
};

function toProductPayload(row: {
  id: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  currency: string;
  isPreorder: boolean;
  preorderStartAt: Date | null;
  preorderEndAt: Date | null;
  releaseAt: Date | null;
  isActive: boolean;
  orderedNotPickedUpCount: number;
  inventoryQuantity: number;
  taxRateId: string | null;
  allowedClubs: { club: { code: string } }[];
  prices: { clubId: string | null; priceCents: number; club: { code: string } | null }[];
}): ProductPayload {
  const allowedClubs = row.allowedClubs.map((a) => a.club.code);
  const clubPrices = row.prices
    .filter((p) => p.clubId != null && p.club != null)
    .map((p) => ({ clubCode: p.club!.code, priceCents: p.priceCents }));
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    basePriceCents: row.basePriceCents,
    currency: row.currency,
    allowedClubs,
    clubPrices,
    isPreorder: row.isPreorder,
    preorderStartAt: row.preorderStartAt?.toISOString() ?? null,
    preorderEndAt: row.preorderEndAt?.toISOString() ?? null,
    releaseAt: row.releaseAt?.toISOString() ?? null,
    isActive: row.isActive,
    orderedNotPickedUpCount: row.orderedNotPickedUpCount,
    inventoryQuantity: row.inventoryQuantity,
    taxRateId: row.taxRateId
  };
}

const productInclude = {
  allowedClubs: { include: { club: { select: { code: true } } } },
  prices: { include: { club: { select: { code: true } } } }
} as const;

/** True if product is preorder and current time is within preorderStartAt..preorderEndAt (inclusive). */
export function isWithinPreorderWindow(p: {
  isPreorder: boolean;
  preorderStartAt?: string | null;
  preorderEndAt?: string | null;
}): boolean {
  if (!p.isPreorder || !p.preorderStartAt || !p.preorderEndAt) return false;
  const now = Date.now();
  const start = new Date(p.preorderStartAt).getTime();
  const end = new Date(p.preorderEndAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

export async function getProductById(id: string): Promise<ProductPayload | undefined> {
  const row = await prisma.product.findUnique({
    where: { id },
    include: productInclude
  });
  if (!row) return undefined;
  return toProductPayload(row);
}

/** Returns price in cents for product; optional clubCode for club-specific price. */
export async function getProductPriceCents(
  productId: string,
  clubCode?: ClubCode
): Promise<number | null> {
  const p = await getProductById(productId);
  if (!p) return null;
  if (clubCode) {
    const cp = p.clubPrices.find((c) => c.clubCode === clubCode);
    if (cp) return cp.priceCents;
  }
  return p.basePriceCents;
}

/** Decrements product inventory by amount. Returns true if enough stock, false otherwise. */
export async function decrementProductInventory(
  productId: string,
  amount: number
): Promise<boolean> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.inventoryQuantity < amount) return false;
  await prisma.product.update({
    where: { id: productId },
    data: { inventoryQuantity: product.inventoryQuantity - amount }
  });
  return true;
}

/** Increment orderedNotPickedUpCount (e.g. after allocation or purchase). */
export async function incrementOrderedNotPickedUp(
  productId: string,
  quantity: number
): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: { orderedNotPickedUpCount: { increment: quantity } }
  });
}

export function registerProductRoutes(router: IRouter) {
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

    let list = await prisma.product.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: productInclude
    });

    if (clubCodes.length > 0) {
      list = list.filter((p) =>
        p.allowedClubs.some((a) => clubCodes.includes(a.club.code))
      );
    }

    if (!includeInactive) {
      list = list.filter((p) => {
        if (!p.isPreorder) return true;
        return isWithinPreorderWindow({
          isPreorder: p.isPreorder,
          preorderStartAt: p.preorderStartAt?.toISOString() ?? null,
          preorderEndAt: p.preorderEndAt?.toISOString() ?? null
        });
      });
    }

    res.json(list.map(toProductPayload));
  });

  router.post("/products", async (req: Request, res: Response) => {
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

    const allowedClubCodes: ClubCode[] = Array.isArray(allowedClubIds)
      ? (allowedClubIds as string[])
          .map((c: string) => (c || "").toUpperCase())
          .filter((c: string) =>
            ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(c)
          )
      : [];

    const normalizedClubPrices: { clubCode: ClubCode; priceCents: number }[] =
      Array.isArray(clubPrices)
        ? clubPrices
            .filter(
              (cp: { clubCode?: string; priceCents?: number }) =>
                cp &&
                typeof cp.clubCode === "string" &&
                typeof cp.priceCents === "number"
            )
            .map((cp: { clubCode: string; priceCents: number }) => ({
              clubCode: cp.clubCode.toUpperCase() as ClubCode,
              priceCents: cp.priceCents
            }))
            .filter((cp) =>
              ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(cp.clubCode)
            )
        : [];

    const clubIds: string[] = [];
    for (const code of allowedClubCodes) {
      const club = await getClubByCode(code);
      if (club) clubIds.push(club.id);
    }

    const priceCreates: { clubId: string; priceCents: number; currency: string }[] = [];
    for (const cp of normalizedClubPrices) {
      const club = await getClubByCode(cp.clubCode);
      if (club) {
        priceCreates.push({
          clubId: club.id,
          priceCents: cp.priceCents,
          currency: currency || "USD"
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        name: String(name).trim(),
        description:
          typeof description === "string" ? description.trim() || null : null,
        basePriceCents:
          typeof basePriceCents === "number" && basePriceCents >= 0
            ? basePriceCents
            : 0,
        currency: currency || "USD",
        isPreorder: !!isPreorder,
        preorderStartAt:
          isPreorder && preorderStartAt
            ? new Date(preorderStartAt)
            : null,
        preorderEndAt:
          isPreorder && preorderEndAt ? new Date(preorderEndAt) : null,
        releaseAt: isPreorder && releaseAt ? new Date(releaseAt) : null,
        taxRateId:
          typeof taxRateId === "string" && taxRateId.trim()
            ? taxRateId.trim()
            : null,
        inventoryQuantity:
          typeof initialInventory === "number" && initialInventory >= 0
            ? Math.floor(initialInventory)
            : 0,
        allowedClubs: {
          create: clubIds.map((clubId) => ({ clubId }))
        },
        prices: { create: priceCreates }
      },
      include: productInclude
    });

    const payload = toProductPayload(product);
    res.status(201).json(payload);
  });

  router.get("/products/:id", async (req: Request, res: Response) => {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });

  router.patch("/products/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = await prisma.product.findUnique({
      where: { id },
      include: productInclude
    });
    if (!existing) {
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

    const data: {
      inventoryQuantity?: number;
      taxRateId?: string | null;
      isActive?: boolean;
      name?: string;
      description?: string | null;
      basePriceCents?: number;
      isPreorder?: boolean;
      preorderStartAt?: Date | null;
      preorderEndAt?: Date | null;
      releaseAt?: Date | null;
    } = {};

    if (typeof inventoryQuantity === "number" && inventoryQuantity >= 0) {
      data.inventoryQuantity = Math.floor(inventoryQuantity);
    }
    if (taxRateId !== undefined) {
      data.taxRateId =
        typeof taxRateId === "string" && taxRateId.trim()
          ? taxRateId.trim()
          : null;
    }
    if (typeof isActive === "boolean") {
      data.isActive = isActive;
    }
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (description !== undefined) {
      data.description =
        typeof description === "string" ? description.trim() || null : null;
    }
    if (typeof basePriceCents === "number" && basePriceCents >= 0) {
      data.basePriceCents = basePriceCents;
    }
    if (typeof isPreorder === "boolean") {
      data.isPreorder = isPreorder;
      data.preorderStartAt =
        isPreorder && preorderStartAt ? new Date(preorderStartAt) : null;
      data.preorderEndAt =
        isPreorder && preorderEndAt ? new Date(preorderEndAt) : null;
      data.releaseAt = isPreorder && releaseAt ? new Date(releaseAt) : null;
    } else if (
      existing.isPreorder &&
      (preorderStartAt !== undefined ||
        preorderEndAt !== undefined ||
        releaseAt !== undefined)
    ) {
      if (preorderStartAt !== undefined) {
        data.preorderStartAt = preorderStartAt
          ? new Date(preorderStartAt)
          : null;
      }
      if (preorderEndAt !== undefined) {
        data.preorderEndAt = preorderEndAt ? new Date(preorderEndAt) : null;
      }
      if (releaseAt !== undefined) {
        data.releaseAt = releaseAt ? new Date(releaseAt) : null;
      }
    }

    await prisma.product.update({ where: { id }, data });

    if (Array.isArray(allowedClubIds)) {
      const codes = (allowedClubIds as string[])
        .map((c) => (c || "").toUpperCase())
        .filter((c) =>
          ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(c)
        );
      const clubIds: string[] = [];
      for (const code of codes) {
        const club = await getClubByCode(code);
        if (club) clubIds.push(club.id);
      }
      await prisma.productAllowedClub.deleteMany({ where: { productId: id } });
      await prisma.productAllowedClub.createMany({
        data: clubIds.map((clubId) => ({ productId: id, clubId }))
      });
    }

    if (Array.isArray(clubPrices)) {
      const normalized = clubPrices
        .filter(
          (cp: { clubCode?: string; priceCents?: number }) =>
            cp &&
            typeof cp.clubCode === "string" &&
            typeof cp.priceCents === "number"
        )
        .map((cp: { clubCode: string; priceCents: number }) => ({
          clubCode: cp.clubCode.toUpperCase(),
          priceCents: cp.priceCents
        }))
        .filter((cp) =>
          ["SAP", "WOOD", "CELLARS", "FOUNDERS"].includes(cp.clubCode)
        );
      await prisma.productPrice.deleteMany({ where: { productId: id } });
      for (const cp of normalized) {
        const club = await getClubByCode(cp.clubCode);
        if (club) {
          await prisma.productPrice.create({
            data: {
              productId: id,
              clubId: club.id,
              priceCents: cp.priceCents,
              currency: existing.currency || "USD"
            }
          });
        }
      }
    }

    const updated = await getProductById(id);
    res.json(updated);
  });

  router.delete("/products/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  });

  router.get("/products/:id/pricing", async (req: Request, res: Response) => {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({
      productId: product.id,
      defaultPriceCents: product.basePriceCents,
      currency: product.currency,
      clubPrices: product.clubPrices
    });
  });
}
