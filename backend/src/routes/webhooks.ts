import { Request, Response } from "express";
import Stripe from "stripe";
import { getStripeSecretKey, getStripeWebhookSecret } from "./config";
import { addTipCents } from "./tips";
import { addSalesTaxRecord } from "../stores/salesTaxRecords";
import { addEntitlements } from "../stores/entitlements";
import { getProductById, incrementOrderedNotPickedUp } from "./products";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const secret = getStripeWebhookSecret();
  const key = getStripeSecretKey();
  if (!secret || !key) {
    res.status(400).send("Webhook or Stripe not configured");
    return;
  }
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const tipCents = parseInt(pi.metadata?.tipCents || "0", 10);
    if (tipCents > 0) await addTipCents(tipCents);
    const taxBreakdownRaw = pi.metadata?.taxBreakdown;
    if (taxBreakdownRaw && typeof taxBreakdownRaw === "string") {
      try {
        const taxBreakdown = JSON.parse(taxBreakdownRaw) as Record<string, number>;
        const date = new Date((pi.created ?? 0) * 1000).toISOString().slice(0, 10);
        addSalesTaxRecord({
          date,
          paymentIntentId: pi.id,
          taxBreakdown: typeof taxBreakdown === "object" && taxBreakdown !== null ? taxBreakdown : {}
        });
      } catch {
        // ignore invalid tax breakdown
      }
    }
    const memberId = pi.metadata?.memberId?.trim();
    const cartItemsRaw = pi.metadata?.cartItems;
    if (memberId && cartItemsRaw && typeof cartItemsRaw === "string") {
      try {
        const cartItems = JSON.parse(cartItemsRaw) as { productId: string; quantity: number }[];
        if (Array.isArray(cartItems)) {
          const entries: { userId: string; productId: string; quantity: number; status: "NOT_READY" | "READY_FOR_PICKUP"; source: "PREORDER" | "ORDER"; releaseAt: string | null; pickedUpAt: null }[] = [];
          for (const item of cartItems) {
            if (!item?.productId || typeof item.quantity !== "number" || item.quantity < 1) continue;
            const product = await getProductById(item.productId);
            if (!product) continue;
            const qty = Math.floor(item.quantity);
            if (product.isPreorder) {
              entries.push({
                userId: memberId,
                productId: product.id,
                quantity: qty,
                status: "NOT_READY",
                source: "PREORDER",
                releaseAt: product.releaseAt ?? null,
                pickedUpAt: null
              });
            } else {
              entries.push({
                userId: memberId,
                productId: product.id,
                quantity: qty,
                status: "READY_FOR_PICKUP",
                source: "ORDER",
                releaseAt: null,
                pickedUpAt: null
              });
            }
          }
          if (entries.length > 0) {
            addEntitlements(entries);
            for (const e of entries) {
              await incrementOrderedNotPickedUp(e.productId, e.quantity);
            }
          }
        }
      } catch {
        // ignore invalid cartItems
      }
    }
  }
  res.json({ received: true });
}
