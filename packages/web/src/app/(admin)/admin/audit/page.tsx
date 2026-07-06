"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

interface Entry {
  id: string; action: string; target_type: string; target_id: string;
  created_at: string; admin_name?: string | null;
}

export default function AdminAuditPage() {
  const { data } = useSWR<{ items: Entry[] }>("/api/admin/audit?limit=50", swrFetcher, { shouldRetryOnError: false });
  const items = data?.items ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 text-[22px] font-black">Audit Log</h1>
      <div className="border border-itv-border">
        {items.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-itv-border px-4 py-2.5 text-[12px] last:border-b-0">
            <span className="font-mono text-itv-magenta">{e.action}</span>
            <span className="text-white/[0.6]">{e.target_type} · {e.target_id?.slice(0, 8)}</span>
            <span className="text-white/[0.45]">{e.admin_name ?? "system"}</span>
            <span className="text-white/[0.35]">{new Date(e.created_at).toLocaleString()}</span>
          </div>
        ))}
        {!items.length && <p className="p-4 text-sm text-white/[0.42]">No audit entries.</p>}
      </div>
    </div>
  );
}
