import React from "react";
import ReactDOM from "react-dom/client";
import "./member-mobile.css";
import { MemberPreview } from "./pages/WoodMemberPreview";

function shouldRedirectToStaffPickup(): boolean {
  if (typeof window === "undefined") return false;
  const pathname = window.location.pathname;
  if (pathname !== "/staff-pickup" && pathname !== "/staff-pickup/") return false;
  const env = typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  const base = env && String(env).trim() ? String(env).trim().replace(/\/$/, "") : "";
  if (!base) return false;
  const url = (/^https?:\/\//i.test(base) ? base : "https://" + base) + "/staff-pickup" + window.location.search;
  window.location.replace(url);
  return true;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            maxWidth: 560,
            margin: "40px auto",
            background: "#1a1a24",
            color: "#e0e0e0",
            borderRadius: 12,
            border: "1px solid #333"
          }}
        >
          <h1 style={{ fontSize: 18, margin: "0 0 12px 0" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#a0a0a0", margin: 0 }}>
            The member app crashed. Check the browser console for details. Make sure the backend is running (e.g. <code style={{ background: "#2a2a32", padding: "2px 6px", borderRadius: 4 }}>cd backend && npm run dev</code>) and you opened <strong>http://localhost:5174</strong>.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

if (!shouldRedirectToStaffPickup()) {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <MemberPreview />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

