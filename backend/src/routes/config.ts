import type { IRouter } from "express";
import { Request, Response } from "express";

export type TaxRate = {
  id: string;
  name: string;
  ratePercent: number;
};

const taxRates: TaxRate[] = [
  { id: "tax_default", name: "Standard", ratePercent: 8.25 },
  { id: "tax_zero", name: "Tax exempt", ratePercent: 0 }
];

function nextTaxId() {
  return `tax_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getTaxRateById(id: string): TaxRate | undefined {
  return taxRates.find((t) => t.id === id);
}

/** Stripe integration config (admin + developer). Secret key never returned in GET. */
type StripeConfig = {
  enabled: boolean;
  publishableKey: string | null;
  /** Stored for server use; never sent to client in GET */
  secretKey: string | null;
  webhookSecret: string | null;
  /** Use ACH as default payment method when amount is over this (cents). 0 = off. */
  achDefaultThresholdCents: number;
};

const stripeConfig: StripeConfig = {
  enabled: false,
  publishableKey: null,
  secretKey: null,
  webhookSecret: null,
  achDefaultThresholdCents: 5000
};

/** For payment/checkout: use ACH as default when amount (cents) >= this. 0 = disabled. */
export function getStripeAchDefaultThresholdCents(): number {
  return stripeConfig.achDefaultThresholdCents;
}

/** Server-side only: Stripe secret key for creating PaymentIntents. */
export function getStripeSecretKey(): string | null {
  return stripeConfig.secretKey;
}

export function getStripePublishableKey(): string | null {
  return stripeConfig.publishableKey;
}

/** Server-side only: Stripe webhook signing secret for verifying events. */
export function getStripeWebhookSecret(): string | null {
  return stripeConfig.webhookSecret;
}

/** Active membership year: only members with user-membership for this year receive products/notifications. */
let activeMembershipYear = (() => {
  const env = process.env.MEMBERSHIP_YEAR;
  if (typeof env !== "string" || !env.trim()) return 2026;
  const n = parseInt(env.trim(), 10);
  return !Number.isNaN(n) && n >= 2020 && n <= 2030 ? n : 2026;
})();

export function getActiveMembershipYear(): number {
  return activeMembershipYear;
}

export function registerConfigRoutes(router: IRouter) {
  // GET /api/config/stripe - Stripe integration settings (admin + developer). Never returns secret key.
  router.get("/config/stripe", (_req: Request, res: Response) => {
    res.json({
      enabled: stripeConfig.enabled,
      publishableKey: stripeConfig.publishableKey,
      secretKeyConfigured: !!stripeConfig.secretKey,
      webhookSecretConfigured: !!stripeConfig.webhookSecret,
      achDefaultThresholdCents: stripeConfig.achDefaultThresholdCents
    });
  });

  // PUT /api/config/stripe - update Stripe integration (admin + developer)
  router.put("/config/stripe", (req: Request, res: Response) => {
    const { enabled, publishableKey, secretKey, webhookSecret, achDefaultThresholdCents } = req.body;
    if (typeof enabled === "boolean") stripeConfig.enabled = enabled;
    if (typeof publishableKey === "string") {
      stripeConfig.publishableKey = publishableKey.trim() || null;
    }
    if (typeof secretKey === "string") {
      const v = secretKey.trim();
      stripeConfig.secretKey = v === "" ? null : v;
    }
    if (typeof webhookSecret === "string") {
      const v = webhookSecret.trim();
      stripeConfig.webhookSecret = v === "" ? null : v;
    }
    if (typeof achDefaultThresholdCents === "number" && achDefaultThresholdCents >= 0) {
      stripeConfig.achDefaultThresholdCents = Math.floor(achDefaultThresholdCents);
    }
    res.json({
      enabled: stripeConfig.enabled,
      publishableKey: stripeConfig.publishableKey,
      secretKeyConfigured: !!stripeConfig.secretKey,
      webhookSecretConfigured: !!stripeConfig.webhookSecret,
      achDefaultThresholdCents: stripeConfig.achDefaultThresholdCents
    });
  });

  // GET /api/config/tax-rates - list tax rates (admin + developer)
  router.get("/config/tax-rates", (_req: Request, res: Response) => {
    res.json([...taxRates]);
  });

  // POST /api/config/tax-rates - add tax rate (admin + developer)
  router.post("/config/tax-rates", (req: Request, res: Response) => {
    const { name, ratePercent } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "name is required" });
    }
    const rate = typeof ratePercent === "number" ? ratePercent : parseFloat(String(ratePercent));
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ error: "ratePercent must be a number between 0 and 100" });
    }
    const tax: TaxRate = {
      id: nextTaxId(),
      name: name.trim(),
      ratePercent: Math.round(rate * 100) / 100
    };
    taxRates.push(tax);
    res.status(201).json(tax);
  });

  // DELETE /api/config/tax-rates/:id - remove tax rate (admin + developer)
  router.delete("/config/tax-rates/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = taxRates.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Tax rate not found" });
    }
    taxRates.splice(idx, 1);
    res.status(204).send();
  });

  router.get("/config/membership-year", (_req: Request, res: Response) => {
    res.json({ membershipYear: activeMembershipYear });
  });

  router.put("/config/membership-year", (req: Request, res: Response) => {
    const { membershipYear } = req.body as { membershipYear?: number };
    if (typeof membershipYear === "number" && membershipYear >= 2020 && membershipYear <= 2030) {
      activeMembershipYear = Math.floor(membershipYear);
    }
    res.json({ membershipYear: activeMembershipYear });
  });

  // Suggested tip percentages shown in checkout (e.g. [0, 10, 15, 20, 25])
  let suggestedTipPercents: number[] = [0, 10, 15, 20, 25];

  router.get("/config/tip-percentages", (_req: Request, res: Response) => {
    res.json({ suggestedTipPercents: [...suggestedTipPercents] });
  });

  router.put("/config/tip-percentages", (req: Request, res: Response) => {
    const { suggestedTipPercents: body } = req.body as { suggestedTipPercents?: number[] };
    if (!Array.isArray(body)) {
      return res.status(400).json({ error: "suggestedTipPercents must be an array of numbers" });
    }
    const parsed = body
      .map((n) => (typeof n === "number" ? n : parseFloat(String(n))))
      .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 100);
    suggestedTipPercents = [...new Set(parsed)].sort((a, b) => a - b);
    res.json({ suggestedTipPercents: [...suggestedTipPercents] });
  });

  // Developer fee: percentage of in-app sales routed to the developer's separate account
  type FeeConfig = {
    developerFeePercent: number;
    developerConnectAccountId: string | null;
  };
  const feeConfig: FeeConfig = {
    developerFeePercent: 0,
    developerConnectAccountId: null
  };

  // GET /api/config/fees - current developer fee configuration (developer only / own account)
  router.get("/config/fees", (_req: Request, res: Response) => {
    res.json({
      developerFeePercent: feeConfig.developerFeePercent,
      developerConnectAccountId: feeConfig.developerConnectAccountId
    });
  });

  // PUT /api/config/fees - update developer fee (developer only; sets % and account to receive it)
  router.put("/config/fees", (req: Request, res: Response) => {
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
    res.json({
      developerFeePercent: feeConfig.developerFeePercent,
      developerConnectAccountId: feeConfig.developerConnectAccountId
    });
  });

  // GET /api/config/toast-promo-codes - club → promo-code mappings
  router.get(
    "/config/toast-promo-codes",
    async (_req: Request, res: Response) => {
      // TODO: fetch from toast_club_promo_codes table
      res.json([]);
    }
  );

  // POST /api/config/toast-promo-codes - create/update promo-code mapping (admin)
  router.post(
    "/config/toast-promo-codes",
    async (req: Request, res: Response) => {
      const { clubId, promoCode, description, isActive } = req.body;
      // TODO: validate and upsert promo-code mapping
      res.status(201).json({
        id: "placeholder-id",
        clubId,
        promoCode,
        description,
        isActive
      });
    }
  );
}

