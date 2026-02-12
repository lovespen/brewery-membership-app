import { Express, Request, Response } from "express";
import {
  getAllEntitlements,
  getEntitlementById,
  markEntitlementPickedUp,
  markEntitlementNotPickedUp,
  promotePreordersToReady
} from "../stores/entitlements";
import { getProductById } from "./products";
import { getMemberById } from "./members";
import { getUserById } from "./users";

type PickupRow = {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  status: "READY_FOR_PICKUP" | "PICKED_UP";
  source: string;
  releaseAt: string | null;
  pickedUpAt: string | null;
  memberName: string | null;
  memberEmail: string | null;
};

function resolveDisplayName(userId: string): { name: string | null; email: string | null } {
  const member = getMemberById(userId);
  if (member) return { name: member.name ?? null, email: member.email ?? null };
  const user = getUserById(userId);
  if (user) return { name: user.name ?? null, email: user.email ?? null };
  return { name: null, email: null };
}

export function registerPickupRoutes(app: Express) {
  // GET /api/pickups - list entitlements ready for pickup or already picked up (for admin)
  app.get("/api/pickups", (_req: Request, res: Response) => {
    promotePreordersToReady();
    const all = getAllEntitlements();
    const relevant = all.filter(
      (e) => e.status === "READY_FOR_PICKUP" || e.status === "PICKED_UP"
    );
    const rows: PickupRow[] = relevant.map((e) => {
      const { name, email } = resolveDisplayName(e.userId);
      const product = getProductById(e.productId);
      return {
        id: e.id,
        userId: e.userId,
        productId: e.productId,
        productName: product?.name ?? e.productId,
        quantity: e.quantity,
        status: e.status as "READY_FOR_PICKUP" | "PICKED_UP",
        source: e.source,
        releaseAt: e.releaseAt,
        pickedUpAt: e.pickedUpAt,
        memberName: name,
        memberEmail: email
      };
    });
    res.json({ pickups: rows });
  });

  // GET /api/pickups/by-member/:memberId - pickups for one member (for staff scan page)
  app.get("/api/pickups/by-member/:memberId", (req: Request, res: Response) => {
    promotePreordersToReady();
    const { memberId } = req.params;
    const memberRecord = getMemberById(memberId) ?? getUserById(memberId);
    if (!memberRecord) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const member = { id: memberRecord.id, name: memberRecord.name ?? null, email: memberRecord.email ?? null };
    const all = getAllEntitlements();
    const forMember = all.filter(
      (e) => e.userId === memberId && (e.status === "READY_FOR_PICKUP" || e.status === "PICKED_UP")
    );
    const pickups = forMember.map((e) => {
      const product = getProductById(e.productId);
      return {
        id: e.id,
        productId: e.productId,
        productName: product?.name ?? e.productId,
        quantity: e.quantity,
        status: e.status,
        pickedUpAt: e.pickedUpAt
      };
    });
    res.json({
      member,
      pickups
    });
  });

  // PATCH /api/pickups/:id - mark as picked up or not (body: { pickedUp: boolean })
  app.patch("/api/pickups/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const { pickedUp } = req.body as { pickedUp?: boolean };
    const ent = getEntitlementById(id);
    if (!ent) {
      res.status(404).json({ error: "Entitlement not found" });
      return;
    }
    if (ent.status !== "READY_FOR_PICKUP" && ent.status !== "PICKED_UP") {
      res.status(400).json({ error: "Entitlement cannot be toggled" });
      return;
    }
    if (pickedUp === true) {
      if (markEntitlementPickedUp(id)) {
        res.json({ id, pickedUp: true });
      } else {
        res.status(400).json({ error: "Already picked up or not ready" });
      }
      return;
    }
    if (pickedUp === false) {
      if (markEntitlementNotPickedUp(id)) {
        res.json({ id, pickedUp: false });
      } else {
        res.status(400).json({ error: "Not in picked-up state" });
      }
      return;
    }
    res.status(400).json({ error: "Body must include pickedUp: true or false" });
  });

  // GET /staff-pickup?memberId=... - standalone page for staff who scan member's QR
  app.get("/staff-pickup", (req: Request, res: Response) => {
    const memberId = (req.query.memberId as string) || "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Staff – Member Pickup</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; background: #0f0f14; color: #e8e8e8; min-height: 100vh; }
    h1 { font-size: 1.25rem; margin: 0 0 8px 0; }
    .sub { color: #888; font-size: 0.875rem; margin-bottom: 16px; }
    .card { background: #1a1a22; border: 1px solid #2a2a35; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #2a2a35; }
    .row:last-child { border-bottom: none; }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 6px; }
    .badge.ready { background: rgba(86, 119, 252, 0.25); color: #b8c8ff; }
    .badge.done { background: rgba(110, 200, 120, 0.2); color: #8be0a4; }
    button { padding: 6px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; }
    button.primary { background: #5677fc; color: #fff; }
    button.primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .error { color: #f28b82; }
    .empty { color: #888; }
  </style>
</head>
<body>
  <div id="root">
    <p class="empty">Loading…</p>
  </div>
  <script>
    (function() {
      var memberId = ${JSON.stringify(memberId)};
      var root = document.getElementById("root");

      function render(err, data) {
        if (err) {
          root.innerHTML = "<p class=\"error\">" + (err.message || "Something went wrong.") + "</p>";
          return;
        }
        if (!data) {
          root.innerHTML = "<p class=\"empty\">No member ID in URL. Use ?memberId=...</p>";
          return;
        }
        var m = data.member;
        var name = (m && (m.name || m.email)) ? (m.name || m.email) : ("Member " + (m && m.id ? m.id : ""));
        var html = "<h1>Pickups for " + escapeHtml(name) + "</h1><p class=\"sub\">Member ID: " + escapeHtml(memberId) + "</p>";
        if (!data.pickups || data.pickups.length === 0) {
          html += "<div class=\"card\"><p class=\"empty\">No items to pick up for this member.</p></div>";
        } else {
          data.pickups.forEach(function(p) {
            var isReady = p.status === "READY_FOR_PICKUP";
            var badge = isReady ? "<span class=\"badge ready\">Ready</span>" : "<span class=\"badge done\">Picked up</span>";
            var when = p.pickedUpAt ? " – " + new Date(p.pickedUpAt).toLocaleString() : "";
            html += "<div class=\"card\"><div class=\"row\"><div><strong>" + escapeHtml(p.productName) + "</strong> × " + p.quantity + "<br><span class=\"badge " + (isReady ? "ready" : "done") + "\">" + (isReady ? "Ready for pickup" : "Picked up" + when) + "</span></div>";
            if (isReady) {
              html += "<button class=\"primary\" data-id=\"" + escapeHtml(p.id) + "\">Mark picked up</button>";
            }
            html += "</div></div></div>";
          });
        }
        root.innerHTML = html;
        root.querySelectorAll("button[data-id]").forEach(function(btn) {
          btn.addEventListener("click", function() {
            var id = btn.getAttribute("data-id");
            btn.disabled = true;
            fetch("/api/pickups/" + id, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pickedUp: true })
            }).then(function(r) {
              if (r.ok) load(); else return r.json().then(function(j) { throw new Error(j.error || "Failed"); });
            }).catch(function(e) {
              btn.disabled = false;
              alert(e.message || "Request failed");
            });
          });
        });
      }

      function escapeHtml(s) {
        if (s == null) return "";
        var div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
      }

      function load() {
        if (!memberId) {
          render(null, null);
          return;
        }
        fetch("/api/pickups/by-member/" + encodeURIComponent(memberId))
          .then(function(r) {
            if (!r.ok) throw new Error(r.status === 404 ? "Member not found" : "Request failed");
            return r.json();
          })
          .then(function(data) { render(null, data); })
          .catch(function(e) { render(e, null); });
      }

      load();
    })();
  </script>
</body>
</html>
    `);
  });
}
