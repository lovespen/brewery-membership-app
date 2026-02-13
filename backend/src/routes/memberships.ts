import type { IRouter } from "express";
import { Request, Response } from "express";
import { prisma } from "../db";
import { getClubByCode, getClubCodes } from "./clubs";

type ClubCode = string;

export type MembershipOffering = {
  id: string;
  clubCode: ClubCode;
  name: string;
  description: string;
  saleStartAt: string | null;
  saleEndAt: string | null;
  year: number;
  capacity: number;
  soldCount: number;
  isActive: boolean;
  priceCents: number;
  taxRateId: string | null;
  toastDiscountCode: string;
  allowedClubCodes: ClubCode[];
};

function toOffering(row: {
  id: string;
  clubId: string;
  year: number;
  name: string;
  description: string;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  capacity: number;
  soldCount: number;
  isActive: boolean;
  priceCents: number;
  taxRateId: string | null;
  toastDiscountCode: string;
  allowedClubCodes: unknown;
  club: { code: string };
}): MembershipOffering {
  const allowed = Array.isArray(row.allowedClubCodes)
    ? (row.allowedClubCodes as string[])
    : [];
  return {
    id: row.id,
    clubCode: row.club.code,
    name: row.name,
    description: row.description,
    saleStartAt: row.saleStartAt?.toISOString() ?? null,
    saleEndAt: row.saleEndAt?.toISOString() ?? null,
    year: row.year,
    capacity: row.capacity,
    soldCount: row.soldCount,
    isActive: row.isActive,
    priceCents: row.priceCents,
    taxRateId: row.taxRateId,
    toastDiscountCode: row.toastDiscountCode,
    allowedClubCodes: allowed
  };
}

export async function getMembershipById(id: string): Promise<MembershipOffering | undefined> {
  const o = await prisma.membershipOffering.findUnique({
    where: { id },
    include: { club: true }
  });
  return o ? toOffering(o) : undefined;
}

export async function getMembershipByClubAndYear(
  clubCode: string,
  year: number
): Promise<MembershipOffering | undefined> {
  const club = await getClubByCode(clubCode);
  if (!club) return undefined;
  const o = await prisma.membershipOffering.findUnique({
    where: { clubId_year: { clubId: club.id, year } },
    include: { club: true }
  });
  return o ? toOffering(o) : undefined;
}

export function registerMembershipRoutes(router: IRouter) {
  router.get("/memberships", async (_req: Request, res: Response) => {
    const list = await prisma.membershipOffering.findMany({
      include: { club: true },
      orderBy: [{ club: { code: "asc" } }, { year: "desc" }]
    });
    res.json(list.map(toOffering));
  });

  router.get("/memberships/:id", async (req: Request, res: Response) => {
    const offering = await getMembershipById(req.params.id);
    if (!offering) {
      return res.status(404).json({ error: "Membership offering not found" });
    }
    res.json(offering);
  });

  router.patch("/memberships/:id", async (req: Request, res: Response) => {
    const existing = await prisma.membershipOffering.findUnique({
      where: { id: req.params.id },
      include: { club: true }
    });
    if (!existing) {
      return res.status(404).json({ error: "Membership offering not found" });
    }
    const {
      name,
      description,
      saleStartAt,
      saleEndAt,
      year,
      capacity,
      priceCents,
      taxRateId,
      toastDiscountCode,
      allowedClubCodes: allowedClubsBody,
      isActive,
      clubCode
    } = req.body;

    const validCodes = await getClubCodes();
    const data: {
      name?: string;
      description?: string;
      saleStartAt?: Date | null;
      saleEndAt?: Date | null;
      year?: number;
      capacity?: number;
      priceCents?: number;
      taxRateId?: string | null;
      toastDiscountCode?: string;
      allowedClubCodes?: string[];
      isActive?: boolean;
      clubId?: string;
    } = {};

    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (description !== undefined) data.description = typeof description === "string" ? description : "";
    if (saleStartAt !== undefined) {
      data.saleStartAt = typeof saleStartAt === "string" && saleStartAt ? new Date(saleStartAt) : null;
    }
    if (saleEndAt !== undefined) {
      data.saleEndAt = typeof saleEndAt === "string" && saleEndAt ? new Date(saleEndAt) : null;
    }
    if (typeof year === "number" && year >= 2020 && year <= 2030) data.year = year;
    if (typeof capacity === "number" && capacity >= 0) data.capacity = Math.floor(capacity);
    if (typeof priceCents === "number" && priceCents >= 0) data.priceCents = priceCents;
    if (taxRateId !== undefined) {
      data.taxRateId =
        typeof taxRateId === "string" && taxRateId.trim() !== "" ? taxRateId.trim() : null;
    }
    if (typeof toastDiscountCode === "string") {
      data.toastDiscountCode =
        toastDiscountCode.trim() || `${existing.club.code}${existing.year}`;
    }
    if (Array.isArray(allowedClubsBody)) {
      const allowed = (allowedClubsBody as string[])
        .map((c) => (c || "").toString().trim().toUpperCase())
        .filter((c) => validCodes.includes(c));
      data.allowedClubCodes = allowed.length > 0 ? allowed : [existing.club.code];
    }
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (typeof clubCode === "string" && clubCode.trim()) {
      const code = clubCode.trim().toUpperCase();
      if (validCodes.includes(code)) {
        const club = await getClubByCode(code);
        if (club) data.clubId = club.id;
      }
    }

    const updated = await prisma.membershipOffering.update({
      where: { id: req.params.id },
      data,
      include: { club: true }
    });
    res.json(toOffering(updated));
  });

  router.post("/memberships", async (req: Request, res: Response) => {
    const {
      clubCode,
      name,
      description,
      saleStartAt,
      saleEndAt,
      year,
      capacity,
      priceCents,
      taxRateId,
      toastDiscountCode,
      allowedClubCodes: allowedClubsBody
    } = req.body;

    const validCodes = await getClubCodes();
    const code = (clubCode || "").toString().trim().toUpperCase();
    if (!validCodes.includes(code)) {
      return res.status(400).json({
        error: validCodes.length > 0
          ? `clubCode must be one of: ${validCodes.join(", ")} (from admin-defined clubs)`
          : "No clubs defined. Create clubs in admin first."
      });
    }
    if (typeof year !== "number" || year < 2020 || year > 2030) {
      return res.status(400).json({ error: "Valid year (2020–2030) required" });
    }
    const club = await getClubByCode(code);
    if (!club) {
      return res.status(400).json({ error: "Club not found" });
    }
    const cap = Math.max(0, parseInt(String(capacity), 10) || 0);
    const price = typeof priceCents === "number" && priceCents >= 0 ? priceCents : 0;
    const allowedClubCodes: string[] = Array.isArray(allowedClubsBody)
      ? (allowedClubsBody as string[])
          .map((c: string) => (c || "").toString().trim().toUpperCase())
          .filter((c: string) => validCodes.includes(c))
      : [code];
    const toastCode =
      typeof toastDiscountCode === "string" && toastDiscountCode.trim()
        ? String(toastDiscountCode).trim()
        : `${code}${year}`;

    const offering = await prisma.membershipOffering.create({
      data: {
        clubId: club.id,
        year,
        name: name || `${code} Club ${year}`,
        description: description || "",
        saleStartAt: saleStartAt ? new Date(saleStartAt) : null,
        saleEndAt: saleEndAt ? new Date(saleEndAt) : null,
        capacity: cap,
        priceCents: price,
        taxRateId:
          typeof taxRateId === "string" && taxRateId.trim() !== "" ? taxRateId.trim() : null,
        toastDiscountCode: toastCode,
        allowedClubCodes: allowedClubCodes.length > 0 ? allowedClubCodes : [code]
      },
      include: { club: true }
    });
    res.status(201).json(toOffering(offering));
  });
}
