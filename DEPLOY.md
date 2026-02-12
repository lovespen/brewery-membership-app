# Deploying the Brewery Membership App

This guide covers how to run the app in production and how to set up admin accounts.

## Run locally first

For a **functional website on your machine** (users + admins), see the main **[README.md](./README.md)**. It explains:

- One-time setup (PostgreSQL, `backend/.env`, Prisma migrations)
- Running backend, admin, and member-web with one command: `npm run dev`
- **Admin:** http://localhost:5173 (dev account: `lovespen@gmail.com` / `$Pl63724`)
- **Members:** http://localhost:5174 (register and log in)

---

## Overview

- **Backend** (Node/Express, Prisma, PostgreSQL): API and business logic. Must run on a server (e.g. VPS, Railway, Render).
- **Admin** (Vite/React): Admin UI. Build and host as static files (same server, or Vercel/Netlify, or a subpath of your domain).
- **Member-web** (Vite/React): Member shop/checkout. Build and host as static files.
- **Mobile** (Expo): Point `EXPO_PUBLIC_API_BASE` at your deployed backend URL when building.

## 1. Backend

### Environment variables

Create a `.env` in the `backend` folder (or set in your host’s dashboard):

```env
PORT=4000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
ADMIN_EMAILS=admin@yourbrewery.com,you@yourbrewery.com
```

- **PORT** – Port the server listens on (default 4000).
- **DATABASE_URL** – PostgreSQL connection string (required). The backend uses Prisma with the pg driver adapter.
- **ADMIN_EMAILS** – Comma-separated list of emails that can sign in to the admin app. The dev account `lovespen@gmail.com` is always allowed in addition to this list.

### Run in production

```bash
cd backend
npm ci
npx prisma migrate deploy
npm run build
npm start
```

For a long-running server, use a process manager (e.g. systemd, PM2) or your host’s start command.

### Local development

- Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL` and optionally `ADMIN_EMAILS`.
- Run `npx prisma migrate deploy` in `backend` to apply migrations.
- A **developer admin** account is created on startup: `lovespen@gmail.com` / `$Pl63724` (see README). You can also add other emails to `ADMIN_EMAILS` and have those users register in the member app to gain admin access.

## 2. Setting up admin accounts

1. **Set `ADMIN_EMAILS`** in the backend `.env` to the emails that should have admin access (e.g. `admin@yourbrewery.com`).

2. **Create the account** (if it doesn’t exist):
   - Use the **member app** (member-web or mobile) to **Register** with that email and a password, or
   - Have someone register with that email, or
   - Add the user via your own script/code against `POST /api/register` (same backend).

3. **Sign in to the admin app**:
   - Open the admin UI (see below).
   - Log in with that email and password.
   - The backend will return `isAdmin: true` only if the email is in `ADMIN_EMAILS`. The admin app then stores the token and uses it for all API requests.

4. **Add more admins later**: Add another email to `ADMIN_EMAILS`, ensure that user has registered, then they can sign in to the admin app.

## 3. Admin app

### Build

```bash
cd admin
npm ci
npm run build
```

### Environment (production API URL)

Set **VITE_API_BASE** to your backend URL when building, so the admin app talks to the right API:

```bash
# Example: backend at https://api.yourbrewery.com
VITE_API_BASE=https://api.yourbrewery.com npm run build
```

If you don’t set it, the app assumes the API is on the same host as the admin on port 4000 (or `http://localhost:4000` in dev).

### Hosting

- Upload the contents of `admin/dist` to any static host (Nginx, Vercel, Netlify, S3 + CloudFront, etc.).
- Or serve it from the same server as the backend (e.g. Nginx serving `admin/dist` at `/admin` and proxying `/api` to the Node process).

## 4. Member-web

- Build with the correct API and (if needed) staff-pickup URL:
  ```bash
  cd member-web
  VITE_API_BASE=https://api.yourbrewery.com npm run build
  ```
- Serve the built files from your chosen host. Point members (and the mobile app’s checkout link) to this URL.

## 5. Mobile app

- In `mobile/.env` set:
  ```env
  EXPO_PUBLIC_API_BASE=https://api.yourbrewery.com
  ```
- Build with EAS or your usual Expo flow. The app will use this URL for API and auth.

## 6. CORS and HTTPS

- Ensure the backend allows the origins where the admin and member-web apps run (e.g. `https://admin.yourbrewery.com`, `https://shop.yourbrewery.com`). The backend uses `cors()`; for production you may want to restrict `origin` in the CORS options.
- Use HTTPS in production. If the backend is behind a reverse proxy (Nginx, Cloudflare), terminate SSL there and keep the backend on HTTP internally if desired.

## 7. Quick checklist

1. Backend: set `DATABASE_URL`, `PORT`, and (optionally) `ADMIN_EMAILS` in `.env`; run `npx prisma migrate deploy`, then `npm run build && npm start`.
2. Ensure at least one admin can log in: use the built-in dev account (`lovespen@gmail.com` / `$Pl63724`) or add an email to `ADMIN_EMAILS` and have that user register in the member app.
3. Admin: set `VITE_API_BASE` and run `npm run build`; deploy `admin/dist`.
4. Open the admin URL, sign in with an admin email/password; you should see the dashboard and “Log out” in the sidebar.
5. Member-web and mobile: set their API base URLs and build/deploy as needed.

## Troubleshooting

- **“Admin access only” / 403 on admin actions**  
  The logged-in user’s email is not in `ADMIN_EMAILS`. Add it to the backend env and restart.

- **“Session expired” / 401**  
  Tokens are stored in memory; restarting the backend invalidates all sessions. Log in again.

- **Admin app “Could not reach server”**  
  Check `VITE_API_BASE` and that the backend is reachable from the browser (CORS, firewall, correct URL).
