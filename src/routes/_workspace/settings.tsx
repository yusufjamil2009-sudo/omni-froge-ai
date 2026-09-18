import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { lock } from "@/lib/auth.functions";

export const Route = createFileRoute("/_workspace/settings")({
  head: () => ({
    meta: [
      { title: "Settings — OmniFrog AI" },
      { name: "description", content: "General, AI provider, GitHub, deployment and security settings." },
      { property: "og:title", content: "Settings — OmniFrog AI" },
      { property: "og:description", content: "OmniFrog AI workspace settings." },
    ],
  }),
  component: SettingsScreen,
});

type Section = {
  id: string;
  title: string;
  description: string;
  state: "active" | "later";
  note: string;
};

const SECTIONS: Section[] = [
  {
    id: "general",
    title: "General",
    description: "Workspace identity and defaults for new build requests.",
    state: "active",
    note: "Private single-owner workspace. No guest or public accounts exist.",
  },
  {
    id: "providers",
    title: "AI Providers",
    description: "Provider keys, model catalogue and routing preferences.",
    state: "later",
    note: "The API Manager arrives in PART 02. Nothing is connected yet.",
  },
  {
    id: "github",
    title: "GitHub",
    description: "Repository sync, branches and commits for generated projects.",
    state: "later",
    note: "GitHub connection arrives in a later part.",
  },
  {
    id: "deployment",
    title: "Deployment",
    description: "Vercel and Netlify targets and deployment URLs.",
    state: "later",
    note: "Deployment connections arrive in a later part.",
  },
  {
    id: "security",
    title: "Security",
    description: "Private access, session lifetime and failed-attempt throttling.",
    state: "active",
    note: "Password is verified on the server and stored only as a deployment secret. Sessions are signed, httpOnly and expire after 12 hours.",
  },
  {
    id: "project",
    title: "Project Settings",
    description: "Per-project build, preview and file options.",
    state: "later",
    note: "Expands as the coding engine and preview systems connect.",
  },
];

function SettingsScreen() {
  const router = useRouter();
  const lockFn = useServerFn(lock);
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

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sections marked for a later part show their real state — no connections are faked.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <section key={section.id} className="soft-panel min-w-0 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-medium">{section.title}</h2>
              <span
                className={
                  section.state === "active"
                    ? "shrink-0 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success"
                    : "shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                }
              >
                {section.state === "active" ? "Active" : "Not connected"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">{section.note}</p>
          </section>
        ))}
      </div>

      <section className="soft-panel rounded-xl p-4">
        <h2 className="font-medium">Session</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Locking the workspace destroys the session immediately and returns to the private access
          screen.
        </p>
        <Button variant="secondary" className="mt-4" onClick={handleLogout} disabled={signingOut}>
          {signingOut ? "Locking…" : "Lock workspace"}
        </Button>
      </section>
    </div>
  );
}
