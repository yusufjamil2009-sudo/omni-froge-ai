import type { ActivityEvent, ActivityLevel } from "@/lib/omnifrog/types";
import { cn } from "@/lib/utils";

const GLYPH: Record<ActivityLevel, { icon: string; tone: string }> = {
  done: { icon: "✓", tone: "text-success" },
  active: { icon: "→", tone: "text-primary" },
  pending: { icon: "○", tone: "text-muted-foreground" },
  warning: { icon: "⚠", tone: "text-warning" },
  error: { icon: "✕", tone: "text-destructive" },
  info: { icon: "•", tone: "text-muted-foreground" },
};

export function ActivityPanel({
  events,
  title = "Build Activity",
  emptyMessage = "No build activity yet.",
  className,
}: {
  events: ActivityEvent[];
  title?: string;
  emptyMessage?: string;
  className?: string;
}) {
  const current = events.find((event) => event.level === "active");

  return (
    <section className={cn("soft-panel rounded-xl p-4 sm:p-5", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        {current ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
            <span className="size-2 rounded-full bg-primary pulse-dot" />
            {current.message}
          </span>
        ) : null}
      </header>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {events.map((event) => {
            const glyph = GLYPH[event.level] ?? GLYPH.info;
            return (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className={cn("mt-0.5 w-4 shrink-0 text-center font-mono", glyph.tone)}>
                  {glyph.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-foreground">{event.message}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                    {event.agentName ? <span>agent: {event.agentName}</span> : null}
                    {event.filePath ? <span>file: {event.filePath}</span> : null}
                    {event.operation ? <span className="font-mono">{event.operation}</span> : null}
                    {event.model ? <span>model: {event.model}</span> : null}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
