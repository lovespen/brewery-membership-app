import type { IRouter } from "express";
import { Request, Response } from "express";
import { prisma } from "../db";

export type TipWithdrawal = {
  id: string;
  amountCents: number;
  withdrawnAt: string;
  note: string | null;
};

const CONFIG_KEY_TIPS_BALANCE = "tipsAvailableCents";

async function getBalance(): Promise<number> {
  const row = await prisma.config.findUnique({ where: { key: CONFIG_KEY_TIPS_BALANCE } });
  if (!row || typeof (row.value as number) !== "number") return 0;
  return Math.max(0, Math.floor((row.value as number)));
}

/** Add tip amount to the pool (e.g. from webhook when payment succeeds). */
export async function addTipCents(amountCents: number): Promise<void> {
  if (typeof amountCents !== "number" || amountCents <= 0) return;
  const add = Math.floor(amountCents);
  const current = await getBalance();
  await prisma.config.upsert({
    where: { key: CONFIG_KEY_TIPS_BALANCE },
    create: { key: CONFIG_KEY_TIPS_BALANCE, value: current + add },
    update: { value: current + add }
  });
}

export function getAvailableTipCents(): number {
  return 0;
}

export async function getAvailableTipCentsAsync(): Promise<number> {
  return getBalance();
}

export function registerTipRoutes(router: IRouter) {
  router.get("/tips", async (_req: Request, res: Response) => {
    const [availableCents, list] = await Promise.all([
      getBalance(),
      prisma.tipWithdrawal.findMany({ orderBy: { withdrawnAt: "desc" } })
    ]);
    const withdrawals: TipWithdrawal[] = list.map((w) => ({
      id: w.id,
      amountCents: w.amountCents,
      withdrawnAt: w.withdrawnAt.toISOString(),
      note: w.note
    }));
    res.json({ availableCents, withdrawals });
  });

  router.post("/tips/withdraw", async (req: Request, res: Response) => {
    const { amountCents, note } = req.body;
    const amount = typeof amountCents === "number" ? Math.floor(amountCents) : Math.floor(Number(amountCents) || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: "amountCents must be a positive number" });
    }
    const available = await getBalance();
    if (amount > available) {
      return res.status(400).json({
        error: "Insufficient tip balance",
        availableCents: available
      });
    }
    const noteStr = typeof note === "string" && note.trim() ? note.trim() : null;
    const [withdrawal] = await prisma.$transaction([
      prisma.tipWithdrawal.create({
        data: { amountCents: amount, note: noteStr }
      }),
      prisma.config.upsert({
        where: { key: CONFIG_KEY_TIPS_BALANCE },
        create: { key: CONFIG_KEY_TIPS_BALANCE, value: available - amount },
        update: { value: available - amount }
      })
    ]);
    res.status(201).json({
      withdrawal: {
        id: withdrawal.id,
        amountCents: withdrawal.amountCents,
        withdrawnAt: withdrawal.withdrawnAt.toISOString(),
        note: withdrawal.note
      },
      availableCents: available - amount
    });
  });
}
