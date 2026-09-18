import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDatabaseConnections, testDatabase } from "@/lib/database.functions";

export const Route = createFileRoute("/_workspace/settings/databases")({ component: DatabasesSettings });

const PROVIDERS = [
  {id:"supabase",name:"Supabase",desc:"Postgres database + auth + storage already used by OmniFrog."},
  {id:"turso",name:"Turso",desc:"LibSQL/SQLite-compatible database for lightweight projects."},
  {id:"convex",name:"Convex",desc:"Reactive backend database/runtime connection."},
  {id:"appwrite",name:"Appwrite",desc:"Database/backend service connection."},
] as const;

function DatabasesSettings(){
  const query=useQuery({queryKey:["omnifrog","database-connections"],queryFn:()=>useServerFn(getDatabaseConnections)(),refetchInterval:30000});
  const test=useServerFn(testDatabase);
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-semibold sm:text-3xl">Database Connections</h1><p className="mt-1 text-sm text-muted-foreground">Connect Supabase, Turso, Convex and Appwrite without exposing secrets to the browser.</p></header>
    <div className="grid gap-4 md:grid-cols-2">
      {PROVIDERS.map(p=>{ const configured=Boolean(query.data?.[p.id as keyof typeof query.data]?.configured); return <section key={p.id} className="glass-panel rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><Database className="size-4"/>{p.name}</div><p className="mt-2 text-sm text-muted-foreground">{p.desc}</p></div>
        {configured?<CheckCircle2 className="size-5 text-emerald-500"/>:<XCircle className="size-5 text-muted-foreground"/>}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full border px-3 py-1 text-xs">{configured?"Configured":"Not configured"}</span>
        <Button size="sm" variant="secondary" onClick={async()=>{await test({data:{provider:p.id}}); await query.refetch();}}><RefreshCw className="size-3.5"/> Test connection</Button></div>
      </section>})}
    </div>
    <p className="text-xs text-muted-foreground">Credentials are server environment variables. This page never displays or stores secret values.</p>
  </div>;
}
