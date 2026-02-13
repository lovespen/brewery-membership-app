import type { IRouter } from "express";
import { Request, Response } from "express";

type CartItem = { productId: string; quantity: number };

const carts = new Map<string, CartItem[]>();

function getSessionId(req: Request): string {
  const fromHeader = req.headers["x-cart-session"] as string | undefined;
  const fromQuery = req.query?.cartSessionId as string | undefined;
  const fromBody = (req.body && req.body.cartSessionId) as string | undefined;
  const id = (fromHeader || fromQuery || fromBody || "").trim();
  if (id) return id;
  return `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function registerCartRoutes(router: IRouter) {
  // GET /api/cart - get cart for session (optional X-Cart-Session header or ?cartSessionId=)
  router.get("/cart", (req: Request, res: Response) => {
    const sessionId = (req.query.cartSessionId as string) || getSessionId(req);
    if (!carts.has(sessionId)) {
      carts.set(sessionId, []);
    }
    const items = carts.get(sessionId)!;
    res.json({ cartSessionId: sessionId, items: [...items] });
  });

  // POST /api/cart/items - add or update item (body: cartSessionId?, productId, quantity)
  router.post("/cart/items", (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    const { productId, quantity } = req.body;
    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ error: "productId is required" });
    }
    const qty = Math.max(0, Math.min(99, Math.floor(Number(quantity) || 0)));
    if (!carts.has(sessionId)) carts.set(sessionId, []);
    const items = carts.get(sessionId)!;
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity = qty === 0 ? existing.quantity : qty;
      if (qty === 0) {
        items.splice(items.indexOf(existing), 1);
      }
    } else if (qty > 0) {
      items.push({ productId, quantity: qty });
    }
    res.json({ cartSessionId: sessionId, items: [...items] });
  });

  // DELETE /api/cart/items/:productId
  router.delete("/cart/items/:productId", (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    const { productId } = req.params;
    if (!carts.has(sessionId)) {
      return res.json({ cartSessionId: sessionId, items: [] });
    }
    const items = carts.get(sessionId)!;
    const idx = items.findIndex((i) => i.productId === productId);
    if (idx !== -1) items.splice(idx, 1);
    res.json({ cartSessionId: sessionId, items: [...items] });
  });

  // POST /api/cart/clear - clear cart
  router.post("/cart/clear", (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    carts.set(sessionId, []);
    res.json({ cartSessionId: sessionId, items: [] });
  });
}
