"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Mail,
  Phone,
  Clock,
  Lock,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "SUPER_ADMIN" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

export default function AdminTeamPage() {
  const { token, user, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api/v1";

  useEffect(() => {
    // Only Super Admin has access to team management
    if (!isSuperAdmin) {
      router.replace("/admin");
    }
  }, [isSuperAdmin, router]);

  async function loadAdmins() {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/admins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.admins)) {
        setAdmins(json.data.admins);
      } else {
        setNotice({ type: "error", message: json.error?.message || "Failed to load admin team." });
      }
    } catch {
      setNotice({ type: "error", message: "Failed to connect to backend server." });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      loadAdmins();
    }
  }, [token, isSuperAdmin]);

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, phone, password }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotice({ type: "success", message: `Operations Admin "${json.data.admin.name}" created successfully!` });
        setIsModalOpen(false);
        setName("");
        setEmail("");
        setPhone("");
        setPassword("");
        await loadAdmins();
      } else {
        setNotice({ type: "error", message: json.error?.message || "Could not create administrator." });
      }
    } catch {
      setNotice({ type: "error", message: "Network error creating administrator." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(id: string, newStatus: "ACTIVE" | "SUSPENDED") {
    if (!token) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/auth/admins/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotice({ type: "success", message: `Admin account status updated to ${newStatus}.` });
        await loadAdmins();
      } else {
        setNotice({ type: "error", message: json.error?.message || "Status change failed." });
      }
    } catch {
      setNotice({ type: "error", message: "Error changing admin status." });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <AdminLayout
      title="Administrators & Staff"
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAdmins}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isLoading ? "animate-spin text-[#ff9900]" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#ff9900] px-3.5 py-2 text-xs font-bold text-zinc-900 shadow-sm hover:bg-[#f08804] transition"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Operations Admin</span>
          </button>
        </div>
      }
    >
      {/* Toast Notice */}
      {notice && (
        <div
          className={`mb-4 flex items-center justify-between rounded-xl p-3.5 text-xs font-medium border shadow-sm ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Role Privilege Banner */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-900">
            <h3 className="font-bold">Administrative Access Control</h3>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Only <strong className="text-amber-950">Super Administrators</strong> possess authorization to add or revoke operations staff. Operations Admins manage orders, catalog health, and buyer inquiries, but cannot alter platform fees, manage escrow reserves, or modify other admin accounts.
            </p>
          </div>
        </div>
      </div>

      {/* Admins Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3">Administrator</th>
                <th className="px-5 py-3">Contact Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Role Authority</th>
                <th className="px-5 py-3">Account Status</th>
                <th className="px-5 py-3">Created On</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-[#ff9900]" />
                      <span>Loading administrator team...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const isSelf = admin.id === user?.id;
                  const isSuper = admin.role === "SUPER_ADMIN";
                  return (
                    <tr key={admin.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                          <span>{admin.name}</span>
                          {isSelf && (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] text-zinc-500 font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{admin.id}</div>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-zinc-800">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-zinc-400 shrink-0" />
                          <span>{admin.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-600">
                        {admin.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-zinc-400 shrink-0" />
                            <span>{admin.phone}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                            isSuper
                              ? "bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/20"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          <span>{isSuper ? "Super Admin (Root)" : "Operations Admin"}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                            admin.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {admin.status === "ACTIVE" ? "● Active" : "○ Suspended"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock className="h-3 w-3 text-zinc-400 shrink-0" />
                          <span>{new Date(admin.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {!isSelf && !isSuper && (
                          <div className="flex items-center justify-end gap-2">
                            {admin.status === "ACTIVE" ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(admin.id, "SUSPENDED")}
                                disabled={actionLoadingId === admin.id}
                                className="rounded bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                              >
                                {actionLoadingId === admin.id ? "Updating..." : "Suspend"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(admin.id, "ACTIVE")}
                                disabled={actionLoadingId === admin.id}
                                className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
                              >
                                {actionLoadingId === admin.id ? "Updating..." : "Reactivate"}
                              </button>
                            )}
                          </div>
                        )}
                        {isSuper && !isSelf && (
                          <span className="text-[10px] text-zinc-400 italic">Protected Root</span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] text-zinc-400 italic">Current Session</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Administrator Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">Add Operations Administrator</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-zinc-700">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwabena Mensah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700">Official Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. kwabena@nextdor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. +233 24 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700">Temporary Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-500 border border-zinc-200/60">
                <p>
                  Assigned role will be <strong className="text-zinc-800">ADMIN (Operations Admin)</strong>. They will gain access to orders, products catalog, customer support, and merchant review.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700 shadow-sm disabled:opacity-50 transition"
                >
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
