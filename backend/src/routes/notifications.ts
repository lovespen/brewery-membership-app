import type { IRouter } from "express";
import { Request, Response } from "express";
import webpush from "web-push";
import { getClubCodes } from "./clubs";

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

const notifications: PushNotification[] = [];
const pushSubscriptions: PushSubscriptionRecord[] = [];

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

function nextId() {
  return `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function deliverNotification(
  notification: PushNotification,
  targets: PushSubscriptionRecord[]
): Promise<{ sentTo: number; failed: number }> {
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
  for (const ep of failedEndpoints) {
    const idx = pushSubscriptions.findIndex((s) => s.endpoint === ep);
    if (idx >= 0) pushSubscriptions.splice(idx, 1);
  }
  return { sentTo: targets.length, failed: failedEndpoints.length };
}

function runScheduledCheck() {
  const now = Date.now();
  for (const n of notifications) {
    if (n.status !== "scheduled" || !n.scheduledFor) continue;
    if (new Date(n.scheduledFor).getTime() > now) continue;
    const targets = pushSubscriptions.filter((sub) =>
      sub.clubCodes.some((c) => n.clubCodes.includes(c))
    );
    deliverNotification(n, targets).then(() => {
      n.status = "sent";
      n.sentAt = new Date().toISOString();
    });
  }
}

const SCHEDULE_CHECK_MS = 60 * 1000;
let scheduleInterval: ReturnType<typeof setInterval> | null = null;

export function registerNotificationRoutes(router: IRouter) {
  if (!scheduleInterval) {
    scheduleInterval = setInterval(runScheduledCheck, SCHEDULE_CHECK_MS);
  }
  // GET /api/push/vapid-public-key - client uses this to subscribe
  router.get("/push/vapid-public-key", (_req: Request, res: Response) => {
    res.json({ publicKey: vapidPublicKey });
  });

  // POST /api/push-subscriptions - register a push subscription (from member app)
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

    const record: PushSubscriptionRecord = {
      endpoint: subscription.endpoint,
      keys: { auth: keys.auth, p256dh: keys.p256dh },
      clubCodes
    };

    const existing = pushSubscriptions.findIndex((s) => s.endpoint === record.endpoint);
    if (existing >= 0) {
      pushSubscriptions[existing] = record;
    } else {
      pushSubscriptions.push(record);
    }

    res.status(201).json({ ok: true });
  });

  // GET /api/notifications - list notifications (sent and scheduled)
  router.get("/notifications", (_req: Request, res: Response) => {
    res.json(
      [...notifications].sort((a, b) => {
        const aTime = a.status === "scheduled" && a.scheduledFor
          ? new Date(a.scheduledFor).getTime()
          : new Date(a.sentAt || 0).getTime();
        const bTime = b.status === "scheduled" && b.scheduledFor
          ? new Date(b.scheduledFor).getTime()
          : new Date(b.sentAt || 0).getTime();
        return bTime - aTime;
      })
    );
  });

  // DELETE /api/notifications/:id - cancel a scheduled notification
  router.delete("/notifications/:id", (req: Request, res: Response) => {
    const n = notifications.find((x) => x.id === req.params.id);
    if (!n) {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (n.status !== "scheduled") {
      return res.status(400).json({ error: "Only scheduled notifications can be cancelled" });
    }
    const idx = notifications.indexOf(n);
    notifications.splice(idx, 1);
    res.status(204).send();
  });

  // POST /api/notifications - create/send now or schedule a push notification
  router.post("/notifications", async (req: Request, res: Response) => {
    const { title, body, clubCodes: clubCodesBody, scheduledFor: scheduledForBody } = req.body;

    const titleStr =
      typeof title === "string" && title.trim() ? title.trim() : "";
    if (!titleStr) {
      return res.status(400).json({ error: "title is required" });
    }

    const bodyStr =
      typeof body === "string" ? body : "";

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

    const notification: PushNotification = {
      id: nextId(),
      title: titleStr,
      body: bodyStr,
      clubCodes,
      status: isScheduled ? "scheduled" : "sent",
      scheduledFor: isScheduled ? new Date(scheduledForMs).toISOString() : null,
      sentAt: isScheduled ? null : new Date().toISOString()
    };

    notifications.push(notification);

    if (isScheduled) {
      return res.status(201).json({
        ...notification,
        message: "Notification scheduled"
      });
    }

    const targets = pushSubscriptions.filter((sub) =>
      sub.clubCodes.some((c) => clubCodes.includes(c))
    );
    const result = await deliverNotification(notification, targets);

    res.status(201).json({
      ...notification,
      sentTo: result.sentTo,
      failed: result.failed
    });
  });
}
