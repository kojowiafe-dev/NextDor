"use client";

import { useState } from "react";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  function validate() {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Current password is required.";
    if (!newPassword) errs.newPassword = "New password is required.";
    else if (newPassword.length < 8) errs.newPassword = "Password must be at least 8 characters.";
    if (!confirmPassword) errs.confirmPassword = "Please confirm your new password.";
    else if (newPassword !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    if (currentPassword && newPassword && currentPassword === newPassword)
      errs.newPassword = "New password must be different from your current password.";
    return errs;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setIsSubmitting(true);
    setSaved(false);
    // TODO: call API when backend is ready
    await new Promise((r) => setTimeout(r, 800));
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaved(true);
    setIsSubmitting(false);
  }

  function PasswordField({
    id,
    label,
    value,
    onChange,
    show,
    onToggle,
    error,
    placeholder,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggle: () => void;
    error?: string;
    placeholder?: string;
  }) {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
          {label} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id={id}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-lg border px-4 py-2.5 pr-10 text-sm text-zinc-900 outline-none transition-colors focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
              error ? "border-red-400 bg-red-50" : "border-zinc-300 bg-white hover:border-zinc-400"
            }`}
          />
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <AccountLayout>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Change Password</h2>
        <p className="mb-6 text-sm text-zinc-500">
          Choose a strong password to keep your account secure.
        </p>

        {saved && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 ring-1 ring-green-200">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Password changed successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="max-w-sm space-y-4">
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            error={errors.currentPassword}
            placeholder="Your current password"
          />
          <PasswordField
            id="new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            error={errors.newPassword}
            placeholder="At least 8 characters"
          />
          <PasswordField
            id="confirm-new-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            error={errors.confirmPassword}
            placeholder="Repeat your new password"
          />

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#ff9900] px-6 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:opacity-70"
            >
              {isSubmitting && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
              )}
              {isSubmitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </AccountLayout>
  );
}
