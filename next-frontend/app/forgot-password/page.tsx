"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { KeyRound, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { forgotPassword } from "@/lib/auth/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await forgotPassword(cleanEmail);
      setSuccessMsg(res.message || "A 6-digit recovery code has been sent to your email.");

      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(cleanEmail)}`);
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to process request. Please try again.");
    } finally {
      setIsSubmitting(false);
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
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">Forgot your password?</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Enter your registered email address and we'll send you a 6-digit recovery code to reset your password.
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
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5"
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
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ff9900] py-3 text-sm font-bold text-zinc-950 shadow-sm transition hover:bg-[#f08804] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Sending recovery code...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Back Link */}
          <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition inline-flex items-center gap-1"
            >
              <span>Remember your password?</span>
              <span className="text-[#ff9900] hover:underline">Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
