"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthFormField } from "@/components/account/AuthFormField";

const GHANA_REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Northern",
  "Upper East", "Upper West", "Volta", "Brong-Ahafo", "Western North",
  "Ahafo", "Bono East", "Oti", "Savannah", "North East",
];

export default function AdminSettingsPage() {
  const [storeName, setStoreName] = useState("Nextdor");
  const [email, setEmail] = useState("hello@nextdor.online");
  const [phone, setPhone] = useState("+233 20 000 0000");
  const [address, setAddress] = useState("Accra, Greater Accra, Ghana");
  const [currency, setCurrency] = useState("GHS");
  const [regions, setRegions] = useState<string[]>(["Greater Accra", "Ashanti"]);
  const [orderNotify, setOrderNotify] = useState(true);
  const [lowStockNotify, setLowStockNotify] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function toggleRegion(region: string) {
    setRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setSaved(true);
    setIsSaving(false);
  }

  return (
    <AdminLayout title="Settings">
      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle className="h-5 w-5 shrink-0" />
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} noValidate className="space-y-6">
        {/* Store info */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <h2 className="mb-4 font-semibold text-zinc-900">Store Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthFormField
              label="Store Name"
              id="store-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
              >
                <option value="GHS">GHS — Ghanaian Cedi</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <AuthFormField
              label="Contact Email"
              id="store-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <AuthFormField
              label="Phone Number"
              id="store-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="sm:col-span-2">
              <AuthFormField
                label="Store Address"
                id="store-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Delivery regions */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <h2 className="mb-1 font-semibold text-zinc-900">Delivery Regions</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Select regions where you offer delivery.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {GHANA_REGIONS.map((region) => (
              <label
                key={region}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  regions.includes(region)
                    ? "border-[#ff9900]/50 bg-[#fff3e0] text-zinc-900"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={regions.includes(region)}
                  onChange={() => toggleRegion(region)}
                  className="h-4 w-4 accent-[#ff9900]"
                />
                {region}
              </label>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <h2 className="mb-4 font-semibold text-zinc-900">Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4">
              <div>
                <p className="font-medium text-zinc-900">New Order Notifications</p>
                <p className="text-sm text-zinc-500">Get emailed when a new order is placed.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={orderNotify}
                onClick={() => setOrderNotify((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  orderNotify ? "bg-[#ff9900]" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    orderNotify ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4">
              <div>
                <p className="font-medium text-zinc-900">Low Stock Alerts</p>
                <p className="text-sm text-zinc-500">Get notified when a product is running low.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={lowStockNotify}
                onClick={() => setLowStockNotify((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  lowStockNotify ? "bg-[#ff9900]" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    lowStockNotify ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-[#ff9900] px-8 py-3 font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:opacity-70"
        >
          {isSaving && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
          )}
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </AdminLayout>
  );
}
