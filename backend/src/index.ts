import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { requireAdmin, isPublicApiRoute } from "./routes/auth";
import { registerProductRoutes } from "./routes/products";
import { registerClubRoutes } from "./routes/clubs";
import { registerMemberRoutes } from "./routes/members";
import { registerConfigRoutes } from "./routes/config";
import { registerMembershipRoutes } from "./routes/memberships";
import { registerAllocationRoutes } from "./routes/allocations";
import { registerCartRoutes } from "./routes/cart";
import { registerCheckoutRoutes } from "./routes/checkout";
import { registerUserRoutes } from "./routes/users";
import { registerUserMembershipRoutes } from "./routes/user-memberships";
import { registerAuthRoutes } from "./routes/auth";
import { registerTipRoutes } from "./routes/tips";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerPickupRoutes } from "./routes/pickups";
import { registerReportRoutes } from "./routes/reports";
import { handleStripeWebhook } from "./routes/webhooks";
import { ensureDevUser } from "./routes/users";

const app = express();

app.use(helmet());
app.use(cors());
// Stripe webhook needs raw body for signature verification; register before json parser
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Require admin (Bearer token with email in ADMIN_EMAILS) for all /api/* except public routes
app.use("/api", (req, res, next) => {
  if (isPublicApiRoute(req.method, req.path)) return next();
  requireAdmin(req, res, next);
});

registerClubRoutes(app);
registerProductRoutes(app);
registerMemberRoutes(app);
registerMembershipRoutes(app);
registerConfigRoutes(app);
registerAllocationRoutes(app);
registerCartRoutes(app);
registerCheckoutRoutes(app);
registerUserRoutes(app);
registerUserMembershipRoutes(app);
registerAuthRoutes(app);
registerTipRoutes(app);
registerNotificationRoutes(app);
registerPickupRoutes(app);
registerReportRoutes(app);

const port = process.env.PORT || 4000;
ensureDevUser()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to ensure dev user:", err);
    process.exit(1);
  });

