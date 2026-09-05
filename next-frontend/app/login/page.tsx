"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthFormField } from "@/components/account/AuthFormField";


type FormErrors = {
  email?: string;
  password?: string;
  general?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to appropriate portal immediately
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    const searchRedirect =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirect")
        : null;

    if (user.role === "admin" || user.role === "super_admin") {
      if (searchRedirect && searchRedirect.startsWith("/admin")) {
        router.replace(searchRedirect);
      } else {
        router.replace("/admin");
      }
    } else if (user.role === "vendor_owner" || user.role === "vendor_staff") {
      if (
        searchRedirect &&
        (searchRedirect.startsWith("/vendor") || searchRedirect.startsWith("/shop"))
      ) {
        router.replace(searchRedirect);
      } else {
        router.replace("/vendor/dashboard");
      }
    } else {
      if (
        searchRedirect &&
        !searchRedirect.startsWith("/admin") &&
        !searchRedirect.startsWith("/vendor")
      ) {
        router.replace(searchRedirect);
      } else {
        router.replace("/account");
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!email.trim()) errs.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Please enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    return errs;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const loggedUser = await login({ email, password });
      const searchRedirect =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;

      if (loggedUser.role === "admin" || loggedUser.role === "super_admin") {
        if (searchRedirect && searchRedirect.startsWith("/admin")) {
          router.replace(searchRedirect);
        } else {
          router.replace("/admin");
        }
      } else if (loggedUser.role === "vendor_owner" || loggedUser.role === "vendor_staff") {
        if (
          searchRedirect &&
          (searchRedirect.startsWith("/vendor") || searchRedirect.startsWith("/shop"))
        ) {
          router.replace(searchRedirect);
        } else {
          router.replace("/vendor/dashboard");
        }
      } else {
        if (
          searchRedirect &&
          !searchRedirect.startsWith("/admin") &&
          !searchRedirect.startsWith("/vendor")
        ) {
          router.replace(searchRedirect);
        } else {
          router.replace("/account");
        }
      }
    } catch (error) {
      setErrors({
        general:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#ff9900]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-100">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link href="/" className="text-2xl font-bold tracking-tight text-zinc-900">
              next<span className="text-[#ff9900]">dor</span>
            </Link>
            <h1 className="mt-4 text-xl font-semibold text-zinc-900">
              Sign in to your account
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Welcome back! Please enter your details.
            </p>
          </div>

          {/* Google sign-in placeholder */}
          <button
            type="button"
            disabled
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
            <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
              Soon
            </span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-zinc-400">or continue with email</span>
            </div>
          </div>

          {/* General error */}
          {errors.general && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <AuthFormField
              label="Email address"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={`w-full rounded-lg border px-4 py-2.5 pr-10 text-sm text-zinc-900 outline-none transition-colors focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
                    errors.password
                      ? "border-red-400 bg-red-50"
                      : "border-zinc-300 bg-white hover:border-zinc-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 accent-[#ff9900]"
              />
              Remember me
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
              )}
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Merchant Callout */}
        <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/70 p-3.5 text-center text-xs text-purple-950">
          <span className="font-semibold">Are you a merchant?</span>{" "}
          Sign in above with your store email, or{" "}
          <Link href="/vendor/register" className="font-semibold text-purple-700 hover:underline">
            open a merchant store →
          </Link>
        </div>

        {/* Back to shop */}
        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/shop" className="hover:underline">
            ← Continue shopping without signing in
          </Link>
        </p>
      </div>
    </div>
  );
}
