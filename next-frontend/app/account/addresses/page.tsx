"use client";

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AuthFormField } from "@/components/account/AuthFormField";

type Address = {
  id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  region: string;
  gps?: string;
};

// Mock saved addresses
const INITIAL_ADDRESSES: Address[] = [
  {
    id: "addr-1",
    label: "Home",
    name: "Kwame Mensah",
    street: "12 Independence Avenue",
    city: "Accra",
    region: "Greater Accra",
    gps: "GA-123-4567",
  },
];

const GHANA_REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Northern",
  "Upper East", "Upper West", "Volta", "Brong-Ahafo", "Western North",
  "Ahafo", "Bono East", "Oti", "Savannah", "North East",
];

type AddressFormValues = Omit<Address, "id">;
const EMPTY_FORM: AddressFormValues = { label: "Home", name: "", street: "", city: "", region: "", gps: "" };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<AddressFormValues>>({});
  const [isSaving, setIsSaving] = useState(false);

  function validate() {
    const errs: Partial<AddressFormValues> = {};
    if (!form.name.trim()) errs.name = "Full name is required.";
    if (!form.street.trim()) errs.street = "Street address is required.";
    if (!form.city.trim()) errs.city = "City is required.";
    if (!form.region) errs.region = "Region is required.";
    return errs;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setIsSaving(true);
    // Simulate save delay
    await new Promise((r) => setTimeout(r, 600));
    setAddresses((prev) => [...prev, { ...form, id: `addr-${Date.now()}` }]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setIsSaving(false);
  }

  function handleDelete(id: string) {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <AccountLayout>
      <div className="space-y-4">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">My Addresses</h2>
              <p className="text-sm text-zinc-500">Manage your delivery addresses</p>
            </div>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804]"
              >
                <Plus className="h-4 w-4" />
                Add Address
              </button>
            )}
          </div>

          {/* Saved addresses */}
          {addresses.length > 0 ? (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-4"
                >
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#ff9900]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-zinc-900">{addr.name}</p>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          {addr.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-600">{addr.street}</p>
                      <p className="text-sm text-zinc-600">
                        {addr.city}, {addr.region}
                      </p>
                      {addr.gps && (
                        <p className="mt-0.5 text-xs text-zinc-400">GPS: {addr.gps}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.id)}
                    className="shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <MapPin className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
              <p className="text-sm text-zinc-500">No saved addresses yet.</p>
            </div>
          )}
        </div>

        {/* Add address form */}
        {showForm && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <h3 className="mb-4 font-semibold text-zinc-900">New Address</h3>
            <form onSubmit={handleSave} noValidate className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">
                    Label
                  </label>
                  <select
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
                  >
                    {["Home", "Work", "Other"].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <AuthFormField
                  label="Full name"
                  id="addr-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={errors.name}
                  required
                />
              </div>
              <AuthFormField
                label="Street address"
                id="addr-street"
                value={form.street}
                onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                error={errors.street}
                placeholder="12 Independence Avenue"
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthFormField
                  label="City"
                  id="addr-city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  error={errors.city}
                  placeholder="Accra"
                  required
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">
                    Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
                      errors.region ? "border-red-400 bg-red-50" : "border-zinc-300"
                    }`}
                  >
                    <option value="">Select region</option>
                    {GHANA_REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  {errors.region && (
                    <p className="text-xs text-red-600">{errors.region}</p>
                  )}
                </div>
              </div>
              <AuthFormField
                label="Ghana Post GPS (optional)"
                id="addr-gps"
                value={form.gps ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, gps: e.target.value }))}
                placeholder="e.g. GA-123-4567"
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-[#ff9900] px-6 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#f08804] disabled:opacity-70"
                >
                  {isSaving && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
                  )}
                  {isSaving ? "Saving..." : "Save Address"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setErrors({}); }}
                  className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
