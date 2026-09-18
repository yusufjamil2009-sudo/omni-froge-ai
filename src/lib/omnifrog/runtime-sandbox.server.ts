import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { PreviewSourceFile } from "./types";

export type SandboxRuntimeStatus = "IDLE" | "INSTALLING" | "BUILDING" | "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "ERROR";

export interface SandboxRuntime {
  id: string;
  projectId: string;
  status: SandboxRuntimeStatus;
  framework: string | null;
  port: number | null;
  url: string | null;
  workdir: string;
  containerId: string | null;
  logs: string[];
  startedAt: string | null;
  stoppedAt: string | null;
  error: string | null;
}

const runtimes = new Map<string, SandboxRuntime>();
const processes = new Map<string, ChildProcess>();

const MAX_FILES = 300;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
const RUNTIME_TIMEOUT_MS = 30 * 60 * 1000;
const protectedPath = /(^|\\/)(node_modules|\.git|\.env(?:\\.|$)|dist|build|coverage)(\\/|$)/i;

function safePath(input: string): string {
  const p = input.replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
  if (!p || p.split("/").includes("..") || protectedPath.test(p) || /^\/?[A-Za-z]:[\\/]/.test(p) || p.startsWith("/")) {
    throw new Error(`Unsafe project path: ${input}`);
  }
  return p;
}

function appendLog(runtime: SandboxRuntime, line: string) {
  runtime.logs = [...runtime.logs, line].slice(-250);
}

async function command(command: string, args: string[], cwd: string, timeout = COMMAND_TIMEOUT_MS): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, CI: "1", npm_config_update_notifier: "false", npm_config_fund: "false", npm_config_audit: "false" }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeout}ms`));
    }, timeout);
    child.stdout.on("data", (b) => { stdout += b.toString(); });
    child.stderr.on("data", (b) => { stderr += b.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${command} exited with code ${code}`).slice(-12000)));
    });
  });
}

async function dockerAvailable(): Promise<boolean> {
  try { await command("docker", ["version", "--format", "{{.Server.Version}}"], process.cwd(), 15000); return true; } catch { return false; }
}

async function detectFramework(workdir: string): Promise<string | null> {
  try {
    const pkg = JSON.parse(await readFile(join(workdir, "package.json"), "utf8")) as { dependencies?: Record<string,string>; devDependencies?: Record<string,string> };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (deps.next) return "Next.js";
    if (deps.vite) return "Vite";
    if (deps.react) return "React";
    if (deps.vue) return "Vue";
    if (deps["@angular/core"]) return "Angular";
  } catch {}
  return null;
}

async function writeProject(workdir: string, files: PreviewSourceFile[]) {
  if (files.length > MAX_FILES) throw new Error(`Project has more than ${MAX_FILES} files.`);
  let total = 0;
  for (const file of files) {
    const path = safePath(file.path);
    const bytes = Buffer.byteLength(file.content, "utf8");
    if (bytes > MAX_FILE_BYTES) throw new Error(`File exceeds ${MAX_FILE_BYTES} bytes: ${path}`);
    total += bytes;
    if (total > MAX_TOTAL_BYTES) throw new Error(`Project exceeds ${MAX_TOTAL_BYTES} bytes.`);
    const target = resolve(workdir, path);
    if (!target.startsWith(resolve(workdir) + sep)) throw new Error("Path escaped sandbox.");
    const parts = path.split("/");
    let dir = workdir;
    for (const part of parts.slice(0, -1)) { dir = join(dir, part); await import("node:fs/promises").then(fs => fs.mkdir(dir, { recursive: true })); }
    await writeFile(target, file.content, "utf8");
  }
}

async function dockerRun(runtime: SandboxRuntime, workdir: string, args: string[], timeout: number) {
  const mount = `${workdir}:/workspace`;
  const result = await command("docker", [
    "run", "--rm", "--network=bridge", "--cpus=2", "--memory=2g", "--pids-limit=256",
    "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=512m",
    "-v", mount, "-w", "/workspace", "node:22-alpine", "sh", "-lc", args.join(" ")
  ], process.cwd(), timeout);
  appendLog(runtime, result.stdout);
  appendLog(runtime, result.stderr);
  return result;
}

export async function startSandboxRuntime(projectId: string, files: PreviewSourceFile[]): Promise<SandboxRuntime> {
  if (!projectId) throw new Error("Project id is required.");
  const docker = await dockerAvailable();
  if (!docker) throw new Error("Secure project runtime requires Docker on the server. The application will not execute arbitrary npm projects directly on the host.");

  const id = randomUUID();
  const workdir = await mkdtemp(join(tmpdir(), `omnifrog-${id}-`));
  const runtime: SandboxRuntime = { id, projectId, status: "INSTALLING", framework: null, port: null, url: null, workdir, containerId: null, logs: [], startedAt: null, stoppedAt: null, error: null };
  runtimes.set(id, runtime);

  try {
    await writeProject(workdir, files);
    runtime.framework = await detectFramework(workdir);
    if (!runtime.framework) throw new Error("No supported package.json framework detected.");

    const packageManager = await import("node:fs/promises").then(fs => fs.access(join(workdir, "package-lock.json")).then(() => "npm ci").catch(() => "npm install"));
    appendLog(runtime, `Installing dependencies with ${packageManager} inside isolated Docker sandbox.`);
    await dockerRun(runtime, workdir, [packageManager, "--ignore-scripts"], COMMAND_TIMEOUT_MS);

    runtime.status = "BUILDING";
    appendLog(runtime, "Running production build inside isolated Docker sandbox.");
    await dockerRun(runtime, workdir, ["npm", "run", "build"], COMMAND_TIMEOUT_MS);

    runtime.status = "STARTING";
    const port = 4173 + Math.floor(Math.random() * 1000);
    runtime.port = port;
    const startCommand = runtime.framework === "Next.js"
      ? `npm run start -- --hostname 0.0.0.0 --port ${port}`
      : `npm run preview -- --host 0.0.0.0 --port ${port}`;
    const child = spawn("docker", [
      "run", "--rm", "--network=bridge", "--cpus=2", "--memory=2g", "--pids-limit=256",
      "-p", `127.0.0.1:${port}:${port}`, "-v", `${workdir}:/workspace`, "-w", "/workspace",
      "node:22-alpine", "sh", "-lc", startCommand
    ], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    processes.set(id, child);
    child.stdout.on("data", b => appendLog(runtime, b.toString()));
    child.stderr.on("data", b => appendLog(runtime, b.toString()));
    child.on("close", code => { if (runtime.status === "RUNNING") { runtime.status = "ERROR"; runtime.error = `Runtime exited with code ${code}`; } processes.delete(id); });

    runtime.status = "RUNNING";
    runtime.startedAt = new Date().toISOString();
    runtime.url = `http://127.0.0.1:${port}`;
    setTimeout(() => { void stopSandboxRuntime(id); }, RUNTIME_TIMEOUT_MS);
    return runtime;
  } catch (error) {
    runtime.status = "ERROR";
    runtime.error = error instanceof Error ? error.message : String(error);
    appendLog(runtime, runtime.error);
    await stopSandboxRuntime(id).catch(() => undefined);
    throw error;
  }
}

export function getSandboxRuntime(id: string): SandboxRuntime | null {
  return runtimes.get(id) ?? null;
}

export async function stopSandboxRuntime(id: string): Promise<SandboxRuntime | null> {
  const runtime = runtimes.get(id);
  if (!runtime) return null;
  runtime.status = "STOPPING";
  const child = processes.get(id);
  if (child) {
    child.kill("SIGTERM");
    await new Promise(resolvePromise => setTimeout(resolvePromise, 1500));
    if (!child.killed) child.kill("SIGKILL");
    processes.delete(id);
  }
  runtime.status = "STOPPED";
  runtime.stoppedAt = new Date().toISOString();
  runtime.url = null;
  await rm(runtime.workdir, { recursive: true, force: true }).catch(() => undefined);
  return runtime;
}
