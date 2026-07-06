"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const ROLES = [
  "viewer_free", "viewer_premium", "viewer_ultra", "creator",
  "seller", "moderator", "channel_manager", "super_admin",
];

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  subscription_plan: string;
  is_active: boolean;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const { data, mutate } = useSWR<{ items: AdminUser[]; total: number }>(
    `/api/admin/users?search=${encodeURIComponent(search)}&limit=25`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const suspend = async (id: string, active: boolean) => {
    await api.post(`/api/admin/users/${id}/${active ? "suspend" : "unsuspend"}`, {
      reason: "admin action",
    });
    void mutate();
  };

  const setRole = async (id: string, role: string) => {
    await api.patch(`/api/admin/users/${id}`, { role });
    void mutate();
  };

  return (
    <div className="px-6 py-6">
      <h1 className="mb-4 font-display text-2xl">Users</h1>
      <Input
        placeholder="Search email / name / username…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="overflow-x-auto rounded-lg border border-apex">
        <table className="w-full text-sm">
          <thead className="bg-apex-gray-900 text-left text-xs uppercase text-[color:var(--text-muted)]">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Email</th>
              <th className="p-3">Role</th><th className="p-3">Plan</th>
              <th className="p-3">Status</th><th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((u) => (
              <tr key={u.id} className="border-t border-apex">
                <td className="p-3">{u.display_name ?? "—"}</td>
                <td className="p-3 text-[color:var(--text-secondary)]">{u.email}</td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) => setRole(u.id, e.target.value)}
                    className="border border-itv-border bg-itv-surface2 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-itv-magenta"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="p-3">{u.subscription_plan}</td>
                <td className="p-3">
                  <span className={u.is_active ? "text-green-400" : "text-apex-red"}>
                    {u.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="p-3">
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => suspend(u.id, u.is_active)}
                  >
                    {u.is_active ? "Suspend" : "Unsuspend"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
