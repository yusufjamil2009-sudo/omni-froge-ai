import { useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Lock, ArrowRight } from "lucide-react";

import { OmniFrogMark } from "@/components/omnifrog/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccessState, unlock } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OmniFrog AI — Private Workspace Access" },
      {
        name: "description",
        content: "Enter your access password to open the private OmniFrog AI workspace.",
      },
      { property: "og:title", content: "OmniFrog AI — Private Workspace Access" },
      {
        property: "og:description",
        content: "Private, password-protected access to the OmniFrog AI builder workspace.",
      },
    ],
  }),
  beforeLoad: async () => {
    const state = await getAccessState();
    if (state.authenticated) throw redirect({ to: "/build" });
  },
  component: PrivateAccessScreen,
});

function PrivateAccessScreen() {
  const router = useRouter();
  const unlockFn = useServerFn(unlock);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "verifying" | "granted" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "verifying" || password.length === 0) return;

    setStatus("verifying");
    setMessage(null);
    try {
      const result = await unlockFn({ data: { password } });
      if (result.ok) {
        setStatus("granted");
        setPassword("");
        await router.invalidate();
        await router.navigate({ to: "/build" });
        return;
      }
      setStatus("error");
      setMessage(`${result.error.message} (ref ${result.error.errorId})`);
    } catch {
      setStatus("error");
      setMessage("Authentication failed.");
    }
  }

  const busy = status === "verifying" || status === "granted";

  return (
    <main className="aurora-bg flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rise-in">
        <div className="glass-panel rounded-2xl p-6 sm:p-8">
          <OmniFrogMark size="lg" subtitle="Private Workspace" />

          <p className="mt-6 text-sm text-muted-foreground">
            Enter your access password to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-password" className="text-xs uppercase tracking-[0.16em]">
                Access password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="access-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  className="h-12 pl-9 pr-11 font-mono"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  aria-label={visible ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy || password.length === 0}
              className="h-12 w-full gradient-primary text-base font-semibold text-primary-foreground glow-primary transition-smooth"
            >
              {status === "verifying" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Verifying…
                </>
              ) : status === "granted" ? (
                "Secure session established"
              ) : (
                <>
                  Unlock OmniFrog AI <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <div aria-live="polite" className="min-h-6">
            {status === "error" && message ? (
              <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message}
              </p>
            ) : null}
            {status === "granted" ? (
              <p className="mt-3 text-sm text-success">Opening your workspace…</p>
            ) : null}
          </div>

          <p className="mt-6 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
            Private single-owner workspace. Password verification happens on the server; there is no
            signup, guest access or social login.
          </p>
        </div>
      </div>
    </main>
  );
}
