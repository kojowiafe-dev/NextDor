"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth/api";
import { AuthFormField } from "@/components/account/AuthFormField";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEmailError("");
    setGeneralError("");

    if (!email.trim()) {
      setEmailError("Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (error) {
      setGeneralError(
        error instanceof Error ? error.message : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-8 text-center">
            <Link href="/" className="text-2xl font-bold tracking-tight text-zinc-900">
              next<span className="text-[#ff9900]">dor</span>
            </Link>
            <h1 className="mt-4 text-xl font-semibold text-zinc-900">Reset your password</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">Check your email</h2>
              <p className="mt-2 text-sm text-zinc-500">
                We&apos;ve sent a password reset link to{" "}
                <span className="font-medium text-zinc-700">{email}</span>. It may take a
                few minutes to arrive.
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                Didn&apos;t receive it? Check your spam folder or{" "}
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-[#007185] hover:underline"
                >
                  try again
                </button>
                .
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804]"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {generalError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
                  {generalError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <AuthFormField
                  label="Email address"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={emailError}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
                  )}
                  {isSubmitting ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-zinc-600">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
