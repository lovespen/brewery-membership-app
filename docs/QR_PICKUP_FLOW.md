# QR code pickup flow

How the member’s “Show QR code for staff” works end to end.

---

## 1. Member shows the QR

- **Where:** Member app (web or mobile) → **Pickup items** section → **Show QR code for staff**.
- **What happens:**
  - The app builds a URL: **`{BACKEND_BASE}/staff-pickup?memberId={logged-in member’s user id}`**.
  - Backend base comes from:
    - **Web:** `VITE_STAFF_PICKUP_URL` or `VITE_API_BASE` (same as API), or `http://localhost:4000` in dev.
    - **Mobile:** `API_BASE` in config (same backend as API).
  - A QR code image is generated that encodes this URL (e.g. `https://your-backend.railway.app/staff-pickup?memberId=abc-123`).
- **Member:** Holds up the screen so staff can scan the QR.

---

## 2. Staff scans the QR

- Staff opens their phone camera or a QR scanner and scans the code.
- The scanner opens the encoded URL in the browser (e.g. `https://your-backend.railway.app/staff-pickup?memberId=abc-123`).

**If the link opened the member app by mistake** (e.g. member-app.vercel.app/staff-pickup?memberId=...):

- The member app detects path `/staff-pickup` and **redirects** to the backend URL above, so the staff device ends up on the correct page.

---

## 3. Backend serves the staff-pickup page

- **Route:** Backend **GET /staff-pickup** (main app, not under `/api`).
- **Query:** `memberId` (required).
- **Response:** HTML page that:
  - Shows “Loading…” at first.
  - Calls **GET /api/pickups/by-member/:memberId** (same origin, no auth).
  - Renders the member’s name and list of pickup items (ready + already picked up).
  - For each “Ready for pickup” item, shows a **Mark picked up** button.

---

## 4. Staff marks items picked up

- Staff taps **Mark picked up** for an item.
- The page sends **PATCH /api/pickups/:entitlementId** with `{ "pickedUp": true }` (no auth).
- Backend updates the entitlement to “Picked up” and returns success.
- The page reloads the list so the item moves to “Picked up” and the button disappears.

---

## 5. Public API routes used by the page

These are allowed without admin/login so the staff page works from a plain link:

- **GET /api/pickups/by-member/:memberId** – list pickups for that member.
- **PATCH /api/pickups/:id** – mark one entitlement as picked up (body: `{ pickedUp: true }`).

Defined in `backend/src/routes/auth.ts` → `isPublicApiRoute()`.

---

## Summary diagram

```
Member app                    Backend
    |                            |
    | 1. Generate QR URL         |
    |    (backend + /staff-pickup?memberId=...) |
    |                            |
    | 2. Member shows QR         |
    |                            |
Staff phone  ──scan QR──►  GET /staff-pickup?memberId=...
    |                            |
    |                    3. HTML page loads
    |                       → fetch GET /api/pickups/by-member/:id
    |                            |
    |                    4. Show list + "Mark picked up" buttons
    |                            |
Staff taps "Mark picked up"
    |                            |
    |  ─────────────────────►  PATCH /api/pickups/:id { pickedUp: true }
    |                            |
    |                    5. Update DB, page refreshes list
```

---

## Env / config

- **Member web:** `VITE_API_BASE` (or `VITE_STAFF_PICKUP_URL`) must be the backend root URL so the QR points at the backend.
- **Member mobile:** `API_BASE` (or equivalent) must be the same backend URL.
- **Backend:** No extra env needed for the QR flow; `/staff-pickup` and the two public API routes are enough.
