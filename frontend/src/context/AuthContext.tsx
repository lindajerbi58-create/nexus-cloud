"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import {
  authApi,
  ApiException,
} from "@/lib/api";

import type {
  User,
  AuthRequest,
  AuthResponse,
} from "@/types";

const TOKEN_KEY = "nexus_access_token";
const EXPIRY_KEY = "nexus_token_expiry";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  authenticated: boolean;

  login: (data: AuthRequest) => Promise<User>;

  register: (data: AuthRequest) => Promise<User>;

  logout: () => void;
}

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [token, setToken] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [expiry, setExpiry] =
    useState<number | null>(null);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);

    setUser(null);
    setToken(null);
    setExpiry(null);
  }, []);

  const saveSession = useCallback(
    (response: AuthResponse) => {
      const expiresAt =
        Date.now() + response.expiresIn * 1000;

      sessionStorage.setItem(
        TOKEN_KEY,
        response.token
      );

      sessionStorage.setItem(
        EXPIRY_KEY,
        String(expiresAt)
      );

      setToken(response.token);
      setUser(response.user);
      setExpiry(expiresAt);

      return response.user;
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const savedToken =
        sessionStorage.getItem(TOKEN_KEY);

      const savedExpiry = Number(
        sessionStorage.getItem(EXPIRY_KEY)
      );

      if (
        !savedToken ||
        !Number.isFinite(savedExpiry) ||
        savedExpiry <= Date.now()
      ) {
        if (active) {
          logout();
          setLoading(false);
        }

        return;
      }

      try {
        const profile =
          await authApi.me(savedToken);

        if (active) {
          setToken(savedToken);
          setUser(profile);
          setExpiry(savedExpiry);
        }
      } catch (error) {
        if (active) {
          logout();

          if (
            error instanceof ApiException &&
            error.status !== 401
          ) {
            console.warn(
              "Session restoration failed:",
              error.message
            );
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [logout]);

  useEffect(() => {
    if (!expiry) {
      return;
    }

    const remaining = expiry - Date.now();

    const timeout = window.setTimeout(
      logout,
      Math.max(0, remaining)
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [expiry, logout]);

  async function login(data: AuthRequest) {
    const response =
      await authApi.login(data);

    return saveSession(response);
  }

  async function register(data: AuthRequest) {
    const response =
      await authApi.register(data);

    return saveSession(response);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authenticated: Boolean(user && token),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}