import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, FileCode2 } from "lucide-react";

import { ActivityPanel } from "@/components/omnifrog/activity-panel";
import { PreviewPanel } from "@/components/omnifrog/preview-panel";
import { StatusBadge } from "@/components/omnifrog/status-badge";
import { Button } from "@/components/ui/button";
import { projectQuery } from "@/lib/omnifrog/queries";

export const Route = createFileRoute("/_workspace/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project workspace — OmniFrog AI" },
      { name: "description", content: "Files, build, preview and activity for this project." },
      { property: "og:title", content: "Project workspace — OmniFrog AI" },
      { property: "og:description", content: "OmniFrog AI project workspace." },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery(params.projectId)),
  errorComponent: () => (
    <p className="soft-panel rounded-xl p-5 text-sm text-destructive">
      This project could not be loaded. Refresh to try again.
    </p>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Project not found.</p>,
  component: ProjectDetailScreen,
});

function ProjectDetailScreen() {
  const { projectId } = Route.useParams();
  const { data } = useSuspenseQuery(projectQuery(projectId));

  if (!data) {
    return (
      <div className="soft-panel rounded-xl p-6">
        <p className="font-medium">Project not found</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/projects">
            <ArrowLeft className="size-4" /> Back to projects
          </Link>
        </Button>
      </div>
    );
  }

  const { project, activity } = data;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/projects">
          <ArrowLeft className="size-4" /> Projects
        </Link>
      </Button>

      <header className="soft-panel rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold sm:text-2xl">{project.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Created {new Date(project.createdAt).toLocaleString()} · Updated{" "}
              {new Date(project.updatedAt).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Original request
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary/60 p-3 font-mono text-xs leading-relaxed">
            {project.request}
          </pre>
        </details>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section className="soft-panel min-w-0 rounded-xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Files
          </h2>
          {project.files.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">
              <FileCode2 className="size-6" />
              <p className="mt-2">
                No project files yet. The coding engine that writes files connects in a later part.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {project.files.map((file) => (
                <li key={file.path} className="truncate font-mono text-xs">
                  {file.path}
                </li>
              ))}
            </ul>
          )}
        </section>

        <PreviewPanel preview={project.preview} className="min-w-0" />
      </div>

      <ActivityPanel
        events={activity}
        emptyMessage="No activity recorded for this project yet."
      />
    </div>
  );
}
