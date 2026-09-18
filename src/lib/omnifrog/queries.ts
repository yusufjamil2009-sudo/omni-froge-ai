import { queryOptions } from "@tanstack/react-query";

import { getProviders } from "@/lib/providers.functions";
import { getProject, getRecentActivity, listProjects } from "@/lib/projects.functions";

export const providersQuery = queryOptions({
  queryKey: ["omnifrog", "providers"],
  queryFn: () => getProviders(),
});

export const projectsQuery = queryOptions({
  queryKey: ["omnifrog", "projects"],
  queryFn: () => listProjects(),
});

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: ["omnifrog", "project", id],
    queryFn: () => getProject({ data: { id } }),
  });

export const activityQuery = queryOptions({
  queryKey: ["omnifrog", "activity"],
  queryFn: () => getRecentActivity(),
});
