import type { IRouter } from "express";
import { Request, Response } from "express";
import { requireDeveloper } from "./auth";
import { prisma } from "../db";

export type TaxRate = {
  id: string;
  name: string;
  ratePercent: number;
};

/** Stripe integration config (admin + developer). Secret key never returned in GET. */
type StripeConfig = {
  enabled: boolean;
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
  achDefaultThresholdCents: number;
};

type FeeConfig = {
  developerFeePercent: number;
  developerConnectAccountId: string | null;
};

// In-memory cache loaded from DB at startup and updated on every config write
let stripeConfig: StripeConfig = {
  enabled: false,
  publishableKey: null,
  secretKey: null,
  webhookSecret: null,
  achDefaultThresholdCents: 5000
};
let activeMembershipYear = 2026;
let suggestedTipPercents: number[] = [0, 10, 15, 20, 25];
let feeConfig: FeeConfig = { developerFeePercent: 0, developerConnectAccountId: null };

/** Create default tax rates if the table is empty. Call once at startup. */
export async function ensureDefaultTaxRates(): Promise<void> {
  const count = await prisma.taxRate.count();
  if (count > 0) return;
  await prisma.taxRate.createMany({
    data: [
      { name: "Standard", ratePercent: 8.25 },
      { name: "Tax exempt", ratePercent: 0 }
    ]
  });
}

/** Load app config from DB into memory. Call at startup and after any config write. */
export async function loadConfigFromDb(): Promise<void> {
  try {
    const rows = await prisma.config.findMany({
      where: {
        key: { in: ["stripe", "membershipYear", "suggestedTipPercents", "developerFees"] }
      }
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
    const stripe = byKey.get("stripe") as StripeConfig | undefined;
    if (stripe && typeof stripe === "object") {
      stripeConfig = {
        enabled: Boolean(stripe.enabled),
        publishableKey: typeof stripe.publishableKey === "string" ? stripe.publishableKey : null,
        secretKey: typeof stripe.secretKey === "string" ? stripe.secretKey : null,
        webhookSecret: typeof stripe.webhookSecret === "string" ? stripe.webhookSecret : null,
        achDefaultThresholdCents:
          typeof stripe.achDefaultThresholdCents === "number" && stripe.achDefaultThresholdCents >= 0
            ? Math.floor(stripe.achDefaultThresholdCents)
            : 5000
      };
    }
    const year = byKey.get("membershipYear");
    if (typeof year === "number" && year >= 2020 && year <= 2030) {
      activeMembershipYear = Math.floor(year);
    } else {
      const env = process.env.MEMBERSHIP_YEAR;
      if (typeof env === "string" && env.trim()) {
        const n = parseInt(env.trim(), 10);
        if (!Number.isNaN(n) && n >= 2020 && n <= 2030) activeMembershipYear = n;
      }
    }
    const tips = byKey.get("suggestedTipPercents");
    if (Array.isArray(tips)) {
      const parsed = tips
        .map((n) => (typeof n === "number" ? n : parseFloat(String(n))))
        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 100);
      if (parsed.length > 0) suggestedTipPercents = [...new Set(parsed)].sort((a, b) => a - b);
    }
    const fees = byKey.get("developerFees") as FeeConfig | undefined;
    if (fees && typeof fees === "object") {
      feeConfig = {
        developerFeePercent:
          typeof fees.developerFeePercent === "number" && fees.developerFeePercent >= 0 && fees.developerFeePercent <= 100
            ? Math.round(fees.developerFeePercent * 10) / 10
            : 0,
        developerConnectAccountId:
          typeof fees.developerConnectAccountId === "string" && fees.developerConnectAccountId.trim()
            ? fees.developerConnectAccountId.trim()
            : null
      };
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Failed to load config from DB, using defaults:", e);
  }
}

export async function getTaxRateById(id: string): Promise<TaxRate | undefined> {
  const row = await prisma.taxRate.findUnique({ where: { id } });
  if (!row) return undefined;
  return { id: row.id, name: row.name, ratePercent: row.ratePercent };
}

export function getStripeAchDefaultThresholdCents(): number {
  return stripeConfig.achDefaultThresholdCents;
}
export function getStripeSecretKey(): string | null {
  return stripeConfig.secretKey;
}
export function getStripePublishableKey(): string | null {
  return stripeConfig.publishableKey;
}
export function getStripeWebhookSecret(): string | null {
  return stripeConfig.webhookSecret;
}
export function getActiveMembershipYear(): number {
  return activeMembershipYear;
}

export function registerConfigRoutes(router: IRouter) {
  // GET /api/config/stripe
  router.get("/config/stripe", (_req: Request, res: Response) => {
    res.json({
      enabled: stripeConfig.enabled,
      publishableKey: stripeConfig.publishableKey,
      secretKeyConfigured: !!stripeConfig.secretKey,
      webhookSecretConfigured: !!stripeConfig.webhookSecret,
      achDefaultThresholdCents: stripeConfig.achDefaultThresholdCents
    });
  });

  // PUT /api/config/stripe
  router.put("/config/stripe", async (req: Request, res: Response) => {
    const { enabled, publishableKey, secretKey, webhookSecret, achDefaultThresholdCents } = req.body;
    const next: StripeConfig = { ...stripeConfig };
    if (typeof enabled === "boolean") next.enabled = enabled;
    if (typeof publishableKey === "string") next.publishableKey = publishableKey.trim() || null;
    if (typeof secretKey === "string") next.secretKey = secretKey.trim() || null;
    if (typeof webhookSecret === "string") next.webhookSecret = webhookSecret.trim() || null;
    if (typeof achDefaultThresholdCents === "number" && achDefaultThresholdCents >= 0) {
      next.achDefaultThresholdCents = Math.floor(achDefaultThresholdCents);
    }
    await prisma.config.upsert({
      where: { key: "stripe" },
      create: { key: "stripe", value: next as unknown as object },
      update: { value: next as unknown as object }
    });
    stripeConfig = next;
    res.json({
      enabled: stripeConfig.enabled,
      publishableKey: stripeConfig.publishableKey,
      secretKeyConfigured: !!stripeConfig.secretKey,
      webhookSecretConfigured: !!stripeConfig.webhookSecret,
      achDefaultThresholdCents: stripeConfig.achDefaultThresholdCents
    });
  });

  // GET /api/config/tax-rates
  router.get("/config/tax-rates", async (_req: Request, res: Response) => {
    const rows = await prisma.taxRate.findMany({ orderBy: { name: "asc" } });
    res.json(rows.map((r) => ({ id: r.id, name: r.name, ratePercent: r.ratePercent })));
  });

  // POST /api/config/tax-rates
  router.post("/config/tax-rates", async (req: Request, res: Response) => {
    const { name, ratePercent } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "name is required" });
    }
    const rate = typeof ratePercent === "number" ? ratePercent : parseFloat(String(ratePercent));
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ error: "ratePercent must be a number between 0 and 100" });
    }
    const row = await prisma.taxRate.create({
      data: { name: name.trim(), ratePercent: Math.round(rate * 100) / 100 }
    });
    res.status(201).json({ id: row.id, name: row.name, ratePercent: row.ratePercent });
  });

  // DELETE /api/config/tax-rates/:id
  router.delete("/config/tax-rates/:id", async (req: Request, res: Response) => {
    try {
      await prisma.taxRate.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Tax rate not found" });
    }
  });

  // GET /api/config/membership-year
  router.get("/config/membership-year", (_req: Request, res: Response) => {
    res.json({ membershipYear: activeMembershipYear });
  });

  // PUT /api/config/membership-year
  router.put("/config/membership-year", async (req: Request, res: Response) => {
    const { membershipYear } = req.body as { membershipYear?: number };
    if (typeof membershipYear === "number" && membershipYear >= 2020 && membershipYear <= 2030) {
      activeMembershipYear = Math.floor(membershipYear);
      await prisma.config.upsert({
        where: { key: "membershipYear" },
        create: { key: "membershipYear", value: activeMembershipYear },
        update: { value: activeMembershipYear }
      });
    }
    res.json({ membershipYear: activeMembershipYear });
  });

  // GET /api/config/tip-percentages
  router.get("/config/tip-percentages", (_req: Request, res: Response) => {
    res.json({ suggestedTipPercents: [...suggestedTipPercents] });
  });

  // PUT /api/config/tip-percentages
  router.put("/config/tip-percentages", async (req: Request, res: Response) => {
    const { suggestedTipPercents: body } = req.body as { suggestedTipPercents?: number[] };
    if (!Array.isArray(body)) {
      return res.status(400).json({ error: "suggestedTipPercents must be an array of numbers" });
    }
    const parsed = body
      .map((n) => (typeof n === "number" ? n : parseFloat(String(n))))
      .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 100);
    suggestedTipPercents = [...new Set(parsed)].sort((a, b) => a - b);
    await prisma.config.upsert({
      where: { key: "suggestedTipPercents" },
      create: { key: "suggestedTipPercents", value: suggestedTipPercents },
      update: { value: suggestedTipPercents }
    });
    res.json({ suggestedTipPercents: [...suggestedTipPercents] });
  });

  // GET /api/config/fees
  router.get("/config/fees", requireDeveloper, (_req: Request, res: Response) => {
    res.json({
      developerFeePercent: feeConfig.developerFeePercent,
      developerConnectAccountId: feeConfig.developerConnectAccountId
    });
  });

  // PUT /api/config/fees
  router.put("/config/fees", requireDeveloper, async (req: Request, res: Response) => {
    const { developerFeePercent, developerConnectAccountId } = req.body;
    if (typeof developerFeePercent === "number" && developerFeePercent >= 0 && developerFeePercent <= 100) {
      feeConfig.developerFeePercent = Math.round(developerFeePercent * 10) / 10;
    }
    if (developerConnectAccountId !== undefined) {
      feeConfig.developerConnectAccountId =
        typeof developerConnectAccountId === "string" && developerConnectAccountId.trim()
          ? developerConnectAccountId.trim()
          : null;
    }
    await prisma.config.upsert({
      where: { key: "developerFees" },
      create: { key: "developerFees", value: feeConfig as unknown as object },
      update: { value: feeConfig as unknown as object }
    });
    res.json({
      developerFeePercent: feeConfig.developerFeePercent,
      developerConnectAccountId: feeConfig.developerConnectAccountId
    });
  });

  // GET /api/config/toast-promo-codes
  router.get("/config/toast-promo-codes", async (_req: Request, res: Response) => {
    res.json([]);
  });

  router.post("/config/toast-promo-codes", async (req: Request, res: Response) => {
    const { clubId, promoCode, description, isActive } = req.body;
    res.status(201).json({
      id: "placeholder-id",
      clubId,
      promoCode,
      description,
      isActive
    });
  });
}
