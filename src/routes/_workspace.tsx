import { useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
  type LinkProps,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  FolderKanban,
  LogOut,
  Menu,
  MonitorPlay,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from "lucide-react";

import { OmniFrogMark } from "@/components/omnifrog/brand";
import { Button } from "@/components/ui/button";
import { getAccessState, lock } from "@/lib/auth.functions";
import { cn } from "@/lib/utils";

type NavItem = {
  to: LinkProps["to"];
  label: string;
  icon: typeof Sparkles;
  hint?: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/build", label: "New Build", icon: Sparkles },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/preview", label: "Live Preview", icon: MonitorPlay, hint: "Later part" },
  { to: "/activity", label: "Build Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export const Route = createFileRoute("/_workspace")({
  beforeLoad: async () => {
    const state = await getAccessState();
    if (!state.authenticated) throw redirect({ to: "/" });
    return { sessionExpiresAt: state.expiresAt };
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const router = useRouter();
  const lockFn = useServerFn(lock);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await lockFn();
      await router.invalidate();
      await router.navigate({ to: "/", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          onClick={() => setMenuOpen(false)}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:bg-sidebar-accent/70 hover:text-foreground"
        >
          <item.icon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.hint ? (
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.hint}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="aurora-bg flex min-h-screen w-full max-w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 p-4 backdrop-blur-md lg:flex">
        <OmniFrogMark size="sm" subtitle="Builder" />
        <div className="mt-6 flex-1">{nav}</div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={signingOut}
          className="justify-start gap-3 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Lock workspace"}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-3 py-2.5 backdrop-blur-md lg:hidden">
          <OmniFrogMark size="sm" />
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleLogout}
              disabled={signingOut}
              aria-label="Lock workspace"
            >
              <LogOut className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </header>

        {menuOpen ? (
          <div className="border-b border-border bg-background/95 p-3 backdrop-blur-md lg:hidden">
            {nav}
          </div>
        ) : null}

        <main className={cn("min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-8")}>
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
