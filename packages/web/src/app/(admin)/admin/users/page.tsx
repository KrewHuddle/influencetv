"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

const ROLES = [
  "viewer_free", "viewer_premium", "viewer_ultra", "creator",
  "seller", "moderator", "channel_manager", "super_admin",
];

const LIMIT = 25;

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  subscription_plan: string;
  is_active: boolean;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, mutate, isLoading } = useSWR<{ items: AdminUser[]; total: number }>(
    `/api/admin/users?search=${encodeURIComponent(search)}&limit=${LIMIT}&page=${page}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  // Staged role change awaiting explicit confirmation.
  const [staged, setStaged] = useState<{ id: string; role: string } | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  const suspend = async (id: string, active: boolean) => {
    setSuspendingId(id);
    try {
      await api.post(`/api/admin/users/${id}/${active ? "suspend" : "unsuspend"}`, {
        reason: "admin action",
      });
      void mutate();
    } catch {
      toast({
        title: active ? "Suspend failed" : "Unsuspend failed",
        variant: "error",
      });
    } finally {
      setSuspendingId(null);
    }
  };

  const applyRole = async () => {
    if (!staged) return;
    setRoleBusy(true);
    try {
      await api.patch(`/api/admin/users/${staged.id}`, { role: staged.role });
      toast({ title: `Role updated to ${staged.role}` });
      setStaged(null);
      void mutate();
    } catch {
      toast({ title: "Role change failed", variant: "error" });
    } finally {
      setRoleBusy(false);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const items = data?.items ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-4 font-display text-2xl">Users</h1>
      <Input
        placeholder="Search email / name / username…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="mb-4 max-w-md"
      />
      <div className="overflow-x-auto rounded-lg border border-itv-border">
        <table className="w-full text-sm">
          <thead className="bg-itv-surface text-left text-xs uppercase text-itv-muted">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Email</th>
              <th className="p-3">Role</th><th className="p-3">Plan</th>
              <th className="p-3">Status</th><th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-itv-border">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="p-3">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && !items.length && (
              <tr className="border-t border-itv-border">
                <td colSpan={6} className="p-6 text-center text-sm text-itv-muted">
                  No users match.
                </td>
              </tr>
            )}
            {items.map((u) => (
              <tr key={u.id} className="border-t border-itv-border">
                <td className="p-3">{u.display_name ?? "—"}</td>
                <td className="p-3 text-itv-muted">{u.email}</td>
                <td className="p-3">
                  <select
                    value={staged?.id === u.id ? staged.role : u.role}
                    onChange={(e) =>
                      setStaged(
                        e.target.value === u.role ? null : { id: u.id, role: e.target.value }
                      )
                    }
                    disabled={roleBusy && staged?.id === u.id}
                    className="border border-itv-border bg-itv-surface2 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-itv-magenta disabled:opacity-40"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {staged?.id === u.id && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-itv-muted">
                      <span>Apply role → {staged.role}?</span>
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={applyRole}
                        disabled={roleBusy}
                      >
                        {roleBusy ? "Applying…" : "Confirm"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setStaged(null)}
                        disabled={roleBusy}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </td>
                <td className="p-3">{u.subscription_plan}</td>
                <td className="p-3">
                  <span className={u.is_active ? "text-itv-success" : "text-itv-magenta"}>
                    {u.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="p-3">
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => suspend(u.id, u.is_active)}
                    disabled={suspendingId === u.id}
                  >
                    {suspendingId === u.id ? "Working…" : u.is_active ? "Suspend" : "Unsuspend"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || isLoading}
        >
          Prev
        </Button>
        <span className="text-xs text-itv-muted">
          Page {page} of {totalPages}{total ? ` · ${total} users` : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || isLoading}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
