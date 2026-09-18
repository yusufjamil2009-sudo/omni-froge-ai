/**
 * OmniFrog AI — project data access (server only).
 *
 * Project rows are private to the workspace owner and are only reachable
 * through server functions that have already verified the private session.
 */
import type {
  ActivityEvent,
  ActivityLevel,
  BuildState,
  Project,
  ProjectFile,
  ProjectSummary,
  JsonValue,
} from "./types";

type Row = Record<string, unknown>;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toProject(row: Row): Project {
  return {
    id: String(row["id"]),
    name: String(row["name"]),
    request: String(row["request"]),
    status: String(row["status"]) as BuildState,
    buildState: (row["build_state"] as Record<string, JsonValue>) ?? {},
    preview: {
      available: Boolean(row["preview_url"]),
      url: (row["preview_url"] as string | null) ?? null,
      deploymentUrl: (row["deployment_url"] as string | null) ?? null,
    },
    files: ((row["files"] as ProjectFile[] | null) ?? []) as ProjectFile[],
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}

function toEvent(row: Row): ActivityEvent {
  return {
    id: String(row["id"]),
    projectId: String(row["project_id"]),
    level: String(row["level"]) as ActivityLevel,
    message: String(row["message"]),
    agentId: (row["agent_id"] as string | null) ?? null,
    agentName: (row["agent_name"] as string | null) ?? null,
    filePath: (row["file_path"] as string | null) ?? null,
    operation: (row["operation"] as string | null) ?? null,
    provider: (row["provider"] as string | null) ?? null,
    model: (row["model"] as string | null) ?? null,
    details: (row["details"] as Record<string, JsonValue>) ?? {},
    createdAt: String(row["created_at"]),
  };
}

export function deriveProjectName(request: string): string {
  const firstLine = request
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Untitled project";
  const clean = firstLine.replace(/^[#>*\-\s]+/, "").slice(0, 70).trim();
  return clean.length > 0 ? clean : "Untitled project";
}

export async function insertProject(request: string): Promise<Project> {
  const client = await db();
  const { data, error } = await client
    .from("omnifrog_projects")
    .insert({ name: deriveProjectName(request), request, status: "PAUSED" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toProject(data as Row);
}

export async function logActivity(
  projectId: string,
  events: Array<{ level: ActivityLevel; message: string; operation?: string }>,
): Promise<void> {
  if (events.length === 0) return;
  const client = await db();
  const { error } = await client.from("omnifrog_activity").insert(
    events.map((event) => ({
      project_id: projectId,
      level: event.level,
      message: event.message,
      operation: event.operation ?? null,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function selectProjects(): Promise<ProjectSummary[]> {
  const client = await db();
  const { data, error } = await client
    .from("omnifrog_projects")
    .select("id, name, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    id: String(row["id"]),
    name: String(row["name"]),
    status: String(row["status"]) as BuildState,
    updatedAt: String(row["updated_at"]),
  }));
}

export async function selectProject(
  id: string,
): Promise<{ project: Project; activity: ActivityEvent[] } | null> {
  const client = await db();
  const { data, error } = await client
    .from("omnifrog_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: events, error: eventsError } = await client
    .from("omnifrog_activity")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (eventsError) throw new Error(eventsError.message);

  return {
    project: toProject(data as Row),
    activity: ((events ?? []) as Row[]).map(toEvent),
  };
}

export async function selectRecentActivity(limit = 50): Promise<ActivityEvent[]> {
  const client = await db();
  const { data, error } = await client
    .from("omnifrog_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toEvent);
}


export async function updateProjectBuildState(
  id: string,
  patch: Record<string, JsonValue>,
  status?: BuildState,
): Promise<void> {
  const client = await db();
  const { data: current, error: readError } = await client
    .from("omnifrog_projects")
    .select("build_state")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);
  const currentState = (current?.build_state as Record<string, JsonValue> | null) ?? {};
  const update: Record<string, unknown> = {
    build_state: { ...currentState, ...patch },
  };
  if (status) update.status = status;
  const { error } = await client.from("omnifrog_projects").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}
