import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ChevronLeft, Database, Activity } from "lucide-react";

export const Route = createFileRoute("/_workspace/settings")({
  head: () => ({
    meta: [
      { title: "Settings — OmniFrog AI" },
      { name: "description", content: "General, AI provider, GitHub, deployment and security settings." },
      { property: "og:title", content: "Settings — OmniFrog AI" },
      { property: "og:description", content: "OmniFrog AI workspace settings." },
    ],
  }),
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sections marked for a later part show their real state — no connections are faked.
        </p>
      </header>
      <div className="flex flex-wrap gap-2"><Link to="/settings/databases" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-secondary"><Database className="size-4" /> Database Connections</Link><Link to="/settings/system" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-secondary"><Activity className="size-4" /> System Health & QA</Link></div>
      <Outlet />
    </div>
  );
}

export function SettingsBackLink() {
  return (
    <Link
      to="/settings"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      All settings
    </Link>
  );
}
