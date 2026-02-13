# Getting the Brewery Membership App Live

Step-by-step to put the app on the internet so users and admins can access it.

---

## What you need live

| Piece | What it is | Where it runs |
|-------|------------|---------------|
| **PostgreSQL** | Database | Managed DB (Neon, Railway, Render) or VPS |
| **Backend** | Node API on port 4000 | Railway, Render, Fly.io, or VPS |
| **Admin app** | Static site (React) | Vercel, Netlify, or same server as backend |
| **Member app** | Static site (React) | Vercel, Netlify, or same server as backend |

You’ll get URLs like:
- **API:** `https://your-backend.up.railway.app` (or your domain)
- **Admin:** `https://your-admin.vercel.app` or `https://admin.yourbrewery.com`
- **Member:** `https://your-member.vercel.app` or `https://shop.yourbrewery.com`

---

## Path A: Easiest (Railway + Vercel)

### Step 1: Production database (Railway PostgreSQL)

1. Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
2. **New Project** → **Add PostgreSQL**.
3. Open the PostgreSQL service → **Variables** or **Connect** and copy the **URL** (e.g. `postgresql://postgres:xxx@xxx.railway.app:5432/railway`). This is your production `DATABASE_URL`.

### Step 2: Backend on Railway

1. In the same (or new) Railway project: **New** → **GitHub Repo** and select your `brewery-membership-app` repo.
2. Set **Root Directory** to `backend` (so Railway builds and runs only the backend).
3. In the service **Variables**, add:
   - `DATABASE_URL` = the PostgreSQL URL from Step 1.
   - `PORT` = `4000` (Railway often injects `PORT`; use whatever they show).
   - `ADMIN_EMAILS` = optional, e.g. `you@brewery.com`.
4. **Settings** → **Build**:  
   Build command: `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build`  
   Start command: `npm start`  
   (Or use `npx prisma migrate deploy` in a separate deploy step if your host supports it.)
5. Deploy. Copy the public URL (e.g. `https://brewery-membership-backend.up.railway.app`). This is your **API URL**.

### Step 3: Admin app on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New** → **Project** → import your repo.
3. Set **Root Directory** to `admin`.
4. **Environment Variables** (for Production):
   - `VITE_API_BASE` = your API URL from Step 2 (e.g. `https://brewery-membership-backend.up.railway.app`).
5. Deploy. Copy the admin URL (e.g. `https://brewery-membership-admin.vercel.app`).

### Step 4: Member app on Vercel

1. **Add New** → **Project** again, same repo.
2. Set **Root Directory** to `member-web`.
3. **Environment Variables** (Production):
   - `VITE_API_BASE` = same API URL as Step 3.
4. Deploy. Copy the member URL (e.g. `https://brewery-membership-member.vercel.app`).

### Step 5: CORS (backend must allow your frontend URLs)

Your backend uses `cors()` with no origin restriction by default, so it usually allows any origin. If you later restrict CORS, add your admin and member URLs to the allowed list.

### Step 6: Test

- **Admin:** Open the admin URL → log in with `lovespen@gmail.com` / `$Pl63724` (or an email in `ADMIN_EMAILS` that has registered in the member app).
- **Members:** Open the member URL → Register and log in, then use the shop.

---

## Path B: Render instead of Railway

- **PostgreSQL:** [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**. Copy the **Internal** or **External** database URL.
- **Backend:** **New** → **Web Service** → connect repo, set **Root Directory** to `backend`. Add env vars: `DATABASE_URL`, `PORT` (Render sets this), `ADMIN_EMAILS`. Build: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`. Start: `npm start`.
- **Admin & Member:** Same as Path A (Vercel), or use Render **Static Site** for each (set root to `admin` and `member-web`, build command `npm ci && npm run build`, publish directory `dist`). Set `VITE_API_BASE` to your Render backend URL.

---

## Path C: One server (VPS)

On a VPS (DigitalOcean, Linode, etc.):

1. Install Node, PostgreSQL, and Nginx.
2. Run the backend (e.g. with PM2): set `DATABASE_URL`, `PORT`, `ADMIN_EMAILS` in env; run `prisma migrate deploy`, `npm run build`, `npm start`.
3. Build admin and member-web with `VITE_API_BASE=https://api.yourdomain.com`.
4. Use Nginx to serve `admin/dist` and `member-web/dist` and to proxy `/api` to the Node process. Use SSL (e.g. Let’s Encrypt).

---

## Checklist before going live

- [ ] Production PostgreSQL created and `DATABASE_URL` copied.
- [ ] Backend deployed with `DATABASE_URL`, `PORT`, and (optional) `ADMIN_EMAILS`.
- [ ] `prisma migrate deploy` run (via build step or manually once).
- [ ] Admin app built with `VITE_API_BASE` = backend URL and deployed.
- [ ] Member app built with `VITE_API_BASE` = backend URL and deployed.
- [ ] Admin and member URLs open and can reach the API (no CORS/blocked).
- [ ] You can log in to admin (e.g. `lovespen@gmail.com` / `$Pl63724`) and to member (register + login).

---

## Optional: Custom domain and HTTPS

- **Vercel / Netlify:** Add your domain in the project settings; they provide HTTPS.
- **Railway / Render:** Add a custom domain in the service settings; they usually provide HTTPS.
- For a VPS, use Nginx + Let’s Encrypt (e.g. Certbot).

---

## Stripe (if you use checkout)

- In Stripe Dashboard, set the webhook URL to `https://YOUR_BACKEND_URL/api/webhooks/stripe` and use the signing secret in backend env (see your backend Stripe config).
- Use live Stripe keys in production env vars.

---

## Summary

1. Create a **PostgreSQL** database (Railway or Render).
2. Deploy the **backend** (Railway or Render), point it at the DB, run Prisma migrations.
3. Deploy **admin** and **member-web** (Vercel or Render static) with `VITE_API_BASE` set to the backend URL.
4. Open the live admin and member URLs and test login.

For more detail on env vars and build commands, see [DEPLOY.md](./DEPLOY.md).
