# Member portal (member view)

The **member portal** is the web app where members browse products, see pickups, and checkout. It runs as a separate dev server from the admin app.

## How to run it

1. **Start the backend** (required for API and proxy):
   ```bash
   cd backend
   npm run dev
   ```
   Backend runs at **http://localhost:4000**.

2. **Start the member portal**:
   ```bash
   cd member-web
   npm install   # first time only
   npm run dev
   ```
   The app runs at **http://localhost:5174** (see `vite.config.ts`).

3. **Open in the browser**:  
   **http://localhost:5174**

If you see a blank screen, make sure:
- The **backend is running** on port 4000 (member-web proxies `/api` to it).
- You’re opening **http://localhost:5174** (not 5173 or another port).
- You’re not using `npm run preview` alone: the proxy only works with `npm run dev`.

## Persona switcher

The member app is a **preview** that lets you switch between “Non-member”, “Sap Club”, “Wood Club”, etc. Use the dropdown in the header to change who you’re viewing as. No login is required for local preview.

## Scanning the pickup QR from a phone

The QR in **Pickup items** points at the backend. If you use **http://localhost:5174**, the QR uses localhost and a phone will get "cannot connect to server". **Fix:** Open the member app at **http://YOUR_IP:5174** (your computer's IP, e.g. 192.168.1.5) so the QR uses that IP; staff on the same Wi‑Fi can then scan and open the pickup page.
