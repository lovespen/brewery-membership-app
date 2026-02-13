# Deploying Admin (and Member-Web) to Vercel

This repo is a **monorepo**: the admin app lives in the `admin/` folder. For Vercel to build and deploy it, you must set the **Root Directory**.

## Admin app on Vercel

1. **Vercel dashboard** → Your project (or create one) → **Settings** → **General**.

2. Set **Root Directory** to:
   ```
   admin
   ```
   Click **Edit**, type `admin`, save.  
   If this is wrong, Vercel will build from the repo root and the deploy will fail or show an old/empty app.

3. **Build & Development**
   - **Framework Preset:** Vite (or leave default; `admin/vercel.json` sets it).
   - **Build Command:** `npm run build` (default is fine).
   - **Output Directory:** `dist` (default for Vite).
   - **Install Command:** `npm install` (default).

4. **Environment variables** (Settings → Environment Variables):
   - `VITE_API_BASE` = your backend URL, e.g. `https://brewery-membership-app-production.up.railway.app`  
   (Use the full URL with `https://` so the admin can reach the API.)

5. **Trigger a new deploy**
   - **Deployments** → **⋮** on the latest → **Redeploy**,  
   or push a new commit to the branch Vercel is watching (usually `main`).

6. After the deploy finishes, open the app URL and do a **hard refresh**: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac).

## If updates still don’t appear

- Confirm the **branch** Vercel uses (Settings → Git → Production Branch). Push your changes to that branch (e.g. `main`).
- In **Deployments**, open the latest deployment and check **Building** / **Logs** for errors.
- Confirm on **GitHub** that your latest commit (with Clubs, etc.) is on that branch.
- Try **Redeploy** with “Clear cache and redeploy” if your host offers it.

## Member-web (member portal)

Same idea: create a **separate** Vercel project for the member site, set **Root Directory** to `member-web`, and set `VITE_API_BASE` to your backend URL.
