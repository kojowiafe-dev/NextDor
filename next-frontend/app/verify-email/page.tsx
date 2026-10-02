"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, CheckCircle2, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { resendCode } from "@/lib/auth/api";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmailSession, isAuthenticated, user } = useAuth();

  const emailParam = searchParams.get("email") || "";
  const redirectParam = searchParams.get("redirect") || "";

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  // If user is already authenticated and verified, redirect away
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin" || user.role === "super_admin") {
        router.replace("/admin");
      } else if (user.role === "vendor_owner" || user.role === "vendor_staff") {
        router.replace("/vendor/dashboard");
      } else if (redirectParam && !redirectParam.startsWith("/admin") && !redirectParam.startsWith("/vendor")) {
        router.replace(redirectParam);
      } else {
        router.replace("/account");
      }
    }
  }, [isAuthenticated, user, router, redirectParam]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = code.trim().replace(/\D/g, "");

    if (cleanCode.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    if (!email) {
      setError("Email address is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const verifiedUser = await verifyEmailSession({ email, code: cleanCode });
      setSuccessMsg("Email verified successfully! Redirecting...");

      setTimeout(() => {
        if (verifiedUser.role === "admin" || verifiedUser.role === "super_admin") {
          router.replace("/admin");
        } else if (verifiedUser.role === "vendor_owner" || verifiedUser.role === "vendor_staff") {
          router.replace("/vendor/dashboard");
        } else if (redirectParam && !redirectParam.startsWith("/admin") && !redirectParam.startsWith("/vendor")) {
          router.replace(redirectParam);
        } else {
          router.replace("/account");
        }
      }, 900);
    } catch (err: any) {
      setError(err?.message || "Invalid or expired code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !email || isResending) return;

    setError(null);
    setIsResending(true);

    try {
      const res = await resendCode(email, "VERIFY_EMAIL");
      setSuccessMsg(res.message || "A new 6-digit code has been dispatched to your email.");
      setCooldown(60);
      setCode("");
      inputRef.current?.focus();
    } catch (err: any) {
      setError(err?.message || "Could not resend code. Please try again.");
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

          {/* Icon & Title */}
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff9900]/15 text-[#ff9900] ring-4 ring-[#ff9900]/10">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">Verify your email address</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500">
              We sent a 6-digit verification code to
            </p>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-zinc-800 break-all">
              {email || "your email address"}
            </p>
          </div>

          {/* Feedback Messages */}
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

          {/* Code Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="otp-code"
                className="block text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2"
              >
                Enter 6-digit code
              </label>
              <input
                ref={inputRef}
                id="otp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(val);
                  if (error) setError(null);
                }}
                placeholder="• • • • • •"
                className="w-full text-center text-2xl sm:text-3xl font-bold tracking-[0.4em] py-3 px-4 rounded-xl border-2 border-zinc-200 bg-zinc-50/50 text-zinc-900 outline-none transition focus:border-[#ff9900] focus:bg-white focus:ring-4 focus:ring-[#ff9900]/15"
                autoComplete="one-time-code"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ff9900] py-3 text-sm font-bold text-zinc-950 shadow-sm transition hover:bg-[#f08804] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify & Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Resend Action */}
          <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
            <p className="text-xs text-zinc-500">Didn't receive the email code?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold transition ${
                cooldown > 0
                  ? "text-zinc-400 cursor-not-allowed"
                  : "text-[#ff9900] hover:text-[#f08804] hover:underline"
              }`}
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Sending code...</span>
                </>
              ) : cooldown > 0 ? (
                <span>Resend code in {cooldown}s</span>
              ) : (
                <span>Resend 6-digit code</span>
              )}
            </button>
          </div>

          {/* Change email link */}
          <div className="mt-4 text-center">
            <Link
              href="/register"
              className="text-xs text-zinc-400 hover:text-zinc-700 transition"
            >
              Entered the wrong email? <span className="underline">Register again</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#ff9900]" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
