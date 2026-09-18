import { useMemo, useState } from "react";
import { Maximize2, Monitor, RefreshCw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewSourceFile, PreviewState } from "@/lib/omnifrog/types";
import { cn } from "@/lib/utils";

function buildPreviewDocument(files: PreviewSourceFile[]): string | null {
  const html = files.find((f) => f.path.toLowerCase() === "index.html" || f.path.toLowerCase().endsWith("/index.html"));
  if (!html) return null;
  let document = html.content;
  const css = files.filter((f) => /\.css$/i.test(f.path)).map((f) => f.content).join("\n");
  const js = files.filter((f) => /\.(js|mjs)$/i.test(f.path)).map((f) => f.content).join("\n");
  if (css) document = document.includes("</head>") ? document.replace("</head>", \`<style>\${css}</style></head>\`) : \`<style>\${css}</style>\${document}\`;
  if (js) document = document.includes("</body>") ? document.replace("</body>", \`<script>\${js}</script></body>\`) : \`\${document}<script>\${js}</script>\`;
  return document;
}

export function PreviewPanel({ preview, previewFiles, className }: {
  preview: PreviewState;
  previewFiles: PreviewSourceFile[];
  className?: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [revision, setRevision] = useState(0);
  const srcDoc = useMemo(() => buildPreviewDocument(previewFiles), [previewFiles, revision]);
  const staticPreview = Boolean(srcDoc);

  return (
    <section className={cn("soft-panel flex min-w-0 flex-col rounded-xl", fullscreen && "fixed inset-2 z-50 bg-background shadow-2xl sm:inset-6", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3 sm:p-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live Preview</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">{staticPreview ? "Local project preview" : "Preview runtime pending"}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant={device === "desktop" ? "secondary" : "ghost"} aria-label="Desktop preview" onClick={() => setDevice("desktop")}><Monitor className="size-4" /></Button>
          <Button size="icon" variant={device === "mobile" ? "secondary" : "ghost"} aria-label="Mobile preview" onClick={() => setDevice("mobile")}><Smartphone className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Refresh preview" disabled={!staticPreview} onClick={() => setRevision((v) => v + 1)}><RefreshCw className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label={fullscreen ? "Exit fullscreen" : "Open fullscreen preview"} onClick={() => setFullscreen((v) => !v)}>{fullscreen ? <X className="size-4" /> : <Maximize2 className="size-4" />}</Button>
        </div>
      </header>
      <div className="flex min-h-[24rem] flex-1 items-center justify-center overflow-auto bg-secondary/20 p-3 sm:p-5">
        {staticPreview ? (
          <div className={cn("h-[32rem] w-full transition-all", device === "mobile" && "max-w-[390px]")}>
            <iframe key={revision} title="OmniFrog project preview" srcDoc={srcDoc ?? undefined} sandbox="allow-scripts" className="h-full w-full rounded-lg border border-border bg-white shadow-sm" />
          </div>
        ) : (
          <div className="max-w-md text-center">
            <p className="text-sm font-medium">{preview.available && preview.url ? "Opening project preview…" : "No browser-renderable entry file is available yet."}</p>
            <p className="mt-2 text-xs text-muted-foreground">{previewFiles.length ? "Static HTML/CSS/JS preview is available when index.html exists. PART 14 adds the full project runtime." : "A generated index.html is required for the static preview. PART 14 adds the full project runtime."}</p>
          </div>
        )}
      </div>
    </section>
  );
}
