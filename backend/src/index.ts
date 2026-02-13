import "dotenv/config";
import express, { type IRouter } from "express";
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
import { ensureDefaultClubs, fixClubDescriptionsNoCombination } from "./routes/clubs";
import { loadConfigFromDb, ensureDefaultTaxRates } from "./routes/config";

const app = express();

app.use(helmet());
app.use(cors());
// Stripe webhook needs raw body for signature verification; register before json parser
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);
app.use(express.json());

// Single API router mounted at /api so path matching is consistent (req.path is relative inside router)
const apiRouter: IRouter = express.Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Public routes and admin gate: paths here are relative to /api (e.g. /auth/login, /register)
apiRouter.use((req, res, next) => {
  if (isPublicApiRoute(req.method, req.path)) return next();
  requireAdmin(req, res, next);
});

registerAuthRoutes(apiRouter);
registerClubRoutes(apiRouter);
registerProductRoutes(apiRouter);
registerMemberRoutes(apiRouter);
registerMembershipRoutes(apiRouter);
registerConfigRoutes(apiRouter);
registerAllocationRoutes(apiRouter);
registerCartRoutes(apiRouter);
registerCheckoutRoutes(apiRouter);
registerUserRoutes(apiRouter);
registerUserMembershipRoutes(apiRouter);
registerTipRoutes(apiRouter);
registerNotificationRoutes(apiRouter);
registerPickupRoutes(apiRouter, app);
registerReportRoutes(apiRouter);

// 404 for /api/* so we can see what path was received (helps debug proxy/404 issues)
apiRouter.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    method: req.method,
    path: req.path,
    url: req.originalUrl
  });
});

app.use("/api", apiRouter);

const port = process.env.PORT || 4000;
ensureDevUser()
  .then(() => ensureDefaultClubs().then(() => {}))
  .then(() => fixClubDescriptionsNoCombination())
  .then(() => ensureDefaultTaxRates())
  .then(() => loadConfigFromDb())
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

