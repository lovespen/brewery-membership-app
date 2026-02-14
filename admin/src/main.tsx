import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuthContext";
import { LoginPage } from "./LoginPage";
import { App } from "./pages/App";

function AdminGate() {
  const { token, isAdmin, loading, login, logout } = useAdminAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f14", color: "#b3b3c2" }}>
        Loading…
      </div>
    );
  }
  if (!token) {
    return <LoginPage login={login} />;
  }
  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f14", color: "#f5f5f5", flexDirection: "column", gap: 16 }}>
        <p>This account does not have admin access.</p>
        <button onClick={logout} style={{ padding: "10px 20px", background: "#2c6be8", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer" }}>
          Sign out
        </button>
      </div>
    );
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  </React.StrictMode>
);

