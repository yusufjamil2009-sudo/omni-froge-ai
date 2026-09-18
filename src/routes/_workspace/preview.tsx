import { createFileRoute } from "@tanstack/react-router";

import { PreviewPanel } from "@/components/omnifrog/preview-panel";

export const Route = createFileRoute("/_workspace/preview")({
  head: () => ({
    meta: [
      { title: "Live Preview — OmniFrog AI" },
      { name: "description", content: "Preview container for OmniFrog AI builds." },
      { property: "og:title", content: "Live Preview — OmniFrog AI" },
      { property: "og:description", content: "OmniFrog AI live preview workspace." },
    ],
  }),
  component: PreviewScreen,
});

function PreviewScreen() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Live Preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mobile, desktop and fullscreen preview modes are ready. A preview appears once a build
          engine produces one — nothing is simulated.
        </p>
      </header>

      <PreviewPanel
        preview={{ available: false, url: null, deploymentUrl: null }}
        className="min-h-[60vh]"
      />
    </div>
  );
}
