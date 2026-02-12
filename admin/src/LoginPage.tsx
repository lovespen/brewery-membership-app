import React, { useState } from "react";

type LoginPageProps = {
  login: (email: string, password: string) => Promise<{ error?: string }>;
};

export function LoginPage({ login }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f14" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          padding: 24,
          background: "#171721",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
        }}
      >
        <h1 style={{ margin: "0 0 8px", color: "#f5f5f5", fontSize: 22 }}>Brewery Admin</h1>
        <p style={{ margin: "0 0 24px", color: "#b3b3c2", fontSize: 14 }}>Sign in with an admin account</p>
        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(220,53,69,0.15)", borderRadius: 8, color: "#f8b4b4", fontSize: 14 }}>
            {error}
          </div>
        )}
        <label style={{ display: "block", marginBottom: 8, color: "#b3b3c2", fontSize: 13 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            marginBottom: 16,
            border: "1px solid #2a2a35",
            borderRadius: 8,
            background: "#0b0b0f",
            color: "#f5f5f5",
            fontSize: 15
          }}
        />
        <label style={{ display: "block", marginBottom: 8, color: "#b3b3c2", fontSize: 13 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            marginBottom: 24,
            border: "1px solid #2a2a35",
            borderRadius: 8,
            background: "#0b0b0f",
            color: "#f5f5f5",
            fontSize: 15
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "12px 16px",
            border: "none",
            borderRadius: 8,
            background: "#2c6be8",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
