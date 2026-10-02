"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isAdmin, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated and admin, redirect straight to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) {
      router.replace("/admin");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setAccessDenied(false);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const loggedUser = await login({ email, password });
      if (loggedUser.role === "admin" || loggedUser.role === "super_admin") {
        router.replace("/admin");
      } else {
        setAccessDenied(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed.";
      if (msg.toLowerCase().includes("failed to fetch")) {
        setError(
          "Failed to reach the backend API (Failed to fetch). The backend may be waking up from sleep, blocked by CORS, or unreachable. Please check backend status and environment variables."
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // After login resolves, check if user got admin role
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin && !isSubmitting) {
      setAccessDenied(true);
    }
  }, [isLoading, isAuthenticated, isAdmin, isSubmitting]);

  if (isLoading || (isAuthenticated && isAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1117]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-[#ff9900]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1117] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block mb-3 transition hover:opacity-90">
            <Image
              src="/logo.png"
              alt="NextDor"
              width={160}
              height={44}
              priority
              className="h-10 w-auto object-contain mx-auto"
            />
          </Link>
          <h1 className="text-xl font-bold text-white">Admin Portal</h1>
          <p className="mt-1 text-sm text-zinc-500">Nextdor Operations Dashboard</p>
        </div>

        <div className="rounded-2xl bg-[#161b22] p-8 ring-1 ring-white/5">
          {accessDenied ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                <ShieldAlert className="h-7 w-7 text-red-400" />
              </div>
              <h2 className="font-semibold text-white">Access Denied</h2>
              <p className="mt-2 text-sm text-zinc-400">
                This account does not have admin privileges. Contact your administrator.
              </p>
              <button
                type="button"
                onClick={() => { setAccessDenied(false); setEmail(""); setPassword(""); }}
                className="mt-4 text-sm text-[#ff9900] hover:underline"
              >
                Try a different account
              </button>
              <div className="mt-4">
                <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
                  ← Back to store
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 ring-1 ring-red-500/20">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="admin-email" className="block text-sm font-medium text-zinc-300">
                    Email address
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@nextdor.online"
                    autoComplete="email"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-[#ff9900]/50 focus:ring-2 focus:ring-[#ff9900]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-password" className="block text-sm font-medium text-zinc-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-[#ff9900]/50 focus:ring-2 focus:ring-[#ff9900]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:opacity-70"
                >
                  {isSubmitting && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
                  )}
                  {isSubmitting ? "Signing in..." : "Sign In to Admin"}
                </button>
              </form>

              <div className="mt-6 rounded-lg bg-white/5 p-3 text-center text-xs text-zinc-500">
                <p className="font-medium text-zinc-400">Default Super Admin credentials</p>
                <p className="mt-1">Email: <span className="text-zinc-300">admin@nextdor.com</span></p>
                <p>Password: <span className="text-zinc-300">Admin@NextDor2026!</span></p>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            ← Back to Nextdor Store
          </Link>
        </p>
      </div>
    </div>
  );
}
