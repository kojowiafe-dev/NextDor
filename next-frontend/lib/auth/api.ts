/**
 * Real API authentication layer connecting next-frontend to Fastify next-backend.
 */
import { API_BASE } from "@/lib/api-config";

export type AuthRole = "customer" | "admin" | "vendor_owner" | "vendor_staff" | "super_admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarInitials: string;
  role: AuthRole;
  vendorId?: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

export type SignInPayload = {
  email: string;
  password: string;
};

export type SignUpPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export type UpdateProfilePayload = {
  name: string;
  email: string;
  phone?: string;
};

export function makeInitials(name?: string | null): string {
  if (!name) return "ND";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "ND"
  );
}

function normalizeRole(role: string): AuthRole {
  const lower = role.toLowerCase();
  if (lower === "super_admin") return "super_admin";
  if (lower === "admin") return "admin";
  if (lower === "vendor_owner") return "vendor_owner";
  if (lower === "vendor_staff") return "vendor_staff";
  return "customer";
}

/**
 * Sign in with email and password via backend POST /api/v1/auth/login.
 */
export async function signIn(payload: SignInPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    if (res.status === 403 && json.error?.code === "EMAIL_NOT_VERIFIED") {
      const err = new Error(json.error?.message || "Please verify your email address to continue.");
      (err as any).code = "EMAIL_NOT_VERIFIED";
      (err as any).email = json.data?.email || payload.email;
      throw err;
    }
    throw new Error(json.error?.message || "Invalid email or password.");
  }

  const rawUser = json.data.user;
  if (typeof window !== "undefined" && json.data.refreshToken) {
    localStorage.setItem("nextdor-refresh-token", json.data.refreshToken);
  }
  return {
    user: {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      phone: rawUser.phone ?? undefined,
      role: normalizeRole(rawUser.role),
      vendorId: rawUser.vendorId ?? undefined,
      avatarInitials: makeInitials(rawUser.name),
    },
    accessToken: json.data.accessToken,
  };
}

export type SignUpResult = {
  user: AuthUser;
  requiresVerification: boolean;
  email: string;
};

/**
 * Register a new account via backend POST /api/v1/auth/register.
 */
export async function signUp(payload: SignUpPayload): Promise<SignUpResult> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to create account.");
  }

  const rawUser = json.data.user;
  return {
    user: {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      phone: rawUser.phone ?? undefined,
      role: normalizeRole(rawUser.role),
      vendorId: rawUser.vendorId ?? undefined,
      avatarInitials: makeInitials(rawUser.name),
    },
    requiresVerification: Boolean(json.data.requiresVerification),
    email: json.data.email || rawUser.email,
  };
}

/**
 * Verify email address with 6-digit OTP code via POST /api/v1/auth/verify-email.
 */
export async function verifyEmail(payload: { email: string; code: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Invalid or expired verification code.");
  }

  const rawUser = json.data.user;
  if (typeof window !== "undefined" && json.data.refreshToken) {
    localStorage.setItem("nextdor-refresh-token", json.data.refreshToken);
  }
  return {
    user: {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      phone: rawUser.phone ?? undefined,
      role: normalizeRole(rawUser.role),
      vendorId: rawUser.vendorId ?? undefined,
      avatarInitials: makeInitials(rawUser.name),
    },
    accessToken: json.data.accessToken,
  };
}

/**
 * Resends a 6-digit verification code with 60s cooldown via POST /api/v1/auth/resend-code.
 */
export async function resendCode(
  email: string,
  type: "VERIFY_EMAIL" | "RESET_PASSWORD" = "VERIFY_EMAIL",
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/resend-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, type }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to resend code.");
  }
  return { success: true, message: json.message };
}

/**
 * Request password recovery code via POST /api/v1/auth/forgot-password.
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to submit password reset request.");
  }
  return { success: true, message: json.message };
}

/**
 * Reset password using 6-digit code via POST /api/v1/auth/reset-password.
 */
export async function resetPassword(payload: {
  email: string;
  code: string;
  password: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to reset password.");
  }
  return { success: true, message: json.message };
}

/**
 * Fetch the currently authenticated user profile via GET /api/v1/auth/me.
 */
export async function fetchCurrentUser(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.data?.user) return null;

    const rawUser = json.data.user;
    return {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      phone: rawUser.phone ?? undefined,
      role: normalizeRole(rawUser.role),
      vendorId: rawUser.vendorId ?? undefined,
      avatarInitials: makeInitials(rawUser.name),
    };
  } catch {
    return null;
  }
}

/**
 * Silently refresh the access token using cookie or fallback stored token via POST /api/v1/auth/refresh.
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const storedRefresh = typeof window !== "undefined" ? localStorage.getItem("nextdor-refresh-token") : null;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(storedRefresh ? { "x-refresh-token": storedRefresh } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ refreshToken: storedRefresh || undefined }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data?.accessToken) {
      if (json.data.refreshToken && typeof window !== "undefined") {
        localStorage.setItem("nextdor-refresh-token", json.data.refreshToken);
      }
      return json.data.accessToken as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Terminate the user session and revoke refresh token via POST /api/v1/auth/logout.
 */
export async function signOutApi(): Promise<void> {
  try {
    const storedRefresh = typeof window !== "undefined" ? localStorage.getItem("nextdor-refresh-token") : null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("nextdor-refresh-token");
    }
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(storedRefresh ? { "x-refresh-token": storedRefresh } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ refreshToken: storedRefresh || undefined }),
    });
  } catch {
    // Ignore network failures on logout
  }
}

/**
 * Request a password reset email via POST /api/v1/auth/forgot-password.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to request password reset.");
  }
}

/**
 * Update user profile details.
 */
export async function updateUserProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<AuthUser> {
  // Graceful local update
  const formattedName = payload.name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    id: userId,
    name: formattedName,
    email: payload.email,
    phone: payload.phone,
    role: "customer",
    avatarInitials: makeInitials(formattedName),
  };
}
