import { useEffect, useMemo, useState } from "react";
import { CircleStop, Maximize2, Monitor, Play, RefreshCw, RotateCcw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewSourceFile, PreviewState } from "@/lib/omnifrog/types";
import { buildRuntimeDocument, createRuntimeManifest, type RuntimeStatus } from "@/lib/omnifrog/runtime";
import { cn } from "@/lib/utils";

export function PreviewPanel({ preview, previewFiles, className }:{preview:PreviewState;previewFiles:PreviewSourceFile[];className?:string}) {
 const [device,setDevice]=useState<"desktop"|"mobile">("desktop");
 const [fullscreen,setFullscreen]=useState(false);
 const [status,setStatus]=useState<RuntimeStatus>("IDLE");
 const [revision,setRevision]=useState(0);
 const [diagnostic,setDiagnostic]=useState<string|null>(null);
 const manifest=useMemo(()=>createRuntimeManifest(previewFiles),[previewFiles]);
 const srcDoc=useMemo(()=>buildRuntimeDocument(previewFiles),[previewFiles,revision]);
 useEffect(()=>{setStatus(srcDoc?"STARTING":"IDLE");setDiagnostic(manifest.diagnostics.find(d=>d.level==="error")?.message??null);},[srcDoc,manifest]);
 useEffect(()=>{const onMessage=(event:MessageEvent)=>{if(event.data?.source!=="omnifrog-runtime")return;if(event.data.type==="ready"){setStatus("RUNNING");setDiagnostic(null);}if(event.data.type==="error"){setStatus("ERROR");setDiagnostic(String(event.data.payload?.message??"Runtime error"));}if(event.data.type==="console"&&event.data.payload?.level==="error"){setStatus("ERROR");setDiagnostic(String(event.data.payload?.message??"Runtime error"));}};window.addEventListener("message",onMessage);return()=>window.removeEventListener("message",onMessage);},[]);
 const reload=()=>{setDiagnostic(null);setStatus(srcDoc?"STARTING":"IDLE");setRevision(v=>v+1)};
 const stop=()=>{setStatus("STOPPED");setRevision(v=>v+1)};
 return <section className={cn("soft-panel flex min-w-0 flex-col rounded-xl",fullscreen&&"fixed inset-2 z-50 bg-background shadow-2xl sm:inset-6",className)}>
  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3 sm:p-4">
   <div><h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live Preview Runtime</h2><p className="mt-1 text-[11px] text-muted-foreground">{status} · {manifest.kind}{manifest.framework ? " · "+manifest.framework : ""}</p></div>
   <div className="flex items-center gap-1">
    <Button size="icon" variant={device==="desktop"?"secondary":"ghost"} aria-label="Desktop preview" onClick={()=>setDevice("desktop")}><Monitor className="size-4"/></Button>
    <Button size="icon" variant={device==="mobile"?"secondary":"ghost"} aria-label="Mobile preview" onClick={()=>setDevice("mobile")}><Smartphone className="size-4"/></Button>
    <Button size="icon" variant="ghost" aria-label="Start or restart runtime" disabled={!srcDoc} onClick={reload}>{status==="STOPPED"?<Play className="size-4"/>:<RotateCcw className="size-4"/>}</Button>
    <Button size="icon" variant="ghost" aria-label="Stop runtime" disabled={status!=="RUNNING"&&status!=="STARTING"} onClick={stop}><CircleStop className="size-4"/></Button>
    <Button size="icon" variant="ghost" aria-label="Refresh runtime" disabled={!srcDoc} onClick={reload}><RefreshCw className="size-4"/></Button>
    <Button size="icon" variant="ghost" aria-label={fullscreen?"Exit fullscreen":"Open fullscreen preview"} onClick={()=>setFullscreen(v=>!v)}>{fullscreen?<X className="size-4"/>:<Maximize2 className="size-4"/>}</Button>
   </div>
  </header>
  {diagnostic&&<div className="border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{diagnostic}</div>}
  <div className="flex min-h-[24rem] flex-1 items-center justify-center overflow-auto bg-secondary/20 p-3 sm:p-5">
   {srcDoc ? <div className={cn("h-[32rem] w-full",device==="mobile"&&"max-w-[390px]")}><iframe key={revision} title="OmniFrog isolated project runtime" srcDoc={srcDoc} sandbox="allow-scripts" className="h-full w-full rounded-lg border border-border bg-white shadow-sm" /></div> : <div className="max-w-md text-center"><p className="text-sm font-medium">{manifest.kind==="unsupported-framework"?"Framework detected; browser-ready entry is required":"No runnable project entry found"}</p><p className="mt-2 text-xs text-muted-foreground">{manifest.diagnostics[0]?.message??"Add an index.html to use the built-in sandbox runtime."}</p></div>}
  </div>
 </section>;
}
