"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { resetPassword, resendCode } from "@/lib/auth/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isValidPassword = hasMinLength && hasUppercase && hasNumber;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().replace(/\D/g, "");

    if (!cleanEmail) {
      setError("Please enter your account email address.");
      return;
    }

    if (cleanCode.length !== 6) {
      setError("Please enter the complete 6-digit recovery code.");
      return;
    }

    if (!isValidPassword) {
      setError("Password must be at least 8 characters, include an uppercase letter and a number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await resetPassword({
        email: cleanEmail,
        code: cleanCode,
        password,
      });

      setSuccessMsg(res.message || "Your password has been reset successfully! Redirecting to login...");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to reset password. Please check your code and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (cooldown > 0 || !email || isResending) return;

    setError(null);
    setIsResending(true);

    try {
      const res = await resendCode(email.trim().toLowerCase(), "RESET_PASSWORD");
      setSuccessMsg(res.message || "A new 6-digit recovery code has been dispatched to your email.");
      setCooldown(60);
      setCode("");
    } catch (err: any) {
      setError(err?.message || "Failed to resend recovery code.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-180px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-zinc-200/80">
          {/* Logo */}
          <div className="mb-6 text-center">
            <Link
              href="/"
              className="inline-block rounded-xl bg-[#131921] px-5 py-2.5 shadow-md transition hover:bg-black"
            >
              <Image
                src="/logo.png"
                alt="NextDor"
                width={120}
                height={32}
                priority
                className="h-7 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff9900]/15 text-[#ff9900] ring-4 ring-[#ff9900]/10">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">Set a new password</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500">
              Enter the 6-digit recovery code sent to your email and your new password.
            </p>
          </div>

          {/* Feedback */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
              >
                Account Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="code"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
                >
                  6-Digit Recovery Code
                </label>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={cooldown > 0 || isResending}
                  className="text-xs font-semibold text-[#ff9900] hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {isResending ? "Sending..." : cooldown > 0 ? `Resend (${cooldown}s)` : "Resend Code"}
                </button>
              </div>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError(null);
                }}
                placeholder="123456"
                className="w-full tracking-widest text-center font-bold text-lg rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-zinc-900 outline-none transition focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 pr-10 text-sm text-zinc-900 outline-none transition focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Requirements helper */}
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                <span className={hasMinLength ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
                  {hasMinLength ? "✓" : "○"} 8+ chars
                </span>
                <span className={hasUppercase ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
                  {hasUppercase ? "✓" : "○"} Uppercase
                </span>
                <span className={hasNumber ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
                  {hasNumber ? "✓" : "○"} Number
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Repeat new password"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 pr-10 text-sm text-zinc-900 outline-none transition focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                  aria-label="Toggle password visibility"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !code || !password || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ff9900] py-3 text-sm font-bold text-zinc-950 shadow-sm transition hover:bg-[#f08804] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password & Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Back Link */}
          <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition"
            >
              Back to <span className="text-[#ff9900] hover:underline">Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#ff9900]" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
