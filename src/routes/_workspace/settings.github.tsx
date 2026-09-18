import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Github, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startGithubOAuth, getGithubStatus, disconnectGithub, listGithubRepos } from "@/lib/github.functions";

export const Route = createFileRoute("/_workspace/settings/github")({
  head: () => ({ meta: [{ title: "GitHub — OmniFrog AI" }] }),
  component: GithubSettings,
});

function GithubSettings() {
  const start = useServerFn(startGithubOAuth);
  const statusFn = useServerFn(getGithubStatus);
  const disconnect = useServerFn(disconnectGithub);
  const reposFn = useServerFn(listGithubRepos);
  const [status, setStatus] = useState<{connected:boolean;login:string|null;avatarUrl:string|null;profileUrl:string|null}>({connected:false,login:null,avatarUrl:null,profileUrl:null});
  const [repos, setRepos] = useState<Array<{full_name:string;private:boolean;default_branch:string;html_url:string}>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const s = await statusFn();
    setStatus(s);
    if (s.connected) setRepos(await reposFn());
  }
  useEffect(() => { refresh().catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load GitHub status.")); }, []);

  async function connect() {
    setBusy(true); setMessage("");
    try { const result = await start(); window.location.href = result.url; }
    catch (e) { setMessage(e instanceof Error ? e.message : "Unable to start GitHub connection."); setBusy(false); }
  }

  async function disconnectNow() {
    setBusy(true);
    try { await disconnect(); setRepos([]); setStatus({connected:false,login:null,avatarUrl:null,profileUrl:null}); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">GitHub Connect</h1>
      <p className="mt-1 text-sm text-muted-foreground">Connect one GitHub account for repository read, file sync, commits and pushes.</p>
    </div>
    <section className="soft-panel rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {status.avatarUrl ? <img src={status.avatarUrl} alt="" className="size-10 rounded-full border" /> : <div className="grid size-10 place-items-center rounded-full border"><Github className="size-5" /></div>}
          <div><p className="font-medium">{status.connected ? `Connected as @${status.login}` : "GitHub not connected"}</p><p className="text-xs text-muted-foreground">{status.connected ? "Repository access is available to OmniFrog." : "OAuth app credentials are required on the deployment before connecting."}</p></div>
        </div>
        {status.connected ? <Button variant="outline" onClick={disconnectNow} disabled={busy}><LogOut className="mr-2 size-4" />Disconnect</Button> : <Button onClick={connect} disabled={busy}><Github className="mr-2 size-4" />{busy ? "Opening GitHub…" : "Connect GitHub"}</Button>}
      </div>
      {message ? <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{message}</p> : null}
    </section>
    {status.connected ? <section className="soft-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-medium">Repositories</h2><Button size="icon" variant="ghost" onClick={() => refresh()} aria-label="Refresh repositories"><RefreshCw className="size-4" /></Button></div>
      <div className="space-y-2">{repos.map((repo) => <div key={repo.full_name} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{repo.full_name}</p><p className="text-xs text-muted-foreground">{repo.private ? "Private" : "Public"} · default: {repo.default_branch}</p></div><a className="text-xs text-primary" href={repo.html_url} target="_blank" rel="noreferrer">Open</a></div>)}</div>
    </section> : null}
  </div>;
}
