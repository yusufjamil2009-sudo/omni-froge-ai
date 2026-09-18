import { BUILD_STATE_LABELS, type BuildState } from "@/lib/omnifrog/types";
import { cn } from "@/lib/utils";

const TONE: Record<BuildState, string> = {
  IDLE: "text-muted-foreground border-border bg-muted",
  UNDERSTANDING: "text-primary border-primary/25 bg-primary/10",
  PLANNING: "text-primary border-primary/25 bg-primary/10",
  BUILDING: "text-primary border-primary/25 bg-primary/10",
  TESTING: "text-primary border-primary/25 bg-primary/10",
  FIXING: "text-warning border-warning/30 bg-warning/10",
  PREVIEWING: "text-accent-foreground border-accent/40 bg-accent/15",
  COMPLETED: "text-success border-success/30 bg-success/10",
  FAILED: "text-destructive border-destructive/30 bg-destructive/10",
  PAUSED: "text-muted-foreground border-border bg-muted",
};

export function StatusBadge({ status, className }: { status: BuildState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
        TONE[status] ?? TONE.IDLE,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {BUILD_STATE_LABELS[status] ?? status}
    </span>
  );
}
