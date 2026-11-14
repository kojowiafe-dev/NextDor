"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { changePasswordApi } from "@/lib/auth/api";

function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••••"}
          className={`w-full rounded-xl border bg-white px-4 py-2.5 pr-10 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:ring-2 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-zinc-200 focus:border-zinc-900 focus:ring-zinc-900/10"
          }`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function ChangePasswordCard({
  title = "Change Password",
  subtitle = "Choose a strong password (8+ characters with an uppercase letter and a number).",
}: {
  title?: string;
  subtitle?: string;
}) {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function validate() {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Current password is required.";
    if (!newPassword) errs.newPassword = "New password is required.";
    else if (newPassword.length < 8) errs.newPassword = "Password must be at least 8 characters.";
    else if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errs.newPassword = "Password must include at least one uppercase letter and one number.";
    }
    if (!confirmPassword) errs.confirmPassword = "Please confirm your new password.";
    else if (newPassword !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    if (currentPassword && newPassword && currentPassword === newPassword) {
      errs.newPassword = "New password must be different from your current password.";
    }
    return errs;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setApiError(null);
    setSavedMsg(null);

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    if (!token) {
      setApiError("You must be signed in to change your password.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await changePasswordApi(token, { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSavedMsg(res.message);
    } catch (err: any) {
      setApiError(err?.message || "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-zinc-900">{title}</h2>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>

      {savedMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {apiError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 ring-1 ring-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-4">
        <PasswordInput
          id="current-password"
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={fieldErrors.currentPassword}
          placeholder="Your current password"
        />
        <PasswordInput
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          error={fieldErrors.newPassword}
          placeholder="At least 8 characters, 1 uppercase, 1 number"
        />
        <PasswordInput
          id="confirm-new-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          placeholder="Repeat your new password"
        />

        <div className="pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {isSubmitting && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {isSubmitting ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}

