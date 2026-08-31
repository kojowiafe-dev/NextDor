// Stub auth API layer — replace function bodies with real API calls when backend is ready.
// All functions simulate network latency and return typed results.

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarInitials: string;
  role: "customer" | "admin";
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

// Simulated network delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function assignRole(email: string): "customer" | "admin" {
  const lower = email.toLowerCase();
  if (lower.startsWith("admin") || lower.endsWith("@nextdor.online")) {
    return "admin";
  }
  return "customer";
}

/**
 * Sign in with email and password.
 * TODO: Replace with `POST /api/auth/login`
 */
export async function signIn(payload: SignInPayload): Promise<AuthUser> {
  await delay(800);

  // Stub: accept any non-empty credentials
  if (!payload.email || !payload.password) {
    throw new Error("Email and password are required.");
  }

  // Simulate wrong password
  if (payload.password.length < 6) {
    throw new Error("Incorrect email or password. Please try again.");
  }

  const name = payload.email.split("@")[0].replace(/[._]/g, " ");
  const formattedName = name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    id: "stub-" + Math.random().toString(36).slice(2),
    name: formattedName,
    email: payload.email,
    role: assignRole(payload.email),
    avatarInitials: makeInitials(formattedName),
  };
}

/**
 * Register a new account.
 * TODO: Replace with `POST /api/auth/register`
 */
export async function signUp(payload: SignUpPayload): Promise<AuthUser> {
  await delay(900);

  if (!payload.email || !payload.password || !payload.name) {
    throw new Error("All required fields must be filled.");
  }

  return {
    id: "stub-" + Math.random().toString(36).slice(2),
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    role: assignRole(payload.email),
    avatarInitials: makeInitials(payload.name),
  };
}

/**
 * Request a password reset email.
 * TODO: Replace with `POST /api/auth/forgot-password`
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await delay(700);
  if (!email) throw new Error("Email is required.");
  // Stub: always succeeds
}

/**
 * Update user profile details.
 * TODO: Replace with `PATCH /api/auth/profile`
 */
export async function updateUserProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<AuthUser> {
  await delay(600);
  return {
    id: userId,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    role: assignRole(payload.email),
    avatarInitials: makeInitials(payload.name),
  };
}
