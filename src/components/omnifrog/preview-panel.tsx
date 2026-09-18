import { useState } from "react";
import { Monitor, Smartphone, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PreviewState } from "@/lib/omnifrog/types";
import { cn } from "@/lib/utils";

/**
 * Preview container architecture for PART 13. It renders a real preview only
 * when a preview URL exists — it never fabricates a generated site.
 */
export function PreviewPanel({
  preview,
  className,
}: {
  preview: PreviewState;
  className?: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <section
      className={cn(
        "soft-panel flex min-w-0 flex-col rounded-xl",
        fullscreen && "fixed inset-2 z-50 sm:inset-6",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3 sm:p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Live Preview
        </h2>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={device === "desktop" ? "secondary" : "ghost"}
            aria-label="Desktop preview"
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={device === "mobile" ? "secondary" : "ghost"}
            aria-label="Mobile preview"
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Toggle fullscreen preview"
            onClick={() => setFullscreen((value) => !value)}
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-56 flex-1 items-center justify-center overflow-hidden p-3 sm:p-4">
        {preview.available && preview.url ? (
          <iframe
            title="Project preview"
            src={preview.url}
            className={cn(
              "h-full w-full rounded-lg border border-border bg-card",
              device === "mobile" && "mx-auto max-w-[390px]",
            )}
          />
        ) : (
          <div className="max-w-sm text-center">
            <p className="text-sm font-medium text-foreground">
              Your project preview will appear here after a successful build.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Preview and deployment URLs connect in a later part. Nothing is simulated here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
