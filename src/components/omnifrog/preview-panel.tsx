import { useEffect, useMemo, useState } from "react";
import { CircleStop, Maximize2, Monitor, Play, RefreshCw, RotateCcw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewSourceFile, PreviewState } from "@/lib/omnifrog/types";
import { buildRuntimeDocument, createRuntimeManifest, type RuntimeStatus } from "@/lib/omnifrog/runtime";
import { startProjectRuntime, stopProjectRuntime } from "@/lib/runtime.functions";
import { cn } from "@/lib/utils";

type Props = { projectId?: string; preview: PreviewState; previewFiles: PreviewSourceFile[]; className?: string };

export function PreviewPanel({ projectId, preview, previewFiles, className }: Props) {
 const [device,setDevice]=useState<"desktop"|"mobile">("desktop");
 const [fullscreen,setFullscreen]=useState(false);
 const [status,setStatus]=useState<RuntimeStatus>("IDLE");
 const [revision,setRevision]=useState(0);
 const [running,setRunning]=useState(false);
 const [diagnostic,setDiagnostic]=useState<string|null>(null);
 const [runtimeUrl,setRuntimeUrl]=useState<string|null>(null);
 const [runtimeId,setRuntimeId]=useState<string|null>(null);
 const [logs,setLogs]=useState<string[]>([]);
 const [starting,setStarting]=useState(false);
 const [resolvedProjectId,setResolvedProjectId]=useState(projectId ?? "");
 const manifest=useMemo(()=>createRuntimeManifest(previewFiles),[previewFiles]);
 const srcDoc=useMemo(()=>buildRuntimeDocument(previewFiles),[previewFiles,revision]);

 useEffect(()=>{if(projectId){setResolvedProjectId(projectId);return;} const match=window.location.pathname.match(/(?:projects|build)\/([^/]+)/); if(match) setResolvedProjectId(match[1]);},[projectId]);
 useEffect(()=>{setDiagnostic(manifest.diagnostics.find(d=>d.level==="error")?.message??null); if(srcDoc && !runtimeId) setStatus("IDLE");},[srcDoc,manifest,runtimeId]);
 useEffect(()=>()=>{if(runtimeId) void stopProjectRuntime({data:{runtimeId}}).catch(()=>undefined)},[runtimeId]);

 const start=async()=>{if(!previewFiles.length||starting||!resolvedProjectId)return; setStarting(true); setDiagnostic(null); setStatus("STARTING"); try { const result=await startProjectRuntime({data:{projectId:resolvedProjectId,files:previewFiles}}); if(!result.ok) throw new Error("Runtime start failed."); setRuntimeId(result.runtime.id); setRuntimeUrl(result.runtime.url); setLogs(result.runtime.logs); setStatus(result.runtime.status==="RUNNING"?"RUNNING":"STARTING"); setRunning(true); } catch(error) { setStatus("ERROR"); setDiagnostic(error instanceof Error?error.message:String(error)); } finally { setStarting(false); }};
 const stop=async()=>{if(runtimeId){try{await stopProjectRuntime({data:{runtimeId}});}catch{}} setRunning(false); setRuntimeId(null); setRuntimeUrl(null); setStatus("STOPPED");};
 const reload=async()=>{await stop(); setRevision(v=>v+1); await start();};

 return <section className={cn("soft-panel flex min-w-0 flex-col rounded-xl",fullscreen&&"fixed inset-2 z-50 bg-background shadow-2xl sm:inset-6",className)}>
  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3 sm:p-4">
   <div><h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live Preview Runtime</h2><p className="mt-1 text-[11px] text-muted-foreground">{status} · {manifest.kind}{manifest.framework ? " · "+manifest.framework : ""}</p></div>
   <div className="flex items-center gap-1">
    <Button size="icon" variant={device==="desktop"?"secondary":"ghost"} aria-label="Desktop preview" onClick={()=>setDevice("desktop")}><Monitor className="size-4"/></Button>
    <Button size="icon" variant={device==="mobile"?"secondary":"ghost"} aria-label="Mobile preview" onClick={()=>setDevice("mobile")}><Smartphone className="size-4"/></Button>
    <Button size="icon" variant="ghost" aria-label="Start or restart runtime" disabled={!resolvedProjectId||!previewFiles.length||starting} onClick={running?reload:start}>{running?<RotateCcw className="size-4"/>:<Play className="size-4" />}</Button>
    <Button size="icon" variant="ghost" aria-label="Stop runtime" disabled={!running&&!starting} onClick={stop}><CircleStop className="size-4"/></Button>
    <Button size="icon" variant="ghost" aria-label="Refresh runtime" disabled={!resolvedProjectId||!previewFiles.length||starting} onClick={reload}><RefreshCw className="size-4"/></Button>
    <Button size="icon" variant="ghost" aria-label={fullscreen?"Exit fullscreen":"Open fullscreen preview"} onClick={()=>setFullscreen(v=>!v)}>{fullscreen?<X className="size-4"/>:<Maximize2 className="size-4"/>}</Button>
   </div>
  </header>
  {diagnostic&&<div className="border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{diagnostic}</div>}
  {runtimeUrl&&<div className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">Sandbox runtime: {runtimeUrl} · Docker isolated process · dependencies installed in temporary workspace</div>}
  {logs.length>0&&<details className="border-b border-border px-3 py-2"><summary className="cursor-pointer text-[11px] font-medium">Runtime logs ({logs.length})</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">{logs.join("\n")}</pre></details>}
  <div className="flex min-h-[24rem] flex-1 items-center justify-center overflow-auto bg-secondary/20 p-3 sm:p-5">
   {runtimeUrl ? <div className={cn("h-[32rem] w-full",device==="mobile"&&"max-w-[390px]")}><iframe title="OmniFrog isolated project runtime" src={runtimeUrl} sandbox="allow-scripts allow-forms allow-modals" className="h-full w-full rounded-lg border border-border bg-white shadow-sm" /></div> : srcDoc ? <div className={cn("h-[32rem] w-full",device==="mobile"&&"max-w-[390px]")}><iframe key={revision} title="OmniFrog browser runtime fallback" srcDoc={srcDoc} sandbox="allow-scripts" className="h-full w-full rounded-lg border border-border bg-white shadow-sm" /></div> : <div className="max-w-md text-center"><p className="text-sm font-medium">{manifest.kind==="unsupported-framework"?"Framework detected; start the sandbox runtime":"No runnable project entry found"}</p><p className="mt-2 text-xs text-muted-foreground">{manifest.diagnostics[0]?.message??"Add project files to start the sandbox runtime."}</p></div>}
  </div>
 </section>;
}
