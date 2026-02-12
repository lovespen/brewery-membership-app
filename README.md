# Brewery Membership App

Web and admin apps for brewery members: shop, memberships, pickups, and admin dashboard.

## What’s in this repo

| App        | Purpose              | Local URL (dev)      |
|-----------|----------------------|----------------------|
| **Backend** | API, auth, database | http://localhost:4000 |
| **Admin**   | Staff/admin dashboard | http://localhost:5173 |
| **Member-web** | Member shop & account | http://localhost:5174 |

- **Users (members)** use **member-web** to register, log in, shop, and manage their membership.
- **Admins** use the **admin** app to manage clubs, products, memberships, and orders. They log in with an account whose email is allowed in the backend.

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** (for the backend database)
- **npm** (or pnpm/yarn)

## 1. One-time setup

### Database

1. Create a PostgreSQL database (e.g. `brewery_membership`).
2. In the **backend** folder, copy env and set your connection string:
   ```bash
   cd backend
   cp .env.example .env
   ```
   Edit `backend/.env` and set:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/brewery_membership"
   PORT=4000
   ```
   Optionally set `ADMIN_EMAILS=you@example.com` for extra admin emails (one is already hardcoded for dev).

3. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

### Install dependencies

From the **project root**:

```bash
npm install
```

Then install each app’s dependencies (or use the root dev script below, which assumes they’re installed):

```bash
cd backend && npm install && cd ..
cd admin && npm install && cd ..
cd member-web && npm install && cd ..
```

## 2. Run the full website locally

From the **project root**:

```bash
npm run dev
```

This starts:

- **Backend** on http://localhost:4000  
- **Admin** on http://localhost:5173  
- **Member-web** on http://localhost:5174  

If you prefer to run them separately, use three terminals:

```bash
# Terminal 1 – backend
cd backend && npm run dev

# Terminal 2 – admin
cd admin && npm run dev

# Terminal 3 – member-web
cd member-web && npm run dev
```

## 3. Logging in

### Developer admin account (always available)

- **URL:** http://localhost:5173  
- **Email:** `lovespen@gmail.com`  
- **Password:** `$Pl63724`  

This account is created/updated on backend startup and always has admin access.

### Other admins

- Add their emails to `ADMIN_EMAILS` in `backend/.env`, then have them **register** in the member app (http://localhost:5174) with that email.  
- They can then log in to the admin app (http://localhost:5173) with the same email and password.

### Members

- **URL:** http://localhost:5174  
- Members **Register** with email + password, then log in to shop and manage membership.

## 4. Deploying to production

See **[DEPLOY.md](./DEPLOY.md)** for:

- Backend env vars and build/run
- Building and hosting the admin and member-web frontends
- Setting `VITE_API_BASE` (and optional `VITE_STAFF_PICKUP_URL`) for production
- CORS and HTTPS

## Quick checklist

1. PostgreSQL running, `backend/.env` has `DATABASE_URL`, run `npx prisma migrate deploy` in `backend`.
2. From root: `npm run dev` (or start backend, admin, member-web separately).
3. **Admins:** open http://localhost:5173 and log in with `lovespen@gmail.com` / `$Pl63724` (or another email in `ADMIN_EMAILS` after they register).
4. **Members:** open http://localhost:5174 to register and use the member site.
