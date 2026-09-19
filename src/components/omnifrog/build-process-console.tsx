import { useMemo, useState } from "react";
import { ChevronDown, FileCode2, GitCompareArrows, Loader2 } from "lucide-react";
import type { ActivityEvent, GeneratedFile } from "@/lib/omnifrog/types";
import { cn } from "@/lib/utils";

function DiffBlock({ before, after }: { before: string; after: string }) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const max = Math.max(oldLines.length, newLines.length);
  return (
    <div className="overflow-x-auto rounded-lg border bg-background font-mono text-[11px] leading-5">
      <div className="grid min-w-[620px] grid-cols-2 border-b bg-muted/50 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Before</span><span>After</span>
      </div>
      <div className="grid min-w-[620px] grid-cols-2">
        <pre className="m-0 border-r p-2">{Array.from({length:max},(_,i)=>
          <div key={i} className={cn("min-h-5 whitespace-pre", oldLines[i] !== newLines[i] && "bg-red-500/10 text-red-700 dark:text-red-300")}>
            <span className="mr-2 select-none text-muted-foreground">{i+1}</span>{oldLines[i] ?? ""}
          </div>)}</pre>
        <pre className="m-0 p-2">{Array.from({length:max},(_,i)=>
          <div key={i} className={cn("min-h-5 whitespace-pre", oldLines[i] !== newLines[i] && "bg-green-500/10 text-green-700 dark:text-green-300")}>
            <span className="mr-2 select-none text-muted-foreground">{i+1}</span>{newLines[i] ?? ""}
          </div>)}</pre>
      </div>
    </div>
  );
}

export function BuildProcessConsole({
  events,
  generatedFiles,
  running,
}: {
  events: ActivityEvent[];
  generatedFiles: GeneratedFile[];
  running: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const agentEvents = useMemo(() => events.filter((e) => e.agentId), [events]);
  const fileEvents = useMemo(() => events.filter((e) => e.filePath), [events]);

  return (
    <section className="glass-panel rounded-2xl p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Live Build Process</h2>
          <p className="text-xs text-muted-foreground">Agents, parallel work, files, tests, bugs and repairs — in one place.</p>
        </div>
        {running ? <span className="inline-flex items-center gap-1.5 text-xs text-primary"><Loader2 className="size-3.5 animate-spin" /> Live</span> : null}
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border p-2"><div className="text-[10px] uppercase text-muted-foreground">Agents</div><div className="font-semibold">{new Set(agentEvents.map(e => e.agentId)).size}</div></div>
        <div className="rounded-lg border p-2"><div className="text-[10px] uppercase text-muted-foreground">File events</div><div className="font-semibold">{fileEvents.length + generatedFiles.length}</div></div>
        <div className="rounded-lg border p-2"><div className="text-[10px] uppercase text-muted-foreground">Errors</div><div className="font-semibold text-destructive">{events.filter(e => e.level === "error").length}</div></div>
        <div className="rounded-lg border p-2"><div className="text-[10px] uppercase text-muted-foreground">Events</div><div className="font-semibold">{events.length}</div></div>
      </div>

      <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {generatedFiles.map((file) => {
          const id = "generated:" + file.path;
          const isOpen = open === id;
          return (
            <div key={id} className="rounded-lg border bg-background/70">
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(isOpen ? null : id)}>
                <FileCode2 className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px]">{file.operation}</span>
                <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen ? <div className="border-t p-2"><DiffBlock before="" after={file.content} /></div> : null}
            </div>
          );
        })}

        {fileEvents.map((event) => {
          const id = event.id;
          const details = event.details ?? {};
          const before = typeof details.before === "string" ? details.before : "";
          const after = typeof details.after === "string" ? details.after : "";
          const isOpen = open === id;
          return (
            <div key={id} className="rounded-lg border bg-background/70">
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(isOpen ? null : id)}>
                <GitCompareArrows className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{event.filePath}</span>
                <span className="text-[10px] text-muted-foreground">{event.operation ?? "file change"}</span>
                <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen ? <div className="border-t p-2">{before || after ? <DiffBlock before={before} after={after} /> : <pre className="overflow-x-auto p-2 text-[11px]">{event.message}</pre>}</div> : null}
            </div>
          );
        })}

        {events.length === 0 && generatedFiles.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Waiting for build activity…</p> : null}
      </div>
    </section>
  );
}
