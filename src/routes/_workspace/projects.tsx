import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, FolderKanban } from "lucide-react";

import { StatusBadge } from "@/components/omnifrog/status-badge";
import { Button } from "@/components/ui/button";
import { projectsQuery } from "@/lib/omnifrog/queries";

export const Route = createFileRoute("/_workspace/projects")({
  head: () => ({
    meta: [
      { title: "Projects — OmniFrog AI" },
      { name: "description", content: "Every OmniFrog AI build project and its current status." },
      { property: "og:title", content: "Projects — OmniFrog AI" },
      { property: "og:description", content: "Your OmniFrog AI build projects." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery),
  errorComponent: () => (
    <p className="soft-panel rounded-xl p-5 text-sm text-destructive">
      Projects could not be loaded. Refresh to try again.
    </p>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Nothing here.</p>,
  component: ProjectsScreen,
});

function ProjectsScreen() {
  const { data: projects } = useSuspenseQuery(projectsQuery);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every build request you have stored in this workspace.
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="soft-panel rounded-xl p-8 text-center">
          <FolderKanban className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your projects will appear here when you start building.
          </p>
          <Button asChild className="mt-5 gradient-primary text-primary-foreground">
            <Link to="/build">
              Start a build <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id} className="soft-panel rounded-xl p-4 transition-smooth">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(project.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={project.status} />
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                      Open <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
