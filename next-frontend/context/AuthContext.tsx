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
import type { AuthUser, SignInPayload, SignUpPayload, UpdateProfilePayload } from "@/lib/auth/api";
import {
  signIn as apiSignIn,
  signUp as apiSignUp,
  fetchCurrentUser,
  refreshAccessToken,
  signOutApi,
  updateUserProfile as apiUpdateProfile,
} from "@/lib/auth/api";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isOpsAdmin: boolean;
  isVendor: boolean;
  isLoading: boolean;
  login: (payload: SignInPayload) => Promise<AuthUser>;
  register: (payload: SignUpPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "nextdor-auth";
const TOKEN_KEY = "nextdor-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore and verify session on initial mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const storedUser = localStorage.getItem(STORAGE_KEY);
        const storedToken = localStorage.getItem(TOKEN_KEY);

        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          if (isMounted) {
            setUser(parsedUser);
            setToken(storedToken);
          }

          // Verify token validity against backend GET /auth/me
          const freshUser = await fetchCurrentUser(storedToken);
          if (freshUser) {
            if (isMounted) {
              setUser(freshUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(freshUser));
            }
          } else {
            // Access token might be expired — attempt silent cookie refresh
            const newAccessToken = await refreshAccessToken();
            if (newAccessToken) {
              const refreshedUser = await fetchCurrentUser(newAccessToken);
              if (refreshedUser && isMounted) {
                setUser(refreshedUser);
                setToken(newAccessToken);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshedUser));
                localStorage.setItem(TOKEN_KEY, newAccessToken);
                if (refreshedUser.role === "vendor_owner" || refreshedUser.role === "vendor_staff") {
                  localStorage.setItem("vendor_token", newAccessToken);
                }
              }
            } else {
              // Session expired completely
              if (isMounted) {
                setUser(null);
                setToken(null);
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem("vendor_token");
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not restore user session:", err);
      } finally {
        if (isMounted) setHydrated(true);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (payload: SignInPayload): Promise<AuthUser> => {
    const { user: authUser, accessToken } = await apiSignIn(payload);
    setUser(authUser);
    setToken(accessToken);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      localStorage.setItem(TOKEN_KEY, accessToken);
      if (authUser.role === "vendor_owner" || authUser.role === "vendor_staff") {
        localStorage.setItem("vendor_token", accessToken);
      }
    }

    return authUser;
  }, []);

  const register = useCallback(async (payload: SignUpPayload): Promise<AuthUser> => {
    const { user: authUser, accessToken } = await apiSignUp(payload);
    setUser(authUser);
    setToken(accessToken);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      localStorage.setItem(TOKEN_KEY, accessToken);
      if (authUser.role === "vendor_owner" || authUser.role === "vendor_staff") {
        localStorage.setItem("vendor_token", accessToken);
      }
    }

    return authUser;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("vendor_token");
    }

    await signOutApi();
  }, []);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      if (!user) throw new Error("Not authenticated");
      const updated = await apiUpdateProfile(user.id, payload);
      setUser(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin" || user?.role === "super_admin",
      isSuperAdmin: user?.role === "super_admin",
      isOpsAdmin: user?.role === "admin",
      isVendor: user?.role === "vendor_owner" || user?.role === "vendor_staff",
      isLoading: !hydrated,
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, token, hydrated, login, register, logout, updateProfile],
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
