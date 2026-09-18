import { createServerFn } from "@tanstack/react-start";

import { omniError } from "./omnifrog/errors";
import type { ActivityEvent, Project, ProjectSummary } from "./omnifrog/types";

/**
 * Project server functions. Every handler verifies the private session first —
 * a route guard alone would not protect these endpoints.
 */

async function guard() {
  const { requireSession } = await import("./omnifrog/session.server");
  await requireSession();
}

export const listProjects = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProjectSummary[]> => {
    await guard();
    const { selectProjects } = await import("./omnifrog/projects.server");
    return await selectProjects();
  },
);

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => {
    if (typeof input?.id !== "string" || input.id.length === 0) throw new Error("Invalid request");
    return { id: input.id };
  })
  .handler(async ({ data }): Promise<{ project: Project; activity: ActivityEvent[] } | null> => {
    await guard();
    const { selectProject } = await import("./omnifrog/projects.server");
    return await selectProject(data.id);
  });

export const getRecentActivity = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActivityEvent[]> => {
    await guard();
    const { selectRecentActivity } = await import("./omnifrog/projects.server");
    return await selectRecentActivity();
  },
);

/**
 * Stores a real build request. It does NOT fabricate AI output: the AI build
 * engine is connected in later parts, so the project stays in UNDERSTANDING
 * with an honest activity trail.
 */
export const createBuildRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { request: string }) => {
    const request = typeof input?.request === "string" ? input.request.trim() : "";
    if (request.length < 3) throw new Error("Describe what you want to build.");
    return { request };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { insertProject, logActivity } = await import("./omnifrog/projects.server");
      const project = await insertProject(data.request);
      await logActivity(project.id, [
        { level: "done", message: "Request received", operation: "request.receive" },
        { level: "done", message: "Project request stored", operation: "project.create" },
        { level: "active", message: "Preparing build environment", operation: "build.prepare" },
        {
          level: "pending",
          message: "Waiting for AI build engine (connects in a later part)",
          operation: "build.engine",
        },
      ]);
      return { ok: true as const, projectId: project.id };
    } catch {
      return {
        ok: false as const,
        error: omniError("project.create", "Could not store the build request.", true),
      };
    }
  });
