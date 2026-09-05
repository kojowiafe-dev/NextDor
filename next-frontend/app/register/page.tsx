"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthFormField } from "@/components/account/AuthFormField";

type FormErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
};

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /\d/.test(password) },
    { label: "Special character", pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][score];
  const strengthColor = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"][score];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= score ? strengthColor : "bg-zinc-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Strength: <span className="font-medium text-zinc-700">{strengthLabel}</span>
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`text-xs ${c.pass ? "text-green-600" : "text-zinc-400"}`}
          >
            {c.pass ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "Full name is required.";
    if (!email.trim()) errs.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Please enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!confirmPassword) errs.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    if (!acceptTerms) errs.terms = "You must accept the terms and conditions.";
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
      await register({ name, email, password, phone: phone || undefined });
      const searchRedirect =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;
      router.push(searchRedirect || "/account");
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-100">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link href="/" className="text-2xl font-bold tracking-tight text-zinc-900">
              next<span className="text-[#ff9900]">dor</span>
            </Link>
            <h1 className="mt-4 text-xl font-semibold text-zinc-900">Create your account</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Join NextDor and shop quality products delivered across Ghana.
            </p>
          </div>

          {/* Google sign-in placeholder */}
          <button
            type="button"
            disabled
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign up with Google
            <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
              Soon
            </span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-zinc-400">or register with email</span>
            </div>
          </div>

          {errors.general && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <AuthFormField
              label="Full name"
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="Kwame Mensah"
              autoComplete="name"
              required
            />

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

            <AuthFormField
              label="Phone number (optional)"
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
              placeholder="+233 XX XXX XXXX"
              autoComplete="tel"
            />

            {/* Password with toggle + strength */}
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className={`w-full rounded-lg border px-4 py-2.5 pr-10 text-sm text-zinc-900 outline-none transition-colors focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
                    errors.password ? "border-red-400 bg-red-50" : "border-zinc-300 bg-white hover:border-zinc-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
              <PasswordStrength password={password} />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-700">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className={`w-full rounded-lg border px-4 py-2.5 pr-10 text-sm text-zinc-900 outline-none transition-colors focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
                    errors.confirmPassword ? "border-red-400 bg-red-50" : "border-zinc-300 bg-white hover:border-zinc-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-[#ff9900]"
                />
                <span>
                  I agree to the{" "}
                  <Link href="#" className="text-[#007185] hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-[#007185] hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {errors.terms && <p className="mt-1 text-xs text-red-600">{errors.terms}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
              )}
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#007185] hover:text-[#c7511f] hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/shop" className="hover:underline">
            ← Continue shopping without an account
          </Link>
        </p>
      </div>
    </div>
  );
}
