import type { IRouter } from "express";
import { Request, Response } from "express";

let availableTipCents = 0;

export type TipWithdrawal = {
  id: string;
  amountCents: number;
  withdrawnAt: string;
  note: string | null;
};

const withdrawals: TipWithdrawal[] = [];

function nextId() {
  return `tw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Add tip amount to the pool (e.g. from webhook when payment succeeds). */
export function addTipCents(amountCents: number): void {
  if (typeof amountCents === "number" && amountCents > 0) {
    availableTipCents += Math.floor(amountCents);
  }
}

export function getAvailableTipCents(): number {
  return availableTipCents;
}

export function registerTipRoutes(router: IRouter) {
  // GET /api/tips - balance and withdrawal history (managers)
  router.get("/tips", (_req: Request, res: Response) => {
    res.json({
      availableCents: availableTipCents,
      withdrawals: [...withdrawals].sort(
        (a, b) => new Date(b.withdrawnAt).getTime() - new Date(a.withdrawnAt).getTime()
      )
    });
  });

  // POST /api/tips/withdraw - pull tips out (managers)
  router.post("/tips/withdraw", (req: Request, res: Response) => {
    const { amountCents, note } = req.body;
    const amount = typeof amountCents === "number" ? Math.floor(amountCents) : Math.floor(Number(amountCents) || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: "amountCents must be a positive number" });
    }
    if (amount > availableTipCents) {
      return res.status(400).json({
        error: "Insufficient tip balance",
        availableCents: availableTipCents
      });
    }
    availableTipCents -= amount;
    const record: TipWithdrawal = {
      id: nextId(),
      amountCents: amount,
      withdrawnAt: new Date().toISOString(),
      note: typeof note === "string" && note.trim() ? note.trim() : null
    };
    withdrawals.push(record);
    res.status(201).json({
      withdrawal: record,
      availableCents: availableTipCents
    });
  });
}
