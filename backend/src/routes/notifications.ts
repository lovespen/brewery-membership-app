import type { IRouter } from "express";
import { Request, Response } from "express";
import webpush from "web-push";
import { getClubCodes } from "./clubs";
import { prisma } from "../db";

type ClubCode = string;

export type PushNotification = {
  id: string;
  title: string;
  body: string;
  clubCodes: ClubCode[];
  status: "scheduled" | "sent";
  scheduledFor: string | null;
  sentAt: string | null;
};

type PushSubscriptionRecord = {
  endpoint: string;
  keys: { auth: string; p256dh: string };
  clubCodes: ClubCode[];
};

let vapidPublicKey!: string;
let vapidPrivateKey!: string;

function initVapid(): void {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    vapidPublicKey = pub;
    vapidPrivateKey = priv;
    return;
  }
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  // eslint-disable-next-line no-console
  console.warn(
    "VAPID keys not set (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Using generated keys; push subscriptions will break on restart."
  );
}

initVapid();
webpush.setVapidDetails(
  "mailto:admin@brewery.local",
  vapidPublicKey,
  vapidPrivateKey
);

async function getSubscriptionsFromDb(): Promise<PushSubscriptionRecord[]> {
  const list = await prisma.pushSubscription.findMany();
  return list.map((s) => ({
    endpoint: s.endpoint,
    keys: { auth: s.keysAuth, p256dh: s.keysP256dh },
    clubCodes: (s.clubCodes as string[]) || []
  }));
}

async function deleteSubscriptionsByEndpoints(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: endpoints } } });
}

async function deliverNotification(
  notification: PushNotification,
  targets: PushSubscriptionRecord[]
): Promise<{ sentTo: number; failed: number; failedEndpoints: string[] }> {
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    id: notification.id
  });
  const failedEndpoints: string[] = [];
  for (const sub of targets) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { auth: sub.keys.auth, p256dh: sub.keys.p256dh }
        },
        payload,
        { TTL: 86400 }
      );
    } catch (err: unknown) {
      const status = err && typeof (err as { statusCode?: number }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 0;
      if (status === 410 || status === 404) {
        failedEndpoints.push(sub.endpoint);
      }
    }
  }
  await deleteSubscriptionsByEndpoints(failedEndpoints);
  return { sentTo: targets.length, failed: failedEndpoints.length, failedEndpoints };
}

async function runScheduledCheck(): Promise<void> {
  const now = new Date();
  const due = await prisma.pushNotification.findMany({
    where: { status: "scheduled", scheduledFor: { lte: now } }
  });
  const subs = await getSubscriptionsFromDb();
  for (const n of due) {
    const clubCodes = (n.clubCodes as string[]) || [];
    const targets = subs.filter((sub) =>
      (sub.clubCodes as string[]).some((c: string) => clubCodes.includes(c))
    );
    await deliverNotification(
      {
        id: n.id,
        title: n.title,
        body: n.body,
        clubCodes,
        status: "sent",
        scheduledFor: n.scheduledFor?.toISOString() ?? null,
        sentAt: new Date().toISOString()
      },
      targets
    );
    await prisma.pushNotification.update({
      where: { id: n.id },
      data: { status: "sent", sentAt: new Date() }
    });
  }
}

const SCHEDULE_CHECK_MS = 60 * 1000;
let scheduleInterval: ReturnType<typeof setInterval> | null = null;

function toNotificationPayload(n: { id: string; title: string; body: string; clubCodes: unknown; status: string; scheduledFor: Date | null; sentAt: Date | null }): PushNotification {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    clubCodes: (n.clubCodes as ClubCode[]) || [],
    status: n.status as "scheduled" | "sent",
    scheduledFor: n.scheduledFor?.toISOString() ?? null,
    sentAt: n.sentAt?.toISOString() ?? null
  };
}

export function registerNotificationRoutes(router: IRouter) {
  if (!scheduleInterval) {
    scheduleInterval = setInterval(() => void runScheduledCheck(), SCHEDULE_CHECK_MS);
  }
  router.get("/push/vapid-public-key", (_req: Request, res: Response) => {
    res.json({ publicKey: vapidPublicKey });
  });

  router.post("/push-subscriptions", async (req: Request, res: Response) => {
    const { subscription, clubCodes: clubCodesBody } = req.body;

    if (!subscription || typeof subscription !== "object" || !subscription.endpoint) {
      return res.status(400).json({ error: "subscription with endpoint is required" });
    }

    const keys = subscription.keys;
    if (!keys || typeof keys.auth !== "string" || typeof keys.p256dh !== "string") {
      return res.status(400).json({ error: "subscription.keys.auth and keys.p256dh are required" });
    }

    const validCodes = await getClubCodes();
    const clubCodes: ClubCode[] = Array.isArray(clubCodesBody)
      ? (clubCodesBody
          .map((c: string) => (c || "").toString().trim().toUpperCase())
          .filter((c: string) => validCodes.includes(c)))
      : [];

    if (clubCodes.length === 0) {
      return res.status(400).json({
        error: validCodes.length > 0
          ? `At least one club code required (from admin-defined clubs: ${validCodes.join(", ")})`
          : "No clubs defined. Create clubs in admin first."
      });
    }

    const endpoint = subscription.endpoint as string;
    const existing = await prisma.pushSubscription.findFirst({ where: { endpoint } });
    if (existing) {
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { keysAuth: keys.auth, keysP256dh: keys.p256dh, clubCodes: clubCodes as unknown as object }
      });
    } else {
      await prisma.pushSubscription.create({
        data: {
          endpoint,
          keysAuth: keys.auth,
          keysP256dh: keys.p256dh,
          clubCodes: clubCodes as unknown as object
        }
      });
    }

    res.status(201).json({ ok: true });
  });

  router.get("/notifications", async (_req: Request, res: Response) => {
    const list = await prisma.pushNotification.findMany({
      orderBy: [{ status: "asc" }, { scheduledFor: "desc" }, { sentAt: "desc" }]
    });
    const sorted = list.slice().sort((a, b) => {
      const aTime = a.status === "scheduled" && a.scheduledFor
        ? a.scheduledFor.getTime()
        : (a.sentAt?.getTime() ?? 0);
      const bTime = b.status === "scheduled" && b.scheduledFor
        ? b.scheduledFor.getTime()
        : (b.sentAt?.getTime() ?? 0);
      return bTime - aTime;
    });
    res.json(sorted.map(toNotificationPayload));
  });

  router.delete("/notifications/:id", async (req: Request, res: Response) => {
    const n = await prisma.pushNotification.findUnique({ where: { id: req.params.id } });
    if (!n) {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (n.status !== "scheduled") {
      return res.status(400).json({ error: "Only scheduled notifications can be cancelled" });
    }
    await prisma.pushNotification.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  router.post("/notifications", async (req: Request, res: Response) => {
    const { title, body, clubCodes: clubCodesBody, scheduledFor: scheduledForBody } = req.body;

    const titleStr = typeof title === "string" && title.trim() ? title.trim() : "";
    if (!titleStr) {
      return res.status(400).json({ error: "title is required" });
    }

    const bodyStr = typeof body === "string" ? body : "";

    const validCodesNotif = await getClubCodes();
    const clubCodes: ClubCode[] = Array.isArray(clubCodesBody)
      ? (clubCodesBody
          .map((c: string) => (c || "").toString().trim().toUpperCase())
          .filter((c: string) => validCodesNotif.includes(c)))
      : [];

    if (clubCodes.length === 0) {
      return res.status(400).json({
        error: validCodesNotif.length > 0
          ? `At least one club must be selected (from admin-defined clubs: ${validCodesNotif.join(", ")})`
          : "No clubs defined. Create clubs in admin first."
      });
    }

    const scheduledForMs =
      typeof scheduledForBody === "string" && scheduledForBody.trim()
        ? new Date(scheduledForBody.trim()).getTime()
        : NaN;
    const isScheduled = !Number.isNaN(scheduledForMs) && scheduledForMs > Date.now();

    const created = await prisma.pushNotification.create({
      data: {
        title: titleStr,
        body: bodyStr,
        clubCodes: clubCodes as unknown as object,
        status: isScheduled ? "scheduled" : "sent",
        scheduledFor: isScheduled ? new Date(scheduledForMs) : null,
        sentAt: isScheduled ? null : new Date()
      }
    });

    const notification = toNotificationPayload(created);

    if (isScheduled) {
      return res.status(201).json({
        ...notification,
        message: "Notification scheduled"
      });
    }

    const subs = await getSubscriptionsFromDb();
    const targets = subs.filter((sub) =>
      (sub.clubCodes as string[]).some((c: string) => clubCodes.includes(c))
    );
    const result = await deliverNotification(notification, targets);

    res.status(201).json({
      ...notification,
      sentTo: result.sentTo,
      failed: result.failed
    });
  });
}
