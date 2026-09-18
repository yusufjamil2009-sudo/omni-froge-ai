import type { ActivityEvent } from "@/lib/omnifrog/types";
import { ActivityPanel } from "./activity-panel";

export function LiveActivityConsole({
  events,
  className,
}: {
  events: ActivityEvent[];
  className?: string;
}) {
  const agents = new Map<string, { name: string; state: ActivityEvent["level"] }>();
  for (const event of events) {
    if (!event.agentId || !event.agentName) continue;
    agents.set(event.agentId, { name: event.agentName, state: event.level });
  }

  const active = [...agents.values()].filter((agent) => agent.state === "active").length;
  const done = [...agents.values()].filter((agent) => agent.state === "done").length;
  const errors = [...agents.values()].filter((agent) => agent.state === "error").length;

  return (
    <section className={className}>
      <div className="soft-panel rounded-xl p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Live Agent Console
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Real persisted agent and file events. No simulated progress.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border px-2.5 py-1">Active {active}</span>
            <span className="rounded-full border px-2.5 py-1">Done {done}</span>
            {errors > 0 ? <span className="rounded-full border px-2.5 py-1">Errors {errors}</span> : null}
          </div>
        </header>

        {agents.size > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...agents.entries()].map(([id, agent]) => (
              <div key={id} className="rounded-lg border bg-secondary/30 px-3 py-2">
                <div className="truncate text-xs font-medium">{agent.name}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{agent.state}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ActivityPanel events={events} title="Live Build Stream" className="mt-3" />
    </section>
  );
}
