import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE } from "./config";

const AUTH_TOKEN_KEY = "memberAuthToken";

export type ClubCode = string;

export type MemberMembership = {
  clubCode: string;
  clubName: string;
  year: number;
  toastDiscountCode: string;
};

export type LoggedInMember = {
  id: string;
  email: string;
  name?: string;
  clubs: ClubCode[];
  memberships?: MemberMembership[];
  membershipYear?: number;
};

type AuthContextValue = {
  token: string | null;
  member: LoggedInMember | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshMember: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<LoggedInMember | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!stored) {
        setToken(null);
        setMember(null);
        return;
      }
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` }
      });
      if (res.ok) {
        const data = await res.json();
        setToken(stored);
        setMember(data.member ?? null);
      } else {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        setToken(null);
        setMember(null);
      }
    } catch {
      setToken(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    const trimmed = email.trim();
    if (!trimmed) return { error: "Enter your email" };
    if (!password) return { error: "Enter your password" };
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (data as { error?: string }).error || "Login failed" };
      const t = (data as { token?: string }).token;
      if (!t) return { error: "No token received" };
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, t);
      setToken(t);
      setMember((data as { member?: LoggedInMember }).member ?? null);
      return {};
    } catch {
      return {
        error:
          "Could not reach server. On a device or emulator, set EXPO_PUBLIC_API_BASE in mobile/.env to your computer's IP (e.g. http://192.168.1.5:4000), then restart the app."
      };
    }
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ error?: string }> => {
      if (!token) return { error: "Not logged in" };
      if (!newPassword || newPassword.length < 8) return { error: "New password must be at least 8 characters" };
      try {
        const res = await fetch(`${API_BASE}/api/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: (data as { error?: string }).error || "Failed to change password" };
        return {};
      } catch {
        return { error: "Could not reach server" };
      }
    },
    [token]
  );

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        /* ignore */
      }
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setToken(null);
    setMember(null);
  }, [token]);

  const refreshMember = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMember(data.member ?? null);
      }
    } catch {
      /* keep current member on network error */
    }
  }, [token]);

  const value: AuthContextValue = {
    token,
    member,
    loading,
    login,
    changePassword,
    logout,
    refreshMember
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
