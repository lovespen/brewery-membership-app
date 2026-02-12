import { Express, Request, Response } from "express";
import Stripe from "stripe";
import type { ClubCode } from "./products";
import { getClubCodes } from "./clubs";
import { getProductById, getProductPriceCents, isWithinPreorderWindow } from "./products";
import { getMembershipById } from "./memberships";
import { getTaxRateById } from "./config";
import {
  getStripeSecretKey,
  getStripePublishableKey,
  getStripeAchDefaultThresholdCents
} from "./config";

function computeCartTotal(
  cartItems: { productId: string; quantity: number }[],
  memberClubCode?: ClubCode
): { subtotalCents: number; taxCents: number; totalCents: number; taxByRateId: Record<string, number> } {
  let subtotalCents = 0;
  const taxByRateId: Record<string, number> = {};
  for (const { productId, quantity } of cartItems) {
    const product = getProductById(productId);
    const price = getProductPriceCents(productId, memberClubCode);
    if (!product || price === null || quantity <= 0) continue;
    const lineTotal = price * quantity;
    subtotalCents += lineTotal;
    if (product.taxRateId) {
      const rate = getTaxRateById(product.taxRateId);
      if (rate) {
        const lineTax = Math.round((lineTotal * rate.ratePercent) / 100);
        taxByRateId[product.taxRateId] = (taxByRateId[product.taxRateId] ?? 0) + lineTax;
      }
    }
  }
  const taxCents = Object.values(taxByRateId).reduce((a, b) => a + b, 0);
  return {
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    taxByRateId
  };
}

export function registerCheckoutRoutes(app: Express) {
  // POST /api/checkout/create-payment-intent
  // Body: { cartSessionId?, items: { productId, quantity }[], membershipId?, memberClubCode? }
  app.post("/api/checkout/create-payment-intent", async (req: Request, res: Response) => {
    const secretKey = getStripeSecretKey();
    const publishableKey = getStripePublishableKey();
    if (!secretKey || !publishableKey) {
      return res.status(503).json({
        error: "Stripe is not configured. Add your keys in Settings → Stripe integration."
      });
    }

    const { items: cartItems = [], membershipId, memberClubCode, memberId: bodyMemberId, tipCents: tipCentsBody } = req.body;
    const tipCents = typeof tipCentsBody === "number" && tipCentsBody >= 0 ? Math.floor(tipCentsBody) : 0;
    const memberId = typeof bodyMemberId === "string" && bodyMemberId.trim() !== "" ? bodyMemberId.trim() : null;
    const clubCode = typeof memberClubCode === "string"
      ? (memberClubCode.toUpperCase() as ClubCode)
      : undefined;
    const validClubCodes = getClubCodes();
    if (clubCode && !validClubCodes.includes(clubCode)) {
      return res.status(400).json({
        error: validClubCodes.length > 0
          ? `memberClubCode must be one of: ${validClubCodes.join(", ")} (from admin-defined clubs)`
          : "No clubs defined."
      });
    }

    const validItems = Array.isArray(cartItems)
      ? cartItems.filter(
          (i: unknown) =>
            i &&
            typeof (i as any).productId === "string" &&
            typeof (i as any).quantity === "number"
        )
      : [];

    // Preorder products must be within their purchase window
    for (const item of validItems) {
      const product = getProductById((item as { productId: string }).productId);
      if (product?.isPreorder && !isWithinPreorderWindow(product)) {
        return res.status(400).json({
          error: "One or more preorder items are outside the purchase window",
          productId: (item as { productId: string }).productId
        });
      }
    }

    let subtotalCents = 0;
    let taxCents = 0;

    const cartTotal = computeCartTotal(
      validItems.map((i: { productId: string; quantity: number }) => ({
        productId: i.productId,
        quantity: i.quantity
      })),
      clubCode
    );
    subtotalCents += cartTotal.subtotalCents;
    taxCents += cartTotal.taxCents;
    const taxByRateId = cartTotal.taxByRateId || {};

    let membershipCents = 0;
    if (membershipId && typeof membershipId === "string") {
      const offering = getMembershipById(membershipId);
      if (!offering || !offering.isActive) {
        return res.status(400).json({ error: "Invalid or inactive membership" });
      }
      membershipCents = offering.priceCents;
    }

    const totalCents = subtotalCents + taxCents + membershipCents + tipCents;
    if (totalCents < 50) {
      return res.status(400).json({
        error: "Minimum charge is $0.50",
        totalCents
      });
    }

    const stripe = new Stripe(secretKey);
    const achThreshold = getStripeAchDefaultThresholdCents();
    const defaultPaymentMethod =
      achThreshold > 0 && totalCents >= achThreshold ? "us_bank_account" : "card";

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          membershipId: membershipId || "",
          memberId: memberId || "",
          cartItems: JSON.stringify(validItems.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity }))),
          itemCount: String(validItems.length),
          tipCents: String(tipCents),
          taxBreakdown: JSON.stringify(taxByRateId),
          subtotalCents: String(subtotalCents)
        }
      });

      return res.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey,
        amountCents: totalCents,
        defaultPaymentMethod
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stripe error";
      return res.status(502).json({ error: message });
    }
  });
}
