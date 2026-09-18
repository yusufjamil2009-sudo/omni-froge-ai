import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Github, Link2, Loader2, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectGitHubAccount, getGitHubStatus, listGitHubRepos } from "@/lib/github.functions";

export const Route = createFileRoute("/github")({ component: GitHubPage });

type Repo = { id: number; name: string; full_name: string; private: boolean; default_branch: string };

function GitHubPage() {
  const getStatus = useServerFn(getGitHubStatus);
  const disconnect = useServerFn(disconnectGitHubAccount);
  const listRepos = useServerFn(listGitHubRepos);
  const [connected, setConnected] = useState(false);
  const [login, setLogin] = useState<string>();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const status = await getStatus();
      setConnected(status.connected);
      setLogin(status.login);
      setRepos(status.connected ? await listRepos() : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load GitHub status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") setMessage("GitHub connected successfully.");
    if (params.get("error")) setMessage(params.get("error")!);
    void refresh();
  }, []);

  async function disconnectAccount() {
    try {
      const result = await disconnect();
      document.cookie = result.clearCookie;
      setConnected(false);
      setLogin(undefined);
      setRepos([]);
      setMessage("GitHub disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect GitHub.");
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="glass-panel rounded-2xl p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-background p-2"><Github className="size-6" /></div>
          <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">OmniFrog AI · Part 15</p><h1 className="text-2xl font-semibold sm:text-4xl">GitHub Connect</h1></div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Connect GitHub to read repositories, write generated project files, create commits, and prepare pushes. Existing OmniFrog systems remain unchanged.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="soft-panel rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Connection</p>
          <div className="mt-3 flex items-center gap-3">
            <ShieldCheck className="size-5" />
            <div><p className="font-medium">{connected ? `Connected as ${login ?? "GitHub user"}` : "GitHub not connected"}</p><p className="text-sm text-muted-foreground">OAuth access token is kept server-side in an HttpOnly cookie.</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {!connected ? <Button asChild><a href="/api/github/connect"><Link2 className="size-4" /> Connect GitHub</a></Button> : <Button variant="outline" onClick={() => void disconnectAccount()}><LogOut className="size-4" /> Disconnect</Button>}
            <Button variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
          </div>
          {message ? <p className="mt-3 rounded-lg border border-border bg-background/70 p-3 text-sm">{message}</p> : null}
        </div>

        <div className="soft-panel rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">GitHub OAuth Setup</p>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>1. Create the GitHub OAuth App.</li>
            <li>2. Set the Client ID and Client Secret on the deployed server.</li>
            <li>3. Set GITHUB_OAUTH_SECRET to a strong random server secret.</li>
            <li>4. Set GITHUB_CALLBACK_URL to this exact deployed callback.</li>
          </ol>
          <code className="mt-4 block overflow-x-auto rounded-lg bg-background p-3 text-xs">https://YOUR-DOMAIN/api/github/callback</code>
          <p className="mt-3 text-xs text-muted-foreground">The app already contains the OAuth flow; only your GitHub application credentials and final public callback URL remain environment configuration.</p>
        </div>
      </section>

      <section className="soft-panel rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Repositories</p><h2 className="mt-1 text-xl font-semibold">Available repositories</h2></div><span className="text-sm text-muted-foreground">{repos.length} loaded</span></div>
        {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading GitHub connection…</div> : repos.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">Connect GitHub to load repositories.</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{repos.map((repo) => <div key={repo.id} className="rounded-xl border border-border bg-background/70 p-3"><p className="font-medium">{repo.full_name}</p><p className="text-xs text-muted-foreground">{repo.private ? "Private" : "Public"} · default: {repo.default_branch}</p></div>)}</div>}
      </section>

      <section className="soft-panel rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Part 15 capabilities</p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {["Repository selection", "Branch-aware file read", "Generated file write", "Commit preparation", "OAuth state protection", "Server-side token storage", "GitHub API error handling", "Disconnect / reconnect"].map((item) => <div key={item} className="rounded-lg border border-border bg-background/60 px-3 py-2">{item}</div>)}
        </div>
      </section>
    </main>
  );
}
