import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSystemHealthFn } from "@/lib/system-health.functions";
import { SettingsBackLink } from "../settings";

export const Route = createFileRoute("/_workspace/settings/system")({ component: SystemHealthPage });

function SystemHealthPage() {
  const health = useQuery({ queryKey: ["system-health"], queryFn: () => getSystemHealthFn(), refetchInterval: 30000 });
  return <div className="space-y-5">
    <SettingsBackLink />
    <header><h2 className="text-xl font-semibold">System Health & QA</h2><p className="text-sm text-muted-foreground">Final integration checks for the OmniFrog runtime.</p></header>
    {health.isLoading ? <div className="rounded-xl border p-4 text-sm">Running checks…</div> : health.error ? <div className="rounded-xl border border-destructive/40 p-4 text-sm">Health check failed. The authenticated server endpoint could not be reached.</div> : health.data ? <>
      <div className="rounded-2xl border p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Overall</div><div className="mt-1 text-2xl font-semibold">{health.data.state}</div><div className="mt-1 text-xs text-muted-foreground">Checked {new Date(health.data.checkedAt).toLocaleString()}</div></div>
      <div className="grid gap-3 sm:grid-cols-2">{health.data.checks.map(check => <div key={check.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><span className="font-medium">{check.label}</span><span className="text-xs font-semibold">{check.state}</span></div><p className="mt-2 text-xs text-muted-foreground">{check.detail}</p></div>)}</div>
    </> : null}
  </div>;
}
