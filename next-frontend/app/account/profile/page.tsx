"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AuthFormField } from "@/components/account/AuthFormField";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [errors, setErrors] = useState<{ name?: string; email?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  function validate() {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Please enter a valid email address.";
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
    setSaved(false);
    try {
      await updateProfile({ name, email, phone: phone || undefined });
      setSaved(true);
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : "Failed to save changes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AccountLayout>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">My Profile</h2>
        <p className="mb-6 text-sm text-zinc-500">
          Update your personal information below.
        </p>

        {/* Avatar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#232f3e] text-xl font-bold text-[#ff9900]">
            {user?.avatarInitials ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-zinc-900">{user?.name}</p>
            <p className="text-sm text-zinc-500">Member since 2026</p>
          </div>
        </div>

        {saved && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 ring-1 ring-green-200">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Profile updated successfully!
          </div>
        )}

        {errors.general && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <AuthFormField
            label="Full name"
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
          />
          <AuthFormField
            label="Email address"
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />
          <AuthFormField
            label="Phone number (optional)"
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 XX XXX XXXX"
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#ff9900] px-6 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:opacity-70"
            >
              {isSubmitting && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
              )}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(user?.name ?? "");
                setEmail(user?.email ?? "");
                setPhone(user?.phone ?? "");
                setErrors({});
                setSaved(false);
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Discard
            </button>
          </div>
        </form>
      </div>
    </AccountLayout>
  );
}
