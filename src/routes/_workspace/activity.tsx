import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ActivityPanel } from "@/components/omnifrog/activity-panel";
import { activityQuery } from "@/lib/omnifrog/queries";

export const Route = createFileRoute("/_workspace/activity")({
  head: () => ({
    meta: [
      { title: "Build Activity — OmniFrog AI" },
      { name: "description", content: "Real operations recorded across OmniFrog AI builds." },
      { property: "og:title", content: "Build Activity — OmniFrog AI" },
      { property: "og:description", content: "OmniFrog AI build activity log." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(activityQuery),
  errorComponent: () => (
    <p className="soft-panel rounded-xl p-5 text-sm text-destructive">
      Activity could not be loaded. Refresh to try again.
    </p>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Nothing here.</p>,
  component: ActivityScreen,
});

function ActivityScreen() {
  const { data: events } = useSuspenseQuery(activityQuery);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Build Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only operations that actually happened are recorded here. Agent, file, provider and model
          fields fill in once those systems connect.
        </p>
      </header>

      <ActivityPanel
        events={events}
        title="All activity"
        emptyMessage="No build activity yet. Submit a build request to start the log."
      />
    </div>
  );
}
