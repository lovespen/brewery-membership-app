import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getApiBase, getStoredToken, setStoredToken } from "./api";

type AdminAuthContextValue = {
  token: string | null;
  isAdmin: boolean;
  isDeveloper: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  apiRequest: (path: string, init?: RequestInit) => Promise<Response>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [loading, setLoading] = useState(true);

  const apiBase = getApiBase();

  const checkSession = useCallback(async () => {
    const stored = getStoredToken();
    if (!stored) {
      setToken(null);
      setIsAdmin(false);
      setIsDeveloper(false);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isAdmin) {
          setToken(stored);
          setIsAdmin(true);
          setIsDeveloper(Boolean((data as { isDeveloper?: boolean }).isDeveloper));
        } else {
          setStoredToken(null);
          setToken(null);
          setIsAdmin(false);
          setIsDeveloper(false);
        }
      } else {
        setStoredToken(null);
        setToken(null);
        setIsAdmin(false);
        setIsDeveloper(false);
      }
    } catch {
      setToken(null);
      setIsAdmin(false);
      setIsDeveloper(false);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(`${apiBase}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (data as { error?: string }).error;
          return { error: msg ? String(msg) : `Login failed (${res.status})` };
        }
        const t = (data as { token?: string }).token;
        const admin = (data as { isAdmin?: boolean }).isAdmin;
        if (!t) return { error: "No token received" };
        if (!admin) return { error: "This account does not have admin access." };
        const developer = (data as { isDeveloper?: boolean }).isDeveloper;
        setStoredToken(t);
        setToken(t);
        setIsAdmin(true);
        setIsDeveloper(Boolean(developer));
        return {};
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not reach server.";
        return { error: `Could not reach server. Check the API URL and try again. (${msg})` };
      }
    },
    [apiBase]
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setIsAdmin(false);
    setIsDeveloper(false);
  }, []);

  const apiRequest = useCallback(
    (path: string, init?: RequestInit): Promise<Response> => {
      const url = path.startsWith("http") ? path : `${apiBase}${path}`;
      const headers = new Headers(init?.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(url, { ...init, headers });
    },
    [apiBase, token]
  );

  const value: AdminAuthContextValue = {
    token,
    isAdmin,
    isDeveloper,
    loading,
    login,
    logout,
    apiRequest
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
