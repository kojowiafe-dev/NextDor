"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@/lib/auth/api";
import {
  signIn as apiSignIn,
  signUp as apiSignUp,
  updateUserProfile as apiUpdateProfile,
} from "@/lib/auth/api";
import type { SignInPayload, SignUpPayload, UpdateProfilePayload } from "@/lib/auth/api";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (payload: SignInPayload) => Promise<void>;
  register: (payload: SignUpPayload) => Promise<void>;
  logout: () => void;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "nextdor-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored) as AuthUser);
      }
    } catch {
      setUser(null);
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever user changes
  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user, hydrated]);

  const login = useCallback(async (payload: SignInPayload) => {
    const authUser = await apiSignIn(payload);
    setUser(authUser);
  }, []);

  const register = useCallback(async (payload: SignUpPayload) => {
    const authUser = await apiSignUp(payload);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      if (!user) throw new Error("Not authenticated");
      const updated = await apiUpdateProfile(user.id, payload);
      setUser(updated);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      isLoading: !hydrated,
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, hydrated, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
