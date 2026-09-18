import { createServerFn } from "@tanstack/react-start";
import type { PreviewSourceFile } from "./omnifrog/types";

async function guard() {
  const { requireSession } = await import("./omnifrog/session.server");
  await requireSession();
}

function validateFiles(input: unknown): PreviewSourceFile[] {
  if (!Array.isArray(input) || input.length > 300) throw new Error("Invalid runtime files.");
  return input.map((file) => {
    if (!file || typeof file !== "object") throw new Error("Invalid runtime file.");
    const item = file as { path?: unknown; content?: unknown };
    if (typeof item.path !== "string" || typeof item.content !== "string") throw new Error("Invalid runtime file.");
    if (Buffer.byteLength(item.content, "utf8") > 1024 * 1024) throw new Error(`Runtime file is too large: ${item.path}`);
    return { path: item.path, content: item.content };
  });
}

export const startProjectRuntime = createServerFn({ method: "POST" })
  .inputValidator((input: { projectId: string; files: unknown }) => {
    if (typeof input?.projectId !== "string" || input.projectId.length === 0) throw new Error("Invalid project.");
    return { projectId: input.projectId, files: validateFiles(input.files) };
  })
  .handler(async ({ data }) => {
    await guard();
    const { startSandboxRuntime } = await import("./omnifrog/runtime-sandbox.server");
    const runtime = await startSandboxRuntime(data.projectId, data.files);
    return {
      ok: true as const,
      runtime: {
        id: runtime.id,
        status: runtime.status,
        framework: runtime.framework,
        port: runtime.port,
        url: runtime.url,
        logs: runtime.logs,
        error: runtime.error,
      },
    };
  });

export const getProjectRuntime = createServerFn({ method: "GET" })
  .inputValidator((input: { runtimeId: string }) => {
    if (typeof input?.runtimeId !== "string" || input.runtimeId.length === 0) throw new Error("Invalid runtime.");
    return { runtimeId: input.runtimeId };
  })
  .handler(async ({ data }) => {
    await guard();
    const { getSandboxRuntime } = await import("./omnifrog/runtime-sandbox.server");
    const runtime = getSandboxRuntime(data.runtimeId);
    if (!runtime) return { ok: false as const, error: "Runtime not found." };
    return {
      ok: true as const,
      runtime: {
        id: runtime.id,
        status: runtime.status,
        framework: runtime.framework,
        port: runtime.port,
        url: runtime.url,
        logs: runtime.logs,
        error: runtime.error,
      },
    };
  });

export const stopProjectRuntime = createServerFn({ method: "POST" })
  .inputValidator((input: { runtimeId: string }) => {
    if (typeof input?.runtimeId !== "string" || input.runtimeId.length === 0) throw new Error("Invalid runtime.");
    return { runtimeId: input.runtimeId };
  })
  .handler(async ({ data }) => {
    await guard();
    const { stopSandboxRuntime } = await import("./omnifrog/runtime-sandbox.server");
    const runtime = await stopSandboxRuntime(data.runtimeId);
    return { ok: true as const, status: runtime?.status ?? "STOPPED" };
  });
